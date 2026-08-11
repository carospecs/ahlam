import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Refunds & Cancellation · Ahlam",
  description:
    "How cancelling an Ahlam subscription works, when refunds apply, and how returns work for parts bought from sellers.",
  alternates: { canonical: "/refunds" },
};

const UPDATED = "July 3, 2026";

// Copy rule: no em dashes in any user-facing string.
const SECTIONS: LegalSection[] = [
  {
    heading: "The short version",
    paragraphs: ["Two different things can involve money on Ahlam, and they work differently."],
    bullets: [
      "Your Ahlam subscription: start with a free trial, cancel anytime, keep access until the end of the period you paid for. We do not refund partial months.",
      "Parts you buy from a seller: Ahlam does not process that payment. Returns and warranties are between you and the seller, on the terms shown on the listing.",
      "Billing mistakes on our side, like a duplicate charge or a charge after you cancelled, are always refunded in full.",
    ],
  },
  {
    heading: "Free trial",
    paragraphs: [
      "New shops start with a free trial with every feature unlocked and no card required. You will never be charged during a trial, and we tell you the trial length before it starts. If Ahlam is not for you, there is nothing to cancel and nothing to refund.",
    ],
  },
  {
    heading: "Cancelling your subscription",
    paragraphs: [
      "You can cancel at any time from your billing settings in the app, no phone call and no email required. If anything gets in your way, email mohammadabbas@ahlam.io and we will cancel it for you.",
      "When you cancel, your plan stays active until the end of the billing period you already paid for, and you will not be charged again. Your listings and data stay in your account, so you can come back later.",
    ],
  },
  {
    heading: "Refunds on subscription payments",
    paragraphs: [
      "After your free trial, subscription payments are not refundable, including for partial billing periods or months you did not log in. This is why we offer the trial first: you get to try everything before you pay anything.",
      "There are exceptions we will always honor. If we charged you twice, charged you after you cancelled, or made any other billing mistake, email us within 60 days of the charge and we will refund it in full.",
    ],
  },
  {
    heading: "Changing plans",
    paragraphs: [
      "You can move between plans at any time. Upgrades take effect right away. Downgrades take effect at your next billing date, so you keep what you paid for.",
    ],
  },
  {
    heading: "Parts bought from sellers",
    paragraphs: [
      "Ahlam does not process payments between buyers and sellers, hold funds, or take a cut of sales. When you buy a part from a shop on Ahlam, you pay the seller directly, in whatever way the two of you agree.",
      "Every listing shows the warranty and returns terms the seller set for that part, such as sold as is or a 30 day warranty. Those terms are the seller's promise to you. If something is wrong with a part, message the seller through Ahlam first, since that keeps a record of the conversation.",
      "If a seller repeatedly misdescribes parts or refuses to honor the terms on their own listings, report it to mohammadabbas@ahlam.io. We can review the message history and may remove sellers who break our Marketplace Guidelines, but we cannot refund a payment we never handled.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about billing, cancelling, or a charge you do not recognize? Email mohammadabbas@ahlam.io and we will sort it out.",
    ],
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds & Cancellation"
      updated={UPDATED}
      intro="Try Ahlam free, cancel anytime, and know exactly who to talk to when a part is not right."
      sections={SECTIONS}
      currentPath="/refunds"
    />
  );
}
