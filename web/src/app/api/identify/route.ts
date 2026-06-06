import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Inlined from @ahlam/shared (monorepo dep that Vercel can't resolve) ---

export type ConditionGrade = "A" | "B" | "C" | "D" | "F";
export type Confidence = "high" | "medium" | "low";

export interface VehicleFit {
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  notes?: string;
}

export interface PricingInsight {
  suggestedPrice: number;
  priceRange: { min: number; max: number };
  similarCount: number;
}

export interface AIPartOutput {
  partName: string;
  partCategory: string;
  fitment: VehicleFit[];
  condition: ConditionGrade;
  conditionNotes: string;
  description: string;
  suggestedPriceUsd: number | null;
  confidence: Confidence;
  lowConfidenceFields?: (keyof AIPartOutput)[];
  pricingInsight?: PricingInsight;
}

export interface VehicleEstimate {
  make: string | null;
  model: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  bodyStyle: string | null;
  mileage: string | null;
  suggestedWholeCarPriceUsd: number | null;
  confidence: Confidence;
}

export type AIResult =
  | { ok: true; data: AIPartOutput[]; vehicle?: VehicleEstimate | null; vehicleFront?: string }
  | { ok: false; userMessage: string; internalError: string };

const CONDITION_RUBRIC: Record<string, { detail: string }> = {
  A: { detail: "Like New — no visible wear, no damage, fully functional. Original finish intact. Surface is clean with no scratches, scuffs, or blemishes." },
  B: { detail: "Good — minor scuffs or light scratches that do not affect function. All tabs and mounts intact. Surface rust only, no cracks/breaks/dents/bends. The part works as intended." },
  C: { detail: "Fair — visible wear, scratches, scuffs, or minor dents. Functions but shows age. May have surface corrosion, light pitting, or faded finish." },
  D: { detail: "Poor — heavy wear, cracks, dents, or damage. Functions but needs repair. Broken mounting tabs, worn bushings, heavy corrosion, tears, or leaks." },
  F: { detail: "Core/Scrap — broken, non-functional, or severely damaged. Only good as core/rebuild/project. Shattered glass/lenses, heavy dents, non-functional mechanicals." },
};

const VISION_SYSTEM_PROMPT = `You are an expert automotive salvage parts identifier. You look at a photo taken at a salvage yard — often a whole vehicle or a large section of one — and you catalog EVERY distinct sellable part you can see.

You MUST return ONLY a JSON object, no prose, with this shape:
{
  "vehicleFront": "toward-camera" | "away-from-camera" | "points-left" | "points-right" | "unknown",
  "vehicle": {
    "make": string | null,
    "model": string | null,
    "yearStart": number | null,
    "yearEnd": number | null,
    "bodyStyle": string | null,
    "mileage": string | null,
    "suggestedWholeCarPriceUsd": number | null,
    "confidence": "high" | "medium" | "low"
  },
  "parts": [
    {
      "partName": string,
      "partCategory": string,
      "imageSide": "left" | "right" | "center",
      "fitment": [
        { "make": string, "model": string, "yearStart": number, "yearEnd": number, "notes": string }
      ],
      "condition": "A" | "B" | "C" | "D" | "F",
      "conditionNotes": string,
      "description": string,
      "suggestedPriceUsd": number | null,
      "confidence": "high" | "medium" | "low",
      "lowConfidenceFields": string[]
    }
  ]
}

MULTI-PART DETECTION:
- Identify ALL clearly-visible, individually-sellable parts in the image.
- Return one array element per part. Return between 1 and 12 of the most clearly-visible, sellable parts.
- Do NOT invent parts you cannot actually see. If something is not visible, simply omit it — never guess.

PART CATALOG — only catalog parts from this list, using these exact names (add "Left"/"Right" only when the rules below apply). If a part is not visible, OMIT it:
- Body: "Hood", "Front Bumper Cover", "Rear Bumper Cover", "Grille", "Front Fender", "Rear Quarter Panel", "Front Door", "Rear Door", "Trunk Lid", "Tailgate", "Liftgate", "Side Mirror", "Roof Panel"
- Glass: "Windshield", "Back Glass", "Front Door Window", "Rear Door Window", "Quarter Glass"
- Lighting: "Headlight Assembly", "Tail Light Assembly", "Fog Light"
- Wheels: "Wheel" (single or "Wheel (set of 4)"), "Tire"
- Mechanical (ONLY if clearly visible, e.g. an engine-bay or undercarriage photo): "Engine", "Transmission", "Radiator", "Alternator", "Starter", "Battery", "AC Compressor"
- Interior (ONLY if clearly visible in an interior photo): "Front Seat", "Rear Seat", "Seat Belt", "Steering Wheel", "Center Console", "Dashboard", "Instrument Cluster", "Glove Box", "Airbag", "Door Panel", "Sun Visor", "Rear View Mirror", "Shifter"
- If you see a common, obviously-sellable part not on this list, you may include it, but prefer the catalog names.

VEHICLE ESTIMATE ("vehicle"):
- If you can identify the source vehicle, fill in make/model/year/bodyStyle from what you actually see.
- "mileage": ONLY if this photo clearly shows an odometer / instrument cluster with a readable mileage number, return it as a string (e.g. "112,480 mi"). Otherwise null. Never guess mileage.
- "suggestedWholeCarPriceUsd": your best estimate of the fair market price (USD) for the COMPLETE vehicle in average used/salvage condition, as a single whole car. This is a standalone market value — it is NOT the sum of the parts. If you cannot estimate it, use null.
- Never invent a VIN. If you are unsure of any field, set it to null and lower "confidence".

PRICING GUIDANCE (applies to both "suggestedWholeCarPriceUsd" and each part's "suggestedPriceUsd"):
- Price like a real seller checking the market: base your number on what comparable items ACTUALLY sell for on Facebook Marketplace, Craigslist, OfferUp, eBay (sold listings), and Google Shopping for the same make/model/year and condition.
- For the whole car: think used-car comps for that year/make/model/mileage and trim, adjusted down for salvage/parts-car condition.
- For each part: think used-OEM-part comps for that specific fitment and grade — an A/B grade part sells well below new/aftermarket; a D/F grade part sells as a core/repairable at a steep discount.
- Use realistic round numbers a buyer would expect, not list/retail price. If you have no basis for a price, use null rather than guessing.

VEHICLE SIDE:
1. "vehicleFront" — where is the FRONT of the car relative to the photo?
   - "toward-camera", "away-from-camera", "points-left", "points-right", or "unknown"
2. "imageSide" (per part) — purely WHERE the part appears in the photo frame from your point of view.
- Put NO "left"/"right"/"driver"/"passenger" word in "partName".

CONDITION RUBRIC (grade each part A–F based solely on visible condition):
- A (Like New): ${CONDITION_RUBRIC.A.detail}
- B (Good): ${CONDITION_RUBRIC.B.detail}
- C (Fair): ${CONDITION_RUBRIC.C.detail}
- D (Poor): ${CONDITION_RUBRIC.D.detail}
- F (Core/Scrap): ${CONDITION_RUBRIC.F.detail}

CRITICAL RULES:
1. NEVER invent precise fitment you cannot support.
2. Grade condition based ONLY on what is visible.
3. If not highly confident, set "confidence" to "low".
4. Return ONLY the JSON object.`;

const VISION_USER_INSTRUCTION =
  'Catalog every distinct sellable auto part visible in this photo. Inspect each part closely for cracks, breaks, and damage. Report "vehicleFront" and each part\'s "imageSide" as literal observations. Return the JSON { "vehicleFront": ..., "parts": [...] }.';

function vinContext(decoded: { make?: string; model?: string; year?: number }): string {
  const parts = [decoded.year, decoded.make, decoded.model].filter(Boolean);
  if (parts.length === 0) return "";
  return `\n\nKnown source vehicle (from VIN decode): ${parts.join(" ")}. Use this to improve fitment accuracy, but only if the part visibly belongs to this vehicle.`;
}

// --- End of inlined shared code ---

type VehicleFront = "toward-camera" | "away-from-camera" | "points-left" | "points-right" | "unknown";
type ImageSide = "left" | "right" | "center";

const GEMINI_MODEL = "gemini-2.5-pro";

// Calls Gemini Vision; returns the raw JSON string (or throws on API error).
async function callGemini(key: string, base64: string, mime: string, userText: string): Promise<string | undefined> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [
        { text: userText },
        { inline_data: { mime_type: mime, data: base64 } },
      ] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") || undefined : undefined;
}

