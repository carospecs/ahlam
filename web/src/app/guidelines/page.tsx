import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Marketplace Guidelines · Ahlam",
  description:
    "The rules for listing, buying, and selling used auto parts on Ahlam: accurate listings, prohibited items, and how we enforce them.",
  alternates: { canonical: "/guidelines" },
};

const UPDATED = "July 3, 2026";

// Copy rule: no em dashes in any user-facing string.
const SECTIONS: LegalSection[] = [
  {
    heading: "Why these rules exist",
    paragraphs: [
      "Buyers come to Ahlam shops because a part is what the listing says it is. These guidelines protect that trust. They apply to every listing on ahlam.io, whether a buyer finds it on your storefront, a public part page, or a marketplace you cross-posted to.",
    ],
  },
  {
    heading: "List parts accurately",
    paragraphs: ["Every listing should describe the actual part in your hands."],
    bullets: [
      "Use real photos of the exact part you are selling, not stock photos or photos of a similar part.",
      "Grade condition honestly. If our AI suggests a grade you know is too generous, lower it before you publish.",
      "Disclose known damage, wear, missing pieces, and anything else a reasonable buyer would want to know.",
      "State fitment correctly: the vehicle, years, and trims the part actually came from or fits.",
      "Price the part you are selling. Do not use a low price as bait and quote a different one in messages.",
    ],
  },
  {
    heading: "Honor what your listing promises",
    paragraphs: [
      "The warranty and returns terms you set on a listing are your promise to the buyer. If you offer a 30 day warranty, honor it. If you sell as is, say so clearly and the listing will show it. Respond to buyer messages in a reasonable time, and complete sales you have agreed to at the agreed price.",
    ],
  },
  {
    heading: "Prohibited listings",
    paragraphs: ["These may never be listed on Ahlam. This list is not exhaustive, and we may remove anything that creates a safety or legal risk."],
    bullets: [
      "Stolen parts, or parts you do not have the right to sell.",
      "Parts with a removed, altered, or defaced VIN, serial number, or identification mark.",
      "Airbags, seat belt assemblies, and other safety restraint components where resale is prohibited or restricted by the law that applies to you.",
      "Parts under an open safety recall presented as safe or repaired when they are not.",
      "Counterfeit parts, or parts misrepresented as OEM when they are not.",
      "Hazardous materials that cannot legally be sold or shipped, such as refrigerant without required certification.",
      "Anything that is not an automotive part or accessory.",
    ],
  },
  {
    heading: "Buyer conduct",
    paragraphs: ["Buyers keep the marketplace healthy too."],
    bullets: [
      "Make offers you intend to honor, and pay the agreed amount.",
      "Show up for pickups you schedule, or let the seller know you cannot.",
      "Keep messages civil. No harassment, threats, slurs, or spam.",
      "Do not use Ahlam messages to scam sellers or move deals to payment methods designed to defraud.",
    ],
  },
  {
    heading: "Enforcement",
    paragraphs: [
      "Depending on severity, we may remove a listing, warn the account, suspend it, or terminate it. Fraud, stolen goods, and safety violations lead to immediate removal, and we cooperate with law enforcement where required. We may also review message history when a report involves a dispute between a buyer and a seller.",
    ],
  },
  {
    heading: "Reporting a listing or a user",
    paragraphs: [
      "See a listing or message that breaks these rules? Email mohammadabbas@ahlam.io with a link to the listing or shop and a short description, and we will review it.",
    ],
  },
];

export default function GuidelinesPage() {
  return (
    <LegalPage
      title="Marketplace Guidelines"
      updated={UPDATED}
      intro="The rules that keep Ahlam listings honest: real photos, honest grades, no prohibited parts, and promises that get honored."
      sections={SECTIONS}
      currentPath="/guidelines"
    />
  );
}
