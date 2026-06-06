import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { ebayConfigured, exchangeCode, saveTokens } from "@/lib/ebay";

export const runtime = "nodejs";

// eBay redirects here after the seller consents. Exchange the code for tokens,
// store them on the shop, then bounce back into the dashboard.
export async function GET(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error || !code) return NextResponse.redirect(new URL("/?ebay=error", site));
  if (!ebayConfigured()) return NextResponse.redirect(new URL("/?ebay=error", site));

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/?signin", site));

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return NextResponse.redirect(new URL("/?ebay=error", site));

  try {
    const tokens = await exchangeCode(code);
    await saveTokens(profile.shop_id, tokens);
    return NextResponse.redirect(new URL("/?ebay=connected", site));
  } catch {
    return NextResponse.redirect(new URL("/?ebay=error", site));
  }
}
