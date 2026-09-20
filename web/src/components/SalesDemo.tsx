"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  Globe2,
  MapPin,
  MessageCircle,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  Store,
  VolumeOff,
  Zap,
} from "lucide-react";

const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";

const plans = [
  { name: "Growth", price: 100 },
  { name: "Max", price: 200 },
  { name: "Ultimate", price: 350 },
] as const;

const channels = [
  {
    name: "Your Ahlam storefront",
    label: "Live catalog",
    logo: null,
    icon: Store,
    text: "Give buyers one searchable page for your available inventory, shop details, hours, warranty, and contact options.",
    note: "A managed custom-domain website is included with Ultimate.",
  },
  {
    name: "eBay",
    label: "National reach",
    logo: "/logos/ebay.svg",
    icon: Globe2,
    text: "Publish directly after completing eBay business setup, or have the Chrome helper create and fill a regular eBay draft.",
    note: "The seller reviews the listing before it goes live.",
  },
  {
    name: "Facebook Marketplace",
    label: "Local buyers",
    logo: "/logos/facebook.svg",
    icon: MapPin,
    text: "The Ahlam Auto-Poster fills supported listing fields and attaches compatible photos in the seller's browser.",
    note: "The seller makes the final Publish decision.",
  },
  {
    name: "OfferUp",
    label: "Mobile handoff",
    logo: "/logos/offerup.svg",
    icon: PackageCheck,
    text: "Ahlam prepares the title, price, description, and photos for a handoff to the OfferUp phone app.",
    note: "Included in Max and Ultimate channel access.",
  },
];

const proofPoints = [
  { icon: BarChart3, title: "See buyer activity", text: "Track views, inquiries, active listings, sold revenue, and conversion—not just inventory value." },
  { icon: MessageCircle, title: "Work every lead", text: "Keep buyer conversations together and move each one through open, deal, or closed." },
  { icon: MapPin, title: "Find the part again", text: "Assign yard locations, create barcodes, and print labels after the listing is live." },
  { icon: Globe2, title: "Check fitment", text: "Use VIN- or part-based interchange assistance before promising compatibility." },
];

const pilotMetrics = [
  "Real listings approved and published",
  "Channels reached per part",
  "Buyer views and inquiries",
  "Deals and sold revenue",
  "Staff time spent per listing",
];

