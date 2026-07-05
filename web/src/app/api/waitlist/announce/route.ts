import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { EXTENSION_URL } from "@/lib/extension";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import nodemailer from "nodemailer";

// SMTP runs on Node APIs (net/tls), not the Edge runtime. Sequential sends to a
// whole waitlist can take a while, so give the function real headroom.
export const runtime = "nodejs";
export const maxDuration = 300;
// Stop sending before the platform kills the function so the response (with
// the remaining count) always reaches the admin; the endpoint is idempotent,
// rerunning picks up where it left off.
const SEND_BUDGET_MS = 240_000;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ahlam.io";

const SUBJECT = "Ahlam is live. Your first month is free";

function launchBody(): string {
  const founderScans = PLAN_LIMITS.founder.scanPerMonth ?? 5;
  return (
    "Hi,\n\n" +
    `Ahlam is live today at ${APP_URL}.\n\n` +
    "You joined our waitlist, so your first month is on us. Create your " +
    "account with this email address and the free month applies " +
    "automatically:\n\n" +
    `${APP_URL}/?signup=1\n\n` +
    "Your founding month is a full month of our Growth plan, free: " +
    `${founderScans} AI car scans, auto-posting to eBay, Facebook ` +
    "cross-posting, and unlimited manual listings (normally $100).\n\n" +
    "One more thing: install the Ahlam Auto-Poster Chrome extension. It " +
    "opens Facebook Marketplace with your listing already filled in, so " +
    "you just review and hit publish:\n\n" +
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
 *       { mode: "mark" }  → marks everyone as notified WITHOUT sending — for
 *                           when the announcement went out by hand, so the
 *                           send button can't double-email the list.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "all" ? "all" : body.mode === "mark" ? "mark" : "test";

  if (mode === "mark") {
    try {
      const { data, error } = await supabaseAdmin()
        .from("waitlist")
        .update({ notified_at: new Date().toISOString() })
        .is("notified_at", null)
        .select("email");
      if (error) throw error;
      return NextResponse.json({ ok: true, mode, marked: data?.length ?? 0 });
    } catch (e) {
      console.error("announce mark failed", e);
      return NextResponse.json({ error: "Couldn't mark the list. Is migration 0038 applied?" }, { status: 500 });
    }
  }

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
  // Pooled: reuse one TLS+AUTH connection across the whole run instead of a
  // fresh Gmail handshake per recipient.
  const transport = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
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
      return NextResponse.json({ error: "Test send failed. Check the email credentials." }, { status: 502 });
    }
  }

  try {
    const db = supabaseAdmin();
    const { rows, notifySupported } = await loadRows(db);
    const pending = rows.filter((r) => !r.notified_at);
    const deadline = Date.now() + SEND_BUDGET_MS;

    let sent = 0;
    let remaining = 0;
    const failed: string[] = [];
    for (let i = 0; i < pending.length; i++) {
      if (Date.now() > deadline) { remaining = pending.length - i; break; }
      const r = pending[i];
      try {
        await transport.sendMail({ from, to: r.email, replyTo, subject: SUBJECT, text });
        sent++;
        if (notifySupported) {
          await db.from("waitlist").update({ notified_at: new Date().toISOString() }).eq("email", r.email);
        }
        // Gentle pacing for Gmail, only between successful sends.
        if (i < pending.length - 1) await new Promise((res) => setTimeout(res, 200));
      } catch (e) {
        console.error("announce send failed for", r.email, e);
        failed.push(r.email);
      }
    }
    transport.close();

    return NextResponse.json({
      ok: true,
      mode,
      sent,
      failed,
      remaining,
      skipped: rows.length - pending.length,
      notifySupported,
      ...(remaining ? { warning: `Stopped at the time budget with ${remaining} to go. Run it again to send the rest.` } : {}),
      ...(notifySupported ? {} : { warning: "waitlist.notified_at is not migrated (0038). Rerunning would email everyone again." }),
    });
  } catch (e) {
    console.error("announce send failed", e);
    return NextResponse.json({ error: "Send failed partway. Safe to rerun; already-notified members are skipped." }, { status: 500 });
  }
}
