"use client";

import React from "react";
import { motion, AnimatePresence, MotionConfig, type Variants } from "framer-motion";
import { ScanLine, Send, ArrowRight, Tag, Check, ChevronDown, CalendarCheck, Mail, MessageSquare, Compass, Wrench, DollarSign, ShoppingBag, BarChart3, Download, Users, Building2, X, Camera, Boxes } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { LaunchCountdown } from "./LaunchCountdown";
import { useI18n } from "@/lib/i18n";
import { CONDITION_COLOR } from "./data";
import { PricingPlans } from "./PricingPlans";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

// Public marketing page shown to unauthenticated visitors. Editorial, photo-led
// design: solid surfaces, hairline structure, real (AI-generated) salvage-yard
// part photography, and numbered sections — deliberately not the translucent /
// glowing "AI template" look. Motion is gated behind prefers-reduced-motion.

const EASE = [0.22, 0.8, 0.26, 1] as const;

// Pricing is hidden on the public landing for now (pre-launch). Flip to true to
// bring the Pricing section + nav links back. The PricingPlans component and the
// plan data stay in the codebase either way.
const SHOW_PRICING = false;

const RECIPIENTS = "mohammadabbas@ahlam.io,andygarcia@ahlam.io";
const GMAIL_COMPOSE = (to: string, subject: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;
const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";

const FAQS = [
  { q: "Do I need to know parts to use it?", a: "No. That is the point. Photograph the car and the AI names every sellable part, grades its condition, and prices it. You review and post." },
  { q: "How accurate is the pricing?", a: "We look up what the same part actually sells for across eBay, Facebook, and OfferUp, then suggest the median of those real sales. We use the median, not the average, so a few suspiciously cheap listings (often stolen or knock-off parts) can't drag your price down. Every number is editable, and you can see how confident the AI is on each one." },
  { q: "Which marketplaces can I post to?", a: "Auto-post to eBay, and one-tap copy clean listings for Facebook Marketplace, OfferUp, Craigslist, and Car-Part.com, plus your own Ahlam storefront." },
  { q: "Can I list a part or car manually?", a: "Yes. AI scanning is the fast path, but you can type in a vehicle or a single part by hand any time, with the AI helping write and price it." },
  { q: "Is my VIN and mileage private?", a: "Yes. VIN and mileage are read for accuracy but stay hidden on public listings until you choose to share them." },
  { q: "What does it cost to start?", a: "Nothing. Start free with no card. The first 50 yards get a full month with every feature unlocked." },
];

// Sample marketplace listings — varied vehicles and a deliberate A/B/C grade mix.
// Photos are real (AI-generated) salvage-yard part shots in /public/marketplace.
const MARKET_SAMPLE: { part: string; side?: string; vehicle: string; grade: "A" | "B" | "C"; price: number; views: number; loc: string; img: string }[] = [
  { part: "Front Bumper Cover", vehicle: "2018 Honda Civic", grade: "A", price: 240, views: 142, loc: "Long Beach, CA", img: "/marketplace/bumper.webp" },
  { part: "Tailgate Assembly", vehicle: "2013 Ford F-150", grade: "B", price: 410, views: 318, loc: "Phoenix, AZ", img: "/marketplace/tailgate.webp" },
  { part: "Hood", vehicle: "2016 Chevy Silverado", grade: "C", price: 120, views: 73, loc: "Houston, TX", img: "/marketplace/hood.webp" },
  { part: "Headlight Assembly", side: "Right", vehicle: "2019 Toyota RAV4", grade: "A", price: 185, views: 96, loc: "Dallas, TX", img: "/marketplace/headlight.webp" },
  { part: "Alloy Wheel (Set of 4)", vehicle: "2017 Toyota Camry", grade: "B", price: 300, views: 204, loc: "Atlanta, GA", img: "/marketplace/wheel.webp" },
  { part: "Engine 2.4L", vehicle: "2015 Nissan Altima", grade: "C", price: 880, views: 58, loc: "Denver, CO", img: "/marketplace/engine.webp" },
];

// Real brand logo (SVG file in /public/logos), rendered at a fixed height.
function LogoImg({ src, alt, h = 24 }: { src: string; alt: string; h?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} style={{ height: h, width: "auto", display: "block" }} />;
}

const reveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: i * 0.04 } }),
};

