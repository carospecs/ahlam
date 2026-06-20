import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sendMail, FOUNDER_REVIEWERS } from "@/lib/mailer";

export const runtime = "nodejs";

const REASONS = new Set([
  "unprofessional",
  "suspicious",
  "scam_or_fraud",
  "counterfeit_or_stolen",
  "harassment",
  "other",
]);

// A signed-in user reports a business for unprofessional behavior or suspicious
// activity. We email both founders so they can review and act. Auth-gated so
// reports always carry a real reporter and bots can't spam the inbox.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report a business." }, { status: 401 });

  let body: { shopId?: string; businessName?: string; reason?: string; details?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reason = REASONS.has(String(body.reason)) ? String(body.reason) : "other";
  const businessName = String(body.businessName || "").slice(0, 200).trim();
  const details = String(body.details || "").slice(0, 4000).trim();
  const shopId = body.shopId ? String(body.shopId).slice(0, 100) : null;
  if (!businessName && !shopId) {
    return NextResponse.json({ error: "Tell us which business you're reporting." }, { status: 400 });
  }
  if (!details) {
    return NextResponse.json({ error: "Add a short description of what happened." }, { status: 400 });
  }

  const reasonLabel: Record<string, string> = {
    unprofessional: "Unprofessional behavior",
    suspicious: "Suspicious activity",
    scam_or_fraud: "Scam / fraud",
    counterfeit_or_stolen: "Counterfeit or stolen parts",
    harassment: "Harassment",
    other: "Other",
  };

  const text =
    `A business was reported on Ahlam.\n\n` +
    `Business: ${businessName || "(name not given)"}\n` +
    `Shop ID: ${shopId || "(none)"}\n` +
    `Reason: ${reasonLabel[reason]}\n\n` +
    `Details:\n${details}\n\n` +
    `Reported by: ${user.email || user.id} (user id ${user.id})\n` +
    `When: ${new Date().toISOString()}\n\n` +
    `Both founders receive this report. Review and proceed with next steps.`;

  // Always log the report so it's never lost, even if email is down/unconfigured.
  console.log("[REPORT]", text);

  const delivered = await sendMail({
    to: FOUNDER_REVIEWERS,
    replyTo: user.email || undefined,
    subject: `🚩 Business report: ${businessName || shopId} (${reasonLabel[reason]})`,
    text,
  });
  return NextResponse.json({ ok: true, delivered });
}
