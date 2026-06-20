import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";

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
    void notifySellerByEmail({ listingId, buyerEmail: user.email, message: message.trim() });
    return NextResponse.json({ ok: true });
  }

  if (shopId) {
    const { error } = await supabase.rpc("contact_shop", { p_shop_id: shopId, p_subject: subject || "a vehicle", p_message: message.trim() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void notifySellerByEmail({ shopId, buyerEmail: user.email, subject, message: message.trim() });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to contact" }, { status: 400 });
}

// Email the seller that a buyer just messaged them (fire-and-forget). Recipient is
// the shop's business email, falling back to the owner's account email. Respects
// the shop's buyer_messages notification preference. Best effort: never throws.
async function notifySellerByEmail(opts: {
  listingId?: string;
  shopId?: string;
  buyerEmail?: string | null;
  subject?: string;
  message: string;
}) {
  try {
    const db = supabaseAdmin();

    let shopId = opts.shopId || null;
    if (!shopId && opts.listingId) {
      const { data: l } = await db.from("listings").select("shop_id").eq("id", opts.listingId).single();
      shopId = (l as { shop_id?: string } | null)?.shop_id || null;
    }
    if (!shopId) return;

    const { data: shop } = await db.from("shops").select("name, email, notify").eq("id", shopId).single();
    if (!shop) return;

    // Respect the seller's preference: skip if they turned buyer-message alerts off.
    const notify = (shop as { notify?: { buyer_messages?: boolean } | null }).notify;
    if (notify && notify.buyer_messages === false) return;

    // Prefer the business email; otherwise the shop owner's account email.
    let to = (shop as { email?: string | null }).email || null;
    if (!to) {
      const { data: member } = await db.from("shop_members").select("user_id").eq("shop_id", shopId).eq("role", "owner").single();
      const ownerId = (member as { user_id?: string } | null)?.user_id;
      if (ownerId) {
        const { data: owner } = await db.auth.admin.getUserById(ownerId);
        to = owner.user?.email || null;
      }
    }
    if (!to) return;

    const shopName = (shop as { name?: string }).name || "your shop";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ahlam.io";
    await sendMail({
      to,
      replyTo: opts.buyerEmail || undefined,
      subject: `New buyer message for ${shopName} on Ahlam`,
      text:
        `A buyer just messaged ${shopName} on Ahlam${opts.subject ? ` about ${opts.subject}` : ""}:\n\n` +
        `"${opts.message.slice(0, 300)}"\n\n` +
        `Open Ahlam to read it and reply: ${appUrl}\n`,
    });
  } catch (e) {
    console.error("[contact] seller email notification failed:", e);
  }
}
