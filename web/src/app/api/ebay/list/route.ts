import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { ebayConfigured, getConnection, getShopPolicies, publishPartListing, publishVehicleListing, type ShopPolicies } from "@/lib/ebay";
import { suggestLeafCategory } from "@/lib/pricing";
import { effectiveShopPlan, limitMessage } from "@/lib/usage";

// eBay Motors parts must list under a leaf category. When we can't infer one from
// live comps, fall back to 9886 "Other Car & Truck Parts & Accessories".
const FALLBACK_CATEGORY = process.env.EBAY_CATEGORY_ID || "9886";

export const runtime = "nodejs";
export const maxDuration = 60;

// ARA A/B/C grade → Trading API numeric ConditionID. Used parts are 3000; only
// non-working/F maps to 7000 (For parts or not working).
function conditionId(grade?: string): number {
  return grade === "F" || grade === "Poor" ? 7000 : 3000;
}

function fitLine(fitment: any): string {
  if (!Array.isArray(fitment)) return "";
  return fitment.map((f: any) => `${f.yearStart || ""}${f.yearEnd && f.yearEnd !== f.yearStart ? `-${f.yearEnd}` : ""} ${f.make || ""} ${f.model || ""}`.trim()).filter(Boolean).slice(0, 3).join("; ");
}

// eBay's "Placement on Vehicle" item specific, from the part name + image side.
function placement(partName = "", side = ""): string | undefined {
  const n = partName.toLowerCase(), s = side.toLowerCase();
  const fb = /\bfront\b/.test(n) ? "Front" : /\brear\b/.test(n) ? "Rear" : "";
  const lr = /\bleft\b/.test(n) || s === "left" ? "Left" : /\bright\b/.test(n) || s === "right" ? "Right" : "";
  return [fb, lr].filter(Boolean).join(" ") || undefined;
}

// The seller's item location for the Trading API (city text + ZIP). eBay needs a
// PostalCode; we pull it from the shop's saved location, defaulting safely.
async function shopLocation(db: any, shopId: string): Promise<{ location: string; postalCode: string }> {
  const { data } = await db.from("shops").select("location").eq("id", shopId).maybeSingle();
  const loc = (data?.location || "").trim();
  const postalCode = /\b\d{5}\b/.exec(loc)?.[0] || "90001";
  return { location: loc || "United States", postalCode };
}


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

  // An expired free month (effective plan "free") can't publish to eBay.
  if ((await effectiveShopPlan(db, shopId)) === "free") {
    return NextResponse.json({ error: limitMessage("car_post", 0), code: "quota" }, { status: 402 });
  }

  const conn = await getConnection(shopId).catch(() => null);
  if (!conn) return NextResponse.json({ error: "Connect your eBay account first.", notConnected: true }, { status: 409 });

  const { listingId, mode, vehicleId, lotPrice } = await req.json().catch(() => ({}));

  // This seller's own policies/location (falls back to env for legacy connections).
  const policies = await getShopPolicies(shopId);

  try {
    if (mode === "lot") return await listLot(db, shopId, vehicleId, lotPrice, policies);
    if (mode === "vehicle") return await listVehicle(db, shopId, vehicleId, policies);
    return await listPart(db, shopId, listingId, policies);
  } catch (e: any) {
    // Surface eBay's message so the seller can fix policies/location.
    return NextResponse.json({ error: `eBay rejected the listing: ${String(e?.message || e).slice(0, 400)}` }, { status: 502 });
  }
}

async function listPart(db: any, shopId: string, listingId: string, policies: ShopPolicies) {
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  const { data: l } = await db.from("listings").select("*").eq("id", listingId).eq("shop_id", shopId).single();
  if (!l) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const c = l.corrected || l.ai_output || {};
  const title = [c.partName || "Used Auto Part", fitLine(c.fitment)].filter(Boolean).join(" — ");
  const price = l.price_usd ?? c.suggestedPriceUsd ?? c.priceUsd ?? 0;
  if (!price || price <= 0) return NextResponse.json({ error: "Set a price before listing on eBay." }, { status: 400 });

  // eBay requires at least one photo on a listing.
  // Use the part's full photo gallery (0035) when present, hero first; fall back
  // to the single hero photo. eBay accepts up to 12 PictureURLs.
  const partGallery: unknown[] = Array.isArray(l.photo_urls) && l.photo_urls.length ? l.photo_urls : (l.photo_url ? [l.photo_url] : []);
  const images = partGallery.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 12);
  if (!images.length) return NextResponse.json({ error: "eBay requires at least one photo — add a photo to this part, then list it." }, { status: 400 });

  // Pick the listable Motors leaf category from live comps for this exact part.
  const categoryId = (await suggestLeafCategory([c.partName, fitLine(c.fitment)].filter(Boolean).join(" ")).catch(() => null)) || FALLBACK_CATEGORY;
  const loc = await shopLocation(db, shopId);

  const result = await publishPartListing(shopId, {
    title, description: c.description || title, price: Number(price), quantity: 1,
    categoryId,
    conditionId: conditionId(c.condition),
    brand: "Unbranded", partType: c.partName || "Auto Part",
    mpn: c.oemNumber || (Array.isArray(c.oemNumbers) ? c.oemNumbers[0] : undefined),
    placement: placement(c.partName, c.imageSide),
    imageUrls: images,
    location: loc.location, postalCode: loc.postalCode,
    fulfillmentPolicyId: policies.fulfillmentPolicyId, paymentPolicyId: policies.paymentPolicyId, returnPolicyId: policies.returnPolicyId,
  });
  await db.from("listings").update({ ebay_listing_id: result.listingId, ebay_url: result.url, status: "active" }).eq("id", l.id);
  return NextResponse.json({ ok: true, url: result.url, listingId: result.listingId });
}

// Bundle every (unsold) part of one vehicle into a single "parts lot" listing.
async function listLot(db: any, shopId: string, vehicleId: string, lotPrice: number | undefined, policies: ShopPolicies) {
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
  if (!images.length) return NextResponse.json({ error: "eBay requires at least one photo — add a photo to the car or one of its parts first." }, { status: 400 });

  const categoryId = (await suggestLeafCategory(`${carName} parts`).catch(() => null)) || FALLBACK_CATEGORY;
  const loc = await shopLocation(db, shopId);
  const result = await publishPartListing(shopId, {
    title, description: desc, price, quantity: 1,
    categoryId, conditionId: 3000,
    brand: "Unbranded", partType: "Parts Lot",
    imageUrls: images,
    location: loc.location, postalCode: loc.postalCode,
    fulfillmentPolicyId: policies.fulfillmentPolicyId, paymentPolicyId: policies.paymentPolicyId, returnPolicyId: policies.returnPolicyId,
  });
  await db.from("vehicles").update({ ebay_lot_id: result.listingId, ebay_lot_url: result.url }).eq("id", vehicleId);
  return NextResponse.json({ ok: true, url: result.url, listingId: result.listingId, parts: rows.length });
}

// Publish the whole car to eBay Motors (Trading API).
async function listVehicle(db: any, shopId: string, vehicleId: string, policies: ShopPolicies) {
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
    fulfillmentPolicyId: policies.fulfillmentPolicyId, paymentPolicyId: policies.paymentPolicyId, returnPolicyId: policies.returnPolicyId,
  });
  await db.from("vehicles").update({ ebay_listing_id: result.listingId, ebay_url: result.url }).eq("id", vehicleId);
  return NextResponse.json({ ok: true, url: result.url, listingId: result.listingId });
}
