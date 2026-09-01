import { notFound } from "next/navigation";
import { getShopBySlug, getShopInventory, getRecentlySold } from "@/lib/shop-site";
import { siteOrigin } from "@/lib/slug";
import * as shopProfiles from "@/lib/shop-static-profiles";
import { SiteInventory } from "@/components/site/SiteInventory";
import { ShopSiteFooter } from "@/components/site/ShopSiteFooter";
import { DealAgent } from "@/components/DealAgent";
import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { YelpIcon } from "@/components/icons/YelpIcon";
import { Phone, Mail, MapPin, Globe } from "lucide-react";

// Home page of an Ultimate shop's personal website — the SEO-optimized,
// zero-config storefront generated from the data the shop already keeps on
// Ahlam. Inventory is the same listings table the marketplace reads, so a sale
// anywhere updates here on the next request.

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

// Downtown Auto Dismantlers is the only shop currently offering EV parts
// delivery — the hero CTA below is scoped to this one shop, not shown as a
// generic claim on every Ultimate site.
const DAD_SHOP_ID = "159c4cdc-3cbc-4061-9942-5c901486df49";

type Params = { params: Promise<{ slug: string }> };

// sameAs links (Google Business Profile, Yelp, Facebook, …) for the shop's
// structured data. Statically maintained per shop until the DB grows a column.
// Wildcard import + runtime checks so this compiles whether the profiles
// module ships a per-shop same_as field, a SHOP_SAMEAS record, or neither.
function sameAsFor(slug: string, shop: any): string[] | undefined {
  const mod: any = shopProfiles;
  const links =
    (Array.isArray(shop?.same_as) && shop.same_as) ||
    (Array.isArray(mod.SHOP_STATIC_PROFILES?.[slug]?.same_as) && mod.SHOP_STATIC_PROFILES[slug].same_as) ||
    (Array.isArray(mod.SHOP_SAMEAS?.[slug]) && mod.SHOP_SAMEAS[slug]) ||
    null;
  return links && links.length ? links : undefined;
}

/** Two-letter state parsed from a "City, ST" location string — data-driven
 *  only, no hardcoded fallback. */
function stateFrom(location?: string | null): string | undefined {
  return (location || "").match(/,\s*([A-Z]{2})\b/)?.[1];
}

/** Facebook/Yelp links out of the same_as list, for the visible social icon
 *  row (same_as itself only feeds invisible JSON-LD structured data). */