function Reveal({ children, i = 0, style, className }: { children: React.ReactNode; i?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <motion.div variants={reveal} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px 0px" }} style={style} className={className}>
      {children}
    </motion.div>
  );
}

export function Landing({ onGetStarted }: { onGetStarted: () => void; onSignIn?: () => void }) {
  const { lang, setLang } = useI18n();

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
        <div className="cs-page-wash" aria-hidden="true" />

        <div className="cs-landing-body" style={{ position: "relative", zIndex: 1 }}>
          <SiteHeader onGetStarted={onGetStarted} lang={lang} setLang={setLang} />

          {/* Hero — asymmetric: copy left, framed real photo + review card right */}
          <section style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="cs-hero-grid" style={{ maxWidth: 1140, margin: "0 auto", padding: "70px 24px 78px", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center" }}>
              <div>
                <motion.span variants={reveal} custom={0} initial="hidden" animate="show" className="cs-kicker" style={{ display: "inline-block" }}>
                  For salvage yards & anyone selling car parts
                </motion.span>
                <motion.h1 className="cs-display" variants={reveal} custom={1} initial="hidden" animate="show" style={{ margin: "18px 0 0", fontSize: "clamp(40px, 5vw, 62px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.035em" }}>
                  Photograph a car.<br />
                  <span className="accent">List every part in seconds.</span>
                </motion.h1>
                <motion.p variants={reveal} custom={2} initial="hidden" animate="show" style={{ margin: "22px 0 0", fontSize: 17.5, color: "var(--muted)", lineHeight: 1.62, maxWidth: 500 }}>
                  Ahlam&apos;s AI names every sellable part, grades its condition, and prices it from your photos. Then it posts to eBay in a tap, with Facebook and OfferUp next. The hours you lose cataloging and typing listings are gone.
                </motion.p>
                <motion.div variants={reveal} custom={3} initial="hidden" animate="show" style={{ display: "flex", gap: 16, marginTop: 30, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtn, padding: "14px 26px", fontSize: 15.5 }}>Start free <ArrowRight size={17} /></button>
                  <a href="#how" className="cs-textlink" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>See how it works <ArrowRight size={15} style={{ opacity: 0.6 }} /></a>
                </motion.div>
                <motion.div variants={reveal} custom={4} initial="hidden" animate="show" style={{ marginTop: 22, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                  {["Free first month, no card", "Posts to eBay today", "Built for two-person yards"].map((t) => (
                    <span key={t} style={{ fontSize: 13, color: "var(--muted)", display: "inline-flex", gap: 7, alignItems: "center" }}><Check size={14} color="var(--success)" /> {t}</span>
                  ))}
                </motion.div>
              </div>

              <div style={{ position: "relative" }}>
                {/* No decorative blocks behind the card. The card itself gently
                    floats (cs-float) so the hero has motion without clutter. */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 }} style={{ position: "relative", zIndex: 1 }}>
                  <div className="cs-float">
                    <HeroShowcase onPost={onGetStarted} />
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Beta notice + launch countdown */}
          <section style={{ borderBottom: "1px solid var(--line)" }}>
            <Reveal style={{ maxWidth: 940, margin: "0 auto", padding: "24px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13, justifyContent: "center", flexWrap: "wrap", background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)", borderRadius: 14, padding: "15px 22px" }}>
                <span style={{ display: "inline-flex", marginTop: 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)", borderRadius: 999, padding: "2px 8px", flexShrink: 0 }}>BETA</span>
                <span style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, maxWidth: 740 }}>
                  <strong style={{ color: "var(--foreground)" }}>Ahlam is in beta.</strong> Posting to eBay is live now. Facebook, OfferUp, and more are in development. We launch right after the Fourth of July weekend, starting with yards in California and Texas. The first 50 yards to join the waitlist get a full month free with every feature unlocked.
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11, marginTop: 20 }}>
                <span className="cs-kicker">Launching in</span>
                <LaunchCountdown />
              </div>
            </Reveal>
          </section>

          {/* Channel logos — calm static row */}
          <section style={{ borderBottom: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 24px" }}>
              <Reveal style={{ textAlign: "center", marginBottom: 22 }}>
                <div className="cs-kicker">Posts to the places buyers already shop</div>
              </Reveal>
              <Reveal i={1} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 44, flexWrap: "wrap" }}>
                {PARTNERS.map((p) => (
                  <div key={p.caption} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, opacity: 0.9 }}>
                    <div style={{ height: 26, display: "flex", alignItems: "center" }}>{p.logo}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{p.caption}</span>
                  </div>
                ))}
              </Reveal>
            </div>
          </section>

          {/* The problem — one editorial statement */}
          <section style={{ borderBottom: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "76px 24px" }}>
              <Reveal style={{ maxWidth: 760 }}>
                <div className="cs-kicker" style={{ color: "var(--accent)" }}>The bottleneck</div>
                <h2 className="cs-display" style={{ ...h2, maxWidth: 720 }}>
                  The slow part was never typing. It was knowing <span className="accent">what the part is</span>.
                </h2>
                <p style={{ color: "var(--muted)", fontSize: 17, lineHeight: 1.65, marginTop: 16, maxWidth: 640 }}>
                  A car has hundreds of sellable parts. Pricing each one means knowing the fitment, the condition, and what it actually sells for. That expertise is the real reason cars sit and parts get scrapped. Ahlam puts it in your pocket.
                </p>
              </Reveal>
              <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, marginTop: 44 }}>
                {[
                  { n: "Hundreds", l: "of sellable parts on an average car, most of them never listed." },
                  { n: "Minutes", l: "to scan a whole vehicle into priced, ready-to-post listings." },
                  { n: "5 places", l: "to sell at once: eBay, Facebook, OfferUp, Craigslist, your storefront." },
                ].map((s) => (
                  <Reveal key={s.n}>
                    <div style={{ paddingTop: 18, borderTop: "2px solid var(--accent)" }}>
                      <div className="cs-display" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.n}</div>
                      <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55, marginTop: 8, maxWidth: 280 }}>{s.l}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* How it works — numbered steps */}
          <section id="how" style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 24px 30px" }}>
            <Reveal style={{ maxWidth: 660 }}>
              <div className="cs-kicker">How it works</div>
              <h2 className="cs-display" style={h2}>From a photo to posted, in four steps</h2>
              <p style={{ color: "var(--muted)", fontSize: 16.5, marginTop: 12, lineHeight: 1.6 }}>
                Snap photos and let the AI catalog, grade, and price. Prefer to type it in? Manual entry is there whenever you want it.
              </p>
            </Reveal>

            <div style={{ display: "grid", gap: 28, marginTop: 52 }}>
              {STEPS.map((s, i) => (
                <Step key={s.title} index={i} eyebrow={s.eyebrow} title={s.title} body={s.body} visual={s.visual()} flip={i % 2 === 1} />
              ))}
            </div>
          </section>

          {/* Marketplace */}
          <section id="marketplace" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--surface) 50%, var(--background))" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 24px" }}>
              <Reveal style={{ maxWidth: 700 }}>
                <div className="cs-kicker">Marketplace</div>
                <h2 className="cs-display" style={h2}>A marketplace that works <span className="accent">both ways</span></h2>
                <p style={{ color: "var(--muted)", fontSize: 16.5, marginTop: 12, lineHeight: 1.6, maxWidth: 640 }}>
                  Sellers list parts in seconds with the AI. Buyers search every yard&apos;s inventory in one place and message the seller direct, with no middleman and no off-platform hand-off.
                </p>
              </Reveal>

              <Reveal i={1} style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "26px 0 28px" }}>
                <div className="cs-well" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 15px", fontSize: 13.5, fontWeight: 600 }}>
                  <Compass size={16} color="var(--accent)" /> For buyers: find the exact part
                </div>
                <div className="cs-well" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 15px", fontSize: 13.5, fontWeight: 600 }}>
                  <ShoppingBag size={16} color="var(--accent)" /> For sellers: reach every buyer
                </div>
              </Reveal>

              <Reveal i={2} style={{ marginBottom: 22 }}>
                <div className="cs-well" style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", maxWidth: 720 }}>
                  <Compass size={18} color="var(--muted)" />
                  <span style={{ color: "var(--muted)", fontSize: 14.5 }}>Search &ldquo;2014 Honda Accord front bumper&rdquo;, a VIN, or a part number&hellip;</span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Browse</span>
                </div>
              </Reveal>

              <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
                {MARKET_SAMPLE.map((l, i) => (
                  <motion.div key={l.part + l.vehicle}
                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px 0px" }}
                    transition={{ delay: (i % 3) * 0.06, duration: 0.4, ease: EASE }}
                    className="cs-card-btn cs-panel" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
                  >
                    <div className="cs-photo" style={{ height: 168, borderRadius: 0, border: "none", borderBottom: "1px solid var(--line)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.img} alt={`${l.side ? `${l.side} ` : ""}${l.part} — ${l.vehicle}`} loading="lazy" />
                      <span style={{ position: "absolute", top: 10, left: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: "#fff", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: CONDITION_COLOR[l.grade] }} /> Grade {l.grade}
                      </span>
                      <span style={{ position: "absolute", top: 10, right: 10, fontSize: 13, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "3px 9px" }}>${l.price}</span>
                    </div>
                    <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{l.side ? `${l.side} ` : ""}{l.part}</div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Fits {l.vehicle}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 11, borderTop: "1px solid var(--line)" }}>
                        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.views} views · {l.loc}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
                          <MessageSquare size={13} /> Message
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Reveal i={1} style={{ display: "flex", justifyContent: "center", marginTop: 34 }}>
                <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtn, padding: "13px 24px", fontSize: 15 }}>Browse the marketplace <ArrowRight size={17} /></button>
              </Reveal>
            </div>
          </section>

          {/* How Ahlam works — the interactive capability "brain" + a flat capability row */}
          <section id="works" style={{ borderBottom: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 24px" }}>
              <Reveal style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
                <div className="cs-kicker">The whole operation</div>
                <h2 className="cs-display" style={h2}>Everything it takes to sell, in one place</h2>
                <p style={{ color: "var(--muted)", fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
                  From scanning and pricing to messaging, orders, and analytics, Ahlam runs the whole operation. Tap any capability to see what it does.
                </p>
              </Reveal>
              <Reveal i={1} style={{ maxWidth: 760, margin: "40px auto 0" }}><BrainVisual /></Reveal>
              <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 28 }}>
                {[
                  { icon: Wrench, t: "Knows every part", d: "Names and grades every sellable part straight from a photo." },
                  { icon: Tag, t: "Priced from real sales", d: "The median of what the same part sells for across platforms, never dragged down by lowball listings." },
                  { icon: DollarSign, t: "Learns from your sales", d: "Every sale you make sharpens the next price it suggests." },
                  { icon: Send, t: "Connected everywhere", d: "One brain behind every marketplace you list on." },
                ].map((f, i) => (
                  <Reveal key={f.t} i={i}>
                    <div style={{ padding: "18px 2px", height: "100%" }}>
                      <span style={flatIcon}><f.icon size={18} color="var(--accent)" /></span>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 13 }}>{f.t}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 5, lineHeight: 1.55 }}>{f.d}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing (hidden pre-launch via SHOW_PRICING) */}
          {SHOW_PRICING && (
            <section id="pricing" style={{ maxWidth: 1200, margin: "0 auto", padding: "78px 24px" }}>
              <Reveal style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
                <div className="cs-kicker">Pricing</div>
                <h2 className="cs-display" style={h2}>Simple, transparent pricing</h2>
                <p style={{ color: "var(--muted)", fontSize: 15.5, marginTop: 10, lineHeight: 1.6 }}>Free for the first 50 yards, or go Solo for $19/mo if it&apos;s just you. No card to begin, cancel anytime.</p>
              </Reveal>
              <Reveal i={1} style={{ maxWidth: 1180, margin: "38px auto 0" }}>
                <PricingPlans onChoose={onGetStarted} />
              </Reveal>
              <Reveal i={2} style={{ maxWidth: 680, margin: "30px auto 0", textAlign: "center" }}>
                <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.65 }}>
                  <strong style={{ color: "var(--foreground)" }}>No email or website? Most dismantlers don&apos;t.</strong> On the Ultimate plan we build and host one for you (a professional site, custom domain, and business email) so customers can find you, reach you, and keep coming back.
                </p>
              </Reveal>
            </section>
          )}

          {/* FAQ */}
          <section id="faq" style={{ borderTop: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px", display: "grid", gridTemplateColumns: "0.7fr 1.3fr", gap: 44 }} className="cs-faq-grid">
              <Reveal>
                <div className="cs-kicker">Questions</div>
                <h2 className="cs-display" style={{ ...h2, fontSize: 32 }}>Answers before you ask</h2>
                <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, marginTop: 12 }}>Still wondering something? <a href={GMAIL_COMPOSE(RECIPIENTS, "Ahlam question")} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Ask us directly.</a></p>
              </Reveal>
              <Reveal i={1}><FAQ /></Reveal>
            </div>
          </section>

          {/* CTA band */}
          <section id="contact" style={{ borderTop: "1px solid var(--line)" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", padding: "76px 24px" }}>
              <Reveal>
                <div style={{ borderRadius: "var(--radius-xl)", padding: "52px 40px", background: "var(--surface)", border: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
                  <span aria-hidden style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%", background: "var(--accent)" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 36, alignItems: "center" }} className="cs-cta-grid">
                    <div>
                      <div className="cs-kicker">Get started</div>
                      <h2 className="cs-display" style={{ ...h2, margin: "10px 0 0" }}>See Ahlam on your own inventory</h2>
                      <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, margin: "12px 0 0", maxWidth: 520 }}>
                        Join the waitlist for the free first month, or book a 15-minute walkthrough and we&apos;ll scan one of your cars live.
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <button onClick={onGetStarted} className="cs-raise" style={{ ...solidBtn, justifyContent: "center", padding: "14px 24px", fontSize: 15.5 }}>Join the waitlist <ArrowRight size={17} /></button>
                      <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, justifyContent: "center", padding: "13px 22px", fontSize: 15 }}><CalendarCheck size={16} /> Book a demo</a>
                      <button onClick={() => window.open(GMAIL_COMPOSE(RECIPIENTS, "Ahlam question"), "_blank", "noopener")} style={{ ...ghostBtn, justifyContent: "center", padding: "13px 22px", fontSize: 15, cursor: "pointer" }}><Mail size={16} /> Contact us</button>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <SiteFooter />
        </div>
      </div>
    </MotionConfig>
  );
}

