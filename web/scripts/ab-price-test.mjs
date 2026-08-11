// A/B test: sharpened production pricing prompt (Arm A) vs unsharpened naive
// prompt (Arm B), same model + params + schema, scored against real eBay comp
// medians. One-off experiment harness — not part of the app. Run from web/:
//   node scripts/ab-price-test.mjs [--ebay-only]
// Retries on credit/rate-limit errors (credits resetting) for up to 2 hours.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.AB_OUT_DIR || __dirname;

// ── env: parse web/.env.local (no dotenv dep) ────────────────────────────────
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const MODEL = process.env.PRICING_MODEL || "claude-opus-4-8";
const EBAY_API = "https://api.ebay.com";
const CATEGORY_ID = process.env.EBAY_CATEGORY_ID || "6028";

// ── test set ──────────────────────────────────────────────────────────────────
const VEHICLES = [
  {
    id: "2018 Toyota Camry SE", spec: "engine 2.5L I4",
    parts: ["Front Bumper Cover", "Headlight Assembly", "Trunk Lid", "Front Door", "Side Mirror", "Grille", "Radiator", "Alternator", "Starter Motor", "Tail Light"],
  },
  {
    id: "2016 Ford F-150 XLT", spec: "engine 5.0L V8",
    parts: ["Tailgate", "Front Bumper", "Headlight Assembly", "Front Door", "Side Mirror", "Grille", "Radiator", "Alternator", "Fender", "Tail Light"],
  },
  {
    id: "2015 Honda CR-V EX", spec: "engine 2.4L I4",
    parts: ["Front Bumper Cover", "Headlight Assembly", "Liftgate", "Front Door", "Side Mirror", "Grille", "Radiator", "Alternator", "Fender", "Tail Light"],
  },
];

// ── eBay reference (mirrors web/src/lib/ebay-comps.ts) ───────────────────────
async function ebayToken() {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
  });
  if (!r.ok) throw new Error(`ebay token ${r.status}`);
  return (await r.json()).access_token;
}

