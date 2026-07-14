import { notFound } from "next/navigation";
import { MessageSeller } from "@/components/MessageSeller";
import { type Grade } from "@/lib/grade";
import { getShopBySlug, getListingDetail, partSeoTitle } from "@/lib/shop-site";
import { siteOrigin } from "@/lib/slug";

// Part detail on an Ultimate shop's personal website — the subdomain twin of
// /p/[id], canonical on the shop's own domain. Sold parts render a noindex
// "Sold" state instead of 404ing, so a stale shared link still lands somewhere
// useful.

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

type Params = { params: Promise<{ slug: string; id: string }> };

const GRADE_LABEL: Record<Grade, string> = {
  A: "Grade A — like new",
  B: "Grade B — good, used",
  C: "Grade C — fair / repairable",
};

// Listing must exist, belong to THIS shop (cross-tenant guard), and be
// publicly showable (active or sold — drafts and removed listings 404).
async function load(slug: string, id: string) {
  const shop = await getShopBySlug(slug);
  if (!shop) return null;
  const l = await getListingDetail(id);
  if (!l || l.shopId !== shop.id) return null;
  if (l.status !== "active" && l.status !== "sold") return null;
  return { shop, l };
}

export async function generateMetadata({ params }: Params) {
  const { slug, id } = await params;
  const data = await load(slug, id);
  if (!data) return {};
  const { shop, l } = data;
  const sold = l.status === "sold";
  const title = `${partSeoTitle(l)} | ${shop.name}`;
  const description = (l.description || `${l.part} — ${GRADE_LABEL[l.grade as Grade]}${l.fitment ? `. Fits ${l.fitment}` : ""}. From ${shop.name}.`).slice(0, 300);
  return {
    title: sold ? `SOLD — ${title}` : title,
    description,
    alternates: { canonical: `${siteOrigin(shop.slug)}/p/${l.id}` },
    robots: sold ? { index: false } : undefined,
    openGraph: {
      title,
      description,
      url: `${siteOrigin(shop.slug)}/p/${l.id}`,
      images: l.photoUrl ? [{ url: l.photoUrl }] : undefined,
      type: "website",
    },
  };
}

export default async function SitePartPage({ params }: Params) {
  const { slug, id } = await params;
  const data = await load(slug, id);
  if (!data) notFound();
  const { shop, l } = data;
  const sold = l.status === "sold";
  const signinHref = `${SITE_URL}/p/${l.id}?signin=1`;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: partSeoTitle(l),
    image: l.photoUrl ? [l.photoUrl] : undefined,
    description: l.description || `${l.part} — ${GRADE_LABEL[l.grade as Grade]}.`,
    sku: l.id,
    category: l.category || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: l.price || 0,
      availability: sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url: `${siteOrigin(shop.slug)}/p/${l.id}`,
      seller: { "@type": "Organization", name: shop.name },
    },
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px 64px" }}>
      {!sold && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--muted)", textDecoration: "none", marginBottom: 20 }}>
        ← All inventory
      </a>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(280px, 1.1fr) minmax(0, 1fr)", alignItems: "start" }} className="cs-listing-grid">
        {/* Photo */}
        <div style={{ position: "relative" }}>
          {l.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.photoUrl} alt={partSeoTitle(l)} style={{ width: "100%", borderRadius: 16, border: "1px solid var(--line)", objectFit: "cover", maxHeight: 520, opacity: sold ? 0.7 : 1 }} />
          ) : (
            <div className="photo-cell" style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 16, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13 }}>No photo</div>
          )}
          {sold && (
            <span style={{ position: "absolute", top: 14, left: 14, fontSize: 13, fontWeight: 800, color: "#fff", background: "var(--danger)", borderRadius: 8, padding: "6px 14px", letterSpacing: "0.06em" }}>SOLD</span>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{l.part}</h1>
          {l.fitment && <div style={{ marginTop: 6, fontSize: 14.5, color: "var(--muted)" }}>Fits {l.fitment}</div>}

          <div style={{ marginTop: 16, fontSize: 30, fontWeight: 800, color: sold ? "var(--muted)" : "var(--success)", textDecoration: sold ? "line-through" : "none" }}>
            ${Number(l.price).toLocaleString()}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>{GRADE_LABEL[l.grade as Grade]}</span>
            {!sold && <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: l.asIs ? "color-mix(in srgb, var(--muted) 14%, transparent)" : "color-mix(in srgb, var(--success) 16%, transparent)", color: l.asIs ? "var(--muted)" : "var(--success)" }}>{l.asIs ? "🛈 " : "✔ "}{l.warrantyText}</span>}
            {l.category && <span style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--muted)" }}>{l.category}</span>}
          </div>

          {(l.description || l.conditionNotes) && (
            <p style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.6, opacity: 0.92 }}>
              {[l.description, l.conditionNotes].filter(Boolean).join(" ")}
            </p>
          )}

          {sold ? (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>This part has been sold.</div>
              <div style={{ marginTop: 5, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                We may have a similar one in the yard, or new stock coming — message us and we&apos;ll check.
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                <MessageSeller shopId={shop.id} subject={l.part} sellerName={shop.name} fullWidth signinHref={signinHref} />
                <a href="/" style={{ textAlign: "center", padding: "11px 18px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--foreground)", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                  Browse our inventory
                </a>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginTop: 20, padding: 14, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {l.asIs ? "🛈 Sold as-is" : `✔ ${l.warrantyText}`}
                </div>
                <div style={{ marginTop: 5, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                  {l.asIs
                    ? "This part is sold as-is with no warranty or returns."
                    : l.warrantyDays
                      ? `Covered by a ${l.warrantyDays}-day warranty from ${shop.name}.`
                      : "No warranty offered on this part."}
                </div>
                {l.returnsPolicy && !l.asIs && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{l.returnsPolicy}</div>
                )}
              </div>

              <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <MessageSeller listingId={l.id} sellerName={shop.name} fullWidth signinHref={signinHref} />
                  {shop.business_phone && (
                    <a href={`tel:${String(shop.business_phone).replace(/[^\d+]/g, "")}`} style={{ textAlign: "center", padding: "11px 18px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--foreground)", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                      ☎ {shop.business_phone}
                    </a>
                  )}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>Replies show up in your Ahlam messages.</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
