import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkUsage, resolveShopPlan } from "@/lib/usage";
import { planLabel } from "@/lib/plan-limits";

export const runtime = "nodejs";

/**
 * GET /api/usage/scan → { used, limit, remaining, plan, planLabel }
 * Read-only scan-quota status for the signed-in user's shop, so the scanner
 * can show a "car scans left" ticker. limit === null means unlimited
 * (remaining === null too). Fail-open like every other usage helper: on any
 * lookup problem report unlimited rather than scaring a paying user.
 */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = supabaseAdmin();
    const { shopId, plan } = await resolveShopPlan(db, user.id);
    if (!shopId) return NextResponse.json({ used: 0, limit: null, remaining: null, plan, planLabel: planLabel(plan) });
    const u = await checkUsage(db, shopId, plan, "scan", 0);
    const remaining = u.limit == null ? null : Math.max(0, u.limit - u.used);
    return NextResponse.json({ used: u.used, limit: u.limit, remaining, plan, planLabel: planLabel(plan) });
  } catch {
    return NextResponse.json({ used: 0, limit: null, remaining: null, plan: "pro", planLabel: "Pro" });
  }
}
