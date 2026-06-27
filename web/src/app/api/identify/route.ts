import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { vehicleAge, ageFactor, usedPriceFromNew } from "@/lib/age-pricing";
import { geminiGenerate } from "@/lib/gemini";
import { decodeVin, normalizeVin, type VinInfo } from "@/lib/vin";
import { checkUsage, recordUsage, limitMessage } from "@/lib/usage";

export const runtime = "nodejs";
// Pricing is now a local formula (no per-part web/eBay lookups), so the request is
// just the single vision call. The headroom mainly covers a large multi-part photo.
export const maxDuration = 120;

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
  // How the price was produced. "formula" = the deterministic age × condition
  // model (current). The legacy comp-ladder rungs are kept in the union so any
  // older persisted rows still type-check.
  source?: "formula" | "shop" | "grounded" | "ebay" | "asking" | "model";
  // Confidence in the estimate. Mirrors the part's vision confidence; "low" when
  // the model year was unknown (age, and therefore depreciation, is a guess).
  confidence?: "high" | "medium" | "low";
  // Transparency breakdown for the UI: the brand-new base price and the two
  // multipliers that produced suggestedPrice (newPartPrice × ageFactor × condition).
  newPartPrice?: number | null;
  ageFactor?: number;
  conditionFactor?: number;
  // Legacy eBay comp fields — no longer populated, retained for old persisted rows.
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
  // The part's estimated BRAND-NEW (OEM/retail) price from the vision model — the
  // base the age × condition formula discounts into suggestedPriceUsd.
  newPartPriceUsd: number | null;
  // Final used price, computed server-side from newPartPriceUsd, vehicle age, and
  // condition grade. (The model never sets this directly.)
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
  // The vehicle's original NEW price (MSRP) from the vision model — the base the
  // age factor discounts into suggestedWholeCarPriceUsd.
  newWholeCarPriceUsd: number | null;
  // Final whole-car used estimate, computed server-side as newWholeCarPriceUsd ×
  // ageFactor(age).
  suggestedWholeCarPriceUsd: number | null;
  confidence: Confidence;
  // Populated from the VIN decode (NHTSA) when a VIN is read/confirmed.
  trim?: string | null;
  engine?: string | null;
  drivetrain?: string | null;
  vinInfo?: VinInfo | null; // full decode for the seller-facing VIN details section
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
    "newWholeCarPriceUsd": number | null,
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
      "newPartPriceUsd": number | null,
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
- "newWholeCarPriceUsd": the vehicle's ORIGINAL price BRAND NEW (its MSRP / sticker price when it was first sold), in USD — NOT its current used value. Base it on the make/model/year/trim you identified. If you cannot estimate it, use null. (The system applies depreciation from the vehicle's age automatically — do not pre-depreciate it yourself.)
- If you are unsure of any field, set it to null and lower "confidence".

PRICING — report each part's NEW price, not its used price:
- "newPartPriceUsd": the approximate price of THIS part BRAND NEW — what a new OEM (or quality aftermarket) replacement of the same part for this make/model/year/trim costs at retail today. This is the NEW/retail price, NOT a used or salvage price.
- The system computes the used resale price itself by discounting your new price for the vehicle's age and the part's condition grade — so do NOT discount for wear, damage, or age yourself. Report the new-replacement price and let the condition grade (A/B/C) you already assigned carry the wear.
- Judge the new price from the part's full OEM fitment (make/model/year/trim): a part for a luxury or low-supply vehicle costs more new; a common economy-car part costs less.
- Left & right of a paired part have the SAME new price — don't differ them. "Wheel / Rim" and "Tire" each get their own new price.
- Use realistic round numbers. If you genuinely have no basis for a new price, use null rather than guessing.

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
2. Keep driver/passenger pairs ADJACENT (e.g. the driver-side headlight immediately next to the passenger-side headlight). Never scatter complementary parts.

LEFT / RIGHT SIDES — READ CAREFULLY (this is where mistakes happen):
1. "vehicleFront" — where is the FRONT of the car pointing relative to the photo? This is the MOST IMPORTANT field for correct labeling — get this wrong and every side gets flipped.
   - "toward-camera" = car faces YOU (you see the front grille/headlights)
   - "away-from-camera" = car faces AWAY (you see the trunk/taillights)
   - "points-left" = car's front points to the LEFT side of the image (side profile, nose left)
   - "points-right" = car's front points to the RIGHT side of the image (side profile, nose right)
   - "unknown" = only when you truly cannot determine orientation
   HOW THE SYSTEM USES THIS: when the car faces toward you, the driver's side (LEFT of the vehicle) appears on the RIGHT side of the image — the system automatically flips imageSide to get the correct vehicle side. So report vehicleFront accurately and report imageSide as literally where the part appears in the photo frame — the system handles the rest.
   DRIVER SIDE = LEFT side of the vehicle (as the driver sits in the car). PASSENGER SIDE = RIGHT side of the vehicle. In the US, the driver sits on the LEFT.
