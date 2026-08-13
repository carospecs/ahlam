import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";

async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, shopId: null, role: null, db: supabaseAdmin() };
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id || null;
  let role: string | null = null;
  if (shopId) {
    const { data: m } = await db.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", user.id).single();
    role = m?.role || null;
  }
  return { user, shopId, role, db };
}

export async function GET() {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ members: [], invites: [], role: null });

  const [{ data: members }, { data: invites }] = await Promise.all([
    db.from("shop_members").select("id, role, user_id, created_at, profiles(display_name, avatar_url)").eq("shop_id", shopId),
    db.from("shop_invites").select("*").eq("shop_id", shopId).eq("status", "pending").order("created_at", { ascending: false }),
  ]);

  // Pull emails for members from auth.
  const out = await Promise.all((members || []).map(async (m: any) => {
    const { data: au } = await db.auth.admin.getUserById(m.user_id);
    return {
      id: m.id, userId: m.user_id, role: m.role,
      name: m.profiles?.display_name || au?.user?.email?.split("@")[0] || "Member",
      email: au?.user?.email || "",
      initials: (m.profiles?.display_name || au?.user?.email || "U").split(/[\s@]/).map((s: string) => s[0]).join("").toUpperCase().slice(0, 2),
      isYou: m.user_id === user.id,
    };
  }));

  return NextResponse.json({ members: out, invites: invites || [], role });
}

// Invite a teammate by email.
export async function POST(req: NextRequest) {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "owner") return NextResponse.json({ error: "Only the owner can invite" }, { status: 403 });
  const { email, role: inviteRole } = await req.json().catch(() => ({}));
  if (!email?.includes("@")) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const r = ["owner", "editor", "viewer"].includes(inviteRole) ? inviteRole : "viewer";

  const { error } = await db.from("shop_invites").upsert(
    { shop_id: shopId, email: email.toLowerCase().trim(), role: r, invited_by: user.id, status: "pending" },
    { onConflict: "shop_id,email" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The invite row alone is invisible to the invitee — email them the join
  // link. Claiming is automatic: signing up with this address joins the shop
  // (see /api/onboarding step 1). Awaited so serverless doesn't drop it;
  // sendMail never throws, so a mail hiccup can't fail the invite itself.
  const { data: shop } = await db.from("shops").select("name").eq("id", shopId).maybeSingle();
  const shopName = (shop as { name?: string } | null)?.name || "an Ahlam shop";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";
  const emailSent = await sendMail({
    to: email.toLowerCase().trim(),
    replyTo: user.email || undefined,
    subject: `You're invited to join ${shopName} on Ahlam`,
    text: [
      `${user.email || "A teammate"} invited you to join ${shopName} on Ahlam as ${r === "owner" ? "an owner" : `a${r === "editor" ? "n editor" : " viewer"}`}.`,
      "",
      "Ahlam is the tool the shop uses to photograph parts, grade them with AI, and post listings everywhere they sell.",
      "",
      "To accept, create your account with this email address:",
      `${siteUrl}/?signup=1`,
      "",
      `Sign up as ${email.toLowerCase().trim()} and you'll join ${shopName} automatically — no code needed.`,
      "",
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
  });

  return NextResponse.json({ ok: true, emailSent });
}

// Change a member's role.
export async function PATCH(req: NextRequest) {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "owner") return NextResponse.json({ error: "Only the owner can change roles" }, { status: 403 });
  const { memberId, role: newRole } = await req.json().catch(() => ({}));
  if (!["owner", "editor", "viewer"].includes(newRole)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const { error } = await db.from("shop_members").update({ role: newRole }).eq("id", memberId).eq("shop_id", shopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Remove a member or revoke an invite.
export async function DELETE(req: NextRequest) {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "owner") return NextResponse.json({ error: "Only the owner can remove people" }, { status: 403 });
  const { memberId, inviteId } = await req.json().catch(() => ({}));
  if (inviteId) {
    await db.from("shop_invites").update({ status: "revoked" }).eq("id", inviteId).eq("shop_id", shopId);
    return NextResponse.json({ ok: true });
  }
  if (memberId) {
    // Don't allow removing the last owner.
    const { data: m } = await db.from("shop_members").select("user_id, role").eq("id", memberId).single();
    if (m?.role === "owner") {
      const { count } = await db.from("shop_members").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("role", "owner");
      if ((count || 0) <= 1) return NextResponse.json({ error: "Can't remove the last owner" }, { status: 400 });
    }
    await db.from("shop_members").delete().eq("id", memberId).eq("shop_id", shopId);
    await db.from("profiles").update({ shop_id: null }).eq("id", m?.user_id).eq("shop_id", shopId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to remove" }, { status: 400 });
}
