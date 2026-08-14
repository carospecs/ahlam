import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { ShopHeader, ShopFooterCredit } from "@/components/ShopHeader";
import { ShopSite } from "@/components/ShopSite";
import { SHOP_SUBDOMAINS, slugForShopId } from "@/lib/shop-subdomains";
import { MessageSeller } from "@/components/MessageSeller";
import { ReportBusiness } from "@/components/ReportBusiness";
import { DealAgent } from "@/components/DealAgent";
import { getShopById, getShopInventory } from "@/lib/shop-site";
import { hasPersonalSite, siteOrigin } from "@/lib/slug";

export const dynamic = "force-dynamic";

// Public, no-auth storefront for a single shop — everything they have live.
// Reachable from any listing's shop name in Browse, and shareable as a link.

type Params = { params: Promise<{ id: string }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const host = (await headers()).get("host") || "";
  const onOwnSubdomain = Object.keys(SHOP_SUBDOMAINS).some((slug) => host.startsWith(`${slug}.`));
  // Shops with a subdomain canonicalize onto it so ahlam.io/shop/<uuid> and
  // <slug>.ahlam.io consolidate rank on the subdomain instead of splitting it.
  const slug = slugForShopId(id);
  const canonical = slug ? siteOrigin(slug) : `${SITE_URL}/shop/${id}`;
  const shop = await getShopById(id);
  if (!shop) return { title: onOwnSubdomain ? "Shop" : "Shop · Ahlam" };
  const title = onOwnSubdomain ? shop.name : `${shop.name} · Ahlam`;
  const description = shop.description || `Used parts & vehicles from ${shop.name}${shop.location ? ` in ${shop.location}` : ""}.`;
  const ogImage = shop.cover_url || shop.logo_url || undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", images: ogImage ? [{ url: ogImage }] : undefined },
  };
}

function fmtFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit.map((f: any) => {
      if (typeof f === "string") return f;
      const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : (f.yearStart || "");
      return [yr, f.make, f.model].filter(Boolean).join(" ").trim();
    }).filter(Boolean).join(", ");
  }
  return "";
}

