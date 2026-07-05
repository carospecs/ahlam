import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import nodemailer from "nodemailer";

// SMTP runs on Node APIs (net/tls), not the Edge runtime. Sequential sends to a
// whole waitlist can take a while, so give the function real headroom.
export const runtime = "nodejs";
export const maxDuration = 300;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ahlam.io";
const EXTENSION_URL =
  "https://chromewebstore.google.com/detail/ahlam-auto-poster/fpiebljechdcjfjhfbmbnkjjmoinobkj";

const SUBJECT = "Ahlam is live. Your first month is free";

function launchBody(): string {
  return (
    "Hi,\n\n" +
    `Ahlam is live today at ${APP_URL}.\n\n` +
    "You joined our waitlist, so your first month is on us. Create your " +
    "account with this email address and the free month applies " +
    "automatically:\n\n" +
    `${APP_URL}/?signup=1\n\n` +
    "Your founding month includes every feature of our top plan: unlimited " +
    "manual listings, cross-posting to every channel we support, team " +
    "access, and 5 AI car scans for the month (the Growth plan's AI " +
    "allowance, normally $100).\n\n" +
    "One more thing: install the Ahlam Auto-Poster Chrome extension. It " +
    "opens Facebook Marketplace and OfferUp with your listing already " +
    "filled in, so you just review and hit publish:\n\n" +
    `${EXTENSION_URL}\n\n` +
    "Questions? Just reply to this email.\n\n" +
    "Best,\n" +
    "Mohammad and Andy\n" +
    "mohammadabbas@ahlam.io & andygarcia@ahlam.io"
  );
}

type WaitRow = { email: string; notified_at?: string | null };

// Reads the waitlist, tolerating a not-yet-migrated notified_at column
// (migration 0038). Without it we can still send, just without dedupe.
async function loadRows(db: ReturnType<typeof supabaseAdmin>): Promise<{ rows: WaitRow[]; notifySupported: boolean }> {
  const withCol = await db.from("waitlist").select("email, notified_at").order("created_at", { ascending: true });
  if (!withCol.error) return { rows: (withCol.data ?? []) as WaitRow[], notifySupported: true };
  const plain = await db.from("waitlist").select("email").order("created_at", { ascending: true });
  if (plain.error) throw plain.error;
  return { rows: (plain.data ?? []) as WaitRow[], notifySupported: false };
}

/**
 * GET /api/waitlist/announce → admin-only preview: how many waitlist members
 * are pending the launch email, plus the exact subject/body that will go out.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  try {
    const { rows, notifySupported } = await loadRows(supabaseAdmin());
    const pending = rows.filter((r) => !r.notified_at);
    return NextResponse.json({
      ok: true,
      total: rows.length,
      pending: pending.length,
      alreadySent: rows.length - pending.length,
      notifySupported,
      subject: SUBJECT,
      body: launchBody(),
    });
  } catch (e) {
    console.error("announce preview failed", e);
    return NextResponse.json({ error: "Failed to load the waitlist" }, { status: 500 });
  }
}

/**
 * POST /api/waitlist/announce → admin-only send.
 * Body: { mode: "test" }  → sends one copy to the signed-in admin only.
 *       { mode: "all" }   → sends to every waitlist member not yet notified,
 *                           marking waitlist.notified_at as it goes so a rerun
 *                           only picks up the ones that failed or are new.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "all" ? "all" : "test";

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return NextResponse.json(
      { error: "Email isn't configured (GMAIL_USER / GMAIL_APP_PASSWORD). Nothing was sent." },
      { status: 503 },
    );
  }
  const from = process.env.WAITLIST_FROM_EMAIL || "Ahlam <mohammadabbas@ahlam.io>";
  const replyTo = process.env.WAITLIST_REPLY_TO || "mohammadabbas@ahlam.io";
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  const text = launchBody();

  if (mode === "test") {
    try {
      await transport.sendMail({ from, to: admin, replyTo, subject: `[TEST] ${SUBJECT}`, text });
      return NextResponse.json({ ok: true, mode, sent: 1, to: admin });
    } catch (e) {
      console.error("announce test send failed", e);
      return NextResponse.json({ error: "Test send failed — check the email credentials." }, { status: 502 });
    }
  }

  try {
    const db = supabaseAdmin();
    const { rows, notifySupported } = await loadRows(db);
    const pending = rows.filter((r) => !r.notified_at);

    let sent = 0;
    const failed: string[] = [];
    for (const r of pending) {
      try {
        await transport.sendMail({ from, to: r.email, replyTo, subject: SUBJECT, text });
        sent++;
        if (notifySupported) {
          await db.from("waitlist").update({ notified_at: new Date().toISOString() }).eq("email", r.email);
        }
      } catch (e) {
        console.error("announce send failed for", r.email, e);
        failed.push(r.email);
      }
      // Gentle pacing for Gmail SMTP.
      await new Promise((res) => setTimeout(res, 300));
    }

    return NextResponse.json({
      ok: true,
      mode,
      sent,
      failed,
      skipped: rows.length - pending.length,
      notifySupported,
      ...(notifySupported ? {} : { warning: "waitlist.notified_at is not migrated (0038) — reruns would email everyone again." }),
    });
  } catch (e) {
    console.error("announce send failed", e);
    return NextResponse.json({ error: "Send failed partway — safe to rerun; already-notified members are skipped." }, { status: 500 });
  }
}
