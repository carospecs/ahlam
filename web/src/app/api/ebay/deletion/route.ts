import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// eBay Marketplace Account Deletion / Closure notification endpoint.
// eBay requires this before it will enable a production keyset.
//   - GET  (challenge): eBay sends ?challenge_code=… ; we must reply with
//           sha256(challengeCode + verificationToken + endpointUrl) as JSON.
//   - POST (notification): eBay tells us an eBay user asked to be deleted; we
//           acknowledge with 200. We don't retain eBay buyer data, so there's
//           nothing to purge beyond acknowledging.
//
// Set these in the environment (and the same values in the eBay dev portal):
//   EBAY_VERIFICATION_TOKEN  — 32–80 chars [A-Za-z0-9_-]
//   EBAY_DELETION_ENDPOINT   — the public URL of THIS route (must match exactly)
const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN || "ahlam-ebay-mktdel-7c2f9a1b4e6d8f0a3b5c7d9e1f2a4b6c";
const ENDPOINT = process.env.EBAY_DELETION_ENDPOINT || "https://ahlam.io/api/ebay/deletion";

export async function GET(req: Request) {
  const challengeCode = new URL(req.url).searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json({ error: "missing challenge_code" }, { status: 400 });
  }
  const hash = crypto.createHash("sha256");
  hash.update(challengeCode);
  hash.update(VERIFICATION_TOKEN);
  hash.update(ENDPOINT);
  const challengeResponse = hash.digest("hex");
  return NextResponse.json({ challengeResponse }, { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  // Acknowledge the deletion notification. (We store no eBay buyer PII.)
  try { await req.json(); } catch { /* ignore body parse */ }
  return new NextResponse(null, { status: 200 });
}
