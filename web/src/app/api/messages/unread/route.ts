import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// Lightweight poll target for the in-app message notifier. Covers BOTH sides:
// the shop inbox (buyers writing in, conversations.unread) and the buying side
// (sellers replying to me, conversations.buyer_unread). Returns the combined
// unread total plus the newest inbound message so the client can detect a brand
// new message and fire a toast + sound + browser notification without
// re-pulling the whole /api/data payload.
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = (profile as { shop_id?: string | null } | null)?.shop_id || null;

  // ---- Selling side: buyers writing to my shop -----------------------------
  let sellerTotal = 0;
  let sellerLatest: { id: string; at: number; name: string; preview: string } | null = null;
  if (shopId) {
    const { data: convs } = await db.from("conversations").select("unread").eq("shop_id", shopId);
    sellerTotal = (convs || []).reduce((n: number, c: any) => n + (c.unread || 0), 0);

    const { data: rows } = await db
      .from("messages")
      .select("id, body, created_at, conversations!inner(shop_id, contact_name)")
      .eq("conversations.shop_id", shopId)
      .eq("sender", "them")
      .order("created_at", { ascending: false })
      .limit(1);
    const r: any = (rows || [])[0] || null;
    if (r) {
      sellerLatest = {
        id: r.id,
        at: new Date(r.created_at || 0).getTime(),
        name: r.conversations?.contact_name || "A buyer",
        preview: String(r.body || "").slice(0, 120),
      };
    }
  }

  // ---- Buying side: sellers replying to me ---------------------------------
  // Graceful before migration 0040 (buyer_unread column): skip the counter.
  let buyerTotal = 0;
  let buyerLatest: { id: string; at: number; name: string; preview: string } | null = null;
  const { data: mine, error: mineErr } = await db
    .from("conversations")
    .select("id, shop_id, buyer_unread")
    .eq("buyer_id", user.id);
  if (!mineErr && mine?.length) {
    buyerTotal = mine.reduce((n: number, c: any) => n + (c.buyer_unread || 0), 0);
    const ids = mine.map((c: any) => c.id);
    const { data: rows } = await db
      .from("messages")
      .select("id, body, created_at, conversation_id")
      .in("conversation_id", ids)
      .eq("sender", "me") // seller replies, from the buyer's perspective
      .order("created_at", { ascending: false })
      .limit(1);
    const r: any = (rows || [])[0] || null;
    if (r) {
      const conv = mine.find((c: any) => c.id === r.conversation_id);
      let name = "The seller";
      if (conv?.shop_id) {
        const { data: shop } = await db.from("shops").select("name").eq("id", conv.shop_id).maybeSingle();
        name = (shop as { name?: string } | null)?.name || name;
      }
      buyerLatest = { id: r.id, at: new Date(r.created_at || 0).getTime(), name, preview: String(r.body || "").slice(0, 120) };
    }
  }

  const latest =
    sellerLatest && buyerLatest
      ? (sellerLatest.at >= buyerLatest.at ? sellerLatest : buyerLatest)
      : sellerLatest || buyerLatest;

  return NextResponse.json({
    total: sellerTotal + buyerTotal,
    latestId: latest?.id || null,
    latest: latest ? { name: latest.name, preview: latest.preview } : null,
  });
}
