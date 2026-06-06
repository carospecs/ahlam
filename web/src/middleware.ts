import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://localhost:8082",
];

function corsMiddleware(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin") ?? "";
  const cors = allowedOrigins.includes(origin) || origin.endsWith(".carospecs.com");
  if (cors) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // CORS preflight
  const origin = req.headers.get("origin") ?? "";
  const corsOk = allowedOrigins.includes(origin) || origin.endsWith(".carospecs.com");
  if (req.method === "OPTIONS" && corsOk) {
    const preflight = new Response(null, { status: 204 });
    preflight.headers.set("Access-Control-Allow-Origin", origin);
    preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    preflight.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return preflight;
  }

  // Supabase session refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return corsMiddleware(req, res);
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
