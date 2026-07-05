"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { BrandMark, BetaBadge } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import { AUDIENCES } from "./site-nav";

// One shared top nav for the entire marketing site (landing, blog, guides,
// waitlist, compare, audiences). Replaces the landing's inline pill AND the old
// PublicHeader so navigation never drifts between pages. Anchor links use the
// "/#id" form so they work from any route (jump home, then scroll).
//
// Desktop: a horizontal pill with a hover dropdown for Audiences.
// Mobile (<= 900px): the links collapse into a hamburger drawer so EVERY
// destination (incl. Audiences + the language toggle) stays reachable on a phone.

type Lang = "en" | "es";

const PRIMARY: { label: string; href: string }[] = [
  { label: "How it works", href: "/#how" },
  { label: "Marketplace", href: "/#marketplace" },
  { label: "Guides", href: "/guides" },
];

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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll + close on Escape while the mobile drawer is open.
  React.useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const openAud = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setAudOpen(true); };
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setAudOpen(false), 120); };
  const closeMenu = () => setMenuOpen(false);

  const cta = onGetStarted
    ? <button onClick={onGetStarted} className="cs-raise" style={solidBtnSm}>Join the waitlist</button>
    : <Link href="/waitlist" className="cs-raise" style={solidBtnSm}>Join the waitlist</Link>;

  const LangToggle = lang && setLang ? (
    <span data-no-i18n style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden" }}>
      {(["en", "es"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-label={l === "en" ? "English" : "Español"}
          style={{ padding: "6px 11px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "#fff" : "var(--muted)" }}>{l.toUpperCase()}</button>
      ))}
    </span>
  ) : null;

  return (
    <div style={{ position: "sticky", top: 14, zIndex: 50, display: "flex", justifyContent: "center", padding: "0 16px" }}>
      <header
        className={`cs-pill${scrolled ? " is-scrolled" : ""}`}
        style={{ borderRadius: 999, padding: "8px 10px 8px 13px", display: "inline-flex", alignItems: "center", gap: 9, maxWidth: "calc(100vw - 32px)" }}
      >
        <Link href="/" onClick={closeMenu} style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--foreground)" }}>
          <span className="cs-brand-ring" style={{ width: 30, height: 30 }}><BrandMark size={19} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
          <BetaBadge />
        </Link>

        <span style={navDivider} className="cs-pill-links" />

        <nav className="cs-pill-links" style={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Link href="/#how" style={navLink}>How it works</Link>
          <Link href="/#marketplace" style={navLink}>Marketplace</Link>

          {/* Audiences dropdown (desktop) */}
          <div style={{ position: "relative" }} onMouseEnter={openAud} onMouseLeave={scheduleClose}>
            <button aria-haspopup="true" aria-expanded={audOpen} onClick={() => setAudOpen((v) => !v)}
              style={{ ...navLink, display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Audiences
              <ChevronDown size={14} style={{ opacity: 0.7, transform: audOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {audOpen && (
              <div className="cs-panel" onMouseEnter={openAud} onMouseLeave={scheduleClose}
                style={{ position: "absolute", top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", width: 320, padding: 8, display: "grid", gap: 2 }}>
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

          <Link href="/guides" style={navLink}>Guides</Link>
        </nav>

        <span style={navDivider} className="cs-pill-links" />

        <span className="cs-pill-links">{LangToggle}</span>
        <span className="cs-pill-links" style={{ display: "inline-flex" }}><ThemeToggle size={31} /></span>
        <span className="cs-pill-cta">{cta}</span>

        {/* Language toggle stays visible in the pill on mobile (not buried in the
            drawer) — only when this page provides it (the landing). */}
        {LangToggle && <span className="cs-mobile-lang" style={{ display: "none", flexShrink: 0 }}>{LangToggle}</span>}

        {/* Hamburger (mobile only) */}
        <button
          className="cs-burger" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          style={{ display: "none", width: 38, height: 38, borderRadius: 999, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", cursor: "pointer", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          {menuOpen ? <X size={20} /> : (
            <span style={{ display: "grid", gap: 4 }}>
              <span style={burgerBar} /><span style={burgerBar} /><span style={burgerBar} />
            </span>
          )}
        </button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div onClick={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 48, background: "rgba(5,9,16,0.6)", backdropFilter: "blur(2px)" }} />
          <div className="cs-mobile-menu cs-panel" role="dialog" aria-label="Menu"
            style={{ position: "fixed", top: 70, left: 16, right: 16, zIndex: 49, padding: 12, maxHeight: "calc(100vh - 90px)", overflowY: "auto", display: "grid", gap: 4 }}>
            {PRIMARY.map((l) => (
              <Link key={l.href} href={l.href} onClick={closeMenu} className="cs-hover-row" style={mobileLink}>{l.label}</Link>
            ))}
            <div className="cs-kicker" style={{ padding: "14px 12px 6px", fontSize: 10.5 }}>Audiences</div>
            {AUDIENCES.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.slug} href={`/for/${a.slug}`} onClick={closeMenu} className="cs-hover-row"
                  style={{ display: "flex", gap: 11, alignItems: "center", padding: "11px 12px", textDecoration: "none", color: "var(--foreground)" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: "var(--accent-tint)", color: "var(--accent)", flexShrink: 0 }}><Icon size={16} /></span>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{a.nav}</span>
                </Link>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 12px 6px" }}>
              {LangToggle}
              <ThemeToggle size={34} />
            </div>
            <div style={{ padding: "6px 4px 4px" }} onClick={closeMenu}>
              {onGetStarted
                ? <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtnSm, width: "100%", justifyContent: "center", padding: "13px 0", fontSize: 15 }}>Join the waitlist</button>
                : <Link href="/waitlist" className="cs-raise" style={{ ...solidBtnSm, width: "100%", justifyContent: "center", padding: "13px 0", fontSize: 15 }}>Join the waitlist</Link>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const navLink: React.CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, padding: "8px 9px", borderRadius: 8, whiteSpace: "nowrap" };
const mobileLink: React.CSSProperties = { display: "block", padding: "12px 12px", fontSize: 15.5, fontWeight: 600, color: "var(--foreground)", textDecoration: "none" };
const solidBtnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 15px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
const navDivider: React.CSSProperties = { width: 1, height: 18, background: "var(--line)", margin: "0 3px", flexShrink: 0 };
const burgerBar: React.CSSProperties = { width: 18, height: 2, borderRadius: 2, background: "var(--foreground)" };
