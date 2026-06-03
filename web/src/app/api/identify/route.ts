import { NextResponse } from "next/server";
import {
  VISION_SYSTEM_PROMPT,
  VISION_USER_INSTRUCTION,
  vinContext,
  type AIPartOutput,
  type AIResult,
} from "@carospecs/shared";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/identify
 * Body: { imageBase64?: string (data URL or raw b64), imageUrl?: string,
 *         vin?: { make?, model?, year? } }
 *
 * Calls GPT-4o Vision, returns a structured AIPartOutput. The OpenAI key lives
 * only on the server — the mobile app calls this route, never OpenAI directly.
 *
 * On failure the shop sees a calm "high demand, try again" message (never a raw
 * error, never "couldn't identify"), and the team gets an email alert.
 */
export async function POST(req: Request): Promise<NextResponse<AIResult>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    await alertTeam("OPENAI_API_KEY missing on server");
    return NextResponse.json(busyResult("OPENAI_API_KEY missing"), {
      status: 503,
    });
  }

  let body: {
    imageBase64?: string;
    imageUrl?: string;
    vin?: { make?: string; model?: string; year?: number };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(busyResult("bad request body"), { status: 400 });
  }

  const imageUrl =
    body.imageUrl ??
    (body.imageBase64
      ? body.imageBase64.startsWith("data:")
        ? body.imageBase64
        : `data:image/jpeg;base64,${body.imageBase64}`
      : null);

  if (!imageUrl) {
    return NextResponse.json(busyResult("no image provided"), { status: 400 });
  }

  const userText =
    VISION_USER_INSTRUCTION + (body.vin ? vinContext(body.vin) : "");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      await alertTeam(`OpenAI ${res.status}: ${detail.slice(0, 500)}`);
      return NextResponse.json(busyResult(`OpenAI ${res.status}`), {
        status: 503,
      });
    }

    const json = await res.json();
    const content: string | undefined = json.choices?.[0]?.message?.content;
    if (!content) {
      await alertTeam("OpenAI returned empty content");
      return NextResponse.json(busyResult("empty completion"), { status: 503 });
    }

    const parsed = JSON.parse(content) as AIPartOutput;
    // Defensive defaults so the review UI never crashes on a missing field.
    const data: AIPartOutput = {
      partName: parsed.partName ?? "Unknown part",
      partCategory: parsed.partCategory ?? "Uncategorized",
      fitment: Array.isArray(parsed.fitment) ? parsed.fitment : [],
      condition: parsed.condition ?? "Fair",
      conditionNotes: parsed.conditionNotes ?? "",
      description: parsed.description ?? "",
      suggestedPriceUsd:
        typeof parsed.suggestedPriceUsd === "number"
          ? parsed.suggestedPriceUsd
          : null,
      confidence: parsed.confidence ?? "low",
      lowConfidenceFields: parsed.lowConfidenceFields ?? [],
    };

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertTeam(`identify route threw: ${msg}`);
    return NextResponse.json(busyResult(msg), { status: 503 });
  }
}

/** Shop-facing busy message — never leaks the real error or says "couldn't ID". */
function busyResult(internalError: string): AIResult {
  return {
    ok: false,
    userMessage:
      "We're seeing high demand right now and couldn't process this photo. " +
      "Please try again in a couple of minutes.",
    internalError,
  };
}

/** Email the CEO/CTO so they know credits ran out or the API is down. */
async function alertTeam(detail: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.WAITLIST_FROM_EMAIL;
  const to = process.env.ALERT_EMAIL;
  if (!key || !from || !to) {
    console.error("[ALERT] (email not configured):", detail);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    await resend.emails.send({
      from,
      to,
      subject: "⚠️ CaroSpecs AI identify failure",
      text:
        `The /api/identify route failed.\n\nDetail:\n${detail}\n\n` +
        `Likely causes: OpenAI credits exhausted, rate limit, or API outage. ` +
        `Shops are currently seeing the "high demand, try again" message.`,
    });
  } catch (e) {
    console.error("[ALERT] failed to send alert email:", e, "orig:", detail);
  }
}
