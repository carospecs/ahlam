import type { Metadata } from "next";
import { PublicHeader } from "@/components/PublicHeader";
import { SalesDemo } from "@/components/SalesDemo";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Ahlam demo for auto dismantlers",
  description:
    "See how Ahlam turns vehicle photos into editable used-parts listings, a public storefront, marketplace-ready drafts, and measurable buyer activity.",
  openGraph: {
    title: "Ahlam demo — put more parts in front of buyers",
    description:
      "A practical, seller-controlled listing workflow for independent auto dismantlers and used-parts shops.",
    type: "website",
  },
};

export default function DemoPage() {
  return (
    <main className="grain" style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <div className="cs-page-wash" aria-hidden="true" />
      <PublicHeader />
      <SalesDemo />
      <SiteFooter />
    </main>
  );
}
