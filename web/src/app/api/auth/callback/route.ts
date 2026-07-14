import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  // Provider-side failures (user cancelled, provider misconfigured) arrive as
  // error params instead of a code — log the reason, it's invisible otherwise.
  const providerError = searchParams.get("error_description") || searchParams.get("error");
  if (providerError) console.error("oauth provider returned error:", providerError);

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("oauth code exchange failed:", error.code || "", error.message);
    // A duplicate hit (browser prefetch, double navigation) consumes the code
    // first; if that already produced a session, this request should still
    // succeed rather than bounce the user to an error.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