2. "imageSide" (per part) — purely WHERE the part appears in the photo frame from your point of view: "left", "right", or "center". NOT the vehicle's left/right — just the image frame.
3. Put NO "left"/"right"/"driver"/"passenger" word in "partName" — the system adds the correct side itself from "imageSide". "front"/"rear" ARE allowed in the name (e.g. "Front Bumper Cover").
4. CENTER PARTS HAVE NO LEFT/RIGHT. These parts exist as a single centered unit and MUST use "imageSide": "center" — never left/right: Hood, Grille, Front Bumper Cover, Rear Bumper Cover, Roof Panel, Windshield, Back Glass, Trunk Lid, Tailgate, Liftgate, Radiator, Engine, Transmission, Dashboard, Center Console, Instrument Cluster, Steering Wheel, Battery, exhaust/muffler. A "Right Grille" or "Left Bumper Cover" is WRONG.
5. SIDE PARTS that genuinely come in a left and a right: Fender, Door, Quarter Panel, Side Mirror, Headlight Assembly, Tail Light Assembly, Fog Light, door Windows, Front Seat, wheels. These MUST carry a side — set "imageSide" to "left" or "right", NEVER "center". A door/mirror/fender/headlight always belongs to one side; pick the side you see. The system turns your "imageSide" into the vehicle side and names the part accordingly — e.g. "Driver Side Front Door", "Passenger Side Rear Door", "Driver Side Mirror".
6. NO DUPLICATES / NO GENERICS: never output a bare "Door"/"Front Door"/"Rear Door"/"Mirror" without its side, and never list the same physical part twice (e.g. don't return both "Rear Door" and "Rear Right Door" — that's one part, "Rear Right Door"). Each side part appears at most once per side.
7. NEVER CONTRADICT YOURSELF: the side you describe MUST match the part's actual side. In "description"/"conditionNotes", name a part's side as "driver side" or "passenger side" (US convention: driver = LEFT of the vehicle, passenger = RIGHT) — do NOT use bare "left"/"right" for a part's side. If you truly can't tell the side of a side-part, still give your best single guess and set "confidence":"low" — do NOT fall back to a generic no-side name.
8. DOOR COMPONENTS — match the door: a door's window, glass, and door panel MUST carry the SAME position (front/rear) AND side as the door they belong to, so the system can name them "Driver Side Front Door Window", "Driver Side Front Door Panel", "Passenger Side Rear Door Window". NEVER report a bare "Door Panel" or "Door Window" without its front/rear position. The same applies to "front"/"rear": if it's the front door's panel, it is the "Front" door panel.

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

