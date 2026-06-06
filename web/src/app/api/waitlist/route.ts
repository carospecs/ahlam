import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/waitlist
 * Body: { email, shopName?, location?, partsPerDay? }
 * Stores the signup and (optionally) sends a confirmation email via Resend.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email." },
      { status: 400 }
    );
  }

  const entry = {
    email,
    shop_name: body.shopName ? String(body.shopName).trim() : null,
    location: body.location ? String(body.location).trim() : null,
    parts_per_day:
      body.partsPerDay != null && !Number.isNaN(Number(body.partsPerDay))
        ? Number(body.partsPerDay)
        : null,
    source: "landing",
  };

  try {
    const db = supabaseAdmin();
    const { error } = await db.from("waitlist").upsert(entry, {
      onConflict: "email",
    });
    if (error) throw error;
  } catch (err) {
    // Don't 500 the user over a duplicate or transient DB hiccup if the email
    // is already captured — but do surface real failures.
    console.error("waitlist insert failed", err);
    return NextResponse.json(
      { error: "Something went wrong saving your spot. Try again shortly." },
      { status: 500 }
    );
  }

  // Optional confirmation email (no-op if RESEND_API_KEY isn't set yet).
  await sendConfirmation(email).catch((e) =>
    console.error("confirmation email failed", e)
  );

  return NextResponse.json({ ok: true });
}

async function sendConfirmation(email: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.WAITLIST_FROM_EMAIL;
  if (!key || !from) return; // not configured yet — skip silently
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  await resend.emails.send({
    from,
    to: email,
    subject: "You're on the Ahlam waitlist 🚗",
    text:
      "Thanks for joining the Ahlam waitlist!\n\n" +
      "We're building the fastest way to photograph an auto part, identify it, " +
      "grade its condition, and list it — without needing a parts expert on staff.\n\n" +
      "You'll be among the first invited to the free pilot. Reply to this email and " +
      "tell us how many parts you list a day — it helps us prioritize.\n\n" +
      "— The Ahlam team",
  });
}
