import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { livePartPrice, livePricingEnabled } from "@/lib/pricing";
import { geminiGenerate } from "@/lib/gemini";
import { anthropicGenerate } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Inlined from @ahlam/shared (monorepo dep that Vercel can't resolve) ---

export type ConditionGrade = "A" | "B" | "C";
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
  damageCode?: string;
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
  A: { detail: "GRADE A — Like New. From low-mileage or newer vehicles; minimal to no visible wear. Body parts: 0–1 repair unit needed (e.g. a small dent on a door panel). Mechanical: under 60,000 miles total use, OR no more than 15,000 miles per year relative to the vehicle's model age (e.g. an engine with 30,000 miles). Most expensive tier; highest quality, least wear." },
  B: { detail: "GRADE B — Reliable, More Wear. From moderate-mileage vehicles; still fully functional. Body parts: 1–2 repair units needed; visible damage but structurally sound. Mechanical: 60,000–200,000 miles total, AND more than 15,000 miles per year relative to model age; hard ceiling of under 200,000 miles total regardless of other factors. Middle tier; savings over Grade A in exchange for more wear." },
  C: { detail: "GRADE C — Functional, High Wear. From older, high-mileage vehicles; visible wear but still serviceable. Body parts: 2 or more repair units needed; significant cosmetic or structural damage. Mechanical: over 200,000 miles total, regardless of vehicle age. Best fit for older or discontinued models; may require more maintenance attention." },
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
      "condition": "A" | "B" | "C",
      "conditionNotes": string,
      "damageCode": string,
      "description": string,
      "suggestedPriceUsd": number | null,
      "confidence": "high" | "medium" | "low",
      "lowConfidenceFields": string[]
    }
  ]
}

MULTI-PART DETECTION:
- Identify ALL clearly-visible, individually-sellable parts in the image.
- Return one array element per part. Return up to 12 of the most clearly-visible, sellable parts.
- Do NOT invent parts you cannot actually see. If something is not visible, simply omit it — never guess.
- If only 1–2 parts are visible, return only 1–2 parts. Do not pad the list.

PART CATALOG — only catalog parts from this list, using these exact names (add "Left"/"Right" only when the rules below apply). If a part is not visible, OMIT it:
- Body: "Hood", "Front Bumper Cover", "Rear Bumper Cover", "Grille", "Front Fender", "Rear Quarter Panel", "Front Door", "Rear Door", "Trunk Lid", "Tailgate", "Liftgate", "Side Mirror", "Roof Panel"
- Glass: "Windshield", "Back Glass", "Front Door Window", "Rear Door Window", "Quarter Glass"
- Lighting: "Headlight Assembly", "Tail Light Assembly", "Fog Light"
- Wheels: "Wheel / Rim" and "Tire" — these are ALWAYS two separate listings, never combined. A rim and the tire on it sell separately for more, so list each on its own line with its own price.
- Mechanical: "Engine", "Transmission", "Radiator", "Alternator", "Starter", "Battery", "AC Compressor", "ABS Module", "Power Steering Pump", "Strut / Shock", "Control Arm", "Driveshaft", "Catalytic Converter", "Fuel Pump"
- Interior: "Front Seat", "Rear Seat", "Seat Belt", "Steering Wheel", "Airbag", "Center Console", "Dashboard", "Instrument Cluster", "Glove Box", "Door Panel", "Sun Visor", "Rear View Mirror", "Shifter"
- If you see a common, obviously-sellable part not on this list, you may include it, but prefer the catalog names.

MECE — each part is ONE distinct, separately-sold unit (mutually exclusive, collectively exhaustive). NEVER bundle parts that sell separately:
- "Airbag" is its OWN listing — NEVER include it with or inside "Steering Wheel". List them as two separate parts.
- "Wheel / Rim" and "Tire" are two separate listings — never one combined "wheel and tire".
- Don't merge an assembly with its sub-parts (e.g. don't fold the mirror glass into the door). When in doubt, split into the parts a yard actually sells individually.

