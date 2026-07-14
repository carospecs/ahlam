"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

// Shared top nav for the public, no-auth pages (guides, listing, shop, profile).
// Signed-out visitors get the landing-style pill (links + Sign in / Get started).
// Signed-in users get a minimal pill instead: Back to wherever they came from
// (usually Messages) — no marketing links, no sign-in prompts. While the session
// is still unknown we render the neutral middle so a signed-in user never sees
// a "Sign in" flash.
export function PublicHeader() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    import("@/lib/supabase-browser")
      .then(({ supabaseBrowser }) => supabaseBrowser().auth.getSession())
      .then(({ data }) => { if (alive) setSignedIn(!!data.session); })
      .catch(() => { if (alive) setSignedIn(false); });
    return () => { alive = false; };
  }, []);

  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  }

  return (
    <div style={{ position: "sticky", top: 14, zIndex: 30, display: "flex", justifyContent: "center", padding: "0 16px" }}>
      <header className="cs-pill is-scrolled" style={{ borderRadius: 999, padding: "8px 10px 8px 13px", display: "inline-flex", alignItems: "center", gap: 9 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--foreground)" }}>
          <span className="cs-brand-ring" style={{ width: 30, height: 30 }}><BrandMark size={19} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
        </Link>
        {signedIn ? (
          <>
            <span style={navDivider} />
            <ThemeToggle size={31} />
            <button onClick={back} style={{ ...ghostBtnSm, cursor: "pointer", fontFamily: "inherit" }}>
              <ArrowLeft size={14} /> Back
            </button>
          </>
        ) : signedIn === false ? (
          <>
            <span style={navDivider} className="cs-pill-links" />
            <nav className="cs-pill-links" style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Link href="/guidance" style={navLink}>How it works</Link>
              <Link href="/guides" style={navLink}>Guides</Link>
            </nav>
            <span style={navDivider} />
            <ThemeToggle size={31} />
            <Link href="/?signin=1" style={ghostBtnSm} className="cs-pill-links">Sign in</Link>
            <Link href="/?signup=1" className="cs-raise" style={solidBtnSm}>Get started</Link>
          </>
        ) : (
          <>
            <span style={navDivider} />
            <ThemeToggle size={31} />
          </>
        )}
      </header>
    </div>
  );
}

const navLink: CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, padding: "8px 10px", borderRadius: 8 };
const ghostBtnSm: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, textDecoration: "none" };
const solidBtnSm: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 15px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" };
const navDivider: CSSProperties = { width: 1, height: 18, background: "color-mix(in srgb, var(--foreground) 14%, transparent)", margin: "0 3px", flexShrink: 0 };
