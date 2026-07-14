import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AUDIENCES } from "@/components/site-nav";
import { getAudienceContent } from "@/content/audiences";

// /audiences index: a single overview that fans out to every /for/[slug] page.
// Server component. Editorial design language matches the redesigned Landing:
// solid surfaces, real photography, hairline structure.

const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";

export const metadata: Metadata = {
  title: "Ahlam for every used-parts seller · Audiences",
  description:
    "Ahlam works for salvage yards, used car dealers, repair shops, parts exporters, and individual flippers. See how it fits the way you sell used auto parts.",
  alternates: { canonical: "/audiences" },
  openGraph: {
    title: "Built for everyone who sells used parts",
    description: "Salvage yards, dealers, repair shops, exporters, and individual flippers.",
    type: "website",
  },
};

export default function AudiencesIndex() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <SiteHeader />
      <main style={{ position: "relative", zIndex: 1 }}>
        {/* Hero */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "70px 24px 54px" }}>
            <div className="cs-kicker">Audiences</div>
            <h1 className="cs-display" style={{ margin: "14px 0 0", fontSize: "clamp(38px, 4.8vw, 56px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 760 }}>
              Built for everyone who sells <span className="accent">used parts</span>
            </h1>
            <p style={{ margin: "20px 0 0", fontSize: 17, color: "var(--muted)", lineHeight: 1.62, maxWidth: 600 }}>
              Whether you run a two-person yard, flip a parts car in the driveway, or move inventory by the container, Ahlam turns a photo into priced, posted listings. Find the fit that sounds like you.
            </p>
          </div>
        </section>

        {/* Audience grid */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 24px 64px" }}>
            <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
              {AUDIENCES.map((a) => {
                const Icon = a.icon;
                const c = getAudienceContent(a.slug);
                const img = c?.image ?? "/img/hero-car.webp";
                return (
                  <Link
                    key={a.slug}
                    href={`/for/${a.slug}`}
                    className="cs-card-btn cs-panel"
                    style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", textDecoration: "none", color: "inherit", height: "100%" }}
                  >
                    <div className="cs-photo" style={{ height: 150, borderRadius: 0, border: "none", borderBottom: "1px solid var(--line)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Ahlam for ${a.title}`} loading="lazy" />
                    </div>
                    <div style={{ padding: 22, display: "flex", flexDirection: "column", flex: 1 }}>
                      <span style={flatIcon}><Icon size={18} color="var(--accent)" /></span>
                      <div style={{ fontSize: 16.5, fontWeight: 600, marginTop: 13, letterSpacing: "-0.01em" }}>{a.nav}</div>
                      <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55, margin: "8px 0 0", flex: 1 }}>{a.tagline}</p>
                      <span style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>
                        See how <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </Link>
                );
              })}
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
                  <h2 className="cs-display" style={{ ...h2, margin: "10px 0 0" }}>However you sell, start free</h2>
                  <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, margin: "12px 0 0", maxWidth: 520 }}>
                    Your first month is free with every feature unlocked, no card. Create your account or book a 15-minute walkthrough.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Link href="/?signup=1" className="cs-raise" style={{ ...solidBtn, justifyContent: "center", padding: "14px 24px", fontSize: 15.5 }}>
                    Start free <ArrowRight size={17} />
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
