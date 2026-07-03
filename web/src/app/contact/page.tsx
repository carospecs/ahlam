import type { Metadata } from "next";
import Link from "next/link";
import { Mail, CalendarCheck, MessageSquare, ShieldAlert, Clock, BookOpen } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/Reveal";
import { LEGAL_PAGES } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Contact & Support · Ahlam",
  description:
    "Get help with Ahlam: email support, book a live demo, send feedback, or report a listing. Real humans, one business day.",
  alternates: { canonical: "/contact" },
};

// Copy rule: no em dashes in any user-facing string.

const CONTACT = "mohammadabbas@ahlam.io";
const RECIPIENTS = "mohammadabbas@ahlam.io,andygarcia@ahlam.io";
const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";

const CARDS = [
  {
    icon: Mail,
    title: "Email support",
    body: "Billing, account access, bugs, or anything else. This inbox goes straight to the founders.",
    cta: CONTACT,
    href: `mailto:${RECIPIENTS}`,
    external: true,
  },
  {
    icon: CalendarCheck,
    title: "Book a 15-min demo",
    body: "See Ahlam on your own inventory. We will photograph a part live and list it while you watch.",
    cta: "Pick a time",
    href: CAL_DEMO_URL,
    external: true,
  },
  {
    icon: MessageSquare,
    title: "Send feedback",
    body: "Missing a feature? Something feels slow or wrong? Tell us, we ship fixes weekly.",
    cta: "Share feedback",
    href: `mailto:${RECIPIENTS}?subject=Ahlam%20feedback`,
    external: true,
  },
  {
    icon: ShieldAlert,
    title: "Report a listing or user",
    body: "Saw a listing that breaks our Marketplace Guidelines, or a user acting in bad faith? Send us the link.",
    cta: "Report it",
    href: `mailto:${RECIPIENTS}?subject=Report%20a%20listing`,
    external: true,
  },
];

export default function ContactPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <PublicHeader />

        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 32px" }}>
            <Reveal>
              <div className="cs-eyebrow">Support</div>
              <h1 className="cs-display" style={{ margin: "10px 0 10px", fontSize: "clamp(34px, 4.6vw, 46px)", fontWeight: 600, letterSpacing: "-0.02em" }}>Contact us</h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 15.5, lineHeight: 1.7, maxWidth: 560 }}>
                Ahlam is built by a small team, so your message lands with a founder, not a ticket queue. We reply within one business day, usually much faster.
              </p>
            </Reveal>
          </div>
        </section>

        <section style={{ maxWidth: 760, margin: "0 auto", padding: "36px 24px 12px" }}>
          <div className="cs-faq-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {CARDS.map((c) => (
              <Reveal key={c.title}>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", padding: 20, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", textDecoration: "none", color: "var(--foreground)" }}
                >
                  <span style={{ display: "inline-grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                    <c.icon size={18} />
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{c.title}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>{c.body}</span>
                  <span style={{ marginTop: "auto", fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>{c.cta} →</span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 760, margin: "0 auto", padding: "20px 24px 64px" }}>
          <Reveal>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 18, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <Clock size={17} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--muted)" }}>
                <strong style={{ color: "var(--foreground)" }}>Response times.</strong> Email is answered within one business day, Monday through Friday. Anything that blocks you from selling, like being locked out of your account, jumps the line.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div style={{ marginTop: 28 }}>
              <div className="cs-kicker" style={{ fontSize: 11, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                <BookOpen size={13} /> Answers without waiting
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.65, color: "var(--muted)" }}>
                Most billing and policy questions are already answered in writing:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEGAL_PAGES.map((p) => (
                  <Link key={p.href} href={p.href} style={{ fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--foreground)", textDecoration: "none", opacity: 0.85 }}>
                    {p.label}
                  </Link>
                ))}
                <Link href="/guides" style={{ fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--foreground)", textDecoration: "none", opacity: 0.85 }}>
                  Guides
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
