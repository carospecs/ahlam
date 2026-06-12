import type { Metadata } from "next";
import Link from "next/link";
import { Camera, ScanLine, Send, ShieldCheck, Boxes, Tag, Clock, CheckCircle2 } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { WaitlistForm } from "@/components/WaitlistForm";

export const metadata: Metadata = {
  title: "Join the waitlist — be first in when Ahlam launches",
  description:
    "Ahlam turns a photo of an auto part into a priced, ready-to-post listing. Sign up for the waitlist and we'll invite you to the free pilot the moment we launch.",
  alternates: { canonical: "/waitlist" },
  openGraph: {
    title: "Join the Ahlam waitlist",
    description:
      "Photograph a part, let AI identify, grade and price it, then post anywhere you sell. Get early access — drop your email.",
    type: "website",
  },
};

const STEPS = [
  { icon: Camera, title: "Snap a photo", desc: "Take a picture of the part — no parts expert needed on staff." },
  { icon: ScanLine, title: "AI identifies & grades it", desc: "It names the part, finds the fitment, grades condition, and prices it from real comps." },
  { icon: Send, title: "Post everywhere", desc: "Review the card, then cross-post to eBay, Facebook, OfferUp, Craigslist and Car-Part.com." },
];

const FEATURES = [
  { icon: Boxes, title: "Expert interchange", desc: "Cross-reference fitment across vehicles — even hybrid drivetrains — with a verify-manually fallback on tricky modules." },
  { icon: Tag, title: "Smart pricing", desc: "AI prices from live market comps with a range and basis, and flags volatile commodities like catalytic converters." },
  { icon: ShieldCheck, title: "Warranty & buyer trust", desc: "Per-listing warranty, shop returns policy, escrow payments, and seller verification built in." },
  { icon: Clock, title: "Minutes, not hours", desc: "Go from a pile of parts to live listings across every marketplace in a fraction of the time." },
];

export default function WaitlistPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <PublicHeader />

      {/* Hero */}
      <section className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 24px 60px", display: "grid", gap: 40, gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", alignItems: "center" }} className="cs-waitlist-hero">
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "5px 12px" }}>
              <Clock size={14} /> Launching soon — free pilot
            </span>
            <h1 style={{ margin: "16px 0 12px", fontSize: 40, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.03em" }}>
              Be first in line when Ahlam launches.
            </h1>
            <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", maxWidth: 520 }}>
              Ahlam turns a photo of any auto part into a priced, ready-to-post listing — no parts expert required. Sign up for the waitlist and we&apos;ll invite you to the free pilot the moment we go live. Just drop your email and submit.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color="var(--accent)" /> No card required</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color="var(--accent)" /> 30–60 day pilot</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color="var(--accent)" /> Early shops invited first</span>
            </div>
          </div>

          {/* Sign-up card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 24, boxShadow: "0 30px 80px -40px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Join the waitlist</div>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
              Put your email below and hit submit — we&apos;ll email you the moment your pilot invite is ready.
            </p>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "52px 24px 8px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", textAlign: "center" }}>How Ahlam works</h2>
        <p style={{ margin: "0 auto 28px", fontSize: 15, color: "var(--muted)", textAlign: "center", maxWidth: 560, lineHeight: 1.6 }}>
          The bottleneck isn&apos;t listing speed — it&apos;s the expertise to identify a part correctly. Ahlam removes it.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}><s.icon size={19} color="var(--accent)" /></span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>Step {i + 1}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>{s.title}</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "44px 24px 8px" }}>
        <h2 style={{ margin: "0 0 28px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", textAlign: "center" }}>Built for real salvage yards</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }} className="cs-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 22 }} className="cs-hover-card">
              <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--accent-tint)", display: "grid", placeItems: "center", marginBottom: 12 }}><f.icon size={19} color="var(--accent)" /></span>
              <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 5 }}>{f.title}</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "52px 24px 72px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 28, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Ready when we are?</h2>
          <p style={{ margin: "0 auto 18px", fontSize: 14.5, color: "var(--muted)", maxWidth: 460, lineHeight: 1.6 }}>
            Join the waitlist now and skip the line at launch. It takes ten seconds and there&apos;s no commitment.
          </p>
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <WaitlistForm compact />
          </div>
          <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Want to read up first? Browse our <Link href="/guides" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>guides</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