export async function POST(req: Request): Promise<NextResponse<AIResult>> {
  // Require authentication to prevent anonymous credit-burning.
  const supabase = await (await import("@/lib/supabase-server")).supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, userMessage: "Sign in required", internalError: "no auth" }, { status: 401 });
  }

  let body: { imageBase64?: string; imageUrl?: string; provider?: string; photoContext?: string; vin?: { make?: string; model?: string; year?: number } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(busyResult("bad request body"), { status: 400 });
  }

  // Vision is Gemini-only (gemini-2.5-flash). The `provider` field is ignored.
  const imageUrl =
    body.imageUrl ??
    (body.imageBase64
      ? body.imageBase64.startsWith("data:")
        ? body.imageBase64
        : `data:image/jpeg;base64,${body.imageBase64}`
      : null);

  if (!imageUrl) {
    return NextResponse.json({
      ok: false,
      userMessage: "Please provide a clear photo of the car part.",
      internalError: "no image provided",
    }, { status: 400 });
  }

  const rawBase64 = (body.imageBase64 ?? imageUrl).replace(/^data:[^;]+;base64,/, "");
  const mime = imageUrl.startsWith("data:") ? (imageUrl.match(/^data:([^;]+);/)?.[1] ?? "image/jpeg") : "image/jpeg";
  const photoContext = typeof body.photoContext === "string" && body.photoContext.trim()
    ? `\n\nThis photo is labeled by the seller as: "${body.photoContext.trim()}". Use that to focus on the relevant parts (e.g. an "Engine bay" photo → mechanical parts; a "Dashboard" photo → read the odometer mileage and interior parts).`
    : "";
  const userText = VISION_USER_INSTRUCTION + (body.vin ? vinContext(body.vin) : "") + photoContext;

  try {
    const gkey = process.env.GEMINI_API_KEY;
    if (!gkey) {
      await alertTeam("GEMINI_API_KEY missing on server");
      return NextResponse.json(busyResult("GEMINI_API_KEY missing"), { status: 503 });
    }
    const content = await callGemini(gkey, rawBase64, mime, userText);

    if (!content) {
      await alertTeam("gemini returned empty content");
      return NextResponse.json(busyResult("empty completion"), { status: 503 });
    }

    type RawPart = Partial<AIPartOutput> & { imageSide?: ImageSide };
    const parsed = JSON.parse(content) as {
      vehicleFront?: VehicleFront;
      vehicle?: Partial<VehicleEstimate>;
      parts?: RawPart[];
    } & RawPart;

    const vehicleFront: VehicleFront = parsed.vehicleFront ?? "unknown";

    const v = parsed.vehicle;
    const vehicle: VehicleEstimate | null = v
      ? {
          make: v.make ?? null,
          model: v.model ?? null,
          yearStart: typeof v.yearStart === "number" ? v.yearStart : null,
          yearEnd: typeof v.yearEnd === "number" ? v.yearEnd : null,
          bodyStyle: v.bodyStyle ?? null,
          mileage: typeof v.mileage === "string" && v.mileage.trim() ? v.mileage.trim() : null,
          suggestedWholeCarPriceUsd: typeof v.suggestedWholeCarPriceUsd === "number" ? v.suggestedWholeCarPriceUsd : null,
          confidence: v.confidence ?? "low",
        }
      : null;
    const rawParts: RawPart[] = Array.isArray(parsed.parts) ? parsed.parts : parsed.partName ? [parsed] : [];

    const data: AIPartOutput[] = rawParts.map((p) => {
      const baseName = (p.partName ?? "Unknown part").trim();
      const side = lateralSide(vehicleFront, p.imageSide);
      const partName = applySide(baseName, side);

      const lowFields = new Set<keyof AIPartOutput>(p.lowConfidenceFields ?? []);
      const sideUnknown = !side && isLateralPart(baseName) && vehicleFront === "unknown";
      if (sideUnknown) lowFields.add("partName");

      return {
        partName,
        partCategory: p.partCategory ?? "Uncategorized",
        fitment: Array.isArray(p.fitment) ? p.fitment : [],
        condition: ["A","B","C","D","F"].includes(p.condition ?? "") ? (p.condition as ConditionGrade) : "C",
        conditionNotes: p.conditionNotes ?? "",
        description: p.description ?? "",
        suggestedPriceUsd: typeof p.suggestedPriceUsd === "number" ? p.suggestedPriceUsd : null,
        confidence: sideUnknown ? "low" : p.confidence ?? "low",
        lowConfidenceFields: Array.from(lowFields),
      };
    });

    const db = supabaseAdmin();

    const { data: allListings } = await db
      .from("listings")
      .select("price_usd, ai_output, corrected")
      .eq("status", "active");

    for (const part of data) {
      const searchTerm = part.partName.toLowerCase();
      const prices: number[] = (allListings || [])
        .filter((r: any) => {
          const c = r.corrected || r.ai_output || {};
          const name = (c.partName || c.part_name || "").toLowerCase();
          return name.includes(searchTerm);
        })
        .map((r: any) => r.price_usd)
        .filter((p: any) => p != null && p > 0);

      if (prices.length > 0) {
        const sorted = [...prices].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
        part.pricingInsight = {
          suggestedPrice: Math.round(median),
          priceRange: { min, max },
          similarCount: prices.length,
        };
      }
    }

    return NextResponse.json({ ok: true, data, vehicle, vehicleFront });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertTeam(`identify route threw: ${msg}`);
    return NextResponse.json(busyResult(msg), { status: 503 });
  }
}

