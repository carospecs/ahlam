// IMPACT-ZONE DAMAGE PROPAGATION — fixes "damage blindness" in the AI scan.
//
// A real collision almost never hits a single body panel cleanly: the force runs
// through the whole zone. The vision model scans each photo independently and often
// grades the panel BESIDE a crushed one as a pristine "A" with a firm price, simply
// because that neighbor's own damage isn't squarely in frame. That ships a wrecked
// part as like-new. (The /api/identify prompt already TELLS the model to inspect
// neighbors, but the model still misses them — this is the deterministic safety net
// that runs over the aggregated cross-photo part list, after dedup/parity.)
//
// This module is a PURE, deterministic, vehicle-agnostic post-pass: for every panel
// that is clearly a collision origin (Grade C + collision evidence), it walks a
// universal panel-adjacency map and, for each SAME-SIDE neighbor still optimistically
// graded A/B, downgrades it off "A", strips the firm price, drops confidence to "low",
// and flags it for human verification — instead of pricing it as undamaged.
//
// It NEVER invents a price, never touches center parts or the opposite side, never
// touches Grade-C neighbors (already handled), and is idempotent.
//
// Reuses `stripSide` from part-enrich so a part's base name is derived exactly the way
// the rest of the pipeline derives it (driver/passenger/left/right/lh/rh removed).
import { stripSide } from "@/lib/part-enrich";

// The minimal shape this pass reads and rewrites. Matches the scan's part object
// (AIPartOutput / the spec's `Part`): A/B/C grade, optional ARA damageCode, free-text
// notes, a firm price that may be nulled, and the low-confidence flag list.
export type Part = {
  partName: string;
  condition: "A" | "B" | "C";
  conditionNotes?: string;
  damageCode?: string;
  description?: string;
  suggestedPriceUsd: number | null;
  usedPartPriceUsd?: number | null;
  confidence?: "high" | "medium" | "low";
  lowConfidenceFields?: string[];
};

// US side convention: parts are prefixed "Driver Side" / "Passenger Side". Driver = L,
// Passenger = R, anything else = center (null). Center parts are never in a side's zone.
type Side = "L" | "R" | null;
function sideOf(partName: string): Side {
  if (/passenger|right/i.test(partName)) return "R";
  if (/driver|left/i.test(partName)) return "L";
  return null;
}

// Base name (side removed), lowercased — the key into the adjacency map below.
// e.g. "Driver Side Front Door" → "front door", "Passenger Side Mirror" → "side mirror".
function baseKey(partName: string): string {
  return stripSide(partName).toLowerCase().replace(/\s{2,}/g, " ").trim();
}

// ─── UNIVERSAL PANEL-ADJACENCY MAP ──────────────────────────────────────────────
// Keyed by BASE name (side stripped, lowercased) so it works for ANY vehicle — no
// make/model-specific entries. Each entry lists the base names that share an impact
// zone with it on the SAME side. Adjacency is made symmetric at module load (below),
// so you only have to write each link once, in whichever direction reads clearest.
//
// LENGTHWISE BODY CHAIN (front → back), the spine of a side impact:
//   front fender ── front door ── rear door ── rear quarter panel
// The ROCKER PANEL runs beneath both doors, so it neighbors front door + rear door.
// Each DOOR also carries the parts mounted ON it — its glass, its interior trim panel,
// its handle — and the FRONT door additionally carries the side mirror. When a door is
// caved in, those mounted parts go with it, so they're in the door's zone too.
//
// Names are listed with the common synonyms the vision model emits (e.g. a door's glass
// shows up as "front door window", "front door glass", or "door glass"). Add a row or a
// synonym to extend coverage; nothing else needs to change.
const ADJACENCY: Record<string, string[]> = {
  // ── Lengthwise body chain ──
  "front fender": ["front door", "fender"],
  fender: ["front door"], // some scans say just "fender" for the front fender
  "front door": ["front fender", "fender", "rear door", "rocker panel"],
  "rear door": ["front door", "rear quarter panel", "quarter panel", "rocker panel"],
  "rear quarter panel": ["rear door"],
  "quarter panel": ["rear door"],

  // ── Rocker panel (sill) runs beneath both doors ──
  "rocker panel": ["front door", "rear door"],

  // ── Parts mounted ON the front door (go with it in an impact) ──
  "front door window": ["front door"],
  "front door glass": ["front door"],
  "front door panel": ["front door"],       // interior trim panel
  "front door handle": ["front door"],
  "front door trim": ["front door"],
  "side mirror": ["front door"],             // door-mounted mirror
  mirror: ["front door"],

  // ── Parts mounted ON the rear door ──
  "rear door window": ["rear door"],
  "rear door glass": ["rear door"],
  "rear door panel": ["rear door"],
  "rear door handle": ["rear door"],
  "rear door trim": ["rear door"],

  // ── Generic "door window/glass/handle/panel" — a scan that doesn't say front/rear.
  // Linked to BOTH doors; same-side gating + the fact that only damaged origins seed
  // the zone keep this from over-reaching to an undamaged door's parts.
  "door window": ["front door", "rear door"],
  "door glass": ["front door", "rear door"],
  "door handle": ["front door", "rear door"],
  "door panel": ["front door", "rear door"],
};

