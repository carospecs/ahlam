import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { ebayConfigured, getConnection, publishListing } from "@/lib/ebay";

export const runtime = "nodejs";
export const maxDuration = 60;

// Two-bucket grade → eBay condition. Legacy A–F still map via the extra keys.
const CONDITION: Record<string, string> = {
  Good: "USED_GOOD", Poor: "USED_ACCEPTABLE",
  A: "USED_EXCELLENT", B: "USED_VERY_GOOD", C: "USED_GOOD",
  D: "USED_ACCEPTABLE", F: "FOR_PARTS_OR_NOT_WORKING",
};

function fitLine(fitment: any): string {
  if (!Array.isArray(fitment)) return "";
  return fitment.map((f: any) => `${f.yearStart || ""}${f.yearEnd && f.yearEnd !== f.yearStart ? `-${f.yearEnd}` : ""} ${f.make || ""} ${f.model || ""}`.trim()).filter(Boolean).slice(0, 3).join("; ");
}

// POST { listingId } → publish one part listing to the seller's eBay account.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ebayConfigured()) return NextResponse.json({ error: "eBay isn't set up on this server yet." }, { status: 503 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const conn = await getConnection(shopId).catch(() => null);
  if (!conn) return NextResponse.json({ error: "Connect your eBay account first.", notConnected: true }, { status: 409 });

  const { listingId } = await req.json().catch(() => ({}));
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const { data: l } = await db.from("listings").select("*").eq("id", listingId).eq("shop_id", shopId).single();
  if (!l) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const c = l.corrected || l.ai_output || {};
  const title = [c.partName || "Used Auto Part", fitLine(c.fitment)].filter(Boolean).join(" — ");
  const price = l.price_usd ?? c.suggestedPriceUsd ?? c.priceUsd ?? 0;
  if (!price || price <= 0) return NextResponse.json({ error: "Set a price before listing on eBay." }, { status: 400 });

  try {
    const result = await publishListing(shopId, {
      sku: `ahlam-${String(l.id).slice(0, 30)}`,
      title,
      description: c.description || title,
      price: Number(price),
      conditionId: CONDITION[c.condition] || "USED_GOOD",
      imageUrls: l.photo_url && /^https?:\/\//.test(l.photo_url) ? [l.photo_url] : undefined,
      categoryId: process.env.EBAY_CATEGORY_ID || "6028",
      merchantLocationKey: process.env.EBAY_LOCATION_KEY,
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
    });
    await db.from("listings").update({ ebay_listing_id: result.listingId, ebay_url: result.url, status: "active" }).eq("id", l.id);
    return NextResponse.json({ ok: true, url: result.url, listingId: result.listingId });
  } catch (e: any) {
    // Surface eBay's message so the seller can fix policies/location in sandbox.
    return NextResponse.json({ error: `eBay rejected the listing: ${String(e?.message || e).slice(0, 400)}` }, { status: 502 });
  }
}
