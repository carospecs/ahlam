import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { PLAN_PRODUCTS } from "@/lib/plans";

// Create a Stripe Checkout session for the chosen plan. Needs STRIPE_SECRET_KEY.
// Each plan maps to a Stripe PRODUCT (web/src/lib/plans.ts); we resolve that
// product's price server-side (default_price, else its first active price), so
// callers only pass a plan id. Falls back to STRIPE_PRICE_ID when no plan is given.
// No SDK — Stripe REST API directly.

async function stripeGet(path: string, key: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return { ok: r.ok, json: await r.json() };
}

// Resolve a product id → a usable price id (its default price, or first active one).
async function priceForProduct(productId: string, key: string): Promise<string | null> {
  const prod = await stripeGet(`products/${productId}`, key);
  if (prod.ok && typeof prod.json.default_price === "string" && prod.json.default_price) {
    return prod.json.default_price;
  }
  const prices = await stripeGet(`prices?product=${productId}&active=true&limit=1`, key);
  const first = prices.ok ? prices.json.data?.[0]?.id : null;
  return typeof first === "string" ? first : null;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ configured: false, error: "Billing isn't connected yet. Add STRIPE_SECRET_KEY to go live." }, { status: 503 });
  }

  // Which plan? Body may be { plan: "growth" } (new) or empty (legacy single price).
  let plan: string | undefined;
  try { plan = (await req.json())?.plan; } catch { /* no body */ }

  let price: string | null = null;
  if (plan && PLAN_PRODUCTS[plan]) {
    price = await priceForProduct(PLAN_PRODUCTS[plan], key);
    if (!price) return NextResponse.json({ error: `No active Stripe price found for the ${plan} plan.` }, { status: 502 });
  } else {
    price = process.env.STRIPE_PRICE_ID || null;
  }
  if (!price) {
    return NextResponse.json({ configured: false, error: "No plan selected and no default STRIPE_PRICE_ID set." }, { status: 503 });
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
  if (plan) params.set("metadata[plan]", plan);
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
