import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { startCall } from "@/lib/voice-store";
import { twiml, say, gatherSpeech } from "@/lib/twiml";
import { verifyTwilioSignature } from "@/lib/twilio-verify";

export const runtime = "nodejs";

// Twilio hits this when a call comes in. Point a Twilio number's Voice webhook
// at:  https://<your-domain>/api/voice/incoming?shop=<SHOP_ID>
// (or map the dialed number to a shop by business_phone — see resolveShop).
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const params: Record<string, string> = {};
  form?.forEach((v, k) => (params[k] = String(v)));
  if (!verifyTwilioSignature(req, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }
  const callSid = String(form?.get("CallSid") || "");
  const to = String(form?.get("To") || "");

  const shopId = await resolveShop(req, to);
  if (!shopId) {
    return twiml(say("Sorry, this number isn't set up yet. Goodbye.") + "<Hangup/>");
  }

  if (callSid) startCall(callSid, shopId);

  const db = supabaseAdmin();
  const { data: shop } = await db.from("shops").select("name").eq("id", shopId).single();
  const name = shop?.name || "the parts shop";

  const action = `/api/voice/respond?shop=${encodeURIComponent(shopId)}`;
  const greeting = `Thanks for calling ${name}. I'm the parts assistant. What part are you looking for, and what's the year, make, and model of your vehicle?`;

  return twiml(gatherSpeech(action, greeting) + say("I didn't hear anything. Please call back. Goodbye.") + "<Hangup/>");
}

// Prefer an explicit ?shop= on the webhook URL; then the dialed number matched
// to a shop's business_phone; then a DEMO_SHOP_ID env fallback (handy for a
// single trial number pointed at one shop).
async function resolveShop(req: NextRequest, to: string): Promise<string | null> {
  const q = req.nextUrl.searchParams.get("shop");
  if (q) return q;
  const digits = to.replace(/\D/g, "").slice(-10);
  if (!digits) return process.env.DEMO_SHOP_ID || null;
  const db = supabaseAdmin();
  const { data } = await db.from("shops").select("id, business_phone").not("business_phone", "is", null).limit(500);
  const hit = (data || []).find((s: any) => String(s.business_phone || "").replace(/\D/g, "").slice(-10) === digits);
  return hit?.id || process.env.DEMO_SHOP_ID || null;
}
