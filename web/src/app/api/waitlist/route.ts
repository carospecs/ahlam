import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";
import nodemailer from "nodemailer";

// SMTP runs on Node APIs (net/tls), not the Edge runtime.
export const runtime = "nodejs";

// Founder / admin allowlist for reading the waitlist. Override with the
// ADMIN_EMAILS env var (comma-separated) in production.
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

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/waitlist  → admin-only list of signups (founders' allowlist).
 * ?format=csv downloads a spreadsheet. Reads via the service role since the
 * table is RLS-locked against the anon key.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("waitlist")
    .select("email, shop_name, location, parts_per_day, source, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("waitlist read failed", error);
    return NextResponse.json({ error: "Failed to load waitlist" }, { status: 500 });
  }
  const rows = data ?? [];

  if (new URL(req.url).searchParams.get("format") === "csv") {
    const cols = ["email", "shop_name", "location", "parts_per_day", "source", "created_at"];
    const csv = [cols.join(",")]
      .concat(rows.map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(",")))
      .join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ahlam-waitlist.csv"',
      },
    });
  }
  return NextResponse.json({ ok: true, count: rows.length, rows });
}

/**
 * POST /api/waitlist
 * Body: { email, shopName?, location?, partsPerDay? }
 * Stores the signup and sends a welcome email via Google Workspace SMTP.
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
    source: body.source ? String(body.source).trim() : "landing",
  };

  try {
    const db = supabaseAdmin();
    const { error } = await db.from("waitlist").upsert(entry, {
      onConflict: "email",
    });
    if (error) throw error;
  } catch (err) {
    console.error("waitlist insert failed", err);
    return NextResponse.json(
      { error: "Something went wrong saving your spot. Try again shortly." },
      { status: 500 }
    );
  }

  // Welcome email. Logs loudly if it can't send so failures aren't silent.
  await sendConfirmation(email).catch((e) =>
    console.error("waitlist confirmation email FAILED to send:", e)
  );

  return NextResponse.json({ ok: true });
}

async function sendConfirmation(email: string) {
  // Sends through Google Workspace (Gmail) SMTP using an App Password.
  // GMAIL_USER authenticates; the visible From is mohammadabbas@ahlam.io.
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const from =
    process.env.WAITLIST_FROM_EMAIL || "Ahlam <mohammadabbas@ahlam.io>";

  if (!user || !pass) {
    // Loud, actionable log — this is the most common reason emails go missing.
    console.error(
      "waitlist confirmation SKIPPED: GMAIL_USER and/or GMAIL_APP_PASSWORD " +
        "are not set in the environment. No email was sent."
    );
    return;
  }

  // CC the team so every signup is visible in an inbox, not just the database.
  const cc = process.env.WAITLIST_CC_EMAIL
    ? process.env.WAITLIST_CC_EMAIL.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const replyTo = process.env.WAITLIST_REPLY_TO || "mohammadabbas@ahlam.io";

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  // Throws on SMTP failure — caller logs it.
  await transport.sendMail({
    from,
    to: email,
    ...(cc ? { cc } : {}),
    replyTo,
    subject: "You're on the Ahlam waitlist",
    text:
      "Thanks for joining. You're on the list, and we'll email you the " +
      "moment your pilot invite is ready.\n\n" +
      "Best,\n" +
      "Mohammad and Andy\n" +
      "mohammadabbas@ahlam.io & andygarcia@ahlam.io",
  });
}
