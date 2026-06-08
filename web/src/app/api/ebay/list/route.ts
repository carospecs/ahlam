import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { ebayConfigured, getConnection, publishListing, publishVehicleListing } from "@/lib/ebay";

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

const POLICIES = {
  merchantLocationKey: process.env.EBAY_LOCATION_KEY,
  fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
  paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
  returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
};

// POST body:
//   { listingId }                 → publish one part
//   { mode:"lot", vehicleId }     → bundle all of a car's parts into one lot
//   { mode:"vehicle", vehicleId } → publish the whole car to eBay Motors
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

  const { listingId, mode, vehicleId, lotPrice } = await req.json().catch(() => ({}));

  try {
    if (mode === "lot") return await listLot(db, shopId, vehicleId, lotPrice);
    if (mode === "vehicle") return await listVehicle(db, shopId, vehicleId);
    return await listPart(db, shopId, listingId);
  } catch (e: any) {
    // Surface eBay's message so the seller can fix policies/location.
    return NextResponse.json({ error: `eBay rejected the listing: ${String(e?.message || e).slice(0, 400)}` }, { status: 502 });
  }
}

async function listPart(db: any, shopId: string, listingId: string) {
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  const { data: l } = await db.from("listings").select("*").eq("id", listingId).eq("shop_id", shopId).single();
  if (!l) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const c = l.corrected || l.ai_output || {};
  const title = [c.partName || "Used Auto Part", fitLine(c.fitment)].filter(Boolean).join(" — ");
  const price = l.price_usd ?? c.suggestedPriceUsd ?? c.priceUsd ?? 0;
  if (!price || price <= 0) return NextResponse.json({ error: "Set a price before listing on eBay." }, { status: 400 });

  const result = await publishListing(shopId, {
    sku: `ahlam-${String(l.id).slice(0, 30)}`,
    title, description: c.description || title, price: Number(price),
    conditionId: CONDITION[c.condition] || "USED_GOOD",
    imageUrls: l.photo_url && /^https?:\/\//.test(l.photo_url) ? [l.photo_url] : undefined,
    categoryId: process.env.EBAY_CATEGORY_ID || "6028", ...POLICIES,
  });
  await db.from("listings").update({ ebay_listing_id: result.listingId, ebay_url: result.url, status: "active" }).eq("id", l.id);
  return NextResponse.json({ ok: true, url: result.url, listingId: result.listingId });
}

// Bundle every (unsold) part of one vehicle into a single "parts lot" listing.
async function listLot(db: any, shopId: string, vehicleId: string, lotPrice?: number) {
  if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
  const { data: v } = await db.from("vehicles").select("*").eq("id", vehicleId).eq("shop_id", shopId).single();
  if (!v) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  const { data: parts } = await db.from("listings").select("*").eq("vehicle_id", vehicleId).eq("shop_id", shopId);
  const items = (parts || []).filter((p: any) => p.status !== "Sold" && p.status !== "sold");
  if (!items.length) return NextResponse.json({ error: "No parts to bundle for this vehicle." }, { status: 400 });

  const carName = `${v.year} ${v.make} ${v.model}`.trim();
  const rows = items.map((p: any) => {
    const c = p.corrected || p.ai_output || {};
    return { name: c.partName || "Part", grade: c.condition || "", price: p.price_usd ?? c.suggestedPriceUsd ?? c.priceUsd ?? 0, photo: p.photo_url };
  });
  const sum = rows.reduce((a: number, r: any) => a + (Number(r.price) || 0), 0);
  const price = Number(lotPrice) > 0 ? Number(lotPrice) : sum;
  if (!price || price <= 0) return NextResponse.json({ error: "Set prices on the parts (or pass a lot price) first." }, { status: 400 });

  const title = `${carName} — Parts Lot (${rows.length} pieces)`;
  const desc = [
    `Wholesale parts lot pulled from a ${carName}.`,
    `${rows.length} parts sold together as one lot:`,
    "",
    ...rows.map((r: any) => `• ${r.name}${r.grade ? ` (${r.grade})` : ""}`),
    "",
    "Local pickup preferred — message for shipping options on individual pieces.",
  ].join("\n");
  const images = [v.photo_url, ...rows.map((r: any) => r.photo)].filter((u: any) => u && /^https?:\/\//.test(u)).slice(0, 12);

  const result = await publishListing(shopId, {
    sku: `ahlam-lot-${String(vehicleId).slice(0, 26)}`,
    title, description: desc, price, quantity: 1,
    conditionId: "USED_GOOD",
    imageUrls: images.length ? images : undefined,
    categoryId: process.env.EBAY_CATEGORY_ID || "6028", ...POLICIES,
  });
  await db.from("vehicles").update({ ebay_lot_id: result.listingId, ebay_lot_url: result.url }).eq("id", vehicleId);
  return NextResponse.json({ ok: true, url: result.url, listingId: result.listingId, parts: rows.length });
}

// Publish the whole car to eBay Motors (Trading API).
async function listVehicle(db: any, shopId: string, vehicleId: string) {
  if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
  const { data: v } = await db.from("vehicles").select("*").eq("id", vehicleId).eq("shop_id", shopId).single();
  if (!v) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const price = v.asking_price;
  if (!price || price <= 0) return NextResponse.json({ error: "Set an asking price on the car before listing it." }, { status: 400 });

  const carName = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`.trim();
  const desc = v.description || `${carName}. ${v.mileage || ""} ${v.body || ""}. Sold as-is.`.trim();
  const result = await publishVehicleListing(shopId, {
    title: v.title || carName, description: desc, price: Number(price),
    year: v.year, make: v.make, model: v.model, trim: v.trim,
    vin: v.vin && !v.vin.includes("•") ? v.vin : undefined, // skip masked VINs
    mileage: v.mileage, bodyType: v.body,
    imageUrls: v.photo_url && /^https?:\/\//.test(v.photo_url) ? [v.photo_url] : undefined,
    fulfillmentPolicyId: POLICIES.fulfillmentPolicyId, paymentPolicyId: POLICIES.paymentPolicyId, returnPolicyId: POLICIES.returnPolicyId,
  });
  await db.from("vehicles").update({ ebay_listing_id: result.listingId, ebay_url: result.url }).eq("id", vehicleId);
  return NextResponse.json({ ok: true, url: result.url, listingId: result.listingId });
}
