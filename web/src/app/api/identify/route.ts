import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { vehicleAge, ageFactor } from "@/lib/age-pricing";
import { partClass, usedPointFromBand, usedPointFallback, gradeAdjustUsed } from "@/lib/used-pricing";
import { classifyPowertrain, isImpossiblePart, powertrainPromptLine, type PowertrainType } from "@/lib/powertrain";
import { geminiGenerate } from "@/lib/gemini";
import { decodeVin, normalizeVin, engineLabel, type VinInfo, type VinDecode } from "@/lib/vin";
import { checkUsage, recordUsage, limitMessage } from "@/lib/usage";
import { applyVinEngine, stripSide } from "@/lib/part-enrich";
import { markInferredParts } from "@/lib/inferred-parts";
import { propagateImpactDamage } from "@/lib/damage-zones";
import { applyDamageZones, type DamageZone } from "@/lib/damage-intersect";

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
  // Bounding box for this detection, [x0,y0,x1,y1] as fractions of the image (0–1). Used
  // to keep each part's clearest shot (largest box) and, later, to intersect damage zones.
  box?: [number, number, number, number];
  fitment: VehicleFit[];
  condition: ConditionGrade;
  conditionNotes: string;
  damageCode?: string;
  description: string;
  // The part's typical USED/recycled selling price from the model — what this part
  // actually sells for from a dismantler for THIS exact vehicle in good used
  // (≈ Grade B) condition. The anchor every price derives from. (Replaced the old
  // new-retail anchor, which priced painted panels near best-case retail and pushed
  // parts totals implausibly past the whole-car value.)
  usedPartPriceUsd: number | null;
  // The model's realistic USED-market range: low ≤ usedPartPriceUsd ≤ high. The
  // class curve positions slow movers (painted panels) near the low end.
  usedPartPriceLowUsd?: number | null;
  usedPartPriceHighUsd?: number | null;
  // Final suggested price, computed server-side: class-positioned point in the used
  // band × grade factor (lib/used-pricing). The model never sets this directly.
  suggestedPriceUsd: number | null;
  // The used band after the grade factor — renders as the confidence band under the
  // price field.
  suggestedPriceLowUsd?: number | null;
  suggestedPriceHighUsd?: number | null;
  confidence: Confidence;
  lowConfidenceFields?: (keyof AIPartOutput)[];
  // True when this part wasn't directly seen — model-listed (airbag behind the wheel)
  // or code-generated from the powertrain type (battery pack with no underbody photo).
  // Surfaced as "Inferred — verify" but STILL PRICED: hidden powertrain parts are
  // often the most valuable items on the car.
  inferred?: boolean;
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
  color?: string | null; // one exterior body color, locked from the best-lit panel
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
  // Powertrain classification (lib/powertrain) — every pricing decision branches on
  // this: which parts can exist, which high-value parts to infer, how to price them.
  powertrainType?: PowertrainType | null;
}

// A personal-identifier region to blur before the image is shown/saved: a license plate
// or a legible windshield VIN. `box` is [x0,y0,x1,y1] as fractions of the image (0–1).
export interface PiiRegion { type: "license-plate" | "windshield-vin"; box: [number, number, number, number] }

// Validate a model-emitted bounding box → a clean [x0,y0,x1,y1] tuple in 0–1, or undefined.
// Guards against a stray/garbage value ever being treated as a box (and masking a whole photo).
function validBox(b: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(b) || b.length !== 4) return undefined;
  const [x0, y0, x1, y1] = b.map(Number);
  if (![x0, y0, x1, y1].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return undefined;
  return x0 < x1 && y0 < y1 ? [x0, y0, x1, y1] : undefined;
}

export type AIResult =
  | { ok: true; data: AIPartOutput[]; vehicle?: VehicleEstimate | null; vehicleFront?: string; piiRegions?: PiiRegion[] }
  | { ok: false; userMessage: string; internalError: string };

