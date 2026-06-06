import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// A buyer contacts a seller — either about a specific part listing or about a
// whole-car vehicle (shop-level). Delegates to SECURITY DEFINER RPCs so web and
// mobile share one code path.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to contact sellers" }, { status: 401 });

  const { listingId, shopId, subject, message } = await req.json().catch(() => ({}));
  if (!message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  // Demo rows (ids prefixed with "m" / "demo") have no real seller — accept softly.
  if ((listingId && listingId.startsWith("m")) || (shopId && String(shopId).startsWith("demo"))) {
    return NextResponse.json({ ok: true, demo: true });
  }

  if (listingId) {
    const { error } = await supabase.rpc("contact_seller", { p_listing_id: listingId, p_message: message.trim() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (shopId) {
    const { error } = await supabase.rpc("contact_shop", { p_shop_id: shopId, p_subject: subject || "a vehicle", p_message: message.trim() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to contact" }, { status: 400 });
}