VEHICLE ESTIMATE ("vehicle"):
- If you can identify the source vehicle, fill in make/model/year/bodyStyle from what you actually see.
- "mileage": ONLY if this photo clearly shows an odometer / instrument cluster with a readable mileage number, return it as a string (e.g. "112,480 mi"). Otherwise null. Never guess mileage.
- "suggestedWholeCarPriceUsd": your best estimate of the fair market price (USD) for the COMPLETE vehicle in average used/salvage condition, as a single whole car. This is a standalone market value — it is NOT the sum of the parts. If you cannot estimate it, use null.
- Never invent a VIN. If you are unsure of any field, set it to null and lower "confidence".

PRICING GUIDANCE (applies to both "suggestedWholeCarPriceUsd" and each part's "suggestedPriceUsd"):
- Price at the MIDDLE of the real used-market range — the AVERAGE of what comparable items actually sell for on Facebook Marketplace, Craigslist, OfferUp, eBay sold listings, and Google Shopping for the same make/model/year and condition. Aim for fair market value, NOT a quick-sale lowball.
- DO NOT UNDERCUT. If a "Good" used part typically sells for $600–$1000, price it around the middle (~$800), never below the bottom of that range. Sellers can always lower it; starting too low leaves money on the table.
- Use the part's full OEM fitment (make/model/year/trim) when judging comps — a popular late-model part holds strong value.
- "Good" condition = mid-to-upper market range; "Poor" = priced as a core/repairable (clearly below range, but still realistic).
- For the whole car: think used-car comps for that year/make/model/mileage and trim, at typical private-party value (only discount for genuine salvage/parts-car condition).
- Use realistic round numbers. If you genuinely have no basis for a price, use null rather than guessing — but prefer a market-based estimate.
- TYPICAL USED-OEM PRICE BANDS (a modern, popular vehicle in "Good" condition — anchor near the MIDDLE of these; a single mainstream-car part is rarely worth under ~$150):
  - Door (shell): $500–$1,200 · Hood: $250–$700 · Fender: $200–$500 · Bumper cover: $200–$700 · Quarter panel: $400–$900
  - Headlight assembly: $150–$500 (LED/HID higher) · Tail light: $80–$300 · Side mirror: $120–$350 (left & right are usually within ~20% of each other — don't price them wildly differently)
  - Wheel/Rim: $120–$400 each · Tire: $40–$150 each · Windshield/glass: $150–$500
  - Engine: $1,000–$4,000 · Transmission: $700–$2,500 · Alternator/Starter: $80–$250 · AC Compressor: $120–$350
  These are ballparks for popular models — adjust up for luxury/low-supply, down only for genuine damage ("Poor"). NEVER undercut the bottom of the band for a "Good" part.

NO INFERRED / GUESSED PARTS:
- Catalog ONLY what you can actually see in the photo. If a part is not visible, do NOT list it — never infer, guess, or assume.
- A photo of an engine bay shows the engine, transmission, and nearby parts. A side-profile photo shows body panels, glass, wheels, lights. Identify every distinct sellable part that is clearly visible — nothing more.
- NEVER list a part you cannot see, even if it "is typically present" on that vehicle. The seller has photos of what they want to sell; if they wanted a part listed, they would have photographed it.
- HARD RULE — the engine bay and interior must be VISIBLE in THIS photo:
  · NEVER report "Engine", "Transmission", "Radiator", "Alternator", "Starter", "Battery", "AC Compressor", "ABS Module", "Power Steering Pump", "Fuel Pump", "Driveshaft", or "Catalytic Converter" UNLESS the hood is OPEN and that exact component is directly visible in THIS photo.
  · NEVER report "Dashboard", "Instrument Cluster", "Center Console", "Steering Wheel", "Airbag", "Front Seat", "Rear Seat", "Door Panel", "Glove Box", or "Shifter" UNLESS the interior is actually visible in THIS photo.
  · An EXTERIOR shot (front, rear, side-profile, or three-quarter) with the hood CLOSED shows ONLY exterior body, glass, lights, and wheels — from such a photo you MUST return ZERO under-hood parts and ZERO interior parts.
  · Reporting an engine, transmission, or dashboard from a closed-hood or side-profile exterior photo is a HALLUCINATION and is strictly forbidden. When unsure whether the hood is open, assume it is closed and report nothing under it.

OUTPUT ORDER — return "parts" in a logical, scannable order so the seller never hunts for a part:
1. Group by area in this order: Front exterior → Doors/sides → Rear exterior → Glass → Lighting → Wheels/Tires → Mechanical → Interior.
2. Keep Left/Right pairs ADJACENT (e.g. Left Headlight immediately next to Right Headlight). Never scatter complementary parts.

LEFT / RIGHT SIDES — READ CAREFULLY (this is where mistakes happen):
1. "vehicleFront" — where is the FRONT of the car relative to the photo?
   - "toward-camera", "away-from-camera", "points-left", "points-right", or "unknown"
2. "imageSide" (per part) — purely WHERE the part appears in the photo frame from your point of view: "left", "right", or "center".
3. Put NO "left"/"right"/"driver"/"passenger" word in "partName" — the system adds the correct side itself from "imageSide". "front"/"rear" ARE allowed in the name (e.g. "Front Bumper Cover").
4. CENTER PARTS HAVE NO LEFT/RIGHT. These parts exist as a single centered unit and MUST use "imageSide": "center" — never left/right: Hood, Grille, Front Bumper Cover, Rear Bumper Cover, Roof Panel, Windshield, Back Glass, Trunk Lid, Tailgate, Liftgate, Radiator, Engine, Transmission, Dashboard, Center Console, Instrument Cluster, Steering Wheel, Battery, exhaust/muffler. A "Right Grille" or "Left Bumper Cover" is WRONG.
5. SIDE PARTS that genuinely come in a left and a right: Fender, Door, Quarter Panel, Side Mirror, Headlight Assembly, Tail Light Assembly, Fog Light, door Windows, Front Seat, wheels. These MUST carry a side — set "imageSide" to "left" or "right", NEVER "center". A door/mirror/fender/headlight always belongs to one side; pick the side you see. Result names must be specific like "Front Left Door", "Rear Right Door", "Left Side Mirror".
6. NO DUPLICATES / NO GENERICS: never output a bare "Door"/"Front Door"/"Rear Door"/"Mirror" without its side, and never list the same physical part twice (e.g. don't return both "Rear Door" and "Rear Right Door" — that's one part, "Rear Right Door"). Each side part appears at most once per side.
7. NEVER CONTRADICT YOURSELF: the side in the name MUST match what you wrote in "description"/"conditionNotes". If the description says "right (passenger side)", the side is RIGHT. If you truly can't tell the side of a side-part, still give your best single guess and set "confidence":"low" — do NOT fall back to a generic no-side name.

WHEEL & TIRE CONSISTENCY (one car = one wheel size):
- Every wheel on a single vehicle shares ONE rim diameter and ONE bolt pattern. NEVER report the left wheel as "18-inch" and the right wheel as "17-inch" — that is impossible on one car. Use the SAME diameter for every wheel and tire on this vehicle.
- A tire's size encodes its rim diameter: the trailing number in a tire size (e.g. 215/50R17 → 17-inch rim) MUST match the diameter you state for the wheels. Cross-check before you answer so the wheels and their tires never disagree.

CONDITION RUBRIC — grade each part as exactly "A", "B", or "C" (ARA-style), based solely on visible condition:
- A: ${CONDITION_RUBRIC.A.detail}
- B: ${CONDITION_RUBRIC.B.detail}
- C: ${CONDITION_RUBRIC.C.detail}
Pick the grade by visible wear and damage. When genuinely between two grades, choose the LOWER (more conservative) one.

DAMAGE CODE ("damageCode"): a short ARA-style code summarizing the worst visible damage, as TYPE-LOCATION-SIZE.
- TYPE: DT (dent), SC (scratch/scuff), CR (crack), BR (break/missing piece), RU (rust/corrosion), CH (chip), BN (bend), GL (glass damage), WR (general wear).
- LOCATION: a 1–2 letter spot like LF (left-front), RF, LR, RR, CT (center), TP (top), BT (bottom), or "" if not applicable.
- SIZE: approximate inches as a number, or "" if not measurable.
- Examples: "DT-LR-2" (2-inch dent, left-rear), "CR-CT-4", "SC-RF-1", "RU-BT-". For a clean Grade-A part with no notable damage, use "" (empty string).

CRITICAL RULES:
1. NEVER invent precise fitment, sides, VIN, mileage, or details you cannot actually see. Omit or use null/"center" instead of guessing.
2. Grade condition based ONLY on what is visible, as "A", "B", or "C", and set "damageCode" to match the worst visible damage (or "" if none).
3. Your "description" must describe ONLY what you can actually observe in this photo — no fabricated features, no contradictions with the part name.
4. If not highly confident, set "confidence" to "low".
5. Return ONLY the JSON object.`;

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
async function callGemini(base64: string, mime: string, userText: string): Promise<string | undefined> {
  const res = await geminiGenerate(GEMINI_MODEL, {
    system_instruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [
      { text: userText },
      { inline_data: { mime_type: mime, data: base64 } },
    ] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") || undefined : undefined;
}

const CLAUDE_MODELS: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

async function callAnthropic(base64: string, mime: string, userText: string, modelKey: string): Promise<string | undefined> {
  const model = CLAUDE_MODELS[modelKey];
  if (!model) throw new Error(`Unknown Anthropic model: ${modelKey}`);

  const res = await anthropicGenerate(model, VISION_SYSTEM_PROMPT, [
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
      ],
    },
  ]);
  const body = await res.text();
  if (!res.ok) {
    const short = body.slice(0, 300);
    if (res.status === 402 || res.status === 429) throw new Error(`Anthropic ${modelKey} billing/credit error ${res.status}: ${short}`);
    throw new Error(`Anthropic ${modelKey} ${res.status}: ${short}`);
  }
  const json = JSON.parse(body);
  let text = json.content?.[0]?.text;
  if (typeof text === "string") {
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  }
  return typeof text === "string" ? text : undefined;
}

// CORS — the native mobile app and the Chrome extension call this endpoint from
// origins that aren't ahlam.io, so browsers issue a preflight and enforce these
// headers. Allow the credentials-less Bearer-token flow the app uses.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function withCors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request): Promise<NextResponse<AIResult>> {
  return withCors(await handlePOST(req));
}

async function handlePOST(req: Request): Promise<NextResponse<AIResult>> {
  // Require authentication to prevent anonymous credit-burning. Accept either a
  // web session cookie OR a Bearer token (the native mobile app sends the latter,
  // since it has no cookies).
  const supabase = await (await import("@/lib/supabase-server")).supabaseServer();
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const auth = req.headers.get("authorization") || "";
    if (auth.startsWith("Bearer ")) {
      const { data } = await supabaseAdmin().auth.getUser(auth.slice(7));
      user = data.user;
    }
  }
  if (!user) {
    return NextResponse.json({ ok: false, userMessage: "Sign in required", internalError: "no auth" }, { status: 401 });
  }

  let body: { imageBase64?: string; imageUrl?: string; provider?: string; photoContext?: string; vin?: { make?: string; model?: string; year?: number } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(busyResult("bad request body"), { status: 400 });
  }

  const provider = body.provider ?? "gemini";

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
    let content: string | undefined;
    if (provider === "sonnet" || provider === "haiku") {
      content = await callAnthropic(rawBase64, mime, userText, provider);
    } else {
      content = await callGemini(rawBase64, mime, userText);
    }

    if (!content) {
      await alertTeam(`${provider} returned empty content`);
      return NextResponse.json(busyResult("empty completion"), { status: 503 });
    }

    type RawPart = Partial<AIPartOutput> & { imageSide?: ImageSide };
    const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
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
      // Center parts (hood, grille, bumper cover…) have no left/right — strip any
      // side word the model added and never apply one. Side parts keep theirs.
      const center = isCenterPart(p.partName ?? "");
      const baseName = stripSide((p.partName ?? "Unknown part").trim());
      let side = center ? null : lateralSide(vehicleFront, p.imageSide);
      // Side parts must stay sided even when vehicleFront is unknown — don't drop
      // to a generic name (that's what created "Rear Door" + "Rear Right Door").
      if (!center && !side && isLateralPart(baseName)) {
        if (p.imageSide === "left" || p.imageSide === "right") side = p.imageSide === "left" ? "Left" : "Right";
        else { const m = /\b(left|right)\b/i.exec(p.partName ?? ""); if (m) side = (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as "Left" | "Right"; }
      }
      const partName = applySide(baseName, side);

      const lowFields = new Set<keyof AIPartOutput>(p.lowConfidenceFields ?? []);
      const sideUnknown = !center && !side && isLateralPart(baseName);
      if (sideUnknown) lowFields.add("partName");

      const confidence: Confidence = sideUnknown ? "low" : p.confidence ?? "low";
      // Conservative grading: the model skews generous (review §3 #5). The top
      // "like new" grade is only credible when it's highly confident — otherwise
      // drop A→B so a part it isn't sure about never posts as flawless.
      let condition: ConditionGrade = ["A", "B", "C"].includes(p.condition ?? "") ? (p.condition as ConditionGrade) : "B";
      if (condition === "A" && confidence !== "high") { condition = "B"; lowFields.add("condition"); }

      return {
        partName,
        partCategory: p.partCategory ?? "Uncategorized",
        fitment: Array.isArray(p.fitment) ? p.fitment : [],
        condition,
        conditionNotes: p.conditionNotes ?? "",
        damageCode: typeof p.damageCode === "string" ? p.damageCode.slice(0, 16) : "",
        description: p.description ?? "",
        suggestedPriceUsd: typeof p.suggestedPriceUsd === "number" ? p.suggestedPriceUsd : null,
        confidence,
        lowConfidenceFields: Array.from(lowFields),
      };
    });

    // One car = one wheel size. The model occasionally reports a left wheel at a
    // different diameter than the right, or a tire whose rim contradicts the wheel.
    // Reconcile every wheel/tire to a single consensus diameter before pricing.
    reconcileWheelSpecs(data);

    // Live market pricing: when eBay is configured and we know the vehicle,
    // replace the model's guess with the median of real used comps (no undercut /
    // no exaggeration). Non-fatal — falls back to the model estimate.
    if (livePricingEnabled() && vehicle && (vehicle.make || vehicle.model)) {
      await Promise.all(data.map(async (p) => {
        try {
          const q = [vehicle.yearStart, vehicle.make, vehicle.model, p.partName].filter(Boolean).join(" ");
          const live = await livePartPrice(q);
          if (live && live > 0) {
            p.suggestedPriceUsd = live;
            p.pricingInsight = { suggestedPrice: live, priceRange: { min: live, max: live }, similarCount: 0 };
          }
        } catch { /* keep model estimate */ }
      }));
    }

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
    const isAnthropicCredit = /anthropic.*(402|billing|credit|insufficient|quota|limit)/i.test(msg);
    if (isAnthropicCredit) {
      return NextResponse.json({
        ok: false,
        userMessage: "Your Claude API account doesn't have enough credits. Add funds at https://console.anthropic.com/settings/billing then try again.",
        internalError: msg,
      }, { status: 402 });
    }
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

// --- Wheel/tire spec reconciliation -----------------------------------------
// A vehicle has exactly one rim diameter. The model sometimes returns "Left Wheel
// 18-inch" next to "Right Wheel 17-inch", or a tire whose molded rim size
// contradicts the wheel. We detect the diameter on each wheel/tire part, pick the
// consensus (tire markings win — they're authoritative), and rewrite the outliers.
const WHEEL_TIRE = /\b(wheel|rim|tire|tyre)\b/i;

// Realistic passenger/light-truck rim diameters; reject anything outside this band
// so a stray number (a price, a part count) can't masquerade as a diameter.
function clampDiameter(n: number): number | null {
  return Number.isInteger(n) && n >= 12 && n <= 26 ? n : null;
}

// Pull a rim diameter (in inches) out of free text. Tire size like "215/50R17"
// is checked first because its trailing number is the authoritative rim size.
function detectDiameter(text: string): number | null {
  const tire = /\b\d{3}\s*\/\s*\d{2}\s*[zr]?\s*(\d{2})\b/i.exec(text);
  if (tire) return clampDiameter(+tire[1]);
  const inch = /\b(\d{2})\s*(?:-|\s)?(?:inch(?:es)?|")/i.exec(text);
  if (inch) return clampDiameter(+inch[1]);
  const rcall = /\bR(\d{2})\b/.exec(text);
  if (rcall) return clampDiameter(+rcall[1]);
  return null;
}

// Rewrite the diameter call-outs in a WHEEL's text to the consensus value. We do
// not touch tire dimensions here (that would fabricate a tire size that may not
// exist) — conflicting tires are flagged for a human glance instead.
function swapWheelDiameter(text: string, to: number): string {
  return text
    .replace(/\b\d{2}(\s*(?:-|\s)?(?:inch(?:es)?|"))/gi, (_m, tail) => `${to}${tail}`)
    .replace(/\bR\d{2}\b/g, `R${to}`);
}

function reconcileWheelSpecs(parts: AIPartOutput[]): void {
  const items = parts
    .filter((p) => WHEEL_TIRE.test(p.partName))
    .map((p) => ({
      p,
      isTire: /\b(tire|tyre)\b/i.test(p.partName),
      dia: detectDiameter(`${p.partName} ${p.description} ${p.conditionNotes}`),
    }))
    .filter((w): w is { p: AIPartOutput; isTire: boolean; dia: number } => w.dia !== null);

  // Nothing to reconcile unless ≥2 wheel/tire parts disagree on diameter.
  if (items.length < 2 || new Set(items.map((w) => w.dia)).size < 2) return;

  // Consensus diameter: weight tires double (their molded size is authoritative);
  // break remaining ties toward the larger diameter.
  const weight = new Map<number, number>();
  for (const w of items) weight.set(w.dia, (weight.get(w.dia) ?? 0) + (w.isTire ? 2 : 1));
  const consensus = [...weight.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];

  for (const w of items) {
    if (w.dia === consensus) continue;
    if (w.isTire) {
      const note = `Listed elsewhere on this vehicle as a ${consensus}" rim — verify this tire's size before posting.`;
      w.p.conditionNotes = w.p.conditionNotes ? `${w.p.conditionNotes} ${note}` : note;
    } else {
      w.p.description = swapWheelDiameter(w.p.description, consensus);
      w.p.conditionNotes = swapWheelDiameter(w.p.conditionNotes, consensus);
    }
    w.p.confidence = "low";
    const lf = new Set<keyof AIPartOutput>(w.p.lowConfidenceFields ?? []);
    lf.add("description");
    w.p.lowConfidenceFields = Array.from(lf);
  }
}

