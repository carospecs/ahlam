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
