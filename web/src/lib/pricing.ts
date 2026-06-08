// Live used-part pricing from eBay's Browse API (current market listings), so
// suggested prices come from real comps instead of the model's memory. Uses an
// application token (client-credentials) — only needs EBAY_CLIENT_ID/SECRET, not
// seller OAuth. No-ops cleanly (returns null) when eBay isn't configured.
const ENV = (process.env.EBAY_ENV || "production").toLowerCase() === "sandbox" ? "sandbox" : "production";
const API = ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

// Pricing only needs the app keys (Browse API uses a client-credentials token) —
// NOT the seller-OAuth redirect URI that listing requires.
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

// Median asking price of comparable USED listings for `query` (e.g.
// "2018 Honda Civic Left Front Door"). Returns null if eBay is unconfigured or
// there aren't enough comps to be trustworthy.
export async function livePartPrice(query: string): Promise<number | null> {
  const token = await getAppToken();
  if (!token) return null;
  try {
    const url = `${API}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=40`
      + `&filter=${encodeURIComponent("conditions:{USED},buyingOptions:{FIXED_PRICE}")}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
    if (!r.ok) return null;
    const j = await r.json();
    let prices: number[] = (j.itemSummaries || [])
      .map((i: any) => parseFloat(i.price?.value))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (prices.length < 4) return null; // not enough comps to trust
    // Trim the extreme 15% on each end (drops mispriced/wrong-item outliers), then median.
    prices.sort((a, b) => a - b);
    const cut = Math.floor(prices.length * 0.15);
    const trimmed = prices.slice(cut, prices.length - cut);
    const m = median(trimmed.length ? trimmed : prices);
    return Math.round(m);
  } catch { return null; }
}

export function livePricingEnabled(): boolean {
  return pricingConfigured();
}
