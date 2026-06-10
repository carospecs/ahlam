import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Returns the user's orders split into two lists: things they've bought
// ("purchases") and things their shop has sold ("sales").
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id || null;

  const { data: purchases } = await db
    .from("orders")
    .select("*")
    .eq("buyer_id", user.id)
    .neq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: sales } = shopId
    ? await db
        .from("orders")
        .select("*")
        .eq("seller_shop_id", shopId)
        .neq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({ purchases: purchases || [], sales: sales || [] });
}
