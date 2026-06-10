import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Bulk pricing editor. Select listings by explicit ids, by category, and/or by
// vehicle, then apply a price change:
//   mode "percent" → price * (1 + value/100)   e.g. value -10 → 10% off
//   mode "delta"   → price + value
//   mode "set"     → value (flat price for all)
// Returns how many were updated and a preview of the new prices when dryRun.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ error: "No shop" }, { status: 400 });
  const { data: member } = await db.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", user.id).single();
  if (member?.role !== "owner" && member?.role !== "editor") {
    return NextResponse.json({ error: "You don't have permission to change prices" }, { status: 403 });
  }

  const { ids, category, vehicleId, mode, value, dryRun } = await req.json().catch(() => ({}));
  if (!["percent", "delta", "set"].includes(mode) || typeof value !== "number" || Number.isNaN(value)) {
    return NextResponse.json({ error: "Pick a change type and a value" }, { status: 400 });
  }
  if (mode === "set" && value < 0) return NextResponse.json({ error: "Price can't be negative" }, { status: 400 });

  // Pull the shop's listings within scope.
  let query = db.from("listings").select("id, price_usd, ai_output, corrected, vehicle_id").eq("shop_id", shopId);
  if (Array.isArray(ids) && ids.length) query = query.in("id", ids);
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const catLower = category && category !== "All" ? String(category).toLowerCase() : null;
  const targets = (rows || []).filter((l: any) => {
    if (!catLower) return true;
    const c = l.corrected || l.ai_output || {};
    const cat = (c.partCategory || c.part_category || "").toLowerCase();
    return cat === catLower;
  });

  const compute = (base: number) => {
    let next = mode === "percent" ? base * (1 + value / 100) : mode === "delta" ? base + value : value;
    next = Math.max(0, Math.round(next * 100) / 100);
    return next;
  };

  const updates = targets.map((l: any) => {
    const base = Number(l.price_usd ?? (l.corrected?.suggestedPriceUsd) ?? (l.ai_output?.suggestedPriceUsd) ?? 0);
    return { id: l.id, from: base, to: compute(base) };
  });

  if (dryRun) {
    return NextResponse.json({ ok: true, preview: true, count: updates.length, sample: updates.slice(0, 8) });
  }
  if (!updates.length) return NextResponse.json({ ok: true, updated: 0 });

  let updated = 0;
  const errors: string[] = [];
  for (const u of updates) {
    const { error: e } = await db.from("listings").update({ price_usd: u.to }).eq("id", u.id).eq("shop_id", shopId);
    if (e) errors.push(e.message); else updated++;
  }

  return NextResponse.json({ ok: errors.length === 0, updated, errors });
}
