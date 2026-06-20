"use client";

import React from "react";
import { motion, AnimatePresence, MotionConfig, useScroll, useMotionValueEvent, useTransform, type Variants } from "framer-motion";
import { ScanLine, Sparkles, Send, ArrowRight, Tag, ShieldCheck, Check, ChevronDown, CalendarCheck, Mail, MessageSquare, Compass, Wrench, DollarSign, Brain, Download, ShoppingBag, BarChart3, Users, Building2, X } from "lucide-react";
import { BrandChip, BrandMark, BetaBadge } from "./BrandMark";
import { LaunchCountdown } from "./LaunchCountdown";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "./ThemeToggle";
import { CONDITION_COLOR } from "./data";
import { PricingPlans } from "./PricingPlans";

// Public marketing page shown to unauthenticated visitors, so the product
// explains itself before asking anyone to sign up. Motion is gated behind
// prefers-reduced-motion via MotionConfig + the global CSS guard.

const EASE = [0.22, 0.8, 0.26, 1] as const;

// Contact inbox for the demo/contact/feedback buttons. Swap for a real shared
// inbox or a booking link (Calendly, Cal.com) when ready.
const CONTACT_EMAIL = "mohammadabbas@ahlam.io";
// Mail goes to both founders (comma-separated for mailto; separate params for Gmail).
const CONTACT_RECIPIENTS = "mohammadabbas@ahlam.io,andygarcia@ahlam.io";
// Gmail compose URL (opens in browser instead of default mail client).
const GMAIL_COMPOSE = (to: string, subject: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;
// "Book a demo" opens the Cal.com team scheduling page.
const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";

const FAQS = [
  { q: "Do I need to know parts to use it?", a: "No. That is the point. Photograph the car and the AI names every sellable part, grades its condition, and prices it. You review and post." },
  { q: "How accurate is the pricing?", a: "We look up what the same part actually sells for across eBay, Facebook, and OfferUp, then suggest the median of those real sales. We use the median, not the average, so a few suspiciously cheap listings (often stolen or knock-off parts) can't drag your price down. Every number is editable, and you can see how confident the AI is on each one." },
  { q: "Which marketplaces can I post to?", a: "Auto-post to eBay, and one-tap copy clean listings for Facebook Marketplace, OfferUp, Craigslist, and Car-Part.com, plus your own Ahlam storefront." },
  { q: "Can I list a part or car manually?", a: "Yes. AI scanning is the fast path, but you can type in a vehicle or a single part by hand any time, with the AI helping write and price it." },
  { q: "Is my VIN and mileage private?", a: "Yes. VIN and mileage are read for accuracy but stay hidden on public listings until you choose to share them." },
  { q: "What does it cost to start?", a: "Nothing. Start free with no card. The Pro plan is one flat monthly price with everything included." },
];

// Sample marketplace listings for the public landing — varied vehicles and a
// deliberate mix of A/B/C grades so the grade system is visible at a glance.
// Demo data only; the real grid is powered by live listings in the app.
const MARKET_SAMPLE: { part: string; side?: string; vehicle: string; grade: "A" | "B" | "C"; price: number; views: number; loc: string; img?: string }[] = [
  { part: "Front Bumper Cover", vehicle: "2018 Honda Civic", grade: "A", price: 240, views: 142, loc: "Long Beach, CA", img: "/marketplace/bumper.webp" },
  { part: "Tailgate Assembly", vehicle: "2013 Ford F-150", grade: "B", price: 410, views: 318, loc: "Phoenix, AZ" },
  { part: "Hood", vehicle: "2016 Chevy Silverado", grade: "C", price: 120, views: 73, loc: "Houston, TX", img: "/marketplace/hood.webp" },
  { part: "Headlight Assembly", side: "Right", vehicle: "2019 Toyota RAV4", grade: "A", price: 185, views: 96, loc: "Dallas, TX", img: "/marketplace/headlight.webp" },
  { part: "Alloy Wheel (Set of 4)", vehicle: "2017 Toyota Camry", grade: "B", price: 300, views: 204, loc: "Atlanta, GA", img: "/marketplace/wheel.webp" },
  { part: "Engine 2.4L", vehicle: "2015 Nissan Altima", grade: "C", price: 880, views: 58, loc: "Denver, CO", img: "/marketplace/engine.webp" },
];

// Real marketplace logo glyphs (single-path, rendered monochrome) for the
// "works with" strip. Brand marks shown only to indicate integrations.
const LOGO_GOOGLE = "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z";

function Glyph({ d, size = 26, color }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} aria-hidden="true" style={{ display: "block" }}>
      <path d={d} />
    </svg>
  );
}

// Real brand logo (SVG file in /public/logos), rendered at a fixed height.
function LogoImg({ src, alt, h = 24 }: { src: string; alt: string; h?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} style={{ height: h, width: "auto", display: "block" }} />;
}

const reveal: Variants = {
  // Quick opacity-only fade — no slide/blur — so content is "just there" during
  // fast scroll instead of animating into place (which read as lag).
  hidden: { opacity: 0 },
  show: (i = 0) => ({ opacity: 1, transition: { duration: 0.25, ease: EASE, delay: i * 0.03 } }),
};

// Scroll-reveal wrapper: a gentle lift into view once. Trigger margin is positive
// so a section starts animating slightly BEFORE its top reaches the viewport,
// which keeps content from ever reading as an empty/blurred void while scrolling.
function Reveal({ children, i = 0, style, className }: { children: React.ReactNode; i?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <motion.div variants={reveal} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "120px 0px" }} style={style} className={className}>
      {children}
    </motion.div>
  );
}

