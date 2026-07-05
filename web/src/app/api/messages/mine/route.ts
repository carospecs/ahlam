import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// Buyer-side inbox. The seller inbox (api/data) keys conversations on shop_id;
// this keys on buyer_id so a buyer can see the messages they sent AND read the
// seller's replies. The "me/them" perspective is FLIPPED here: a buyer's own
// message is stored sender='them' (from the seller's point of view), and the
// seller's reply is sender='me' — so for the buyer we render 'them' as "me".
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: convs, error } = await db
    .from("conversations")
    .select("*, messages(*)")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Resolve the seller shop names/phones in one round-trip.
  const shopIds = [...new Set((convs || []).map((c: any) => c.shop_id).filter(Boolean))];
  const shopInfo = new Map<string, { name: string; phone: string | null }>();
  if (shopIds.length) {
    const { data: shops } = await db.from("shops").select("id, name, business_phone").in("id", shopIds);
    for (const s of shops || []) shopInfo.set(s.id, { name: s.name || "Shop", phone: s.business_phone || null });
  }

  const threads = (convs || []).map((c: any) => {
    const msgs = (c.messages || [])
      .slice()
      .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .map((m: any) => ({ from: m.sender === "them" ? "me" : "seller", text: m.body, time: m.time || "" }));
    const sh = shopInfo.get(c.shop_id);
    return {
      id: c.id,
      shopId: c.shop_id,
      shopName: sh?.name || c.contact_name || "Shop",
      phone: sh?.phone || null,
      part: c.part_name || "Listing",
      market: c.market || "Ahlam",
      time: c.last_time || "",
      unread: c.buyer_unread || 0,
      messages: msgs,
      lastText: msgs.length ? msgs[msgs.length - 1].text : "",
    };
  });

  // Opening the buying inbox reads the replies — clear the buyer's counters so
  // the red dot goes away (graceful before migration 0040).
  try {
    await db.from("conversations").update({ buyer_unread: 0 }).eq("buyer_id", user.id).gt("buyer_unread", 0);
  } catch { /* column not migrated yet */ }

  return NextResponse.json({ threads });
}

// A buyer sends a follow-up on an existing conversation they own. Stored as
// sender='them' so it shows up in the seller's inbox as an incoming message.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { conversationId, body } = await req.json().catch(() => ({}));
  if (!conversationId || !body?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: conv } = await db.from("conversations").select("id, buyer_id, shop_id, unread, part_name").eq("id", conversationId).single();
  if (!conv || (conv as { buyer_id?: string }).buyer_id !== user.id) {
    return NextResponse.json({ error: "Not your conversation" }, { status: 403 });
  }

  const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const { error: mErr } = await db.from("messages").insert({ conversation_id: conversationId, sender: "them", body: body.trim(), time: t });
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  // Bump the seller's unread + recency so the follow-up surfaces in their inbox.
  await db.from("conversations").update({ unread: (((conv as { unread?: number }).unread) || 0) + 1, last_time: t }).eq("id", conversationId);

  return NextResponse.json({ ok: true });
}