const PARTNERS: { logo: React.ReactNode; caption: string }[] = [
  { logo: <LogoImg src="/logos/ebay.svg" alt="eBay" h={28} />, caption: "eBay" },
  { logo: <LogoImg src="/logos/facebook.svg" alt="Facebook Marketplace" h={26} />, caption: "Facebook Marketplace" },
  { logo: <LogoImg src="/logos/offerup.svg" alt="OfferUp" h={22} />, caption: "OfferUp" },
  { logo: <LogoImg src="/logos/craigslist.svg" alt="Craigslist" h={19} />, caption: "Craigslist" },
  { logo: <span style={{ background: "#fff", borderRadius: 7, padding: "4px 8px", display: "inline-flex", alignItems: "center" }}><LogoImg src="/logos/carpart.jpg" alt="Car-Part.com" h={17} /></span>, caption: "Car-Part.com" },
];

// --- Hero showcase: framed real photo + a solid AI-review card overlapping ----
function HeroShowcase({ onPost }: { onPost?: () => void }) {
  return (
    <div style={{ position: "relative" }}>
      <div className="cs-frame">
        <div className="cs-frame__bar">
          <span className="cs-frame__dot" style={{ background: "#ff5f57" }} />
          <span className="cs-frame__dot" style={{ background: "#febc2e" }} />
          <span className="cs-frame__dot" style={{ background: "#28c840" }} />
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>Ahlam · New scan</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 15%, transparent)", borderRadius: 999, padding: "2px 9px" }}><ScanLine size={11} /> Whole car</span>
        </div>
        <div className="cs-photo" style={{ height: 250, borderRadius: 0, border: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/hero-car.webp" alt="A 2016 Honda Accord scanned in a salvage yard" />
          <span style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 999, padding: "4px 10px" }}><Tag size={11} /> 2016 Honda Accord EX</span>
        </div>
        <div style={{ padding: 16 }}>
          {[["Condition", "Runs & drives"], ["Parts found", "42 sellable"], ["Est. value", "$4,250"]].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          {onPost && <button onClick={onPost} style={{ ...solidBtn, width: "100%", justifyContent: "center", marginTop: 10 }}><Send size={15} /> Review &amp; post listings</button>}
        </div>
      </div>
    </div>
  );
}