export function Landing({ onGetStarted }: { onGetStarted: () => void; onSignIn?: () => void }) {
  const { lang, setLang } = useI18n();
  const [scrolled, setScrolled] = React.useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));
  const previewY = useTransform(scrollY, [0, 500], [0, -46]);

  return (
    <MotionConfig reducedMotion="always">
      <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
        {/* Animated aurora wash (fixed + clipped, so it never adds page scroll) */}
        <div className="aurora" aria-hidden="true">
          <div className="aurora-blob aurora-1" />
          <div className="aurora-blob aurora-2" />
          <div className="aurora-blob aurora-3" />
        </div>

        <div className="cs-landing-body" style={{ position: "relative", zIndex: 1 }}>
          {/* Floating pill nav: compact, centered, follows on scroll, gently compacts */}
          <div style={{ position: "sticky", top: 14, zIndex: 30, display: "flex", justifyContent: "center", padding: "0 16px" }}>
            <motion.header
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0, scale: scrolled ? 0.97 : 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className={`cs-pill${scrolled ? " is-scrolled" : ""}`}
              style={{ borderRadius: 999, padding: "8px 10px 8px 13px", display: "inline-flex", alignItems: "center", gap: 9 }}
            >
              <span className="cs-brand-ring" style={{ width: 30, height: 30 }}><BrandMark size={19} /></span>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
              <BetaBadge />
              <span style={navDivider} className="cs-pill-links" />
              <nav className="cs-pill-links" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <a href="#how" style={navLink}>How it works</a>
                <a href="#marketplace" style={navLink}>Marketplace</a>
                <a href="#pricing" style={navLink}>Pricing</a>
                <a href="/guides" style={navLink}>Guides</a>
                <a href="/waitlist" style={{ ...navLink, color: "var(--accent)", background: "var(--accent-tint)", fontWeight: 700 }}>Waitlist</a>
              </nav>
              <span style={navDivider} />
              <span data-no-i18n style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden" }}>
                {(["en", "es"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)} aria-label={l === "en" ? "English" : "Español"} style={{ padding: "6px 9px", fontSize: 11.5, fontWeight: 700, border: "none", cursor: "pointer", background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "#fff" : "var(--muted)" }}>{l.toUpperCase()}</button>
                ))}
              </span>
              <ThemeToggle size={31} />
              <button onClick={onGetStarted} className="cs-raise" style={solidBtnSm}>Join the waitlist</button>
            </motion.header>
          </div>

          {/* Hero: side-by-side (copy left, AI review card right) */}
          <section style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="cs-hero-grid" style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px 80px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" }}>
              <div>
                <motion.span variants={reveal} custom={0} initial="hidden" animate="show" className="cs-eyebrow" style={{ display: "inline-block" }}>
                  For anyone buying or selling cars or parts, new or used
                </motion.span>
                <motion.h1 className="cs-display" variants={reveal} custom={1} initial="hidden" animate="show" style={{ margin: "20px 0 0", fontSize: "clamp(40px, 4.9vw, 60px)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
                  Photograph a car.<br />
                  <span className="accent">List every part in seconds.</span>
                </motion.h1>
                <motion.p variants={reveal} custom={2} initial="hidden" animate="show" style={{ margin: "22px 0 0", fontSize: 17, color: "var(--muted)", lineHeight: 1.6, maxWidth: 520 }}>
                  Ahlam&apos;s AI identifies every part, grades its condition, and prices it straight from your photos. Then with a few clicks, it posts straight to eBay, with Facebook and OfferUp coming soon. The hours you spend cataloging and typing listings are gone.
                </motion.p>
                <motion.div variants={reveal} custom={3} initial="hidden" animate="show" style={{ display: "flex", gap: 20, marginTop: 32, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtn, padding: "14px 26px", fontSize: 15.5 }}>Start free <ArrowRight size={17} /></button>
                  <a href="#how" className="cs-textlink" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>See how it works <ArrowRight size={15} style={{ opacity: 0.6 }} /></a>
                </motion.div>
                <motion.div variants={reveal} custom={4} initial="hidden" animate="show" style={{ marginTop: 20, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <PoweredByGoogle />
                  <span style={{ fontSize: 13, color: "var(--muted)", display: "inline-flex", gap: 6, alignItems: "center" }}><Check size={14} color="var(--success)" /> Free first month, no card</span>
                </motion.div>
              </div>

              <motion.div style={{ y: previewY }} initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}>
                <ReviewCard onPost={onGetStarted} float />
              </motion.div>
            </div>
          </section>

          {/* Beta notice: free trial + roadmap, sets expectations honestly */}
          <section style={{ borderBottom: "1px solid var(--line)" }}>
            <Reveal style={{ maxWidth: 900, margin: "0 auto", padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13, justifyContent: "center", flexWrap: "wrap", background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)", borderRadius: 14, padding: "15px 22px" }}>
                <span style={{ marginTop: 1 }}><BetaBadge size={11} /></span>
                <span style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, maxWidth: 720 }}>
                  <strong style={{ color: "var(--foreground)" }}>Ahlam is in beta.</strong> Posting to eBay is live now. Facebook, OfferUp, and more are in development. We launch right after the Fourth of July weekend, starting with yards in California and Texas. The first 50 yards to join the waitlist get a full month free with every feature unlocked; later sign-ups get more limited perks.
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11, marginTop: 18 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>Launching in</span>
                <LaunchCountdown />
              </div>
            </Reveal>
          </section>

          {/* Partner logos: static row, all visible, logo stacked above the name */}
          <section style={{ borderBottom: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px" }}>
              <Reveal style={{ textAlign: "center", marginBottom: 26 }}>
                <div className="cs-eyebrow">Posts to the places buyers already shop</div>
              </Reveal>
              <div className="cs-marquee">
                <div className="cs-marquee-track">
                  {[0, 1].map((dup) => (
                    <React.Fragment key={dup}>
                      {PARTNERS.map((p) => (
                        <div key={p.caption + dup} style={{ flexShrink: 0 }}>
                          <Partner logo={p.logo} caption={p.caption} />
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* How it works: step-by-step with bespoke visuals */}
          <section id="how" style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px 40px" }}>
            <Reveal style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
              <div className="cs-eyebrow">How it works</div>
              <h2 className="cs-display" style={h2}>From a photo to posted, in four steps</h2>
              <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
                Snap photos and let the AI do the cataloging, grading, and pricing. Prefer to type it in? Manual entry is there whenever you want it.
              </p>
            </Reveal>

            <div style={{ display: "grid", gap: 22, marginTop: 48 }}>
              {STEPS.map((s, i) => (
                <Step key={s.title} index={i} eyebrow={s.eyebrow} title={s.title} body={s.body} visual={s.visual()} flip={i % 2 === 1} />
              ))}
            </div>
          </section>

          {/* Features */}
          <section style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--surface) 40%, transparent)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px" }}>
              <Reveal style={{ textAlign: "center", marginBottom: 36 }}>
                <div className="cs-eyebrow">Built for sellers</div>
                <h2 className="cs-display" style={h2}>Everything the listing takes, automated</h2>
              </Reveal>
              <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {[
                  { icon: ScanLine, t: "AI grading", d: "A, B, and C condition grades with notes you can edit." },
                  { icon: Send, t: "Cross-post everywhere", d: "Auto-post to eBay and one-tap prep for Facebook, OfferUp, and Craigslist." },
                  { icon: Tag, t: "Smart pricing", d: "Each price is the median of what the same part actually sells for across eBay, Facebook, and OfferUp." },
                  { icon: ShieldCheck, t: "Private by default", d: "VIN and mileage stay hidden until you choose to share." },
                ].map((f, i) => (
                  <motion.div key={f.t}
                    initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
                    transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
                    whileHover={{ y: -6 }}
                    className="cs-glass" style={{ borderRadius: "var(--radius-lg)", padding: 22, height: "100%", position: "relative", overflow: "hidden" }}
                  >
                    <span aria-hidden="true" style={{ position: "absolute", top: 0, left: 22, right: 22, height: 2, background: "linear-gradient(90deg, transparent, var(--accent), transparent)", opacity: 0.55 }} />
                    <span style={featIconBig}><f.icon size={21} color="var(--accent)" /></span>
                    <div className="cs-display" style={{ fontSize: 19, fontWeight: 600, marginTop: 16, paddingBottom: 9, borderBottom: "1px solid var(--line)" }}>{f.t}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.55 }}>{f.d}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Marketplace — the two-sided buy & sell side of Ahlam */}
          <section id="marketplace" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px" }}>
              <Reveal style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 14px" }}>
                <div className="cs-eyebrow">Marketplace</div>
                <h2 className="cs-display" style={h2}>A marketplace that works <span className="accent">both ways</span></h2>
                <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
                  Sellers list parts in seconds with the AI. Buyers search every yard&apos;s inventory in one place and message the seller direct, with no middleman and no off-platform hand-off.
                </p>
              </Reveal>

              {/* Buyer / seller split pills */}
              <Reveal i={1} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", margin: "0 0 34px" }}>
                <div className="cs-glass" style={{ display: "inline-flex", alignItems: "center", gap: 9, borderRadius: 999, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 }}>
                  <Compass size={16} color="var(--accent)" /> For buyers: find the exact part
                </div>
                <div className="cs-glass" style={{ display: "inline-flex", alignItems: "center", gap: 9, borderRadius: 999, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 }}>
                  <ShoppingBag size={16} color="var(--accent)" /> For sellers: reach every buyer
                </div>
              </Reveal>

              {/* Mock browse search bar */}
              <Reveal i={2} style={{ maxWidth: 760, margin: "0 auto 22px" }}>
                <div className="cs-glass" style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 999, padding: "12px 18px" }}>
                  <Compass size={18} color="var(--muted)" />
                  <span style={{ color: "var(--muted)", fontSize: 14.5 }}>Search “2014 Honda Accord front bumper”, a VIN, or a part number…</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Browse</span>
                </div>
              </Reveal>

              {/* Live-listing grid (buyer view) */}
              <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {MARKET_SAMPLE.map((l, i) => (
                  <motion.div key={l.part + l.vehicle}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "80px 0px" }}
                    transition={{ delay: (i % 3) * 0.08, duration: 0.5, ease: EASE }}
                    whileHover={{ y: -5 }}
                    className="cs-glass" style={{ borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: CONDITION_COLOR[l.grade], background: `color-mix(in srgb, ${CONDITION_COLOR[l.grade]} 16%, transparent)` }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: CONDITION_COLOR[l.grade] }} /> Grade {l.grade}
                      </span>
                      <span className="cs-display" style={{ fontSize: 21, fontWeight: 700 }}>${l.price}</span>
                    </div>
                    {/* part photo (representative), with a graceful placeholder fallback */}
                    <div className="photo-cell" style={{ height: 100, borderRadius: 10, background: "color-mix(in srgb, var(--surface2) 70%, transparent)", display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
                      <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 120% at 0% 0%, color-mix(in srgb, ${CONDITION_COLOR[l.grade]} 14%, transparent), transparent 60%)` }} />
                      {l.img
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={l.img} alt={`${l.side ? `${l.side} ` : ""}${l.part} — ${l.vehicle}`} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        : <ShoppingBag size={26} color="var(--muted)" style={{ opacity: 0.4 }} />}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{l.side ? `${l.side} ` : ""}{l.part}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Fits {l.vehicle}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.views} views · {l.loc}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
                        <MessageSquare size={13} /> Message
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Reveal i={1} style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
                <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtn, padding: "13px 24px", fontSize: 15 }}>Browse the marketplace <ArrowRight size={17} /></button>
              </Reveal>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 24px" }}>
            <Reveal style={{ textAlign: "center" }}>
              <div className="cs-eyebrow">Pricing</div>
              <h2 className="cs-display" style={h2}>Simple, transparent pricing</h2>
              <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 10 }}>Free for the first 50 yards: a full month, up to 2 cars, every feature unlocked. No card to begin, cancel anytime.</p>
            </Reveal>
            <Reveal i={1} style={{ maxWidth: 1180, margin: "34px auto 0" }}>
              <PricingPlans onChoose={onGetStarted} />
            </Reveal>
            <Reveal i={2} style={{ maxWidth: 680, margin: "30px auto 0", textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.65 }}>
                <strong style={{ color: "var(--foreground)" }}>No email or website? Most dismantlers don&apos;t.</strong> On the Ultimate plan we build and host one for you (a professional site, custom domain, and business email) so customers can find you, reach you, and keep coming back.
              </p>
            </Reveal>
          </section>

          {/* How Ahlam works (capability graph) */}
          <section id="works" style={{ borderTop: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 24px" }}>
              <Reveal style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 40px" }}>
                <div className="cs-eyebrow">How Ahlam works</div>
                <h2 className="cs-display" style={h2}>Everything it takes to sell, in one place</h2>
                <p style={{ color: "var(--muted)", fontSize: 16.5, lineHeight: 1.6, marginTop: 14 }}>
                  From scanning and pricing to messaging, orders, and analytics, Ahlam runs the whole operation. Tap any capability to see what it does.
                </p>
              </Reveal>
              <Reveal i={1} style={{ maxWidth: 760, margin: "0 auto" }}><BrainVisual /></Reveal>
              <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 28 }}>
                {[
                  { icon: Wrench, t: "Knows every part", d: "Names and grades every sellable part straight from a photo." },
                  { icon: Tag, t: "Priced from real sales", d: "The median of what the same part sells for across platforms. Not a guess, and not dragged down by lowball listings." },
                  { icon: DollarSign, t: "Learns from your sales", d: "Every sale you make sharpens the next price it suggests." },
                  { icon: Send, t: "Connected everywhere", d: "One brain behind every marketplace you list on." },
                ].map((f, i) => (
                  <Reveal key={f.t} i={i}>
                    <div style={{ padding: "18px 4px", height: "100%" }}>
                      <span style={featIconBig}><f.icon size={20} color="var(--accent)" /></span>
                      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 13 }}>{f.t}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.55 }}>{f.d}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ / questions */}
          <section id="faq" style={{ borderTop: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px" }}>
              <Reveal style={{ textAlign: "center", marginBottom: 32 }}>
                <div className="cs-eyebrow">Questions</div>
                <h2 className="cs-display" style={h2}>Answers before you ask</h2>
              </Reveal>
              <FAQ />
            </div>
          </section>

          {/* Book a demo / contact / feedback */}
          <section id="contact" style={{ borderTop: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 24px" }}>
              <Reveal>
                <div className="cs-glass" style={{ borderRadius: "var(--radius-xl)", padding: "44px 32px", textAlign: "center", border: "1.5px solid color-mix(in srgb, var(--accent) 32%, var(--line))" }}>
                  <div className="cs-eyebrow">Get in touch</div>
                  <h2 className="cs-display" style={{ ...h2, margin: "10px 0 0" }}>See Ahlam on your own inventory</h2>
                  <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, margin: "12px auto 0", maxWidth: 520 }}>
                    Book a quick walkthrough, reach out with a question, or take a look around. We answer fast.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
                    <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" className="cs-raise" style={{ ...solidBtn, padding: "13px 24px", fontSize: 15 }}><CalendarCheck size={17} /> Book a demo</a>
                    <button onClick={() => window.open(GMAIL_COMPOSE(CONTACT_RECIPIENTS, "Ahlam question"), "_blank", "noopener")} style={{ ...ghostBtn, padding: "13px 22px", fontSize: 15, cursor: "pointer" }}><Mail size={16} /> Contact us</button>
                    <a href="#how" style={{ ...ghostBtn, padding: "13px 22px", fontSize: 15 }}><Compass size={16} /> Explore the product</a>
                  </div>
                  <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line)", fontSize: 14, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <MessageSquare size={15} color="var(--accent)" /> Have feedback or a feature request?
                    <button onClick={() => window.open(GMAIL_COMPOSE(CONTACT_RECIPIENTS, "Ahlam feedback"), "_blank", "noopener")} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600, cursor: "pointer", background: "none", border: "none", fontSize: 14, fontFamily: "inherit", padding: 0 }}>Tell us what you think</button>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <footer style={{ borderTop: "1px solid var(--line)" }}>
            <div className="cs-footer-grid" style={{ maxWidth: 1080, margin: "0 auto", padding: "52px 24px 28px", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 36 }}>
              <div style={{ maxWidth: 300 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}><BrandChip size={28} /><span style={{ fontSize: 16, fontWeight: 700 }}>Ahlam</span></div>
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: "14px 0 0" }}>Snap a photo. List every part everywhere: eBay, Facebook, OfferUp, Craigslist, and your own storefront.</p>
                <div style={{ marginTop: 16 }}><PoweredByGoogle /></div>
              </div>
              {[
                { h: "Product", links: [["How it works", "#how"], ["Pricing", "#pricing"], ["The brain", "#faq"], ["Get started", "#"]] },
                { h: "Resources", links: [["Guides", "/guides"], ["FAQ", "#faq"], ["Waitlist", "/waitlist"]] },
                { h: "Company", links: [
                  ["Book a demo", CAL_DEMO_URL, true],
                  ["Contact us", null, false, () => window.open(GMAIL_COMPOSE(CONTACT_RECIPIENTS, "Ahlam question"), "_blank", "noopener")],
                  ["Feedback", null, false, () => window.open(GMAIL_COMPOSE(CONTACT_RECIPIENTS, "Ahlam feedback"), "_blank", "noopener")],
                ]},
              ].map((col) => (
                <div key={col.h}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>{col.h}</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {col.links.map((link) => {
                      const [label, href, external, onClick] = link;
                      if (onClick) return (
                        <button key={label} onClick={onClick} style={{ fontSize: 13.5, color: "var(--foreground)", textDecoration: "none", opacity: 0.82, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", padding: 0, width: "fit-content" }}>{label}</button>
                      );
                      if (external) return (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, color: "var(--foreground)", textDecoration: "none", opacity: 0.82, width: "fit-content" }}>{label}</a>
                      );
                      return (
                        <a key={label} href={href} style={{ fontSize: 13.5, color: "var(--foreground)", textDecoration: "none", opacity: 0.82, width: "fit-content" }}>{label}</a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--line)" }}>
              <div style={{ maxWidth: 1080, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>© {new Date().getFullYear()} Ahlam. All rights reserved.</span>
                <a href="mailto:andygarcia@ahlam.io" style={{ ...navLink, marginLeft: "auto" }}>andygarcia@ahlam.io</a>
                <a href={`mailto:${CONTACT_RECIPIENTS}`} style={navLink}>{CONTACT_EMAIL}</a>
                <a href="/waitlist" style={ghostBtnSm}>Join the waitlist</a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}

// "AI powered by Google" badge (Gemini behind the scenes, surfaced as Google AI).
function PoweredByGoogle() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 9px", borderRadius: 999, border: "1px solid var(--line)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
      <Glyph d={LOGO_GOOGLE} size={15} color="#4285F4" /> AI powered by Google
    </span>
  );
}

// One partner: the brand logo stacked above a short category name.
function Partner({ logo, caption }: { logo: React.ReactNode; caption: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, color: "var(--muted)", minWidth: 84 }}>
      <div style={{ height: 26, display: "flex", alignItems: "center" }}>{logo}</div>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", opacity: 0.85 }}>{caption}</span>
    </div>
  );
}

const PARTNERS: { logo: React.ReactNode; caption: string }[] = [
  { logo: <LogoImg src="/logos/ebay.svg" alt="eBay" h={28} />, caption: "eBay" },
  { logo: <LogoImg src="/logos/facebook.svg" alt="Facebook Marketplace" h={26} />, caption: "Facebook Marketplace" },
  { logo: <LogoImg src="/logos/offerup.svg" alt="OfferUp" h={22} />, caption: "OfferUp" },
  { logo: <LogoImg src="/logos/craigslist.svg" alt="Craigslist" h={19} />, caption: "Craigslist" },
  // Car-Part.com's logo is dark ink on white, so it sits on a small white chip to
  // stay legible on the dark strip (and true to brand colors).
  { logo: <span style={{ background: "#fff", borderRadius: 7, padding: "4px 8px", display: "inline-flex", alignItems: "center" }}><LogoImg src="/logos/carpart.jpg" alt="Car-Part.com" h={17} /></span>, caption: "Car-Part.com" },
];

// "How Ahlam works": the core node drops in, then each capability builds out one
// line + node at a time. Click a node for a two-line explainer.
const BRAIN_NODES = [
  { label: "Scanning", icon: ScanLine, x: 50, y: 13, desc: "Photograph a car and the AI finds every sellable part. No parts expert on staff required." },
  { label: "Listing", icon: Tag, x: 74, y: 20, desc: "Clean, ready-to-post listings written for you, with titles, fitment, condition, and sorted photos." },
  { label: "Exporting", icon: Send, x: 89, y: 39, desc: "Auto-post to eBay and prep Facebook, OfferUp, and Craigslist. One scan reaches every channel." },
  { label: "Messaging", icon: MessageSquare, x: 89, y: 61, desc: "Buyer questions land in one inbox. Reply, negotiate, and close without leaving Ahlam." },
  { label: "Orders", icon: ShoppingBag, x: 74, y: 80, desc: "Track every sale from first inquiry to paid, with the status of each order in one place." },
  { label: "Revenue", icon: DollarSign, x: 50, y: 87, desc: "See what sold and what is owed, broken down by part, vehicle, and marketplace." },
  { label: "Analytics", icon: BarChart3, x: 26, y: 80, desc: "Know what moves and what sits. Demand trends help you stock and price smarter." },
  { label: "Importing", icon: Download, x: 11, y: 61, desc: "Bring existing inventory in fast. Spreadsheets and yard data map in cleanly." },
  { label: "Team", icon: Users, x: 11, y: 39, desc: "Add staff with roles and permissions so everyone works the same inventory safely." },
  { label: "Enterprise", icon: Building2, x: 26, y: 20, desc: "Multi-yard, SSO, and custom workflows, built to scale with larger operations." },
] as const;

const BRAIN_BASE = 0.5; // delay before the build-out starts (after the core drops)
const BRAIN_STEP = 0.42; // gap between each capability appearing

function BrainVisual() {
  const [active, setActive] = React.useState<number | null>(null);
  // "Captured": clicking the central aperture pulls every capability node into
  // the logo (and fades the connectors); clicking again releases them.
  const [captured, setCaptured] = React.useState(false);
  const capturedRef = React.useRef(false);
  React.useEffect(() => { capturedRef.current = captured; }, [captured]);

  // Live node positions in the SVG's 0–100 viewBox units (== % of the box), updated
  // every frame by one rAF loop, so the connector LINES track the chips as they
  // orbit — and as they get pulled into the centre on capture. Driving chips and
  // line endpoints from the SAME numbers keeps them locked together.
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number; vis: number }[]>(() => BRAIN_NODES.map((n) => ({ x: n.x, y: n.y, vis: 1 })));
  React.useEffect(() => {
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const orbit = BRAIN_NODES.map((_, i) => ({
      r: reduce ? 0 : 3 + (i % 4),                          // orbit radius (~% of box)
      speed: (0.16 + (i % 3) * 0.05) * (i % 2 ? -1 : 1),    // rad/s, alternating direction
      phase: (i / BRAIN_NODES.length) * Math.PI * 2,
    }));
    let raf = 0, grab = 0, inView = true;
    const start = performance.now();
    const io = typeof IntersectionObserver !== "undefined" && wrapRef.current
      ? new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0 })
      : null;
    if (io && wrapRef.current) io.observe(wrapRef.current);
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      grab += ((capturedRef.current ? 1 : 0) - grab) * 0.12;   // ease toward captured / released
      if (inView || grab > 0.002) {
        setPos(BRAIN_NODES.map((n, i) => {
          const o = orbit[i], a = o.phase + t * o.speed;
          const ox = n.x + o.r * Math.cos(a), oy = n.y + o.r * Math.sin(a);
          // Lerp each node from its orbit toward the centre by the capture amount.
          return { x: ox + (50 - ox) * grab, y: oy + (50 - oy) * grab, vis: 1 - grab };
        }));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, []);
  return (
    <div className="cs-glass" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ display: "flex", gap: 6 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c, opacity: 0.85 }} />)}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4 }}>How Ahlam works</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>Tap a capability</span>
      </div>
      <div ref={wrapRef} style={{ position: "relative", height: "clamp(440px, 54vw, 560px)", background: "radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%)" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {BRAIN_NODES.map((n, i) => {
            const on = active === i;
            const stroke = on ? "color-mix(in srgb, var(--accent) 85%, transparent)"
              : active == null ? "color-mix(in srgb, var(--accent) 36%, transparent)"
              : "color-mix(in srgb, var(--accent) 12%, transparent)";
            return (
              <motion.line key={n.label} x1={50} y1={50} x2={pos[i].x} y2={pos[i].y}
                stroke={stroke} strokeWidth={on ? 2 : 1} vectorEffect="non-scaling-stroke"
                strokeOpacity={pos[i].vis}
                initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: BRAIN_BASE + i * BRAIN_STEP, duration: 0.32, ease: EASE }} style={{ transition: "stroke 0.3s ease" }} />
            );
          })}
        </svg>

        {BRAIN_NODES.map((n, i) => {
          const Icon = n.icon;
          const on = active === i;
          return (
            <div key={n.label} style={{
              position: "absolute",
              // Live position from the rAF loop: the chip orbits here, and the
              // connector line ends at this exact point, so they move together.
              left: `${pos[i].x}%`, top: `${pos[i].y}%`,
              transform: "translate(-50%, -50%)", opacity: pos[i].vis,
              pointerEvents: captured ? "none" : "auto",
              zIndex: on ? 6 : 3,
            }}>
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: BRAIN_BASE + i * BRAIN_STEP + 0.26, duration: 0.4, ease: EASE }}
                whileHover={{ scale: 1.06 }}
                onClick={() => setActive(on ? null : i)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999,
                  fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", color: "var(--foreground)",
                  background: on ? "color-mix(in srgb, var(--accent) 22%, var(--surface))" : "color-mix(in srgb, var(--surface) 74%, transparent)",
                  backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                  border: `1px solid ${on ? "color-mix(in srgb, var(--accent) 70%, transparent)" : "color-mix(in srgb, var(--foreground) 12%, transparent)"}`,
                  boxShadow: on ? "0 0 26px -4px color-mix(in srgb, var(--accent) 60%, transparent)" : "0 12px 26px -18px rgba(0,0,0,0.7)",
                }}
              >
                <Icon size={14} color="var(--accent)" /> {n.label}
              </motion.button>
            </div>
          );
        })}

        {/* Core node — the aperture. Click to "capture" every capability into the
            logo; click again to release them. Theme-aware mark (gold in dark, ink
            in light). */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 7, display: "grid", placeItems: "center" }}>
          <motion.button onClick={() => { setActive(null); setCaptured((c) => !c); }} aria-label={captured ? "Release capabilities" : "Capture capabilities"} title={captured ? "Click to release" : "Click to capture"} aria-pressed={captured}
            initial={{ opacity: 0, y: -52 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.55, ease: [0.34, 1.3, 0.5, 1] }}
            className="cs-float"
            style={{ width: 78, height: 78, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", background: "color-mix(in srgb, var(--accent) 20%, var(--surface))", border: "1.5px solid color-mix(in srgb, var(--accent) 60%, transparent)", boxShadow: captured ? "0 0 70px -2px color-mix(in srgb, var(--accent) 88%, transparent)" : "0 0 48px -8px color-mix(in srgb, var(--accent) 65%, transparent)", transition: "box-shadow 0.45s ease" }}>
            <motion.span animate={{ rotate: captured ? 135 : 0, scale: captured ? 1.12 : 1 }} transition={{ duration: 0.5, ease: EASE }} style={{ display: "grid", placeItems: "center" }}>
              <span className="brand-chip__dark" style={{ placeItems: "center" }}><BrandMark size={38} /></span>
              <span className="brand-chip__light" style={{ placeItems: "center" }}><BrandMark size={38} gold="#101A2C" goldDark="#1E2A40" ring="#101A2C" iris="#D8392E" /></span>
            </motion.span>
          </motion.button>
        </div>

        {/* Click-to-explain popover, anchored between the node and the center */}
        <AnimatePresence>
          {active != null && (() => {
            const n = BRAIN_NODES[active];
            const px = n.x + (50 - n.x) * 0.42;
            const py = n.y + (50 - n.y) * 0.42;
            const Icon = n.icon;
            return (
              <motion.div key="pop" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.22, ease: EASE }}
                style={{ position: "absolute", left: `${px}%`, top: `${py}%`, transform: "translate(-50%, -50%)", zIndex: 10, width: 232 }}>
                <div className="cs-glass" style={{ borderRadius: "var(--radius-md)", padding: 16, border: "1px solid color-mix(in srgb, var(--accent) 45%, var(--line))", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.8)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 8, background: "var(--accent-tint)" }}><Icon size={15} color="var(--accent)" /></span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{n.label}</span>
                    <button onClick={() => setActive(null)} aria-label="Close" style={{ marginLeft: "auto", display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 7, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><X size={14} /></button>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>{n.desc}</p>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

// FAQ accordion — one open at a time, smooth height animation.
function FAQ() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {FAQS.map((it, i) => {
        const on = open === i;
        return (
          <motion.div key={it.q} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.05, duration: 0.45, ease: EASE }}
            className="cs-glass" style={{ borderRadius: "var(--radius-md)", overflow: "hidden", borderColor: on ? "color-mix(in srgb, var(--accent) 40%, var(--line))" : undefined }}>
            <button onClick={() => setOpen(on ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "17px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--foreground)" }}>
              <span style={{ fontSize: 15.5, fontWeight: 600 }}>{it.q}</span>
              <motion.span animate={{ rotate: on ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE }} style={{ display: "grid", placeItems: "center", flexShrink: 0, color: on ? "var(--accent)" : "var(--muted)" }}><ChevronDown size={18} /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: EASE }} style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, padding: "0 20px 18px", fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)" }}>{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// The AI review card shown in the hero and the pricing step.
function ReviewCard({ onPost, float }: { onPost?: () => void; float?: boolean }) {
  return (
    <div className={`cs-glass${float ? " cs-float" : ""}`} style={{ borderRadius: "var(--radius-xl)", padding: 20, position: "relative", overflow: "hidden" }}>
      <div className="cs-scanline" aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, background: "linear-gradient(180deg, color-mix(in srgb, var(--sand) 26%, transparent), transparent)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, position: "relative" }}>
        <ScanLine size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>AI review card</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 16%, transparent)", borderRadius: 999, padding: "2px 9px" }}>Grade B</span>
      </div>
      {[["Part", "Alternator"], ["Fits", "2013 to 2017 Accord"], ["Condition", "Grade B, tested"], ["Suggested", "$85"]].map(([k, v]) => (
        <div key={k} style={previewRow}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
      ))}
      {onPost && <button onClick={onPost} style={{ ...solidBtn, width: "100%", justifyContent: "center", marginTop: 14 }}><Send size={15} /> Post listing</button>}
    </div>
  );
}

// --- Step section -----------------------------------------------------------

function Step({ index, eyebrow, title, body, visual, flip }: { index: number; eyebrow: string; title: string; body: string; visual: React.ReactNode; flip?: boolean }) {
  // Copy fades up; the visual slides in from its own side, with a soft blur.
  const dir = flip ? -36 : 36;
  return (
    <motion.div
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-110px" }}
      className="cs-step-grid"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}
    >
      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.25, ease: EASE } } }}
        style={{ order: flip ? 2 : 1 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 999, background: "var(--accent-tint)", color: "var(--accent)", fontWeight: 800, fontSize: 14 }}>{index + 1}</span>
          <span className="cs-eyebrow">{eyebrow}</span>
        </div>
        <h3 className="cs-display" style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.015em", margin: "14px 0 0", lineHeight: 1.2 }}>{title}</h3>
        <p style={{ fontSize: 15.5, color: "var(--muted)", lineHeight: 1.65, margin: "10px 0 0", maxWidth: 440 }}>{body}</p>
      </motion.div>
      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.25, ease: EASE, delay: 0.05 } } }}
        style={{ order: flip ? 1 : 2 }}
      >
        {visual}
      </motion.div>
    </motion.div>
  );
}

// Step 1 — scanning a photo
function ScanVisual() {
  return (
    <div className="cs-glass" style={{ borderRadius: "var(--radius-xl)", padding: 16 }}>
      <div className="photo-cell" style={{ height: 250, borderRadius: "var(--radius-md)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
        <CarArt />
        {/* scanning reticle */}
        {[{ t: 14, l: 14, r: "tl" }, { t: 14, l: "auto", r: "tr" }, { b: 14, l: 14, r: "bl" }, { b: 14, l: "auto", r: "br" }].map((c, i) => (
          <span key={i} style={cornerStyle(c)} />
        ))}
        <div className="cs-scanline" aria-hidden="true" style={{ position: "absolute", left: 10, right: 10, top: 0, height: 78, background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 34%, transparent), transparent)" }} />
        <span style={{ position: "absolute", bottom: 14, left: 14, fontSize: 11.5, fontWeight: 700, color: "#fff", background: "color-mix(in srgb, var(--accent) 86%, transparent)", borderRadius: 999, padding: "4px 11px", display: "inline-flex", gap: 6, alignItems: "center" }}><ScanLine size={12} /> Scanning</span>
      </div>
    </div>
  );
}

// Stylized car illustration used inside the scan frame (self-contained SVG, no
// external image asset). Easy to swap for a real photo later.
function CarArt() {
  return (
    <svg viewBox="0 0 260 130" width="82%" style={{ maxWidth: 320 }} aria-hidden="true">
      <ellipse cx="130" cy="113" rx="104" ry="8" fill="rgba(0,0,0,0.28)" />
      <path d="M22 86 C22 74 30 69 44 67 L74 62 C86 48 104 41 130 41 L160 41 C188 41 210 53 226 70 L236 73 C244 75 246 80 246 86 L246 90 C246 95 242 97 237 97 L31 97 C26 97 22 94 22 89 Z"
        fill="color-mix(in srgb, var(--accent) 24%, var(--surface2))" stroke="color-mix(in srgb, var(--accent) 55%, transparent)" strokeWidth="1.6" />
      <path d="M84 60 C94 49 108 44 130 44 L158 44 C178 44 196 53 210 66 L84 66 Z"
        fill="color-mix(in srgb, var(--background) 72%, transparent)" stroke="color-mix(in srgb, var(--accent) 40%, transparent)" strokeWidth="1.2" />
      <line x1="135" y1="44" x2="135" y2="66" stroke="color-mix(in srgb, var(--accent) 40%, transparent)" strokeWidth="1.2" />
      <rect x="231" y="77" width="11" height="7" rx="2.5" fill="color-mix(in srgb, var(--signal) 75%, transparent)" />
      <circle cx="80" cy="97" r="18" fill="#0d1524" />
      <circle cx="80" cy="97" r="8" fill="color-mix(in srgb, var(--accent) 62%, var(--surface))" />
      <circle cx="190" cy="97" r="18" fill="#0d1524" />
      <circle cx="190" cy="97" r="8" fill="color-mix(in srgb, var(--accent) 62%, var(--surface))" />
    </svg>
  );
}

// Step 2 — detected parts list, staggered
function PartsVisual() {
  const parts = [["Hood", "Grade A"], ["Left Headlight", "Grade B"], ["Alternator", "Grade B"], ["Front Bumper Cover", "Grade C"]];
  return (
    <div className="cs-glass" style={{ borderRadius: "var(--radius-xl)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Sparkles size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>Parts detected</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>4 found</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {parts.map(([name, grade], i) => (
          <motion.div key={name}
            initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4, ease: EASE }}
            style={{ ...previewRow, marginTop: 0 }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Check size={14} color="var(--success)" /> {name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{grade}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Step 3 — pricing from comps (review card + comp bars)
function PriceVisual() {
  return (
    <div className="cs-glass" style={{ borderRadius: "var(--radius-xl)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Tag size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>What this part sells for</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--success)" }}>Suggested $85</span>
      </div>
      <div style={{ display: "grid", gap: 9 }}>
        {[["$72", 54], ["$80", 66], ["$85", 78], ["$91", 70], ["$98", 58]].map(([label, w], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="tnum" style={{ fontSize: 12, color: "var(--muted)", width: 34 }}>{label}</span>
            <div style={{ flex: 1, height: 9, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: EASE }}
                style={{ height: "100%", borderRadius: 999, background: (w as number) >= 78 ? "var(--accent)" : "color-mix(in srgb, var(--accent) 45%, var(--surface2))" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>We suggest the median of real sales, so lowball or knock-off listings can&apos;t drag it down.</div>
    </div>
  );
}

// Step 4 — posted everywhere
function PostVisual() {
  const channels = [
    <LogoImg key="e" src="/logos/ebay.svg" alt="eBay" h={24} />,
    <LogoImg key="f" src="/logos/facebook.svg" alt="Facebook Marketplace" h={22} />,
    <LogoImg key="o" src="/logos/offerup.svg" alt="OfferUp" h={18} />,
    <LogoImg key="c" src="/logos/craigslist.svg" alt="Craigslist" h={16} />,
  ];
  return (
    <div className="cs-glass" style={{ borderRadius: "var(--radius-xl)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Send size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>Posted to</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {channels.map((c, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4, ease: EASE }}
            style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", color: "var(--muted)", background: "color-mix(in srgb, var(--surface2) 70%, transparent)", borderRadius: 10, padding: "12px 14px" }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", color: "var(--foreground)" }}>{c}</span>
            <Check size={15} color="var(--success)" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  { eyebrow: "Capture", title: "Snap a few photos", body: "Use your phone or upload from the lot: the exterior, the parts, the engine bay, the dashboard, and the VIN plate on the windshield. Up to 15 shots per vehicle. More angles mean more parts found and a truer price.", visual: () => <ScanVisual /> },
  { eyebrow: "Identify", title: "AI catalogs every part", body: "The AI reads each photo, names every sellable part, and grades its condition on a consistent A, B, and C rubric. It even reads the VIN and odometer when they show.", visual: () => <PartsVisual /> },
  { eyebrow: "Price", title: "Priced from real sales", body: "We check what the same part actually sells for across eBay, Facebook, and OfferUp, then suggest the median of those real sales. Using the median (not the average) keeps a few stolen or knock-off listings from dragging your price down. Edit any number freely.", visual: () => <PriceVisual /> },
  { eyebrow: "Publish", title: "Post everywhere at once", body: "Auto-post to eBay and copy clean, ready-to-paste listings for Facebook, OfferUp, and Craigslist, plus your own Ahlam storefront. One scan, every channel.", visual: () => <PostVisual /> },
] as const;

const navLink: React.CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, padding: "8px 10px", borderRadius: 8 };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const solidBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const ghostBtnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const solidBtnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 15px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const navDivider: React.CSSProperties = { width: 1, height: 18, background: "color-mix(in srgb, var(--foreground) 14%, transparent)", margin: "0 3px", flexShrink: 0 };
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", background: "var(--accent-tint)", padding: "5px 13px", fontSize: 12.5, fontWeight: 600, color: "var(--accent)" };
const pillDot: React.CSSProperties = { width: 6, height: 6, borderRadius: 999, background: "var(--accent)", animation: "pulse-dot 1.8s infinite" };
const previewRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "color-mix(in srgb, var(--surface2) 70%, transparent)", borderRadius: 9, padding: "10px 13px", fontSize: 13, marginTop: 8 };
const h2: React.CSSProperties = { fontSize: 36, fontWeight: 600, letterSpacing: "-0.015em", margin: "10px 0 0", lineHeight: 1.12 };
const featIconBig: React.CSSProperties = { display: "inline-grid", placeItems: "center", width: 46, height: 46, borderRadius: 13, background: "linear-gradient(150deg, color-mix(in srgb, var(--accent) 26%, transparent), color-mix(in srgb, var(--accent) 8%, transparent))", border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)" };

function cornerStyle(c: { t?: number; b?: number; l?: number | string; r: string }): React.CSSProperties {
  const base: React.CSSProperties = { position: "absolute", width: 22, height: 22, borderColor: "color-mix(in srgb, var(--accent) 80%, transparent)", borderStyle: "solid", borderWidth: 0 };
  const top = c.r[0] === "t";
  const left = c.r[1] === "l";
  return {
    ...base,
    [top ? "top" : "bottom"]: 14,
    [left ? "left" : "right"]: 14,
    borderTopWidth: top ? 3 : 0,
    borderBottomWidth: top ? 0 : 3,
    borderLeftWidth: left ? 3 : 0,
    borderRightWidth: left ? 0 : 3,
    borderTopLeftRadius: top && left ? 6 : 0,
    borderTopRightRadius: top && !left ? 6 : 0,
    borderBottomLeftRadius: !top && left ? 6 : 0,
    borderBottomRightRadius: !top && !left ? 6 : 0,
  };
}
