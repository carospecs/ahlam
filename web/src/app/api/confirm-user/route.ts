import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

// Founder / admin allowlist. Override with ADMIN_EMAILS (comma-separated) in
// production. Mirrors /api/waitlist so admin gating stays consistent.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin@gmail.com,mohammadabbas@ahlam.io,andygarcia@ahlam.io")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

async function requireAdmin(): Promise<string | null> {
  // Returns the admin email if the caller is a signed-in allowlisted user, else null.
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const email = user?.email?.toLowerCase();
    return email && ADMIN_EMAILS.includes(email) ? email : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
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

  // Admin-only. A user must NOT be able to confirm their own email — that would
  // defeat email verification entirely. Marking an account email-confirmed is a
  // privileged operation reserved for founders/admins (or Supabase directly).
  const admin_email = await requireAdmin();
  if (!admin_email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = supabaseAdmin();

  const { data: users, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const user = users.users.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
