// ⚠️ STALE — DO NOT RUN. Mirrors a REMOVED pricing algorithm (ASKING_TO_SOLD /
// MIN_COMPS / trimmedMedian chunked ladder). The live system is the per-part
// appraiser judge (web/src/lib/price-judge.ts, docs/pricing-prompt.md); its
// eval harness is scripts/pricing-eval.mjs. Kept only as historical reference.
//
// Verify the pricing ladder's new rungs:
//   • Rung 3 (discounted active asking) actually returns data for parts where the
//     grounded SOLD search came back "no comps" (headlight, bumper, engine).
//   • The A/B/C condition multiplier behaves.
// Mirrors web/src/lib/pricing.ts (ASKING_TO_SOLD, MIN_COMPS, trimmedMedian,
// applyCondition). Reads EBAY_CLIENT_ID/SECRET from the root .env.
//   node scripts/ladder-test.mjs
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const f of ["../.env", "../web/.env.local"]) {
  try { for (const line of readFileSync(resolve(__dirname, f), "utf8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const ID = env.EBAY_CLIENT_ID, SECRET = env.EBAY_CLIENT_SECRET;

// ---- mirror of pricing.ts ----
const MIN_COMPS = 4, ASKING_TO_SOLD = 0.82;
const CONDITION_MULTIPLIER = { A: 1.15, B: 1.0, C: 0.78 };
const applyCondition = (price, g) => Math.round(price * (CONDITION_MULTIPLIER[g] ?? 1));
const median = (a) => { const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const trimmedMedian = (p) => { if(!p.length) return null; const s=[...p].sort((a,b)=>a-b); const c=Math.floor(s.length*0.15); const t=s.slice(c,s.length-c); return Math.round(median(t.length?t:s)); };

console.log("── Condition multiplier (applied to market comps) ──");
for (const g of ["A","B","C"]) console.log(`  $200 market → Grade ${g} = $${applyCondition(200, g)}`);
console.log("");

if (!ID || !SECRET) { console.log("No EBAY_CLIENT_ID/SECRET in .env — skipping the live asking-rung check."); process.exit(0); }

async function token() {
  const basic = Buffer.from(`${ID}:${SECRET}`).toString("base64");
  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded", Authorization:`Basic ${basic}` }, body:"grant_type=client_credentials&scope="+encodeURIComponent("https://api.ebay.com/oauth/api_scope") });
  if (!r.ok) throw new Error(`token ${r.status}: ${(await r.text()).slice(0,160)}`);
  return (await r.json()).access_token;
}
async function asking(tok, q) {
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=40&filter=${encodeURIComponent("conditions:{USED},buyingOptions:{FIXED_PRICE}")}`;
  const r = await fetch(url, { headers:{ Authorization:`Bearer ${tok}`, "X-EBAY-C-MARKETPLACE-ID":"EBAY_US" } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.itemSummaries||[]).map(i=>parseFloat(i.price?.value)).filter(n=>Number.isFinite(n)&&n>0);
}

const PARTS = [
  "2017 Honda Civic headlight assembly",   // grounded returned NONE earlier
  "2017 Honda Civic front bumper cover",   // grounded returned NONE earlier
  "2017 Honda Civic 1.5T engine",          // grounded returned NONE earlier
  "2017 Honda Civic alternator",
  "2017 Honda Civic hood",
];

console.log("── Rung 3: discounted active asking (× 0.82) for parts grounded missed ──\n");
const tok = await token();
for (const q of PARTS) {
  const prices = await asking(tok, q);
  if (prices.length < MIN_COMPS) { console.log(`  ${q.padEnd(42)} → only ${prices.length} listings (< ${MIN_COMPS}) → falls to band`); continue; }
  const med = trimmedMedian(prices);
  const sold = Math.round(med * ASKING_TO_SOLD);
  console.log(`  ${q.padEnd(42)} → ${prices.length} listings · asking median $${med} → sold approx $${sold}  (B=$${sold}, A=$${applyCondition(sold,"A")}, C=$${applyCondition(sold,"C")})`);
}
console.log("\nIf these show prices, the ladder now returns a number where it used to say 'no comps'.");
