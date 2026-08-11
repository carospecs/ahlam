// PRICING EVAL — scores the V3 appraiser pipeline against the reference truth set.
//
// Runs the fixture vehicles (scripts/pricing-fixtures.json) through the REAL
// pricing code by direct lib import (resolveGeneration → fetchCompsForParts →
// priceParts, optionally marketPriceParts), then scores every judged price
// against scripts/pricing-reference.cache.json (andyOverride wins).
//
//   node scripts/pricing-eval.mjs                       # full run, cached comps
//   node scripts/pricing-eval.mjs --dry                 # zero API calls, cost estimate
//   node scripts/pricing-eval.mjs --vehicles camry-2018,f150-2016
//   node scripts/pricing-eval.mjs --parts 3             # cap parts/vehicle (smoke)
//   node scripts/pricing-eval.mjs --fresh-comps         # refetch eBay pools (once/session)
//   node scripts/pricing-eval.mjs --grounded            # also run zero-comp grounded fallback
//   node scripts/pricing-eval.mjs --report iter0        # write scripts/.cache/runs/iter0.json
//   node scripts/pricing-eval.mjs --no-gate             # don't exit 1 on failed thresholds
//
// Comp caching is the point: eBay pools cache to scripts/.cache/comps/<slug>.json
// and are reused by default, so tuning iterations are RETRIEVAL-CONSTANT — a
// prompt change is measured against identical comps. Refresh at session
// boundaries only, then re-baseline.
//
// Needs ANTHROPIC_API_KEY (judge) and EBAY_CLIENT_ID/SECRET (only for
// --fresh-comps / first run) in web/.env.local.
import { respawnedWithHook } from "./ts-hook.mjs";
respawnedWithHook(import.meta.url, "__PRICING_EVAL_CHILD");

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");
const COMPS_DIR = resolve(CACHE_DIR, "comps");
const RUNS_DIR = resolve(CACHE_DIR, "runs");
for (const d of [CACHE_DIR, COMPS_DIR, RUNS_DIR]) mkdirSync(d, { recursive: true });

