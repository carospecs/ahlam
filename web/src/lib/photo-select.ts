// CROSS-PHOTO "BEST SHOT" SELECTION — pick the detection instance from the photo that
// shows a given physical part most clearly.
//
// The scanner runs each photo independently, so the SAME physical part (e.g. the
// passenger headlight) is detected once per photo it appears in. When the client
// de-dupes those instances down to one, it must keep the instance from the photo that
// actually shows the part well — not, say, a headlight glimpsed edge-on in a
// side-profile shot when a clean head-on front shot also exists. (Founder bug: a
// passenger headlight was kept from a side-profile photo instead of the clear front one.)
//
// This is DETERMINISTIC and uses only signals we already have — the part's catalog name
// and the orientation of the photo it came from (`photoFront`, mirroring the route's
// `vehicleFront`). No new model field is required.
//
// `photoFront` carries the SAME vocabulary the vision route emits as `vehicleFront`
// (see web/src/app/api/identify/route.ts):
//   "toward-camera"   = the FRONT of the car faces the camera (you see grille/headlights)
//   "away-from-camera"= the REAR faces the camera (you see trunk/taillights)
//   "points-left" / "points-right" = side profile (the car's nose points left/right)
//   "unknown"         = orientation couldn't be determined
import { stripSide } from "@/lib/part-enrich";

export type PhotoFront =
  | "toward-camera"
  | "away-from-camera"
  | "points-left"
  | "points-right"
  | "unknown";

export type Instance = {
  partName: string;
  confidence?: "high" | "medium" | "low";
  // Orientation of the PHOTO this instance was detected in (= the route's vehicleFront).
  photoFront?: PhotoFront;
};

export type PartRegion = "front" | "rear" | "side" | "center";

// Where on the vehicle a part lives, derived purely from its (side-stripped) catalog
// name. This is what a photo must be pointed at to show the part well:
//   front  → best seen in a "toward-camera" (front-facing) photo
//   rear   → best seen in an "away-from-camera" (rear-facing) photo
//   side   → best seen in a side-profile ("points-left"/"points-right") photo
//   center → no single orientation shows it best (roof, dash, engine, etc.)
//
// Vehicle-agnostic: matches on generic part vocabulary, never a specific make/model.
// `stripSide` removes the driver/passenger word first so "Passenger Side Headlight
// Assembly" classifies the same as a bare "Headlight Assembly".
const FRONT_RE = /\b(head ?light|fog ?light|fog ?lamp|grille|grill|hood|bonnet)\b/i;
const FRONT_QUALIFIED_RE = /\bfront\b.*\b(bumper|fender|valance|splitter|lip|apron|panel)\b|\b(bumper|fender|valance|splitter|lip|apron|panel)\b.*\bfront\b/i;
const REAR_RE = /\b(tail ?light|tail ?lamp|tailgate|liftgate|trunk|deck ?lid|back ?glass|rear ?glass|rear ?windshield|rear ?windscreen|quarter ?panel)\b/i;
const REAR_QUALIFIED_RE = /\brear\b.*\b(bumper|valance|panel|apron)\b|\b(bumper|valance|panel|apron)\b.*\brear\b/i;
const SIDE_RE = /\b(door|mirror|rocker|sill|quarter ?glass|quarter ?window|wheel|rim|tire|tyre)\b/i;

export function partRegion(partName: string): PartRegion {
  const base = stripSide(partName).toLowerCase();

  // SIDE first: a "door"/"mirror"/"wheel" is unambiguously a side part, and matching it
  // before the qualified front/rear bumper-fender rules avoids a "Front Door" (a side
  // part that merely contains the word "front") being miscalled front.
  if (SIDE_RE.test(base)) return "side";
  if (FRONT_RE.test(base) || FRONT_QUALIFIED_RE.test(base)) return "front";
  if (REAR_RE.test(base) || REAR_QUALIFIED_RE.test(base)) return "rear";
  return "center";
}

// Does the photo's orientation point at the part's region?
function orientationMatchesRegion(region: PartRegion, photoFront?: PhotoFront): boolean {
  switch (region) {
    case "front":
      return photoFront === "toward-camera";
    case "rear":
      return photoFront === "away-from-camera";
    case "side":
      return photoFront === "points-left" || photoFront === "points-right";
    default:
      return false; // center parts never have a "matching" orientation
  }
}

// A CLEAR mismatch: the part's region is directly contradicted by the photo's
// orientation, so the part is at best seen edge-on / occluded. (A front part in a
// side-profile, or in a rear-facing shot, etc.) "unknown" is NOT a clear mismatch — we
// just can't tell — so it stays neutral.
function orientationContradictsRegion(region: PartRegion, photoFront?: PhotoFront): boolean {
  if (!photoFront || photoFront === "unknown") return false;
  switch (region) {
    case "front":
      // A front part is contradicted by anything that isn't the front-facing shot.
      return photoFront !== "toward-camera";
    case "rear":
      return photoFront !== "away-from-camera";
    case "side":
      // A side part is contradicted by a head-on front/rear shot (you see it edge-on).
      return photoFront === "toward-camera" || photoFront === "away-from-camera";
    default:
      return false; // center parts are orientation-neutral
  }
}

const CONFIDENCE_SCORE: Record<NonNullable<Instance["confidence"]>, number> = {
  high: 2,
  medium: 1,
  low: 0,
};

// Weights are spaced so the region↔orientation fit dominates and confidence only ever
// breaks ties WITHIN the same fit tier (match: +100, mismatch: -100, neutral: 0; the
// 0–2 confidence term can never jump a part across a 100-point fit boundary).
const MATCH_BONUS = 100;
const MISMATCH_PENALTY = -100;

// Photo-fit score for a single detection instance. Higher = the photo shows this part
// better. Built from two terms:
//   1. region↔orientation fit — strong +bonus when the photo points at the part's
//      region, strong -penalty on a clear mismatch, 0 when neutral/unknown.
//   2. confidence — a secondary tiebreaker (high > medium > low).
// Center parts are orientation-neutral, so they score on confidence alone.
export function instanceScore(inst: Instance): number {
  const region = partRegion(inst.partName);
  const conf = CONFIDENCE_SCORE[inst.confidence ?? "low"];

  let fit = 0;
  if (orientationMatchesRegion(region, inst.photoFront)) fit = MATCH_BONUS;
  else if (orientationContradictsRegion(region, inst.photoFront)) fit = MISMATCH_PENALTY;

  return fit + conf;
}

// Pick the instance the best-showing photo produced. Highest instanceScore wins; ties
// keep the FIRST candidate (stable), so an equal-fit/equal-confidence set preserves the
// caller's existing order.
export function pickBestInstance<T extends Instance>(candidates: T[]): T {
  if (candidates.length === 0) {
    throw new Error("pickBestInstance: candidates must be non-empty");
  }
  let best = candidates[0];
  let bestScore = instanceScore(best);
  for (let i = 1; i < candidates.length; i++) {
    const score = instanceScore(candidates[i]);
    if (score > bestScore) {
      best = candidates[i];
      bestScore = score;
    }
  }
  return best;
}
