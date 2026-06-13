// LAYER 1 — Price-band recalibration (periodic, NOT per-request).
//
// Scrapes eBay's PUBLIC sold-listings pages (the LH_Sold=1&LH_Complete=1 filter —
// actual completed sales, not active asking prices) for each part type across a
// basket of popular post-2021 vehicles, derives a robust low/high band from the
// real sold distribution, and overwrites web/src/lib/price-bands.generated.ts.
// This re-anchors the pipeline's fallback FLOOR to what buyers actually pay.
//
// FREE — no API keys, no eBay approval needed. Run it from your machine or a cron
// box, NOT from a cloud / serverless IP (eBay tends to block datacenter IPs).
// Re-deploy after running so the new generated file ships:
//
//   node scripts/recalibrate-bands.mjs
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read config from web/.env.local: GEMINI_API_KEY for the grounded fallback, and
// an optional EBAY_PROXY_URL so the scrape can run from a server/cron (eBay blocks
// datacenter IPs — a residential proxy gets around that). All optional.
const env = {};
try {
  const envRaw = readFileSync(resolve(__dirname, "../web/.env.local"), "utf8");
  for (const line of envRaw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no env file — grounded fallback / proxy just won't be available */ }
const GEMINI_KEY = env.GEMINI_API_KEY || env.GEMINI_API_KEY_FALLBACK;
const PROXY_URL = env.EBAY_PROXY_URL;

// Route eBay fetches through a proxy when EBAY_PROXY_URL is set. Uses undici's
// ProxyAgent if available; if not installed, warns and proceeds direct.
let dispatcher;
if (PROXY_URL) {
  try {
    const { ProxyAgent } = await import("undici");
    dispatcher = new ProxyAgent(PROXY_URL);
    console.log("Routing eBay requests through EBAY_PROXY_URL.\n");
  } catch {
    console.warn("EBAY_PROXY_URL set but 'undici' isn't installed — run `pnpm add undici`. Proceeding direct.\n");
  }
}

// A real desktop-browser User-Agent — eBay serves a bot interstitial otherwise.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Scrape recent SOLD prices for `query` from eBay's public completed-listings
// page. Restricted to USED condition (LH_ItemCondition=3000) and the eBay Motors
// Parts & Accessories category (6028) to keep comps relevant. Returns [] on any
// error or block.
async function soldPrices(query) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`
    + `&_sacat=6028&LH_Sold=1&LH_Complete=1&LH_ItemCondition=3000&_ipg=60`;
  let html;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, dispatcher });
    if (!r.ok) return [];
    html = await r.text();
  } catch { return []; }
  // Each result's price sits in a <span class="s-item__price">; grab the first
  // dollar amount in each (ranges like "$199.00 to $399.00" → take the first).
  const prices = [];
  const re = /class="s-item__price"[^>]*>(?:\s*<[^>]+>)*\s*\$([\d,]+(?:\.\d{2})?)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) prices.push(n);
  }
  return prices;
}

// --- what to sample ---------------------------------------------------------
// Keys MUST match the band keys in web/src/lib/price-bands.ts. The phrase is the
// generic part term appended to each basket vehicle.
const PART_QUERIES = {
  door: "front door shell",
  hood: "hood",
  fender: "front fender",
  bumper: "bumper cover",
  quarter_panel: "quarter panel",
  headlight: "headlight assembly",
  taillight: "tail light",
  mirror: "side mirror",
  wheel: "wheel rim",
  tire: "tire",
  glass: "windshield",
  engine: "engine",
  transmission: "transmission",
  alternator: "alternator",
  starter: "starter",
  ac_compressor: "ac compressor",
};

// Popular post-2021 vehicles — broad, high-supply comps so the bands reflect the
// mainstream used market (luxury/low-supply is handled by the model adjusting up).
const VEHICLES = [
  "2021 Toyota Camry",
  "2022 Honda Civic",
  "2021 Honda CR-V",
  "2022 Toyota RAV4",
  "2021 Ford F-150",
  "2022 Chevrolet Silverado",
  "2021 Nissan Altima",
  "2022 Toyota Corolla",
];

const MIN_SAMPLE = 8; // need at least this many comps to trust a recalibrated band

// --- stats helpers ----------------------------------------------------------
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
// Round to readable money: nearest $10 up to $500, nearest $50 up to $2k, else $100.
function niceRound(n) {
  const step = n < 500 ? 10 : n < 2000 ? 50 : 100;
  return Math.max(step, Math.round(n / step) * step);
}

// Fallback band via a Gemini grounded web search for SOLD prices. Runs anywhere
// (Google does the searching, so no eBay IP block), $0-ish on the existing key.
// Returns { low, high } or null. Used only when the scrape returns too few comps.
async function groundedBand(label) {
  if (!GEMINI_KEY) return null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text:
          `Search the web for what a USED "${label}" from a popular recent vehicle ` +
          `(e.g. Toyota Camry, Honda Civic, Ford F-150, RAV4) typically SOLD FOR recently. ` +
          `Prefer COMPLETED / SOLD prices (eBay sold listings, car-part.com) over asking prices. ` +
          `Determine a typical low and high sold price in US dollars for good used condition.\n\n` +
          `End your reply with one line in EXACTLY this format (both as US dollars):\n` +
          `RANGE: $<low>-$<high>\n` +
          `If you can't find sold comps, end with: RANGE: NONE`,
        } ] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0 },
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text ?? "").join("").replace(/,/g, "");
    // Parse our sentinel first; else any "$low - $high" pair. REQUIRE the $ sign
    // so a model-year range like "2021-2022" (no $) can never be read as a price.
    const m = text.match(/RANGE:\s*\$\s*(\d+)\s*(?:-|–|to)\s*\$?\s*(\d+)/i)
           || text.match(/\$\s*(\d+)\s*(?:-|–|to)\s*\$\s*(\d+)/i);
    if (!m) return null;
    const low = +m[1], high = +m[2];
    if (!(low > 0 && high > low) || high > 20000) return null; // reject junk / absurd
    return { low, high };
  } catch { return null; }
}