// Sanitize the model's used-price range: numbers only, re-ordered if swapped, and
// clamped to actually bracket the point estimate. A missing/garbage range → nulls
// (the client falls back to a confidence-derived band).
function normalizeUsedPriceBand(p: { usedPartPriceUsd?: unknown; usedPartPriceLowUsd?: unknown; usedPartPriceHighUsd?: unknown }): { usedPartPriceLowUsd: number | null; usedPartPriceHighUsd: number | null } {
  const mid = typeof p.usedPartPriceUsd === "number" && p.usedPartPriceUsd > 0 ? p.usedPartPriceUsd : null;
  let lo = typeof p.usedPartPriceLowUsd === "number" && p.usedPartPriceLowUsd > 0 ? p.usedPartPriceLowUsd : null;
  let hi = typeof p.usedPartPriceHighUsd === "number" && p.usedPartPriceHighUsd > 0 ? p.usedPartPriceHighUsd : null;
  if (mid == null || lo == null || hi == null) return { usedPartPriceLowUsd: null, usedPartPriceHighUsd: null };
  if (lo > hi) [lo, hi] = [hi, lo];
  return { usedPartPriceLowUsd: Math.min(lo, mid), usedPartPriceHighUsd: Math.max(hi, mid) };
}

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
    "color": string | null,
    "mileage": string | null,
    "newWholeCarPriceUsd": number | null,
    "confidence": "high" | "medium" | "low"
  },
  "parts": [
    {
      "partName": string,
      "partCategory": string,
      "box": [x0, y0, x1, y1],
      "imageSide": "left" | "right" | "center",
      "fitment": [
        { "make": string, "model": string, "yearStart": number, "yearEnd": number, "notes": string }
      ],
      "condition": "A" | "B" | "C",
      "conditionNotes": string,
      "damageCode": string,
      "description": string,
      "usedPartPriceUsd": number | null,
      "usedPartPriceLowUsd": number | null,
      "usedPartPriceHighUsd": number | null,
      "confidence": "high" | "medium" | "low",
      "visiblyPresent": boolean,
      "lowConfidenceFields": string[]
    }
  ],
  "piiRegions": [
    { "type": "license-plate" | "windshield-vin", "box": [x0, y0, x1, y1] }
  ],
  "damageZones": [
    { "box": [x0, y0, x1, y1], "severity": "moderate" | "severe" }
  ]
}

PII REGIONS — for privacy, we blur personal identifiers before any listing. In "piiRegions", return a bounding box for each LICENSE PLATE and each legible WINDSHIELD VIN PLATE visible in THIS photo. Box is [x0, y0, x1, y1] as fractions of the image (0.0–1.0): x0/y0 = top-left, x1/y1 = bottom-right. Draw the box slightly LARGER than the plate so the whole thing is covered. If none is visible, return an empty array. (Still read the VIN into "vin" above — we only blur it from the customer-facing image, not from our internal fitment.)