const CLEARLY_BROKEN = /\b(for\s+parts|not\s+working|parts\s+only)\b/i;
function cleanComps(raw, cap = 12) {
  const seen = new Set(); const out = [];
  for (const r of raw) {
    if (!r || !Number.isFinite(r.price) || r.price <= 0) continue;
    const title = (r.title || "").trim();
    if (!title || CLEARLY_BROKEN.test(title)) continue;
    if ((r.condition || "").toLowerCase().includes("parts")) continue;
    const key = `${title.toLowerCase().replace(/\s+/g, " ").slice(0, 60)}|${Math.round(r.price)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ price: Math.round(r.price), title });
    if (out.length >= cap) break;
  }
  return out;
}

async function ebayComps(token, vehicleId, part) {
  const p = new URLSearchParams({
    q: `${vehicleId.replace(/ (SE|XLT|EX)$/, "")} ${part}`,
    category_ids: CATEGORY_ID, limit: "24",
    filter: "conditions:{USED},buyingOptions:{FIXED_PRICE},priceCurrency:USD",
  });
  const r = await fetch(`${EBAY_API}/buy/browse/v1/item_summary/search?${p}`, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return cleanComps((j.itemSummaries ?? []).map((s) => ({ price: Number(s.price?.value ?? NaN), title: s.title ?? "", condition: s.condition })));
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ── the two arms ──────────────────────────────────────────────────────────────
// Arm A: EXACT production prompt from web/src/lib/anthropic.ts (PRICING_SYSTEM).
const SHARPENED_SYSTEM =
  "You price USED auto parts for salvage yards / dismantlers. For the exact vehicle the user names, give the typical " +
  "price a dismantler LISTS each part for as a USED/recycled part — the realistic ASKING price you'd see on " +
  "car-part.com, eBay, and dismantler listings for this exact vehicle in good used condition. " +
  "NEVER the new/OEM/MSRP/aftermarket-new price (a used part lists for a fraction of new), and not a fire-sale or " +
  "wholesale clearance price either — the price a yard would actually put on the listing. " +
  "Left & right of a paired part get the SAME price. " +
  "Use realistic round numbers; if you truly have no basis for one, use null. " +
  "usedPartPriceLowUsd / usedPartPriceHighUsd is the realistic USED-listing range (low ≤ price ≤ high): tight (±15% or " +
  "less) when you know the part and vehicle well, wider when you're less sure. Null range when the price is null. " +
  "Echo each part's exact given name.";

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["name", "usedPartPriceUsd", "usedPartPriceLowUsd", "usedPartPriceHighUsd"],
        properties: {
          name: { type: "string" },
          usedPartPriceUsd: { type: ["number", "null"] },
          usedPartPriceLowUsd: { type: ["number", "null"] },
          usedPartPriceHighUsd: { type: ["number", "null"] },
        },
      },
    },
  },
};

const client = new Anthropic({ maxRetries: 1 });

function isCreditOrRateError(e) {
  const status = e?.status;
  const msg = String(e?.message || "").toLowerCase();
  return status === 429 || status === 402 || status === 529 ||
    (status === 400 && (msg.includes("credit") || msg.includes("billing")));
}

async function priceArm(arm, vehicle) {
  const list = vehicle.parts.map((p, i) => `${i + 1}. ${p}`).join("\n");
  const req = arm === "A"
    ? {
        system: SHARPENED_SYSTEM,
        user: `USED ${vehicle.id} (${vehicle.spec}).\nParts (some may be marked inferred — not photographed but expected present on this vehicle; price them normally):\n${list}`,
      }
    : {
        // Unsharpened: no persona, no asking-price anchor, no never-MSRP rail,
        // no pair parity, no range-calibration rule. Just the bare question.
        system: undefined,
        user: `Give me the price of a used version of each of these parts for a ${vehicle.id} (${vehicle.spec}). For each part give an estimated price and a price range.\n${list}`,
      };
  const resp = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      ...(req.system ? { system: req.system } : {}),
      messages: [{ role: "user", content: req.user }],
    },
    { timeout: 120_000 },
  );
  const text = resp.content.find((b) => b.type === "text");
  const parsed = JSON.parse(text.text);
  const out = {};
  for (const p of parsed.parts) out[p.name.trim().toLowerCase()] = p;
  return { rows: out, usage: resp.usage };
}

async function withCreditRetry(fn, label) {
  const deadline = Date.now() + 2 * 60 * 60 * 1000; // 2h
  for (;;) {
    try { return await fn(); }
    catch (e) {
      if (!isCreditOrRateError(e) || Date.now() > deadline) throw e;
      console.log(`[${new Date().toISOString()}] ${label}: ${e.status} ${e.message?.slice(0, 120)} — retrying in 5 min`);
      await new Promise((r) => setTimeout(r, 5 * 60 * 1000));
    }
  }
}

// ── scoring ───────────────────────────────────────────────────────────────────
function scoreArm(rows, refByKey) {
  const scored = [];
  let priced = 0, total = 0;
  for (const [key, ref] of Object.entries(refByKey)) {
    total++;
    const row = rows[key];
    const est = row?.usedPartPriceUsd;
    if (typeof est === "number" && est > 0) priced++;
    if (!ref || ref.comps.length < 3 || typeof est !== "number" || est <= 0) continue;
    const err = (est - ref.median) / ref.median;
    const lo = row.usedPartPriceLowUsd, hi = row.usedPartPriceHighUsd;
    scored.push({
      key, est, low: lo, high: hi, refMedian: ref.median, compCount: ref.comps.length,
      pctErr: err,
      inRange: typeof lo === "number" && typeof hi === "number" && ref.median >= lo && ref.median <= hi,
      rangeWidthPct: typeof lo === "number" && typeof hi === "number" && est > 0 ? (hi - lo) / est : null,
    });
  }
  const abs = scored.map((s) => Math.abs(s.pctErr));
  return {
    pricedRate: priced / total,
    scoredCount: scored.length,
    mape: abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : null,
    medianAbsErr: abs.length ? median(abs) : null,
    medianBias: scored.length ? median(scored.map((s) => s.pctErr)) : null,
    rangeHitRate: scored.length ? scored.filter((s) => s.inRange).length / scored.length : null,
    medianRangeWidth: (() => { const w = scored.map((s) => s.rangeWidthPct).filter((x) => x != null); return w.length ? median(w) : null; })(),
    rows: scored,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────
const ebayOnly = process.argv.includes("--ebay-only");

console.log(`Model: ${MODEL}`);
console.log("Fetching eBay reference comps…");
const token = await ebayToken();
const refByVehicle = {};
for (const v of VEHICLES) {
  refByVehicle[v.id] = {};
  const results = await Promise.all(v.parts.map(async (p) => [p, await ebayComps(token, v.id, p)]));
  for (const [p, comps] of results) {
    refByVehicle[v.id][p.trim().toLowerCase()] = comps.length ? { median: median(comps.map((c) => c.price)), comps } : { median: null, comps: [] };
  }
  const ok = Object.values(refByVehicle[v.id]).filter((r) => r.comps.length >= 3).length;
  console.log(`  ${v.id}: ${ok}/${v.parts.length} parts have ≥3 comps`);
}
writeFileSync(join(OUT_DIR, "ab-ebay-reference.json"), JSON.stringify(refByVehicle, null, 2));
if (ebayOnly) { console.log("eBay-only mode: reference written, exiting."); process.exit(0); }

console.log("Running arms (retries on credit errors for up to 2h)…");
const results = { model: MODEL, arms: {} };
for (const arm of ["A", "B"]) {
  const perVehicle = {};
  for (const v of VEHICLES) {
    const { rows, usage } = await withCreditRetry(() => priceArm(arm, v), `arm ${arm} / ${v.id}`);
    perVehicle[v.id] = { score: scoreArm(rows, refByVehicle[v.id]), usage };
    console.log(`  arm ${arm} · ${v.id}: done`);
  }
  const allRows = Object.values(perVehicle).flatMap((x) => x.score.rows);
  const abs = allRows.map((s) => Math.abs(s.pctErr));
  results.arms[arm] = {
    perVehicle,
    overall: {
      scoredCount: allRows.length,
      mape: abs.reduce((a, b) => a + b, 0) / abs.length,
      medianAbsErr: median(abs),
      medianBias: median(allRows.map((s) => s.pctErr)),
      rangeHitRate: allRows.filter((s) => s.inRange).length / allRows.length,
      medianRangeWidth: median(allRows.map((s) => s.rangeWidthPct).filter((x) => x != null)),
    },
  };
}

writeFileSync(join(OUT_DIR, "ab-results.json"), JSON.stringify(results, null, 2));

const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
let md = `# Pricing prompt A/B — ${MODEL}\n\n| Metric | Arm A (sharpened) | Arm B (naive) |\n|---|---|---|\n`;
const A = results.arms.A.overall, B = results.arms.B.overall;
md += `| Parts scored (≥3 comps) | ${A.scoredCount} | ${B.scoredCount} |\n`;
md += `| MAPE vs eBay median | ${pct(A.mape)} | ${pct(B.mape)} |\n`;
md += `| Median abs error | ${pct(A.medianAbsErr)} | ${pct(B.medianAbsErr)} |\n`;
md += `| Median bias (+ = over) | ${pct(A.medianBias)} | ${pct(B.medianBias)} |\n`;
md += `| eBay median inside [low,high] | ${pct(A.rangeHitRate)} | ${pct(B.rangeHitRate)} |\n`;
md += `| Median range width | ${pct(A.medianRangeWidth)} | ${pct(B.medianRangeWidth)} |\n\n`;
md += `## Per-part detail\n\n| Vehicle · Part | eBay med (n) | A est | A err | B est | B err |\n|---|---|---|---|---|---|\n`;
for (const v of VEHICLES) {
  const aRows = Object.fromEntries(results.arms.A.perVehicle[v.id].score.rows.map((r) => [r.key, r]));
  const bRows = Object.fromEntries(results.arms.B.perVehicle[v.id].score.rows.map((r) => [r.key, r]));
  for (const key of new Set([...Object.keys(aRows), ...Object.keys(bRows)])) {
    const a = aRows[key], b = bRows[key], ref = a ?? b;
    md += `| ${v.id} · ${key} | $${ref.refMedian} (${ref.compCount}) | ${a ? `$${a.est}` : "—"} | ${a ? pct(a.pctErr) : "—"} | ${b ? `$${b.est}` : "—"} | ${b ? pct(b.pctErr) : "—"} |\n`;
  }
}
writeFileSync(join(OUT_DIR, "ab-report.md"), md);
console.log("\n" + md.split("## Per-part")[0]);
console.log(`Full report: ${join(OUT_DIR, "ab-report.md")}`);
