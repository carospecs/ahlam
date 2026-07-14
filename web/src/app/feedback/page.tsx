import type { Metadata } from "next";
import { MessageSquare, Wrench, Lightbulb } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FeedbackForm } from "@/components/FeedbackForm";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Feedback: help us build the right tool",
  description:
    "Tell us what's working, what's broken, and what's missing in Ahlam. Every note goes straight to both founders.",
  alternates: { canonical: "/feedback" },
};

const POINTS = [
  { icon: Wrench, title: "Something broken?", desc: "Tell us what you were doing and what happened. Bug reports jump the queue." },
  { icon: Lightbulb, title: "Something missing?", desc: "A marketplace, a workflow, a report you wish existed. Feature requests shape the roadmap." },
  { icon: MessageSquare, title: "Just a thought?", desc: "First impressions and gut reactions are exactly the feedback we can't get any other way." },
];

export default function FeedbackPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <SiteHeader />
      <main style={{ position: "relative", zIndex: 1 }}>
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="cs-waitlist-hero" style={{ maxWidth: 1040, margin: "0 auto", padding: "60px 24px 64px", display: "grid", gap: 44, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "start" }}>
            <Reveal>
              <div className="cs-kicker">Feedback</div>
              <h1 className="cs-display" style={{ margin: "14px 0 14px", fontSize: 44, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.02em" }}>
                Tell us what to <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 500 }}>build next</span>.
              </h1>
              <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", maxWidth: 480 }}>
                Ahlam is in beta and shaped directly by the yards and sellers using it. Every submission lands in both founders&apos; inboxes, unfiltered.
              </p>
              <div style={{ display: "grid", gap: 18, marginTop: 30 }}>
                {POINTS.map((p) => (
                  <div key={p.title} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                    <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "var(--accent-tint)", color: "var(--accent)", flexShrink: 0 }}><p.icon size={17} /></span>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.title}</div>
                      <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55, marginTop: 3 }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="cs-panel" style={{ padding: 26 }}>
                <FeedbackForm />
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
