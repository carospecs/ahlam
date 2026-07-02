import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Public signups are CLOSED pre-launch — the only public action is joining the
// waitlist. (This route uses the service-role admin API, which bypasses the
// Supabase "disable signup" auth setting, so it must be gated here too.)
// Admins/test accounts are created directly in Supabase, not through this route.
const SIGNUPS_OPEN = false;

export async function POST(req: NextRequest) {
  if (!SIGNUPS_OPEN) {
    return NextResponse.json(
      { error: "Signups are closed. Join the waitlist at /waitlist." },
      { status: 403 }
    );
  }

  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();

  if (!email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: "Password must be between 6 and 128 characters" }, { status: 400 });
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
      { error: "Too many signup attempts. Wait a few seconds." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: displayName || email.split("@")[0] },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: data.user });
}
