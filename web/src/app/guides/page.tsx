import Link from "next/link";
import type { Metadata } from "next";
import { BrandChip } from "@/components/BrandMark";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Guides — Pricing, selling & software for salvage yards · Ahlam",
  description:
    "Practical guides for small auto salvage yards and used-parts sellers: how to price used parts, when to sell, and which software to use in 2026.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Ahlam Guides — Pricing, selling & software for salvage yards",
    description: "How to price used parts, when to sell, and which yard software to use.",
    type: "website",
  },
};

export default function GuidesIndex() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <div className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}><BrandChip size={24} /> Ahlam</Link>
          <h1 style={{ margin: "20px 0 8px", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>Guides</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
            Practical, no-fluff guides for small salvage yards and used-parts sellers — pricing, seasonality, and the software landscape.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px 64px", display: "grid", gap: 16 }}>
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
            <article style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 22 }} className="cs-hover-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>{g.category}</span>
                <span>·</span><span>{g.readMinutes} min read</span>
              </div>
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>{g.title}</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{g.description}</p>
            </article>
          </Link>
        ))}

        <div style={{ marginTop: 24, padding: 22, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Turn these tips into listings in seconds</div>
          <p style={{ margin: "8px 0 14px", color: "var(--muted)", fontSize: 14 }}>Photograph a part, let AI identify, grade, and price it, then post anywhere you sell.</p>
          <Link href="/" style={{ display: "inline-flex", padding: "11px 22px", borderRadius: 12, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Try Ahlam</Link>
        </div>
      </div>
    </main>
  );
}
