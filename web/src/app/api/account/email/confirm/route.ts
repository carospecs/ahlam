import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { readEmailToken } from "@/lib/email-change-token";

export const runtime = "nodejs";

/**
 * GET /api/account/email/confirm?t=<signed token>
 * The link mailed to the NEW address. A valid, unexpired token moves the
 * account to that email (pre-confirmed). The user then signs in again — their
 * session belongs to the old email's cookies, so a fresh sign-in keeps things
 * clean.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("t") || "";
  const parsed = readEmailToken(token);
  if (!parsed) return NextResponse.redirect(`${origin}/?email-updated=invalid`);

  const db = supabaseAdmin();
  const { error } = await db.auth.admin.updateUserById(parsed.userId, {
    email: parsed.newEmail,
    email_confirm: true,
  });
  if (error) {
    console.error("email change failed:", error.message);
    const reason = /already|exists|registered/i.test(error.message || "") ? "taken" : "failed";
    return NextResponse.redirect(`${origin}/?email-updated=${reason}`);
  }
  return NextResponse.redirect(`${origin}/?email-updated=1&signin=1`);
}
