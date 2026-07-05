// COMPS RETRIEVAL — real eBay listings, fetched by OUR code, before any model call.
// (docs: PRICING_MIGRATION_INSTRUCTION — "the retrieval happens in our code; the
// model's only job is judgment over data we already gave it".)
//
// Uses the Browse API with an application (client-credentials) token — no seller
// account needed, public listing data only. NOTE on sold-vs-asking: eBay's
// sold/completed data API (Marketplace Insights) is approval-gated, so retrieval
// returns ACTIVE/ASKING listings; the judgment prompt prices toward the
// lower-middle of asking comps to compensate. Every function here fails soft:
// a config/auth/network problem returns null and the caller skips the comps tier.
// (No lib imports on purpose — keeps this loadable by the plain-node tests.)

const ENV = (process.env.EBAY_ENV || "production").toLowerCase() === "sandbox" ? "sandbox" : "production";
const API = ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
// eBay Motors → Car & Truck Parts. Env-overridable, same var the lister uses.
const CATEGORY_ID = process.env.EBAY_CATEGORY_ID || "6028";

export type Comp = {
  price: number;
  title: string;          // doubles as the fitment note — the judge reads it
  condition: string;      // eBay condition label ("Used", "For parts or not working", …)
  sold: boolean;          // Browse API = active listings, so always false today
  source: "ebay";
};

// ── App token (client credentials), cached in-module until near expiry ────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function appToken(): Promise<string | null> {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) return null;
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  try {
    const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
    const r = await fetch(`${API}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cachedToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 7200) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

// ── Pure helpers (unit-tested with plain node) ────────────────────────────────

// Interchange-aware query: year + make + model + part, deliberately WITHOUT the
// trim — same-generation trims share most panels and an SR/SR5 engine fits a TRD
// Sport. The judge sees each comp's full title and handles the nuance.
export function compQuery(fitment: { year?: string | number | null; make?: string | null; model?: string | null }, partName: string): string {
  return [fitment.year, fitment.make, fitment.model, partName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// Light mechanical hygiene, in code (the brief's list): drop core/shell/for-parts/
// broken junk, drop obvious wrong-generation hits by title years, dedupe, cap.
// Nuanced fitment calls stay with the judgment model.
const JUNK = /\b(core(?:\s+only)?|for\s+parts|not\s+working|parts\s+only|shell\s+only|cover\s+only|bare|broken|cracked|repair(?:able)?|salvage\s+title|damaged)\b/i;

export function cleanComps(
  raw: { price: number; title: string; condition?: string }[],
  fitmentYear: number | null,
  cap = 12,
): Comp[] {
  const seen = new Set<string>();
  const out: Comp[] = [];
  for (const r of raw) {
    if (!r || typeof r.price !== "number" || !Number.isFinite(r.price) || r.price <= 0) continue;
    if (typeof r.title !== "string" || !r.title.trim()) continue;
    const title = r.title.trim();
    if (JUNK.test(title)) continue;
    if ((r.condition || "").toLowerCase().includes("parts")) continue; // "For parts or not working"
    // Obvious wrong generation: the title names model years and NONE is within
    // ±5 of the fitment year. Titles with no year tokens pass through.
    if (fitmentYear) {
      const years = [...title.matchAll(/\b(19|20)(\d{2})\b/g)].map((m) => Number(`${m[1]}${m[2]}`));
      if (years.length && !years.some((y) => Math.abs(y - fitmentYear) <= 5)) continue;
    }
    const key = `${title.toLowerCase().replace(/\s+/g, " ").slice(0, 60)}|${Math.round(r.price)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ price: Math.round(r.price), title, condition: r.condition || "Used", sold: false, source: "ebay" });
    if (out.length >= cap) break;
  }
  return out;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

async function searchOne(token: string, query: string, fitmentYear: number | null): Promise<Comp[]> {
  try {
    const p = new URLSearchParams({
      q: query,
      category_ids: CATEGORY_ID,
      limit: "24",
      filter: "conditions:{USED},buyingOptions:{FIXED_PRICE},priceCurrency:USD",
    });
    const r = await fetch(`${API}/buy/browse/v1/item_summary/search?${p}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { itemSummaries?: { title?: string; price?: { value?: string }; condition?: string }[] };
    const raw = (j.itemSummaries ?? []).map((s) => ({
      price: Number(s.price?.value ?? NaN),
      title: s.title ?? "",
      condition: s.condition,
    }));
    return cleanComps(raw, fitmentYear);
  } catch {
    return [];
  }
}

// Fetch comps for every part IN PARALLEL. Returns null when eBay itself is
// unavailable (unconfigured / auth failure) so the caller can skip the comps
// tier entirely instead of treating every part as zero-comp.
export async function fetchCompsForParts(
  fitment: { year?: string | number | null; make?: string | null; model?: string | null },
  partNames: string[],
): Promise<Record<string, Comp[]> | null> {
  const token = await appToken();
  if (!token) return null;
  const fitmentYear = Number(fitment.year) || null;
  const results = await Promise.all(
    partNames.map(async (name) => [name, await searchOne(token, compQuery(fitment, name), fitmentYear)] as const),
  );
  return Object.fromEntries(results);
}
