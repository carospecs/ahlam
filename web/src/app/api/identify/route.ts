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

    type RawPart = Partial<AIPartOutput> & { imageSide?: ImageSide };
    const parsed = JSON.parse(content) as {
      vehicleFront?: VehicleFront;
      parts?: RawPart[];
    } & RawPart;

    // Accept either { vehicleFront, parts: [...] } (new) or a single bare
    // object (fallback).
    const vehicleFront: VehicleFront = parsed.vehicleFront ?? "unknown";
    const rawParts: RawPart[] = Array.isArray(parsed.parts)
      ? parsed.parts
      : parsed.partName
      ? [parsed]
      : [];

    // Defensive defaults per part so the review UI never crashes on a missing
    // field. Condition is clamped to the two-grade system (anything that isn't
    // exactly "Good" becomes "Poor" — the conservative choice). The automotive
    // LEFT/RIGHT side is computed deterministically here from the model's two
    // raw observations (vehicleFront + imageSide) — never guessed by the model.
    const data: AIPartOutput[] = rawParts.map((p) => {
      const baseName = (p.partName ?? "Unknown part").trim();
      const side = lateralSide(vehicleFront, p.imageSide);
      const partName = applySide(baseName, side);

      const lowFields = new Set<keyof AIPartOutput>(p.lowConfidenceFields ?? []);
      // Couldn't pin down the side on a part that clearly has one → flag it.
      const sideUnknown =
        !side && isLateralPart(baseName) && vehicleFront === "unknown";
      if (sideUnknown) lowFields.add("partName");

      return {
        partName,
        partCategory: p.partCategory ?? "Uncategorized",
        fitment: Array.isArray(p.fitment) ? p.fitment : [],
        condition: p.condition === "Good" ? "Good" : "Poor",
        conditionNotes: p.conditionNotes ?? "",
        description: p.description ?? "",
        suggestedPriceUsd:
          typeof p.suggestedPriceUsd === "number" ? p.suggestedPriceUsd : null,
        confidence: sideUnknown ? "low" : p.confidence ?? "low",
        lowConfidenceFields: Array.from(lowFields),
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertTeam(`identify route threw: ${msg}`);
    return NextResponse.json(busyResult(msg), { status: 503 });
  }
}

// --- Vehicle side computation -----------------------------------------------
// The model reports only raw observations; we derive automotive left/right with
// fixed geometry. Convention: left/right are from the driver's seat facing
// forward (left = driver side in LHD markets).

type VehicleFront =
  | "toward-camera"
  | "away-from-camera"
  | "points-left"
  | "points-right"
  | "unknown";
type ImageSide = "left" | "right" | "center";

/**
 * Map (where the car's front points) + (where the part sits in the frame) to
 * the vehicle's true side. Key insight: when the front faces the camera the
 * image is mirrored (vehicle-left appears on image-right); when we see the rear
 * there is no mirror; a profile shows one whole flank.
 */
function lateralSide(
  front: VehicleFront,
  imageSide?: ImageSide
): "Left" | "Right" | null {
  if (imageSide === "center") return null; // centerline part: hood, grille, etc.
  switch (front) {
    case "toward-camera": // front faces us → mirror flip
      return imageSide === "left" ? "Right" : imageSide === "right" ? "Left" : null;
    case "away-from-camera": // rear faces us → no flip
      return imageSide === "left" ? "Left" : imageSide === "right" ? "Right" : null;
    case "points-left": // profile, nose to image-left → driver (left) flank faces us
      return "Left";
    case "points-right": // profile, nose to image-right → passenger (right) flank
      return "Right";
    default:
      return null;
  }
}

/** Parts that have a meaningful left/right (used to flag undeterminable sides). */
const LATERAL_PART =
  /\b(door|mirror|fender|quarter|headlight|head light|tail ?light|fog|window|rocker|wheel|rim|tire|tyre)\b/i;
function isLateralPart(name: string): boolean {
  return LATERAL_PART.test(name);
}

/** Insert the computed side into the part name (after a leading Front/Rear). */
function applySide(name: string, side: "Left" | "Right" | null): string {
  if (!side) return name;
  if (/\b(left|right)\b/i.test(name)) return name; // already has a side; leave it
  const m = name.match(/^(front|rear)\b\s*(.*)$/i);
  if (m) {
    const lead = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    const rest = m[2].trim();
    return `${lead} ${side}${rest ? ` ${rest}` : ""}`;
  }
  return `${side} ${name}`;
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