// --- "How Ahlam works": the interactive capability brain --------------------
// The core node drops in, then each capability builds out one line + node at a
// time. Click a node for a two-line explainer; click the core to "capture" every
// capability into the logo. Chips are solid (de-glassed) to match the page.
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

const BRAIN_BASE = 0.5;
const BRAIN_STEP = 0.42;

function BrainVisual() {
  const [active, setActive] = React.useState<number | null>(null);
  const [captured, setCaptured] = React.useState(false);
  const capturedRef = React.useRef(false);
  React.useEffect(() => { capturedRef.current = captured; }, [captured]);

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number; vis: number }[]>(() => BRAIN_NODES.map((n) => ({ x: n.x, y: n.y, vis: 1 })));
  React.useEffect(() => {
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const orbit = BRAIN_NODES.map((_, i) => ({
      r: reduce ? 0 : 3 + (i % 4),
      speed: (0.16 + (i % 3) * 0.05) * (i % 2 ? -1 : 1),
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
      grab += ((capturedRef.current ? 1 : 0) - grab) * 0.12;
      if (inView || grab > 0.002) {
        setPos(BRAIN_NODES.map((n, i) => {
          const o = orbit[i], a = o.phase + t * o.speed;
          const ox = n.x + o.r * Math.cos(a), oy = n.y + o.r * Math.sin(a);
          return { x: ox + (50 - ox) * grab, y: oy + (50 - oy) * grab, vis: 1 - grab };
        }));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, []);
  return (
    <div className="cs-frame">
      <div className="cs-frame__bar">
        <span className="cs-frame__dot" style={{ background: "#ff5f57" }} />
        <span className="cs-frame__dot" style={{ background: "#febc2e" }} />
        <span className="cs-frame__dot" style={{ background: "#28c840" }} />
        <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>How Ahlam works</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>Tap a capability</span>
      </div>
      <div ref={wrapRef} style={{ position: "relative", height: "clamp(440px, 54vw, 560px)", background: "radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%)" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {BRAIN_NODES.map((n, i) => {
            const on = active === i;
            const stroke = on ? "color-mix(in srgb, var(--accent) 85%, transparent)"
              : active == null ? "color-mix(in srgb, var(--accent) 34%, transparent)"
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
              position: "absolute", left: `${pos[i].x}%`, top: `${pos[i].y}%`,
              transform: "translate(-50%, -50%)", opacity: pos[i].vis,
              pointerEvents: captured ? "none" : "auto", zIndex: on ? 6 : 3,
            }}>
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: BRAIN_BASE + i * BRAIN_STEP + 0.26, duration: 0.4, ease: EASE }}
                whileHover={{ scale: 1.06 }}
                onClick={() => setActive(on ? null : i)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999,
                  fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", color: "var(--foreground)",
                  background: on ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "var(--surface)",
                  border: `1px solid ${on ? "color-mix(in srgb, var(--accent) 60%, transparent)" : "var(--line)"}`,
                  boxShadow: on ? "0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent)" : "0 8px 20px -16px rgba(0,0,0,0.7)",
                }}
              >
                <Icon size={14} color="var(--accent)" /> {n.label}
              </motion.button>
            </div>
          );
        })}

        {/* Core node — click to capture/release every capability into the mark. */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 7, display: "grid", placeItems: "center" }}>
          <motion.button onClick={() => { setActive(null); setCaptured((c) => !c); }} aria-label={captured ? "Release capabilities" : "Capture capabilities"} title={captured ? "Click to release" : "Click to capture"} aria-pressed={captured}
            initial={{ opacity: 0, y: -52 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.55, ease: [0.34, 1.3, 0.5, 1] }}
            style={{ width: 78, height: 78, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", background: "color-mix(in srgb, var(--accent) 14%, var(--surface))", border: "1.5px solid color-mix(in srgb, var(--accent) 55%, transparent)", boxShadow: captured ? "0 0 0 6px color-mix(in srgb, var(--accent) 18%, transparent)" : "0 10px 30px -14px rgba(0,0,0,0.6)", transition: "box-shadow 0.45s ease" }}>
            <motion.span animate={{ rotate: captured ? 135 : 0, scale: captured ? 1.12 : 1 }} transition={{ duration: 0.5, ease: EASE }} style={{ display: "grid", placeItems: "center" }}>
              <span className="brand-chip__dark" style={{ placeItems: "center" }}><BrandMark size={38} /></span>
              <span className="brand-chip__light" style={{ placeItems: "center" }}><BrandMark size={38} gold="#101A2C" goldDark="#1E2A40" ring="#101A2C" iris="#D8392E" /></span>
            </motion.span>
          </motion.button>
        </div>

        <AnimatePresence>
          {active != null && (() => {
            const n = BRAIN_NODES[active];
            const px = n.x + (50 - n.x) * 0.42;
            const py = n.y + (50 - n.y) * 0.42;
            const Icon = n.icon;
            return (
              <motion.div key="pop" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2, ease: EASE }}
                style={{ position: "absolute", left: `${px}%`, top: `${py}%`, transform: "translate(-50%, -50%)", zIndex: 10, width: 232 }}>
                <div className="cs-panel" style={{ padding: 16, border: "1px solid color-mix(in srgb, var(--accent) 45%, var(--line))", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.8)" }}>
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

// --- Numbered step --------------------------------------------------------
function Step({ index, eyebrow, title, body, visual, flip }: { index: number; eyebrow: string; title: string; body: string; visual: React.ReactNode; flip?: boolean }) {
  return (
    <motion.div
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-90px" }}
      className="cs-step-grid"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44, alignItems: "center" }}
    >
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }} style={{ order: flip ? 2 : 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span className="cs-index" style={{ fontSize: 30 }}>{String(index + 1).padStart(2, "0")}</span>
          <span className="cs-kicker" style={{ color: "var(--sand)" }}>{eyebrow}</span>
        </div>
        <h3 className="cs-display" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "12px 0 0", lineHeight: 1.18 }}>{title}</h3>
        <p style={{ fontSize: 15.5, color: "var(--muted)", lineHeight: 1.65, margin: "12px 0 0", maxWidth: 440 }}>{body}</p>
      </motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: 0.05 } } }} style={{ order: flip ? 1 : 2 }}>
        {visual}
      </motion.div>
    </motion.div>
  );
}