// NHTSA doesn't carry Toyota/most marketing trims (it returns a platform "Series"
// like "40 Series"). Scan the web with Gemini's grounded search for the real trim
// of THIS exact VIN — auction (Copart/IAAI), dealer, and classified listings state
// it. Best-effort: returns null (no guess) unless it can confirm one.
async function vinTrimLookup(vin: string, label: string): Promise<string | null> {
  try {
    const res = await geminiGenerate("gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text:
        `What is the factory trim / grade of the vehicle with VIN ${vin} (${label})? ` +
        `Search the web — salvage auction listings (Copart, IAAI, bidexport), dealer and classified listings usually state it. ` +
        `Reply with ONLY the trim name, e.g. "SR", "SR5", "TRD Sport", "TRD Off-Road", "Limited", "Platinum". ` +
        `If you cannot confirm the trim for THIS exact VIN, reply exactly "UNKNOWN" — never guess.` }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text ?? "").join("").trim();
    if (!text || /unknown/i.test(text)) return null;
    const trim = text.replace(/["'.\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    return trim || null;
  } catch { return null; }
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

  // Plan usage gate: the Solo plan caps AI scans per month. Resolve the shop +
  // plan and block when over quota. Fail-open (allows the scan) if usage isn't
  // migrated yet or the lookup errors.
  let scanShopId: string | null = null;
  try {
    const udb = supabaseAdmin();
    const { data: prof } = await udb.from("profiles").select("shop_id").eq("id", user.id).single();
    scanShopId = (prof?.shop_id as string) || null;
    if (scanShopId) {
      const { data: shopRow } = await udb.from("shops").select("plan").eq("id", scanShopId).single();
      const usage = await checkUsage(udb, scanShopId, (shopRow?.plan as string) || null, "scan");
      if (!usage.allowed) {
        return NextResponse.json(
          { ok: false, userMessage: limitMessage("scan", usage.limit ?? 0), internalError: "scan quota exceeded" },
          { status: 402 },
        );
      }
    }
  } catch { /* fail-open: never block a scan on a usage-lookup error */ }

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
          newWholeCarPriceUsd: typeof v.newWholeCarPriceUsd === "number" ? v.newWholeCarPriceUsd : null,
          suggestedWholeCarPriceUsd: null, // computed from age below
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
        // NHTSA "Series" (e.g. "40 Series") is a platform code, not the marketing
        // trim — use the real Trim field, else scan the web for it.
        vehicle.trim = decoded.trim || await vinTrimLookup(decoded.vin, [decoded.year, decoded.make, decoded.model].filter(Boolean).join(" ")) || null;
        const disp = decoded.displacementL || (decoded.displacement ? (Number(decoded.displacement) / 1000).toFixed(1) : null);
        vehicle.engine = [disp ? `${disp}L` : null, decoded.engineCylinders ? `${decoded.engineCylinders}-cyl` : null, decoded.engine].filter(Boolean).join(" ") || null;
        vehicle.drivetrain = decoded.driveType || null;
        const { raw: _raw, ...info } = decoded; // strip the bulky raw map
        vehicle.vinInfo = { ...info, trim: vehicle.trim }; // include the resolved (looked-up) trim
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
        newPartPriceUsd: typeof p.newPartPriceUsd === "number" ? p.newPartPriceUsd : null,
        suggestedPriceUsd: null, // computed from new price × age × condition below
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

    // ── VIN ENRICHMENT ───────────────────────────────────────────────────────
    // When a VIN was decoded, we know the exact engine, drivetrain, and trim.
    // Sync those confirmed specs into the engine/transmission part titles and
    // descriptions so listings reflect ground truth, not the AI's visual guess.
    if (vehicle?.vin && vehicle.engine) {
      const vinEngine = vehicle.engine;
      const drive = vehicle.drivetrain ? `, ${vehicle.drivetrain}` : "";
      for (const p of data) {
        const base = p.partName.replace(/\s*—.*$/, "").trim(); // strip any prior enrichment
        // The engine itself — NOT "Engine Mount"/"Engine Cover"/"Engine Wiring
        // Harness", which are distinct parts. The VIN is ground truth for the engine
        // spec, so OVERRIDE the vision model's visual guess rather than appending to
        // it: a wrong "2.4L inline-4" left in the description would sit right next to
        // the VIN-confirmed spec and contradict it. Scrub the model's displacement/
        // cylinder claims, then LEAD with the VIN spec — keeping the rest of what it
        // observed (condition, leaks, accessories).
        if (/^engine( assembly| motor| long block| short block)?$/i.test(base)) {
          p.partName = `Engine — ${vinEngine}`;
          const notes = scrubEngineSpecs(p.description);
          p.description = notes
            ? `VIN-confirmed engine: ${vinEngine}${drive}. ${notes}`
            : `VIN-confirmed engine: ${vinEngine}${drive}.`;
        } else if (/^transmission( assembly)?$/i.test(base) && vehicle.drivetrain) {
          if (!p.description.toLowerCase().includes(vehicle.drivetrain.toLowerCase())) {
            p.description = [p.description, `Drivetrain: ${vehicle.drivetrain}.`].filter(Boolean).join(" ");
          }
        }
      }
    }

    // ── PRICING ──────────────────────────────────────────────────────────────
    // Formula: usedPrice = newPartPriceUsd × gradeDiscount (lib/age-pricing.ts)
    //   Grade A (like new)        → ×0.85  (15% off new price)
    //   Grade B (normal wear)     → ×0.70  (30% off new price)
    //   Grade C (heavily damaged) → null   (unpriced — seller sets manually)
    for (const p of data) {
      const grade: ConditionGrade = (["A", "B", "C"] as const).includes(p.condition) ? p.condition : "B";
      const price = usedPriceFromNew(p.newPartPriceUsd, grade);
      p.suggestedPriceUsd = price;
      p.pricingInsight = price != null ? {
        suggestedPrice: price,
        priceRange: { min: price, max: price },
        similarCount: 0,
        source: "formula",
        confidence: p.confidence,
        newPartPrice: p.newPartPriceUsd,
      } : undefined;
    }

    // Whole car: original MSRP discounted by age (no single grade applies to a
    // whole vehicle). Null when the model couldn't estimate a new price.
    if (vehicle) {
      const age = vehicle.yearStart ? vehicleAge(vehicle.yearStart) : 8;
      vehicle.suggestedWholeCarPriceUsd =
        vehicle.newWholeCarPriceUsd != null && vehicle.newWholeCarPriceUsd > 0
          ? Math.round(vehicle.newWholeCarPriceUsd * ageFactor(age))
          : null;
    }

    // Count this successful scan against the shop's monthly quota (best-effort).
    void recordUsage(supabaseAdmin(), scanShopId, "scan");
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

// Single, centered parts that physically have no left/right variant.
const CENTER_PART = /\b(hood|bonnet|grille|grill|bumper|roof|windshield|windscreen|back ?glass|rear ?glass|trunk ?lid|tailgate|liftgate|deck ?lid|radiator|engine|transmission|gearbox|torque converter|driveshaft|drive shaft|dash(board)?|center console|instrument cluster|steering wheel|battery|alternator|starter|abs module|abs unit|ac compressor|a\/c compressor|power steering pump|fuel pump|intercooler|turbo(charger)?|supercharger|serpentine belt|timing belt|timing chain|throttle body|mass airflow sensor|maf sensor|exhaust|muffler|catalytic|converter|oxygen sensor|o2 sensor|ignition coil|spark plug|distributor|ecm|ecu|pcm|wiring harness|fuse box|relay|heater core|blower motor|condenser|evaporator|motor mount|transmission mount|clutch|flywheel|differential|transfer case|valve cover|oil pan|intake manifold|exhaust manifold|water pump|thermostat|radiator fan|cooling fan|fan clutch)\b/i;
function isCenterPart(name: string): boolean {
  return CENTER_PART.test(name) && !LATERAL_PART.test(name);
}

// Remove a stray left/right/driver/passenger side word from a part name. The
// "(?!…mirror)" guard keeps the "Side" of "Side Mirror" — so "Driver Side Mirror"
// strips to "Side Mirror" (matching the bare catalog name), not "Mirror", which
// keeps dedupe grouping a sided mirror with its generic sibling.
function stripSide(name: string): string {
  return name
    .replace(/\b(driver'?s?|passenger'?s?)(?:[ -]side(?!\s+mirror\b))?\b/gi, "")
    .replace(/\b(left|right|lh|rh)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// US salvage convention: the vehicle's LEFT side is the DRIVER side and the RIGHT
// side is the PASSENGER side (the driver sits on the left). lateralSide() computes
// Left/Right geometrically; we translate to the human-facing label only here, at the
// naming boundary, so listings read "Driver Side …" / "Passenger Side …".
const SIDE_LABEL: Record<"Left" | "Right", string> = { Left: "Driver Side", Right: "Passenger Side" };

function applySide(name: string, side: "Left" | "Right" | null): string {
  if (!side) return name;
  // Don't double-side a name that already states a side (either convention).
  if (/\b(driver|passenger|left|right)\b/i.test(name)) return name;
  // The side label leads the whole name → "Driver Side Front Door". Collapse the
  // "Side Side" that "Side Mirror" would produce → "Driver Side Mirror".
  return `${SIDE_LABEL[side]} ${name}`.replace(/\bSide Side\b/g, "Side");
}

// Strip DISPLACEMENT and CYLINDER-CONFIG claims the vision model guessed from a
// photo (e.g. "2.4L", "inline-4", "V6", "4-cyl") so the VIN-confirmed engine is the
// ONLY spec left in the engine part's description and nothing contradicts it.
// Everything else it observed (condition, leaks, accessories) is left intact.
function scrubEngineSpecs(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b\d(?:\.\d)?\s?-?\s?(?:l\b|liters?\b|litres?\b)/gi, "")  // 2.4L, 2.4-liter
    .replace(/\b\d{3,4}\s?cc\b/gi, "")                                  // 2400cc
    .replace(/\bV[\s-]?\d{1,2}\b/gi, "")                                // V6, V-8
    .replace(/\b(?:inline|straight|flat)[\s-]?(?:\d{1,2}|two|three|four|five|six|eight|ten|twelve)\b/gi, "") // inline-4, straight-six
    .replace(/\bI[\s-]?[3-9]\b/g, "")                                   // I4, I-6 config
    .replace(/\b(?:\d{1,2}|two|three|four|five|six|eight|ten|twelve)[\s-]?cyl(?:inder)?s?\b/gi, "") // 4-cyl, four cylinder
    .replace(/\(\s*[,;]?\s*\)/g, "")                                    // empty () left behind
    .replace(/\b(?:a|an)\s+(engine|motor|powerplant)\b/gi, "$1")        // fix dangling article a scrub left ("a engine")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/^[\s,;.\-–—]+/, "")
    .trim();
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
