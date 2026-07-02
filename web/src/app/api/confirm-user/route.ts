import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

// Admin-only: force a user's email to confirmed via the service role. This is a
// founder/test tool, NOT a self-serve endpoint — a signed-in user must NOT be
// able to confirm their own (or anyone's) email and bypass verification.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Page through users to find the target (listUsers is paginated).
  let user: { id: string; email?: string } | undefined;
  for (let page = 1; page <= 50 && !user; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (data.users.length < 200) break; // last page
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error: updateErr } = await db.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
