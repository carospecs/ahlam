import { effectivePlan } from "@/lib/plan-limits";

// Slug rules for Ultimate-plan personal websites ({slug}.ahlam.io). Pure module
// (no supabase import) so the middleware can use it on the edge runtime.

// Labels that must never become a shop subdomain — infrastructure, app routes,
// and brand terms. Checked app-side (here) rather than in the DB so the list
// can grow without a migration; the migration's backfill mirrors the core ones.
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "adminhost", "mail", "smtp", "email", "ftp",
  "dev", "staging", "test", "preview", "beta", "demo",
  "blog", "docs", "guides", "help", "support", "status",
  "assets", "cdn", "images", "static", "files",
  "shop", "shops", "dashboard", "feed", "profile", "waitlist",
  "ahlam", "vercel", "ns1", "ns2", "autodiscover", "m", "mobile",
]);

// DNS label: 3-63 chars, lowercase alphanumerics with inner hyphens. Must stay
// in sync with the shops_slug_format CHECK in
// supabase/migrations/20260713000000_shop_slug.sql.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

/** Shop name -> suggested slug. Byte-identical to the migration's backfill
 *  expression (lowercase, non-alphanumerics collapse to "-", trim hyphens,
 *  cap at 63). */
export function slugify(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");
}

export function validateSlug(slug: string): { ok: true } | { ok: false; reason: string } {
  const s = (slug || "").toLowerCase();
  if (s.length < 3) return { ok: false, reason: "Must be at least 3 characters." };
  if (s.length > 63) return { ok: false, reason: "Must be 63 characters or fewer." };
  if (!SLUG_RE.test(s)) return { ok: false, reason: "Use lowercase letters, numbers, and hyphens (no leading or trailing hyphen)." };
  if (RESERVED_SLUGS.has(s)) return { ok: false, reason: "That address is reserved." };
  return { ok: true };
}

/** Whether this shop's personal website is live: a claimed slug plus a plan
 *  that includes the site. Legacy "pro" (the pre-launch default on every old
 *  shop) deliberately does not qualify. */
export function hasPersonalSite(shop: {
  slug?: string | null;
  plan?: string | null;
  trial_ends_at?: string | Date | null;
  subscription_status?: string | null;
}): boolean {
  if (!shop?.slug) return false;
  const plan = effectivePlan(shop.plan, shop.trial_ends_at, shop.subscription_status);
  return plan === "ultimate" || plan === "founder";
}

// Root domain the personal sites hang off. Prod: "ahlam.io" -> https://{slug}.ahlam.io.
// Dev: set NEXT_PUBLIC_SITE_ROOT_DOMAIN=localhost:3000 -> http://{slug}.localhost:3000.
export const SITE_ROOT_DOMAIN = process.env.NEXT_PUBLIC_SITE_ROOT_DOMAIN || "ahlam.io";

export function siteOrigin(slug: string): string {
  const proto = SITE_ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";
  return `${proto}://${slug}.${SITE_ROOT_DOMAIN}`;
}