function socialLinksFrom(sameAs?: string[]): { facebook?: string; yelp?: string } {
  const out: { facebook?: string; yelp?: string } = {};
  for (const url of sameAs || []) {
    if (/facebook\.com/i.test(url)) out.facebook = url;
    else if (/yelp\.com/i.test(url)) out.yelp = url;
  }
  return out;
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) return {};
  const title = `${shop.name} — Used Auto Parts & Salvage${shop.location ? ` in ${shop.location}` : ""}`;
  const base = (shop.description ||
    `Quality used OEM auto parts from ${shop.name}${shop.location ? ` in ${shop.location}` : ""}. Browse live inventory — tested, graded, and honestly described.`).slice(0, 300);
  // NAP tail (name/address/phone) so the meta description carries the local
  // signals Google matches against "near me" queries.
  const napAddress = [shop.address_line, [shop.location, shop.zip_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const nap = [
    napAddress ? `Located at ${napAddress}.` : "",
    shop.business_phone ? `Call ${shop.business_phone}.` : "",
  ].filter(Boolean).join(" ");
  const description = nap ? `${base} ${nap}` : base;
  const origin = siteOrigin(shop.slug);
  const ogImage = shop.cover_url || shop.logo_url || undefined;
  return {
    title,
    description,
    alternates: { canonical: origin },
    openGraph: { title, description, url: origin, type: "website", images: ogImage ? [{ url: ogImage }] : undefined },
  };
}

function starString(value: number): string {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

export default async function ShopSiteHome({ params }: Params) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const [{ parts, vehicles, reviews }, sold] = await Promise.all([
    getShopInventory(shop),
    getRecentlySold(shop),
  ]);

  const place = shop.location || shop.zip_code || "";
  const signinHref = `${SITE_URL}/?signin=1`;
  const ratingCount = shop.rating_count || 0;
  const { facebook: facebookUrl, yelp: yelpUrl } = socialLinksFrom(sameAsFor(slug, shop));

  // LocalBusiness structured data — the machine-readable layer Google reads
  // for the local pack and rich results.
  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: shop.name,
    url: siteOrigin(shop.slug),
    description: shop.description || undefined,
    telephone: shop.business_phone || undefined,
    image: shop.cover_url || shop.logo_url || undefined,
    address: (shop.address_line || place) ? {
      "@type": "PostalAddress",
      streetAddress: shop.address_line || undefined,
      addressLocality: shop.location || undefined,
      addressRegion: stateFrom(shop.location),
      postalCode: shop.zip_code || undefined,
      addressCountry: "US",
    } : undefined,
    sameAs: sameAsFor(slug, shop),
    geo: shop.lat && shop.lng ? { "@type": "GeoCoordinates", latitude: shop.lat, longitude: shop.lng } : undefined,
    openingHours: shop.hours || undefined,
    aggregateRating: ratingCount > 0 ? {
      "@type": "AggregateRating",
      ratingValue: Number(shop.rating_avg || 0).toFixed(1),
      reviewCount: ratingCount,
    } : undefined,
  };

  const mapsHref = shop.lat && shop.lng
    ? `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`
    : (shop.address_line || place)
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([shop.address_line, place].filter(Boolean).join(", "))}`
      : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <div className="grain" style={{ borderBottom: "1px solid var(--line)", padding: "52px 0 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div className="cs-kicker" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sand)", fontWeight: 700 }}>
            Used OEM auto parts{place ? ` · ${place}` : ""}
          </div>
          <h1 data-no-i18n className="cs-display" style={{ margin: "12px 0 0", fontSize: "clamp(30px, 4.6vw, 44px)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.08, maxWidth: 680 }}>
            {shop.name}
          </h1>
          {(shop.address_line || place) && (
            mapsHref ? (
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 15.5, fontWeight: 700, color: "var(--foreground)", textDecoration: "none" }}>
                <MapPin size={15} /> {[shop.address_line, place].filter(Boolean).join(", ")}
              </a>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 15.5, fontWeight: 700, color: "var(--foreground)" }}>
                <MapPin size={15} /> {[shop.address_line, place].filter(Boolean).join(", ")}
              </div>
            )
          )}
          {shop.description && (
            <p style={{ margin: "14px 0 0", color: "var(--muted)", maxWidth: 600, fontSize: 16, lineHeight: 1.6 }}>{shop.description}</p>
          )}
          {shop.id === DAD_SHOP_ID && shop.business_phone && (
            <a href={`tel:${String(shop.business_phone).replace(/[^\d+]/g, "")}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 18, padding: "10px 16px", borderRadius: 11, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}>
              <Phone size={15} /> Call or message us to arrange EV parts delivery
            </a>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 40px" }}>
        <SiteInventory parts={parts} vehicles={vehicles} shopId={shop.id} shopName={shop.name} signinHref={signinHref} />

        {/* Recently sold — public social proof, synced from the marketplace. */}
        {sold.length > 0 && (
          <div id="sold" style={{ scrollMarginTop: 80 }}>
            <h2 style={sectionH}>
              Recently sold
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>synced automatically from Ahlam Marketplace</span>
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              {sold.map((p: any) => (
                <div key={p.id} className="cs-listing-row" style={{ ...card, display: "flex", opacity: 0.62 }}>
                  <div className="cs-listing-photo" style={{ width: 200, flexShrink: 0 }}>
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.part} style={{ width: "100%", height: "100%", minHeight: 118, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div className="photo-cell" style={{ width: "100%", height: "100%", minHeight: 118, borderRadius: 0 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{p.part}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "var(--danger)", borderRadius: 6, padding: "2.5px 8px", letterSpacing: "0.06em" }}>SOLD</span>
                    </div>
                    {p.fitment && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Fits {p.fitment}</div>}
                    {p.soldAt && <div style={{ fontSize: 12, color: "var(--muted)" }}>Sold {new Date(p.soldAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</div>}
                  </div>
                  <div className="cs-listing-cta" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", padding: "13px 16px", borderLeft: "1px solid var(--line)", width: 170, flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--muted)", textDecoration: "line-through" }}>
                      ${Number(p.soldPrice ?? p.price).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact / hours — shop identity + description already shown in the hero above */}
        <div id="about" style={{ scrollMarginTop: 80, paddingTop: 44 }}>
          <div className="cs-site-two" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22, alignItems: "start" }}>
            <div style={{ ...card, padding: 24 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {shop.business_phone && <a href={`tel:${String(shop.business_phone).replace(/[^\d+]/g, "")}`} style={{ ...contactBtn, display: "inline-flex", alignItems: "center", gap: 7 }}><Phone size={13} /> {shop.business_phone}</a>}
                {shop.email && <a href={`mailto:${shop.email}`} style={{ ...contactBtn, display: "inline-flex", alignItems: "center", gap: 7 }}><Mail size={13} /> Email us</a>}
                {mapsHref && <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ ...contactBtn, display: "inline-flex", alignItems: "center", gap: 7 }}><MapPin size={13} /> Get directions</a>}
                {shop.website && <a href={shop.website} target="_blank" rel="noopener noreferrer" style={{ ...contactBtn, display: "inline-flex", alignItems: "center", gap: 7 }}><Globe size={13} /> Website</a>}
              </div>
              {(facebookUrl || yelpUrl) && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                  {facebookUrl && (
                    <a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={socialBtn}>
                      <FacebookIcon size={16} />
                    </a>
                  )}
                  {yelpUrl && (
                    <a href={yelpUrl} target="_blank" rel="noopener noreferrer" aria-label="Yelp" style={socialBtn}>
                      <YelpIcon size={16} />
                    </a>
                  )}
                </div>
              )}
              {reviews.length > 0 && reviews.slice(0, 3).map((r: any) => (
                <div key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 14, fontSize: 13.5 }}>
                  <span style={{ color: "var(--sand)", letterSpacing: 2 }}>{starString(r.rating)}</span>
                  {r.body && <div style={{ marginTop: 4, lineHeight: 1.55 }}>&ldquo;{r.body}&rdquo;</div>}
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    {r.author}{r.verified_purchase ? " · verified purchase" : ""}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...card, padding: 24 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Hours &amp; location</h3>
              {shop.hours && <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{shop.hours}</p>}
              {(shop.address_line || place) && (
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                  {shop.address_line}{shop.address_line && place ? <br /> : null}{place}
                </p>
              )}
              {shop.returns_policy && (
                <>
                  <h3 style={{ margin: "18px 0 0", fontSize: 13.5, fontWeight: 800 }}>Returns</h3>
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{shop.returns_policy}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShopSiteFooter shop={shop} parts={parts} />
      {/* The demo site (demo.ahlam.io) has no real shop row for the agent to
          query, so skip the widget there rather than show a broken chat. */}
      {shop.id !== "demo-site" && <DealAgent shopId={shop.id} shopName={shop.name} />}
    </>
  );
}

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
const sectionH: React.CSSProperties = { fontSize: 21, fontWeight: 800, letterSpacing: "-0.015em", margin: "44px 0 16px", display: "flex", alignItems: "baseline", gap: 10 };
const contactBtn: React.CSSProperties = { fontSize: 13, fontWeight: 700, textDecoration: "none", color: "inherit", border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "9px 15px" };
const socialBtn: React.CSSProperties = { width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 999, flexShrink: 0 };
