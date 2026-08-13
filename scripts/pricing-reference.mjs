// REFERENCE PRICER — builds the truth set the eval harness scores against.
//
// For each fixture part (scripts/pricing-fixtures.json) it runs ONE thorough
// Claude research call with the server-side web_search tool — the same behavior
// Andy trusts when he asks Claude in Chrome for a used-part price — and caches
// {low, mid, high, confidence, sources, notes} to scripts/pricing-reference.cache.json.
// Paid once per fixture part; the eval loop then runs against the cache for free.
//
//   node scripts/pricing-reference.mjs                  # build anything not cached
//   node scripts/pricing-reference.mjs --only camry-2018
//   node scripts/pricing-reference.mjs --refresh "camry-2018|Front Door|A"
//   node scripts/pricing-reference.mjs --sheet          # just print the spot-check sheet
//   node scripts/pricing-reference.mjs --limit 3        # cap new calls this run (smoke)
//
// Human loop: every cache entry has "andyOverride": null. Set it to
// {"low":N,"mid":N,"high":N} to hand-correct a row — overrides always win in
// scoring and survive --refresh of other keys.
//
// Needs ANTHROPIC_API_KEY in web/.env.local. Model: PRICING_MODEL (opus default).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = resolve(__dirname, "pricing-reference.cache.json");

