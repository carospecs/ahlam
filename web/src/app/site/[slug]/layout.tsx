import { notFound, redirect } from "next/navigation";
import { getShopBySlug } from "@/lib/shop-site";
import { hasPersonalSite } from "@/lib/slug";
import { ShopSiteHeader } from "@/components/site/ShopSiteHeader";

// Layout for the Ultimate personal websites. Only ever reached through the
// middleware host rewrite ({slug}.ahlam.io → /site/[slug]/…) — direct hits on
// /site are 404'd there.

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

export default async function ShopSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  // Lapsed or downgraded plan: send visitors (and link equity) to the shop's
  // marketplace storefront. A temporary redirect, deliberately — the site
  // comes right back when the plan does.
  if (!hasPersonalSite(shop)) redirect(`${SITE_URL}/shop/${shop.id}`);

  return (
    <>
      {/* The personal sites default to the light (Paper) theme — a shop's own
          website should read like a business site, not the app. Runs before
          this subtree paints; respects an explicit dark choice. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('cs-theme')!=='dark')document.documentElement.setAttribute('data-theme','light');}catch(e){document.documentElement.setAttribute('data-theme','light');}`,
        }}
      />
      <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
        <ShopSiteHeader shop={shop} />
        {children}
      </main>
    </>
  );
}
