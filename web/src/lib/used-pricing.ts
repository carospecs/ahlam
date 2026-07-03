// USED-MARKET PRICING — the successor to the flat new-price × grade discount.
//
// THE PROBLEM (real example: 2018 Tesla Model X). Pricing off the NEW retail price
// discounted 15–30% put large painted body panels near best-case retail ($7,650+
// liftgates no dismantler recovers) and the summed parts total ~60% above the
// whole-car value. Meanwhile the genuinely valuable parts (battery pack, drive
// units) were unpriced because they weren't in a photo.
//
// THE MODEL NOW REPORTS USED PRICES: the vision/reprice prompts ask for the typical
// price the part ACTUALLY SELLS FOR as a used/recycled part (car-part.com, eBay sold,
// dismantler listings) for that exact vehicle in good used (≈ Grade B) condition,
// plus a realistic low–high band.
//
// 2026-07-03: CLASS CURVE positioning (painted panels → low end of the band, etc.)
// was REMOVED from live pricing — stacked on the prompt's already-conservative
// painted-panel guidance it double-discounted and drove prices low. The model's
// typical-used-price is now the base directly; the band renders as the confidence
// range. Only GRADE ADJUST applies: the anchor is good-used (Grade B); Grade A
// commands a premium (×1.15), Grade C stays unpriced (seller sets it after
// inspection). partClass/CLASS_QUANTILE/usedPoint* below are kept for reference,
// evals, and their unit tests — no live call site uses them.
//
// The parts TOTAL built from these prices is GROSS retail potential, not net
// recovery — not every part sells and selling costs apply. scan-qa flags totals
// that run implausibly past the whole-car value.

import type { ConditionGrade } from "./age-pricing";

export type PartClass = "painted-panel" | "powertrain" | "fast-mover" | "default";

// Interior "Door Panel" / "Front Door Window" are NOT painted panels — the door
// pattern requires the word not be followed by panel/window/glass/handle/mirror.
const PAINTED_PANEL =
  /\b(hood|liftgate|tailgate|trunk\s?lid|quarter\s?panel|fender|bumper\s?cover|roof\s?panel|door(?!\s?(panel|window|glass|handle|mirror)))\b/i;

const POWERTRAIN =
  /\b(engine|transmission|drive\s?unit|battery\s?pack|high.?voltage|onboard\s?charger|inverter|dc.?dc|catalytic\s?converter|driveshaft|differential|transaxle)\b/i;

const FAST_MOVER =
  /\b(mirror|windshield|window|glass|head\s?light|tail\s?light|headlamp|taillamp|fog\s?light|lamp|cluster|module|radio|screen|display|wheel|rim|tire|sensor|camera|latch|handle|hinge|lock|regulator|switch|emblem|molding|charge\s?port)\b/i;

// Order matters: a "Liftgate Glass" or "Hood Latch" contains a panel word but IS a
// small fast-moving part — the fast-mover and powertrain checks run before the
// painted-panel check so panel words only win for the actual panel.
export function partClass(partName: string): PartClass {
  if (FAST_MOVER.test(partName)) return "fast-mover";
  if (POWERTRAIN.test(partName)) return "powertrain";
  if (PAINTED_PANEL.test(partName)) return "painted-panel";
  return "default";
}

// Where in the used band each class realistically sells.
export const CLASS_QUANTILE: Record<PartClass, number> = {
  "painted-panel": 0.20,
  powertrain: 0.40,
  "fast-mover": 0.50,
  default: 0.35,
};

// Point estimate from the model's used band, positioned by part class.
export function usedPointFromBand(lowUsd: number, highUsd: number, cls: PartClass): number {
  if (highUsd <= lowUsd) return Math.round(lowUsd);
  return Math.round(lowUsd + CLASS_QUANTILE[cls] * (highUsd - lowUsd));
}

// No band available — apply the conservatism directly to the point estimate.
// Painted panels get a haircut (they recover near the low end of any range);
// everything else passes through.
export function usedPointFallback(pointUsd: number, cls: PartClass): number {
  return cls === "painted-panel" ? Math.round(pointUsd * 0.75) : Math.round(pointUsd);
}

// Grade multipliers around the good-used (Grade B) anchor. C is null — heavily
// damaged parts stay unpriced for the seller to judge (unchanged convention).
export const GRADE_FACTOR: Record<ConditionGrade, number | null> = {
  A: 1.15,
  B: 1.0,
  C: null,
};

// Final price for a part given its used-market base (Grade-B anchor) and grade.
export function gradeAdjustUsed(baseUsd: number | null | undefined, grade: ConditionGrade): number | null {
  if (baseUsd == null || !Number.isFinite(baseUsd) || baseUsd <= 0) return null;
  const f = GRADE_FACTOR[grade];
  if (f === null || f === undefined) return null;
  return Math.round(baseUsd * f);
}

// Sanity threshold: parting out normally EXCEEDS the whole-car value, so only an
// implausible margin gets flagged (the Model X case was ~1.6×).
export const IMPLAUSIBLE_TOTAL_RATIO = 1.5;
