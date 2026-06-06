import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// Open the Stripe customer billing portal. Needs the shop's stored
// stripe_customer_id (set by a webhook after the first successful checkout).
// Reports "not configured" / "no subscription yet" honestly until then.
export async function POST() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ configured: false, error: "Billing isn't connected yet." }, { status: 503 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const { data: shop } = profile?.shop_id
    ? await db.from("shops").select("stripe_customer_id").eq("id", profile.shop_id).single()
    : { data: null };
  const customer = (shop as any)?.stripe_customer_id;
  if (!customer) {
    return NextResponse.json({ configured: true, error: "No subscription yet — start one first." }, { status: 409 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "";
  const params = new URLSearchParams({ customer, return_url: `${origin}/` });
  const r = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const session = await r.json();
  if (!r.ok) return NextResponse.json({ error: session?.error?.message || "Stripe error" }, { status: 502 });
  return NextResponse.json({ url: session.url });
}
