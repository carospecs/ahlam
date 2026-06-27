import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";
import { BLOG } from "@/content/blog";

export const metadata: Metadata = {
  title: "Blog: Product News and Selling Tips for Parts Sellers · Ahlam",
  description:
    "Updates, selling tips, and customer stories from Ahlam: how salvage yards and used-parts sellers price, list, and cross-post parts faster.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Ahlam Blog: Product News and Selling Tips",
    description: "Updates and selling tips for salvage yards and used-parts sellers.",
    type: "website",
  },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function BlogIndex() {
  const posts = [...BLOG].sort((a, b) => +new Date(b.published) - +new Date(a.published));
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <SiteHeader />
      <main style={{ position: "relative", zIndex: 1 }}>

        {/* Hero */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 44px" }}>
            <Reveal>
              <div className="cs-eyebrow">From the shop floor</div>
              <h1 className="cs-display" style={{ margin: "10px 0 12px", fontSize: "clamp(40px, 5vw, 52px)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                The Ahlam <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 500 }}>blog</span>.
              </h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 16.5, lineHeight: 1.6, maxWidth: 600 }}>
                Product news, selling tips, and the occasional behind-the-scenes look at how we help yards price, list, and cross-post parts faster.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Post cards */}
        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 24px" }}>
          <RevealStagger style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 18 }}>
            {posts.map((p) => (
              <RevealItem key={p.slug} style={{ height: "100%" }}>
                <Link href={`/blog/${p.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
                  <article className="cs-glass cs-hover-card" style={{ borderRadius: "var(--radius-lg)", padding: 24, height: "100%", display: "flex", flexDirection: "column" }}>
                    <div className="cs-photo" style={{ height: 170, marginBottom: 16 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt={p.title} loading="lazy" />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "4px 10px" }}>{p.category}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(p.published)}</span>
                    </div>
                    <h2 className="cs-display" style={{ margin: "0 0 9px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{p.title}</h2>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, flex: 1 }}>{p.description}</p>
                    <span style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "var(--accent)" }}>Read post <ArrowUpRight size={16} /></span>
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
              <h2 className="cs-display" style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 600 }}>Put these ideas to work</h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 14.5 }}>Photograph a part, let AI grade and price it, then post it everywhere you sell.</p>
              <Link href="/" className="cs-raise" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 600 }}>Try Ahlam <ArrowRight size={16} /></Link>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
