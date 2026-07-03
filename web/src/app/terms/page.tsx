import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service · Ahlam",
  description:
    "The terms that govern your use of Ahlam: accounts, subscriptions, listings, buying and selling between users, and our AI features.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "July 3, 2026";

// Copy rule: no em dashes in any user-facing string.
const SECTIONS: LegalSection[] = [
  {
    heading: "Agreement to these terms",
    paragraphs: [
      "These Terms of Service are a contract between you and Ahlam Inc., a Delaware corporation (\"Ahlam\", \"we\", \"us\"). By creating an account or using the Ahlam web application at ahlam.io, the Ahlam mobile app, or the Ahlam Auto-Poster browser extension, you agree to these terms, our Privacy Policy, our Acceptable Use Policy, and our Marketplace Guidelines.",
      "You must be at least 18 years old to use Ahlam. If you use Ahlam on behalf of a business, you confirm you have authority to bind that business to these terms.",
    ],
  },
  {
    heading: "What Ahlam does",
    paragraphs: [
      "Ahlam helps used auto parts sellers photograph, identify, grade, price, and list their inventory. That includes AI-assisted part identification and pricing, listing creation, cross-posting to outside marketplaces, a public storefront and part pages for your shop, and messaging between buyers and sellers.",
    ],
  },
  {
    heading: "Your account",
    paragraphs: [
      "Keep your account information accurate and your login credentials secure. You are responsible for activity that happens under your account, including team members you invite to your shop. Tell us right away at mohammadabbas@ahlam.io if you believe your account has been accessed without permission.",
    ],
  },
  {
    heading: "Subscriptions, billing, and cancellation",
    paragraphs: [
      "Paid plans are billed monthly in advance through Stripe, our payment processor. New shops may receive a free trial period, and we will always tell you the length of your trial before it starts. No card is required during the trial.",
      "You can cancel your subscription at any time from your billing settings. When you cancel, you keep access through the end of the period you already paid for, and you will not be billed again. We do not give refunds for partial billing periods. Our Refunds and Cancellation policy has the details.",
      "If we change a plan's price, we will give you at least 30 days notice by email before the new price applies to you.",
    ],
  },
  {
    heading: "Buying and selling between users",
    paragraphs: [
      "Ahlam is a listing and communication tool, not a party to sales between buyers and sellers. We do not process buyer payments, hold funds, or take a cut of your sales. Buyers and sellers agree on price, payment method, and pickup or shipping directly, through Ahlam messages or however else they choose.",
      "Each listing shows the warranty and returns terms the seller set for that part, and those terms are a promise from the seller, not from Ahlam. We do not inspect parts, guarantee their condition, or guarantee that a sale will complete. Disputes about a part or a payment are between the buyer and the seller. We may help by providing message records, and we may remove sellers who repeatedly misdescribe parts or break their promises, but we are not obligated to mediate.",
    ],
  },
  {
    heading: "Your content",
    paragraphs: [
      "You own the photos, listings, and messages you create on Ahlam. You give us permission to host, display, and distribute that content so the service works: for example, showing your listings on your public storefront, in search results, and on the outside marketplaces you choose to post to.",
      "You are responsible for having the right to sell what you list and for the accuracy of your listings.",
    ],
  },
  {
    heading: "AI features",
    paragraphs: [
      "Ahlam uses AI to identify parts from photos, suggest condition grades, and suggest prices. These are estimates to save you time, not guarantees. You review every listing before it goes live, and you are responsible for the final content of your listings and for complying with the laws that apply to the parts you sell.",
    ],
  },
  {
    heading: "Outside marketplaces",
    paragraphs: [
      "When you cross-post to eBay, Facebook Marketplace, OfferUp, Craigslist, or any other marketplace, that marketplace's own terms apply to your post. The Ahlam Auto-Poster extension fills the post form for you but never publishes anything itself: you review and click publish. Ahlam is not affiliated with or endorsed by any of these marketplaces.",
    ],
  },
  {
    heading: "Acceptable use and listing rules",
    paragraphs: [
      "Our Acceptable Use Policy covers how you may use the service, and our Marketplace Guidelines cover what may be listed and how buyers and sellers should treat each other. Both are part of these terms.",
    ],
  },
  {
    heading: "Suspension and termination",
    paragraphs: [
      "You can close your account at any time by emailing us. We may suspend or terminate accounts that violate these terms, our Acceptable Use Policy, or our Marketplace Guidelines, or that create legal risk for Ahlam or other users. Where reasonable, we will warn you first.",
      "Sections that by their nature should survive termination, such as your responsibility for your listings, our disclaimers, and the limitation of liability, survive it.",
    ],
  },
  {
    heading: "Disclaimers",
    paragraphs: [
      "Ahlam is provided as is and as available. We do not promise the service will be uninterrupted or error free, that AI identifications or prices will be accurate, or that any part listed on Ahlam is as described by its seller.",
    ],
  },
  {
    heading: "Limitation of liability",
    paragraphs: [
      "To the fullest extent the law allows, Ahlam's total liability for any claim related to the service is limited to the amount you paid us in the 12 months before the claim. We are not liable for indirect, incidental, or consequential damages, or for losses arising from transactions between buyers and sellers. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.",
    ],
  },
  {
    heading: "Indemnification",
    paragraphs: [
      "If a third party brings a claim against Ahlam because of your listings, your sales, or your breach of these terms, you agree to cover the losses and reasonable legal costs we incur from that claim.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms as the service evolves. If a change is material, we will notify you by email or in the app before it takes effect. Continuing to use Ahlam after a change takes effect means you accept the updated terms.",
    ],
  },
  {
    heading: "Governing law and disputes",
    paragraphs: [
      "These terms are governed by the laws of the State of Delaware, without regard to its conflict of laws rules. Before filing any claim, contact us at mohammadabbas@ahlam.io and we will try in good faith to resolve it informally. Any dispute that cannot be resolved informally will be brought in the state or federal courts located in Delaware.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about these terms? Email mohammadabbas@ahlam.io and we will help.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={UPDATED}
      intro="The plain-language contract for using Ahlam. The short version: be honest in your listings, you can cancel anytime, and sales happen directly between buyers and sellers."
      sections={SECTIONS}
      currentPath="/terms"
    />
  );
}
