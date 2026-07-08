import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { floorPrice } from "@/lib/price-bands";
import { checkUsage, recordUsage, effectiveShopPlan, limitMessage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ ok: true, listings: [] });

  const { data: listings, error } = await db
    .from("listings")
    .select("*")
    .eq("shop_id", shopId)
    .neq("status", "removed")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, listings });
}

// Save a reviewed vehicle + its parts. Creates an active vehicle row and active
// part listings so they show up in the seller's own "Vehicles/Parts posted" and,
// for whole/both + active parts, in the public Browse market for OTHER clients.
//   - parts mode  → vehicle (sell_mode 'parts') + active part listings
//   - whole mode  → vehicle only (sell_mode 'whole'), no part listings
//   - both  mode  → vehicle (sell_mode 'both') + active part listings
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ error: "No workspace yet" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const vehicle = body.vehicle || {};
  const parts: any[] = Array.isArray(body.parts) ? body.parts : [];
  const sellMode: string = ["parts", "whole", "both"].includes(body.sellMode) ? body.sellMode : "parts";
  const carPrice = body.carPrice != null && body.carPrice !== "" ? Number(body.carPrice) : null;
  const mileage = typeof body.mileage === "string" ? body.mileage : null;
  const stockNumber = typeof vehicle.stockNumber === "string" ? vehicle.stockNumber : null;
  // Save-as-draft keeps everything private (not surfaced in the public market).
  const status = body.draft ? "draft" : "active";

  // Quality gate for ACTIVE posts: junk like part "1" priced at $1 makes the
  // whole marketplace look fake. Drafts stay loose so nothing in progress is
  // ever lost — the bar applies when it goes public.
  if (status === "active") {
    const looksLikeName = (s: unknown) => typeof s === "string" && /[a-zA-Z]{2}/.test(s) && s.trim().length >= 3;
    const wholeCar = sellMode === "whole" || sellMode === "both";
    if (wholeCar) {
      const year = Number(vehicle.year);
      if (!looksLikeName(vehicle.make) || !looksLikeName(vehicle.model)) {
        return NextResponse.json({ error: "Add the vehicle's real company/brand and model before posting.", code: "invalid" }, { status: 400 });
      }
      if (vehicle.year && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 2)) {
        return NextResponse.json({ error: "That vehicle year doesn't look right.", code: "invalid" }, { status: 400 });
      }
      if (carPrice != null && (!Number.isFinite(carPrice) || carPrice < 50 || carPrice > 2_000_000)) {
        return NextResponse.json({ error: "Set a realistic asking price for the whole car (at least $50).", code: "invalid" }, { status: 400 });
      }
    }
    if (sellMode !== "whole") {
      for (const p of parts) {
        const nm = String(p.partName ?? "").trim();
        if (!looksLikeName(nm)) {
          return NextResponse.json({ error: `"${nm || "Unnamed part"}" isn't a real part name. Name every part before posting (e.g. "Alternator").`, code: "invalid" }, { status: 400 });
        }
        const price = p.suggestedPriceUsd;
        if (price != null && (!Number.isFinite(Number(price)) || Number(price) < 1 || Number(price) > 100_000)) {
          return NextResponse.json({ error: `Set a realistic price for "${nm}" (between $1 and $100,000), or leave it blank to price later.`, code: "invalid" }, { status: 400 });
        }
      }
    }
  }

  // Some plans cap whole-car posts per day (Solo 1/day; an expired free month
  // blocks posting). Only an actually-posted (active) car counts; drafts are
  // free. Fail-open if usage isn't migrated / lookup errors.
  if (status === "active") {
    try {
      const plan = await effectiveShopPlan(db, shopId);
      const usage = await checkUsage(db, shopId, plan, "car_post");
      if (!usage.allowed) {
        return NextResponse.json({ error: limitMessage("car_post", usage.limit ?? 0, plan), code: "quota" }, { status: 402 });
      }
    } catch { /* fail-open: never block a post on a usage-lookup error */ }
  }

  // 0. Upload the photos so every post carries a real picture. Each base64 JPEG
  // goes to the part-photos bucket; we keep the resulting public URLs by index.
  const images: string[] = Array.isArray(body.images) ? body.images : [];
  const heroIndex: number = Number.isInteger(body.heroIndex) ? body.heroIndex : 0;
  const photoUrls: (string | null)[] = [];
  if (images.length) {
    const stamp = Date.now();
    for (let i = 0; i < images.length; i++) {
      try {
        const b64 = String(images[i]).replace(/^data:[^;]+;base64,/, "");
        const bytes = Buffer.from(b64, "base64");
        const path = `${shopId}/${stamp}-${i}.jpg`;
        const up = await db.storage.from("part-photos").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
        photoUrls.push(up.error ? null : db.storage.from("part-photos").getPublicUrl(path).data.publicUrl);
      } catch { photoUrls.push(null); }
    }
  }
  const heroUrl = photoUrls[heroIndex] || photoUrls.find(Boolean) || null;
  // Full gallery, hero first, de-duplicated — powers the vehicle photo gallery.
  const gallery = [heroUrl, ...photoUrls].filter((u, i, arr): u is string => !!u && arr.indexOf(u) === i);

  // 1. Vehicle — active so whole/both variants surface in the market.
  const vehRow: Record<string, any> = {
    shop_id: shopId,
    created_by: user.id,
    year: String(vehicle.year || ""),
    make: vehicle.make || "Unknown",
    model: vehicle.model || "",
    trim: vehicle.trim || null,
    body: vehicle.body || null,
    color: vehicle.color || null,
    vin: vehicle.vin || null,
    stock_number: stockNumber,
    mileage: mileage,                // private — never exposed in the public feed
    asking_price: carPrice,
    sell_mode: sellMode,
    photos: vehicle.photos || gallery.length,
    photo_url: heroUrl,
    photo_urls: gallery,
    title: typeof vehicle.title === "string" && vehicle.title.trim() ? vehicle.title.trim() : null,
    description: typeof vehicle.description === "string" && vehicle.description.trim() ? vehicle.description : null,
    status,
  };
  let { data: veh, error: vErr } = await db.from("vehicles").insert(vehRow).select().single();
  // Graceful when an optional column's migration isn't applied yet (photo_url 0017,
  // title 0015, description 0018): drop the offending column(s) and retry so the
  // post still succeeds.
  for (let attempt = 0; vErr && attempt < 3; attempt++) {
    let dropped = false;
    for (const col of ["photo_urls", "photo_url", "title", "description", "stock_number"]) {
      if (col in vehRow && new RegExp(col, "i").test(vErr.message || "")) { delete (vehRow as any)[col]; dropped = true; }
    }
    if (!dropped) break;
    ({ data: veh, error: vErr } = await db.from("vehicles").insert(vehRow).select().single());
  }
  if (vErr || !veh) return NextResponse.json({ error: vErr?.message || "Could not save vehicle" }, { status: 500 });
  // Meter the car post (Solo cap) now that the vehicle is actually live.
  if (status === "active") void recordUsage(db, shopId, "car_post");

  // 2. Part listings — skipped when selling the whole car only.
  let listingCount = 0;
  if (sellMode !== "whole" && parts.length) {
    const rows = parts.map((p) => {
      const { photoIndex, ...ai } = p;
      const url = (Number.isInteger(photoIndex) ? photoUrls[photoIndex] : null) || heroUrl || "";
      return {
        shop_id: shopId,
        created_by: user.id,
        seller_id: user.id,
        vehicle_id: veh.id,
        listing_type: "part",
        photo_url: url,
        photo_urls: url ? [url] : [],   // gallery seeded with the part's photo; more can be added later
        ai_output: ai,
        // Grade C parts are intentionally unpriced — preserve null so the seller
        // sets the price manually. A/B parts use the formula price as-is.
        price_usd: p.suggestedPriceUsd ?? null,
        status,
      };
    });
    let { data: ins, error: lErr } = await db.from("listings").insert(rows).select("id");
    // photo_urls may not be migrated yet (0035) — drop it from every row and retry.
    if (lErr && /photo_urls/i.test(lErr.message || "")) {
      const stripped = rows.map(({ photo_urls, ...r }) => r);
      ({ data: ins, error: lErr } = await db.from("listings").insert(stripped).select("id"));
    }
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
    listingCount = ins?.length || 0;
  }

  return NextResponse.json({ ok: true, vehicleId: veh.id, listings: listingCount });
}

