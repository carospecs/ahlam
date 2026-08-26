import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_DOMAIN } from "@/lib/auth-cookie";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { domain: AUTH_COOKIE_DOMAIN } }
  );
}
