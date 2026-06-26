import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck, Camera, Boxes, Tag, Send, Check, ScanLine, type LucideIcon } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AUDIENCES, getAudience } from "@/components/site-nav";
import { getAudienceContent, type FeatureIconKey } from "@/content/audiences";

// Per-audience marketing landing page at /for/[slug]. Server component: static,
// crawlable, no client interactivity (FAQ is plain cards, not an accordion).
// The short audience facts (nav label, icon, tagline) come from site-nav; the
// long-form copy comes from content/audiences. Editorial design language matches
// the redesigned Landing: solid surfaces, hairline structure, real photography.

type Params = { params: Promise<{ slug: string }> };

const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";

// Each audience's four "How Ahlam helps" features map to the product's core
// capabilities in the same order, so one icon set covers every page.
const FEATURE_ICON: Record<FeatureIconKey, LucideIcon> = {
  scan: Camera,
  grade: Boxes,
  price: Tag,
  post: Send,
};

// Pre-render every audience page at build time.
export function generateStaticParams() {
  return AUDIENCES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const a = getAudience(slug);
  const c = getAudienceContent(slug);
  if (!a || !c) return { title: "Audiences · Ahlam" };
  return {
    title: `Ahlam for ${a.nav}`,
    description: c.intro,
    alternates: { canonical: `/for/${slug}` },
    openGraph: { title: `Ahlam for ${a.nav}`, description: c.intro, type: "website" },
  };
}

export default async function AudiencePage({ params }: Params) {
  const { slug } = await params;
  const a = getAudience(slug);
  const c = getAudienceContent(slug);
  if (!a || !c) notFound();

  const Icon = a.icon;

  // FAQ structured data so the page is eligible for rich results.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader />
      <main style={{ position: "relative", zIndex: 1 }}>
        {/* Hero — copy left, framed photo right */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="cs-hero-grid" style={{ maxWidth: 1080, margin: "0 auto", padding: "70px 24px 78px", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center" }}>
            <div>
              <span className="cs-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon size={14} /> For {a.nav}
              </span>
              <h1 className="cs-display" style={{ margin: "16px 0 0", fontSize: "clamp(36px, 4.6vw, 54px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
                {c.headline}
              </h1>
              <p style={{ margin: "20px 0 0", fontSize: 17, color: "var(--muted)", lineHeight: 1.62, maxWidth: 500 }}>
                {c.intro}
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap", alignItems: "center" }}>
                <Link href="/waitlist" className="cs-raise" style={{ ...solidBtn, padding: "14px 26px", fontSize: 15.5 }}>
                  Join the waitlist <ArrowRight size={17} />
                </Link>
                <Link href="/#how" className="cs-textlink" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>
                  See how it works <ArrowRight size={15} style={{ opacity: 0.6 }} />
                </Link>
              </div>
              <div style={{ marginTop: 22, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                {["Free first month, no card", "Posts to eBay today", "No parts expertise needed"].map((t) => (
                  <span key={t} style={{ fontSize: 13, color: "var(--muted)", display: "inline-flex", gap: 7, alignItems: "center" }}>
                    <Check size={14} color="var(--success)" /> {t}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", top: -14, right: -14, width: 150, height: 150, background: "var(--sand)", borderRadius: 6, opacity: 0.9, zIndex: 0 }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div className="cs-frame">
                  <div className="cs-frame__bar">
                    <span className="cs-frame__dot" style={{ background: "#ff5f57" }} />
                    <span className="cs-frame__dot" style={{ background: "#febc2e" }} />
                    <span className="cs-frame__dot" style={{ background: "#28c840" }} />
                    <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>Ahlam · {a.nav}</span>
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 15%, transparent)", borderRadius: 999, padding: "2px 9px" }}>
                      <ScanLine size={11} /> Built for you
                    </span>
                  </div>
                  <div className="cs-photo" style={{ height: 300, borderRadius: 0, border: "none" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image} alt={`Ahlam for ${a.title}`} loading="lazy" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The problem — audience-specific friction */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px" }}>
            <div style={{ maxWidth: 720 }}>
              <div className="cs-kicker" style={{ color: "var(--accent)" }}>The problem</div>
              <h2 className="cs-display" style={{ ...h2, maxWidth: 680 }}>
                What gets in the way today
              </h2>
            </div>
            <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 44 }}>
              {c.problems.map((p, i) => (
                <div key={p.title} className="cs-panel" style={{ padding: 24 }}>
                  <span className="cs-index" style={{ fontSize: 22 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ fontSize: 17, fontWeight: 600, marginTop: 10 }}>{p.title}</div>
                  <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6, margin: "8px 0 0" }}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How Ahlam helps — four capability cards + outcome line */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px" }}>
            <div style={{ maxWidth: 660 }}>
              <div className="cs-kicker">How Ahlam helps</div>
              <h2 className="cs-display" style={h2}>
                Everything the work takes, <span className="accent">handled</span>
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
                Photograph the car and Ahlam runs the whole job: it names the parts, grades them, prices them from real sales, and posts them where buyers shop.
              </p>
            </div>
            <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 44 }}>
              {c.features.map((f) => {
                const FeatureIcon = FEATURE_ICON[f.iconKey];
                return (
                  <div key={f.title} className="cs-panel" style={{ padding: 22, height: "100%" }}>
                    <span style={flatIcon}><FeatureIcon size={18} color="var(--accent)" /></span>
                    <div style={{ fontSize: 15.5, fontWeight: 600, marginTop: 14 }}>{f.title}</div>
                    <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55, margin: "6px 0 0" }}>{f.body}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", borderRadius: "var(--radius-lg)", background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "4px solid var(--accent)" }}>
              <div>
                <div className="cs-kicker" style={{ color: "var(--accent)", marginBottom: 6 }}>The payoff</div>
                <span style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.5 }}>{c.outcome}</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ — plain cards (server component, no accordion) */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", padding: "78px 24px" }}>
            <div className="cs-kicker">Questions</div>
            <h2 className="cs-display" style={{ ...h2, fontSize: 32 }}>Answers for {a.nav.toLowerCase()}</h2>
            <div style={{ display: "grid", gap: 12, marginTop: 36 }}>
              {c.faqs.map((f) => (
                <div key={f.q} className="cs-panel" style={{ padding: "20px 22px" }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 7 }}>{f.q}</div>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)" }}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "76px 24px" }}>
            <div style={{ borderRadius: "var(--radius-xl)", padding: "52px 40px", background: "var(--surface)", border: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
              <span aria-hidden style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%", background: "var(--accent)" }} />
              <div className="cs-cta-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 36, alignItems: "center" }}>
                <div>
                  <div className="cs-kicker">Get started</div>
                  <h2 className="cs-display" style={{ ...h2, margin: "10px 0 0" }}>See Ahlam on your own inventory</h2>
                  <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, margin: "12px 0 0", maxWidth: 520 }}>
                    Join the waitlist for the free first month, or book a 15-minute walkthrough and we will scan one of your cars live.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Link href="/waitlist" className="cs-raise" style={{ ...solidBtn, justifyContent: "center", padding: "14px 24px", fontSize: 15.5 }}>
                    Join the waitlist <ArrowRight size={17} />
                  </Link>
                  <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, justifyContent: "center", padding: "13px 22px", fontSize: 15 }}>
                    <CalendarCheck size={16} /> Book a demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const solidBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, textDecoration: "none" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, textDecoration: "none" };
const h2: React.CSSProperties = { fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", margin: "14px 0 0", lineHeight: 1.1 };
const flatIcon: React.CSSProperties = { display: "inline-grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", flexShrink: 0 };
