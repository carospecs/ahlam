import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// Feeds the topbar bell dropdown: the latest inbound message per conversation,
// across both sides (buyers writing to my shop + sellers replying to me),
// newest first. Each item carries enough to open the exact thread in Messages.
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = (profile as { shop_id?: string | null } | null)?.shop_id || null;

  type Item = {
    conversationId: string; side: "selling" | "buying";
    name: string; part: string; preview: string; at: number; unread: number;
  };
  const items: Item[] = [];

  // ---- Selling side: buyers writing to my shop -----------------------------
  if (shopId) {
    const { data: convs } = await db.from("conversations").select("id, contact_name, part_name, unread").eq("shop_id", shopId);
    const byId = new Map((convs || []).map((c: any) => [c.id as string, c]));
    if (byId.size) {
      const { data: rows } = await db
        .from("messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", [...byId.keys()])
        .eq("sender", "them")
        .order("created_at", { ascending: false })
        .limit(60);
      const seen = new Set<string>();
      for (const r of (rows || []) as any[]) {
        if (seen.has(r.conversation_id)) continue;
        seen.add(r.conversation_id);
        const c: any = byId.get(r.conversation_id);
        items.push({
          conversationId: r.conversation_id, side: "selling",
          name: c?.contact_name || "A buyer", part: c?.part_name || "",
          preview: String(r.body || "").slice(0, 90),
          at: new Date(r.created_at || 0).getTime(), unread: c?.unread || 0,
        });
      }
    }
  }

  // ---- Buying side: sellers replying to me ---------------------------------
  // Graceful before migration 0040 (buyer_unread column): skip this half.
  const { data: mine, error: mineErr } = await db
    .from("conversations")
    .select("id, shop_id, part_name, buyer_unread")
    .eq("buyer_id", user.id);
  if (!mineErr && mine?.length) {
    const shopIds = [...new Set(mine.map((c: any) => c.shop_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (shopIds.length) {
      const { data: shops } = await db.from("shops").select("id, name").in("id", shopIds);
      for (const s of (shops || []) as any[]) names.set(s.id, s.name || "Shop");
    }
    const byId = new Map(mine.map((c: any) => [c.id as string, c]));
    const { data: rows } = await db
      .from("messages")
      .select("conversation_id, body, created_at")
      .in("conversation_id", [...byId.keys()])
      .eq("sender", "me") // seller replies, from the buyer's perspective
      .order("created_at", { ascending: false })
      .limit(60);
    const seen = new Set<string>();
    for (const r of (rows || []) as any[]) {
      if (seen.has(r.conversation_id)) continue;
      seen.add(r.conversation_id);
      const c: any = byId.get(r.conversation_id);
      items.push({
        conversationId: r.conversation_id, side: "buying",
        name: names.get(c?.shop_id) || "Seller", part: c?.part_name || "",
        preview: String(r.body || "").slice(0, 90),
        at: new Date(r.created_at || 0).getTime(), unread: c?.buyer_unread || 0,
      });
    }
  }

  items.sort((a, b) => b.at - a.at);
  return NextResponse.json({ items: items.slice(0, 10) });
}
