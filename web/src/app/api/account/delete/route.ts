import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type Db = ReturnType<typeof supabaseAdmin>;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

// A sole shop member owns the shop in the v1 data model. Removing that account
// must also remove the shop's private inventory, posts, and memberships rather
// than leave an inaccessible orphan behind.
async function deleteShopDeep(db: Db, shopId: string): Promise<string | null> {
  try {
    const { data: conversations } = await db
      .from("conversations")
      .select("id")
      .eq("shop_id", shopId);
    const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
    if (conversationIds.length) {
      await db.from("messages").delete().in("conversation_id", conversationIds);
    }
  } catch {
    // Some installations do not have the messaging tables. The shop deletion
    // below remains the authoritative operation.
  }

  for (const table of [
    "conversations",
    "activity_log",
    "usage_events",
    "listings",
    "vehicles",
    "shop_integrations",
    "shop_invites",
    "orders",
    "reviews",
    "verification_requests",
    "shop_members",
  ]) {
    try {
      await db.from(table).delete().eq("shop_id", shopId);
    } catch {
      // The schema has evolved over time; missing optional tables are safe.
    }
  }

  const { error } = await db.from("shops").delete().eq("id", shopId);
  return error ? error.message : null;
}

async function authenticatedUser(req: Request) {
  const sessionClient = await (await import("@/lib/supabase-server")).supabaseServer();
  const { data: sessionData } = await sessionClient.auth.getUser();
  if (sessionData.user) return sessionData.user;

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;

  const { data, error } = await supabaseAdmin().auth.getUser(authorization.slice(7));
  return error ? null : data.user;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * POST /api/account/delete
 *
 * Closes the currently authenticated account. It is deliberately separate from
 * the admin endpoint: the caller's identity comes only from a current cookie
 * session or mobile Bearer token, and the literal confirmation prevents an
 * accidental destructive tap.
 */
export async function POST(req: Request) {
  const user = await authenticatedUser(req);
  if (!user) return response({ ok: false, error: "Sign in to delete your account." }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    return response({ ok: false, error: 'Send confirm: "DELETE" to close this account.' }, 400);
  }

  const db = supabaseAdmin();
  const { data: memberships, error: membershipError } = await db
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", user.id);
  if (membershipError) return response({ ok: false, error: membershipError.message }, 500);

  let shopsDeleted = 0;
  for (const membership of memberships ?? []) {
    const shopId = membership.shop_id as string;
    const { data: members, error: membersError } = await db
      .from("shop_members")
      .select("user_id")
      .eq("shop_id", shopId);
    if (membersError) return response({ ok: false, error: membersError.message }, 500);

    const hasTeammate = (members ?? []).some((member) => member.user_id !== user.id);
    if (hasTeammate) {
      const { error } = await db
        .from("shop_members")
        .delete()
        .eq("shop_id", shopId)
        .eq("user_id", user.id);
      if (error) return response({ ok: false, error: error.message }, 500);
      continue;
    }

    const error = await deleteShopDeep(db, shopId);
    if (error) return response({ ok: false, error: `Couldn't delete shop data: ${error}` }, 500);
    shopsDeleted += 1;
  }

  // The profile's FK cascades from auth.users. Delete it first when possible
  // so its data is gone even on older database snapshots with no cascade.
  const { error: profileError } = await db.from("profiles").delete().eq("id", user.id);
  if (profileError) return response({ ok: false, error: profileError.message }, 500);

  const { error: accountError } = await db.auth.admin.deleteUser(user.id);
  if (accountError) return response({ ok: false, error: accountError.message }, 500);

  console.log(`[account] ${user.id} deleted their account${shopsDeleted ? ` and ${shopsDeleted} shop(s)` : ""}`);
  return response({ ok: true, shopsDeleted });
}
