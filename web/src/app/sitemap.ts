import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { GUIDES } from "@/content/guides";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io").replace(/\/$/, "");

export const dynamic = "force-dynamic";

// Sitemap for crawlers: the marketing home, every guide, and each shop's public
// storefront (so listings get discovered organically).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.8 },
  ];

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${SITE_URL}/guides/${g.slug}`,
    lastModified: new Date(g.updated),
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

  return [...staticRoutes, ...guideRoutes, ...shopRoutes, ...listingRoutes];
}
