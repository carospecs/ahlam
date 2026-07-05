import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkUsage, recordUsage, effectiveShopPlan, limitMessage } from "@/lib/usage";

export const runtime = "nodejs";

// Meters an export (cross-post) against the Solo plan's monthly caps —
// export_car (20/mo) and export_part (100/mo). The Export Center calls this
// before opening the marketplaces; if over quota it returns { allowed:false,
// message } and the cross-post is blocked. Every other plan is unlimited, so
// this short-circuits to allowed. FAIL-OPEN on any error — an export is never
// blocked because a usage lookup failed or the table isn't migrated.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ allowed: true });

  const body = await req.json().catch(() => ({}));
  const cars = Math.max(0, Math.floor(Number(body.cars) || 0));
  const parts = Math.max(0, Math.floor(Number(body.parts) || 0));
  if (!cars && !parts) return NextResponse.json({ allowed: true });

  try {
    const db = supabaseAdmin();
    const { data: prof } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
    const shopId = (prof?.shop_id as string) || null;
    if (!shopId) return NextResponse.json({ allowed: true });
    const plan = await effectiveShopPlan(db, shopId);

    if (cars) {
      const u = await checkUsage(db, shopId, plan, "export_car", cars);
      if (!u.allowed) return NextResponse.json({ allowed: false, message: limitMessage("export_car", u.limit ?? 0, plan) });
    }
    if (parts) {
      const u = await checkUsage(db, shopId, plan, "export_part", parts);
      if (!u.allowed) return NextResponse.json({ allowed: false, message: limitMessage("export_part", u.limit ?? 0, plan) });
    }
    // Within quota — record the export.
    if (cars) void recordUsage(db, shopId, "export_car", cars);
    if (parts) void recordUsage(db, shopId, "export_part", parts);
    return NextResponse.json({ allowed: true });
  } catch {
    return NextResponse.json({ allowed: true }); // fail-open
  }
}
