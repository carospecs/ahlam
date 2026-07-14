import { supabaseAdmin } from "@/lib/supabase";
import { getShopBySlug } from "@/lib/shop-site";
import { hasPersonalSite, siteOrigin } from "@/lib/slug";

// Per-shop sitemap, served at {slug}.ahlam.io/sitemap.xml via the middleware
// rewrite. Route handler (not a Next metadata file) because nested sitemap.ts
// can't receive the dynamic slug. Re-checks the plan gate itself — the
// layout's lapsed-plan redirect doesn't cover route handlers.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop || !hasPersonalSite(shop)) return new Response("Not found", { status: 404 });

  const origin = siteOrigin(shop.slug);
  let ids: string[] = [];
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("listings").select("id").eq("shop_id", shop.id).eq("status", "active").order("created_at", { ascending: false }).limit(5000);
    ids = (data || []).map((l: any) => l.id);
  } catch {
    ids = [];
  }

  const urls = [
    `  <url><loc>${xmlEscape(origin)}</loc></url>`,
    ...ids.map((id) => `  <url><loc>${xmlEscape(`${origin}/p/${id}`)}</loc></url>`),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
