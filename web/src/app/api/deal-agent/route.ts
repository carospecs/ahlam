import { NextRequest, NextResponse } from "next/server";
import { runDealAgent } from "@/lib/deal-agent";

export const runtime = "nodejs";
export const maxDuration = 30;

// Storefront chat endpoint. The per-shop, inventory-aware brain lives in
// @/lib/deal-agent so the phone/voice webhooks share the exact same behavior.
export async function POST(req: NextRequest) {
  const { shopId, messages } = await req.json().catch(() => ({}));
  const result = await runDealAgent(shopId, messages, "chat");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const { reply, itemCount, dealCaptured } = result;
  return NextResponse.json({ reply, itemCount, dealCaptured });
}
