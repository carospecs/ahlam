import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SHOP_SUBDOMAINS } from "@/lib/shop-subdomains";
import { AUTH_COOKIE_DOMAIN } from "@/lib/auth-cookie";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://localhost:8082",
  // Expo / React Native dev — no port
  "exp://192.168.0.0",
  "exp://10.0.0.0",
  "exp://172.16.0.0",
  "http://192.168.0.0",
  "http://10.0.0.0",
  "http://172.16.0.0",
];

function corsMiddleware(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin") ?? "";
  const dynamicOk = /^https?:\/\/192\.168\./.test(origin) || /^https?:\/\/10\./.test(origin) || /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./.test(origin) || /^exp:\/\/192\.168\./.test(origin) || /^exp:\/\/10\./.test(origin) || /^exp:\/\/172\.(1[6-9]|2\d|3[01])\./.test(origin);
  const cors = allowedOrigins.includes(origin) || origin.endsWith(".ahlam.io") || dynamicOk;
  if (cors) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return res;
}

// {slug}.ahlam.io (or {slug}.localhost in dev) → the shop's personal website.
// Returns the slug when the host is a tenant subdomain, else null. Reserved
// labels (www, app, …) and multi-label hosts fall through to the main app;
// *.vercel.app previews never match.
function tenantSlug(req: NextRequest): string | null {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  let label: string | null = null;
  if (host.endsWith(".ahlam.io")) label = host.slice(0, -".ahlam.io".length);
  else if (host.endsWith(".localhost")) label = host.slice(0, -".localhost".length);
  if (!label || label.includes(".")) return null;
  // "demo" is reserved (no shop can claim it) but resolves to the built-in
  // example site — the live preview of what the Ultimate plan buys.
  if (label === "demo") return label;
  return validateSlug(label).ok ? label : null;
}

export async function middleware(req: NextRequest) {
  // Shop subdomain routing: <slug>.ahlam.io -> /shop/<id>, transparently
  // (URL bar keeps showing the subdomain). See lib/shop-subdomains.ts.
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const subdomain = host.endsWith(".ahlam.io") ? host.slice(0, -".ahlam.io".length) : "";
  const shopId = subdomain && SHOP_SUBDOMAINS[subdomain];
  if (shopId) {
    const url = req.nextUrl.clone();
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = `/shop/${shopId}`;
      return NextResponse.rewrite(url);
    }
  }

  const res = NextResponse.next();

  // CORS preflight
  const origin = req.headers.get("origin") ?? "";
  const dynamicOk = /^https?:\/\/192\.168\./.test(origin) || /^https?:\/\/10\./.test(origin) || /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./.test(origin) || /^exp:\/\/192\.168\./.test(origin) || /^exp:\/\/10\./.test(origin) || /^exp:\/\/172\.(1[6-9]|2\d|3[01])\./.test(origin);
  const corsOk = allowedOrigins.includes(origin) || origin.endsWith(".ahlam.io") || dynamicOk;
  if (req.method === "OPTIONS" && corsOk) {
    const preflight = new Response(null, { status: 204 });
    preflight.headers.set("Access-Control-Allow-Origin", origin);
    preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    preflight.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return preflight;
  }

  // Supabase session refresh (best-effort — don't block on transient failures)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { domain: AUTH_COOKIE_DOMAIN },
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
  } catch (e) {
    console.error("middleware: supabase auth refresh failed", e);
  }

  return corsMiddleware(req, res);
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/"],
};
