import { NextRequest, NextResponse } from "next/server";
import { runDealAgent, type DealMsg } from "@/lib/deal-agent";
import { getCall, appendTurn } from "@/lib/voice-store";
import { twiml, say, gatherSpeech } from "@/lib/twiml";
import { verifyTwilioSignature } from "@/lib/twilio-verify";

export const runtime = "nodejs";
export const maxDuration = 30;

// Twilio posts each recognized speech turn here. We run the shared deal-agent
// brain in "voice" mode and speak the reply, then listen again.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const params: Record<string, string> = {};
  form?.forEach((v, k) => (params[k] = String(v)));
  if (!verifyTwilioSignature(req, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }
  const callSid = String(form?.get("CallSid") || "");
  const speech = String(form?.get("SpeechResult") || "").trim();
  const shopId = req.nextUrl.searchParams.get("shop") || getCall(callSid)?.shopId || "";
  const action = `/api/voice/respond?shop=${encodeURIComponent(shopId)}`;

  if (!shopId) {
    return twiml(say("Sorry, something went wrong on our end. Please call back. Goodbye.") + "<Hangup/>");
  }

  // No speech recognized — reprompt once rather than hanging up abruptly.
  if (!speech) {
    return twiml(gatherSpeech(action, "Sorry, I didn't catch that. Could you say that again?") + say("Thanks for calling. Goodbye.") + "<Hangup/>");
  }

  // Build the running transcript: prior turns from the store + this new one.
  const prior = getCall(callSid)?.messages ?? [];
  const turnMessages: DealMsg[] = [...prior, { role: "user", content: speech }];

  const result = await runDealAgent(shopId, turnMessages, "voice");
  if (!result.ok) {
    return twiml(gatherSpeech(action, "Sorry, I'm having trouble right now. What else can I help you find?"));
  }

  // Persist the turn for the next webhook.
  if (callSid) appendTurn(callSid, shopId, speech, result.reply);

  const tail = result.dealCaptured
    ? " I've sent that to the shop and they'll reach out to confirm. Anything else?"
    : "";

  return twiml(say(result.reply + tail) + gatherSpeech(action) + say("Thanks for calling. Goodbye.") + "<Hangup/>");
}
