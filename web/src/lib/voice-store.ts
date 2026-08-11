// Per-call conversation memory for the phone/voice agent, keyed by Twilio
// CallSid. Twilio webhooks are stateless, so we hold the running transcript
// here between turns.
//
// NOTE: this is an in-process Map — fine for local dev and a single instance,
// but in production (multiple serverless instances) it must move to a shared
// store (Redis / Upstash, or a `voice_calls` Supabase table). The interface
// below stays the same, so only these functions change.

import type { DealMsg } from "@/lib/deal-agent";

type CallState = { shopId: string; messages: DealMsg[]; updated: number };

const CALLS = new Map<string, CallState>();
const TTL_MS = 30 * 60 * 1000; // forget calls after 30 min of inactivity
const MAX_CALLS = 2000;

function sweep() {
  const now = Date.now();
  for (const [sid, st] of CALLS) if (now - st.updated > TTL_MS) CALLS.delete(sid);
  if (CALLS.size > MAX_CALLS) {
    // drop the oldest entries if we somehow blow past the cap
    const oldest = [...CALLS.entries()].sort((a, b) => a[1].updated - b[1].updated);
    for (let i = 0; i < oldest.length - MAX_CALLS; i++) CALLS.delete(oldest[i][0]);
  }
}

export function getCall(callSid: string): CallState | undefined {
  return CALLS.get(callSid);
}

export function startCall(callSid: string, shopId: string): void {
  sweep();
  CALLS.set(callSid, { shopId, messages: [], updated: Date.now() });
}

export function appendTurn(callSid: string, shopId: string, user: string, assistant: string): DealMsg[] {
  const st = CALLS.get(callSid) ?? { shopId, messages: [], updated: Date.now() };
  st.messages.push({ role: "user", content: user });
  st.messages.push({ role: "assistant", content: assistant });
  st.updated = Date.now();
  CALLS.set(callSid, st);
  return st.messages;
}

export function endCall(callSid: string): void {
  CALLS.delete(callSid);
}