MULTI-PART DETECTION:
- Identify ALL clearly-visible, individually-sellable parts in the image.
- BOUNDING BOX ("box"): for EVERY part, return a tight bounding box around it as [x0, y0, x1, y1] in fractions of the image (0.0–1.0): x0/y0 = top-left corner, x1/y1 = bottom-right corner, with x0 < x1 and y0 < y1. Box the part as YOU SEE IT in this photo. This box is how the system keeps each part's clearest shot — a part shown large and head-on wins over the same part glimpsed small at the edge of another photo.
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
- "color": the vehicle's ONE exterior body color as a short label (e.g. "Silver", "Army Green", "Dark Gray", "Metallic Blue"). Read it from the best-lit, cleanest painted body panel — a car has a single body color, so give one value regardless of shadows/dirt/glare on other panels. Null if no painted body is visible (e.g. an interior-only or engine-bay photo).
- VIN — THIS IS HIGH PRIORITY. Scan the photo for a VIN and READ IT if one is legible anywhere: the windshield VIN plate (driver-side base of the windshield), the driver door-jamb sticker, the firewall/engine-bay label, the dashboard, or any paperwork in frame. A VIN is exactly 17 characters, capital letters and digits only, and never contains the letters I, O, or Q. Transcribe all 17 characters CAREFULLY, character by character, and return it in "vin". If no VIN is legible, set "vin" to null — NEVER invent or guess a VIN, and never partially fill one.
- If you read a VIN, USE IT: it tells you the exact make, model, and model year — set yearStart and yearEnd to that EXACT same year (not a range) — and the engine/drivetrain, which determines which parts the car has and what they interchange with. Trust the VIN over a visual guess.
- ALWAYS COMMIT TO A SINGLE MODEL YEAR. Set yearStart === yearEnd to your one best-estimate model year. Do NOT return a multi-year span like 2016–2025 — that is a generation, not an answer. From the VIN (exact), or failing that the body style, headlights/taillights, grille, wheels, badging and trim cues, identify the specific generation and pick the single most-likely year within it. If you must, give your best single guess and lower "confidence" — but never output a range. A salvage buyer needs the exact year for fitment.
- If you can identify the source vehicle, fill in make/model/year/bodyStyle from what you actually see.
- "mileage": ONLY if this photo clearly shows an odometer / instrument cluster with a readable mileage number, return it as a string (e.g. "112,480 mi"). Otherwise null. Never guess mileage.
- "newWholeCarPriceUsd": the vehicle's ORIGINAL price BRAND NEW (its MSRP / sticker price when it was first sold), in USD — NOT its current used value. Base it on the make/model/year/trim you identified. If you cannot estimate it, use null. (The system applies depreciation from the vehicle's age automatically — do not pre-depreciate it yourself.)
- If you are unsure of any field, set it to null and lower "confidence".

PRICING — report each part's USED-MARKET price. This is a USED vehicle being parted out by a dismantler:
- "usedPartPriceUsd": the typical price this part ACTUALLY SELLS FOR as a USED/recycled part — what dismantlers and salvage yards get for it on car-part.com, eBay sold listings, and LKQ for THIS exact make/model/year/trim, in good used (Grade B) condition. NEVER the new/OEM/MSRP/aftermarket-new price — a used part sells for a FRACTION of new.
- The system applies the condition-grade adjustment itself — report the good-used baseline and let the grade (A/B/C) you already assigned carry the wear. Do not zero a damaged part; grade it C instead.
- BE CONSERVATIVE ON LARGE PAINTED BODY PANELS (doors, liftgate/tailgate, hood, quarter panels, fenders, bumper covers, roof): they move slowly, cost a lot to ship, and face heavy local supply — they usually sell near the LOW end of any listed range, far below what body shops charge. A used door for a mainstream vehicle is typically $100–$400, not $1,000+.
- Small fast-moving parts (mirrors, lamps, glass, modules, sensors) hold value better and sell nearer the middle of their range.
- Left & right of a paired part have the SAME price — don't differ them. "Wheel / Rim" and "Tire" each get their own price.
- Use realistic round numbers. If you genuinely have no basis for a price, use null rather than guessing.
- "usedPartPriceLowUsd" / "usedPartPriceHighUsd": the realistic USED-market RANGE — what the same part sells for across condition/market variation. low ≤ usedPartPriceUsd ≤ high, always. Keep it TIGHT (±15% or less) when you know this part and vehicle well; make it WIDE when you're less sure. If usedPartPriceUsd is null, both are null.