// Build the symmetric, deduped adjacency lookup once. Writing "front door" → "rocker
// panel" automatically also gives "rocker panel" → "front door", so the map above can
// stay terse and you can never half-declare a link.
const ADJ: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    let s = m.get(a);
    if (!s) m.set(a, (s = new Set()));
    s.add(b);
  };
  for (const [name, neighbors] of Object.entries(ADJACENCY)) {
    for (const n of neighbors) {
      link(name, n);
      link(n, name); // make it symmetric
    }
  }
  return m;
})();

// Collision evidence in free text: the kinds of words that mean "this got hit", not
// merely "this is worn". Used together with Grade C to identify an impact ORIGIN.
const COLLISION_TEXT = /damag|crush|caved|bent|crack|collision|impact|dent|torn|missing/i;
// ARA damageCode prefixes that denote structural collision damage (vs. cosmetic wear).
const COLLISION_CODE = /^(DT|BN|BR|CR)\b/i; // DT dent, BN bent, BR broken, CR cracked/crushed

// An impact origin = a part the scan is confident is wrecked: Grade C AND it shows real
// collision evidence (a collision damageCode OR collision wording in the notes/desc).
function isImpactOrigin(p: Part): boolean {
  if (p.condition !== "C") return false;
  if (p.damageCode && COLLISION_CODE.test(p.damageCode.trim())) return true;
  return COLLISION_TEXT.test(`${p.conditionNotes ?? ""} ${p.description ?? ""}`);
}

const ZONE_NOTE =
  " In the impact zone of an adjacent damaged panel — verify condition before pricing.";

// PROPAGATE IMPACT DAMAGE across an aggregated part list.
//
// For every impact origin, find its same-side neighbors via the adjacency map. Any
// neighbor still graded A or B (and not itself an origin) is pulled into the zone:
//   • condition "A" → "B"   (never leave a panel beside a wreck as like-new)
//   • suggestedPriceUsd → null  (drop the firm price; a human re-prices it)
//   • confidence → "low"
//   • append the zone note to conditionNotes (once)
//   • add "condition" + "suggestedPriceUsd" to lowConfidenceFields (deduped)
//
// Pure (no input mutation — returns new objects for changed parts, same refs for the
// rest) and idempotent (re-running over its own output changes nothing).
// ─── FRONT/REAR IMPACT → BEHIND-THE-IMPACT INFERENCE ────────────────────────────
// The adjacency map above models SIDE impacts (the lengthwise panel chain). A
// frontal or rear hit is different: the force runs INTO the car, through parts the
// photos can't even show — a crushed front end means the radiator, condenser, and
// often the engine/transmission took load, yet the scan ships them clean because
// nothing "adjacent" in the panel sense was damaged (center origins are skipped
// above, by design). This pass adds the missing axis:
//
//   1. FACE DETECTION — a collision-damaged face part (front bumper/hood/grille;
//      rear bumper/tailgate/trunk lid) establishes an impact FACE.
//   2. BEHIND-THE-IMPACT — on a STRONG hit (crush/caved/collision/impact language,
//      not a mere dent), every mechanical part behind that face — observed OR
//      inferred — is condemned to Grade C: assume affected until a human verifies.
//      Grade C deliberately blocks pricing/research; the yard inspects, regrades,
//      and only then lists. (The founder's rule: front smashed → assume engine
//      and transmission are messed up too.)
//   3. FACE SPREAD — the face's other body parts (both sides' fenders/headlights,
//      hood, grille, bumper) get the softer zone treatment (A→B, unpriced, note),
//      fixing the center-origin blind spot where a crushed bumper dragged nothing.
//
// Run this AFTER ensurePowertrainParts so inferred engines/battery packs are
// covered — they are appended after the per-photo damage passes and were
// previously hardcoded Grade B regardless of the wreck in the photos.

