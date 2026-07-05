import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";

// Seller-side conversation actions. Both verify the caller is a member of the
// conversation's shop before touching anything (admin client bypasses RLS).
async function authConversation(conversationId: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  if (!conversationId) return { error: "conversationId required", status: 400 as const };

  const db = supabaseAdmin();
  const { data: conv } = await db.from("conversations").select("id, shop_id").eq("id", conversationId).single();
  if (!conv) return { error: "Conversation not found", status: 404 as const };

  const { data: member } = await db.from("shop_members").select("user_id").eq("shop_id", conv.shop_id).eq("user_id", user.id).single();
  if (!member) return { error: "Not your conversation", status: 403 as const };

  return { db, user, conv };
}

function nowLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// POST { conversationId, body } → persist a seller reply (sender 'me').
export async function POST(req: Request) {
  const { conversationId, body } = await req.json().catch(() => ({}));
  if (!body?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const ctx = await authConversation(conversationId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const time = nowLabel();
  const { error } = await ctx.db.from("messages").insert({ conversation_id: conversationId, sender: "me", body: body.trim(), time });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replying means the seller has seen the thread — clear unread and bump the
  // time. Also bump the BUYER's unread counter so their in-app notifier fires
  // (graceful before migration 0040: retry without buyer_unread).
  const { data: convRow } = await ctx.db.from("conversations").select("buyer_unread").eq("id", conversationId).maybeSingle();
  const { error: bumpErr } = await ctx.db.from("conversations")
    .update({ unread: 0, last_time: time, buyer_unread: ((convRow as { buyer_unread?: number } | null)?.buyer_unread ?? 0) + 1 })
    .eq("id", conversationId);
  if (bumpErr) {
    await ctx.db.from("conversations").update({ unread: 0, last_time: time }).eq("id", conversationId);
  }

  // Ping the customer by email that they have a new message (fire-and-forget so a
  // mail hiccup never fails the reply, and the seller isn't kept waiting on SMTP).
  void notifyBuyerByEmail(ctx.db, ctx.conv, body.trim());

  return NextResponse.json({ ok: true, time });
}

// Email the buyer on a conversation that they've received a new message. Best
// effort: silently no-ops if email isn't configured, the buyer has no address,
// or anything throws.
async function notifyBuyerByEmail(
  db: ReturnType<typeof supabaseAdmin>,
  conv: { id: string; shop_id: string; buyer_id?: string | null },
  preview: string,
) {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) return;

    // The conversation row from authConversation only selected id + shop_id, so
    // re-read the buyer_id here.
    const { data: full } = await db.from("conversations").select("buyer_id, shop_id").eq("id", conv.id).single();
    const buyerId = (full as { buyer_id?: string | null } | null)?.buyer_id;
    if (!buyerId) return; // anonymous/legacy conversation — nobody to email

    const { data: buyer } = await db.auth.admin.getUserById(buyerId);
    const to = buyer.user?.email;
    if (!to) return;

    const { data: shop } = await db.from("shops").select("name").eq("id", conv.shop_id).single();
    const shopName = (shop as { name?: string } | null)?.name || "a seller";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ahlam.io";

    await sendMail({
      to,
      subject: `New message from ${shopName} on Ahlam`,
      text:
        `You have a new message from ${shopName} on Ahlam:\n\n` +
        `"${preview.slice(0, 300)}"\n\n` +
        `Open Ahlam to read it and reply: ${appUrl}\n`,
    });
  } catch (e) {
    console.error("[messages] buyer email notification failed:", e);
  }
}

// PATCH { conversationId, status? } → mark read (unread = 0), and/or set the
// conversation lifecycle status (open | dealt | closed).
const VALID_STATUS = ["open", "dealt", "closed"] as const;

export async function PATCH(req: Request) {
  const { conversationId, status } = await req.json().catch(() => ({}));
  const ctx = await authConversation(conversationId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const patch: Record<string, unknown> = { unread: 0 };
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    patch.status = status;
  }

  const { error } = await ctx.db.from("conversations").update(patch).eq("id", conversationId);
  if (error) {
    // The status column may not exist yet (migration 0014 not applied). PostgREST
    // reports this as code PGRST204 ("Could not find the 'status' column …").
    // Detect it broadly and fall back to just marking read so the inbox works.
    const missingStatusCol = status !== undefined && (
      (error as any).code === "PGRST204" ||
      (/status/i.test(error.message) && /(column|schema cache|does not exist)/i.test(error.message))
    );
    if (missingStatusCol) {
      await ctx.db.from("conversations").update({ unread: 0 }).eq("id", conversationId);
      return NextResponse.json({ error: "Status needs migration 0014 applied to Supabase.", needsMigration: true }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