// One cheap probe to learn whether eBay is scrapeable from this IP. When it isn't
// (datacenter / serverless), we skip the scrape loop entirely and go straight to
// the grounded fallback — no point burning ~80s of polite delays on 403s.
async function probeEbay() {
  const p = await soldPrices("2022 Honda Civic headlight");
  return p.length > 0;
}

// --- run --------------------------------------------------------------------
async function run() {
  const bands = {};
  const skipped = [];
  let scraped = 0, grounded = 0;

  const ebayReachable = await probeEbay();
  console.log(ebayReachable
    ? "eBay sold pages reachable — scraping real comps (grounded search fills any gaps).\n"
    : "eBay scraping blocked from this IP — using grounded sold-price search for all bands.\n");

  // Phase 1: scrape where possible; queue everything else for the grounded fallback.
  const needGrounded = [];
  for (const [key, phrase] of Object.entries(PART_QUERIES)) {
    if (ebayReachable) {
      // Pool real sold comps across the basket vehicles, sequential with a small
      // jittered delay so we stay gentle on eBay.
      const all = [];
      for (const v of VEHICLES) {
        all.push(...(await soldPrices(`${v} ${phrase}`)));
        await sleep(300 + Math.random() * 400);
      }
      all.sort((a, b) => a - b);
      if (all.length >= MIN_SAMPLE) {
        // Trim the extreme 10% each end, then take the 20th/80th percentiles.
        const cut = Math.floor(all.length * 0.1);
        const trimmed = all.slice(cut, all.length - cut);
        let low = niceRound(percentile(trimmed, 0.2));
        let high = niceRound(percentile(trimmed, 0.8));
        if (high <= low) high = niceRound(low * 1.5); // guard degenerate bands
        bands[key] = { low, high };
        scraped++;
        console.log(`  ${key.padEnd(14)} $${low}–$${high}  (scraped, ${all.length} comps)`);
        continue;
      }
    }
    needGrounded.push([key, phrase]);
  }

  // Phase 2: grounded fallback for the rest, a few at a time (faster, polite).
  const CONCURRENCY = 4;
  for (let i = 0; i < needGrounded.length; i += CONCURRENCY) {
    const batch = needGrounded.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async ([key, phrase]) => [key, await groundedBand(phrase)]));
    for (const [key, gb] of results) {
      if (gb) {
        const low = niceRound(gb.low), high = niceRound(gb.high);
        bands[key] = { low, high };
        grounded++;
        console.log(`  ${key.padEnd(14)} $${low}–$${high}  (grounded search)`);
      } else {
        skipped.push(key);
      }
    }
  }

  if (Object.keys(bands).length === 0) {
    console.error("No bands could be recalibrated — eBay blocked the scrape and no GEMINI_API_KEY for the grounded fallback. Run from a residential IP, or add GEMINI_API_KEY to web/.env.local. Leaving generated file unchanged.");
    process.exit(1);
  }
  console.log(`\n${scraped} band(s) from scraped eBay sold comps, ${grounded} from grounded search.`);
  if (skipped.length) console.log("Skipped (kept default band):", skipped.join(", "));

  const out =
`// AUTO-GENERATED by scripts/recalibrate-bands.mjs — DO NOT EDIT BY HAND.
//
// Layer 1 recalibrated SOLD-price bands across a basket of popular post-2021
// vehicles — scraped from eBay's public sold listings where reachable, otherwise
// from a Gemini grounded sold-price search.
// Regenerate with: node scripts/recalibrate-bands.mjs
import type { PriceBand } from "./price-bands";

export const GENERATED_BANDS: Record<string, PriceBand> = ${JSON.stringify(bands, null, 2)};

export const GENERATED_AT: string | null = ${JSON.stringify(new Date().toISOString())};
`;
  const dest = resolve(__dirname, "../web/src/lib/price-bands.generated.ts");
  writeFileSync(dest, out);
  console.log(`Wrote ${Object.keys(bands).length} recalibrated bands → ${dest}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
