// Verify that a webhook request genuinely came from Twilio.
// https://www.twilio.com/docs/usage/security#validating-requests
//
// OFF by default so local curl testing works. Turn it on in production by
// setting TWILIO_AUTH_TOKEN and TWILIO_VALIDATE_SIGNATURE=1. Because the signed
// URL must exactly match what Twilio requested (public https URL, not
// localhost), also set PUBLIC_BASE_URL to your deployed origin.

import crypto from "crypto";
import type { NextRequest } from "next/server";

export function twilioValidationEnabled(): boolean {
  return process.env.TWILIO_VALIDATE_SIGNATURE === "1" && !!process.env.TWILIO_AUTH_TOKEN;
}

// Returns true when the request is valid OR validation is disabled.
export function verifyTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  if (!twilioValidationEnabled()) return true;

  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const signature = req.headers.get("x-twilio-signature") || "";

  // Rebuild the exact URL Twilio signed. Prefer PUBLIC_BASE_URL for the origin
  // so a proxy/tunnel doesn't change scheme/host out from under us.
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const url = base ? `${base}${req.nextUrl.pathname}${req.nextUrl.search}` : req.url;

  // Twilio: full URL + each POST param appended as key+value, sorted by key.
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);

  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
