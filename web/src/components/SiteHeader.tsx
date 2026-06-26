"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { BrandMark, BetaBadge } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import { AUDIENCES } from "./site-nav";

// One shared top nav for the entire marketing site (landing, blog, guides,
// waitlist, compare, audiences). Replaces the landing's inline pill AND the old
// PublicHeader so navigation never drifts between pages. Anchor links use the
// "/#id" form so they work from any route (jump home, then scroll).
//
// Language toggle is OPTIONAL: only the landing (wrapped in I18nProvider) passes
// lang/setLang, so the EN/ES control appears there; content pages omit it.

type Lang = "en" | "es";

export function SiteHeader({
  onGetStarted,
  lang,
  setLang,
}: {
  onGetStarted?: () => void;
  lang?: Lang;
  setLang?: (l: Lang) => void;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  const [audOpen, setAudOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openAud = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setAudOpen(true); };
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setAudOpen(false), 120); };

  const cta = onGetStarted
    ? <button onClick={onGetStarted} className="cs-raise" style={solidBtnSm}>Join the waitlist</button>
    : <Link href="/waitlist" className="cs-raise" style={solidBtnSm}>Join the waitlist</Link>;

  return (
    <div style={{ position: "sticky", top: 14, zIndex: 40, display: "flex", justifyContent: "center", padding: "0 16px" }}>
      <header
        className={`cs-pill${scrolled ? " is-scrolled" : ""}`}
        style={{ borderRadius: 999, padding: "8px 10px 8px 13px", display: "inline-flex", alignItems: "center", gap: 9 }}
      >
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--foreground)" }}>
          <span className="cs-brand-ring" style={{ width: 30, height: 30 }}><BrandMark size={19} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
          <BetaBadge />
        </Link>

        <span style={navDivider} className="cs-pill-links" />

        <nav className="cs-pill-links" style={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Link href="/#how" style={navLink}>How it works</Link>
          <Link href="/#marketplace" style={navLink}>Marketplace</Link>

          {/* Audiences dropdown */}
          <div style={{ position: "relative" }} onMouseEnter={openAud} onMouseLeave={scheduleClose}>
            <button
              aria-haspopup="true" aria-expanded={audOpen}
              onClick={() => setAudOpen((v) => !v)}
              style={{ ...navLink, display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Audiences
              <ChevronDown size={14} style={{ opacity: 0.7, transform: audOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {audOpen && (
              <div
                className="cs-panel"
                onMouseEnter={openAud} onMouseLeave={scheduleClose}
                style={{ position: "absolute", top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", width: 320, padding: 8, display: "grid", gap: 2 }}
              >
                {AUDIENCES.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link key={a.slug} href={`/for/${a.slug}`} className="cs-hover-row" onClick={() => setAudOpen(false)}
                      style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "10px 11px", textDecoration: "none", color: "var(--foreground)" }}>
                      <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: "var(--accent-tint)", color: "var(--accent)", flexShrink: 0, marginTop: 1 }}><Icon size={16} /></span>
                      <span>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>{a.nav}</span>
                        <span style={{ display: "block", fontSize: 12, color: "var(--muted)", lineHeight: 1.4, marginTop: 2 }}>{a.tagline}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Link href="/compare" style={navLink}>Compare</Link>
          <Link href="/guides" style={navLink}>Guides</Link>
          <Link href="/blog" style={navLink}>Blog</Link>
        </nav>

        <span style={navDivider} />

        {lang && setLang && (
          <span data-no-i18n style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden" }} className="cs-pill-links">
            {(["en", "es"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-label={l === "en" ? "English" : "Español"}
                style={{ padding: "6px 9px", fontSize: 11.5, fontWeight: 700, border: "none", cursor: "pointer", background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "#fff" : "var(--muted)" }}>{l.toUpperCase()}</button>
            ))}
          </span>
        )}

        <ThemeToggle size={31} />
        {cta}
      </header>
    </div>
  );
}

const navLink: React.CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, padding: "8px 9px", borderRadius: 8, whiteSpace: "nowrap" };
const solidBtnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 15px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
const navDivider: React.CSSProperties = { width: 1, height: 18, background: "var(--line)", margin: "0 3px", flexShrink: 0 };
