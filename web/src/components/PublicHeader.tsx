import Link from "next/link";
import { BrandMark, BetaBadge } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

// Shared top nav for the public, no-auth pages (guides, waitlist, listing, shop,
// profile) so they read as part of ahlam.io, not orphaned microsites. Mirrors the
// landing's floating glass pill EXACTLY (same compact centred pill, brand ring,
// links, theme toggle, and Sign in / Get started). Server component: the Sign in /
// Get started actions are links into the app (which handles auth) rather than the
// landing's client handlers. Kept static (is-scrolled) since there's no scroll
// handler on these pages.
export function PublicHeader() {
  return (
    <div style={{ position: "sticky", top: 14, zIndex: 30, display: "flex", justifyContent: "center", padding: "0 16px" }}>
      <header className="cs-pill is-scrolled" style={{ borderRadius: 999, padding: "8px 10px 8px 13px", display: "inline-flex", alignItems: "center", gap: 9 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--foreground)" }}>
          <span className="cs-brand-ring" style={{ width: 30, height: 30 }}><BrandMark size={19} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
          <BetaBadge />
        </Link>
        <span style={navDivider} className="cs-pill-links" />
        <nav className="cs-pill-links" style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Link href="/guidance" style={navLink}>How it works</Link>
          <Link href="/guides" style={navLink}>Guides</Link>
          <Link href="/blog" style={navLink}>Blog</Link>
          <Link href="/waitlist" style={{ ...navLink, color: "var(--accent)", background: "var(--accent-tint)", fontWeight: 700 }}>Waitlist</Link>
        </nav>
        <span style={navDivider} />
        <ThemeToggle size={31} />
        <Link href="/?signin=1" style={ghostBtnSm} className="cs-pill-links">Sign in</Link>
        <Link href="/?signin=1" className="cs-raise" style={solidBtnSm}>Get started</Link>
      </header>
    </div>
  );
}

const navLink: React.CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, padding: "8px 10px", borderRadius: 8 };
const ghostBtnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, textDecoration: "none" };
const solidBtnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 15px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" };
const navDivider: React.CSSProperties = { width: 1, height: 18, background: "color-mix(in srgb, var(--foreground) 14%, transparent)", margin: "0 3px", flexShrink: 0 };
