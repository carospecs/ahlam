import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { groundedMedianPrice, ebayCompStats, applyCondition, CONDITION_MULTIPLIER, partSearchPhrase } from "@/lib/pricing";
import { floorPrice, bandsPromptBlock } from "@/lib/price-bands";
import { loadSoldListings, ownSoldComps, type SoldRow } from "@/lib/own-comps";
import { getCachedPrice, setCachedPrice } from "@/lib/price-cache";
import { geminiGenerate } from "@/lib/gemini";
import { decodeVin, normalizeVin } from "@/lib/vin";

export const runtime = "nodejs";
// Up to 50 parts × a grounded sold-price search each (in bounded batches) can run
// well past the old 60s cap, so give the function more headroom.
export const maxDuration = 300;

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
  // Which rung of the pricing ladder produced this price (best → fallback):
  // "shop" = the shop's own past sold comps (strongest), "grounded" = live grounded
  // sold-price web search, "ebay" = live eBay listing median, "asking" = discounted
  // active asking prices, "model" = AI estimate clamped to the sold-price bands.
  source?: "shop" | "grounded" | "ebay" | "asking" | "model";
  // How trustworthy the price is, derived from the rung: real sold data is high,
  // discounted asking is medium, the band/model estimate is low. Surfaced in the UI.
  confidence?: "high" | "medium" | "low";
  // The raw eBay listing median (pre-condition) + range, when priced off eBay — so
  // the UI can show the seller "selling on eBay for ~$X across N listings".
  ebayMedian?: number;
  ebayRange?: { min: number; max: number };
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
  // Set for parts whose resale is legally restricted (airbags/SRS, catalytic
  // converters, seat-belt restraints). The UI shows a warning in place of a
  // naked price so the seller confirms compliance before listing. (AHLAM-54)
  compliance?: ComplianceFlag;
}

export interface ComplianceFlag {
  level: "restricted";
  // Short label for a badge, e.g. "Restricted: airbag".
  label: string;
  // One-line explanation of why it's restricted and what to verify.
  reason: string;
}

