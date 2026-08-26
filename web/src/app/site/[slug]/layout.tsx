import { notFound, redirect } from "next/navigation";
import { getShopBySlug } from "@/lib/shop-site";
import { hasPersonalSite } from "@/lib/slug";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { I18nProvider } from "@/lib/i18n";
import { ShopSiteHeader } from "@/components/site/ShopSiteHeader";

// Layout for the Ultimate personal websites. Only ever reached through the
// middleware host rewrite ({slug}.ahlam.io → /site/[slug]/…) — direct hits on
// /site are 404'd there.

export const dynamic = "force-dynamic";

// Google Search Console ownership for the {slug}.ahlam.io properties (holder:
// andygar1019@gmail.com). Rendered on every personal-site page so new shop
// subdomains can be claimed in GSC without another deploy.
export const metadata = {
  verification: { google: "d7ekD5fYyQHPfvXMHDQBPqTLA5oCggMUBjEDfjar_ic" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

// True when the visitor is signed in as a member of THIS shop — shows the
// "Dashboard" link back to ahlam.io in the header. Relies on the auth cookie
// being shared across ahlam.io and {slug}.ahlam.io (see lib/auth-cookie.ts);
// fails closed (no link) on any error, including the demo/preview shops
// which have no real profiles pointing at them.
async function isShopMember(shopId: string): Promise<boolean> {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const db = supabaseAdmin();
    const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
    return profile?.shop_id === shopId;
  } catch {
    return false;
  }
}

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

  const isOwner = await isShopMember(shop.id);

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
      <I18nProvider>
        <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
          <ShopSiteHeader shop={shop} isOwner={isOwner} />
          {children}
        </main>
      </I18nProvider>
    </>
  );
}
