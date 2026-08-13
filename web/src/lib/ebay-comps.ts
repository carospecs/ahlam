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
  // Judge-facing listing metadata (docs: pricing-prompt.md — shipping-vs-pickup
  // and listing date are part of what the judge must weigh; a $326 pickup-only
  // tailgate is not the same number as a $326 shipped one). Optional so the
  // plain-node tests and older callers keep working.
  shipping?: string | null;  // "free shipping" | "+$150 shipping" | "calculated shipping" | "local pickup only"
  listedAt?: string | null;  // ISO date (YYYY-MM-DD) the listing was created, when eBay returns it
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
  raw: { price: number; title: string; condition?: string; shipping?: string | null; listedAt?: string | null }[],
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
    out.push({ price: Math.round(r.price), title, condition: r.condition || "Used", shipping: r.shipping ?? null, listedAt: r.listedAt ?? null });
    if (out.length >= cap) break;
  }
  return out;
}

// ── OEM / aftermarket classification (pure, unit-tested) ──────────────────────
// Aftermarket reproductions listed against used-OEM pulls undercut the true
// value of an original part — the single comp-quality problem Andy called out.
// This is a deterministic TITLE heuristic, not a filter: retrieval never drops
// a listing over it (the wide-net rule stands). The judge receives the label
// on each listing line and is instructed to anchor on used-OEM comps and
// treat aftermarket prices as a floor, with the title outranking the label.
//
// Rule order is deliberate, first hit wins, and deliberately conservative:
// a bare fitment range ("Fits 2018-2022 …") is COMMON on used-OEM pulls and
// must never classify on its own.
export type CompClass = "oem" | "aftermarket" | "unknown";

// Reproduction/replacement brands that dominate aftermarket auto-parts
// listings. Word-boundary matched; a brand hit wins even when the title also
// says "OEM replacement" — that phrasing is itself an aftermarket tell.
const AFTERMARKET_BRANDS =
  /\b(tyc|depo|anzo|spyder|spec-?d|akkon|vland|alpharex|eagle eyes|dorman|sherman|keystone|k-?metal|pacific best|brock|evan-?fischer|garage-?pro|diy solutions|action crash|headlights? depot|karparts ?360|perde|marketon|jp auto|carlights360|auto dynasty|topline|winjet|lkq new)\b/i;

const AFTERMARKET_PHRASES = [
  /\baftermarket\b/i,
  /\bcapa(?:-| )?(?:certified)?\b/i,
  /\breproduction\b/i,
  /\bOE[- ]?style\b/i,
  /\b(?:replacement|compatible)\s+(?:for|with)\b/i,
  /\bhalogen\s+type\b/i,
];

