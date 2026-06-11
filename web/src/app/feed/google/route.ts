import { supabaseAdmin } from "@/lib/supabase";
import { normalizeGrade } from "@/lib/grade";

// Google Merchant / Facebook Catalog product feed (RSS 2.0 with the g: namespace).
// Both platforms ingest this exact format, so one feed gives Ahlam's inventory free
// reach on Google Shopping and Facebook/Instagram Shops — the demand channel the
// review flagged as the #1 gap. Read-only, no auth: it only emits active listings
// that have a photo (a feed item without an image_link is rejected anyway).

export const runtime = "nodejs";
export const revalidate = 1800; // 30 min — fresh enough for catalog sync, cheap to serve

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit
      .map((f: any) => {
        if (typeof f === "string") return f;
        const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : f.yearStart || "";
        return [yr, f.make, f.model].filter(Boolean).join(" ").trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

// First make in the fitment, used as the feed "brand" (a required attribute).
function firstMake(fit: any): string {
  if (Array.isArray(fit)) {
    for (const f of fit) if (f && typeof f === "object" && f.make) return String(f.make);
  }
  return "OEM";
}

export async function GET() {
  let rows: any[] = [];
  let shopMap = new Map<string, any>();
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(10000);
    rows = (data || []).filter((l: any) => l.photo_url); // image_link is mandatory
    const shopIds = Array.from(new Set(rows.map((l: any) => l.shop_id).filter(Boolean)));
    if (shopIds.length) {
      const { data: shops } = await db.from("shops").select("id, name, location, zip_code").in("id", shopIds);
      shopMap = new Map((shops || []).map((s: any) => [s.id, s]));
    }
  } catch {
    rows = [];
  }

  const items = rows
    .map((l: any) => {
      const c = l.corrected || l.ai_output || {};
      const part = c.partName || c.part_name || "Used Auto Part";
      const fit = fmtFit(c.fitment);
      const price = l.price_usd ?? c.suggestedPriceUsd ?? 0;
      if (!price || price <= 0) return ""; // Merchant rejects $0 items
      const shop = shopMap.get(l.shop_id);
      const near = shop?.zip_code || shop?.location || "";
      const title = [fit, part].filter(Boolean).join(" ") + (near ? ` (near ${near})` : "");
      const desc = (c.description || c.conditionNotes || `${part}${fit ? ` that fits ${fit}` : ""}. Used OEM auto part.`).slice(0, 4000);
      const link = `${SITE_URL}/p/${l.id}`;
      return `    <item>
      <g:id>${xmlEscape(l.id)}</g:id>
      <title>${xmlEscape(title.slice(0, 150))}</title>
      <description>${xmlEscape(desc)}</description>
      <link>${xmlEscape(link)}</link>
      <g:image_link>${xmlEscape(l.photo_url)}</g:image_link>
      <g:price>${Number(price).toFixed(2)} USD</g:price>
      <g:condition>used</g:condition>
      <g:availability>in_stock</g:availability>
      <g:brand>${xmlEscape(firstMake(c.fitment))}</g:brand>
      <g:google_product_category>Vehicles &amp; Parts &gt; Vehicle Parts &amp; Accessories</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
    })
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Ahlam — Used Auto Parts</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>Used OEM auto parts from salvage yards on Ahlam.</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
