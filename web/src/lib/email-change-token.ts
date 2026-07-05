import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless email-change confirmation token: HMAC-signed (user id + new email
// + expiry), keyed off the service-role secret. Mailing it to the NEW address
// proves inbox ownership without a database table.
const SECRET = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TOKEN_TTL_MS = 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", SECRET()).update(payload).digest("base64url");
}

export function makeEmailToken(userId: string, newEmail: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: newEmail, x: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readEmailToken(token: string): { userId: string; newEmail: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, e, x } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof u !== "string" || typeof e !== "string" || typeof x !== "number" || Date.now() > x) return null;
    return { userId: u, newEmail: e };
  } catch {
    return null;
  }
}
