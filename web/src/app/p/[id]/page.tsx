import Link from "next/link";
import { MessageSeller } from "@/components/MessageSeller";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { type Grade } from "@/lib/grade";
import { getListingDetail, partSeoTitle } from "@/lib/shop-site";
import { slugForShopId } from "@/lib/shop-subdomains";
import { siteOrigin } from "@/lib/slug";

// Public, no-auth, indexable page for a SINGLE part listing — the destination
// Google/Facebook send shoppers to from the product feed, and the SEO landing the
// review asked for ("2017 Honda Civic alternator near 77066"). Read-only; never
// exposes another shop's private data.

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

const GRADE_LABEL: Record<Grade, string> = {
  A: "Grade A — like new",
  B: "Grade B — good, used",
  C: "Grade C — fair / repairable",
};

// One DB read shared by metadata + the page body (getListingDetail is
// request-cached). The apex page only serves live inventory — anything not
// active 404s here, same as before.
async function loadListing(id: string) {
  const l = await getListingDetail(id);
  return l && l.status === "active" ? l : null;
}

const seoTitle = partSeoTitle;

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const l = await loadListing(id);
  if (!l) return { title: "Part · Ahlam" };
  const title = `${seoTitle(l)} | Ahlam`;
  const description =
    (l.description || `${l.part} for sale — ${GRADE_LABEL[l.grade as Grade]}, $${l.price}. ${l.fitment ? `Fits ${l.fitment}. ` : ""}From ${l.shopName} on Ahlam.`).slice(0, 300);
  // When the shop has its own subdomain, the part's canonical home is the copy
  // on that subdomain — consolidates rank there instead of splitting with apex.
  const shopSlug = l.shopId ? slugForShopId(l.shopId) : null;
  const canonical = shopSlug ? `${siteOrigin(shopSlug)}/p/${l.id}` : `${SITE_URL}/p/${l.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: l.photoUrl ? [{ url: l.photoUrl }] : undefined,
      type: "website",
    },
  };
}

export default async function ListingPage({ params }: Params) {
  const { id } = await params;
  const l = await loadListing(id);
  if (!l) notFound();

  // Product structured data so Google can show price/condition rich results.
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: seoTitle(l),
    image: l.photoUrl ? [l.photoUrl] : undefined,
    description: l.description || `${l.part} — ${GRADE_LABEL[l.grade as Grade]}.`,
    sku: l.id,
    category: l.category || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: l.price || 0,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url: `${SITE_URL}/p/${l.id}`,
      seller: { "@type": "Organization", name: l.shopName },
    },
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PublicHeader />

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px 64px", display: "grid", gap: 28, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(280px, 1.1fr) minmax(0, 1fr)", alignItems: "start" }} className="cs-listing-grid">
          {/* Photo */}
          {l.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.photoUrl} alt={seoTitle(l)} style={{ width: "100%", borderRadius: 16, border: "1px solid var(--line)", objectFit: "cover", maxHeight: 520 }} />
          ) : (
            <div className="photo-cell" style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 16, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13 }}>No photo</div>
          )}

          {/* Details */}
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{l.part}</h1>
            {l.fitment && <div style={{ marginTop: 6, fontSize: 14.5, color: "var(--muted)" }}>Fits {l.fitment}</div>}
            {/* Curated EV interchange (lib/ev-interchange) — only present on BEV
                parts our hand-checked dataset covers; caveats render inline. */}
            {Array.isArray(l.alsoFits) && l.alsoFits.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                Also fits:{" "}
                {l.alsoFits.map((a: { label: string; caveat?: string }, i: number) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {a.label}
                    {a.caveat && <span style={{ opacity: 0.8 }}> ({a.caveat})</span>}
                  </span>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 30, fontWeight: 800, color: "var(--success)" }}>${Number(l.price).toLocaleString()}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>{GRADE_LABEL[l.grade as Grade]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: l.asIs ? "color-mix(in srgb, var(--muted) 14%, transparent)" : "color-mix(in srgb, var(--success) 16%, transparent)", color: l.asIs ? "var(--muted)" : "var(--success)" }}>{l.asIs ? "🛈 " : "✔ "}{l.warrantyText}</span>
              {l.category && <span style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--muted)" }}>{l.category}</span>}
              {l.location && <span style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--muted)" }}>📍 {l.location}</span>}
            </div>

            {(l.description || l.conditionNotes) && (
              <p style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.6, color: "var(--foreground)", opacity: 0.92 }}>
                {[l.description, l.conditionNotes].filter(Boolean).join(" ")}
              </p>
            )}

            {/* Warranty & returns (WAR-1/WAR-2) — buyers see the terms before buying. */}
            <div style={{ marginTop: 20, padding: 14, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                {l.asIs ? "🛈 Sold as-is" : `✔ ${l.warrantyText}`}
              </div>
              <div style={{ marginTop: 5, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                {l.asIs
                  ? "This part is sold as-is with no warranty or returns."
                  : l.warrantyDays
                    ? `Covered by a ${l.warrantyDays}-day warranty from ${l.shopName}.`
                    : "No warranty offered on this part."}
              </div>
              {l.returnsPolicy && !l.asIs && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{l.returnsPolicy}</div>
              )}
            </div>

            <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {l.shopName}
                {l.verified && <span style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 700 }}>✔ Verified</span>}
              </div>
              {l.phone && <div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>☎ {l.phone}</div>}
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                <MessageSeller listingId={l.id} sellerName={l.shopName} fullWidth />
                <Link href={`/shop/${l.shopId}`} style={{ textAlign: "center", padding: "11px 18px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--foreground)", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                  See this seller&apos;s yard
                </Link>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>Replies show up in your Ahlam messages.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
