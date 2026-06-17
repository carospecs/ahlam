// Live used-part pricing. The target signal is SOLD prices — what buyers actually
// paid — not active asking prices, which skew high because overpriced listings
// sit unsold. eBay's sold-price API (Marketplace Insights) is closed to new
// developers, so the pipeline gets sold data two free ways:
//
//   • Layer 1 (band recalibration) scrapes eBay's PUBLIC sold-listings pages —
//     see scripts/recalibrate-bands.mjs. Run periodically from a non-cloud IP
//     (your machine / a cron box); eBay tends to block datacenter IPs.
//   • Per-request, the live signal is a Gemini GROUNDED WEB SEARCH for sold
//     prices (groundedMedianPrice) — reliable from Vercel, where scraping isn't.
//
// The eBay Browse API (active listings) is retained only for leaf-category
// lookup during listing. No-ops cleanly (returns []/null) when unconfigured.
import { geminiGenerate } from "./gemini";
import { isSanePrice } from "./price-bands";

const ENV = (process.env.EBAY_ENV || "production").toLowerCase() === "sandbox" ? "sandbox" : "production";
const API = ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

// Browse uses a client-credentials app token — only needs EBAY_CLIENT_ID/SECRET.
function pricingConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

let appToken: { token: string; exp: number } | null = null;

async function getAppToken(): Promise<string | null> {
  if (!pricingConfigured()) return null;
  if (appToken && appToken.exp > Date.now() + 60_000) return appToken.token;
  try {
    const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
    const r = await fetch(`${API}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
      body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
    });
    if (!r.ok) return null;
    const j = await r.json();
    appToken = { token: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
    return appToken.token;
  } catch { return null; }
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Minimum comps for a median to be trustworthy (used by callers pooling prices).
export const MIN_COMPS = 4;

// Outlier-trimmed median: drop the extreme 15% on each end (mispriced / wrong-item
// listings), then take the median. Returns null if empty.
export function trimmedMedian(prices: number[]): number | null {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.15);
  const trimmed = sorted.slice(cut, sorted.length - cut);
  return Math.round(median(trimmed.length ? trimmed : sorted));
}

// Per-request LIVE price signal — a grounded web search for the median SOLD price.
// Gemini (with Google Search grounding) reads real sold listings off the web, so
// it works from serverless where scraping eBay would be blocked. `partName` is
// used only to sanity-check the answer against the band. Returns null if grounding
// is unavailable, finds no number, or the value is implausible — the caller then
// falls back to the Layer 2 model estimate.
export async function groundedMedianPrice(query: string, partName: string): Promise<number | null> {
  try {
    const res = await geminiGenerate("gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text:
        `Use Google to find what this used auto part ACTUALLY SOLD FOR recently: "${query}". ` +
        `Cross-check several sources — eBay SOLD/completed listings, Google Shopping, car-part.com, Facebook Marketplace, OfferUp — and corroborate the figure across them. ` +
        `Strongly prefer COMPLETED / SOLD prices over current asking prices: sold prices are true market value, asking prices skew high. ` +
        `Estimate the MEDIAN sold price in US dollars for the part in good used condition.\n\n` +
        `Reply with ONLY the dollar amount, prefixed with "$" (e.g. "$385") — no year, no part name, no words, no range. ` +
        `If you cannot corroborate at least a few real sold comps, reply with exactly "NONE".`,
      } ] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string = (j.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p.text ?? "").join("");
    const price = parseGroundedPrice(text);
    if (price == null) return null;
    return isSanePrice(price, partName) ? price : null; // reject implausible grounding
  } catch { return null; }
}

// Pull a USD price out of the grounded model's free-text reply. The model often
// echoes the query, so a naive "first number" grabs the YEAR (e.g. 2017) instead
// of the price. So: bail on NONE, prefer an explicit $-prefixed amount, and
// otherwise strip 4-digit year tokens (1900–2099) before taking the first number.
export function parseGroundedPrice(text: string): number | null {
  if (!text || /\bNONE\b/i.test(text)) return null;
  const cleaned = text.replace(/,/g, "");
  const dollar = cleaned.match(/\$\s?(\d{1,6}(?:\.\d+)?)/);
  if (dollar) return Math.round(parseFloat(dollar[1]));
  const noYears = cleaned.replace(/\b(?:19|20)\d{2}\b/g, " ");
  const m = noYears.match(/\d{1,6}(?:\.\d+)?/);
  return m ? Math.round(parseFloat(m[0])) : null;
}

// Convenience wrapper used by the PricingToggle UI's "live comp" lookup: a single
// median sold price for a free-form query. Backed by the grounded sold search.
export async function livePartPrice(query: string): Promise<number | null> {
  return groundedMedianPrice(query, query);
}

export function livePricingEnabled(): boolean {
  return pricingConfigured();
}

// Active ASKING prices of USED, fixed-price listings (Browse API). Asking prices
// skew high, so this is NOT in the default sold-price pipeline — kept only as an
// optional helper.
export async function ebayUsedPrices(query: string): Promise<number[]> {
  const token = await getAppToken();
  if (!token) return [];
  try {
    const url = `${API}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=40`
      + `&filter=${encodeURIComponent("conditions:{USED},buyingOptions:{FIXED_PRICE}")}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.itemSummaries || [])
      .map((i: any) => parseFloat(i.price?.value))
      .filter((n: number) => Number.isFinite(n) && n > 0);
  } catch { return []; }
}

