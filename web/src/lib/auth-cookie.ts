import { SITE_ROOT_DOMAIN } from "@/lib/slug";

// Shared auth-cookie domain so a signed-in shop owner stays signed in when
// following the "View my site" / "Dashboard" links between ahlam.io and their
// {slug}.ahlam.io personal site. All three places that create a Supabase SSR
// client (browser, server, middleware) must use this so the session cookie
// they read/write agrees on scope.
//
// Left undefined in local dev: a leading-dot domain doesn't reliably match
// {slug}.localhost across browsers, and dev doesn't need cross-subdomain SSO.
export const AUTH_COOKIE_DOMAIN = SITE_ROOT_DOMAIN.startsWith("localhost")
  ? undefined
  : `.${SITE_ROOT_DOMAIN}`;
