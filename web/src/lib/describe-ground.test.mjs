// Unit tests for the grounded-descriptions pass. Runs with plain `node`:
//
//   node web/src/lib/describe-ground.test.mjs
//
// Node (>=22.6 with type-stripping, default-on in Node 24) imports the real .ts module
// directly, so these assertions exercise the actual shipped code — not a copy.
import assert from "node:assert/strict";
import {
  groundDescriptions,
  isExteriorBodyPanel,
  HEDGE_NOTE,
} from "./describe-ground.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const hedge = HEDGE_NOTE.trim();
const countHedges = (s) => (s ?? "").split(hedge).length - 1;

console.log("describe-ground:");

// ── isExteriorBodyPanel ──────────────────────────────────────────────────────────

// 1) Painted sheet metal → true.
test("isExteriorBodyPanel — body panels are true", () => {
  for (const n of [
    "Driver Side Front Door",
    "Passenger Side Rear Door",
    "Front Fender",
    "Hood",
    "Rear Quarter Panel",
    "Front Bumper Cover",
    "Tailgate",
    "Liftgate",
    "Trunk Lid",
    "Driver Side Rocker Panel",
    "Roof Panel",
  ]) {
    assert.equal(isExteriorBodyPanel(n), true, `${n} should be a body panel`);
  }
});

// 2) Glass, lights, mirror, wheels, and interior/mechanical parts → false. These keep
//    their own colors and must NOT be recolored. Includes the door-mounted look-alikes
//    ("Front Door Glass", "Door Handle", interior "Door Panel") that contain "door".
test("isExteriorBodyPanel — non-body parts are false", () => {
  for (const n of [
    "Windshield",
    "Back Glass",
    "Driver Side Front Door Glass",
    "Front Door Window",
    "Driver Side Door Handle",
    "Front Door Panel", // interior trim panel, not the shell
    "Driver Side Headlight Assembly",
    "Tail Light",
    "Driver Side Mirror",
    "Front Driver Wheel",
    "Rear Tire",
    "Dashboard",
    "Driver Seat",
    "Engine",
  ]) {
    assert.equal(isExteriorBodyPanel(n), false, `${n} should NOT be a body panel`);
  }
});

// ── COLOR LOCK ─────────────────────────────────────────────────────────────────────

// 3) A body panel whose description names a DIFFERENT color → swapped to the locked color,
//    surrounding text preserved exactly. "metallic green" (finish + base) becomes the
//    whole locked color, not "metallic Silver".
test('color lock — door "metallic green, minor scuff" + Silver → "Silver, minor scuff"', () => {
  const input = [
    { partName: "Driver Side Front Door", description: "metallic green, minor scuff" },
  ];
  const [out] = groundDescriptions(input, { bodyColor: "Silver" });
  assert.equal(out.description, "Silver, minor scuff");
});

// 4) Glass keeps its own color — a Windshield "green tint" with bodyColor Silver is
//    UNCHANGED (and returned as the same object reference, since nothing changed).
test('color lock — Windshield "green tint" + Silver → UNCHANGED (glass keeps its color)', () => {
  const input = [{ partName: "Windshield", description: "green tint, small chip" }];
  const out = groundDescriptions(input, { bodyColor: "Silver" });
  assert.equal(out[0].description, "green tint, small chip");
  assert.equal(out[0], input[0], "unchanged part returns the original reference");
});

// 5) A body panel with NO color word → text unchanged (we never INJECT a color).
test("color lock — body panel with no color word → unchanged", () => {
  const input = [{ partName: "Hood", description: "light dent near the latch" }];
  const [out] = groundDescriptions(input, { bodyColor: "Silver" });
  assert.equal(out.description, "light dent near the latch");
});

// 6) A body panel already the locked color → unchanged text (idempotent, no churn).
test("color lock — panel already the locked color → unchanged", () => {
  const input = [{ partName: "Front Fender", description: "Silver, clean" }];
  const [out] = groundDescriptions(input, { bodyColor: "Silver" });
  assert.equal(out.description, "Silver, clean");
});

// 7) No bodyColor set → color lock is a no-op even on a conflicting body panel.
test("color lock — no bodyColor → no recolor", () => {
  const input = [{ partName: "Hood", description: "bronze, straight" }];
  const [out] = groundDescriptions(input, { bodyColor: null });
  assert.equal(out.description, "bronze, straight");
});

