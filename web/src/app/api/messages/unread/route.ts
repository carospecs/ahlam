import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// Lightweight poll target for the in-app message notifier. Returns the shop's
// total unread count plus the newest inbound (buyer) message, so the client can
// detect a brand new message and fire a toast + sound + browser notification
// without re-pulling the whole /api/data payload.
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = (profile as { shop_id?: string | null } | null)?.shop_id || null;
  if (!shopId) return NextResponse.json({ total: 0, latestId: null, latest: null });

  // Sum unread across the shop's conversations.
  const { data: convs } = await db.from("conversations").select("unread").eq("shop_id", shopId);
  const total = (convs || []).reduce((n: number, c: any) => n + (c.unread || 0), 0);

  // Newest inbound message (from a buyer, not the seller's own replies). Its id
  // is a stable signature the client compares against to detect a new message.
  const { data: latestRows } = await db
    .from("messages")
    .select("id, body, created_at, conversations!inner(shop_id, contact_name)")
    .eq("conversations.shop_id", shopId)
    .eq("sender", "them")
    .order("created_at", { ascending: false })
    .limit(1);

  const row: any = (latestRows || [])[0] || null;
  const latest = row
    ? {
        name: row.conversations?.contact_name || "A buyer",
        preview: String(row.body || "").slice(0, 120),
      }
    : null;

  return NextResponse.json({ total, latestId: row?.id || null, latest });
}
