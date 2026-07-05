// Shared Gmail SMTP sender. Uses the same Workspace credentials as the waitlist
// and AI-alert emails (GMAIL_USER + GMAIL_APP_PASSWORD). No-ops and returns false
// when email isn't configured, so callers can fire-and-forget without guarding
// env themselves. Never throws.
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  from?: string; // must be the authenticated account or a configured Gmail "Send As" alias
  cc?: string;
}): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error("[mailer] email not configured; skipped:", opts.subject);
    return false;
  }
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: opts.from ?? process.env.WAITLIST_FROM_EMAIL ?? user,
      to: opts.to,
      cc: opts.cc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
    });
    return true;
  } catch (e) {
    console.error("[mailer] send failed:", e, opts.subject);
    return false;
  }
}

// Both founders review business reports and account escalations.
export const FOUNDER_REVIEWERS =
  process.env.REPORT_EMAIL || "andygarcia@ahlam.io,mohammadabbas@ahlam.io";
