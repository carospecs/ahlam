// CALIBRATION — Gemini vs Claude, side by side, against known sold prices.
//
// For each fixture in scripts/price-fixtures.json this runs BOTH engines' sold-price
// search — the Gemini grounded query the app used before, and the Claude web_search
// query the app's pricing/market-check now uses — and prints the two estimates next
// to the known price, then a per-engine accuracy summary.
//
//   node scripts/claude-price-test.mjs
//
// Needs GEMINI_API_KEY and ANTHROPIC_API_KEY in web/.env.local (PRICING_MODEL optional).
// Manual, live-API — like price-accuracy-test.mjs. Only meaningful with REAL sold prices.
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = {};
try {
  const envRaw = readFileSync(resolve(__dirname, "../web/.env.local"), "utf8");
  for (const line of envRaw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* fall through to the missing-key checks */ }
const GEMINI_KEY = env.GEMINI_API_KEY || env.GEMINI_API_KEY_FALLBACK;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
const MODEL = env.PRICING_MODEL || "claude-opus-4-8";
if (!GEMINI_KEY || !ANTHROPIC_KEY) {
  console.error("Missing GEMINI_API_KEY and/or ANTHROPIC_API_KEY in web/.env.local — need both for the side-by-side.");
  process.exit(1);
}

// pnpm doesn't hoist to the repo root — resolve @anthropic-ai/sdk against web/.
const require = createRequire(resolve(__dirname, "../web/package.json"));
const Anthropic = require("@anthropic-ai/sdk").default;
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY, maxRetries: 1 });

const { fixtures } = JSON.parse(readFileSync(resolve(__dirname, "price-fixtures.json"), "utf8"));

const PROMPT = (query) =>
  `Search the web to find what this used auto part ACTUALLY SOLD FOR recently: "${query}". ` +
  `Cross-check several sources — eBay SOLD/completed listings, Google Shopping, car-part.com, Facebook Marketplace, OfferUp — and corroborate the figure across them. ` +
  `Strongly prefer COMPLETED / SOLD prices over current asking prices. ` +
  `Estimate the MEDIAN sold price in US dollars for the part in good used condition.\n\n` +
  `Reply with ONLY the dollar amount, prefixed with "$" (e.g. "$385") — no year, no part name, no words, no range. ` +
  `If you cannot corroborate at least a few real sold comps, reply with exactly "NONE".`;

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

// Engine 1 — the Gemini grounded search the app used before (Layer 3 mirror).
async function geminiEstimate(query) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT(query) }] }],
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

// Engine 2 — Claude with the server-side web_search tool (mirror of the app's
// researchPartClaude in api/price-research).
async function claudeEstimate(query) {
  try {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
    };
    let messages = [{ role: "user", content: PROMPT(query) }];
    let resp = await anthropic.messages.create({ ...params, messages }, { timeout: 60_000 });
    for (let i = 0; i < 3 && resp.stop_reason === "pause_turn"; i++) {
      messages = [...messages, { role: "assistant", content: resp.content }];
      resp = await anthropic.messages.create({ ...params, messages }, { timeout: 60_000 });
    }
    const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return parseGroundedPrice(text);
  } catch { return null; }
}

const pct = (a, b) => (Math.abs(a - b) / b) * 100;

function summarize(label, rows) {
  const errors = rows.filter((r) => r.est != null).map((r) => pct(r.est, r.known));
  const missed = rows.length - errors.length;
  if (!errors.length) { console.log(`  ${label}: no estimates returned.`); return; }
  const sorted = [...errors].sort((a, b) => a - b);
  const medErr = sorted[Math.floor(sorted.length / 2)];
  console.log(
    `  ${label.padEnd(8)} median error ${medErr.toFixed(0).padStart(3)}%   ` +
    `within ±20%: ${errors.filter((e) => e <= 20).length}/${rows.length}   ` +
    `within ±35%: ${errors.filter((e) => e <= 35).length}/${rows.length}` +
    (missed ? `   no estimate: ${missed}` : ""),
  );
}

async function run() {
  console.log(`Gemini vs Claude (${MODEL}) on ${fixtures.length} known sold prices…\n`);
  const gem = [], cla = [];

  const CONC = 3; // web-search turns are slower — keep concurrency gentle
  for (let i = 0; i < fixtures.length; i += CONC) {
    const batch = fixtures.slice(i, i + CONC);
    const got = await Promise.all(batch.map(async (f) => {
      const [g, c] = await Promise.all([geminiEstimate(f.query), claudeEstimate(f.query)]);
      return { f, g, c };
    }));
    for (const { f, g, c } of got) {
      gem.push({ known: f.soldPrice, est: g });
      cla.push({ known: f.soldPrice, est: c });
      const fmt = (est) => (est == null ? "   (none)" : `$${String(est).padStart(6)} ${pct(est, f.soldPrice).toFixed(0).padStart(3)}%`);
      console.log(`  ${f.query.padEnd(42)} known $${String(f.soldPrice).padEnd(6)} gemini ${fmt(g)}   claude ${fmt(c)}`);
    }
  }

  console.log(`\n── Accuracy ─────────────────────────────────────────`);
  summarize("gemini", gem);
  summarize("claude", cla);
  console.log(`──────────────────────────────────────────────────────`);
  console.log("Note: meaningful only if price-fixtures.json holds REAL sold prices.");
}

run().catch((e) => { console.error(e); process.exit(1); });
