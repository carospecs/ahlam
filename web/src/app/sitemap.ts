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
  try {
    const db = supabaseAdmin();
    const { data: shops } = await db.from("shops").select("id, created_at").limit(5000);
    shopRoutes = (shops || []).map((s: any) => ({
      url: `${SITE_URL}/shop/${s.id}`,
      lastModified: s.created_at ? new Date(s.created_at) : undefined,
      changeFrequency: "daily",
      priority: 0.6,
    }));
  } catch {
    // If the DB is unreachable at build/runtime, still return the static routes.
  }

  return [...staticRoutes, ...guideRoutes, ...shopRoutes];
}
