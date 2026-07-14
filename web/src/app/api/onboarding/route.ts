import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { geocode } from "@/lib/geocode";
import { sendMail, FOUNDER_REVIEWERS } from "@/lib/mailer";
import { buildWelcomeEmail, ONBOARDING_FROM, ONBOARDING_CC } from "@/lib/onboarding-email";

export const runtime = "nodejs";

// Creates a shop for the signed-in user (web onboarding), links it on their
// profile, and makes them the owner. Also claims any pending team invites first
// so invited teammates join the right shop instead of creating a duplicate.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  // 1. Claim pending invites for this email.
  if (user.email) {
    const { data: invites } = await db
      .from("shop_invites").select("*").eq("status", "pending").ilike("email", user.email);
    for (const inv of invites || []) {
      await db.from("shop_members").upsert(
        { shop_id: inv.shop_id, user_id: user.id, role: inv.role },
        { onConflict: "shop_id,user_id" }
      );
      await db.from("shop_invites").update({ status: "accepted" }).eq("id", inv.id);
      await db.from("profiles").update({ shop_id: inv.shop_id }).eq("id", user.id);
    }
    if ((invites || []).length) {
      return NextResponse.json({ ok: true, joined: true });
    }
  }

  // 2. If they already belong to a shop, just make sure their profile is linked.
  const { data: existing } = await db
    .from("shop_members").select("shop_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing?.shop_id) {
    await db.from("profiles").update({ shop_id: existing.shop_id }).eq("id", user.id);
    return NextResponse.json({ ok: true, joined: true });
  }

  // 3. Otherwise create a new shop (individuals get the same workspace, named after themselves).
  const { name, location, phone, accountType, address, zip: zipIn } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // 4. Geocode the shop's ZIP (preferred) or location to lat/lng for distance sorting.
  let lat: number | null = null;
  let lng: number | null = null;
  const zip: string | null = (zipIn || "").trim() || null;
  if (zip || address?.trim() || location?.trim()) {
    const geo = await geocode({ zip, location: address || location });
    if (geo) { lat = geo.lat; lng = geo.lng; }
  }

  const type = accountType === "individual" ? "individual" : "shop";
  const shopLocation = location || address || null;

  // Launch grants: everyone starts with a free month (plan "starter"). Waitlist
  // members get the founding month instead — every top-tier feature unlocked,
  // 5 AI car scans, unlimited manual posting (enforced in lib/plan-limits.ts).
  // Every new shop starts on the free month (a Growth month). "founder" is the
  // founders' own full-access plan, assigned by hand from the founder console.
  const plan = "starter";
  const trialEndsAt = new Date(Date.now() + 30 * 86400000).toISOString();

  // Try to persist account_type; if a column doesn't exist yet, fall back
  // gracefully. Only a column-shaped error drops a field, and plan +
  // trial_ends_at travel as a pair (a trial plan without an end date would
  // read as already expired).
  const shopRow: Record<string, unknown> = {
    name: name.trim(), location: shopLocation, business_phone: phone || null,
    lat, lng, zip_code: zip, address_line: address || null,
    account_type: type, plan, trial_ends_at: trialEndsAt,
  };
  const columnError = (msg: string, col: string) =>
    msg.includes(col) && /column|schema cache|does not exist/i.test(msg);
  let { data: shop, error: shopErr } = await db.from("shops").insert(shopRow).select().single();
  for (let attempt = 0; shopErr && attempt < 3; attempt++) {
    let dropped = false;
    const msg = shopErr.message || "";
    if ("account_type" in shopRow && columnError(msg, "account_type")) { delete shopRow.account_type; dropped = true; }
    if (("plan" in shopRow && columnError(msg, "plan")) || ("trial_ends_at" in shopRow && columnError(msg, "trial_ends_at"))) {
      delete shopRow.plan; delete shopRow.trial_ends_at; dropped = true;
    }
    if (!dropped) break;
    ({ data: shop, error: shopErr } = await db.from("shops").insert(shopRow).select().single());
  }
  if (shopErr || !shop) return NextResponse.json({ error: shopErr?.message || "Could not create account" }, { status: 500 });

  await db.from("shop_members").insert({ shop_id: shop.id, user_id: user.id, role: "owner" });
  await db.from("profiles").update({ shop_id: shop.id }).eq("id", user.id);

  // Onboarding on autopilot: the moment a shop exists, send the welcome email
  // (docs/onboarding/ONBOARDING_KIT.md) from Andy with Mohammad CC'd so both
  // founders see every new shop. Awaited (serverless would drop a floating
  // promise after the response), but sendMail never throws: a mail hiccup
  // logs and returns false instead of failing the signup.
  if (user.email) {
    const firstName = String(user.user_metadata?.full_name || "").trim().split(/\s+/)[0];
    const { subject, text } = buildWelcomeEmail({
      name: firstName || name.trim(),
      appUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io/adminhost",
    });
    await sendMail({
      to: user.email,
      from: ONBOARDING_FROM,
      cc: ONBOARDING_CC,
      replyTo: FOUNDER_REVIEWERS, // "hit reply" reaches both founders
      subject,
      text,
    });
  }

  return NextResponse.json({ ok: true, shop, geo: lat ? { lat, lng, zip } : null });
}
