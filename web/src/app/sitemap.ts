import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { GUIDES } from "@/content/guides";
import { BLOG } from "@/content/blog";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io").replace(/\/$/, "");

export const dynamic = "force-dynamic";

// Sitemap for crawlers: the marketing home, every guide, and each shop's public
// storefront (so listings get discovered organically).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    // Shop directory — the crawlable on-domain path to every {slug}.ahlam.io
    // storefront (subdomain URLs themselves don't belong in an apex sitemap).
    { url: `${SITE_URL}/shops`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/guidance`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/refunds`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/guidelines`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/acceptable-use`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${SITE_URL}/guides/${g.slug}`,
    lastModified: new Date(g.updated),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const blogRoutes: MetadataRoute.Sitemap = BLOG.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.published),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let shopRoutes: MetadataRoute.Sitemap = [];
  let listingRoutes: MetadataRoute.Sitemap = [];
  try {
    const db = supabaseAdmin();
    const [{ data: shops }, { data: listings }] = await Promise.all([
      db.from("shops").select("id, created_at").limit(5000),
      db.from("listings").select("id, updated_at, created_at").eq("status", "active").limit(20000),
    ]);
    shopRoutes = (shops || []).map((s: any) => ({
      url: `${SITE_URL}/shop/${s.id}`,
      lastModified: s.created_at ? new Date(s.created_at) : undefined,
      changeFrequency: "daily",
      priority: 0.6,
    }));
    // Each active part gets its own indexable URL so Google can rank long-tail
    // queries ("2017 Honda Civic alternator near 77066") straight to the part.
    listingRoutes = (listings || []).map((l: any) => ({
      url: `${SITE_URL}/p/${l.id}`,
      lastModified: l.updated_at ? new Date(l.updated_at) : l.created_at ? new Date(l.created_at) : undefined,
      changeFrequency: "daily",
      priority: 0.7,
    }));
  } catch {
    // If the DB is unreachable at build/runtime, still return the static routes.
  }

  return [...staticRoutes, ...guideRoutes, ...blogRoutes, ...shopRoutes, ...listingRoutes];
}
