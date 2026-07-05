import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { PLAN_LIMITS } from "@/lib/plan-limits";

export const runtime = "nodejs";

// Every id the plan_tier enum accepts (PLAN_LIMITS holds the metered ones;
// ultimate and pro fall through to unlimited).
const VALID_PLANS = new Set([...Object.keys(PLAN_LIMITS), "ultimate", "pro"]);

/**
 * POST /api/admin/shop → founder console: change a shop's plan.
 * Body: { shopId, plan }. Assigning a free-month plan (starter/founder) also
 * starts a fresh 30-day clock, so it never lands already expired.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const shopId = String(body.shopId ?? "");
  const plan = String(body.plan ?? "").toLowerCase();
  if (!shopId) return NextResponse.json({ error: "shopId is required" }, { status: 400 });
  if (!VALID_PLANS.has(plan)) return NextResponse.json({ error: `Unknown plan "${plan}"` }, { status: 400 });

  const update: Record<string, unknown> = { plan };
  if (plan === "starter" || plan === "founder") {
    update.trial_ends_at = new Date(Date.now() + 30 * 86400000).toISOString();
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("shops")
    .update(update)
    .eq("id", shopId)
    .select("id, name, plan, trial_ends_at, subscription_status")
    .single();
  if (error || !data) {
    console.error("admin plan change failed", error);
    return NextResponse.json({ error: error?.message || "Update failed" }, { status: 500 });
  }
  console.log(`[admin] ${admin} set shop ${data.name} (${shopId}) to plan ${plan}`);
  return NextResponse.json({ ok: true, shop: data });
}
