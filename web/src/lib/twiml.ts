// Minimal TwiML builders — enough for a speech-driven phone agent without
// pulling in the full Twilio SDK.

import { NextResponse } from "next/server";

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twiml(body: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

const VOICE = 'voice="Polly.Joanna-Neural"';

export function say(text: string): string {
  return `<Say ${VOICE}>${xmlEscape(text)}</Say>`;
}

// A <Gather> that listens for speech and posts the result to `action`. Any
// nested prompt is spoken while it listens.
export function gatherSpeech(action: string, prompt?: string): string {
  return `<Gather input="speech" action="${xmlEscape(action)}" method="POST" speechTimeout="auto" language="en-US" actionOnEmptyResult="true">${
    prompt ? say(prompt) : ""
  }</Gather>`;
}
