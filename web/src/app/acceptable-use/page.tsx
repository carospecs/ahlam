import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Acceptable Use Policy · Ahlam",
  description:
    "What you may and may not do with the Ahlam service, the Auto-Poster extension, and other users' data.",
  alternates: { canonical: "/acceptable-use" },
};

const UPDATED = "July 3, 2026";

// Copy rule: no em dashes in any user-facing string.
const SECTIONS: LegalSection[] = [
  {
    heading: "The idea",
    paragraphs: [
      "Use Ahlam to run your parts business, and do not use it in ways that harm other users, the service, or anyone else. This policy is part of our Terms of Service. What may be listed for sale is covered separately in our Marketplace Guidelines.",
    ],
  },
  {
    heading: "You may not",
    paragraphs: [],
    bullets: [
      "Use Ahlam for anything illegal, fraudulent, or deceptive.",
      "Misrepresent who you are, impersonate another shop or person, or create accounts to evade a suspension.",
      "Harass, threaten, or abuse other users in messages or anywhere else on the service.",
      "Send spam, bulk unsolicited messages, or promotions unrelated to a genuine sale.",
      "Scrape, crawl, or bulk-harvest listings, shop pages, prices, or user data, whether by bot or by hand.",
      "Probe, scan, or test the security of the service, or access data or accounts that are not yours.",
      "Reverse engineer, copy, or resell the service, or share one account across multiple businesses.",
      "Use our AI features to generate deceptive listings or content that violates the Marketplace Guidelines.",
      "Interfere with the operation of the service, including overloading it or introducing malicious code.",
    ],
  },
  {
    heading: "The Auto-Poster extension",
    paragraphs: [
      "The Ahlam Auto-Poster extension exists to fill marketplace post forms with your own listings, with you reviewing and publishing each one. Only use it with your own Ahlam listings, and follow the terms of each marketplace you post to. Do not modify the extension or use it to automate anything else.",
    ],
  },
  {
    heading: "Enforcement",
    paragraphs: [
      "Violations can lead to content removal, warnings, suspension, or termination of your account, depending on severity. We report illegal activity to law enforcement where required. If we suspend your account by mistake, email us and we will take a second look.",
    ],
  },
  {
    heading: "Reporting abuse",
    paragraphs: [
      "If someone is misusing Ahlam, email mohammadabbas@ahlam.io with what you saw and where, and we will investigate.",
    ],
  },
];

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      updated={UPDATED}
      intro="Run your business, be straight with people, and leave the service and other users' data alone."
      sections={SECTIONS}
      currentPath="/acceptable-use"
    />
  );
}
