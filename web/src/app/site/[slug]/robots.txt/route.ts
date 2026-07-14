import { getShopBySlug } from "@/lib/shop-site";
import { hasPersonalSite, siteOrigin } from "@/lib/slug";

// Per-shop robots.txt, served at {slug}.ahlam.io/robots.txt via the middleware
// rewrite. Lapsed or unknown shops get disallow-all so crawlers drop the host.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  const live = shop && hasPersonalSite(shop);
  const body = live
    ? `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin(shop.slug)}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
