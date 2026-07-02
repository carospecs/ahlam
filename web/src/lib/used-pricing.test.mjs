// Unit tests for the used-market pricing core. Runs with plain `node`:
//
//   node web/src/lib/used-pricing.test.mjs
import assert from "node:assert/strict";
import {
  partClass,
  usedPointFromBand,
  usedPointFallback,
  gradeAdjustUsed,
  CLASS_QUANTILE,
} from "./used-pricing.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("used-pricing:");

// ── partClass ────────────────────────────────────────────────────────────────

test("large painted panels classify as painted-panel", () => {
  for (const name of ["Liftgate", "Hood", "Driver Side Front Door", "Rear Quarter Panel", "Front Fender", "Front Bumper Cover", "Tailgate", "Roof Panel"]) {
    assert.equal(partClass(name), "painted-panel", name);
  }
});

test("interior door trim and door glass are NOT painted panels", () => {
  assert.notEqual(partClass("Door Panel"), "painted-panel");
  assert.notEqual(partClass("Front Door Window"), "painted-panel");
  assert.notEqual(partClass("Door Handle"), "painted-panel");
  assert.notEqual(partClass("Side Mirror"), "painted-panel");
});

test("panel-word + small-part-word names are fast movers, not panels (stress-test regression)", () => {
  assert.equal(partClass("Liftgate Glass"), "fast-mover");
  assert.equal(partClass("Hood Latch"), "fast-mover");
  assert.equal(partClass("Charge Port Door"), "fast-mover");
  assert.equal(partClass("Door Lock Actuator"), "fast-mover");
});

test("powertrain parts classify as powertrain", () => {
  for (const name of ["Engine", "Transmission", "High-Voltage Battery Pack", "Rear Drive Unit (Motor)", "Onboard Charger", "Inverter / DC-DC Converter", "Catalytic Converter"]) {
    assert.equal(partClass(name), "powertrain", name);
  }
});

test("fast movers classify as fast-mover; the rest default", () => {
  for (const name of ["Side Mirror", "Headlight Assembly", "Windshield", "Instrument Cluster", "Wheel / Rim", "Tire"]) {
    assert.equal(partClass(name), "fast-mover", name);
  }
  assert.equal(partClass("Front Seat"), "default");
});

// ── band positioning ─────────────────────────────────────────────────────────

test("painted panels price at the LOW end of the band (q=0.20)", () => {
  // $400–$900 used band for a door → 400 + 0.2×500 = $500, not the $650 midpoint.
  assert.equal(usedPointFromBand(400, 900, "painted-panel"), 500);
});

test("fast movers price at the middle; default between", () => {
  assert.equal(usedPointFromBand(100, 300, "fast-mover"), 200);
  assert.equal(usedPointFromBand(100, 300, "default"), 170);
});

test("quantiles are ordered: panels < default < powertrain < fast", () => {
  assert.ok(CLASS_QUANTILE["painted-panel"] < CLASS_QUANTILE.default);
  assert.ok(CLASS_QUANTILE.default < CLASS_QUANTILE.powertrain);
  assert.ok(CLASS_QUANTILE.powertrain < CLASS_QUANTILE["fast-mover"]);
});

test("degenerate band (high ≤ low) returns low", () => {
  assert.equal(usedPointFromBand(500, 500, "fast-mover"), 500);
});

test("no band: painted panels get the 25% haircut, others pass through", () => {
  assert.equal(usedPointFallback(1000, "painted-panel"), 750);
  assert.equal(usedPointFallback(1000, "powertrain"), 1000);
});

// ── gradeAdjustUsed ──────────────────────────────────────────────────────────

test("grade factors: A ×1.15, B ×1.0, C null", () => {
  assert.equal(gradeAdjustUsed(1000, "A"), 1150);
  assert.equal(gradeAdjustUsed(1000, "B"), 1000);
  assert.equal(gradeAdjustUsed(1000, "C"), null);
});

test("null/invalid base → null (never invents a price)", () => {
  assert.equal(gradeAdjustUsed(null, "B"), null);
  assert.equal(gradeAdjustUsed(0, "A"), null);
  assert.equal(gradeAdjustUsed(-5, "B"), null);
});

// ── the Model X regression, end to end in miniature ──────────────────────────

test("Model X liftgate: $7,650–$9,350 'retail' band → low-end used point, not near retail", () => {
  // Even if the model returned an inflated band, the class curve pins the point at
  // the low end: 7650 + 0.2×1700 = 7990 (vs 8500 midpoint). With an honest USED
  // band ($800–$2,000) it prices at $1,040 — the realistic recovery.
  assert.equal(usedPointFromBand(7650, 9350, "painted-panel"), 7990);
  assert.equal(usedPointFromBand(800, 2000, "painted-panel"), 1040);
});

console.log(`used-pricing: ${passed} passed`);
