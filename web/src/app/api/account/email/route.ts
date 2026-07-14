import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mailer";
import { emailChangeEmail } from "@/lib/auth-emails";
import { makeEmailToken } from "@/lib/email-change-token";

export const runtime = "nodejs";

/**
 * POST /api/account/email  Body: { newEmail }
 * Signed-in users only. Sends the confirmation link to the NEW address; the
 * account changes when that link is clicked (see /api/account/email/confirm).
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newEmail = String(body.newEmail ?? "").trim().toLowerCase();
  if (!newEmail.includes("@") || newEmail.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (newEmail === (user.email ?? "").toLowerCase()) {
    return NextResponse.json({ error: "That's already your email" }, { status: 400 });
  }

  const ip = clientIp(req);
  const rl = await checkRateLimit(`emailchange:${user.id}:${ip}`, { windowMs: 60_000, max: 3 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://ahlam.io";
  const confirmUrl = `${base}/api/account/email/confirm?t=${makeEmailToken(user.id, newEmail)}`;
  const sent = await sendMail({ to: newEmail, ...emailChangeEmail(confirmUrl) });
  if (!sent) return NextResponse.json({ error: "Couldn't send the confirmation email. Try again in a minute." }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: newEmail });
}