NO INFERRED / GUESSED PARTS:
- Catalog ONLY what you can actually see in the photo. If a part is not visible, do NOT list it — never infer, guess, or assume.
- "visiblyPresent": for EVERY part, set this to true ONLY if you can DIRECTLY SEE the part itself in a photo. Set it to false for any part you are listing without actually seeing it — one you inferred is there because it "must" be (e.g. an airbag behind a steering wheel, a part hidden behind another). Strongly prefer not to list inferred parts at all; but if one slips in, it MUST be marked "visiblyPresent": false — NEVER mark a part you did not actually see as true. A directly-visible part is always true.
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
- DAMAGE ZONES ("damageZones"): whenever you see COLLISION/IMPACT damage, return a bounding box [x0,y0,x1,y1] (fractions 0–1) around each damaged AREA, with "severity": "severe" (crushed, caved-in, structural, torn, shattered) or "moderate" (deep dents, heavy creasing). Box the whole damaged region, not a single part — the system marks EVERY part inside the box as damaged, which is how a side impact drags down the door, glass, mirror, and rocker together. Empty array if there's no collision damage.
- IMPACT ZONES — DAMAGE PROPAGATES, never grade one wrecked panel in isolation. A real collision almost never hits a single panel cleanly; the force runs through the whole zone. When you see severe damage on ANY panel, deliberately inspect EVERY adjacent panel and the parts mounted on them for related damage from the SAME impact: the panels ahead of and behind it (front fender → front door → rear door → rear quarter panel), the rocker panel below them, and the side mirror, window glass, door handle, and trim that ride on those panels. Grade each neighbor by what you actually see. If a neighboring panel is very likely caught in the same impact but you cannot see it clearly enough to confirm clean, grade it conservatively (down, never "A") and set its "confidence" to "low" so it is flagged for review — do NOT grade the panel beside a crushed one as "A" just because its own damage isn't squarely in frame.

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

