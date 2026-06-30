// Standalone node test for impact-zone damage propagation.
//   run:  node web/src/lib/damage-zones.test.mjs
//
// damage-zones.ts is TypeScript and imports via the "@/..." path alias, so it can't be
// loaded by plain node without a build. The logic below is a faithful, self-contained
// re-implementation of web/src/lib/damage-zones.ts (and the `stripSide` helper it reuses
// from part-enrich.ts). If you change the source, mirror it here. The asserts are the
// real contract: the founder's exact failure case, idempotency, and a clean car.
//
// KEEP IN SYNC WITH: web/src/lib/damage-zones.ts, web/src/lib/part-enrich.ts (stripSide)

import assert from "node:assert/strict";

// ── mirror of part-enrich.ts `stripSide` ──
function stripSide(name) {
  return name
    .replace(/\b(driver'?s?|passenger'?s?)(?:[ -]side(?!\s+mirror\b))?\b/gi, "")
    .replace(/\b(left|right|lh|rh)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── mirror of damage-zones.ts ──
function sideOf(partName) {
  if (/passenger|right/i.test(partName)) return "R";
  if (/driver|left/i.test(partName)) return "L";
  return null;
}
function baseKey(partName) {
  return stripSide(partName).toLowerCase().replace(/\s{2,}/g, " ").trim();
}

const ADJACENCY = {
  "front fender": ["front door", "fender"],
  fender: ["front door"],
  "front door": ["front fender", "fender", "rear door", "rocker panel"],
  "rear door": ["front door", "rear quarter panel", "quarter panel", "rocker panel"],
  "rear quarter panel": ["rear door"],
  "quarter panel": ["rear door"],
  "rocker panel": ["front door", "rear door"],
  "front door window": ["front door"],
  "front door glass": ["front door"],
  "front door panel": ["front door"],
  "front door handle": ["front door"],
  "front door trim": ["front door"],
  "side mirror": ["front door"],
  mirror: ["front door"],
  "rear door window": ["rear door"],
  "rear door glass": ["rear door"],
  "rear door panel": ["rear door"],
  "rear door handle": ["rear door"],
  "rear door trim": ["rear door"],
  "door window": ["front door", "rear door"],
  "door glass": ["front door", "rear door"],
  "door handle": ["front door", "rear door"],
  "door panel": ["front door", "rear door"],
};

const ADJ = (() => {
  const m = new Map();
  const link = (a, b) => {
    if (a === b) return;
    let s = m.get(a);
    if (!s) m.set(a, (s = new Set()));
    s.add(b);
  };
  for (const [name, neighbors] of Object.entries(ADJACENCY)) {
    for (const n of neighbors) {
      link(name, n);
      link(n, name);
    }
  }
  return m;
})();

const COLLISION_TEXT = /damag|crush|caved|bent|crack|collision|impact|dent|torn|missing/i;
const COLLISION_CODE = /^(DT|BN|BR|CR)\b/i;

function isImpactOrigin(p) {
  if (p.condition !== "C") return false;
  if (p.damageCode && COLLISION_CODE.test(p.damageCode.trim())) return true;
  return COLLISION_TEXT.test(`${p.conditionNotes ?? ""} ${p.description ?? ""}`);
}

const ZONE_NOTE =
  " In the impact zone of an adjacent damaged panel — verify condition before pricing.";

function propagateImpactDamage(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return parts;

  const meta = parts.map((p) => ({ side: sideOf(p.partName), base: baseKey(p.partName) }));
  const origins = parts.map(isImpactOrigin);

  const inZone = new Set();
  for (let i = 0; i < parts.length; i++) {
    if (!origins[i]) continue;
    const neighbors = ADJ.get(meta[i].base);
    if (!neighbors) continue;
    const originSide = meta[i].side;
    if (originSide === null) continue;
    for (let j = 0; j < parts.length; j++) {
      if (j === i || origins[j]) continue;
      if (meta[j].side !== originSide) continue;
      if (!neighbors.has(meta[j].base)) continue;
      const cond = parts[j].condition;
      if (cond !== "A" && cond !== "B") continue;
      inZone.add(j);
    }
  }

  if (inZone.size === 0) return parts;

  return parts.map((p, idx) => {
    if (!inZone.has(idx)) return p;
    const nextCondition = p.condition === "A" ? "B" : p.condition;
    const prevNotes = p.conditionNotes ?? "";
    const conditionNotes = prevNotes.includes(ZONE_NOTE.trim())
      ? prevNotes
      : `${prevNotes}${ZONE_NOTE}`.replace(/^\s+/, "");
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

// ───────────────────────── helpers ─────────────────────────
let passed = 0;
function ok(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}
const find = (list, name) => {
  const p = list.find((x) => x.partName === name);
  assert.ok(p, `expected part "${name}" to be present`);
  return p;
};
// A neighbor pulled into the zone: not A, unpriced, low confidence, both fields flagged,
// and the verify-before-pricing note appended.
function assertInZone(p) {
  assert.notEqual(p.condition, "A", `${p.partName} must not stay "A"`);
  assert.equal(p.suggestedPriceUsd, null, `${p.partName} must be unpriced (null)`);
  assert.equal(p.confidence, "low", `${p.partName} must be low confidence`);
  assert.ok(
    (p.conditionNotes ?? "").includes("impact zone"),
    `${p.partName} must be flagged with the impact-zone note`,
  );
  assert.ok(p.lowConfidenceFields?.includes("condition"), `${p.partName} flags condition`);
  assert.ok(
    p.lowConfidenceFields?.includes("suggestedPriceUsd"),
    `${p.partName} flags suggestedPriceUsd`,
  );
}
function assertUnchanged(before, after) {
  assert.deepEqual(after, before, `${before.partName} must be UNCHANGED`);
}

console.log("propagateImpactDamage");

// ───────────────── 1) the founder's exact failure case ─────────────────
// Driver Side Front Door is wrecked (C). Same-side adjacent parts that the AI graded as
// pristine, firm-priced "A" must be pulled into the impact zone. Opposite-side / center /
// non-adjacent parts must be left exactly as-is.
const input = [
  { partName: "Driver Side Front Door", condition: "C", conditionNotes: "Driver door is caved in from a side impact.", damageCode: "DT-LR-4", description: "", suggestedPriceUsd: null, newPartPriceUsd: 900, confidence: "high" },
  { partName: "Driver Side Rear Door", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 638, newPartPriceUsd: 750, confidence: "high" },
  { partName: "Driver Side Front Door Window", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 128, newPartPriceUsd: 150, confidence: "high" },
  { partName: "Driver Side Mirror", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 383, newPartPriceUsd: 450, confidence: "high" },
  { partName: "Passenger Side Front Door", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 700, newPartPriceUsd: 820, confidence: "high" },
  { partName: "Tailgate", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 1020, newPartPriceUsd: 1200, confidence: "high" },
  { partName: "Hood", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 765, newPartPriceUsd: 900, confidence: "high" },
];
// Deep snapshot BEFORE, to prove purity (no input mutation) and to diff the untouched parts.
const inputSnapshot = structuredClone(input);

const out = propagateImpactDamage(input);

ok("Driver Side Rear Door is pulled into the zone (unpriced, not A, low, flagged)", () => {
  assertInZone(find(out, "Driver Side Rear Door"));
  assert.equal(find(out, "Driver Side Rear Door").condition, "B"); // A → B
});
ok("Driver Side Front Door Window is pulled into the zone", () => {
  assertInZone(find(out, "Driver Side Front Door Window"));
});
ok("Driver Side Mirror is pulled into the zone", () => {
  assertInZone(find(out, "Driver Side Mirror"));
});

ok("Passenger Side Front Door is UNCHANGED (opposite side)", () => {
  assertUnchanged(find(input, "Passenger Side Front Door"), find(out, "Passenger Side Front Door"));
  assert.equal(find(out, "Passenger Side Front Door").suggestedPriceUsd, 700);
});
ok("Tailgate is UNCHANGED (center, not adjacent)", () => {
  assertUnchanged(find(input, "Tailgate"), find(out, "Tailgate"));
  assert.equal(find(out, "Tailgate").suggestedPriceUsd, 1020);
});
ok("Hood is UNCHANGED (center, not adjacent)", () => {
  assertUnchanged(find(input, "Hood"), find(out, "Hood"));
  assert.equal(find(out, "Hood").suggestedPriceUsd, 765);
});
ok("the origin (Driver Side Front Door) is left as graded", () => {
  assertUnchanged(find(input, "Driver Side Front Door"), find(out, "Driver Side Front Door"));
});

// ───────────────── 2) purity ─────────────────
ok("input array + objects were NOT mutated (pure)", () => {
  assert.deepEqual(input, inputSnapshot, "input must not be mutated");
  assert.notEqual(out, input, "must return a new array");
  // Untouched parts keep their original object reference (no needless copies).
  assert.equal(
    out[input.findIndex((p) => p.partName === "Hood")],
    input[input.findIndex((p) => p.partName === "Hood")],
    "unchanged parts keep their reference",
  );
});

// ───────────────── 3) idempotency ─────────────────
ok("running twice yields the same result (idempotent)", () => {
  const once = propagateImpactDamage(structuredClone(input));
  const twice = propagateImpactDamage(once);
  assert.deepEqual(twice, once, "second pass must be a no-op");
  // The zone note must not be appended a second time.
  const door = find(twice, "Driver Side Rear Door");
  const notes = door.conditionNotes ?? "";
  const occurrences = notes.split("impact zone").length - 1;
  assert.equal(occurrences, 1, "zone note must appear exactly once after two passes");
  // Flags must not duplicate.
  assert.deepEqual(
    [...new Set(door.lowConfidenceFields)].sort(),
    [...door.lowConfidenceFields].sort(),
    "lowConfidenceFields must stay deduped",
  );
});

// ───────────────── 4) clean car (no C parts) ─────────────────
ok("a clean car (no C parts) returns everything unchanged", () => {
  const clean = [
    { partName: "Driver Side Front Door", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 500, newPartPriceUsd: 600, confidence: "high" },
    { partName: "Driver Side Rear Door", condition: "B", conditionNotes: "minor wear", damageCode: "", description: "", suggestedPriceUsd: 420, newPartPriceUsd: 600, confidence: "high" },
    { partName: "Hood", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 765, newPartPriceUsd: 900, confidence: "high" },
  ];
  const snap = structuredClone(clean);
  const res = propagateImpactDamage(clean);
  assert.equal(res, clean, "no C origins → exact same array reference back");
  assert.deepEqual(clean, snap, "clean car must not be mutated");
});

// ───────────────── 5) extra guards ─────────────────
ok("a C part with NO collision evidence is not an origin (no propagation)", () => {
  // Grade C from plain wear/cosmetics (no collision code, no collision words) must not
  // seed a zone — otherwise every worn-out panel would nuke its neighbors' prices.
  const list = [
    { partName: "Driver Side Front Door", condition: "C", conditionNotes: "faded paint, heavy surface rust", damageCode: "RU-LR-", description: "", suggestedPriceUsd: null, newPartPriceUsd: 900, confidence: "high" },
    { partName: "Driver Side Rear Door", condition: "A", conditionNotes: "", damageCode: "", description: "", suggestedPriceUsd: 638, newPartPriceUsd: 750, confidence: "high" },
  ];
  const snap = structuredClone(list);
  const res = propagateImpactDamage(list);
  assert.deepEqual(res, snap, "non-collision C must not propagate");
});
ok("collision evidence via notes text alone (no damageCode) still propagates", () => {
  const list = [
    { partName: "Driver Side Front Fender", condition: "C", conditionNotes: "crushed in a collision", suggestedPriceUsd: null, newPartPriceUsd: 400, confidence: "high" },
    { partName: "Driver Side Front Door", condition: "A", conditionNotes: "", suggestedPriceUsd: 638, newPartPriceUsd: 750, confidence: "high" },
  ];
  const res = propagateImpactDamage(list);
  assertInZone(find(res, "Driver Side Front Door"));
});
ok("rocker panel below the doors is in the zone; rear quarter via rear door chain", () => {
  const list = [
    { partName: "Driver Side Rear Door", condition: "C", conditionNotes: "bent and torn from impact", damageCode: "BN-RR-3", suggestedPriceUsd: null, newPartPriceUsd: 700, confidence: "high" },
    { partName: "Driver Side Rocker Panel", condition: "A", conditionNotes: "", suggestedPriceUsd: 210, newPartPriceUsd: 250, confidence: "high" },
    { partName: "Driver Side Rear Quarter Panel", condition: "A", conditionNotes: "", suggestedPriceUsd: 480, newPartPriceUsd: 560, confidence: "high" },
    { partName: "Driver Side Front Door", condition: "A", conditionNotes: "", suggestedPriceUsd: 638, newPartPriceUsd: 750, confidence: "high" },
    { partName: "Hood", condition: "A", conditionNotes: "", suggestedPriceUsd: 765, newPartPriceUsd: 900, confidence: "high" },
  ];
  const res = propagateImpactDamage(list);
  assertInZone(find(res, "Driver Side Rocker Panel"));
  assertInZone(find(res, "Driver Side Rear Quarter Panel"));
  assertInZone(find(res, "Driver Side Front Door"));
  assertUnchanged(find(list, "Hood"), find(res, "Hood")); // center, untouched
});

console.log(`\nAll ${passed} checks passed.`);