// Pricing ladder — condition adjustment. Market comps (own/grounded/asking) reflect
// a part in GOOD used condition (~Grade B). Adjust the comp price to the part's
// actual grade so a clean Grade A part isn't underpriced and a worn Grade C isn't
// overpriced. (The Layer-2 model estimate is already condition-aware, so it is NOT
// re-multiplied.)
// B is the market baseline (comps reflect good/usable parts). A is a modest premium
// for like-new. C is a damaged/repairable core and must be CLEARLY below market — a
// crashed door should never approach a clean one's price (0.78 left them too close).
export const CONDITION_MULTIPLIER: Record<"A" | "B" | "C", number> = { A: 1.15, B: 1.0, C: 0.5 };
export function applyCondition(price: number, grade: "A" | "B" | "C"): number {
  return Math.round(price * (CONDITION_MULTIPLIER[grade] ?? 1));
}

// Asking-price → sold-price discount. Active asking prices skew high (overpriced
// listings sit unsold), so a sold approximation discounts the asking median.
export const ASKING_TO_SOLD = 0.82;

// Ladder rung 3 (between live SOLD comps and the band floor): approximate a sold
// price from ACTIVE ASKING prices when no sold comps are found. Needs at least
// MIN_COMPS asking listings, takes their outlier-trimmed median, discounts it, and
// only returns a band-sane result. Returns null if eBay is unconfigured, there are
// too few listings, or the result is implausible — caller then falls to the band.
export async function askingApproxPrice(query: string, partName: string): Promise<number | null> {
  const asking = await ebayUsedPrices(query);
  if (asking.length < MIN_COMPS) return null;
  const med = trimmedMedian(asking);
  if (med == null) return null;
  const approx = Math.round(med * ASKING_TO_SOLD);
  return isSanePrice(approx, partName) ? approx : null;
}

// Live eBay comp statistics for a part query — the MEDIAN of current US used,
// fixed-price listings (NOT discounted: this is what comparable parts are listed
// at right now), plus the listing count and price range. Used both to price the
// part and to show the seller a "selling on eBay for ~$X" reference note. Returns
// null if eBay is unconfigured, there are too few listings, or the median is
// implausible for the part type.
export interface EbayCompStats { median: number; count: number; min: number; max: number; }
export async function ebayCompStats(query: string, partName: string): Promise<EbayCompStats | null> {
  const token = await getAppToken();
  if (!token) return null;
  try {
    const url = `${API}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=50`
      + `&filter=${encodeURIComponent("conditions:{USED},buyingOptions:{FIXED_PRICE}")}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
    if (!r.ok) return null;
    const j = await r.json();
    // `total` is eBay's REAL count of matching listings (not the 50-item page cap),
    // so the "N listings" the seller sees is honest, not a constant 40/50.
    const total = Number(j.total) || 0;
    const prices: number[] = (j.itemSummaries || [])
      .map((i: { price?: { value?: string } }) => parseFloat(i.price?.value ?? ""))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (prices.length < MIN_COMPS) return null;
    const med = trimmedMedian(prices);
    if (med == null) return null;
    const median = Math.round(med);
    if (!isSanePrice(median, partName)) return null;
    const sorted = [...prices].sort((a, b) => a - b);
    return { median, count: total || prices.length, min: Math.round(sorted[0]), max: Math.round(sorted[sorted.length - 1]) };
  } catch { return null; }
}

// Resolve the eBay LEAF category a part should be listed in by reading the
// categories that real comps for `query` are listed under. The Inventory API
// requires a leaf category, and eBay Motors parts categories aren't exposed by
// the Taxonomy API — so we infer it from live listings (categories[0] is the
// most specific / leaf category). Returns null if it can't determine one.
export async function suggestLeafCategory(query: string): Promise<string | null> {
  const token = await getAppToken();
  if (!token) return null;
  try {
    const url = `${API}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=40`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
    if (!r.ok) return null;
    const j = await r.json();
    const counts = new Map<string, number>();
    for (const it of (j.itemSummaries || [])) {
      const leaf = it.categories?.[0]?.categoryId; // first entry = most specific leaf
      if (leaf) counts.set(leaf, (counts.get(leaf) || 0) + 1);
    }
    let best: string | null = null, max = 0;
    for (const [id, n] of counts) if (n > max) { max = n; best = id; }
    return best;
  } catch { return null; }
}
