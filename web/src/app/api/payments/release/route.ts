import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe, isStripeError } from "@/lib/stripe";

export const runtime = "nodejs";

// Order fulfillment + escrow release.
//   action "ship"    — the seller marks a paid order as shipped/ready.
//   action "confirm" — the buyer confirms they received the part. This releases
//                      the held funds: we transfer (amount − Ahlam fee) to the
//                      seller's connected account and complete the order. Also
//                      flips the listing to "sold".
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, action } = await req.json().catch(() => ({}));
  if (!orderId || !["ship", "confirm"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // -- Seller marks shipped ------------------------------------------------
  if (action === "ship") {
    const { data: m } = await db
      .from("shop_members")
      .select("role")
      .eq("shop_id", order.seller_shop_id)
      .eq("user_id", user.id)
      .single();
    if (!m || (m.role !== "owner" && m.role !== "editor")) {
      return NextResponse.json({ error: "Only the selling shop can update this order" }, { status: 403 });
    }
    if (order.status !== "paid") {
      return NextResponse.json({ error: "Order isn't ready to ship" }, { status: 409 });
    }
    await db.from("orders").update({ status: "shipped" }).eq("id", orderId);
    return NextResponse.json({ ok: true, status: "shipped" });
  }

  // -- Buyer confirms receipt → release escrow -----------------------------
  if (order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Only the buyer can confirm this order" }, { status: 403 });
  }
  if (order.status !== "paid" && order.status !== "shipped") {
    return NextResponse.json({ error: "This order can't be confirmed" }, { status: 409 });
  }

  const { data: shop } = await db
    .from("shops")
    .select("stripe_account_id")
    .eq("id", order.seller_shop_id)
    .single();
  if (!shop?.stripe_account_id) {
    return NextResponse.json({ error: "Seller payout account is missing" }, { status: 409 });
  }

  const payoutCents = Math.max(0, order.amount_cents - order.fee_cents);

  try {
    const transfer = await stripe.post("transfers", {
      amount: payoutCents,
      currency: order.currency || "usd",
      destination: shop.stripe_account_id,
      transfer_group: order.id,
      metadata: { order_id: order.id },
    });

    await db
      .from("orders")
      .update({ status: "completed", stripe_transfer_id: transfer.id, completed_at: new Date().toISOString() })
      .eq("id", orderId);

    // Mark the underlying part sold so it leaves the marketplace.
    if (order.listing_id) {
      await db.from("listings").update({ status: "sold" }).eq("id", order.listing_id);
    }

    return NextResponse.json({ ok: true, status: "completed" });
  } catch (e) {
    if (isStripeError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Could not release payment" }, { status: 500 });
  }
}
