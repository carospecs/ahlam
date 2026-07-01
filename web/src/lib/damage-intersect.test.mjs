// Standalone node test for pixel-accurate damage-zone intersection.
//   run:  node web/src/lib/damage-intersect.test.mjs
//
// damage-intersect.ts is TypeScript and exports types alongside functions, so plain node
// can't load it without a build. The two functions below are a faithful, self-contained
// re-implementation of web/src/lib/damage-intersect.ts. If you change the source, mirror it
// here — the asserts are the real contract: the overlap math, the severe/moderate downgrade
// rules, the sub-threshold / no-box pass-throughs, purity, idempotency, and empty zones.
//
// KEEP IN SYNC WITH: web/src/lib/damage-intersect.ts

import assert from "node:assert/strict";

// ── mirror of damage-intersect.ts ──
const OVERLAP_THRESHOLD = 0.2;
const DAMAGE_ZONE_NOTE = " In a detected damage area — verify condition before pricing.";
const SEVERITY_RANK = { moderate: 1, severe: 2 };

function boxArea(b) {
  return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
}

function boxOverlapFraction(part, zone) {
  const ix0 = Math.max(part[0], zone[0]);
  const iy0 = Math.max(part[1], zone[1]);
  const ix1 = Math.min(part[2], zone[2]);
  const iy1 = Math.min(part[3], zone[3]);
  if (ix1 <= ix0 || iy1 <= iy0) return 0;
  const partArea = boxArea(part);
  if (partArea <= 0) return 0;
  const interArea = (ix1 - ix0) * (iy1 - iy0);
  return interArea / partArea;
}

