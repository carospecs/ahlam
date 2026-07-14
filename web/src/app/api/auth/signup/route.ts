import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mailer";
import { verifyCodeEmail } from "@/lib/auth-emails";

// Public signups are OPEN (launched Jul 2026). Accounts start unverified; we
// email a 6-digit code through our own SMTP (branded, not Supabase's default
// mailer) and the client confirms it with verifyOtp — which also signs the
// user in. Uses the service-role admin API, so the Supabase "disable signup"
// project setting can stay off. Flip to false to close signups again.
const SIGNUPS_OPEN = true;

export const runtime = "nodejs";

/** Email the 6-digit verification code for this address. */
async function sendVerifyCode(email: string): Promise<boolean> {
  const admin = supabaseAdmin();
  // A magiclink's email_otp doubles as a verification code: verifying it
  // confirms the address AND starts a session.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const code = data?.properties?.email_otp;
  if (error || !code) {
    console.error("signup: generateLink failed", error?.message);
    return false;
  }
  return sendMail({ to: email, ...verifyCodeEmail(code) });
}

export async function POST(req: NextRequest) {
  if (!SIGNUPS_OPEN) {
    return NextResponse.json({ error: "Signups are closed right now. Check back soon." }, { status: 403 });
  }

  let body: { email?: string; password?: string; displayName?: string; resend?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  // Rate limit per email+IP and a coarser per-IP cap (shared limiter; durable
  // when Upstash is configured).
  const ip = clientIp(req);
  const [perAccount, perIp] = await Promise.all([
    checkRateLimit(`signup:${email}:${ip}`, { windowMs: 15_000, max: 3 }),
    checkRateLimit(`signup:ip:${ip}`, { windowMs: 60_000, max: 15 }),
  ]);
  const limit = !perAccount.ok ? perAccount : perIp;
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a few seconds." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  // Resend: just email a fresh code to the (still unverified) account.
  if (body.resend) {
    const sent = await sendVerifyCode(email);
    return sent
      ? NextResponse.json({ ok: true, verify: true })
      : NextResponse.json({ error: "Couldn't send the code. Try again in a minute." }, { status: 502 });
  }

  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: displayName || email.split("@")[0] },
  });

  if (error) {
    const msg = error.message || "";
    // Already signed up but never verified → let them pick up where they left
    // off with a fresh code. Fully registered → point at sign-in.
    if (/already (been )?registered|already exists/i.test(msg)) {
      // Look the account up to check its confirmation state.
      let match: { email_confirmed_at?: string | null } | undefined;
      for (let page = 1; page <= 5 && !match; page++) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        match = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!list?.users?.length || list.users.length < 200) break;
      }
      if (match && !match.email_confirmed_at) {
        const sent = await sendVerifyCode(email);
        return sent
          ? NextResponse.json({ ok: true, verify: true })
          : NextResponse.json({ error: "Couldn't send the code. Try again in a minute." }, { status: 502 });
      }
      return NextResponse.json({ error: "That email is already registered. Sign in instead." }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const sent = await sendVerifyCode(email);
  if (!sent) {
    return NextResponse.json({ error: "Account created but the code email failed. Use Resend code in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, verify: true });
}
