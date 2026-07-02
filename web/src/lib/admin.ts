import { supabaseServer } from "@/lib/supabase-server";

// Admin allowlist. Set ADMIN_EMAILS (comma-separated) in every environment.
//
// FAIL CLOSED: when ADMIN_EMAILS is unset the list is EMPTY and nobody is an
// admin. There is intentionally no hardcoded fallback — a default like
// "admin@gmail.com" is an externally registerable address, so an unset env var
// must never silently grant admin to anyone.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  const e = email?.toLowerCase();
  return !!e && ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(e);
}

/**
 * Returns the caller's email if they are a signed-in allowlisted admin, else
 * null. Reads the session via the anon SSR client (cookies), never trusts a
 * body-supplied email.
 */
export async function requireAdmin(): Promise<string | null> {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const email = user?.email?.toLowerCase();
    return isAdminEmail(email) ? email! : null;
  } catch {
    return null;
  }
}
