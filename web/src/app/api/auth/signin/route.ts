import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email.includes("@") || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Throttle password guessing two ways: per account (vertical brute force) and
  // a coarser per-IP cap (horizontal spraying across many accounts from one IP).
  const ip = clientIp(req);
  const [perAccount, perIp] = await Promise.all([
    checkRateLimit(`signin:${email}:${ip}`, { windowMs: 60_000, max: 5 }),
    checkRateLimit(`signin:ip:${ip}`, { windowMs: 60_000, max: 20 }),
  ]);
  const limit = !perAccount.ok ? perAccount : perIp;
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ user: data.user });
}
