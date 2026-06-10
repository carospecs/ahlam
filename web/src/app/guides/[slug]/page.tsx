import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BrandChip } from "@/components/BrandMark";
import { GUIDES, getGuide } from "@/content/guides";

type Params = { params: Promise<{ slug: string }> };

// Pre-render every guide at build time for fast, crawlable static pages.
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return { title: "Guide · Ahlam" };
  return {
    title: `${g.title} · Ahlam`,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: { title: g.title, description: g.description, type: "article" },
  };
}

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();

  // Structured data so the guide is eligible for rich results.
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    datePublished: g.updated,
    dateModified: g.updated,
    author: { "@type": "Organization", name: "Ahlam" },
    publisher: { "@type": "Organization", name: "Ahlam" },
  };
  const faqLd = g.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: g.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  const related = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 2);

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <div className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px" }}>
          <Link href="/guides" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}><BrandChip size={24} /> Ahlam Guides</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)", margin: "20px 0 10px" }}>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{g.category}</span>
            <span>·</span><span>{g.readMinutes} min read</span>
            <span>·</span><span>Updated {new Date(g.updated).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{g.title}</h1>
        </div>
      </div>

      <article style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 64px" }}>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--foreground)", opacity: 0.95, marginTop: 0 }}>{g.intro}</p>

        {g.sections.map((s, i) => (
          <section key={i} style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.01em" }}>{s.heading}</h2>
            {s.paragraphs.map((p, j) => (
              <p key={j} style={{ fontSize: 15.5, lineHeight: 1.75, color: "var(--foreground)", opacity: 0.9, margin: "0 0 14px" }}>{p}</p>
            ))}
            {s.bullets && (
              <ul style={{ margin: "4px 0 0", paddingLeft: 22, display: "grid", gap: 8 }}>
                {s.bullets.map((b, k) => (
                  <li key={k} style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--foreground)", opacity: 0.9 }}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {g.faqs && g.faqs.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 14px" }}>Frequently asked</h2>
            <div style={{ display: "grid", gap: 14 }}>
              {g.faqs.map((f, i) => (
                <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>{f.q}</div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--muted)" }}>{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 40, padding: 22, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Price and list this part in seconds</div>
          <p style={{ margin: "8px 0 14px", color: "var(--muted)", fontSize: 14 }}>Ahlam photographs the part, grades it, suggests a price from live comps, and posts it for you.</p>
          <Link href="/" style={{ display: "inline-flex", padding: "11px 22px", borderRadius: 12, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Try Ahlam free</Link>
        </div>

        {related.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Keep reading</div>
            <div style={{ display: "grid", gap: 12 }}>
              {related.map((r) => (
                <Link key={r.slug} href={`/guides/${r.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }} className="cs-hover-card">
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{r.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </main>
  );
}
