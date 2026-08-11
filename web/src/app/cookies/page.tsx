import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy · Ahlam",
  description:
    "The cookies Ahlam uses and why. Short answer: only what is needed to keep you signed in. No advertising or cross-site tracking cookies.",
  alternates: { canonical: "/cookies" },
};

const UPDATED = "July 3, 2026";

// Copy rule: no em dashes in any user-facing string.
const SECTIONS: LegalSection[] = [
  {
    heading: "The short version",
    paragraphs: [
      "Ahlam uses only the cookies it needs to work: keeping you signed in and remembering your preferences. We do not use advertising cookies, and we do not let third parties track you across the web from our pages.",
    ],
  },
  {
    heading: "What cookies are",
    paragraphs: [
      "Cookies are small text files a website stores in your browser so it can remember you between pages and visits. Browsers also offer local storage, which works similarly, and this policy covers both.",
    ],
  },
  {
    heading: "What Ahlam stores in your browser",
    paragraphs: [],
    bullets: [
      "Authentication cookies from our sign-in provider, so you stay signed in to your shop. Without these, the app cannot work.",
      "Preference storage, such as your theme choice, kept in your browser's local storage.",
      "Security essentials that help us tell real users from automated abuse.",
    ],
  },
  {
    heading: "Third parties",
    paragraphs: [
      "When you subscribe to a paid plan, checkout is handled by Stripe, and Stripe sets cookies on its checkout pages for security and fraud prevention. Stripe's own privacy and cookie policies apply there.",
      "When you cross-post a listing to an outside marketplace such as eBay, Facebook Marketplace, OfferUp, or Craigslist, those sites set their own cookies under their own policies. That happens on their pages, not ours.",
    ],
  },
  {
    heading: "Managing cookies",
    paragraphs: [
      "You can clear or block cookies in your browser settings at any time. Because every cookie we set is essential, blocking them will sign you out and prevent the app from working, but the public pages of ahlam.io will still be readable.",
    ],
  },
  {
    heading: "Changes and contact",
    paragraphs: [
      "If we ever add analytics or any new category of cookie, we will update this page first. Questions? Email mohammadabbas@ahlam.io.",
    ],
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated={UPDATED}
      intro="Only the essentials: cookies that keep you signed in, and nothing that follows you around the internet."
      sections={SECTIONS}
      currentPath="/cookies"
    />
  );
}
