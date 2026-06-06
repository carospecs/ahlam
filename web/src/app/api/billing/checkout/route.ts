import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Create a Stripe Checkout session for the subscription. Activates the moment
// STRIPE_SECRET_KEY + STRIPE_PRICE_ID are set in the environment — no SDK needed,
// we call the Stripe REST API directly. Until then it reports "not configured"
// so the UI can show an honest message instead of a broken button.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID;
  if (!key || !price) {
    return NextResponse.json({ configured: false, error: "Billing isn't connected yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to go live." }, { status: 503 });
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${origin}/?billing=success`);
  params.set("cancel_url", `${origin}/?billing=cancelled`);
  if (user.email) params.set("customer_email", user.email);
  params.set("client_reference_id", user.id);
  params.set("allow_promotion_codes", "true");

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const session = await r.json();
  if (!r.ok) return NextResponse.json({ error: session?.error?.message || "Stripe error" }, { status: 502 });
  return NextResponse.json({ url: session.url });
}