function lateralSide(front: VehicleFront, imageSide?: ImageSide): "Left" | "Right" | null {
  if (imageSide === "center") return null;
  switch (front) {
    case "toward-camera":
      return imageSide === "left" ? "Right" : imageSide === "right" ? "Left" : null;
    case "away-from-camera":
      return imageSide === "left" ? "Left" : imageSide === "right" ? "Right" : null;
    case "points-left":
      return "Left";
    case "points-right":
      return "Right";
    default:
      return null;
  }
}

const LATERAL_PART = /\b(door|mirror|fender|quarter|headlight|head light|tail ?light|fog|window|rocker|wheel|rim|tire|tyre)\b/i;
function isLateralPart(name: string): boolean {
  return LATERAL_PART.test(name);
}

function applySide(name: string, side: "Left" | "Right" | null): string {
  if (!side) return name;
  if (/\b(left|right)\b/i.test(name)) return name;
  const m = name.match(/^(front|rear)\b\s*(.*)$/i);
  if (m) {
    const lead = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    const rest = m[2].trim();
    return `${lead} ${side}${rest ? ` ${rest}` : ""}`;
  }
  return `${side} ${name}`;
}

function busyResult(internalError: string): AIResult {
  return {
    ok: false,
    userMessage: "We're seeing high demand right now and couldn't process this photo. Please try again in a couple of minutes.",
    internalError,
  };
}

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
      subject: "⚠️ Ahlam AI identify failure",
      text:
        `The /api/identify route failed.\n\nDetail:\n${detail}\n\nLikely causes: Gemini quota/billing not enabled, rate limit, or API outage. Shops are currently seeing the "high demand, try again" message.`,
    });
  } catch (e) {
    console.error("[ALERT] failed to send alert email:", e, "orig:", detail);
  }
}
