// COMPS RETRIEVAL — real eBay listings, fetched by OUR code, before any model call.
// (docs: PRICING_MIGRATION_INSTRUCTION — "the retrieval happens in our code; the
// model's only job is judgment over data we already gave it".)
//
// Uses the Browse API with an application (client-credentials) token — no seller
// account needed, public listing data only. NOTE on sold-vs-asking: eBay's
// sold/completed data API (Marketplace Insights) is approval-gated, so retrieval
// returns ACTIVE/ASKING listings; how much asking overshoots is the judge's call
// from the supply in front of it (not a flat rule). Every function here fails soft:
// a config/auth/network problem returns null and the caller skips the comps tier.
// (No lib imports on purpose — keeps this loadable by the plain-node tests.)

const ENV = (process.env.EBAY_ENV || "production").toLowerCase() === "sandbox" ? "sandbox" : "production";
const API = ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
// eBay Motors → Car & Truck Parts. Env-overridable, same var the lister uses.
const CATEGORY_ID = process.env.EBAY_CATEGORY_ID || "6028";

// The FULL listing goes to the judge — the title is how it reads fitment,
// completeness, configuration, and options. Code must not reduce or interpret it
// (docs: PRICING_MIGRATION_INSTRUCTION (2) — "blinding the judge is what forces
// the code to make these calls badly").
export type Comp = {
  price: number;
  title: string;
  condition: string;      // eBay condition label ("Used", "For parts or not working", …)
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

// WIDE retrieval net: year + make + model + part, no trim filter — so SR/SR5
// donors surface for a TRD Sport. Whether a given listing actually fits (an
// interchangeable engine vs a color-keyed or 4WD-specific panel) is the JUDGE's
// call, made per part from the listing titles — never a query or code rule.
export function compQuery(fitment: { year?: string | number | null; make?: string | null; model?: string | null }, partName: string): string {
  return [fitment.year, fitment.make, fitment.model, partName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// Minimal mechanical hygiene ONLY (docs: PRICING_MIGRATION_INSTRUCTION (2)):
// drop clearly-broken "for parts / not working" cores, dedupe exact repeats, cap.
// EVERYTHING else — shell-only, long-block-no-turbo, wrong generation, wrong
// trim/config — stays in the pool for the judge to read and weigh. A cheaper
// configuration is information, not junk; fitment is a per-part judgment the
// titles carry, not a rule code can execute.
const CLEARLY_BROKEN = /\b(for\s+parts|not\s+working|parts\s+only)\b/i;

export function cleanComps(
  raw: { price: number; title: string; condition?: string }[],
  cap = 12,
): Comp[] {
  const seen = new Set<string>();
  const out: Comp[] = [];
  for (const r of raw) {
    if (!r || typeof r.price !== "number" || !Number.isFinite(r.price) || r.price <= 0) continue;
    if (typeof r.title !== "string" || !r.title.trim()) continue;
    const title = r.title.trim();
    if (CLEARLY_BROKEN.test(title)) continue;
    if ((r.condition || "").toLowerCase().includes("parts")) continue; // "For parts or not working"
    const key = `${title.toLowerCase().replace(/\s+/g, " ").slice(0, 60)}|${Math.round(r.price)}`;
    if (seen.has(key)) continue; // exact repeat (eBay artifact) — real supply still shows as distinct listings
    seen.add(key);
    out.push({ price: Math.round(r.price), title, condition: r.condition || "Used" });
    if (out.length >= cap) break;
  }
  return out;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

async function searchOne(token: string, query: string): Promise<Comp[]> {
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
    return cleanComps(raw);
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
  const results = await Promise.all(
    partNames.map(async (name) => [name, await searchOne(token, compQuery(fitment, name))] as const),
  );
  return Object.fromEntries(results);
}
