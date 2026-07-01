import React from "react";
import Link from "next/link";
import { Mail, CalendarCheck } from "lucide-react";
import { BrandChip } from "./BrandMark";
import { AUDIENCES } from "./site-nav";

// Inline LinkedIn glyph (this project's pinned lucide-react build doesn't ship a
// Linkedin icon, so we draw it to avoid a dependency mismatch).
function LinkedinGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

// Shared marketing footer used across the landing and every public page, so the
// site footer never drifts. Server-component safe (plain links + mailto, no
// client handlers) so it drops into both server and client pages.

const CONTACT_PRIMARY = "andygarcia@ahlam.io";
const CONTACT = "mohammadabbas@ahlam.io";
const RECIPIENTS = "andygarcia@ahlam.io,mohammadabbas@ahlam.io";
const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";
const LINKEDIN_URL = "https://www.linkedin.com/company/ahlam-inc/";

type Col = { h: string; links: { label: string; href: string; external?: boolean }[] };

const COLS: Col[] = [
  { h: "Product", links: [
    { label: "How it works", href: "/#how" },
    { label: "Marketplace", href: "/#marketplace" },
  ] },
  { h: "Audiences", links: [
    { label: "Overview", href: "/audiences" },
    ...AUDIENCES.slice(0, 4).map((a) => ({ label: a.nav, href: `/for/${a.slug}` })),
  ] },
  { h: "Resources", links: [
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/#faq" },
    { label: "Waitlist", href: "/waitlist" },
  ] },
  { h: "Company", links: [
    { label: "Book a demo", href: CAL_DEMO_URL, external: true },
    { label: "Contact us", href: `mailto:${RECIPIENTS}`, external: true },
    { label: "Feedback", href: `mailto:${RECIPIENTS}?subject=Ahlam%20feedback`, external: true },
  ] },
];

export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", position: "relative", zIndex: 1, background: "var(--background)" }}>
      <div className="cs-footer-grid" style={{ maxWidth: 1080, margin: "0 auto", padding: "52px 24px 28px", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 32 }}>
        <div style={{ maxWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><BrandChip size={28} /><span style={{ fontSize: 16, fontWeight: 700 }}>Ahlam</span></div>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: "14px 0 0" }}>
            Photograph a car. List every part everywhere: eBay, Facebook, OfferUp, Craigslist, and your own storefront.
          </p>
          {/* Contact section */}
          <div style={{ marginTop: 18 }}>
            <div className="cs-kicker" style={{ fontSize: 11, marginBottom: 10 }}>Contact</div>
            <div style={{ display: "grid", gap: 7 }}>
              <a href={`mailto:${CONTACT_PRIMARY}`} style={{ ...footLink, display: "inline-flex", alignItems: "center", gap: 8, opacity: 1 }}>
                <Mail size={14} color="var(--accent)" /> {CONTACT_PRIMARY}
              </a>
              <a href={`mailto:${CONTACT}`} style={{ ...footLink, display: "inline-flex", alignItems: "center", gap: 8, opacity: 1 }}>
                <Mail size={14} color="var(--accent)" /> {CONTACT}
              </a>
              <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" style={{ ...footLink, display: "inline-flex", alignItems: "center", gap: 8, opacity: 1 }}>
                <CalendarCheck size={14} color="var(--accent)" /> Book a 15-min demo
              </a>
            </div>
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label="Ahlam on LinkedIn"
              style={{ marginTop: 12, display: "inline-grid", placeItems: "center", width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)" }}>
              <LinkedinGlyph size={16} />
            </a>
          </div>
        </div>
        {COLS.map((col) => (
          <div key={col.h}>
            <div className="cs-kicker" style={{ marginBottom: 14, fontSize: 11 }}>{col.h}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {col.links.map((l) =>
                l.external ? (
                  <a key={l.label} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                    style={footLink}>{l.label}</a>
                ) : (
                  <Link key={l.label} href={l.href} style={footLink}>{l.label}</Link>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>© {new Date().getFullYear()} Ahlam. All rights reserved.</span>
          <Link href="/waitlist" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Join the waitlist</Link>
        </div>
      </div>
    </footer>
  );
}

const footLink: React.CSSProperties = { fontSize: 13.5, color: "var(--foreground)", textDecoration: "none", opacity: 0.82, width: "fit-content" };
