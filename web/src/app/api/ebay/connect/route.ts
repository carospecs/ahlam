import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { ebayConfigured, consentUrl } from "@/lib/ebay";

export const runtime = "nodejs";

// Kicks off eBay OAuth: redirect the seller to eBay's consent screen.
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/?signin", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  if (!ebayConfigured()) {
    return NextResponse.json({ error: "eBay isn't configured on this server yet." }, { status: 503 });
  }
  // CSRF state — tie the round-trip to this user.
  const state = Buffer.from(`${user.id}:${Date.now()}`).toString("base64url");
  return NextResponse.redirect(consentUrl(state));
}
