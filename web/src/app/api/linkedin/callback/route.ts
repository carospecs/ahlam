import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  LINKEDIN_STATE_COOKIE,
  exchangeLinkedInCode,
  linkedinConfigured,
  saveLinkedInConnection,
} from "@/lib/linkedin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const url = new URL(req.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(LINKEDIN_STATE_COOKIE)?.value;
  const finish = (result: string) => {
    const response = NextResponse.redirect(new URL(`/adminhost/marketing?linkedin=${result}`, site));
    response.cookies.set(LINKEDIN_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  if (!(await requireAdmin())) return finish("forbidden");
  if (!linkedinConfigured()) return finish("not-configured");
  if (url.searchParams.get("error")) return finish("denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !expectedState || state !== expectedState) return finish("invalid-state");

  try {
    await saveLinkedInConnection(await exchangeLinkedInCode(code));
    return finish("connected");
  } catch (error) {
    console.error("[linkedin] callback failed", error instanceof Error ? error.message : error);
    return finish("error");
  }
}
