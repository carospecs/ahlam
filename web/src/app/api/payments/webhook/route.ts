import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhook } from "@/lib/stripe";

export const runtime = "nodejs";
// Stripe needs the raw, unparsed body to verify the signature.
export const dynamic = "force-dynamic";

// Stripe → Ahlam events. Configure this URL in the Stripe dashboard and set
// STRIPE_WEBHOOK_SECRET. Two events matter:
//   checkout.session.completed → the buyer paid; mark the order paid (escrow held)
//   account.updated            → a seller finished/changed onboarding; sync flags
export async function POST(req: Request) {
  const raw = await req.text();
  const event = verifyWebhook(raw, req.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const db = supabaseAdmin();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.order_id || session.client_reference_id;
      if (orderId && session.payment_status === "paid") {
        await db
          .from("orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: session.payment_intent || null,
            shipping_name: session.customer_details?.name || null,
            buyer_email: session.customer_details?.email || session.customer_email || null,
            paid_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "pending"); // idempotent: only the first event flips it
      }
    } else if (event.type === "account.updated") {
      const account = event.data.object;
      await db
        .from("shops")
        .update({
          charges_enabled: !!account.charges_enabled,
          payouts_enabled: !!account.payouts_enabled,
        })
        .eq("stripe_account_id", account.id);
    }
  } catch {
    // Swallow handler errors so Stripe doesn't hammer retries on a bad row;
    // the event is logged in the Stripe dashboard for replay if needed.
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
