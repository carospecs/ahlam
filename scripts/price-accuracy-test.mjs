// CALIBRATION — measure how accurate the live pricing actually is.
//
// For each fixture (a part query with a KNOWN sold price), this runs the exact
// grounded sold-price search the app's Layer 3 uses, then compares the result to
// the known price and reports the error. This turns "is our pricing accurate?"
// from an opinion into a number you can stand behind before selling the product.
//
//   node scripts/price-accuracy-test.mjs
//
// Edit scripts/price-fixtures.json to use YOUR real sold prices — the number is
// only meaningful with real data. Needs GEMINI_API_KEY in web/.env.local.
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = {};
try {
  const envRaw = readFileSync(resolve(__dirname, "../web/.env.local"), "utf8");
  for (const line of envRaw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* fall through to the missing-key check */ }
const GEMINI_KEY = env.GEMINI_API_KEY || env.GEMINI_API_KEY_FALLBACK;
if (!GEMINI_KEY) {
  console.error("Missing GEMINI_API_KEY in web/.env.local — cannot run the accuracy test.");
  process.exit(1);
}

const { fixtures } = JSON.parse(readFileSync(resolve(__dirname, "price-fixtures.json"), "utf8"));

// Mirror of pricing.ts groundedMedianPrice — the live Layer 3 signal we measure.
async function groundedMedianPrice(query) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text:
          `Use Google to find what this used auto part ACTUALLY SOLD FOR recently: "${query}". ` +
          `Cross-check several sources — eBay SOLD/completed listings, Google Shopping, car-part.com, Facebook Marketplace, OfferUp — and corroborate the figure across them. ` +
          `Strongly prefer COMPLETED / SOLD prices over current asking prices. ` +
          `Estimate the MEDIAN sold price in US dollars for the part in good used condition.\n\n` +
          `Reply with ONLY the dollar amount, prefixed with "$" (e.g. "$385") — no year, no part name, no words, no range. ` +
          `If you cannot corroborate at least a few real sold comps, reply with exactly "NONE".`,
        } ] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0 },
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text ?? "").join("");
    return parseGroundedPrice(text);
  } catch { return null; }
}

// Mirror of pricing.ts parseGroundedPrice: prefer a $-amount, else strip year
// tokens before taking the first number (the model often echoes the query year).
function parseGroundedPrice(text) {
  if (!text || /\bNONE\b/i.test(text)) return null;
  const cleaned = text.replace(/,/g, "");
  const dollar = cleaned.match(/\$\s?(\d{1,6}(?:\.\d+)?)/);
  if (dollar) return Math.round(parseFloat(dollar[1]));
  const noYears = cleaned.replace(/\b(?:19|20)\d{2}\b/g, " ");
  const m = noYears.match(/\d{1,6}(?:\.\d+)?/);
  return m ? Math.round(parseFloat(m[0])) : null;
}

const pct = (a, b) => Math.abs(a - b) / b * 100;

async function run() {
  console.log(`Measuring ${fixtures.length} parts against known sold prices…\n`);
  const errors = [];
  let missed = 0;

  // Small concurrency to keep it quick without tripping rate limits.
  const CONC = 4;
  const rows = [];
  for (let i = 0; i < fixtures.length; i += CONC) {
    const batch = fixtures.slice(i, i + CONC);
    const got = await Promise.all(batch.map(async (f) => ({ f, est: await groundedMedianPrice(f.query) })));
    rows.push(...got);
  }

  for (const { f, est } of rows) {
    if (est == null) {
      missed++;
      console.log(`  ${f.query.padEnd(42)} known $${f.soldPrice}  →  (no estimate)`);
      continue;
    }
    const e = pct(est, f.soldPrice);
    errors.push(e);
    const flag = e <= 20 ? "✓" : e <= 35 ? "~" : "✗";
    console.log(`  ${f.query.padEnd(42)} known $${f.soldPrice}  →  est $${est}   ${e.toFixed(0)}% off ${flag}`);
  }

  if (!errors.length) {
    console.log("\nNo estimates returned — can't compute accuracy.");
    return;
  }
  const sorted = [...errors].sort((a, b) => a - b);
  const medErr = sorted[Math.floor(sorted.length / 2)];
  const within20 = errors.filter((e) => e <= 20).length;
  const within35 = errors.filter((e) => e <= 35).length;

  console.log(`\n── Accuracy ─────────────────────────────────────────`);
  console.log(`  Median error:     ${medErr.toFixed(0)}%`);
  console.log(`  Within ±20%:      ${within20}/${errors.length}`);
  console.log(`  Within ±35%:      ${within35}/${errors.length}`);
  if (missed) console.log(`  No estimate:      ${missed}/${fixtures.length}`);
  console.log(`──────────────────────────────────────────────────────`);
  console.log(medErr <= 20
    ? "Verdict: solid — most prices land close to real sold values."
    : medErr <= 35
    ? "Verdict: usable as a starting suggestion, but worth tightening."
    : "Verdict: too loose to sell as accurate pricing yet — needs better comps.");
  console.log("\nNote: meaningful only if price-fixtures.json holds REAL sold prices.");
}

run().catch((e) => { console.error(e); process.exit(1); });