// "Headlight For Toyota Camry 2018-2024" is reproduction phrasing — OEM pulls
// lead with year-make-model ("2018 Toyota Camry Headlight OEM 42K"), they
// don't sell "for" a vehicle. Allows a few make/model words between the
// preposition and the year range. NEVER classifies on its own: a pull whose
// title also carries OEM evidence (part number, "OEM", mileage) is excused.
const FITMENT_FOR = /\b(?:fits?|for)\s+(?:[A-Za-z][\w.&'-]*\s+){0,3}(?:19|20)\d{2}\s?[-–]\s?(?:(?:19|20)?\d{2})\b/i;

// Salvage pulls cite mileage; reproductions never do.
const MILEAGE_LANGUAGE = /\b\d{1,3}\s?k\b|\bmiles?\b/i;

const OEM_SIGNALS = [
  /\boem\b/i,
  /\bgenuine\b/i,
  /\bfactory\b/i,
  /\boriginal\b(?!\s+style)/i,
  /\bused\s+(?:pull|take[- ]?off|removed)\b/i,
  /\btake[- ]?off\b/i,
  /\bdonor\b/i,
  // OEM part-number tokens: "52119-06E20", "8T4Z-17D957-AA", and unhyphenated
  // runs like Mercedes "A2059066902" / "205750240028" or GM's bare 8-digit.
  // The leading lookahead refuses year-range shapes ("2018-2024") so an
  // all-caps fitment span never reads as a part number.
  /\b(?!(?:19|20)\d{2}\s?[-–])(?=[A-Z0-9-]*\d)[A-Z0-9]{2,5}[-–][A-Z0-9]{4,7}(?:[-–][A-Z0-9]{1,4})?\b/,
  /\b[A-Z]?\d{8,13}\b/,
];

// "New take-off" is OEM language (a new part pulled from a new vehicle), not
// reproduction language — it must survive the new-on-Used rule below.
const TAKEOFF = /\btake[- ]?offs?\b|\btakeoffs?\b/i;

export function classifyComp(title: string, condition?: string): CompClass {
  const t = (title || "").trim();
  if (!t) return "unknown";
  if (AFTERMARKET_BRANDS.test(t)) return "aftermarket";
  if (AFTERMARKET_PHRASES.some((re) => re.test(t))) return "aftermarket";
  const oemEvidence = OEM_SIGNALS.some((re) => re.test(t)) || MILEAGE_LANGUAGE.test(t);
  if (FITMENT_FOR.test(t) && !oemEvidence) return "aftermarket";
  // A title shouting "new"/"brand new" on a Used-condition listing is a
  // reproduction sold through the used pipeline, not a yard pull ("new
  // take-off" excepted — that's an OEM part off a new vehicle).
  if (/\b(?:brand new|new)\b/i.test(t) && !TAKEOFF.test(t) && !oemEvidence && (condition || "").toLowerCase().includes("used")) return "aftermarket";
  // Mileage counts as OEM evidence in its own right: only a pulled part has miles.
  if (oemEvidence) return "oem";
  return "unknown";
}

// ── Query variants (pure, unit-tested) ────────────────────────────────────────

// Parts eBay lists BOTH as stripped shells/sub-components and as complete
// assemblies. Verified live 2026-07-17: "2018 TESLA Model X Driver Side Front
// Door" best-match = 12/12 shells + motors + glass, zero complete doors; adding
// "assembly" surfaces a complete door as hit #1. Retrieval widening ONLY —
// never a fitment filter; the judge still reads every title.
const ASSEMBLY_CLASS =
  /\b(door|seat|liftgate|lift\s?gate|tailgate|tail\s?gate|hatch|trunk\s?lid|deck\s?lid|decklid|bumper|mirror|axle|engine|transmission|transaxle|transfer\s?case|differential|steering\s?column|console|headlight|head\s?lamp|taillight|tail\s?light|tail\s?lamp|strut|hub)\b/i;

export function isAssemblyClass(partName: string): boolean {
  return ASSEMBLY_CLASS.test(partName);
}

// Priority-ordered variants for one part: [assembly?, generation?, generic].
// Order matters — it is the interleave priority (scarce assembly comps first).
export function compQueryVariants(
  fitment: { year?: string | number | null; make?: string | null; model?: string | null },
  partName: string,
  gen?: { from: number; to: number } | null,
): string[] {
  const generic = compQuery(fitment, partName);
  const out: string[] = [];
  if (isAssemblyClass(partName) && !/\bassembly\b/i.test(partName)) out.push(`${generic} assembly`);
  if (gen && fitment.make && fitment.model && gen.from !== gen.to)
    out.push([`${gen.from}-${gen.to}`, fitment.make, fitment.model, partName].join(" ").replace(/\s+/g, " ").trim());
  out.push(generic);
  return [...new Set(out)];
}

// Round-robin [a0,b0,c0,a1,b1,c1,…] so best-match shell flooding in one pool
// can't starve the others at the cap. cleanComps preserves order, so interleave
// order decides exactly which comps survive the final cap.
export function interleave<T>(pools: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; pools.some((p) => i < p.length); i++)
    for (const p of pools) if (i < p.length) out.push(p[i]);
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
    const j = (await r.json()) as {
      itemSummaries?: {
        title?: string;
        price?: { value?: string };
        condition?: string;
        itemCreationDate?: string;
        shippingOptions?: { shippingCostType?: string; shippingCost?: { value?: string } }[];
      }[];
    };
    // Shipping label: buyers (and the judge) treat a pickup-only price and a
    // shipped price as different numbers. No shippingOptions on a Browse
    // summary almost always means seller-arranged local pickup only.
    const shippingLabel = (s: { shippingOptions?: { shippingCostType?: string; shippingCost?: { value?: string } }[] }): string => {
      const o = s.shippingOptions?.[0];
      if (!o) return "local pickup only";
      const v = Number(o.shippingCost?.value ?? NaN);
      if (Number.isFinite(v)) return v === 0 ? "free shipping" : `+$${Math.round(v)} shipping`;
      return o.shippingCostType === "CALCULATED" ? "calculated shipping" : "shipping unknown";
    };
    const raw = (j.itemSummaries ?? []).map((s) => ({
      price: Number(s.price?.value ?? NaN),
      title: s.title ?? "",
      condition: s.condition,
      shipping: shippingLabel(s),
      listedAt: typeof s.itemCreationDate === "string" ? s.itemCreationDate.slice(0, 10) : null,
    }));
    return cleanComps(raw, 24); // per-variant pool stays wide; the merged pool takes the final cap
  } catch {
    return [];
  }
}

