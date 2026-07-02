import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabase-server";
import { ebayConfigured, consentUrl, EBAY_STATE_COOKIE } from "@/lib/ebay";

export const runtime = "nodejs";

// Kicks off eBay OAuth: redirect the seller to eBay's consent screen.
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/?signin", site));

  if (!ebayConfigured()) {
    return NextResponse.json({ error: "eBay isn't configured on this server yet." }, { status: 503 });
  }

  // CSRF: a random, unguessable state echoed back by eBay and matched against an
  // HttpOnly cookie in the callback. Without this, an attacker can forge a
  // callback with their OWN authorization code and bind their eBay account to
  // the victim's shop (the victim's parts would then publish to the attacker).
  const state = randomBytes(32).toString("base64url");
  const res = NextResponse.redirect(consentUrl(state));
  res.cookies.set(EBAY_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete consent
  });
  return res;
}
