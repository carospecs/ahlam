import { NextResponse } from "next/server";
import { sendMail, FOUNDER_REVIEWERS } from "@/lib/mailer";

// SMTP runs on Node APIs (net/tls), not the Edge runtime.
export const runtime = "nodejs";

/**
 * POST /api/feedback
 * Body: { message, email?, name?, topic?, website? }
 * Emails the submission to both founders (FOUNDER_REVIEWERS) so feedback lands
 * in one place with reply-to set to the submitter. `website` is a honeypot:
 * bots fill it, humans never see it, so we accept-and-drop when it's present.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (String(body.website ?? "").trim()) return NextResponse.json({ ok: true });

  const message = String(body.message ?? "").trim().slice(0, 4000);
  const name = String(body.name ?? "").trim().slice(0, 120);
  const topic = String(body.topic ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().slice(0, 200);

  if (message.length < 5) {
    return NextResponse.json({ error: "Please write a few words of feedback." }, { status: 400 });
  }
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const text = [
    `Topic: ${topic || "General"}`,
    `From: ${name || "Anonymous"}${validEmail ? ` <${email}>` : ""}`,
    "",
    message,
  ].join("\n");

  const sent = await sendMail({
    to: FOUNDER_REVIEWERS,
    subject: `Ahlam feedback: ${topic || "General"}${name ? ` (${name})` : ""}`,
    text,
    replyTo: validEmail ? email : undefined,
  });

  if (!sent) {
    return NextResponse.json({ error: "Could not send right now. Please email us directly." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
