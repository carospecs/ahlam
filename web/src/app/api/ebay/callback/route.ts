import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { ebayConfigured, exchangeCode, saveTokens, provisionShopPolicies, EBAY_STATE_COOKIE } from "@/lib/ebay";

export const runtime = "nodejs";

// eBay redirects here after the seller consents. Exchange the code for tokens,
// store them on the shop, then bounce back into the dashboard.
export async function GET(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(EBAY_STATE_COOKIE)?.value;

  // Every exit clears the single-use state cookie.
  const done = (path: string) => {
    const res = NextResponse.redirect(new URL(path, site));
    res.cookies.set(EBAY_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (error || !code) return done("/?ebay=error");
  if (!ebayConfigured()) return done("/?ebay=error");

  // CSRF: reject unless eBay echoed back the exact state we set at connect time.
  if (!state || !expectedState || state !== expectedState) return done("/?ebay=error");

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return done("/?signin");

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return done("/?ebay=error");

  try {
    const tokens = await exchangeCode(code);
    await saveTokens(profile.shop_id, tokens);
    // Reuse/create this seller's own policies + location so one-click posting
    // works immediately. Best-effort — never block the connect on it.
    try { await provisionShopPolicies(profile.shop_id); }
    catch (e) { console.error("[ebay] policy provisioning failed:", e instanceof Error ? e.message : e); }
    return done("/?ebay=connected");
  } catch {
    return done("/?ebay=error");
  }
}
