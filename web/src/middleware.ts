import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SHOP_SUBDOMAINS } from "@/lib/shop-subdomains";
import { SITE_ROOT_DOMAIN, siteOrigin, validateSlug } from "@/lib/slug";
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
// Returns the slug when the host is a tenant subdomain, else null. "www", the
// bare apex, reserved labels, and multi-label hosts fall through to the main
// app; *.vercel.app previews never match.
function tenantSlug(req: NextRequest): string | null {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  const rootHost = SITE_ROOT_DOMAIN.split(":")[0]; // "ahlam.io", or e.g. "localhost" in dev
  let label: string | null = null;
  if (host.endsWith(".ahlam.io")) label = host.slice(0, -".ahlam.io".length);
  else if (host.endsWith(".localhost")) label = host.slice(0, -".localhost".length);
  else if (host.endsWith(`.${rootHost}`)) label = host.slice(0, -(rootHost.length + 1));
  if (!label || label.includes(".") || label === "www") return null;
  // "demo" is reserved (no shop can claim it) but resolves to the built-in
  // example site — the live preview of what the Ultimate plan buys.
  if (label === "demo" || label in SHOP_SUBDOMAINS) return label;
  return validateSlug(label).ok ? label : null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const slug = tenantSlug(req);

  // Tenant hosts: serve the personal site under /site/{slug}, transparently
  // (URL bar keeps showing the subdomain). /api/* falls through unchanged so
  // client widgets on shop pages keep working; every other path renders the
  // site's 404 rather than leaking apex content onto the subdomain.
  if (slug && !isApi) {
    const url = req.nextUrl.clone();
    if (pathname === "/" || pathname === "") url.pathname = `/site/${slug}`;
    else if (pathname.startsWith("/p/")) url.pathname = `/site/${slug}${pathname}`;
    else if (pathname === "/robots.txt" || pathname === "/sitemap.xml") url.pathname = `/site/${slug}${pathname}`;
    else url.pathname = `/site/${slug}/__404`;
    return NextResponse.rewrite(url);
  }

  // Apex: a direct hit on /site/{slug}/* canonically lives on the subdomain.
  if (!slug) {
    const m = pathname.match(/^\/site\/([^/]+)(\/.*)?$/);
    if (m) {
      return NextResponse.redirect(new URL(`${m[2] || "/"}${req.nextUrl.search}`, siteOrigin(m[1])), 308);
    }
  }

  // Session refresh / CORS / dashboard auth only ever applied to these routes
  // (the pre-broadened matcher); everything else passes straight through.
  if (pathname !== "/" && !isApi && !isDashboard) return NextResponse.next();

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
  // Everything except Next internals and static assets. Deliberately does NOT
  // exclude .txt/.xml so /robots.txt and /sitemap.xml reach the middleware and
  // get per-tenant rewrites on shop subdomains.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|sw\\.js|apple-touch-icon|img/|logos/|marketplace/|video/).*)",
  ],
};
