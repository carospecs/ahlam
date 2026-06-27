// eBay + grounded-search helpers retained for features OUTSIDE the AI scan:
//   • suggestLeafCategory — resolves the eBay leaf category when listing a part
//     (used by /api/ebay/list).
//   • livePartPrice / groundedMedianPrice — an on-demand "live comp" lookup for a
//     single query, backed by a Gemini grounded web search (used by the manual
//     PricingToggle UI).
//
// The AI scan itself no longer prices from comps — it uses the deterministic
// flat grade-discount model in ./age-pricing.ts. The old comp ladder (eBay listing
// medians, shop sold-comps, asking-price approximations, price bands) has been
// removed.
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

// On-demand LIVE price signal — a grounded web search for the median SOLD price.
// Gemini (with Google Search grounding) reads real sold listings off the web, so
// it works from serverless where scraping eBay would be blocked. `partName` is
// used only to sanity-check the answer against the band. Returns null if grounding
// is unavailable, finds no number, or the value is implausible.
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
