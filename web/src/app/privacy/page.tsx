import type { Metadata } from "next";
import { PublicHeader } from "@/components/PublicHeader";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Privacy Policy · Ahlam",
  description:
    "How Ahlam and the Ahlam Auto-Poster browser extension handle your data: what we collect, how it is used, and what we never do with it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "June 22, 2026";

// Public privacy policy. Covers both the Ahlam web service and the Ahlam
// Auto-Poster Chrome extension (the Chrome Web Store listing links here).
// Copy rule: no em dashes in any user-facing string.
const SECTIONS: { heading: string; paragraphs: string[]; bullets?: string[] }[] = [
  {
    heading: "Who this covers",
    paragraphs: [
      "This policy applies to the Ahlam web application at ahlam.io and to the Ahlam Auto-Poster browser extension. Ahlam helps used auto parts sellers photograph, price, and list their inventory across marketplaces.",
    ],
  },
  {
    heading: "What the Ahlam web app collects",
    paragraphs: [
      "To run your account we store the information you give us and the listings you create.",
    ],
    bullets: [
      "Account details: your name, email, shop name, and login credentials (passwords are stored hashed by our authentication provider).",
      "Listing content: the photos you upload, the parts and vehicles you add, prices, descriptions, and the messages you exchange with buyers.",
      "Basic usage and device information needed to keep the service secure and working.",
    ],
  },
  {
    heading: "What the Ahlam Auto-Poster extension does with data",
    paragraphs: [
      "The extension exists only to fill marketplace post forms with a listing you chose to post. It is deliberately narrow.",
    ],
    bullets: [
      "It receives one listing (title, price, description, and photos) from your Ahlam account when you click to post.",
      "It downloads that listing's photos and fills the new-post form on the marketplace you opened (Facebook Marketplace, OfferUp, or Craigslist).",
      "It never submits a post for you. You review every listing and click Publish yourself.",
      "It stores the staged listing only briefly, in your browser, and clears it after filling the form.",
      "It does not send your data to Ahlam's servers or to any third party. The only place the data goes is the marketplace form you are posting to.",
    ],
  },
  {
    heading: "How we use your information",
    paragraphs: [
      "We use your information to provide the service: to identify and price parts, build listings, send buyer and seller message notifications by email, and let you post to the marketplaces you choose.",
    ],
  },
  {
    heading: "What we never do",
    paragraphs: [
      "We do not sell your personal information. We do not share it with advertisers. We do not use your listing content or photos for anything outside of running Ahlam for you.",
    ],
  },
  {
    heading: "Email notifications",
    paragraphs: [
      "When you receive a buyer or seller message, we send a notification email so you do not miss a sale. You can turn buyer-message emails off in your notification settings.",
    ],
  },
  {
    heading: "Data retention and deletion",
    paragraphs: [
      "We keep your account and listing data while your account is active. You can ask us to delete your account and its data at any time by emailing us.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about this policy or your data? Email mohammadabbas@ahlam.io and we will help.",
    ],
  },
];

export default function PrivacyPage() {
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
              <div className="cs-eyebrow">Legal</div>
              <h1 className="cs-display" style={{ margin: "10px 0 10px", fontSize: "clamp(34px, 4.6vw, 46px)", fontWeight: 600, letterSpacing: "-0.02em" }}>Privacy Policy</h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>Last updated {UPDATED}</p>
            </Reveal>
          </div>
        </section>

        <article style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 72px" }}>
          {SECTIONS.map((s, i) => (
            <Reveal key={i}>
              <section style={{ marginTop: i === 0 ? 0 : 34 }}>
                <h2 className="cs-display" style={{ fontSize: 23, fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.015em", paddingBottom: 9, borderBottom: "1px solid var(--line)" }}>{s.heading}</h2>
                {s.paragraphs.map((p, j) => (
                  <p key={j} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--foreground)", opacity: 0.88, margin: "0 0 12px" }}>{p}</p>
                ))}
                {s.bullets && (
                  <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
                    {s.bullets.map((b, k) => (
                      <li key={k} style={{ position: "relative", paddingLeft: 22, fontSize: 15.5, lineHeight: 1.65, color: "var(--foreground)", opacity: 0.88 }}>
                        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 9, width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          ))}
        </article>
      </div>
    </main>
  );
}
