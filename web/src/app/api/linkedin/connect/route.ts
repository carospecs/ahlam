import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { LINKEDIN_STATE_COOKIE, linkedinConfigured, linkedinConsentUrl } from "@/lib/linkedin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  if (!(await requireAdmin())) return NextResponse.redirect(new URL("/adminhost/marketing?linkedin=forbidden", site));
  if (!linkedinConfigured()) return NextResponse.redirect(new URL("/adminhost/marketing?linkedin=not-configured", site));
  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(linkedinConsentUrl(state));
  response.cookies.set(LINKEDIN_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
