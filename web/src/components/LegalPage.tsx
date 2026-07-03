import React from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/Reveal";

// Shared layout for every policy page (/terms, /privacy, /refunds, ...) so the
// legal section reads as one set of documents instead of six one-off pages.
// Copy rule: no em dashes in any user-facing string.

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export const LEGAL_PAGES = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refunds & Cancellation", href: "/refunds" },
  { label: "Marketplace Guidelines", href: "/guidelines" },
  { label: "Acceptable Use", href: "/acceptable-use" },
  { label: "Cookie Policy", href: "/cookies" },
] as const;

export function LegalPage({
  title,
  updated,
  intro,
  sections,
  currentPath,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
  currentPath: string;
}) {
  const related = LEGAL_PAGES.filter((p) => p.href !== currentPath);
  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <PublicHeader />

        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 32px" }}>
            <Reveal>
              <div className="cs-eyebrow">Legal</div>
              <h1 className="cs-display" style={{ margin: "10px 0 10px", fontSize: "clamp(34px, 4.6vw, 46px)", fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>Last updated {updated}</p>
              {intro && (
                <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.7, color: "var(--foreground)", opacity: 0.88 }}>{intro}</p>
              )}
            </Reveal>
          </div>
        </section>

        <article style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 56px" }}>
          {sections.map((s, i) => (
            <Reveal key={i}>
              <section style={{ marginTop: i === 0 ? 0 : 34 }}>
                <h2 className="cs-display" style={{ fontSize: 23, fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.015em", paddingBottom: 9, borderBottom: "1px solid var(--line)" }}>{s.heading}</h2>
                {s.paragraphs.map((p, j) => (
                  <p key={j} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--foreground)", opacity: 0.88, margin: "0 0 12px" }}>{p}</p>
                ))}
                {s.bullets && (
                  <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
                    {s.bullets.map((b, k) => (
                      <li key={k} style={{ position: "relative", paddingLeft: 22, fontSize: 15.5, lineHeight: 1.65, color: "var(--foreground)", opacity: 0.88 }}>
                        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 9, width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          ))}

          <Reveal>
            <section style={{ marginTop: 44, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
              <div className="cs-kicker" style={{ fontSize: 11, marginBottom: 14 }}>Related policies</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {related.map((p) => (
                  <Link key={p.href} href={p.href} style={{ fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--foreground)", textDecoration: "none", opacity: 0.85 }}>
                    {p.label}
                  </Link>
                ))}
              </div>
            </section>
          </Reveal>
        </article>

        <SiteFooter />
      </div>
    </main>
  );
}
