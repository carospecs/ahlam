import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

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
  // Save-as-draft keeps everything private (not surfaced in the public market).
  const status = body.draft ? "draft" : "active";

  // 1. Vehicle — active so whole/both variants surface in the market.
  const { data: veh, error: vErr } = await db
    .from("vehicles")
    .insert({
      shop_id: shopId,
      created_by: user.id,
      year: String(vehicle.year || ""),
      make: vehicle.make || "Unknown",
      model: vehicle.model || "",
      trim: vehicle.trim || null,
      body: vehicle.body || null,
      color: vehicle.color || null,
      vin: vehicle.vin || null,
      mileage: mileage,                // private — never exposed in the public feed
      asking_price: carPrice,
      sell_mode: sellMode,
      photos: vehicle.photos || 0,
      status,
    })
    .select()
    .single();
  if (vErr || !veh) return NextResponse.json({ error: vErr?.message || "Could not save vehicle" }, { status: 500 });

  // 2. Part listings — skipped when selling the whole car only.
  let listingCount = 0;
  if (sellMode !== "whole" && parts.length) {
    const rows = parts.map((p) => ({
      shop_id: shopId,
      created_by: user.id,
      seller_id: user.id,
      vehicle_id: veh.id,
      listing_type: "part",
      photo_url: "",                   // no hosted photo in this flow yet
      ai_output: p,
      price_usd: typeof p.suggestedPriceUsd === "number" ? p.suggestedPriceUsd : null,
      status,
    }));
    const { data: ins, error: lErr } = await db.from("listings").insert(rows).select("id");
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
      .from("listings").select("corrected, ai_output").eq("id", body.listingId).eq("shop_id", shopId).single();
    if (getErr || !row) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

    const update: Record<string, any> = {};
    if (body.priceUsd != null && body.priceUsd !== "") update.price_usd = Number(body.priceUsd);
    if (typeof body.status === "string") {
      const enumStatus = STATUS_TO_ENUM[body.status] || (["draft", "active", "sold", "removed"].includes(body.status) ? body.status : null);
      if (!enumStatus) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      update.status = enumStatus;
    }
    if (typeof body.description === "string") {
      // Merge into the corrected JSON so we don't clobber other reviewed fields.
      const corrected = { ...(row.corrected || row.ai_output || {}), description: body.description };
      update.corrected = corrected;
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

    const { error } = await db.from("listings").update(update).eq("id", body.listingId).eq("shop_id", shopId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Bulk-update listing statuses ───────────────────────────────────────────
  if (body.listingIds && typeof body.status === "string") {
    const enumStatus = STATUS_TO_ENUM[body.status] || (["draft", "active", "sold", "removed"].includes(body.status) ? body.status : null);
    if (!enumStatus) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const ids: string[] = Array.isArray(body.listingIds) ? body.listingIds : [];
    if (!ids.length) return NextResponse.json({ error: "No listing IDs provided" }, { status: 400 });

    const { error } = await db.from("listings").update({ status: enumStatus }).in("id", ids).eq("shop_id", shopId);
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

  if (typeof body.description === "string") {
    vehUpdate.description = body.description;
  }

  if (Object.keys(vehUpdate).length === 0) return NextResponse.json({ ok: true });

  const { error } = await db
    .from("vehicles")
    .update(vehUpdate)
    .eq("id", vehicleId)
    .eq("shop_id", shopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