export interface VehicleEstimate {
  vin: string | null;
  make: string | null;
  model: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  bodyStyle: string | null;
  mileage: string | null;
  suggestedWholeCarPriceUsd: number | null;
  confidence: Confidence;
  // Populated from the VIN decode (NHTSA) when a VIN is read/confirmed.
  trim?: string | null;
  engine?: string | null;
  drivetrain?: string | null;
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
    "vin": string | null,
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
- Return one array element per part. Return up to 50 of the clearly-visible, sellable parts (most photos have far fewer — that is just the ceiling, never a target).
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
- VIN — THIS IS HIGH PRIORITY. Scan the photo for a VIN and READ IT if one is legible anywhere: the windshield VIN plate (driver-side base of the windshield), the driver door-jamb sticker, the firewall/engine-bay label, the dashboard, or any paperwork in frame. A VIN is exactly 17 characters, capital letters and digits only, and never contains the letters I, O, or Q. Transcribe all 17 characters CAREFULLY, character by character, and return it in "vin". If no VIN is legible, set "vin" to null — NEVER invent or guess a VIN, and never partially fill one.
- If you read a VIN, USE IT: it tells you the exact make, model, and model year — set yearStart and yearEnd to that EXACT same year (not a range) — and the engine/drivetrain, which determines which parts the car has and what they interchange with. Trust the VIN over a visual guess.
- ALWAYS COMMIT TO A SINGLE MODEL YEAR. Set yearStart === yearEnd to your one best-estimate model year. Do NOT return a multi-year span like 2016–2025 — that is a generation, not an answer. From the VIN (exact), or failing that the body style, headlights/taillights, grille, wheels, badging and trim cues, identify the specific generation and pick the single most-likely year within it. If you must, give your best single guess and lower "confidence" — but never output a range. A salvage buyer needs the exact year for fitment.
- If you can identify the source vehicle, fill in make/model/year/bodyStyle from what you actually see.
- "mileage": ONLY if this photo clearly shows an odometer / instrument cluster with a readable mileage number, return it as a string (e.g. "112,480 mi"). Otherwise null. Never guess mileage.
- "suggestedWholeCarPriceUsd": your best estimate of the fair market price (USD) for the COMPLETE vehicle in average used/salvage condition, as a single whole car. This is a standalone market value — it is NOT the sum of the parts. If you cannot estimate it, use null.
- If you are unsure of any field, set it to null and lower "confidence".

PRICING GUIDANCE (applies to both "suggestedWholeCarPriceUsd" and each part's "suggestedPriceUsd"):
- Price at the MIDDLE of the real used-market range — the AVERAGE of what comparable items actually sell for on Facebook Marketplace, Craigslist, OfferUp, eBay sold listings, and Google Shopping for the same make/model/year and condition. Aim for fair market value, NOT a quick-sale lowball.
- DO NOT UNDERCUT. If a "Good" used part typically sells for $600–$1000, price it around the middle (~$800), never below the bottom of that range. Sellers can always lower it; starting too low leaves money on the table.
- Use the part's full OEM fitment (make/model/year/trim) when judging comps — a popular late-model part holds strong value.
- "Good" condition = mid-to-upper market range; a DAMAGED / Grade-C part = priced as a core/repairable, CLEARLY below the good-used price for that same part (roughly half), never near or above it. Two of the same part on one car (e.g. a left and right door) are worth the same when condition is equal — only real damage should make one cheaper than the other.
- For the whole car: think used-car comps for that year/make/model/mileage and trim, at typical private-party value (only discount for genuine salvage/parts-car condition).
- Use realistic round numbers. If you genuinely have no basis for a price, use null rather than guessing — but prefer a market-based estimate.
- ${bandsPromptBlock()}
  (Left & right of a paired part are usually within ~20% of each other — don't price them wildly differently. Wheel/Rim and Tire are priced each.)

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
- COLLISION / STRUCTURAL DAMAGE IS ALWAYS GRADE C. If a part is crumpled, caved-in, bent, torn, cracked, has a deep dent, broken/missing mounting points, or shattered/spidered glass, it is a damaged repairable CORE — grade it "C", never "A" or "B". A clearly wrecked part is the CHEAPEST version of that part on the car, not a premium one. Inspect each part for collision damage specifically before grading.

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

  let body: { imageBase64?: string; imageUrl?: string; photoContext?: string; vin?: { make?: string; model?: string; year?: number } };
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
    const content = await callGemini(rawBase64, mime, userText);

    if (!content) {
      await alertTeam("Gemini returned empty content");
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
          vin: normalizeVin((v as { vin?: string }).vin),
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

    // VIN authority: a VIN read off the photo is the single source of truth for
    // the vehicle's identity. Decode it via NHTSA and LOCK make/model/exact year
    // to the decode — overriding the model's visual guess and any wide year range
    // (the "2015–2025" problem). NHTSA is deterministic per VIN, so repeat scans
    // of the same car now agree on identity.
    if (vehicle?.vin) {
      const decoded = await decodeVin(vehicle.vin);
      if (decoded) {
        vehicle.vin = decoded.vin;
        if (decoded.make) vehicle.make = decoded.make;
        if (decoded.model) vehicle.model = decoded.model;
        if (decoded.year) { vehicle.yearStart = decoded.year; vehicle.yearEnd = decoded.year; }
        if (decoded.bodyClass && !vehicle.bodyStyle) vehicle.bodyStyle = decoded.bodyClass;
        vehicle.trim = decoded.trim || decoded.series || null;
        const disp = decoded.displacementL || (decoded.displacement ? (Number(decoded.displacement) / 1000).toFixed(1) : null);
        vehicle.engine = [disp ? `${disp}L` : null, decoded.engineCylinders ? `${decoded.engineCylinders}-cyl` : null, decoded.engine].filter(Boolean).join(" ") || null;
        vehicle.drivetrain = decoded.driveType || null;
        vehicle.confidence = "high"; // identity is now VIN-confirmed, not guessed
      } else {
        vehicle.vin = null; // misread / not in NHTSA — don't surface a bogus VIN
      }
    }
    // Client-supplied decode (user scanned/typed the VIN before uploading): trust
    // its exact year/make/model the same way, even when no VIN was visible in frame.
    if (vehicle && !vehicle.vin && body.vin) {
      if (body.vin.make) vehicle.make = body.vin.make;
      if (body.vin.model) vehicle.model = body.vin.model;
      if (typeof body.vin.year === "number") { vehicle.yearStart = body.vin.year; vehicle.yearEnd = body.vin.year; }
    }
    const rawParts: RawPart[] = Array.isArray(parsed.parts) ? parsed.parts : parsed.partName ? [parsed] : [];

    const assembled: AIPartOutput[] = rawParts.map((p) => {
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
        compliance: complianceFor(partName),
      };
    });

    // Remove the model's duplicate emissions (generic "Front Door" alongside
    // "Front Left/Right Door", exact-name repeats) before pricing so phantoms
    // neither cost a pricing call nor double-list a physical part. (AHLAM-52)
    const data: AIPartOutput[] = dedupeParts(assembled);

    // One car = one wheel size. The model occasionally reports a left wheel at a
    // different diameter than the right, or a tire whose rim contradicts the wheel.
    // Reconcile every wheel/tire to a single consensus diameter before pricing.
    reconcileWheelSpecs(data);

    // ── PRICING PIPELINE ───────────────────────────────────────────────────
    // Resolve each PART price through a layered waterfall. Whole-car pricing
    // (vehicle.suggestedWholeCarPriceUsd) stays Layer 2 only — the model is the
    // sole source there, as it has no per-part comps.
    //
    //   Layer 1  Sold-price bands, recalibrated periodically from scraped eBay
    //            SOLD listings (scripts/recalibrate-bands.mjs). Baked into the
    //            clamp below and into the model's prompt.
    //   Layer 2  AI model estimate, clamped into those bands. The always-present
    //            baseline and the price when the live layer finds nothing.
    //   Layer 3  Live SOLD signal, in priority order per part:
    //              (a) the SHOP'S OWN past sold prices — strongest, proprietary;
    //              (b) a grounded sold-price web search (Gemini), cached so repeat
    //                  lookups are free + stable.
    //            Overrides L2 when a reliable number is found. (We don't fetch eBay
    //            sold comps per-request: the Insights API is closed and scraping is
    //            blocked from serverless — that signal lives in the Layer 1 bands.)
    //
    // The bands floor every part (Layer 2 clamp) so nothing posts below market.

    // Ladder rung 4 (last-resort floor): clamp the model's per-part estimate into
    // its band and seed the pricingInsight, so every part carries a price + low
    // confidence even if the higher rungs bail. (The model estimate is already
    // condition-aware, so it is NOT re-multiplied by the grade below.)
    for (const p of data) {
      // floorPrice guarantees a positive, band-sane number even when the model
      // returned null/0 or the part type has no band — so no part is ever seeded
      // (and ultimately posted) at $0 (AHLAM-51). The insight is always defined.
      p.suggestedPriceUsd = floorPrice(p.suggestedPriceUsd, p.partName);
      p.pricingInsight = { suggestedPrice: p.suggestedPriceUsd, priceRange: { min: p.suggestedPriceUsd, max: p.suggestedPriceUsd }, similarCount: 0, source: "model", confidence: "low" };
    }

    // Load the shop's own SOLD listings once (its strongest comp), so per-part
    // matching below is in-memory rather than a query per part.
    let soldRows: SoldRow[] = [];
    try {
      const { data: profile } = await supabaseAdmin().from("profiles").select("shop_id").eq("id", user.id).single();
      if (profile?.shop_id) soldRows = await loadSoldListings(profile.shop_id as string);
    } catch { /* no own comps — fall back to grounded */ }

    // Pricing ladder: per part, walk best → fallback and stop at the first rung
    // with real data, so a part almost always lands on a real-data rung and the
    // rest are honestly marked low confidence (never a silent "no comps"):
    //   (1) shop's own sold comps   → high   (2) grounded sold-price search → high
    //   (3) discounted active asking → medium (4) band/model estimate (seeded) → low
    // Market rungs (1–3) are condition-adjusted to the part's A/B/C grade. Runs in
    // bounded batches so up to 50 parts don't trip Gemini/eBay rate limits.
    if (vehicle && (vehicle.make || vehicle.model)) {
      const GROUNDED_CONCURRENCY = 6;
      for (let i = 0; i < data.length; i += GROUNDED_CONCURRENCY) {
        const batch = data.slice(i, i + GROUNDED_CONCURRENCY);
        await Promise.all(batch.map(async (p) => {
          const grade: ConditionGrade = (["A", "B", "C"] as const).includes(p.condition) ? p.condition : "B";
          // A market comp reflects ~good (Grade B) condition; adjust to this part's grade.
          const setMarket = (
            raw: number,
            source: "shop" | "grounded" | "ebay" | "asking",
            confidence: "high" | "medium",
            range?: { min: number; max: number },
            count = 0,
            ebay?: { median: number; range: { min: number; max: number } },
          ) => {
            const adj = applyCondition(raw, grade);
            p.suggestedPriceUsd = adj;
            p.pricingInsight = {
              suggestedPrice: adj,
              priceRange: range ? { min: applyCondition(range.min, grade), max: applyCondition(range.max, grade) } : { min: adj, max: adj },
              similarCount: count,
              source,
              confidence,
              ...(ebay ? { ebayMedian: ebay.median, ebayRange: ebay.range } : {}),
            };
          };

          // (1) Shop's own sold comps — real money real buyers paid this shop.
          const own = ownSoldComps(soldRows, p.partName);
          if (own) { setMarket(own.median, "shop", "high", { min: own.min, max: own.max }, own.count); return; }

          const q = [vehicle.yearStart, vehicle.make, vehicle.model, partSearchPhrase(p.partName)].filter(Boolean).join(" ");

          // (2) Live eBay listings — real market MEDIAN (not discounted) plus the
          // listing count + range, so the seller sees what comparable parts are
          // actually going for on eBay right now. Price is the median, condition-
          // adjusted; the raw median rides along for the "selling on eBay" note.
          try {
            const eb = await ebayCompStats(q, p.partName);
            if (eb) {
              setMarket(eb.median, "ebay", eb.count >= 8 ? "high" : "medium", { min: eb.min, max: eb.max }, eb.count, { median: eb.median, range: { min: eb.min, max: eb.max } });
              return;
            }
          } catch { /* fall to the next rung */ }

          // (3) Grounded sold-price web search, cache-first (free + stable on repeat).
          try {
            let grounded = await getCachedPrice(q);
            if (grounded == null) {
              grounded = await groundedMedianPrice(q, p.partName);
              if (grounded && grounded > 0) void setCachedPrice(q, grounded, "grounded"); // fire-and-forget
            }
            if (grounded && grounded > 0) { setMarket(grounded, "grounded", "high"); return; }
          } catch { /* fall to the band estimate */ }

          // (4) else: keep the Layer-2 band/model estimate (already seeded, low confidence).
        }));
      }
    }

    // Same-type parts on ONE car share a single pre-condition market value, so
    // CONDITION — not comp-search noise — must drive the spread between them.
    // (Fixes the crashed-door-$407 / good-door-$207 inversion.)
    reconcileSameTypePrices(data);

    // Whole-car price consistency: the model's whole-car estimate drifts wildly
    // run-to-run ($5.5k one scan, $17.5k the next on the same car). Anchor it to a
    // per-vehicle cache keyed by identity — VIN when known (most stable), else
    // year+make+model — so a repeat scan of the SAME car returns the SAME number.
    if (vehicle && (vehicle.make || vehicle.model)) {
      const idKey = `wholecar ${vehicle.vin || [vehicle.yearStart, vehicle.make, vehicle.model].filter(Boolean).join(" ")}`;
      try {
        const cached = await getCachedPrice(idKey);
        if (cached && cached > 0) {
          vehicle.suggestedWholeCarPriceUsd = cached;
        } else if (vehicle.suggestedWholeCarPriceUsd && vehicle.suggestedWholeCarPriceUsd > 0) {
          // Fire-and-forget — don't make the user wait on the cache write.
          void setCachedPrice(idKey, vehicle.suggestedWholeCarPriceUsd, "model");
        }
      } catch { /* cache is best-effort — fall back to the live estimate */ }
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

// Parts whose used resale is legally restricted in the U.S. Flag them so the UI
// warns the seller instead of presenting a naked price (AHLAM-54). Ordered
// most-specific-first; "cataly" stem avoids matching "torque converter".
const COMPLIANCE_RULES: { re: RegExp; label: string; reason: string }[] = [
  {
    re: /\bair\s?bag\b|\bsrs\b|\binflator\b/i,
    label: "Restricted: airbag",
    reason: "Used airbags/SRS parts are restricted or illegal to resell in many U.S. states, and recalled Takata inflators are banned outright. Verify local law and recall status before listing.",
  },
  {
    re: /\bcataly(tic|st)\b|\bcatalytic\s?converter\b|\bcat\s?converter\b/i,
    label: "Restricted: catalytic converter",
    reason: "Used catalytic converters may only be resold for road use under EPA rules (testing/labeling required) and resale is restricted in many states. Confirm compliance or list as scrap/core only.",
  },
  {
    re: /\bseat\s?belt\b|\bpretensioner\b|\brestraint\b/i,
    label: "Restricted: restraint",
    reason: "Seat belts and pretensioners are pyrotechnic safety-restraint parts; used resale is restricted in many states. Verify condition (not deployed) and local law before listing.",
  },
];

// Return the compliance flag for a restricted part name, or undefined.
function complianceFor(partName: string): ComplianceFlag | undefined {
  for (const r of COMPLIANCE_RULES) {
    if (r.re.test(partName)) return { level: "restricted", label: r.label, reason: r.reason };
  }
  return undefined;
}

// A part name is "sided" when stripping the side word actually changes it
// (i.e. it contains left/right/driver/passenger). Generic names are unchanged.
function isSidedName(name: string): boolean {
  return stripSide(name).trim().toLowerCase() !== name.trim().toLowerCase();
}

// Collapse the model's duplicate emissions (AHLAM-52). Two patterns are removed:
//   (a) a generic, unsided lateral part ("Front Door", "Side Mirror") when a
//       sided sibling of the same base exists ("Front Left/Right Door") — the
//       generic is a phantom that double-lists a physical part already covered;
//   (b) exact-duplicate final names — keep the single best-scored entry.
// Original order is preserved; only the redundant entries are dropped.
function dedupeParts(parts: AIPartOutput[]): AIPartOutput[] {
  const base = (p: AIPartOutput) => stripSide(p.partName).toLowerCase().trim();
  const score = (p: AIPartOutput) => {
    const c = p.confidence === "high" ? 2 : p.confidence === "medium" ? 1 : 0;
    return c * 100 + (p.suggestedPriceUsd ? 10 : 0) + (p.description ? p.description.length > 0 ? 1 : 0 : 0);
  };
  const drop = new Set<AIPartOutput>();

  // (a) Generic-vs-sided: within each base group, if any entry is sided and the
  // type is lateral, the unsided entries are phantoms — drop them.
  const groups = new Map<string, AIPartOutput[]>();
  for (const p of parts) {
    const b = base(p);
    const g = groups.get(b) ?? [];
    g.push(p);
    groups.set(b, g);
  }
  for (const [b, g] of groups) {
    if (isLateralPart(b) && g.some((p) => isSidedName(p.partName))) {
      for (const p of g) if (!isSidedName(p.partName)) drop.add(p);
    }
  }

  // (b) Exact-name duplicates among the survivors: keep the highest-scored.
  const byName = new Map<string, AIPartOutput>();
  for (const p of parts) {
    if (drop.has(p)) continue;
    const key = p.partName.toLowerCase().trim();
    const cur = byName.get(key);
    if (!cur) byName.set(key, p);
    else if (score(p) > score(cur)) { drop.add(cur); byName.set(key, p); }
    else drop.add(p);
  }

  return parts.filter((p) => !drop.has(p));
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

// Normalize the prices of same-type parts (e.g. left + right "Front Door") to ONE
// market base, then re-apply each part's condition grade — so condition, not the
// per-part comp search's run-to-run variance, decides the spread. Without this a
// damaged door could out-price a clean one when their independent comp lookups
// landed at different numbers. The clean, real-comp parts define the base; the
// damaged ones come out as a proper discount off it.
function reconcileSameTypePrices(parts: AIPartOutput[]): void {
  const gradeOf = (p: AIPartOutput): "A" | "B" | "C" =>
    (["A", "B", "C"] as const).includes(p.condition) ? (p.condition as "A" | "B" | "C") : "B";
  const baseOf = (p: AIPartOutput): number | null => {
    const m = CONDITION_MULTIPLIER[gradeOf(p)] ?? 1;
    return p.suggestedPriceUsd && m ? p.suggestedPriceUsd / m : null;
  };
  const isRealData = (p: AIPartOutput): boolean => {
    const s = p.pricingInsight?.source;
    return s === "shop" || s === "grounded" || s === "asking";
  };
  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const groups = new Map<string, AIPartOutput[]>();
  for (const p of parts) {
    const key = stripSide(p.partName).toLowerCase().trim();
    const g = groups.get(key);
    if (g) g.push(p); else groups.set(key, [p]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Pick the cleanest signal for the shared base: prefer undamaged parts backed
    // by real comps, then any undamaged part, then any real-comp part, then all.
    const tiers: AIPartOutput[][] = [
      group.filter((p) => gradeOf(p) !== "C" && isRealData(p)),
      group.filter((p) => gradeOf(p) !== "C"),
      group.filter((p) => isRealData(p)),
      group,
    ];
    const ref = tiers.find((t) => t.some((p) => baseOf(p) != null)) ?? group;
    const bases = ref.map(baseOf).filter((b): b is number => typeof b === "number" && b > 0);
    if (!bases.length) continue;
    const base = median(bases);

    for (const p of group) {
      const priced = applyCondition(base, gradeOf(p));
      if (priced <= 0) continue;
      p.suggestedPriceUsd = priced;
      if (p.pricingInsight) {
        p.pricingInsight.suggestedPrice = priced;
        p.pricingInsight.priceRange = { min: priced, max: priced };
      }
    }
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
