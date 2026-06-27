import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhook } from "@/lib/stripe";

export const runtime = "nodejs";
// Stripe needs the raw, unparsed body to verify the signature.
export const dynamic = "force-dynamic";

// Stripe → Ahlam events. Configure this URL in the Stripe dashboard and set
// STRIPE_WEBHOOK_SECRET. Events handled:
//   checkout.session.completed (mode=payment)      → escrow order paid
//   checkout.session.completed (mode=subscription) → activate the shop's plan
//   customer.subscription.updated / .deleted       → keep plan + status in sync
//   account.updated                                → seller onboarding flags
export async function POST(req: Request) {
  const raw = await req.text();
  const event = verifyWebhook(raw, req.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const db = supabaseAdmin();

  // Resolve the shop a Supabase user belongs to (subscriptions are per-shop).
  async function shopIdForUser(userId: string): Promise<string | null> {
    const { data } = await db.from("profiles").select("shop_id").eq("id", userId).single();
    return data?.shop_id || null;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // (1) Subscription checkout → activate the plan on the buyer's shop.
      if (session.mode === "subscription" || session.subscription) {
        const userId = session.client_reference_id as string | undefined;
        const plan = session.metadata?.plan as string | undefined;
        const customer = (typeof session.customer === "string" ? session.customer : session.customer?.id) || null;
        const shopId = userId ? await shopIdForUser(userId) : null;
        if (shopId) {
          await db
            .from("shops")
            .update({
              stripe_customer_id: customer,
              subscription_status: "active",
              ...(plan ? { plan } : {}),
            })
            .eq("id", shopId);
        }
      } else {
        // (2) Escrow order payment → mark the order paid (held on the platform).
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
      }
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      if (customer) {
        await db.from("shops").update({ subscription_status: sub.status })
          .eq("stripe_customer_id", customer);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      if (customer) {
        // Subscription ended → drop the shop back to the free default plan.
        await db.from("shops").update({ subscription_status: "canceled", plan: "Free" })
          .eq("stripe_customer_id", customer);
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
