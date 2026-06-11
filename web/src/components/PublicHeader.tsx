import Link from "next/link";
import { BrandChip } from "./BrandMark";

// Shared top nav for the public, no-auth pages (guides, listing, shop, profile)
// so they read as part of ahlam.io — not orphaned microsites. Server component:
// plain links only (the landing's Sign in / Get started buttons need client
// handlers, so here they're links into the app, which handles auth).
export function PublicHeader() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(10px)", background: "color-mix(in srgb, var(--background) 82%, transparent)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--foreground)" }}>
          <BrandChip size={28} />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
        </Link>
        <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <Link href="/#how" style={navLink} className="cs-hide-mobile">How it works</Link>
          <Link href="/#pricing" style={navLink} className="cs-hide-mobile">Pricing</Link>
          <Link href="/guides" style={navLink}>Guides</Link>
          <Link href="/" style={solidBtn}>Open Ahlam</Link>
        </nav>
      </div>
    </header>
  );
}

const navLink: React.CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, padding: "8px 10px" };
const solidBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, textDecoration: "none" };
