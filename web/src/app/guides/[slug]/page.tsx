import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";
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
    openGraph: { title: g.title, description: g.description, type: "article", images: [g.image] },
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
    image: g.image,
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
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <SiteHeader />
      <main style={{ position: "relative", zIndex: 1 }}>

        {/* Header */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "44px 24px 36px" }}>
            <Reveal>
              <Link href="/guides" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}><ArrowLeft size={14} /> All guides</Link>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)", margin: "22px 0 12px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "4px 10px" }}>{g.category}</span>
                <span>{g.readMinutes} min read</span>
                <span>·</span><span>Updated {new Date(g.updated).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              </div>
              <h1 className="cs-display" style={{ margin: 0, fontSize: "clamp(34px, 4.6vw, 44px)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{g.title}</h1>
            </Reveal>
          </div>
        </section>

        <article style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 72px" }}>
          <Reveal>
            <div className="cs-frame" style={{ marginBottom: 30 }}>
              <div className="cs-frame__bar">
                <span className="cs-frame__dot" style={{ background: "#ff5f57" }} />
                <span className="cs-frame__dot" style={{ background: "#febc2e" }} />
                <span className="cs-frame__dot" style={{ background: "#28c840" }} />
              </div>
              <div className="cs-photo" style={{ height: 360, borderRadius: 0, border: "none" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.image} alt={g.title} loading="lazy" />
              </div>
            </div>
          </Reveal>
          <Reveal>
            <p style={{ fontSize: 19, lineHeight: 1.7, color: "var(--foreground)", opacity: 0.95, marginTop: 0, fontWeight: 500 }}>{g.intro}</p>
          </Reveal>

          {g.sections.map((s, i) => (
            <Reveal key={i}>
              <section style={{ marginTop: 38 }}>
                <h2 className="cs-display" style={{ fontSize: 25, fontWeight: 600, margin: "0 0 14px", letterSpacing: "-0.015em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>{s.heading}</h2>
                {s.paragraphs.map((p, j) => (
                  <p key={j} style={{ fontSize: 16, lineHeight: 1.78, color: "var(--foreground)", opacity: 0.88, margin: "0 0 14px" }}>{p}</p>
                ))}
                {s.bullets && (
                  <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                    {s.bullets.map((b, k) => (
                      <li key={k} style={{ position: "relative", paddingLeft: 24, fontSize: 16, lineHeight: 1.7, color: "var(--foreground)", opacity: 0.88 }}>
                        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 9, width: 7, height: 7, borderRadius: 999, background: "var(--accent)" }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          ))}

          {g.faqs && g.faqs.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <Reveal><h2 className="cs-display" style={{ fontSize: 25, fontWeight: 600, margin: "0 0 16px" }}>Frequently asked</h2></Reveal>
              <RevealStagger style={{ display: "grid", gap: 12 }}>
                {g.faqs.map((f, i) => (
                  <RevealItem key={i}>
                    <div className="cs-glass" style={{ borderRadius: "var(--radius-md)", padding: 18 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>{f.q}</div>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--muted)" }}>{f.a}</p>
                    </div>
                  </RevealItem>
                ))}
              </RevealStagger>
            </section>
          )}

          <Reveal>
            <div className="cs-glass" style={{ marginTop: 48, padding: 30, borderRadius: "var(--radius-xl)", textAlign: "center", border: "1.5px solid color-mix(in srgb, var(--accent) 40%, var(--line))" }}>
              <h2 className="cs-display" style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 600 }}>Price and list this part in seconds</h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 14.5 }}>Ahlam photographs the part, grades it, suggests a price from live comps, and posts it for you.</p>
              <Link href="/" className="cs-raise" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 600 }}>Try Ahlam free <ArrowRight size={16} /></Link>
            </div>
          </Reveal>

          {related.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <Reveal><div className="cs-eyebrow" style={{ marginBottom: 14 }}>Keep reading</div></Reveal>
              <RevealStagger style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {related.map((r) => (
                  <RevealItem key={r.slug} style={{ height: "100%" }}>
                    <Link href={`/guides/${r.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
                      <div className="cs-glass cs-hover-card" style={{ borderRadius: "var(--radius-md)", padding: 18, height: "100%", display: "flex", flexDirection: "column" }}>
                        <div className="cs-display" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{r.title}</div>
                        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, flex: 1 }}>{r.description}</div>
                        <span style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>Read <ArrowUpRight size={14} /></span>
                      </div>
                    </Link>
                  </RevealItem>
                ))}
              </RevealStagger>
            </div>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