// ── env: parse web/.env.local (no dotenv dep) ────────────────────────────────
const env = { ...process.env };
try {
  for (const line of readFileSync(resolve(__dirname, "../web/.env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* missing-key check below */ }
if (!env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in web/.env.local");
  process.exit(1);
}
const MODEL = env.PRICING_MODEL || "claude-opus-4-8";

// pnpm doesn't hoist to the repo root — resolve @anthropic-ai/sdk against web/.
const require = createRequire(resolve(__dirname, "../web/package.json"));
const Anthropic = require("@anthropic-ai/sdk").default;
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? (argv[i + 1] ?? true) : null; };
const ONLY = flag("--only");
const REFRESH = flag("--refresh");
const SHEET_ONLY = argv.includes("--sheet");
const LIMIT = Number(flag("--limit")) || Infinity;

const { vehicles } = JSON.parse(readFileSync(resolve(__dirname, "pricing-fixtures.json"), "utf8"));
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const key = (slug, part, grade) => `${slug}|${part}|${grade}`;

// ── the research call ────────────────────────────────────────────────────────
const PROMPT = (fitment, part, grade, notes) => {
  const veh = [fitment.year, fitment.make, fitment.model, fitment.trim].filter(Boolean).join(" ");
  return (
    `Research the current USED market price for this auto part pulled from a salvage vehicle:\n\n` +
    `Part: ${part}\nVehicle: ${veh}${fitment.engine ? ` (${fitment.engine})` : ""}\n` +
    `Condition: grade ${grade} (A = clean, B = good with cosmetic wear)${notes ? ` — ${notes}` : ""}\n` +
    `Sold as a COMPLETE assembly as pulled from the vehicle (not a stripped shell).\n\n` +
    `Search the web thoroughly: eBay sold/completed and active listings, car-part.com, ` +
    `Facebook Marketplace, salvage yard listings, forums. Weigh SOLD prices over asking ` +
    `prices where you can find them; discount asking prices for realistic negotiation. ` +
    `Ignore listings that are stripped shells, sub-components, aftermarket reproductions, ` +
    `or wrong-generation parts.\n\n` +
    `Then give the realistic price range a US salvage yard would LIST this part at:\n` +
    `- low: quick-sale price to a price-shopping buyer\n` +
    `- mid: the recommended listing price (your single best number)\n` +
    `- high: what the right buyer who needs this exact part would pay\n\n` +
    `Reply with ONLY a JSON object, no prose before or after:\n` +
    `{"low": number, "mid": number, "high": number, "confidence": "high"|"medium"|"low", ` +
    `"sources": ["domain1.com", ...], "notes": "one or two sentences on what anchored the number"}`
  );
};

function parseRef(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const n = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
    let low = n(j.low), mid = n(j.mid), high = n(j.high);
    if (mid == null) return null;
    low ??= mid; high ??= mid;
    if (low > high) [low, high] = [high, low];
    return {
      low: Math.min(low, mid), mid, high: Math.max(high, mid),
      confidence: ["high", "medium", "low"].includes(j.confidence) ? j.confidence : "low",
      sources: Array.isArray(j.sources) ? j.sources.filter((s) => typeof s === "string").slice(0, 8) : [],
      notes: typeof j.notes === "string" ? j.notes.slice(0, 400) : "",
    };
  } catch { return null; }
}

const isRetryable = (e) => [429, 402, 529].includes(e?.status) || String(e?.message || "").toLowerCase().includes("overloaded");

async function research(fitment, part, grade, notes) {
  const params = {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    // 4 searches, not 6: measured ~110k input tokens/part at 5+ searches — the
    // result payloads dominate cost. 4 keeps multi-source corroboration.
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
  };
  for (let attempt = 0; ; attempt++) {
    try {
      let messages = [{ role: "user", content: PROMPT(fitment, part, grade, notes) }];
      let resp = await anthropic.messages.create({ ...params, messages }, { timeout: 180_000 });
      for (let i = 0; i < 4 && resp.stop_reason === "pause_turn"; i++) {
        messages = [...messages, { role: "assistant", content: resp.content }];
        resp = await anthropic.messages.create({ ...params, messages }, { timeout: 180_000 });
      }
      const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const searches = resp.usage?.server_tool_use?.web_search_requests ?? null;
      return { ref: parseRef(text), usage: { input: resp.usage?.input_tokens ?? 0, output: resp.usage?.output_tokens ?? 0, searches } };
    } catch (e) {
      if (isRetryable(e) && attempt < 3) {
        console.log(`  retryable ${e.status ?? ""} — waiting 60s (${part})`);
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      throw e;
    }
  }
}

// ── spot-check sheet (for Andy) ──────────────────────────────────────────────
function printSheet() {
  const rows = Object.entries(cache).filter(([, v]) => v.ref);
  if (!rows.length) { console.log("No cached reference rows yet."); return; }
  // ~15 rows spread across vehicles: take every Nth
  const step = Math.max(1, Math.floor(rows.length / 15));
  console.log("\n── SPOT-CHECK SHEET (edit andyOverride in pricing-reference.cache.json to correct) ──");
  console.log("KEY".padEnd(46) + "LOW".padStart(7) + "MID".padStart(7) + "HIGH".padStart(7) + "  CONF   TOP SOURCE");
  for (let i = 0; i < rows.length; i += step) {
    const [k, v] = rows[i];
    const o = v.andyOverride;
    const r = o ?? v.ref;
    console.log(
      k.padEnd(46) + String(r.low).padStart(7) + String(r.mid).padStart(7) + String(r.high).padStart(7) +
      `  ${(v.ref.confidence || "?").padEnd(6)} ${(v.ref.sources?.[0] || "—")}${o ? "  [OVERRIDE]" : ""}`,
    );
  }
  console.log(`(${rows.length} total reference rows; showing every ${step}${step > 1 ? "th" : ""})`);
}

// ── main ─────────────────────────────────────────────────────────────────────
if (SHEET_ONLY) { printSheet(); process.exit(0); }

const work = [];
for (const v of vehicles) {
  if (ONLY && v.slug !== ONLY) continue;
  for (const p of v.parts) {
    const k = key(v.slug, p.name, p.grade);
    const needs = REFRESH ? k === REFRESH : !(cache[k]?.ref);
    if (needs) work.push({ v, p, k });
  }
}
const capped = work.slice(0, LIMIT);
console.log(`Reference pricer (${MODEL}): ${capped.length} part(s) to research${work.length > capped.length ? ` (of ${work.length}, capped by --limit)` : ""}, ${Object.keys(cache).length} already cached.`);
if (!capped.length) { printSheet(); process.exit(0); }

let totals = { input: 0, output: 0, searches: 0, done: 0, failed: 0 };
const CONC = 3; // web-search research turns are slow and rate-limited — gentle
for (let i = 0; i < capped.length; i += CONC) {
  const batch = capped.slice(i, i + CONC);
  await Promise.all(batch.map(async ({ v, p, k }) => {
    try {
      const { ref, usage } = await research(v.fitment, p.name, p.grade, p.conditionNotes);
      totals.input += usage.input; totals.output += usage.output; totals.searches += usage.searches ?? 0;
      if (!ref) { totals.failed++; console.log(`  ✗ ${k} — unparseable response (rerun with --refresh "${k}")`); return; }
      cache[k] = { ref, andyOverride: cache[k]?.andyOverride ?? null, model: MODEL, at: new Date().toISOString().slice(0, 10) };
      totals.done++;
      console.log(`  ✓ ${k.padEnd(46)} $${ref.low}–$${ref.mid}–$${ref.high} (${ref.confidence}; ${ref.sources[0] ?? "no source"})`);
    } catch (e) {
      totals.failed++;
      console.log(`  ✗ ${k} — ${e.status ?? ""} ${String(e.message).slice(0, 100)}`);
    }
    // incremental durability — a crash loses at most the in-flight batch
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  }));
}

writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
// Opus 4.8 $5/$25 per MTok + web search $10/1k searches (see /claude-api skill)
const isOpus = /opus/.test(MODEL);
const cost = (totals.input / 1e6) * (isOpus ? 5 : 3) + (totals.output / 1e6) * (isOpus ? 25 : 15) + (totals.searches / 1000) * 10;
console.log(`\nDone: ${totals.done} researched, ${totals.failed} failed. Tokens in/out: ${totals.input}/${totals.output}, searches: ${totals.searches}. Est. cost this run: $${cost.toFixed(2)}`);
printSheet();
