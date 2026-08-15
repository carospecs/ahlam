import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mailer";
import { resetCodeEmail } from "@/lib/auth-emails";

export const runtime = "nodejs";

/**
 * POST /api/auth/reset  Body: { email }
 * Emails the recovery code through our own SMTP (branded, instead of
 * Supabase's default mailer). The client confirms it with
 * verifyOtp({ type: "recovery" }) and then sets the new password.
 * Always answers ok so the endpoint can't be used to probe which emails exist.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const ip = clientIp(req);
  const [perAccount, perIp] = await Promise.all([
    checkRateLimit(`pwreset:${email}:${ip}`, { windowMs: 60_000, max: 3 }),
    checkRateLimit(`pwreset:ip:${ip}`, { windowMs: 60_000, max: 10 }),
  ]);
  const limit = !perAccount.ok ? perAccount : perIp;
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    const code = data?.properties?.email_otp;
    if (!error && code) {
      const sent = await sendMail({ to: email, ...resetCodeEmail(code) });
      if (sent) return NextResponse.json({ ok: true, delivery: "code" });
    }
    // Local/dev environments may not have Gmail SMTP credentials. Fall back to
    // Supabase's configured recovery mailer so the user still receives a reset
    // email instead of a successful-looking response with no message sent.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && anonKey) {
      await fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: "POST",
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return NextResponse.json({ ok: true, delivery: "link" });
    }
    // Unknown email → generateLink errors; still answer ok (no probing).
  } catch (e) {
    console.error("password reset failed", e);
  }
  return NextResponse.json({ ok: true, delivery: "unknown" });
}
