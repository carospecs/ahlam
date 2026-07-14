import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

type Db = ReturnType<typeof supabaseAdmin>;

// Deep-delete a shop and everything hanging off it. Best-effort per table
// (empty/missing tables are fine); the final shops delete reports real errors.
async function deleteShopDeep(db: Db, shopId: string): Promise<string | null> {
  try {
    const { data: convs } = await db.from("conversations").select("id").eq("shop_id", shopId);
    const convIds = (convs ?? []).map((c) => c.id);
    if (convIds.length) await db.from("messages").delete().in("conversation_id", convIds);
  } catch { /* table shape differs or empty — continue */ }
  for (const table of [
    "conversations", "activity_log", "usage_events", "listings", "vehicles",
    "shop_integrations", "shop_invites", "orders", "reviews",
    "verification_requests", "shop_members",
  ]) {
    try { await db.from(table).delete().eq("shop_id", shopId); } catch { /* best-effort */ }
  }
  const { error } = await db.from("shops").delete().eq("id", shopId);
  return error ? error.message : null;
}

/**
 * POST /api/admin/user → founder console: delete a user account.
 * Body: { userId }. If they were the only member of their shop, the shop and
 * all its data go too; a teammate's departure leaves the shop alone.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: target, error: lookupErr } = await db.auth.admin.getUserById(userId);
  if (lookupErr || !target?.user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const email = (target.user.email ?? "").toLowerCase();
  if (email === admin.toLowerCase()) {
    return NextResponse.json({ error: "You can't delete your own account from here." }, { status: 400 });
  }

  // Their shop: delete it only if this user is the last member.
  let shopDeleted = false;
  const { data: prof } = await db.from("profiles").select("shop_id").eq("id", userId).maybeSingle();
  const shopId = (prof?.shop_id as string) || null;
  if (shopId) {
    const { data: members } = await db.from("shop_members").select("user_id").eq("shop_id", shopId);
    const others = (members ?? []).filter((m) => m.user_id !== userId);
    if (others.length === 0) {
      const err = await deleteShopDeep(db, shopId);
      if (err) return NextResponse.json({ error: `Couldn't delete their shop: ${err}` }, { status: 500 });
      shopDeleted = true;
    } else {
      await db.from("shop_members").delete().eq("shop_id", shopId).eq("user_id", userId);
    }
  }

  try { await db.from("profiles").delete().eq("id", userId); } catch { /* cascades with the user */ }
  const { error: delErr } = await db.auth.admin.deleteUser(userId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  console.log(`[admin] ${admin} deleted user ${email}${shopDeleted ? " and their shop" : ""}`);
  return NextResponse.json({ ok: true, email, shopDeleted });
}
