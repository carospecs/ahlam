import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

interface GeocodeResult {
  lat: number;
  lng: number;
  zip: string;
  displayName: string;
}

async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      { headers: { "User-Agent": "Ahlam/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    const r = data[0];
    const addr = r.address || {};
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      zip: addr.postcode || "",
      displayName: r.display_name || "",
    };
  } catch {
    return null;
  }
}

// Creates a shop for the signed-in user (web onboarding), links it on their
// profile, and makes them the owner. Also claims any pending team invites first
// so invited teammates join the right shop instead of creating a duplicate.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  // 1. Claim pending invites for this email.
  if (user.email) {
    const { data: invites } = await db
      .from("shop_invites").select("*").eq("status", "pending").ilike("email", user.email);
    for (const inv of invites || []) {
      await db.from("shop_members").upsert(
        { shop_id: inv.shop_id, user_id: user.id, role: inv.role },
        { onConflict: "shop_id,user_id" }
      );
      await db.from("shop_invites").update({ status: "accepted" }).eq("id", inv.id);
      await db.from("profiles").update({ shop_id: inv.shop_id }).eq("id", user.id);
    }
    if ((invites || []).length) {
      return NextResponse.json({ ok: true, joined: true });
    }
  }

  // 2. If they already belong to a shop, just make sure their profile is linked.
  const { data: existing } = await db
    .from("shop_members").select("shop_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing?.shop_id) {
    await db.from("profiles").update({ shop_id: existing.shop_id }).eq("id", user.id);
    return NextResponse.json({ ok: true, joined: true });
  }

  // 3. Otherwise create a new shop (individuals get the same workspace, named after themselves).
  const { name, location, phone, accountType, address } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // 4. Geocode the address to get lat/lng/zip for distance sorting.
  let lat: number | null = null;
  let lng: number | null = null;
  let zip: string | null = null;
  let displayName: string | null = null;
  if (address?.trim()) {
    const geo = await geocodeAddress(address.trim());
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      zip = geo.zip;
      displayName = geo.displayName;
    }
  }

  const type = accountType === "individual" ? "individual" : "shop";
  const shopLocation = displayName || location || null;

  // Try to persist account_type; if the column doesn't exist yet, fall back gracefully.
  let { data: shop, error: shopErr } = await db
    .from("shops").insert({
      name: name.trim(), location: shopLocation, business_phone: phone || null,
      lat, lng, zip_code: zip, address_line: address || null,
      account_type: type,
    }).select().single();
  if (shopErr && /account_type/.test(shopErr.message || "")) {
    ({ data: shop, error: shopErr } = await db.from("shops").insert({
      name: name.trim(), location: shopLocation, business_phone: phone || null,
      lat, lng, zip_code: zip, address_line: address || null,
    }).select().single());
  }
  if (shopErr || !shop) return NextResponse.json({ error: shopErr?.message || "Could not create account" }, { status: 500 });

  await db.from("shop_members").insert({ shop_id: shop.id, user_id: user.id, role: "owner" });
  await db.from("profiles").update({ shop_id: shop.id }).eq("id", user.id);

  return NextResponse.json({ ok: true, shop, geo: lat ? { lat, lng, zip } : null });
}
