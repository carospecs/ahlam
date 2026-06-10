import crypto from "crypto";

// Thin Stripe REST client. We talk to Stripe's HTTP API directly (no SDK) to
// match the existing billing routes and keep the dependency surface tiny.
// Everything activates the moment STRIPE_SECRET_KEY is set; until then callers
// should surface an honest "not connected" message instead of a broken button.

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Ahlam's cut of each sale, in basis points (100 bps = 1%). Default 5%.
export function platformFeeBps(): number {
  const v = Number(process.env.PLATFORM_FEE_BPS);
  return Number.isFinite(v) && v >= 0 ? v : 500;
}

export function feeCentsFor(amountCents: number): number {
  return Math.round((amountCents * platformFeeBps()) / 10000);
}

class StripeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Flatten nested objects/arrays into Stripe's bracketed form-encoding, e.g.
// { line_items: [{ price: "x" }] } -> line_items[0][price]=x
function encode(params: Record<string, any>, prefix = ""): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(...encode(item, `${k}[${i}]`));
        else out.push([`${k}[${i}]`, String(item)]);
      });
    } else if (value !== null && typeof value === "object") {
      out.push(...encode(value, k));
    } else {
      out.push([k, String(value)]);
    }
  }
  return out;
}

async function call(method: "GET" | "POST", path: string, params?: Record<string, any>) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe is not configured", 503);

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  let url = `https://api.stripe.com/v1/${path}`;
  let body: string | undefined;

  if (method === "GET") {
    if (params) {
      const qs = new URLSearchParams(encode(params)).toString();
      if (qs) url += `?${qs}`;
    }
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(encode(params || {})).toString();
  }

  const r = await fetch(url, { method, headers, body });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new StripeError(json?.error?.message || "Stripe request failed", r.status >= 500 ? 502 : 400);
  return json;
}

export const stripe = {
  get: (path: string, params?: Record<string, any>) => call("GET", path, params),
  post: (path: string, params?: Record<string, any>) => call("POST", path, params),
};

export function isStripeError(e: unknown): e is StripeError {
  return e instanceof StripeError;
}

// Verify a Stripe webhook signature (the `Stripe-Signature` header) against the
// raw request body. Implements the v1 HMAC-SHA256 scheme so we don't need the
// SDK. Returns the parsed event on success, or null if it can't be trusted.
export function verifyWebhook(rawBody: string, sigHeader: string | null): any | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  // Without a configured secret we can't verify — refuse rather than trust.
  if (!secret || !sigHeader) return null;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Reject events older than 5 minutes to blunt replay attacks.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
