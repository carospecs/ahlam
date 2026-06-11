import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// NMVTIS reporting scaffolding (CMP-1). US dismantlers must report the
// junk/salvage vehicles they obtain to the National Motor Vehicle Title
// Information System. This endpoint:
//   GET                 → reporting-entity config + the vehicles to report,
//                          each row mapped to NMVTIS junk/salvage fields.
//   POST { markReported, vehicleIds?, period } → stamp vehicles as reported.
//
// Defaults are derived so it works on existing data: date obtained falls back to
// created_at, and disposition is inferred from how the car is being sold.

type NmvtisDisposition = "crush" | "scrap" | "sold" | "parts" | "export";

function dispositionLabel(d: string): string {
  switch (d) {
    case "crush": return "Crushed";
    case "scrap": return "Scrapped";
    case "sold": return "Sold (whole vehicle)";
    case "export": return "Exported";
    case "parts": default: return "Sold for parts / dismantled";
  }
}

// Infer a default NMVTIS disposition from the vehicle's sell mode when the yard
// hasn't recorded one explicitly. Parting out → dismantled; whole → sold.
function inferDisposition(v: any): NmvtisDisposition {
  if (v.nmvtis_disposition) return v.nmvtis_disposition;
  if (v.status === "sold" && (v.sell_mode === "whole")) return "sold";
  if (v.sell_mode === "whole") return "sold";
  return "parts";
}

async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, shopId: null, role: null, db: supabaseAdmin() };
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id || null;
  let role: string | null = null;
  if (shopId) {
    const { data: m } = await db.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", user.id).single();
    role = m?.role || null;
  }
  return { user, shopId, role, db };
}

function toRow(v: any, shop: any) {
  const dateObtained = v.date_obtained || (v.created_at ? String(v.created_at).slice(0, 10) : "");
  const disp = inferDisposition(v);
  return {
    id: v.id,
    reportingEntity: shop?.nmvtis_entity_name || shop?.name || "",
    nmvtisId: shop?.nmvtis_id || "",
    vin: v.vin || "",
    modelYear: v.year || "",
    make: v.make || "",
    model: v.model || "",
    dateObtained,
    obtainedFromName: v.obtained_from_name || "",
    obtainedFromAddress: v.obtained_from_address || "",
    disposition: disp,
    dispositionLabel: dispositionLabel(disp),
    reportedAt: v.nmvtis_reported_at || null,
    period: v.nmvtis_period || null,
    missingVin: !v.vin,
  };
}

export async function GET() {
  const { user, shopId, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { data: shop } = await db.from("shops").select("name, nmvtis_id, nmvtis_entity_name").eq("id", shopId).single();
  const { data: vehicles } = await db
    .from("vehicles")
    .select("id, vin, year, make, model, sell_mode, status, created_at, date_obtained, obtained_from_name, obtained_from_address, nmvtis_disposition, nmvtis_reported_at, nmvtis_period")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  const rows = (vehicles || []).map((v) => toRow(v, shop));
  return NextResponse.json({
    entity: { name: shop?.nmvtis_entity_name || shop?.name || "", nmvtisId: shop?.nmvtis_id || "" },
    configured: !!shop?.nmvtis_id,
    total: rows.length,
    reported: rows.filter((r) => r.reportedAt).length,
    unreported: rows.filter((r) => !r.reportedAt).length,
    missingVin: rows.filter((r) => r.missingVin).length,
    rows,
  });
}

// Mark vehicles as reported for a period (audit trail). Owners/editors only.
export async function POST(req: Request) {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ error: "No workspace" }, { status: 400 });
  if (role !== "owner" && role !== "editor") {
    return NextResponse.json({ error: "You don't have permission to file reports" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.markReported) return NextResponse.json({ error: "Nothing to do" }, { status: 400 });

  const period = typeof body.period === "string" && /^\d{4}-\d{2}$/.test(body.period)
    ? body.period
    : new Date().toISOString().slice(0, 7);

  let q = db.from("vehicles").update({ nmvtis_reported_at: new Date().toISOString(), nmvtis_period: period }).eq("shop_id", shopId);
  if (Array.isArray(body.vehicleIds) && body.vehicleIds.length) {
    q = q.in("id", body.vehicleIds);
  } else {
    // Default: everything not yet reported.
    q = q.is("nmvtis_reported_at", null);
  }
  const { data, error } = await q.select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, marked: data?.length || 0, period });
}