export default async function ShopStorefront({ params }: Params) {
  const { id } = await params;
  const shop = await getShopById(id);
  if (!shop) notFound();
  const { parts, vehicles, reviews: reviewRows } = await getShopInventory(shop);

  const initials = (shop.name || "S").split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);
  const count = parts.length + vehicles.length;
  const ratingAvg = Number(shop.rating_avg || 0);
  const ratingCount = shop.rating_count || 0;

  // On the shop's own subdomain (<slug>.ahlam.io) this reads as their site,
  // not ours — swap the Ahlam nav for a shop-branded one. On ahlam.io/shop/<id>
  // (reached from Browse etc.) keep the normal Ahlam header.
  const host = (await headers()).get("host") || "";
  const onOwnSubdomain = Object.keys(SHOP_SUBDOMAINS).some((slug) => host.startsWith(`${slug}.`));

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      {onOwnSubdomain ? <ShopHeader name={shop.name} logoUrl={shop.logo_url} /> : <PublicHeader />}

      {onOwnSubdomain ? (
        <ShopSite shop={shop} listingCount={count} />
      ) : (
        /* Header / cover */
        <div className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              {shop.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo_url} alt={shop.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: "1px solid var(--line)" }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 16, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 800 }}>{initials}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {shop.name}
                  {shop.verified && <span title="Verified seller" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)", borderRadius: 999, padding: "4px 11px" }}>✔ Verified seller</span>}
                </h1>
                <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  {ratingCount > 0 && <span style={{ color: "#F5A623", fontWeight: 700 }}>{starString(ratingAvg)} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{ratingAvg.toFixed(1)} ({ratingCount})</span></span>}
                  {shop.location && <span>📍 {shop.location}</span>}
                  <span>{count} active listing{count === 1 ? "" : "s"}</span>
                  {shop.website && <a href={shop.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Website ↗</a>}
                  <ReportBusiness shopId={id} businessName={shop.name} />
                </div>
              </div>
            </div>
            {shop.description && <p style={{ margin: "18px 0 0", maxWidth: 720, color: "var(--foreground)", fontSize: 14.5, lineHeight: 1.6, opacity: 0.9 }}>{shop.description}</p>}
            <div style={{ marginTop: 16 }}>
              <MessageSeller shopId={id} subject="your inventory" sellerName={shop.name} />
            </div>
            {(shop.business_phone || shop.email || shop.hours) && (
              <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
                {shop.business_phone && <span>☎ {shop.business_phone}</span>}
                {shop.email && <span>✉ {shop.email}</span>}
                {shop.hours && <span>🕑 {shop.hours}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 24px 60px" }}>
        {count === 0 && !onOwnSubdomain && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: 16 }}>
            This shop has no active listings right now.
          </div>
        )}

        {vehicles.length > 0 && (
          <>
            <h2 style={sectionH}>Vehicles ({vehicles.length})</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {vehicles.map((v) => (
                <div key={v.id} className="cs-listing-row" style={{ ...card, display: "flex" }}>
                  <div className="cs-listing-photo" style={{ width: 200, flexShrink: 0 }}>
                    {v.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.photoUrl} alt={`${v.year} ${v.make} ${v.model}`} style={{ width: "100%", height: "100%", minHeight: 148, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div className="photo-cell" style={{ width: "100%", height: "100%", minHeight: 148, borderRadius: 0 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{v.year} {v.make} {v.model} {v.trim}</span>
                      {v.sellMode === "both" && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)", borderRadius: 999, padding: "2px 9px" }}>Also parting out</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{[v.mileage, v.body, v.color].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="cs-listing-cta" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, padding: "13px 16px", borderLeft: "1px solid var(--line)", width: 170, flexShrink: 0 }}>
                    {v.askingPrice ? <div style={{ fontSize: 20, fontWeight: 800 }}>${Number(v.askingPrice).toLocaleString()}</div> : <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>Parting out</div>}
                    <div style={{ marginTop: "auto" }}>
                      <MessageSeller shopId={id} subject={`${v.year} ${v.make} ${v.model}`.trim()} sellerName={shop.name} compact fullWidth />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {parts.length > 0 && (
          <>
            <h2 style={sectionH}>Parts ({parts.length})</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {parts.map((p) => (
                <Link key={p.id} href={`/p/${p.id}`} className="cs-listing-row" style={{ ...card, display: "flex", textDecoration: "none", color: "inherit" }}>
                  <div className="cs-listing-photo" style={{ position: "relative", width: 200, flexShrink: 0 }}>
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.part} style={{ width: "100%", height: "100%", minHeight: 148, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div className="photo-cell" style={{ width: "100%", height: "100%", minHeight: 148, borderRadius: 0 }} />
                    )}
                    <span style={{ position: "absolute", top: 10, left: 10, fontSize: 11, fontWeight: 800, color: "#fff", background: "rgba(7,11,22,0.72)", borderRadius: 6, padding: "3px 8px" }}>Grade {p.grade}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{p.part}</span>
                      {p.category && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 9px" }}>{p.category}</span>}
                    </div>
                    {p.fitment && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Fits {p.fitment}</div>}
                    {(p.desc || p.note) && (
                      <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {[p.desc, p.note && p.note !== p.desc ? p.note : ""].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="cs-listing-cta" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, padding: "13px 16px", borderLeft: "1px solid var(--line)", width: 170, flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>${Number(p.price).toLocaleString()}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap", color: p.asIs ? "var(--muted)" : "var(--success)", background: p.asIs ? "color-mix(in srgb, var(--muted) 14%, transparent)" : "color-mix(in srgb, var(--success) 14%, transparent)" }}>{p.warrantyText}</span>
                    <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>View & message →</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {reviewRows.length > 0 && (
          <>
            <h2 style={sectionH}>Reviews ({ratingCount})</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {reviewRows.map((r: any) => (
                <div key={r.id} style={{ ...card, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#F5A623", fontWeight: 700, letterSpacing: 1 }}>{starString(r.rating)}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.author}</span>
                    {r.verified_purchase && <span style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 600 }}>· Verified purchase</span>}
                  </div>
                  {r.body && <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--foreground)", opacity: 0.9, lineHeight: 1.55 }}>{r.body}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {!onOwnSubdomain && (
          <div style={{ marginTop: 40, padding: 20, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Sell your own parts? List your inventory on Ahlam free for a month.</div>
            <Link href="/" style={{ display: "inline-flex", marginTop: 12, padding: "10px 20px", borderRadius: 11, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Open Ahlam</Link>
          </div>
        )}
      </div>

      {onOwnSubdomain && <ShopFooterCredit />}
      <DealAgent shopId={id} shopName={shop.name} />
    </main>
  );
}

// Round to the nearest whole star for the static (server-rendered) summary.
function starString(value: number): string {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

const sectionH: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: "26px 0 14px" };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