// 8) The motivating bug: same car scanned "gray" on the door and "bronze" on the hood →
//    both locked to the reconciled Silver; glass untouched.
test('color lock — reconciles "gray" door + "bronze" hood to one Silver', () => {
  const input = [
    { partName: "Driver Side Front Door", description: "gray, clean" },
    { partName: "Hood", description: "bronze paint, straight" },
    { partName: "Windshield", description: "light green tint" },
  ];
  const out = groundDescriptions(input, { bodyColor: "Silver" });
  assert.equal(out[0].description, "Silver, clean");
  assert.equal(out[1].description, "Silver paint, straight");
  assert.equal(out[2].description, "light green tint"); // glass keeps its color
});

// ── HEDGING ─────────────────────────────────────────────────────────────────────────

// 9) A tiny detection box (area 0.01 < 0.02) → hedge appended.
test("hedging — box area 0.01 → hedge appended", () => {
  const input = [
    { partName: "Rear Bumper Cover", description: "no visible damage", box: [0.89, 0.89, 0.99, 0.99] },
  ];
  const [out] = groundDescriptions(input, { bodyColor: null });
  assert.ok(out.description.endsWith(HEDGE_NOTE), "ends with hedge");
  assert.equal(countHedges(out.description), 1);
});

// 10) confidence "low" → hedge appended (even with a large box).
test('hedging — confidence "low" → hedge appended', () => {
  const input = [
    { partName: "Grille", description: "intact", box: [0.2, 0.3, 0.5, 0.4], confidence: "low" },
  ];
  const [out] = groundDescriptions(input, { bodyColor: null });
  assert.ok(out.description.endsWith(HEDGE_NOTE));
  assert.equal(countHedges(out.description), 1);
});

// 11) Large box + high confidence → NO hedge.
test("hedging — large box, high confidence → no hedge", () => {
  const input = [
    { partName: "Hood", description: "clean, straight", box: [0.1, 0.1, 0.6, 0.5], confidence: "high" },
  ];
  const out = groundDescriptions(input, { bodyColor: null });
  assert.equal(out[0].description, "clean, straight");
  assert.equal(out[0], input[0], "unchanged part returns the original reference");
});

// 12) Occluded part with no description → hedge becomes the description (trimmed clean).
test("hedging — occluded part with no description → hedge only, no leading space", () => {
  const input = [{ partName: "Fog Light", box: [0.9, 0.9, 0.95, 0.95] }];
  const [out] = groundDescriptions(input, { bodyColor: null });
  assert.equal(out.description, HEDGE_NOTE.trim());
});

// 13) Idempotency — running twice equals running once; hedge appears exactly once and
//     colors don't churn. Mixes a recolored panel, a hedged part, and an untouched part.
test("idempotent — second pass is a no-op (no double hedge, no re-swap)", () => {
  const input = [
    { partName: "Driver Side Front Door", description: "metallic green, minor scuff" },
    { partName: "Rear Bumper Cover", description: "no visible damage", box: [0.89, 0.89, 0.99, 0.99] },
    { partName: "Windshield", description: "green tint" },
    { partName: "Hood", description: "clean", box: [0.1, 0.1, 0.6, 0.5], confidence: "high" },
  ];
  const once = groundDescriptions(input, { bodyColor: "Silver" });
  const twice = groundDescriptions(once, { bodyColor: "Silver" });
  assert.deepEqual(twice, once, "second pass changed nothing");
  assert.equal(once[0].description, "Silver, minor scuff");
  assert.equal(countHedges(once[1].description), 1, "hedge appended exactly once");
});

// 14) A part that is BOTH a conflicting-color panel AND occluded gets both fixes at once.
test("combined — occluded body panel with wrong color gets recolored AND hedged", () => {
  const input = [
    { partName: "Driver Side Fender", description: "bronze, scraped", box: [0.9, 0.5, 0.98, 0.6] },
  ];
  const [out] = groundDescriptions(input, { bodyColor: "White" });
  assert.equal(out.description, `White, scraped${HEDGE_NOTE}`);
  assert.equal(countHedges(out.description), 1);
});

// ── PURITY ───────────────────────────────────────────────────────────────────────────

// 15) No input mutation — neither the array nor its objects change.
test("pure — does not mutate input", () => {
  const input = [
    { partName: "Driver Side Front Door", description: "metallic green, minor scuff" },
    { partName: "Rear Bumper Cover", description: "no visible damage", box: [0.89, 0.89, 0.99, 0.99] },
    { partName: "Windshield", description: "green tint" },
  ];
  const snapshot = JSON.parse(JSON.stringify(input));
  const out = groundDescriptions(input, { bodyColor: "Silver" });
  assert.deepEqual(input, snapshot, "input untouched");
  assert.notEqual(out[0], input[0], "changed part is a fresh object, not the original");
});

console.log(`\n${passed} passed`);