// Map a UI status label back to the listing_status enum.
const STATUS_TO_ENUM: Record<string, string> = { Posted: "active", Draft: "draft", Sold: "sold" };

// PATCH handles three shapes, scoped to the seller's own shop:
//   { listingId, priceUsd?, status?, description? }  → edit one part listing
//   { vehicleId, sellMode }                           → flip a vehicle parts/whole/both
//   { vehicleId, status }                             → post/unpost a vehicle as a whole car
//   { listingIds, status }                            → bulk-update listing statuses
export async function PATCH(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  // ── Edit a single part listing (price / status / description) ──────────────
  if (body.listingId) {
    const { data: row, error: getErr } = await db
      .from("listings").select("corrected, ai_output, price_usd").eq("id", body.listingId).eq("shop_id", shopId).single();
    if (getErr || !row) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

    const update: Record<string, any> = {};
    if (body.priceUsd != null && body.priceUsd !== "") update.price_usd = Number(body.priceUsd);
    if (typeof body.stockLocation === "string") update.stock_location = body.stockLocation;
    if (typeof body.barcode === "string") update.barcode = body.barcode;
    if (typeof body.status === "string") {
      const enumStatus = STATUS_TO_ENUM[body.status] || (["draft", "active", "sold", "removed"].includes(body.status) ? body.status : null);
      if (!enumStatus) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      update.status = enumStatus;
      // Capture the sale price + time so the pricing pipeline can learn from the
      // shop's own real sales (its strongest comp). Defaults to the listing's
      // current price when not explicitly provided. (Needs migration 0031.)
      if (enumStatus === "sold") {
        update.sold_at = new Date().toISOString();
        update.sold_price = update.price_usd ?? row.price_usd ?? null;
      }
    }
    // Editable part fields merge into the corrected JSON so we don't clobber
    // other reviewed fields.
    if (typeof body.description === "string" || typeof body.partName === "string" || typeof body.condition === "string" || typeof body.category === "string" || typeof body.fitment !== "undefined" || typeof body.conditionNotes === "string" || typeof body.warrantyDays !== "undefined" || typeof body.asIs === "boolean") {
      const corrected = { ...(row.corrected || row.ai_output || {}) };
      if (typeof body.description === "string") corrected.description = body.description;
      if (typeof body.partName === "string" && body.partName.trim()) corrected.partName = body.partName.trim();
      if (typeof body.condition === "string" && ["A","B","C"].includes(body.condition)) corrected.condition = body.condition;
      if (typeof body.category === "string") corrected.partCategory = body.category;
      if (typeof body.conditionNotes === "string") corrected.conditionNotes = body.conditionNotes;
      if (typeof body.damageCode === "string") corrected.damageCode = body.damageCode.slice(0, 16);
      if (body.fitment !== undefined) corrected.fitment = body.fitment;
      // Warranty terms (WAR-1/WAR-4): only 0/30/60/90 days; asIs forces no warranty.
      if (typeof body.warrantyDays !== "undefined") {
        const d = Number(body.warrantyDays);
        corrected.warrantyDays = [0, 30, 60, 90].includes(d) ? d : null;
      }
      if (typeof body.asIs === "boolean") corrected.asIs = body.asIs;
      update.corrected = corrected;
    }
    // New photo(s): base64 JPEGs uploaded to the part-photos bucket and APPENDED
    // to the part's gallery (photo_urls); the first stays as the hero (photo_url).
    if (Array.isArray(body.photosBase64) && body.photosBase64.length) {
      const { data: cur } = await db.from("listings").select("photo_urls, photo_url").eq("id", body.listingId).eq("shop_id", shopId).single();
      const existing: string[] = Array.isArray((cur as { photo_urls?: unknown })?.photo_urls)
        ? ((cur as { photo_urls: string[] }).photo_urls).filter(Boolean)
        : ((cur as { photo_url?: string })?.photo_url ? [(cur as { photo_url: string }).photo_url] : []);
      const stamp = Date.now();
      const added: string[] = [];
      for (let i = 0; i < body.photosBase64.length && i < 8; i++) {
        try {
          const b64 = String(body.photosBase64[i]).replace(/^data:[^;]+;base64,/, "");
          const path = `${shopId}/${stamp}-${i}-${String(body.listingId).slice(0, 8)}.jpg`;
          const up = await db.storage.from("part-photos").upload(path, Buffer.from(b64, "base64"), { contentType: "image/jpeg", upsert: true });
          if (!up.error) added.push(db.storage.from("part-photos").getPublicUrl(path).data.publicUrl);
        } catch { /* skip a photo that won't decode/upload */ }
      }
      if (added.length) {
        const gallery = [...existing, ...added].filter((u, i, a) => !!u && a.indexOf(u) === i);
        update.photo_urls = gallery;
        update.photo_url = gallery[0];   // hero = first photo
      }
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

    let { error } = await db.from("listings").update(update).eq("id", body.listingId).eq("shop_id", shopId);
    // photo_urls may not be migrated yet (0035) — keep the hero (photo_url) and retry.
    if (error && "photo_urls" in update && /photo_urls/i.test(error.message || "")) {
      delete (update as { photo_urls?: unknown }).photo_urls;
      ({ error } = await db.from("listings").update(update).eq("id", body.listingId).eq("shop_id", shopId));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Bulk-update listing statuses ───────────────────────────────────────────
  if (body.listingIds && typeof body.status === "string") {
    const enumStatus = STATUS_TO_ENUM[body.status] || (["draft", "active", "sold", "removed"].includes(body.status) ? body.status : null);
    if (!enumStatus) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const ids: string[] = Array.isArray(body.listingIds) ? body.listingIds : [];
    if (!ids.length) return NextResponse.json({ error: "No listing IDs provided" }, { status: 400 });

    // On bulk-sold, stamp sold_at. We don't snapshot sold_price here (own-comps
    // falls back to the listing's price_usd when sold_price is null). (Mig. 0031.)
    const bulk: Record<string, any> = { status: enumStatus };
    if (enumStatus === "sold") bulk.sold_at = new Date().toISOString();
    const { error } = await db.from("listings").update(bulk).in("id", ids).eq("shop_id", shopId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  // ── Vehicle-level update (sell mode OR status) ─────────────────────────────
  const { vehicleId } = body;
  if (!vehicleId) return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });

  const vehUpdate: Record<string, any> = {};

  if (body.sellMode) {
    if (!["parts", "whole", "both"].includes(body.sellMode)) {
      return NextResponse.json({ error: "Invalid sellMode" }, { status: 400 });
    }
    vehUpdate.sell_mode = body.sellMode;
  }

  if (body.status) {
    const enumStatus = ["draft", "active", "sold"].includes(body.status) ? body.status : null;
    if (!enumStatus) return NextResponse.json({ error: "Valid vehicle status required (draft/active/sold)" }, { status: 400 });
    vehUpdate.status = enumStatus;
  }

  if (typeof body.description === "string") vehUpdate.description = body.description;
  if (typeof body.title === "string") vehUpdate.title = body.title.trim() || null;
  if (typeof body.mileage === "string") vehUpdate.mileage = body.mileage.trim() || null;
  if (body.askingPrice !== undefined) {
    const n = body.askingPrice === "" || body.askingPrice == null ? null : Number(body.askingPrice);
    vehUpdate.asking_price = Number.isFinite(n as number) ? n : null;
  }
  // What the yard paid for the car (whole dollars from the UI → cents in the DB).
  if (body.acquisitionCostCents !== undefined) {
    const n = body.acquisitionCostCents === "" || body.acquisitionCostCents == null ? null : Math.round(Number(body.acquisitionCostCents));
    vehUpdate.acquisition_cost_cents = n != null && Number.isFinite(n) && n >= 0 ? n : null;
  }

  // New photo(s) for the vehicle — uploaded to the bucket and appended to the gallery.
  if (Array.isArray(body.photosBase64) && body.photosBase64.length) {
    const { data: cur } = await db.from("vehicles").select("photo_urls, photo_url").eq("id", vehicleId).eq("shop_id", shopId).single();
    const existing: string[] = Array.isArray(cur?.photo_urls) ? cur!.photo_urls.filter(Boolean) : [];
    const stamp = Date.now();
    const added: string[] = [];
    for (let i = 0; i < body.photosBase64.length && i < 8; i++) {
      try {
        const b64 = String(body.photosBase64[i]).replace(/^data:[^;]+;base64,/, "");
        const path = `${shopId}/${stamp}-${i}-veh-${String(vehicleId).slice(0, 8)}.jpg`;
        const up = await db.storage.from("part-photos").upload(path, Buffer.from(b64, "base64"), { contentType: "image/jpeg", upsert: true });
        if (!up.error) added.push(db.storage.from("part-photos").getPublicUrl(path).data.publicUrl);
      } catch { /* skip */ }
    }
    if (added.length) {
      vehUpdate.photo_urls = [...existing, ...added];
      if (!cur?.photo_url) vehUpdate.photo_url = added[0];
    }
  }

  if (Object.keys(vehUpdate).length === 0) return NextResponse.json({ ok: true });

  let { error } = await db.from("vehicles").update(vehUpdate).eq("id", vehicleId).eq("shop_id", shopId);
  // Some optional columns may not exist yet on older databases (title 0015,
  // acquisition_cost_cents 0028). Drop whichever one the error names and retry,
  // so saving the rest of the form never fails on a not-yet-applied migration.
  for (const col of ["title", "acquisition_cost_cents"]) {
    if (error && col in vehUpdate && new RegExp(col, "i").test(error.message)) {
      delete (vehUpdate as Record<string, any>)[col];
      if (Object.keys(vehUpdate).length === 0) { error = null as any; break; }
      ({ error } = await db.from("vehicles").update(vehUpdate).eq("id", vehicleId).eq("shop_id", shopId));
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE soft-deletes a post (status → 'removed') so it leaves the seller's
// inventory and the public market, but the row survives for anything that
// references it (conversations, orders, activity). Shapes, scoped to the
// seller's own shop:
//   { listingId }  | { listingIds }  → delete part listing(s)
//   { vehicleId }                    → delete a vehicle post + its part listings
export async function DELETE(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  const ids: string[] = Array.isArray(body.listingIds) ? body.listingIds : body.listingId ? [body.listingId] : [];
  if (ids.length) {
    const { error } = await db.from("listings").update({ status: "removed" }).in("id", ids).eq("shop_id", shopId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removed: ids.length });
  }

  if (body.vehicleId) {
    const { error } = await db.from("vehicles").update({ status: "removed" }).eq("id", body.vehicleId).eq("shop_id", shopId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // The car's part listings are posts from this car — they go with it.
    const { error: pErr } = await db.from("listings").update({ status: "removed" }).eq("vehicle_id", body.vehicleId).eq("shop_id", shopId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "listingId, listingIds, or vehicleId required" }, { status: 400 });
}