// When a VIN is known BEFORE the scan (client-supplied + decoded up front), inject the
// full decoded spec into the prompt so the model classifies parts AND prices them for
// THIS exact vehicle, not a visual guess. (A VIN read from the photo itself is decoded
// after the vision call, so it can't steer the prompt — the post-process fitment anchor
// and engine override cover that case instead.)
function vinContext(decoded: { make?: string | null; model?: string | null; year?: number | null; trim?: string | null; engine?: string | null; drivetrain?: string | null }): string {
  const id = [decoded.year, decoded.make, decoded.model, decoded.trim].filter(Boolean).join(" ");
  if (!id) return "";
  const specs = [
    decoded.engine ? `engine ${decoded.engine}` : null,
    decoded.drivetrain ? `drivetrain ${decoded.drivetrain}` : null,
  ].filter(Boolean).join(", ");
  return `\n\nKNOWN SOURCE VEHICLE — decoded from its VIN; treat as GROUND TRUTH and override any visual guess: ${id}${specs ? ` (${specs})` : ""}.` +
    ` Classify each part as the correct part FOR THIS EXACT VEHICLE, set its "fitment" to this vehicle, and base "usedPartPriceUsd" on what a USED part for this make/model/year/trim${decoded.engine ? "/engine" : ""} actually sells for.` +
    ` Only include a part if it visibly belongs to this vehicle.`;
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

  let body: { imageBase64?: string; imageUrl?: string; photoContext?: string; vin?: { vin?: string; make?: string; model?: string; year?: number } };
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
  // Decode a client-supplied VIN UP FRONT (before the vision call) so its full spec can
  // steer classification + pricing in the prompt. NHTSA is free + cached, not an AI
  // call. Reused after the scan to lock the vehicle identity/specs.
  const clientVin: VinDecode | null = body.vin?.vin ? await decodeVin(body.vin.vin) : null;
  const vinForPrompt = clientVin
    ? { year: clientVin.year, make: clientVin.make, model: clientVin.model, trim: clientVin.trim, engine: engineLabel(clientVin), drivetrain: clientVin.driveType }
    : body.vin;
  // Powertrain steer for the prompt: when the up-front VIN (or passed identity) tells
  // us the type, the model is told which parts can and cannot exist BEFORE it looks.
  const promptPowertrain = clientVin
    ? classifyPowertrain(clientVin)
    : (body.vin?.make || body.vin?.model)
      ? classifyPowertrain({ make: body.vin.make, model: body.vin.model })
      : null;
  const userText = VISION_USER_INSTRUCTION
    + (vinForPrompt ? vinContext(vinForPrompt) : "")
    + (promptPowertrain && promptPowertrain.source !== "default" ? `\n\n${powertrainPromptLine(promptPowertrain.type)}` : "")
    + photoContext;

  try {
    const content = await callGemini(rawBase64, mime, userText);

    if (!content) {
      await alertTeam("Gemini returned empty content");
      return NextResponse.json(busyResult("empty completion"), { status: 503 });
    }

    type RawPart = Partial<AIPartOutput> & { imageSide?: ImageSide; visiblyPresent?: boolean };
    const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      vehicleFront?: VehicleFront;
      vehicle?: Partial<VehicleEstimate>;
      parts?: RawPart[];
      piiRegions?: { type?: string; box?: number[] }[];
      damageZones?: { box?: number[]; severity?: string }[];
    } & RawPart;

    const vehicleFront: VehicleFront = parsed.vehicleFront ?? "unknown";

    // Personal-identifier boxes to blur client-side (license plate / windshield VIN).
    // Keep only well-formed, in-bounds boxes so a stray value never masks the whole photo.
    const piiRegions: PiiRegion[] = (Array.isArray(parsed.piiRegions) ? parsed.piiRegions : [])
      .map((r) => ({
        type: r?.type === "windshield-vin" ? "windshield-vin" : "license-plate",
        box: (Array.isArray(r?.box) ? r.box : []).map(Number) as number[],
      }))
      .filter((r): r is PiiRegion =>
        r.box.length === 4 &&
        r.box.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
        r.box[0] < r.box[2] && r.box[1] < r.box[3]);

    // Located impact-damage zones (per photo) → parts whose box intersects one get downgraded.
    const damageZones: DamageZone[] = (Array.isArray(parsed.damageZones) ? parsed.damageZones : [])
      .map((z) => ({ box: validBox(z?.box), severity: z?.severity === "severe" ? "severe" as const : "moderate" as const }))
      .filter((z): z is DamageZone => !!z.box);

    const v = parsed.vehicle;
    const vehicle: VehicleEstimate | null = v
      ? {
          vin: normalizeVin((v as { vin?: string }).vin),
          make: v.make ?? null,
          model: v.model ?? null,
          yearStart: typeof v.yearStart === "number" ? v.yearStart : null,
          yearEnd: typeof v.yearEnd === "number" ? v.yearEnd : null,
          bodyStyle: v.bodyStyle ?? null,
          color: typeof v.color === "string" && v.color.trim() ? v.color.trim() : null,
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
        vehicle.engine = engineLabel(decoded);
        vehicle.drivetrain = decoded.driveType || null;
        const { raw: _raw, ...info } = decoded; // strip the bulky raw map
        vehicle.vinInfo = { ...info, trim: vehicle.trim }; // include the resolved (looked-up) trim
        vehicle.confidence = "high"; // identity is now VIN-confirmed, not guessed
      } else {
        vehicle.vin = null; // misread / not in NHTSA — don't surface a bogus VIN
      }
    }
    // Client-supplied VIN (decoded up front): lock identity + specs when the photo
    // itself showed no VIN. Setting vehicle.vin is what lets the engine override +
    // fitment anchor below treat this as a VIN-confirmed vehicle.
    if (vehicle && !vehicle.vin && clientVin) {
      vehicle.vin = clientVin.vin;
      if (clientVin.make) vehicle.make = clientVin.make;
      if (clientVin.model) vehicle.model = clientVin.model;
      if (clientVin.year) { vehicle.yearStart = clientVin.year; vehicle.yearEnd = clientVin.year; }
      if (clientVin.trim) vehicle.trim = clientVin.trim;
      vehicle.engine = engineLabel(clientVin) ?? vehicle.engine;
      if (clientVin.driveType) vehicle.drivetrain = clientVin.driveType;
      const { raw: _raw, ...info } = clientVin;
      vehicle.vinInfo = { ...info, trim: vehicle.trim ?? null };
      vehicle.confidence = "high";
    } else if (vehicle && !vehicle.vin && body.vin) {
      // Legacy: caller passed only make/model/year (no raw VIN to decode).
      if (body.vin.make) vehicle.make = body.vin.make;
      if (body.vin.model) vehicle.model = body.vin.model;
      if (typeof body.vin.year === "number") { vehicle.yearStart = body.vin.year; vehicle.yearEnd = body.vin.year; }
    }

    // POWERTRAIN TYPE — classified BEFORE pricing from the best identity we have
    // (NHTSA decode fields when a VIN resolved, else the make/model name). Recorded
    // on the vehicle and used by the impossible-part filter below. Filtering only
    // acts on confident classifications (VIN or known-EV name), never the default.
    const powertrain = classifyPowertrain(
      vehicle?.vinInfo ?? clientVin ?? { make: vehicle?.make, model: vehicle?.model, trim: vehicle?.trim },
    );
    if (vehicle) vehicle.powertrainType = powertrain.type;

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
        box: validBox((p as { box?: unknown }).box),
        fitment: Array.isArray(p.fitment) ? p.fitment : [],
        condition,
        conditionNotes: p.conditionNotes ?? "",
        damageCode: typeof p.damageCode === "string" ? p.damageCode.slice(0, 16) : "",
        description: p.description ?? "",
        usedPartPriceUsd: typeof p.usedPartPriceUsd === "number" ? p.usedPartPriceUsd : null,
        ...normalizeUsedPriceBand(p),
        suggestedPriceUsd: null, // computed from the used band × class curve × grade below
        confidence,
        lowConfidenceFields: Array.from(lowFields),
        inferred: p.visiblyPresent === false, // listed but not directly seen
        compliance: complianceFor(partName),
      };
    });

    // Remove the model's duplicate emissions (generic "Front Door" alongside
    // "Front Left/Right Door", exact-name repeats) before pricing so phantoms
    // neither cost a pricing call nor double-list a physical part. (AHLAM-52)
    let data: AIPartOutput[] = dedupeParts(assembled);

    // One car = one wheel size. The model occasionally reports a left wheel at a
    // different diameter than the right, or a tire whose rim contradicts the wheel.
    // Reconcile every wheel/tire to a single consensus diameter before pricing.
    reconcileWheelSpecs(data);

    // ── VIN ENRICHMENT ───────────────────────────────────────────────────────
    // When a VIN was decoded, we know the exact engine, drivetrain, and trim.
    // Sync those confirmed specs into the engine/transmission part titles and
    // descriptions so listings reflect ground truth, not the AI's visual guess.
    // VIN is ground truth — push the decoded engine/drivetrain down onto the matching
    // parts. applyVinEngine() (shared with the cross-photo aggregator in AddVehicle)
    // overrides the engine title + description so the model's visual guess can't
    // contradict the VIN. This is the same-photo case (VIN legible in the engine-bay
    // shot); the aggregator covers the common case where they're in different photos.
    if (vehicle?.vin && vehicle.engine) {
      for (const p of data) {
        const enriched = applyVinEngine(p, vehicle.engine, vehicle.drivetrain);
        p.partName = enriched.partName;
        p.description = enriched.description;
        const base = p.partName.replace(/\s*—.*$/, "").trim();
        if (/^transmission( assembly)?$/i.test(base) && vehicle.drivetrain
            && !p.description.toLowerCase().includes(vehicle.drivetrain.toLowerCase())) {
          p.description = [p.description, `Drivetrain: ${vehicle.drivetrain}.`].filter(Boolean).join(" ");
        }
      }
    }

    // ── VIN FITMENT ANCHOR ─────────────────────────────────────────────────────
    // The VIN is ground truth for the SOURCE vehicle, so make every part's primary
    // fitment that exact year/make/model (trim/engine in notes). Any extra interchange
    // the model suggested for OTHER vehicles is kept after it. This grounds part
    // classification in the VIN even when the VIN was read from a different photo.
    if (vehicle?.vin && vehicle.make && vehicle.model && vehicle.yearStart) {
      const src: VehicleFit = {
        make: vehicle.make,
        model: vehicle.model,
        yearStart: vehicle.yearStart,
        yearEnd: vehicle.yearEnd ?? vehicle.yearStart,
        notes: [vehicle.trim, vehicle.engine].filter(Boolean).join(" · ") || undefined,
      };
      for (const p of data) {
        const extras = (p.fitment ?? []).filter(
          (f) => !(f.make?.toLowerCase() === src.make.toLowerCase()
                && f.model?.toLowerCase() === src.model.toLowerCase()),
        );
        p.fitment = [src, ...extras];
      }
    }

    // Inferred (not-directly-seen) parts — deterministic rule (lib/inferred-parts), since
    // the model won't reliably self-report. Flags airbags etc. as "inferred — verify".
    // Inferred parts KEEP their price (hidden powertrain parts are often the most
    // valuable items on the car) — the flag is the safeguard, not a blank price.
    data = markInferredParts(data);

    // Powertrain reality filter: never emit a part that cannot exist for the detected
    // powertrain (no catalytic converter or transmission on a BEV, no drive unit on a
    // gas car). The prompt already says this; this is the deterministic guarantee.
    // Only a CONFIDENT classification filters — the "default" guess never deletes parts.
    if (powertrain.source !== "default") data = data.filter((p) => !isImpossiblePart(p.partName, powertrain.type));

    // ── PRICING (lib/used-pricing) ───────────────────────────────────────────
    // usedPartPriceUsd is the model's good-used (Grade B) market anchor. The final
    // suggested price = point positioned in the used band by PART CLASS (painted
    // panels → low end; fast movers → middle) × GRADE factor (A ×1.15, B ×1.0,
    // C null — heavily damaged stays unpriced for the seller to judge).
    for (const p of data) {
      const grade: ConditionGrade = (["A", "B", "C"] as const).includes(p.condition) ? p.condition : "B";
      const cls = partClass(p.partName);
      const base = p.usedPartPriceLowUsd != null && p.usedPartPriceHighUsd != null
        ? usedPointFromBand(p.usedPartPriceLowUsd, p.usedPartPriceHighUsd, cls)
        : (p.usedPartPriceUsd != null ? usedPointFallback(p.usedPartPriceUsd, cls) : null);
      p.usedPartPriceUsd = base; // normalized anchor — what pair-parity shares
      const price = gradeAdjustUsed(base, grade);
      p.suggestedPriceUsd = price;
      // The band gets the same grade factor so it brackets the suggested price.
      p.suggestedPriceLowUsd = price != null ? gradeAdjustUsed(p.usedPartPriceLowUsd, grade) : null;
      p.suggestedPriceHighUsd = price != null ? gradeAdjustUsed(p.usedPartPriceHighUsd, grade) : null;
      p.pricingInsight = price != null ? {
        suggestedPrice: price,
        priceRange: { min: p.suggestedPriceLowUsd ?? price, max: p.suggestedPriceHighUsd ?? price },
        similarCount: 0,
        source: "formula",
        confidence: p.confidence,
      } : undefined;
    }

    // Impact-zone damage propagation (lib/damage-zones) — deterministic safety net the
    // prompt couldn't enforce: a collision-graded panel pulls its same-side neighbors
    // (rear door, glass, mirror, rocker…) off Grade A, unprices them, and flags them for
    // review, instead of pricing them as undamaged. Runs AFTER pricing so the null sticks;
    // clear the now-stale pricing insight on anything it unpriced.
    // Pixel-accurate first: downgrade parts whose box sits IN a located damage zone
    // (applyDamageZones), then propagate from those origins to same-side neighbors via the
    // adjacency map (propagateImpactDamage). Clear the now-stale pricing insight on anything
    // either pass unpriced.
    data = propagateImpactDamage(applyDamageZones(data, damageZones)).map((p) =>
      p.suggestedPriceUsd == null
        ? { ...p, pricingInsight: undefined, suggestedPriceLowUsd: null, suggestedPriceHighUsd: null }
        : p,
    );

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
    return NextResponse.json({ ok: true, data, vehicle, vehicleFront, piiRegions });
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

// stripSide moved to @/lib/part-enrich (shared with the client's L/R price parity).

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
