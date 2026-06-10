import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe, stripeConfigured, feeCentsFor, isStripeError } from "@/lib/stripe";

export const runtime = "nodejs";

// Buyer presses "Buy now". We snapshot the item + price, create a pending order,
// and open a Stripe Checkout session. The charge lands on the Ahlam platform
// balance (escrow); funds are transferred to the seller only after the buyer
// confirms receipt (see /api/payments/release).
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to buy" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false, error: "Checkout isn't connected yet — message the seller to arrange payment." }, { status: 503 });
  }

  const { listingId, vehicleId } = await req.json().catch(() => ({}));
  if (!listingId && !vehicleId) return NextResponse.json({ error: "Nothing to buy" }, { status: 400 });

  // Demo rows have no real seller — can't be purchased.
  if ((listingId && String(listingId).startsWith("m")) || (vehicleId && String(vehicleId).startsWith("m"))) {
    return NextResponse.json({ error: "This is a sample listing — real inventory appears as shops post." }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Resolve the item: title, price (in cents), and the selling shop.
  let title = "";
  let amountCents = 0;
  let sellerShopId: string | null = null;
  let photoUrl: string | null = null;

  if (listingId) {
    const { data: l } = await db.from("listings").select("*").eq("id", listingId).eq("status", "active").single();
    if (!l) return NextResponse.json({ error: "This part is no longer available" }, { status: 404 });
    const c = l.corrected || l.ai_output || {};
    title = c.partName || c.part_name || "Used Part";
    const price = l.price_usd ?? c.priceUsd ?? c.suggestedPriceUsd ?? c.suggested_price ?? 0;
    amountCents = Math.round(Number(price) * 100);
    sellerShopId = l.shop_id;
    photoUrl = l.photo_url || null;
  } else {
    const { data: v } = await db.from("vehicles").select("*").eq("id", vehicleId).single();
    if (!v) return NextResponse.json({ error: "This vehicle is no longer available" }, { status: 404 });
    title = `${v.year || ""} ${v.make || ""} ${v.model || ""} ${v.trim || ""}`.trim();
    amountCents = Math.round(Number(v.asking_price || 0) * 100);
    sellerShopId = v.shop_id;
    photoUrl = v.photo_url || null;
  }

  if (amountCents < 100) {
    return NextResponse.json({ error: "This listing has no set price — message the seller for a quote." }, { status: 400 });
  }

  // Buyers can't purchase their own shop's listings.
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  if (profile?.shop_id && profile.shop_id === sellerShopId) {
    return NextResponse.json({ error: "This is your own listing." }, { status: 400 });
  }

  // The seller must have finished payout onboarding before we can take money.
  const { data: shop } = sellerShopId
    ? await db.from("shops").select("name, stripe_account_id, charges_enabled").eq("id", sellerShopId).single()
    : { data: null };
  if (!shop?.stripe_account_id || !shop?.charges_enabled) {
    return NextResponse.json({ error: "This seller hasn't enabled card payments yet — message them to arrange the sale." }, { status: 409 });
  }

  const feeCents = feeCentsFor(amountCents);

  // Create the pending order first so the webhook has a row to flip to "paid".
  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      listing_id: listingId || null,
      vehicle_id: vehicleId || null,
      buyer_id: user.id,
      seller_shop_id: sellerShopId,
      title,
      amount_cents: amountCents,
      fee_cents: feeCents,
      buyer_email: user.email || null,
      status: "pending",
    })
    .select()
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "Could not start the order" }, { status: 500 });

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  try {
    const session = await stripe.post("checkout/sessions", {
      mode: "payment",
      customer_email: user.email || undefined,
      client_reference_id: order.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: { name: title, images: photoUrl ? [photoUrl] : undefined },
          },
        },
      ],
      // Funds stay on the platform balance (escrow). We transfer to the seller's
      // connected account on release, so no transfer_data here.
      payment_intent_data: {
        metadata: { order_id: order.id, seller_shop_id: sellerShopId || "" },
      },
      metadata: { order_id: order.id },
      success_url: `${origin}/?order=success&id=${order.id}`,
      cancel_url: `${origin}/?order=cancelled&id=${order.id}`,
    });

    await db.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ url: session.url, orderId: order.id });
  } catch (e) {
    // Roll the order back so a failed session doesn't leave a stuck "pending".
    await db.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    if (isStripeError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