// ── env into process.env BEFORE importing the libs (they read env at load/call) ──
try {
  for (const line of readFileSync(resolve(__dirname, "../web/.env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* checked below */ }

const { resolveGeneration } = await import("../web/src/lib/generations.ts");
const { fetchCompsForParts } = await import("../web/src/lib/ebay-comps.ts");
const { priceParts, judgeModel } = await import("../web/src/lib/price-judge.ts");

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? (argv[i + 1] ?? true) : null; };
const has = (name) => argv.includes(name);
const DRY = has("--dry");
const GROUNDED = has("--grounded");
const FRESH = has("--fresh-comps");
const NO_GATE = has("--no-gate");
const ONLY = flag("--vehicles");
const PARTS_CAP = Number(flag("--parts")) || Infinity;
const REPORT = typeof flag("--report") === "string" ? flag("--report") : null;

const { vehicles: allVehicles } = JSON.parse(readFileSync(resolve(__dirname, "pricing-fixtures.json"), "utf8"));
const vehicles = (ONLY ? allVehicles.filter((v) => ONLY.split(",").includes(v.slug)) : allVehicles)
  .map((v) => ({ ...v, parts: v.parts.slice(0, PARTS_CAP) }));
if (!vehicles.length) { console.error(`No fixture vehicles matched --vehicles ${ONLY}`); process.exit(1); }

const REF_PATH = resolve(__dirname, "pricing-reference.cache.json");
const reference = existsSync(REF_PATH) ? JSON.parse(readFileSync(REF_PATH, "utf8")) : {};
const refFor = (slug, part, grade) => {
  const e = reference[`${slug}|${part}|${grade}`];
  if (!e?.ref) return null;
  return e.andyOverride ?? e.ref;
};

// ── convergence thresholds (docs/PRICING_V3_PLAN.md Phase 0 / plan) ──────────
const GATES = {
  medianAbsErrPct: 15,
  p90AbsErrPct: 40,
  rangeCoveragePct: 80,
  medianRangeWidthPct: 60,
  unflaggedTwoXOff: 0,
  nullOrReviewPct: 15,
  judgeP95Ms: 30_000,
};

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };

// ── comp pools (cached) ──────────────────────────────────────────────────────
async function compsFor(v) {
  const path = resolve(COMPS_DIR, `${v.slug}.json`);
  if (!FRESH && existsSync(path)) return JSON.parse(readFileSync(path, "utf8")).pools;
  if (DRY) return null;
  const gen = resolveGeneration(v.fitment.make, v.fitment.model, v.fitment.year);
  const t = Date.now();
  const pools = await fetchCompsForParts(v.fitment, v.parts.map((p) => p.name), gen);
  if (!pools) {
    console.error(`  ${v.slug}: eBay unavailable (check EBAY_CLIENT_ID/SECRET) and no comp cache at ${path}`);
    return null;
  }
  writeFileSync(path, JSON.stringify({ fetchedAt: new Date().toISOString(), fetchMs: Date.now() - t, gen, pools }, null, 2));
  console.log(`  ${v.slug}: fetched comps for ${Object.keys(pools).length} parts in ${Date.now() - t}ms`);
  return pools;
}

// ── dry run ──────────────────────────────────────────────────────────────────
if (DRY) {
  let totalParts = 0, withRef = 0, withCachedComps = 0;
  for (const v of vehicles) {
    const path = resolve(COMPS_DIR, `${v.slug}.json`);
    const cached = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).pools : null;
    const compCounts = v.parts.map((p) => cached?.[p.name]?.length ?? null);
    totalParts += v.parts.length;
    withRef += v.parts.filter((p) => refFor(v.slug, p.name, p.grade)).length;
    if (cached) withCachedComps += compCounts.filter((c) => c > 0).length;
    console.log(`${v.slug.padEnd(16)} ${String(v.parts.length).padStart(2)} parts  comps:${cached ? "cached" : "MISSING"}  ref:${v.parts.filter((p) => refFor(v.slug, p.name, p.grade)).length}/${v.parts.length}`);
  }
  // Sonnet 5 $3/$15 per MTok; ~2.5k in + ~1.5k out per per-part appraiser call
  const estCost = totalParts * ((2500 / 1e6) * 3 + (1500 / 1e6) * 15);
  console.log(`\nDRY RUN — no API calls. ${vehicles.length} vehicles, ${totalParts} parts (${withRef} with reference truth, ${withCachedComps} with cached comps).`);
  console.log(`Estimated judge cost for a full run (${judgeModel()}): ~$${estCost.toFixed(2)} (rough; excludes grounded fallback).`);
  if (withRef === 0) console.log("⚠ No reference truth yet — run scripts/pricing-reference.mjs first (scoring will be skipped otherwise).");
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY in web/.env.local"); process.exit(1); }

// ── run ──────────────────────────────────────────────────────────────────────
console.log(`Pricing eval — judge ${judgeModel()}, ${vehicles.length} vehicle(s)${GROUNDED ? ", grounded fallback ON" : ""}`);
const rows = [];       // one per judged part
const usage = [];      // token usage across all judge calls
const judgeCallMs = [];
const perVehicle = [];

for (const v of vehicles) {
  const pools = await compsFor(v);
  if (!pools) continue;
  const t0 = Date.now();
  const withComps = v.parts.filter((p) => (pools[p.name] ?? []).length > 0);
  const zeroComp = v.parts.filter((p) => (pools[p.name] ?? []).length === 0);
  const judgeInput = withComps.map((p) => ({
    part_id: p.name,
    name: p.name,
    grade: p.grade,
    conditionNotes: p.conditionNotes ?? null,
    fitment: v.fitment,
    comps: pools[p.name] ?? [],
    photo: null,
  }));
  const callMs = [];
  const judged = (await priceParts(judgeInput, { callMs, usage })) ?? [];
  judgeCallMs.push(...callMs);

  let grounded = [];
  if (GROUNDED && zeroComp.length) {
    const { marketPriceParts } = await import("../web/src/lib/market-pricing.ts");
    const id = [v.fitment.year, v.fitment.make, v.fitment.model, v.fitment.trim].filter(Boolean).join(" ");
    grounded = (await marketPriceParts({ vehicleId: id, spec: v.fitment.engine ? `engine ${v.fitment.engine}` : "", powertrainLine: null, parts: zeroComp.map((p) => ({ name: p.name, grade: p.grade })) })) ?? [];
  }

  const wallMs = Date.now() - t0;
  for (const p of v.parts) {
    const j = judged.find((r) => r.part_id === p.name);
    const g = grounded.find?.((r) => r.name === p.name);
    const ref = refFor(v.slug, p.name, p.grade);
    const est = j ? j.estimate : (g?.usedPartPriceUsd ?? null);
    const low = j ? j.low : (g?.usedPartPriceLowUsd ?? null);
    const high = j ? j.high : (g?.usedPartPriceHighUsd ?? null);
    const needsReview = j ? j.needsReview : false;
    const source = j ? "judge" : g ? "grounded" : (pools[p.name] ?? []).length === 0 ? "zero-comp-skipped" : "judge-failed";
    rows.push({
      slug: v.slug, segment: v.segment, part: p.name, grade: p.grade,
      compCount: (pools[p.name] ?? []).length,
      source, est, low, high, needsReview,
      confidence: j?.confidence ?? g?.confidence ?? null,
      note: j?.note ?? null,
      reasoning: j?.reasoning ?? null,
      ref,
      signedErrPct: ref && est != null ? ((est - ref.mid) / ref.mid) * 100 : null,
      inRange: ref && low != null && high != null ? ref.mid >= low && ref.mid <= high : null,
      rangeWidthPct: est != null && low != null && high != null && est > 0 ? ((high - low) / est) * 100 : null,
    });
  }
  perVehicle.push({ slug: v.slug, parts: v.parts.length, judged: judged.length, zeroComp: zeroComp.length, wallMs });
  console.log(`  ${v.slug.padEnd(16)} judged ${judged.length}/${withComps.length} (zero-comp ${zeroComp.length}) in ${(wallMs / 1000).toFixed(1)}s`);
}

// ── scoring ──────────────────────────────────────────────────────────────────
const scored = rows.filter((r) => r.signedErrPct != null);
const abs = scored.map((r) => Math.abs(r.signedErrPct));
const nullOrReview = rows.filter((r) => r.est == null || r.needsReview);
const unflagged2x = scored.filter((r) => Math.abs(r.signedErrPct) > 100 && !r.needsReview);
const withRange = scored.filter((r) => r.inRange != null);

const metrics = {
  vehicles: perVehicle.length,
  parts: rows.length,
  scoredAgainstRef: scored.length,
  medianAbsErrPct: median(abs),
  p90AbsErrPct: pct(abs, 90),
  medianSignedErrPct: median(scored.map((r) => r.signedErrPct)),
  rangeCoveragePct: withRange.length ? (withRange.filter((r) => r.inRange).length / withRange.length) * 100 : null,
  medianRangeWidthPct: median(scored.map((r) => r.rangeWidthPct).filter((x) => x != null)),
  nullOrReviewPct: rows.length ? (nullOrReview.length / rows.length) * 100 : null,
  unflaggedTwoXOff: unflagged2x.length,
  judgeCalls: judgeCallMs.length,
  judgeP50Ms: pct(judgeCallMs, 50),
  judgeP95Ms: pct(judgeCallMs, 95),
  judgeMaxMs: judgeCallMs.length ? Math.max(...judgeCallMs) : null,
  tokens: usage.reduce((a, u) => ({ input: a.input + u.input_tokens, output: a.output + u.output_tokens }), { input: 0, output: 0 }),
};
const isOpusJudge = /opus/.test(judgeModel());
metrics.estCostUsd = (metrics.tokens.input / 1e6) * (isOpusJudge ? 5 : 3) + (metrics.tokens.output / 1e6) * (isOpusJudge ? 25 : 15);

const fmt = (x, d = 1) => (x == null ? "  —" : x.toFixed(d));
console.log(`
── SCORES (vs reference mid, ${scored.length} parts) ─────────────────────────
  median abs error   ${fmt(metrics.medianAbsErrPct)}%   (gate ≤ ${GATES.medianAbsErrPct}%)
  p90 abs error      ${fmt(metrics.p90AbsErrPct)}%   (gate ≤ ${GATES.p90AbsErrPct}%)
  median bias        ${fmt(metrics.medianSignedErrPct)}%   (+ = machine prices high)
  range coverage     ${fmt(metrics.rangeCoveragePct)}%   (gate ≥ ${GATES.rangeCoveragePct}%)
  median range width ${fmt(metrics.medianRangeWidthPct)}%   (gate ≤ ${GATES.medianRangeWidthPct}%)
  null/review rate   ${fmt(metrics.nullOrReviewPct)}%   (gate ≤ ${GATES.nullOrReviewPct}%)
  unflagged >2x off  ${metrics.unflaggedTwoXOff}      (gate = 0)
── LATENCY ─────────────────────────────────────────────
  judge calls ${metrics.judgeCalls}  p50 ${fmt(metrics.judgeP50Ms / 1000)}s  p95 ${fmt(metrics.judgeP95Ms / 1000)}s (gate ≤ ${GATES.judgeP95Ms / 1000}s)  max ${fmt(metrics.judgeMaxMs / 1000)}s
── COST ────────────────────────────────────────────────
  tokens in/out ${metrics.tokens.input}/${metrics.tokens.output}  ≈ $${metrics.estCostUsd.toFixed(2)}`);

// worst offenders with their reasoning — the diagnostician's raw material
const worst = [...scored].sort((a, b) => Math.abs(b.signedErrPct) - Math.abs(a.signedErrPct)).slice(0, 10);
console.log(`\n── WORST 10 ────────────────────────────────────────────`);
for (const r of worst) {
  console.log(`  ${(r.slug + " · " + r.part).padEnd(44)} est $${r.est} vs ref $${r.ref.mid}  ${r.signedErrPct > 0 ? "+" : ""}${r.signedErrPct.toFixed(0)}%${r.needsReview ? "  [review]" : ""}  (${r.compCount} comps)`);
}

// segment breakdown
console.log(`\n── BY SEGMENT ──────────────────────────────────────────`);
for (const seg of [...new Set(rows.map((r) => r.segment))]) {
  const s = scored.filter((r) => r.segment === seg);
  console.log(`  ${seg.padEnd(10)} ${String(s.length).padStart(3)} scored  median abs ${fmt(median(s.map((r) => Math.abs(r.signedErrPct))))}%`);
}

const gate = {
  medianAbsErr: metrics.medianAbsErrPct != null && metrics.medianAbsErrPct <= GATES.medianAbsErrPct,
  p90AbsErr: metrics.p90AbsErrPct != null && metrics.p90AbsErrPct <= GATES.p90AbsErrPct,
  rangeCoverage: metrics.rangeCoveragePct != null && metrics.rangeCoveragePct >= GATES.rangeCoveragePct,
  rangeWidth: metrics.medianRangeWidthPct != null && metrics.medianRangeWidthPct <= GATES.medianRangeWidthPct,
  unflagged: metrics.unflaggedTwoXOff === 0,
  nullOrReview: metrics.nullOrReviewPct != null && metrics.nullOrReviewPct <= GATES.nullOrReviewPct,
  judgeLatency: metrics.judgeP95Ms != null && metrics.judgeP95Ms <= GATES.judgeP95Ms,
};
const converged = Object.values(gate).every(Boolean);
console.log(`\nGATES: ${Object.entries(gate).map(([k, v]) => `${v ? "✓" : "✗"}${k}`).join("  ")}`);
console.log(converged ? "CONVERGED — all gates pass." : "NOT CONVERGED.");

if (REPORT) {
  const out = resolve(RUNS_DIR, `${REPORT.replace(/\.json$/, "")}.json`);
  writeFileSync(out, JSON.stringify({
    at: new Date().toISOString(),
    config: { judgeModel: judgeModel(), grounded: GROUNDED, vehicles: vehicles.map((v) => v.slug), gates: GATES },
    metrics, gate, converged, perVehicle,
    rows,   // full detail incl. reasoning blobs
    worst: worst.map((r) => ({ slug: r.slug, part: r.part, est: r.est, ref: r.ref, signedErrPct: r.signedErrPct, needsReview: r.needsReview, compCount: r.compCount, note: r.note, reasoning: r.reasoning })),
  }, null, 2));
  console.log(`Report: ${out}`);
}

process.exit(converged || NO_GATE || !scored.length ? 0 : 1);
