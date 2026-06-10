"use client";

import { ScanLine, Sparkles, Send, ArrowRight, Camera, Tag, ShieldCheck, Check, Store } from "lucide-react";
import { BrandChip } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

// Public marketing page shown to unauthenticated visitors, so the product
// explains itself before asking anyone to sign up.
export function Landing({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(10px)", background: "color-mix(in srgb, var(--background) 82%, transparent)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <BrandChip size={32} />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
          <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <a href="#how" style={navLink}>How it works</a>
            <a href="#pricing" style={navLink}>Pricing</a>
            <a href="/guides" style={navLink}>Guides</a>
            <ThemeToggle size={36} />
            <button onClick={onSignIn} style={ghostBtn}>Sign in</button>
            <button onClick={onGetStarted} style={solidBtn}>Get started</button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 24px 64px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" }} className="cs-grid-2">
          <div>
            <span style={pill}><span style={pillDot} /> For salvage yards, mechanics & individual sellers</span>
            <h1 style={{ margin: "20px 0 0", fontSize: 52, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
              Photograph a part.<br /><span style={{ color: "var(--accent)" }}>List it in seconds.</span>
            </h1>
            <p style={{ margin: "20px 0 0", fontSize: 17, color: "var(--muted)", lineHeight: 1.6, maxWidth: 520 }}>
              Ahlam uses AI to identify each part, grade its condition, and price it — then formats listings you can post everywhere you sell. Snap a few photos and your inventory builds itself.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtn, padding: "13px 24px", fontSize: 15 }}>Start free <ArrowRight size={17} /></button>
              <a href="#how" style={{ ...ghostBtn, padding: "13px 22px", fontSize: 15 }}>See how it works</a>
            </div>
            <div style={{ marginTop: 18, fontSize: 13, color: "var(--muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Check size={14} color="var(--success)" /> No card to start</span>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Check size={14} color="var(--success)" /> Cancel anytime</span>
            </div>
          </div>
          {/* AI review card preview */}
          <div style={previewCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ScanLine size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>AI review card</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 16%, transparent)", borderRadius: 999, padding: "2px 9px" }}>Good</span>
            </div>
            {[["Part", "Alternator"], ["Fits", "2013–2017 Accord"], ["Condition", "Good · bench-tested"], ["Suggested", "$85"]].map(([k, v]) => (
              <div key={k} style={previewRow}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
            ))}
            <button onClick={onGetStarted} style={{ ...solidBtn, width: "100%", justifyContent: "center", marginTop: 14 }}><Send size={15} /> Post listing</button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={h2}>From photo to posted in three steps</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 32 }} className="cs-grid4">
          {[
            { icon: Camera, t: "1 · Snap photos", d: "Upload or use your camera — exterior, parts, dashboard. Up to 8 shots per vehicle." },
            { icon: Sparkles, t: "2 · AI does the work", d: "It identifies the vehicle and every part, grades condition, and suggests market prices." },
            { icon: Send, t: "3 · Post everywhere", d: "Review, tweak, and copy clean listings to Facebook, OfferUp, eBay & your storefront." },
          ].map((s) => (
            <div key={s.t} style={featCard}>
              <span style={featIcon}><s.icon size={20} color="var(--accent)" /></span>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>{s.t}</div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.55 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="cs-grid4">
            {[
              { icon: ScanLine, t: "AI grading", d: "Good/Poor condition calls with notes you can edit." },
              { icon: Tag, t: "Smart pricing", d: "Per-part and whole-car estimates from the photos." },
              { icon: Store, t: "Your storefront", d: "A public page buyers can browse and share." },
              { icon: ShieldCheck, t: "Private by default", d: "VIN & mileage stay hidden until you choose to share." },
            ].map((f) => (
              <div key={f.t}>
                <span style={featIcon}><f.icon size={18} color="var(--accent)" /></span>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 12 }}>{f.t}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={h2}>Simple pricing</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 15, marginTop: 8 }}>One plan. Everything included. Start with a free trial.</p>
        <div style={{ maxWidth: 420, margin: "32px auto 0", ...featCard, padding: 28, border: "1.5px solid var(--accent)" } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pro</div>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8 }}>$49<span style={{ fontSize: 16, fontWeight: 500, color: "var(--muted)" }}>/mo</span></div>
          <div style={{ display: "grid", gap: 9, margin: "18px 0 0" }}>
            {["Unlimited listings, vehicles & AI scans", "Cross-post to every marketplace", "Public shop storefront", "Team seats & roles", "Buyer messaging"].map((b) => (
              <div key={b} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13.5 }}><Check size={16} color="var(--success)" /> {b}</div>
            ))}
          </div>
          <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtn, width: "100%", justifyContent: "center", marginTop: 22, padding: "13px 0", fontSize: 15 }}>Start free trial <ArrowRight size={16} /></button>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <BrandChip size={28} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Ahlam</span>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>The marketplace for cars &amp; parts — every listing measured, every spec verified.</span>
          <a href="/guides" style={{ ...navLink, marginLeft: "auto" }}>Guides</a>
          <button onClick={onSignIn} style={ghostBtn}>Sign in</button>
        </div>
      </footer>
    </div>
  );
}

const navLink: React.CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, padding: "8px 10px" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const solidBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", background: "var(--accent-tint)", padding: "5px 13px", fontSize: 12.5, fontWeight: 600, color: "var(--accent)" };
const pillDot: React.CSSProperties = { width: 6, height: 6, borderRadius: 999, background: "var(--accent)", animation: "pulse-dot 1.8s infinite" };
const previewCard: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: 18, boxShadow: "0 30px 60px -30px rgba(0,0,0,0.7)" };
const previewRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", borderRadius: 9, padding: "10px 13px", fontSize: 13, marginTop: 8 };
const h2: React.CSSProperties = { textAlign: "center", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 };
const featCard: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: 22 };
const featIcon: React.CSSProperties = { display: "inline-grid", placeItems: "center", width: 42, height: 42, borderRadius: 11, background: "var(--accent-tint)" };