function applyDamageZones(parts, zones) {
  if (!Array.isArray(parts) || parts.length === 0) return parts;
  if (!Array.isArray(zones) || zones.length === 0) return parts;

  return parts.map((p) => {
    if (!p.box) return p;

    let worst = null;
    for (const zone of zones) {
      if (boxOverlapFraction(p.box, zone.box) < OVERLAP_THRESHOLD) continue;
      if (worst === null || SEVERITY_RANK[zone.severity] > SEVERITY_RANK[worst]) {
        worst = zone.severity;
      }
    }

    if (worst === null) return p;

    const nextCondition =
      worst === "severe" ? "C" : p.condition === "A" ? "B" : p.condition;

    const prevNotes = p.conditionNotes ?? "";
    const conditionNotes = prevNotes.includes(DAMAGE_ZONE_NOTE.trim())
      ? prevNotes
      : `${prevNotes}${DAMAGE_ZONE_NOTE}`.replace(/^\s+/, "");

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

// ── tiny test harness ──
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}
// float compare helper for the geometric fractions
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── boxOverlapFraction geometry ──

test("part box fully inside zone → 1.0", () => {
  // small part entirely within a big zone → all of the part is inside
  const part = [0.4, 0.4, 0.5, 0.5];
  const zone = [0.0, 0.0, 1.0, 1.0];
  assert.equal(boxOverlapFraction(part, zone), 1.0);
});

test("part box half inside zone ≈ 0.5", () => {
  // part spans x 0.0–0.4; zone starts at x 0.2 → exactly the right half (0.2–0.4) overlaps
  const part = [0.0, 0.0, 0.4, 1.0];
  const zone = [0.2, 0.0, 1.0, 1.0];
  assert.ok(near(boxOverlapFraction(part, zone), 0.5), "expected ~0.5");
});

test("disjoint boxes → 0", () => {
  const part = [0.0, 0.0, 0.1, 0.1];
  const zone = [0.5, 0.5, 0.9, 0.9];
  assert.equal(boxOverlapFraction(part, zone), 0);
});

test("edge-touching boxes → 0 (no positive-area overlap)", () => {
  const part = [0.0, 0.0, 0.5, 0.5];
  const zone = [0.5, 0.0, 1.0, 0.5]; // shares only the x=0.5 edge
  assert.equal(boxOverlapFraction(part, zone), 0);
});

test("fraction is the PART's area (zone bigger part smaller) → 1.0, and denominator is part not zone", () => {
  // a small part inside a large zone is fully covered (1.0) regardless of zone size…
  const smallPart = [0.45, 0.45, 0.55, 0.55];
  const bigZone = [0.0, 0.0, 1.0, 1.0];
  assert.equal(boxOverlapFraction(smallPart, bigZone), 1.0);
  // …while a big part clipped by a small zone reads a SMALL fraction (proves the
  // denominator is the part's area, not the intersection over the zone).
  const bigPart = [0.0, 0.0, 1.0, 1.0];
  const smallZone = [0.45, 0.45, 0.55, 0.55]; // 0.01 area out of the part's 1.0
  assert.ok(near(boxOverlapFraction(bigPart, smallZone), 0.01), "expected ~0.01");
});

// ── applyDamageZones behavior ──

// A Grade-A part whose box sits INSIDE a SEVERE zone.
const severeZone = [{ box: [0.0, 0.0, 1.0, 1.0], severity: "severe" }];
const gradeAInSevere = {
  partName: "Driver Side Front Door",
  box: [0.4, 0.4, 0.5, 0.5],
  condition: "A",
  conditionNotes: "Looks clean.",
  suggestedPriceUsd: 220,
  confidence: "high",
  lowConfidenceFields: [],
};

test("Grade-A in SEVERE zone → C, unpriced, low confidence, note appended, flags added", () => {
  const [out] = applyDamageZones([gradeAInSevere], severeZone);
  assert.equal(out.condition, "C");
  assert.equal(out.suggestedPriceUsd, null);
  assert.equal(out.confidence, "low");
  assert.ok(out.conditionNotes.includes(DAMAGE_ZONE_NOTE.trim()), "note appended");
  assert.ok(out.conditionNotes.startsWith("Looks clean."), "prior note preserved");
  assert.deepEqual(
    [...out.lowConfidenceFields].sort(),
    ["condition", "suggestedPriceUsd"],
    "flags added",
  );
});

test("Grade-A in MODERATE zone → B (not C), unpriced, flagged", () => {
  const moderateZone = [{ box: [0.0, 0.0, 1.0, 1.0], severity: "moderate" }];
  const [out] = applyDamageZones([gradeAInSevere], moderateZone);
  assert.equal(out.condition, "B"); // downgraded off A but NOT to C
  assert.equal(out.suggestedPriceUsd, null);
  assert.equal(out.confidence, "low");
  assert.ok(out.lowConfidenceFields.includes("condition"));
  assert.ok(out.lowConfidenceFields.includes("suggestedPriceUsd"));
});

test("Grade-B in MODERATE zone stays B (moderate never upgrades severity)", () => {
  const moderateZone = [{ box: [0.0, 0.0, 1.0, 1.0], severity: "moderate" }];
  const partB = { ...gradeAInSevere, condition: "B", suggestedPriceUsd: 180 };
  const [out] = applyDamageZones([partB], moderateZone);
  assert.equal(out.condition, "B");
  assert.equal(out.suggestedPriceUsd, null); // still unpriced + flagged
});

test("part overlapping BOTH moderate and severe → most severe wins (C)", () => {
  const both = [
    { box: [0.0, 0.0, 1.0, 1.0], severity: "moderate" },
    { box: [0.0, 0.0, 1.0, 1.0], severity: "severe" },
  ];
  const [out] = applyDamageZones([gradeAInSevere], both);
  assert.equal(out.condition, "C");
});

test("part barely clipping a zone (<20% overlap) → UNCHANGED (same reference)", () => {
  // part is the full image; the zone covers only a 0.1×0.1 = 0.01 corner → 1% overlap
  const clip = [{ box: [0.0, 0.0, 0.1, 0.1], severity: "severe" }];
  const bigPart = {
    partName: "Hood",
    box: [0.0, 0.0, 1.0, 1.0],
    condition: "A",
    suggestedPriceUsd: 300,
    confidence: "high",
    lowConfidenceFields: [],
  };
  const input = [bigPart];
  const out = applyDamageZones(input, clip);
  assert.equal(out[0], bigPart, "same object reference returned (untouched)");
  assert.equal(out[0].condition, "A");
  assert.equal(out[0].suggestedPriceUsd, 300);
});

test("overlap exactly at the 20% threshold → downgraded (≥ is inclusive)", () => {
  // part x 0.0–1.0, y 0.0–1.0 (area 1.0); zone covers x 0.0–0.2 full height → 0.2 overlap
  const atThreshold = [{ box: [0.0, 0.0, 0.2, 1.0], severity: "severe" }];
  const part = {
    partName: "Fender",
    box: [0.0, 0.0, 1.0, 1.0],
    condition: "A",
    suggestedPriceUsd: 150,
    confidence: "high",
    lowConfidenceFields: [],
  };
  const [out] = applyDamageZones([part], atThreshold);
  assert.equal(out.condition, "C", "exactly 20% counts as overlapping");
});

test("part with NO box → UNCHANGED (same reference)", () => {
  const noBox = {
    partName: "Airbag",
    condition: "A",
    suggestedPriceUsd: 90,
    confidence: "high",
    lowConfidenceFields: [],
  };
  const input = [noBox];
  const out = applyDamageZones(input, severeZone);
  assert.equal(out[0], noBox, "part without a box is returned by its original reference");
  assert.equal(out[0].condition, "A");
  assert.equal(out[0].suggestedPriceUsd, 90);
});

test("empty zones → everything unchanged (same array reference)", () => {
  const input = [gradeAInSevere];
  const out = applyDamageZones(input, []);
  assert.equal(out, input, "empty zones returns the input array untouched");
});

test("PURE — input parts are not mutated", () => {
  const original = {
    partName: "Driver Side Front Door",
    box: [0.4, 0.4, 0.5, 0.5],
    condition: "A",
    conditionNotes: "Looks clean.",
    suggestedPriceUsd: 220,
    confidence: "high",
    lowConfidenceFields: [],
  };
  const snapshot = JSON.parse(JSON.stringify(original));
  applyDamageZones([original], severeZone);
  assert.deepEqual(original, snapshot, "the input object was left exactly as it was");
  assert.equal(original.lowConfidenceFields.length, 0, "input's flag array untouched");
});

test("IDEMPOTENT — second run makes no further change", () => {
  const once = applyDamageZones([gradeAInSevere], severeZone);
  const twice = applyDamageZones(once, severeZone);
  assert.deepEqual(twice[0], once[0], "re-running over its own output is a no-op");
  // the note must appear exactly once, not doubled
  const occurrences = twice[0].conditionNotes.split(DAMAGE_ZONE_NOTE.trim()).length - 1;
  assert.equal(occurrences, 1, "damage note is present exactly once after two runs");
});

test("mixed list — only the overlapping, boxed part changes; others keep their refs", () => {
  const zone = [{ box: [0.0, 0.0, 0.3, 0.3], severity: "severe" }];
  const hit = {
    partName: "Driver Side Front Fender",
    box: [0.05, 0.05, 0.25, 0.25], // fully inside the zone
    condition: "A",
    suggestedPriceUsd: 150,
    confidence: "high",
    lowConfidenceFields: [],
  };
  const faraway = {
    partName: "Passenger Side Rear Door",
    box: [0.7, 0.7, 0.9, 0.9], // disjoint from the zone
    condition: "A",
    suggestedPriceUsd: 200,
    confidence: "high",
    lowConfidenceFields: [],
  };
  const noBox = { partName: "Battery", condition: "B", suggestedPriceUsd: 60 };
  const out = applyDamageZones([hit, faraway, noBox], zone);
  assert.equal(out[0].condition, "C"); // the hit part downgraded
  assert.equal(out[0].suggestedPriceUsd, null);
  assert.equal(out[1], faraway, "disjoint part untouched (same ref)");
  assert.equal(out[2], noBox, "boxless part untouched (same ref)");
});

console.log(`\n${passed} tests passed.`);
