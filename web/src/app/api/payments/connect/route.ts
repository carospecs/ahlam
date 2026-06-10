import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe, stripeConfigured, isStripeError } from "@/lib/stripe";

export const runtime = "nodejs";

// Resolve the signed-in user's shop + role.
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

// GET — current payout/onboarding status for the shop, so the UI can show
// "Set up payouts" vs "Payouts active".
export async function GET() {
  const { user, shopId, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ configured: stripeConfigured(), connected: false });

  const { data: shop } = await db
    .from("shops")
    .select("stripe_account_id, charges_enabled, payouts_enabled")
    .eq("id", shopId)
    .single();

  return NextResponse.json({
    configured: stripeConfigured(),
    connected: !!shop?.stripe_account_id,
    chargesEnabled: !!shop?.charges_enabled,
    payoutsEnabled: !!shop?.payouts_enabled,
  });
}

// POST — create (or reuse) the shop's Stripe Connect Express account and return
// a fresh onboarding link to send the owner to.
export async function POST(req: Request) {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ error: "Create your shop first" }, { status: 400 });
  if (role !== "owner") return NextResponse.json({ error: "Only the shop owner can set up payouts" }, { status: 403 });
  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false, error: "Payments aren't connected yet. Add STRIPE_SECRET_KEY to enable payouts." }, { status: 503 });
  }

  try {
    const { data: shop } = await db.from("shops").select("stripe_account_id").eq("id", shopId).single();
    let accountId = shop?.stripe_account_id as string | undefined;

    if (!accountId) {
      const account = await stripe.post("accounts", {
        type: "express",
        email: user.email || undefined,
        business_type: "company",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { shop_id: shopId },
      });
      accountId = account.id;
      await db.from("shops").update({ stripe_account_id: accountId }).eq("id", shopId);
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const link = await stripe.post("account_links", {
      account: accountId,
      refresh_url: `${origin}/?payouts=refresh`,
      return_url: `${origin}/?payouts=done`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (e) {
    if (isStripeError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Could not start payout setup" }, { status: 500 });
  }
}