export type ImpactFace = "front" | "rear";

// Face parts, by base name (side stripped). Matching one of these — collision-
// damaged — is what establishes the face.
const FACE_ORIGIN: Record<ImpactFace, RegExp> = {
  front: /^(front bumper( cover)?|front bumper assembly|hood|grille|radiator support|front end|headlight( assembly)?|head ?lamp( assembly)?)$/i,
  rear: /^(rear bumper( cover)?|rear bumper assembly|trunk lid|deck ?lid|tail ?gate|lift ?gate|hatch|rear body panel|tail ?light( assembly)?|tail ?lamp( assembly)?)$/i,
};

// Body parts in the face's crumple zone (targets of the softer spread). Superset
// of the origins plus the corner panels the force reaches on either side.
const FACE_SPREAD: Record<ImpactFace, RegExp> = {
  front: /^(front bumper( cover)?|front bumper assembly|hood|grille|radiator support|front end|headlight( assembly)?|head ?lamp( assembly)?|front fender|fender|windshield)$/i,
  rear: /^(rear bumper( cover)?|rear bumper assembly|trunk lid|deck ?lid|tail ?gate|lift ?gate|hatch|rear body panel|tail ?light( assembly)?|tail ?lamp( assembly)?|rear quarter panel|quarter panel|rear window|back glass)$/i,
};

// Mechanical parts BEHIND each face — matched by prefix so enriched names
// ("Engine — 2.5L I4 (VIN-confirmed)") still hit. EV note: the front drive unit
// sits in the front crumple path; the floor-mounted battery pack is deliberately
// NOT condemned by a front hit (mid-mounted, protected) — a severe rear hit does
// reach the rear drive unit and charge port.
const BEHIND: Record<ImpactFace, RegExp> = {
  front:
    /^(engine\b|transmission\b|transaxle\b|radiator\b|(a\/?c |air ?conditioning )?condenser|intercooler|(a\/?c |air ?conditioning )?compressor|alternator|starter( motor)?|cooling fan|radiator fan|fan (assembly|shroud)|power steering pump|water pump|turbocharger|supercharger|front drive unit)/i,
  rear: /^(fuel tank|rear drive unit|charge port|rear bumper reinforcement|muffler|exhaust)/i,
};

// A STRONG hit — the language that justifies condemning unseen mechanicals. A
// dented or cracked face panel does not; crushed/caved/collision force does.
const STRONG_COLLISION = /crush|caved|collision|impact|torn|missing|frame|airbag/i;

const behindNote = (face: ImpactFace) =>
  ` Behind the ${face} impact — collision force typically reaches this part. Assume affected until inspected; regrade after verification.`;
const faceNote = (face: ImpactFace) =>
  ` In the ${face} impact's crumple zone — verify condition before pricing.`;

