import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { PublicHeader } from "@/components/PublicHeader";
import { normalizeGrade, type Grade } from "@/lib/grade";

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

function fmtFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit
      .map((f: any) => {
        if (typeof f === "string") return f;
        const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : f.yearStart || "";
        return [yr, f.make, f.model].filter(Boolean).join(" ").trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

// One DB read shared by metadata + the page body.
async function loadListing(id: string) {
  try {
    const db = supabaseAdmin();
    const { data: l } = await db.from("listings").select("*").eq("id", id).eq("status", "active").single();
    if (!l) return null;
    const { data: shop } = await db.from("shops").select("name, location, zip_code, business_phone, verified").eq("id", l.shop_id).single();
    const c = l.corrected || l.ai_output || {};
    return {
      id: l.id as string,
      shopId: l.shop_id as string,
      part: (c.partName || c.part_name || "Used Part") as string,
      grade: normalizeGrade(c.condition),
      price: (l.price_usd ?? c.suggestedPriceUsd ?? 0) as number,
      fitment: fmtFit(c.fitment),
      category: (c.partCategory || c.part_category || "") as string,
      description: (c.description || "") as string,
      conditionNotes: (c.conditionNotes || "") as string,
      photoUrl: (l.photo_url || null) as string | null,
      shopName: (shop?.name || "Independent seller") as string,
      location: (shop?.zip_code || shop?.location || "") as string,
      phone: (shop?.business_phone || null) as string | null,
      verified: !!shop?.verified,
    };
  } catch {
    return null;
  }
}

// Keyword-rich title: "2016–2021 Honda Civic Front Left Door — Grade B used part near 77066".
function seoTitle(l: NonNullable<Awaited<ReturnType<typeof loadListing>>>): string {
  const head = [l.fitment, l.part].filter(Boolean).join(" ");
  const near = l.location ? ` near ${l.location}` : "";
  return `${head} — used auto part${near}`.trim();
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const l = await loadListing(id);
  if (!l) return { title: "Part · Ahlam" };
  const title = `${seoTitle(l)} | Ahlam`;
  const description =
    (l.description || `${l.part} for sale — ${GRADE_LABEL[l.grade]}, $${l.price}. ${l.fitment ? `Fits ${l.fitment}. ` : ""}From ${l.shopName} on Ahlam.`).slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/p/${l.id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/p/${l.id}`,
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
    description: l.description || `${l.part} — ${GRADE_LABEL[l.grade]}.`,
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

            <div style={{ marginTop: 16, fontSize: 30, fontWeight: 800, color: "var(--success)" }}>${Number(l.price).toLocaleString()}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>{GRADE_LABEL[l.grade]}</span>
              {l.category && <span style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--muted)" }}>{l.category}</span>}
              {l.location && <span style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--muted)" }}>📍 {l.location}</span>}
            </div>

            {(l.description || l.conditionNotes) && (
              <p style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.6, color: "var(--foreground)", opacity: 0.92 }}>
                {[l.description, l.conditionNotes].filter(Boolean).join(" ")}
              </p>
            )}

            <div style={{ marginTop: 22, padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {l.shopName}
                {l.verified && <span style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 700 }}>✔ Verified</span>}
              </div>
              {l.phone && <div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>☎ {l.phone}</div>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <Link href={`/shop/${l.shopId}`} style={{ flex: 1, minWidth: 150, textAlign: "center", padding: "11px 18px", borderRadius: 11, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                  See this seller&apos;s yard
                </Link>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>Open Ahlam to message the seller or make an offer.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