// Single, centered parts that physically have no left/right variant.
const CENTER_PART = /\b(hood|bonnet|grille|grill|bumper|roof|windshield|windscreen|back ?glass|rear ?glass|trunk ?lid|tailgate|liftgate|deck ?lid|radiator|engine|transmission|gearbox|torque converter|driveshaft|drive shaft|dash(board)?|center console|instrument cluster|steering wheel|battery|alternator|starter|abs module|abs unit|ac compressor|a\/c compressor|power steering pump|fuel pump|intercooler|turbo(charger)?|supercharger|serpentine belt|timing belt|timing chain|throttle body|mass airflow sensor|maf sensor|exhaust|muffler|catalytic|converter|oxygen sensor|o2 sensor|ignition coil|spark plug|distributor|ecm|ecu|pcm|wiring harness|fuse box|relay|heater core|blower motor|condenser|evaporator|motor mount|transmission mount|clutch|flywheel|differential|transfer case|valve cover|oil pan|intake manifold|exhaust manifold|water pump|thermostat|radiator fan|cooling fan|fan clutch)\b/i;
function isCenterPart(name: string): boolean {
  return CENTER_PART.test(name) && !LATERAL_PART.test(name);
}

// Remove a stray left/right/driver/passenger word the model put in a part name.
function stripSide(name: string): string {
  return name
    .replace(/\b(driver'?s?|passenger'?s?)([ -]side)?\b/gi, "")
    .replace(/\b(left|right|lh|rh)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const from = process.env.WAITLIST_FROM_EMAIL ?? user;
  const to = process.env.ALERT_EMAIL;
  if (!user || !pass || !to) {
    console.error("[ALERT] (email not configured):", detail);
    return;
  }
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transport.sendMail({
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
