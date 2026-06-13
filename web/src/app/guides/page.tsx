import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Guides: Pricing, Selling, and Software for Salvage Yards · Ahlam",
  description:
    "Practical guides for small auto salvage yards and used-parts sellers: how to price used parts, when to sell, and which software to use in 2026.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Ahlam Guides: Pricing, Selling, and Software for Salvage Yards",
    description: "How to price used parts, when to sell, and which yard software to use.",
    type: "website",
  },
};

export default function GuidesIndex() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <PublicHeader />

        {/* Hero */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 44px" }}>
            <Reveal>
              <div className="cs-eyebrow">Field notes</div>
              <h1 className="cs-display" style={{ margin: "10px 0 12px", fontSize: "clamp(40px, 5vw, 52px)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Guides for selling parts <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 500 }}>smarter</span>.
              </h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 16.5, lineHeight: 1.6, maxWidth: 600 }}>
                Practical, no-fluff playbooks for small salvage yards and used-parts sellers. Pricing, seasonality, and the software landscape, written by people who have done the work.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Guide cards */}
        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 24px" }}>
          <RevealStagger style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 18 }}>
            {GUIDES.map((g) => (
              <RevealItem key={g.slug} style={{ height: "100%" }}>
                <Link href={`/guides/${g.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
                  <article className="cs-glass cs-hover-card" style={{ borderRadius: "var(--radius-lg)", padding: 24, height: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "4px 10px" }}>{g.category}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{g.readMinutes} min read</span>
                    </div>
                    <h2 className="cs-display" style={{ margin: "0 0 9px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{g.title}</h2>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, flex: 1 }}>{g.description}</p>
                    <span style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "var(--accent)" }}>Read guide <ArrowUpRight size={16} /></span>
                  </article>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 72px" }}>
          <Reveal>
            <div className="cs-glass" style={{ padding: 32, borderRadius: "var(--radius-xl)", textAlign: "center", border: "1.5px solid color-mix(in srgb, var(--accent) 40%, var(--line))" }}>
              <h2 className="cs-display" style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 600 }}>Turn these tips into listings in seconds</h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 14.5 }}>Photograph a part, let AI identify, grade, and price it, then post anywhere you sell.</p>
              <Link href="/" className="cs-raise" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 600 }}>Try Ahlam <ArrowRight size={16} /></Link>
            </div>
          </Reveal>
        </section>
      </div>
    </main>
  );
}
