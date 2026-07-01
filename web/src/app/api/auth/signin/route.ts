import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const signinCooldowns = new Map<string, number>();

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

  // Basic in-memory rate limit (per email, per IP) to slow credential stuffing
  // and brute force. Mirrors the signup route's cooldown.
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const key = `${email}:${ip}`;
  const last = signinCooldowns.get(key);
  if (last && Date.now() - last < 5000) {
    return NextResponse.json({ error: "Too many sign-in attempts. Wait a few seconds." }, { status: 429 });
  }
  signinCooldowns.set(key, Date.now());

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ user: data.user });
}