// Step 1 — capture (framed real photo with subtle reticle)
function ScanVisual() {
  return (
    <div className="cs-frame">
      <div className="cs-photo" style={{ height: 252, borderRadius: 0, border: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/scan-lot.webp" alt="Cars in a salvage yard lot" />
        {[{ t: true, l: true }, { t: true, l: false }, { t: false, l: true }, { t: false, l: false }].map((c, i) => (
          <span key={i} style={cornerStyle(c)} />
        ))}
        <span style={{ position: "absolute", bottom: 14, left: 14, fontSize: 11.5, fontWeight: 700, color: "#fff", background: "color-mix(in srgb, var(--accent) 88%, transparent)", borderRadius: 999, padding: "4px 11px", display: "inline-flex", gap: 6, alignItems: "center" }}><Camera size={12} /> Up to 15 photos per car</span>
      </div>
    </div>
  );
}

// Step 2 — detected parts list
function PartsVisual() {
  const parts = [["Hood", "A"], ["Left Headlight", "B"], ["Alternator", "B"], ["Front Bumper Cover", "C"]];
  return (
    <div className="cs-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Boxes size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>Parts detected</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>4 of 42 shown</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {parts.map(([name, grade], i) => (
          <motion.div key={name}
            initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.35, ease: EASE }}
            className="cs-well" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 13px" }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 13.5 }}><Check size={14} color="var(--success)" /> {name}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: CONDITION_COLOR[grade as string] }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: CONDITION_COLOR[grade as string] }} /> Grade {grade}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Step 3 — pricing from comps
function PriceVisual() {
  return (
    <div className="cs-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Tag size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>What this part sells for</span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--success)" }}>Suggested $85</span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {[["$72", 54], ["$80", 66], ["$85", 78], ["$91", 70], ["$98", 58]].map(([label, w], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="tnum" style={{ fontSize: 12, color: "var(--muted)", width: 34 }}>{label}</span>
            <div style={{ flex: 1, height: 9, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: 0.15 + i * 0.08, duration: 0.55, ease: EASE }}
                style={{ height: "100%", borderRadius: 999, background: (w as number) >= 78 ? "var(--accent)" : "color-mix(in srgb, var(--accent) 45%, var(--surface2))" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.5 }}>We suggest the median of real sales, so lowball or knock-off listings can&apos;t drag it down.</div>
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
    <div className="cs-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Send size={16} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 13 }}>Posted to</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--success)" }}>One scan, every channel</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {channels.map((c, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.35, ease: EASE }}
            className="cs-well" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", padding: "12px 14px" }}
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

// FAQ accordion
function FAQ() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {FAQS.map((it, i) => {
        const on = open === i;
        return (
          <div key={it.q} className="cs-panel" style={{ overflow: "hidden", borderColor: on ? "color-mix(in srgb, var(--accent) 40%, var(--line))" : undefined }}>
            <button onClick={() => setOpen(on ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 19px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--foreground)" }}>
              <span style={{ fontSize: 15.5, fontWeight: 600 }}>{it.q}</span>
              <motion.span animate={{ rotate: on ? 180 : 0 }} transition={{ duration: 0.25, ease: EASE }} style={{ display: "grid", placeItems: "center", flexShrink: 0, color: on ? "var(--accent)" : "var(--muted)" }}><ChevronDown size={18} /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, padding: "0 19px 17px", fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)" }}>{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
const solidBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
const h2: React.CSSProperties = { fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", margin: "14px 0 0", lineHeight: 1.1 };
const flatIcon: React.CSSProperties = { display: "inline-grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", flexShrink: 0 };

function cornerStyle(c: { t: boolean; l: boolean }): React.CSSProperties {
  return {
    position: "absolute", width: 24, height: 24, borderColor: "#fff", borderStyle: "solid", borderWidth: 0,
    [c.t ? "top" : "bottom"]: 14, [c.l ? "left" : "right"]: 14,
    borderTopWidth: c.t ? 3 : 0, borderBottomWidth: c.t ? 0 : 3,
    borderLeftWidth: c.l ? 3 : 0, borderRightWidth: c.l ? 0 : 3,
    opacity: 0.9,
  };
}
