import type { Metadata } from "next";
import Link from "next/link";
import { Camera, ScanLine, Send, ShieldCheck, Boxes, Tag, Clock, CheckCircle2 } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Join the waitlist: be first in when Ahlam launches",
  description:
    "Ahlam turns a photo of an auto part into a priced, ready-to-post listing. Join the waitlist and we'll invite you to the free pilot the moment we launch.",
  alternates: { canonical: "/waitlist" },
  openGraph: {
    title: "Join the Ahlam waitlist",
    description:
      "Photograph a part, let AI identify, grade, and price it, then post anywhere you sell. Get early access, just drop your email.",
    type: "website",
  },
};

const STEPS = [
  { icon: Camera, title: "Snap a photo", desc: "Take a picture of the part. No parts expert needed on staff." },
  { icon: ScanLine, title: "AI identifies and grades it", desc: "It names the part, finds the fitment, grades condition, and prices it from real comps." },
  { icon: Send, title: "Post everywhere", desc: "Review the card, then cross-post to eBay, Facebook, OfferUp, Craigslist, and Car-Part.com." },
];

const FEATURES = [
  { icon: Boxes, title: "Expert interchange", desc: "Cross-reference fitment across vehicles, even hybrid drivetrains, with a verify-manually fallback on tricky modules." },
  { icon: Tag, title: "Smart pricing", desc: "AI prices from live market comps with a range and basis, and flags volatile commodities like catalytic converters." },
  { icon: ShieldCheck, title: "Warranty and buyer trust", desc: "Per-listing warranty, shop returns policy, escrow payments, and seller verification built in." },
  { icon: Clock, title: "Minutes, not hours", desc: "Go from a pile of parts to live listings across every marketplace in a fraction of the time." },
];

export default function WaitlistPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <PublicHeader />

        {/* Hero */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="cs-waitlist-hero" style={{ maxWidth: 1040, margin: "0 auto", padding: "60px 24px 64px", display: "grid", gap: 44, gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", alignItems: "center" }}>
            <Reveal>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "5px 12px" }}>
                <Clock size={14} /> Launching right after the Fourth of July weekend. Free pilot.
              </span>
              <h1 className="cs-display" style={{ margin: "18px 0 14px", fontSize: 46, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.02em" }}>
                Be first in line when <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 500 }}>Ahlam</span> launches.
              </h1>
              <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", maxWidth: 520 }}>
                Ahlam turns a photo of any auto part into a priced, ready-to-post listing, no parts expert required. Join the waitlist and we&apos;ll invite you to the free pilot the moment we go live. Just drop your email and submit.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color="var(--accent)" /> No card required</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color="var(--accent)" /> 30 to 60 day pilot</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color="var(--accent)" /> Early shops invited first</span>
              </div>
            </Reveal>

            {/* Sign-up card */}
            <Reveal delay={0.12} className="cs-glass" style={{ borderRadius: "var(--radius-xl)", padding: 26, border: "1.5px solid color-mix(in srgb, var(--accent) 45%, var(--line))" }}>
              <div className="cs-eyebrow" style={{ marginBottom: 8 }}>Early access</div>
              <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Join the waitlist</div>
              <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
                Put your email below and hit submit. We&apos;ll email you the moment your pilot invite is ready.
              </p>
              <WaitlistForm />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 24px 8px" }}>
          <Reveal style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 32px" }}>
            <div className="cs-eyebrow">How it works</div>
            <h2 className="cs-display" style={{ margin: "10px 0 8px", fontSize: 32, fontWeight: 600, letterSpacing: "-0.015em" }}>From a photo to a listing</h2>
            <p style={{ margin: 0, fontSize: 15, color: "var(--muted)", lineHeight: 1.6 }}>
              The bottleneck was never listing speed. It was the expertise to identify a part correctly. Ahlam removes it.
            </p>
          </Reveal>
          <RevealStagger style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {STEPS.map((s, i) => (
              <RevealItem key={s.title} style={{ height: "100%" }}>
                <div className="cs-glass" style={{ borderRadius: "var(--radius-lg)", padding: 22, height: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}><s.icon size={19} color="var(--accent)" /></span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>Step {i + 1}</span>
                  </div>
                  <div className="cs-display" style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        {/* Feature grid */}
        <section style={{ maxWidth: 840, margin: "0 auto", padding: "48px 24px 8px" }}>
          <Reveal style={{ textAlign: "center", marginBottom: 30 }}>
            <div className="cs-eyebrow">Built for real yards</div>
            <h2 className="cs-display" style={{ margin: "10px 0 0", fontSize: 32, fontWeight: 600, letterSpacing: "-0.015em" }}>Everything a salvage yard needs</h2>
          </Reveal>
          <RevealStagger style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }} className="cs-feature-grid">
            {FEATURES.map((f) => (
              <RevealItem key={f.title} style={{ height: "100%" }}>
                <div className="cs-glass cs-hover-card" style={{ borderRadius: "var(--radius-lg)", padding: 22, height: "100%" }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-tint)", display: "grid", placeItems: "center", marginBottom: 12 }}><f.icon size={20} color="var(--accent)" /></span>
                  <div className="cs-display" style={{ fontSize: 18, fontWeight: 600, marginBottom: 7, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>{f.title}</div>
                  <p style={{ margin: "9px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        {/* Closing CTA */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px" }}>
          <Reveal className="cs-glass" style={{ borderRadius: "var(--radius-xl)", padding: 30, textAlign: "center", border: "1.5px solid color-mix(in srgb, var(--accent) 40%, var(--line))" }}>
            <h2 className="cs-display" style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.015em" }}>Ready when we are?</h2>
            <p style={{ margin: "0 auto 18px", fontSize: 14.5, color: "var(--muted)", maxWidth: 460, lineHeight: 1.6 }}>
              Join the waitlist now and skip the line at launch. It takes ten seconds and there is no commitment.
            </p>
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
              <WaitlistForm compact />
            </div>
            <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Want to read up first? Browse our <Link href="/guides" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>guides</Link>.
            </p>
          </Reveal>
        </section>
      </div>
    </main>
  );
}