const MERGED_CAP = 18;        // final per-part pool: 3 variants round-robin → ≥6 slots each pre-dedupe
const PART_CONCURRENCY = 16;  // ≤16 parts in flight × ≤3 variants = ≤48 concurrent Browse calls

// Tiny width limiter — variants tripled the query count; don't fire 240 at once.
async function allLimit<T>(limit: number, tasks: (() => Promise<T>)[]): Promise<T[]> {
  const out = new Array<T>(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

// Sibling-model retrieval hints (EV interchange): a part shared across models
// (Model 3 ↔ Model Y drive unit) sells under BOTH names, so each sibling adds
// one query variant. Widening ONLY — the judge reads every title and decides
// fit, exactly like the generation variant. Pure and unit-tested.
export type SiblingHint = { make: string; model: string; from: number; to: number };
const MAX_SIBLING_VARIANTS = 2; // per part, on top of the ≤3 base variants

export function siblingQueries(partName: string, hints: SiblingHint[] | undefined | null): string[] {
  if (!hints?.length) return [];
  return hints
    .slice(0, MAX_SIBLING_VARIANTS)
    .map((h) => [h.from !== h.to ? `${h.from}-${h.to}` : String(h.from), h.make, h.model, partName].join(" ").replace(/\s+/g, " ").trim());
}

// Fetch comps for every part IN PARALLEL (width-limited), up to three query
// variants per part (+ up to two sibling-model variants from EV interchange)
// merged into one pool. Returns null when eBay itself is unavailable
// (unconfigured / auth failure) so the caller can skip the comps tier entirely
// instead of treating every part as zero-comp.
export async function fetchCompsForParts(
  fitment: { year?: string | number | null; make?: string | null; model?: string | null },
  partNames: string[],
  gen?: { from: number; to: number } | null,
  hintsFor?: (partName: string) => SiblingHint[],
): Promise<Record<string, Comp[]> | null> {
  const token = await appToken();
  if (!token) return null;
  const tasks = partNames.map((name) => async () => {
    const queries = [...new Set([...compQueryVariants(fitment, name, gen), ...siblingQueries(name, hintsFor?.(name))])];
    const pools = await Promise.all(queries.map((q) => searchOne(token, q)));
    return [name, cleanComps(interleave(pools), MERGED_CAP)] as const;
  });
  return Object.fromEntries(await allLimit(PART_CONCURRENCY, tasks));
}