export function SalesDemo() {
  const [planPrice, setPlanPrice] = useState(100);
  const [grossProfit, setGrossProfit] = useState(150);
  const [extraSales, setExtraSales] = useState(1);

  const result = useMemo(() => {
    const safeProfit = Math.max(0, Number.isFinite(grossProfit) ? grossProfit : 0);
    const safeSales = Math.max(0, Number.isFinite(extraSales) ? Math.floor(extraSales) : 0);
    const incremental = safeProfit * safeSales;
    return {
      incremental,
      afterSoftware: incremental - planPrice,
      breakEven: safeProfit > 0 ? Math.ceil(planPrice / safeProfit) : null,
    };
  }, [extraSales, grossProfit, planPrice]);

  return (
    <div className="cs-landing-body" style={{ position: "relative", zIndex: 1 }}>
      <section className="cs-demo-hero" style={{ position: "relative", overflow: "hidden" }}>
        <div className="cs-grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div className="cs-demo-hero-grid" style={{ maxWidth: 1140, margin: "0 auto", padding: "92px 24px 76px", display: "grid", gridTemplateColumns: "0.92fr 1.08fr", gap: 56, alignItems: "center" }}>
          <div>
            <div className="cs-kicker">Field demo · built for dismantlers</div>
            <h1 className="cs-display" style={{ fontSize: "clamp(42px, 5.7vw, 72px)", lineHeight: 0.98, margin: "18px 0 22px", maxWidth: 650 }}>
              Put more of every vehicle <span className="accent">in front of buyers.</span>
            </h1>
            <p style={{ color: "var(--muted)", fontSize: 18, lineHeight: 1.7, margin: 0, maxWidth: 620 }}>
              Photograph a vehicle or part. Ahlam identifies what can sell, drafts the details and a starting price, and prepares the inventory for your storefront and the marketplaces you already use. You review every listing.
            </p>
            <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginTop: 30 }}>
              <Link href="/?signup=1" className="cs-raise" style={primaryButton}>
                Start the free month <ArrowRight size={17} />
              </Link>
              <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" style={secondaryButton}>
                Book a 15-minute demo
              </a>
            </div>
            <div className="cs-demo-trust" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 25 }}>
              {["No card for the free month", "Seller approves every listing", "English + Spanish"].map((item) => (
                <span key={item} style={{ display: "inline-flex", gap: 7, alignItems: "center", color: "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>
                  <Check size={14} color="var(--success)" /> {item}
                </span>
              ))}
            </div>
          </div>
          <DemoVideo />
        </div>
      </section>

      <section style={sectionStyle}>
        <SectionHeading eyebrow="The actual workflow" title="Photos become review-ready inventory." body="Ahlam starts the work. Your shop stays responsible for the final facts, price, and publish decision." />
        <div className="cs-demo-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 38 }}>
          {[
            { n: "01", icon: Camera, title: "Photograph", text: "Add up to 15 angles, including the VIN plate when possible." },
            { n: "02", icon: ScanLine, title: "Identify", text: "AI proposes the vehicle, sellable parts, condition grades, and starting prices." },
            { n: "03", icon: ClipboardCheck, title: "Review", text: "Correct names, fitment, photos, grade, description, or price before saving." },
            { n: "04", icon: Globe2, title: "Publish", text: "Send the approved catalog to your storefront and prepare the right marketplace path." },
          ].map(({ n, icon: Icon, title, text }) => (
            <article key={n} className="cs-panel" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="cs-index" style={{ fontSize: 13 }}>{n}</span>
                <span style={iconTile}><Icon size={19} /></span>
              </div>
              <h3 style={{ fontSize: 19, margin: "22px 0 9px" }}>{title}</h3>
              <p style={cardText}>{text}</p>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: "13px 16px", borderRadius: 12, border: "1px solid color-mix(in srgb, var(--success) 30%, var(--line))", background: "color-mix(in srgb, var(--success) 7%, var(--surface))", display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: 13.5 }}>
          <ShieldCheck size={18} color="var(--success)" style={{ flexShrink: 0 }} />
          Everything is editable. Nothing posts from the manual listing flow until the seller saves or publishes it.
        </div>
      </section>

      <section style={{ ...sectionStyle, borderTop: "1px solid var(--line)" }}>
        <SectionHeading eyebrow="Meet buyers where they shop" title="One approved catalog. Four practical selling paths." body="Each marketplace works differently. Ahlam uses the supported workflow for that channel instead of pretending they are all the same." />
        <div className="cs-demo-two" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 38 }}>
          {channels.map(({ name, label, logo, icon: Icon, text, note }) => (
            <article key={name} className="cs-panel" style={{ padding: 24, display: "grid", gridTemplateColumns: "48px 1fr", gap: 16 }}>
              <span style={{ ...iconTile, width: 48, height: 48 }}>
                {logo ? <img src={logo} alt="" style={{ maxWidth: 30, maxHeight: 23 }} /> : <Icon size={21} />}
              </span>
              <div>
                <div className="cs-kicker" style={{ fontSize: 10 }}>{label}</div>
                <h3 style={{ fontSize: 19, margin: "8px 0" }}>{name}</h3>
                <p style={cardText}>{text}</p>
                <p style={{ ...cardText, marginTop: 9, fontSize: 12.5 }}><Check size={13} color="var(--success)" style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />{note}</p>
              </div>
            </article>
          ))}
        </div>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, margin: "18px 0 0" }}>
          Craigslist, Car-Part.com/URG, and DoorDash delivery are shown as coming soon—not sold as live features.
        </p>
      </section>

      <section style={{ ...sectionStyle, borderTop: "1px solid var(--line)" }}>
        <div className="cs-demo-proof" style={{ display: "grid", gridTemplateColumns: "0.84fr 1.16fr", gap: 54, alignItems: "start" }}>
          <div>
            <div className="cs-kicker">Proof you can open</div>
            <h2 className="cs-display" style={sectionTitle}>Show the live product, not a promise.</h2>
            <p style={sectionBody}>
              Ahlam already has public yard storefronts with searchable inventory. Use those to prove the publishing system is real, then use the 30-day pilot to prove whether it creates value for that specific shop.
            </p>
            <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
              <Link href="/shops" style={proofLink}>
                Browse Ahlam-powered shops <ChevronRight size={16} />
              </Link>
              <a href="https://downtownautodismantlers.ahlam.io/" target="_blank" rel="noopener noreferrer" style={proofLink}>
                Open a live yard storefront <ExternalLink size={15} />
              </a>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, marginTop: 16 }}>
              Live inventory proves the workflow is functioning. It is not a claim that every listing is error-free or that a shop earned a particular amount. Sellers should verify every AI-generated detail.
            </p>
          </div>
          <div className="cs-demo-two" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {proofPoints.map(({ icon: Icon, title, text }) => (
              <article className="cs-panel" key={title} style={{ padding: 21 }}>
                <span style={iconTile}><Icon size={18} /></span>
                <h3 style={{ fontSize: 17, margin: "17px 0 8px" }}>{title}</h3>
                <p style={cardText}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="calculator" style={{ ...sectionStyle, borderTop: "1px solid var(--line)" }}>
        <SectionHeading eyebrow="Use the yard's own numbers" title="What would make Ahlam pay for itself?" body="This is break-even planning—not a sales guarantee. Change the assumptions in front of the owner." />
        <div className="cs-demo-calculator" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 20, marginTop: 38 }}>
          <div className="cs-panel" style={{ padding: 26 }}>
            <label style={fieldLabel}>Plan after the free month</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 23 }}>
              {plans.map((plan) => (
                <button key={plan.name} onClick={() => setPlanPrice(plan.price)} aria-pressed={planPrice === plan.price}
                  style={{ padding: "11px 8px", borderRadius: 10, border: `1px solid ${planPrice === plan.price ? "var(--accent)" : "var(--line)"}`, background: planPrice === plan.price ? "var(--accent-tint)" : "var(--surface2)", color: "var(--foreground)", fontFamily: "inherit", fontWeight: 700 }}>
                  {plan.name}<span className="tnum" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>${plan.price}/mo</span>
                </button>
              ))}
            </div>
            <NumberField label="Average gross profit on one extra part sale" value={grossProfit} onChange={setGrossProfit} prefix="$" min={0} step={25} />
            <NumberField label="Additional part sales in one month" value={extraSales} onChange={setExtraSales} min={0} step={1} />
            <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.55, margin: "18px 0 0" }}>
              Use gross profit after the cost of the part—not the sale price. This calculator does not include marketplace fees, shipping, labor, returns, taxes, or other overhead.
            </p>
          </div>
          <div className="cs-panel" style={{ padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "color-mix(in srgb, var(--accent) 5%, var(--surface))" }}>
            <div>
              <span style={{ ...iconTile, color: "var(--accent)" }}><Calculator size={20} /></span>
              <div className="cs-kicker" style={{ marginTop: 24 }}>Illustrative monthly math</div>
              <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(48px, 7vw, 74px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 11, color: result.afterSoftware >= 0 ? "var(--success)" : "var(--foreground)" }}>
                {result.afterSoftware >= 0 ? "+" : "−"}${Math.abs(result.afterSoftware).toLocaleString()}
              </div>
              <p style={{ ...sectionBody, marginTop: 12 }}>estimated gross profit after the ${planPrice}/month software cost</p>
            </div>
            <div className="cs-well" style={{ padding: 17, marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, fontSize: 13.5, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                <span style={{ color: "var(--muted)" }}>Incremental gross profit</span>
                <strong className="tnum">${result.incremental.toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, fontSize: 13.5, paddingTop: 10 }}>
                <span style={{ color: "var(--muted)" }}>Break-even sales</span>
                <strong className="tnum">{result.breakEven === null ? "—" : result.breakEven}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyle, borderTop: "1px solid var(--line)" }}>
        <div className="cs-demo-pilot" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <div className="cs-kicker">The 30-day proof</div>
            <h2 className="cs-display" style={sectionTitle}>Do not debate ROI. Measure it.</h2>
            <p style={sectionBody}>
              Use the free first month on real inventory. Agree on a small batch, record the starting point, and review the numbers together after 30 days.
            </p>
          </div>
          <div className="cs-panel" style={{ padding: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={iconTile}><Zap size={19} /></span>
              <div>
                <strong style={{ display: "block" }}>Pilot scorecard</strong>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Five numbers the owner can verify</span>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {pilotMetrics.map((metric) => (
                <div key={metric} className="cs-well" style={{ padding: "11px 13px", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
                  <Check size={14} color="var(--success)" /> {metric}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingBottom: 110 }}>
        <div className="cs-panel" style={{ padding: "clamp(28px, 5vw, 56px)", textAlign: "center", borderColor: "color-mix(in srgb, var(--accent) 42%, var(--line))" }}>
          <CircleDollarSign size={30} color="var(--accent)" style={{ margin: "0 auto 18px" }} />
          <div className="cs-kicker">First month free · no card</div>
          <h2 className="cs-display" style={{ ...sectionTitle, maxWidth: 720, margin: "14px auto" }}>Use one real vehicle. Let the shop judge the result.</h2>
          <p style={{ ...sectionBody, maxWidth: 680, margin: "0 auto" }}>Growth includes up to 10 AI vehicle scans, unlimited manual listings, eBay and Facebook workflows, a storefront, marketplace access, analytics, and owner/editor access during the trial.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 11, flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/?signup=1" className="cs-raise" style={primaryButton}>Start free <ArrowRight size={17} /></Link>
            <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" style={secondaryButton}>Book the demo</a>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 11.5, margin: "18px 0 0" }}>No guaranteed sales. Results depend on inventory, pricing, demand, listing accuracy, response time, shipping, and the channels used.</p>
        </div>
      </section>
    </div>
  );
}

function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) video.play().catch(() => {}); else video.pause(); },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div className="cs-frame">
        <div className="cs-frame__bar">
          <span className="cs-frame__dot" style={{ background: "#ff5f57" }} />
          <span className="cs-frame__dot" style={{ background: "#febc2e" }} />
          <span className="cs-frame__dot" style={{ background: "#28c840" }} />
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700 }}>Ahlam · 60-second walkthrough</span>
          <span className="cs-demo-audio" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--muted)" }}><VolumeOff size={11} /> Captions on screen</span>
        </div>
        <video ref={ref} src="/video/ahlam-demo-16x9.mp4" poster="/video/ahlam-demo-poster.jpg" muted loop playsInline controls preload="metadata"
          aria-label="Ahlam demo showing a vehicle scan, AI-generated parts, seller review, and marketplace preparation"
          style={{ display: "block", width: "100%", height: "auto", background: "#000" }} />
      </div>
      <div className="cs-well" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 12, overflow: "hidden" }}>
        {["Photo + VIN", "Review details", "Reach buyers"].map((label, index) => (
          <span key={label} style={{ padding: "11px 8px", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: index === 1 ? "var(--foreground)" : "var(--muted)", borderLeft: index ? "1px solid var(--line)" : "none" }}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="cs-kicker">{eyebrow}</div>
      <h2 className="cs-display" style={sectionTitle}>{title}</h2>
      <p style={sectionBody}>{body}</p>
    </div>
  );
}

function NumberField({ label, value, onChange, prefix, min, step }: { label: string; value: number; onChange: (value: number) => void; prefix?: string; min: number; step: number }) {
  return (
    <label style={{ display: "block", marginTop: 17 }}>
      <span style={fieldLabel}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface2)", overflow: "hidden" }}>
        {prefix && <span style={{ paddingLeft: 14, color: "var(--muted)", fontWeight: 700 }}>{prefix}</span>}
        <input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))}
          style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "var(--foreground)", padding: prefix ? "12px 14px 12px 6px" : "12px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 16 }} />
      </span>
    </label>
  );
}

const sectionStyle: CSSProperties = { maxWidth: 1140, margin: "0 auto", padding: "82px 24px" };
const sectionTitle: CSSProperties = { fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.08, letterSpacing: "-0.025em", margin: "14px 0" };
const sectionBody: CSSProperties = { color: "var(--muted)", fontSize: 16, lineHeight: 1.7, margin: 0 };
const cardText: CSSProperties = { color: "var(--muted)", fontSize: 13.5, lineHeight: 1.62, margin: 0 };
const fieldLabel: CSSProperties = { display: "block", color: "var(--muted)", fontSize: 12.5, fontWeight: 700, marginBottom: 8 };
const iconTile: CSSProperties = { width: 40, height: 40, display: "inline-grid", placeItems: "center", borderRadius: 10, background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--line))" };
const primaryButton: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 999, border: 0, background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" };
const secondaryButton: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontWeight: 700, textDecoration: "none" };
const proofLink: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 15px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 700, textDecoration: "none" };
