// One-off probe: run the app's live Layer-3 grounded sold-price search against the
// actual parts visible on the user's car (a 10th-gen Honda Civic sedan), so we can
// see what prices the bot WOULD suggest and sanity-check them against the market.
//   node scripts/civic-price-probe.mjs
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const f of ["../web/.env.local", "../.env"]) {
  try {
    for (const line of readFileSync(resolve(__dirname, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const GEMINI_KEY = env.GEMINI_API_KEY || env.GEMINI_API_KEY_FALLBACK;
if (!GEMINI_KEY) { console.error("Missing GEMINI_API_KEY"); process.exit(1); }

const parts = [
  "2017 Honda Civic EX sedan headlight assembly",
  "2017 Honda Civic EX sedan hood",
  "2017 Honda Civic front bumper cover",
  "2017 Honda Civic sedan tail light",
  "2017 Honda Civic side mirror",
  "2017 Honda Civic alternator",
  "2017 Honda Civic 17 inch alloy wheel rim",
  "2017 Honda Civic ac compressor",
  "2017 Honda Civic front door shell",
  "2017 Honda Civic 1.5T engine assembly",
];

async function grounded(query) {
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
    if (!r.ok) return `(http ${r.status})`;
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text ?? "").join("");
    if (/\bNONE\b/i.test(text)) return "(no comps)";
    const cleaned = text.replace(/,/g, "");
    const dollar = cleaned.match(/\$\s?(\d{1,6}(?:\.\d+)?)/);
    if (dollar) return `$${Math.round(parseFloat(dollar[1]))}`;
    const m = cleaned.replace(/\b(?:19|20)\d{2}\b/g, " ").match(/\d{1,6}(?:\.\d+)?/);
    return m ? `$${Math.round(parseFloat(m[0]))}` : "(no number)";
  } catch (e) { return `(err ${e.message})`; }
}

const CONC = 4;
const rows = [];
for (let i = 0; i < parts.length; i += CONC) {
  const batch = parts.slice(i, i + CONC);
  rows.push(...await Promise.all(batch.map(async (q) => ({ q, est: await grounded(q) }))));
}
console.log("\nBot's suggested used price for the Civic's parts (live grounded search):\n");
for (const { q, est } of rows) console.log(`  ${q.padEnd(48)} → ${est}`);
console.log("");
