// PIXEL-ACCURATE DAMAGE-ZONE INTERSECTION — the geometric half of Damage Assessment.
//
// The vision model, on each photo, locates IMPACT-DAMAGE ZONES (bounding boxes over the
// crushed/torn region) and, separately, boxes every PART it detects. Neither half knows
// about the other: the model tells us "here is damage" and "here is a fender", but it does
// NOT reliably say "…and therefore this fender is damaged". This module closes that gap
// deterministically: any part whose detection box measurably OVERLAPS a damage zone is
// pulled off its clean grade, unpriced, and flagged for human verification — the crushed
// panel isn't sold as like-new just because the model graded its own box optimistically.
//
// This is the PIXEL-ACCURATE pass. It runs BEFORE lib/damage-zones' propagateImpactDamage:
// this one downgrades the parts the damage physically sits ON (box ∩ zone), then the
// adjacency pass propagates from those origins to their same-side neighbors. Between them,
// the panel that was hit and the panels beside it both stop shipping as pristine.
//
// PURE (no input mutation — returns new objects only for parts it changes, original refs
// for the rest) and IDEMPOTENT (re-running over its own output changes nothing).

// A [x0,y0,x1,y1] bounding box in image fractions (0–1): (x0,y0) top-left, (x1,y1)
// bottom-right, x0 < x1 and y0 < y1. The same convention the /api/identify prompt emits.
export type Box = [number, number, number, number];

// The part shape this pass reads and rewrites — a structural subset of the scanner's
// AIPartOutput (route.ts), so callers pass their richer objects through unchanged via the
// `<T extends Part>` generic. `box` is optional: a part detected without a usable box
// simply can't be intersected and is passed through untouched.
export type Part = {
  partName: string;
  box?: Box;
  condition: "A" | "B" | "C";
  conditionNotes?: string;
  suggestedPriceUsd: number | null;
  confidence?: "high" | "medium" | "low";
  lowConfidenceFields?: string[];
};

// A located impact-damage zone: the region the model flagged as struck, plus how hard.
// "severe" forces the overlapping part to Grade C; "moderate" downgrades it off A only.
export type DamageZone = { box: Box; severity: "moderate" | "severe" };

// Overlap threshold: a part must have at least this fraction of ITS OWN area inside a zone
// to count as damaged. Below it, the boxes merely graze (e.g. a zone clipping the corner of
// a large adjacent panel) and we do NOT touch the part — that near-miss is the adjacency
// pass's job, if anything. 0.20 = 20% of the part's area.
const OVERLAP_THRESHOLD = 0.2;

// Appended once to a downgraded part's notes. Constant so the idempotency guard and the
// unit test reference the exact same string; the leading space joins cleanly onto any
// existing conditionNotes.
export const DAMAGE_ZONE_NOTE =
  " In a detected damage area — verify condition before pricing.";

// Area of a box, clamped to ≥ 0 so a degenerate/inverted box never yields a negative area.
function boxArea(b: Box): number {
  return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
}

// FRACTION OF THE PART'S AREA THAT LIES INSIDE THE ZONE — area(part ∩ zone) / area(part),
// in 0–1. This is intentionally asymmetric (denominator is the PART, never the zone): the
// question we answer is "how much of THIS part got hit", so a small part fully inside a big
// zone reads 1.0, while a huge part barely clipped by a small zone reads near 0. Returns 0
// when the boxes are disjoint or when the part has no area (nothing can be "inside" it).
export function boxOverlapFraction(part: Box, zone: Box): number {
  const ix0 = Math.max(part[0], zone[0]);
  const iy0 = Math.max(part[1], zone[1]);
  const ix1 = Math.min(part[2], zone[2]);
  const iy1 = Math.min(part[3], zone[3]);

  // No positive-area overlap (edges touching or fully apart) → disjoint.
  if (ix1 <= ix0 || iy1 <= iy0) return 0;

  const partArea = boxArea(part);
  if (partArea <= 0) return 0; // a zero-area part can't have a meaningful fraction inside

  const interArea = (ix1 - ix0) * (iy1 - iy0);
  return interArea / partArea;
}

// Rank so the MOST SEVERE overlapping zone wins when a part sits in several: severe > moderate.
const SEVERITY_RANK: Record<DamageZone["severity"], number> = { moderate: 1, severe: 2 };

// APPLY DAMAGE ZONES to a scanned part list.
//
// For each part that HAS a box and whose box overlaps ANY zone by ≥ OVERLAP_THRESHOLD
// (20% of the PART's area), we fold in the single most severe overlapping zone and:
//   • condition: severe → "C"; moderate → downgrade "A"→"B", keep "B"/"C" (never leave A)
//   • suggestedPriceUsd → null   (a part sitting in visible damage isn't priced clean)
//   • confidence → "low"
//   • append DAMAGE_ZONE_NOTE to conditionNotes (once — idempotent across re-runs)
//   • add "condition" + "suggestedPriceUsd" to lowConfidenceFields (deduped)
//
// Parts with no box, or with no ≥20% overlap against any zone, are returned by their
// original reference, unchanged. PURE and IDEMPOTENT.
export function applyDamageZones<T extends Part>(parts: T[], zones: DamageZone[]): T[] {
  if (!Array.isArray(parts) || parts.length === 0) return parts;
  if (!Array.isArray(zones) || zones.length === 0) return parts; // no zones → nothing to do

  return parts.map((p) => {
    if (!p.box) return p; // no detection box → can't intersect → untouched (same ref)

    // Find the most severe zone this part meaningfully overlaps. A part can straddle
    // several zones; the worst one dictates the outcome, so tracking severity is enough.
    let worst: DamageZone["severity"] | null = null;
    for (const zone of zones) {
      if (boxOverlapFraction(p.box, zone.box) < OVERLAP_THRESHOLD) continue;
      if (worst === null || SEVERITY_RANK[zone.severity] > SEVERITY_RANK[worst]) {
        worst = zone.severity;
      }
    }

    if (worst === null) return p; // no zone cleared the threshold → untouched (same ref)

    // severe → force Grade C. moderate → off A only ("A"→"B", "B"/"C" kept as-is).
    const nextCondition: Part["condition"] =
      worst === "severe" ? "C" : p.condition === "A" ? "B" : p.condition;

    // Append the note once — idempotent whether the string is already there from a prior
    // run of this pass or from the adjacency pass' own (different) note.
    const prevNotes = p.conditionNotes ?? "";
    const conditionNotes = prevNotes.includes(DAMAGE_ZONE_NOTE.trim())
      ? prevNotes
      : `${prevNotes}${DAMAGE_ZONE_NOTE}`.replace(/^\s+/, "");

    // Dedupe the low-confidence flags.
    const flags = new Set(p.lowConfidenceFields ?? []);
    flags.add("condition");
    flags.add("suggestedPriceUsd");

    return {
      ...p,
      condition: nextCondition,
      suggestedPriceUsd: null,
      confidence: "low",
      conditionNotes,
      lowConfidenceFields: [...flags],
    };
  });
}