// APPLY FRONT/REAR IMPACT-FACE DAMAGE across the FINAL part list (after inferred
// powertrain parts are appended). Pure and idempotent, same contract as
// propagateImpactDamage: unchanged parts keep their references.
export function applyImpactFaceDamage<T extends Part>(parts: T[]): T[] {
  if (!Array.isArray(parts) || parts.length === 0) return parts;

  const bases = parts.map((p) => baseKey(p.partName));

  // Detect each face and whether any of its origins shows STRONG collision force.
  const faces = new Map<ImpactFace, { strong: boolean }>();
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!isImpactOrigin(p)) continue;
    for (const face of ["front", "rear"] as const) {
      if (!FACE_ORIGIN[face].test(bases[i])) continue;
      const strong =
        STRONG_COLLISION.test(`${p.conditionNotes ?? ""} ${p.description ?? ""}`) ||
        (!!p.damageCode && /^CR\b/i.test(p.damageCode.trim()));
      const prev = faces.get(face);
      faces.set(face, { strong: (prev?.strong ?? false) || strong });
    }
  }
  if (faces.size === 0) return parts;

  return parts.map((p, idx) => {
    if (isImpactOrigin(p)) return p; // origins are already Grade C — untouched
    for (const [face, { strong }] of faces) {
      // 2) Mechanicals behind a STRONG hit → Grade C, unpriced, verify-first.
      if (strong && BEHIND[face].test(bases[idx]) && (p.condition === "A" || p.condition === "B")) {
        const note = behindNote(face);
        const prevNotes = p.conditionNotes ?? "";
        const flags = new Set(p.lowConfidenceFields ?? []);
        flags.add("condition");
        flags.add("suggestedPriceUsd");
        return {
          ...p,
          condition: "C" as const,
          suggestedPriceUsd: null,
          confidence: "low" as const,
          conditionNotes: prevNotes.includes(note.trim()) ? prevNotes : `${prevNotes}${note}`.replace(/^\s+/, ""),
          lowConfidenceFields: [...flags],
        };
      }
      // 3) The face's other body parts → the softer zone treatment.
      if (FACE_SPREAD[face].test(bases[idx]) && (p.condition === "A" || p.condition === "B")) {
        const note = faceNote(face);
        const prevNotes = p.conditionNotes ?? "";
        const flags = new Set(p.lowConfidenceFields ?? []);
        flags.add("condition");
        flags.add("suggestedPriceUsd");
        return {
          ...p,
          condition: (p.condition === "A" ? "B" : p.condition) as T["condition"],
          suggestedPriceUsd: null,
          confidence: "low" as const,
          conditionNotes: prevNotes.includes(note.trim()) ? prevNotes : `${prevNotes}${note}`.replace(/^\s+/, ""),
          lowConfidenceFields: [...flags],
        };
      }
    }
    return p;
  });
}

export function propagateImpactDamage<T extends Part>(parts: T[]): T[] {
  if (!Array.isArray(parts) || parts.length === 0) return parts;

  // Precompute side + base key per part once.
  const meta = parts.map((p) => ({ side: sideOf(p.partName), base: baseKey(p.partName) }));
  const origins = parts.map(isImpactOrigin);

  // Collect the indices to pull into a zone. A part can be reached from several origins;
  // a Set keeps it single. Origins themselves are never added (they're Grade C already).
  const inZone = new Set<number>();
  for (let i = 0; i < parts.length; i++) {
    if (!origins[i]) continue;
    const neighbors = ADJ.get(meta[i].base);
    if (!neighbors) continue;
    const originSide = meta[i].side;
    if (originSide === null) continue; // a center origin has no SAME-SIDE neighbors

    for (let j = 0; j < parts.length; j++) {
      if (j === i || origins[j]) continue;
      if (meta[j].side !== originSide) continue;        // same side only
      if (!neighbors.has(meta[j].base)) continue;       // must be an adjacent panel
      const cond = parts[j].condition;
      if (cond !== "A" && cond !== "B") continue;       // only optimistic grades
      inZone.add(j);
    }
  }

  if (inZone.size === 0) return parts; // clean car / nothing adjacent → untouched array

  return parts.map((p, idx) => {
    if (!inZone.has(idx)) return p; // unchanged parts keep their original reference

    const nextCondition = p.condition === "A" ? "B" : p.condition;

    // Append the zone note once — idempotent across re-runs.
    const prevNotes = p.conditionNotes ?? "";
    const conditionNotes = prevNotes.includes(ZONE_NOTE.trim())
      ? prevNotes
      : `${prevNotes}${ZONE_NOTE}`.replace(/^\s+/, "");

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
