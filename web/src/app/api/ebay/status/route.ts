import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { ebayConfigured, ebayEnv, getConnection } from "@/lib/ebay";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;

  const configured = ebayConfigured();
  let connected = false;
  let account: string | null = null;
  if (configured && shopId) {
    try {
      const conn = await getConnection(shopId);
      connected = !!conn?.refresh_token || !!conn?.access_token;
      account = conn?.account_label || null;
    } catch { /* table may not exist until migration 0016 */ }
  }
  return NextResponse.json({ ok: true, configured, connected, account, env: ebayEnv() });
}
