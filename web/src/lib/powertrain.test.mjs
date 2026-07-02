// Unit tests for powertrain typing + part-existence rules. Runs with plain `node`:
//
//   node web/src/lib/powertrain.test.mjs
import assert from "node:assert/strict";
import {
  classifyPowertrain,
  isImpossiblePart,
  expectedPowertrainParts,
  ensurePowertrainParts,
} from "./powertrain.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("powertrain:");

// ── classifyPowertrain ───────────────────────────────────────────────────────

test("NHTSA electrification 'BEV' → bev, source vin", () => {
  assert.deepEqual(
    classifyPowertrain({ make: "TESLA", model: "Model X", electrificationLevel: "BEV (Battery Electric Vehicle)" }),
    { type: "bev", source: "vin" },
  );
});

test("NHTSA electric primary + gasoline secondary → hybrid (PHEV)", () => {
  const r = classifyPowertrain({ fuelType: "Electric", fuelTypeSecondary: "Gasoline" });
  assert.equal(r.type, "hybrid");
  assert.equal(r.source, "vin");
});

test("NHTSA gasoline, no electrification → ice", () => {
  assert.deepEqual(classifyPowertrain({ make: "TOYOTA", model: "Tacoma", fuelType: "Gasoline" }), { type: "ice", source: "vin" });
});

test("no NHTSA fields: Tesla by name → bev; Prius → hybrid; unknown → default ice", () => {
  assert.equal(classifyPowertrain({ make: "Tesla", model: "Model X" }).type, "bev");
  assert.equal(classifyPowertrain({ make: "Chevrolet", model: "Bolt EUV" }).type, "bev");
  assert.equal(classifyPowertrain({ make: "Toyota", model: "Prius" }).type, "hybrid");
  assert.equal(classifyPowertrain({ make: "Honda", model: "Accord Hybrid" }).type, "hybrid");
  const unknown = classifyPowertrain({ make: "Honda", model: "Accord" });
  assert.equal(unknown.type, "ice");
  assert.equal(unknown.source, "default");
});

// ── isImpossiblePart ─────────────────────────────────────────────────────────

test("BEV: catalytic converter / transmission / engine / fuel pump are impossible", () => {
  for (const name of ["Catalytic Converter", "Transmission", "Engine", "Fuel Pump", "Alternator", "Muffler"]) {
    assert.equal(isImpossiblePart(name, "bev"), true, name);
  }
});

test("BEV: 12V Battery, Radiator, and body parts stay allowed", () => {
  for (const name of ["Battery", "Radiator", "Front Bumper Cover", "High-Voltage Battery Pack"]) {
    assert.equal(isImpossiblePart(name, "bev"), false, name);
  }
});

test("ICE: drive units / battery pack / onboard charger are impossible; engine allowed", () => {
  assert.equal(isImpossiblePart("Rear Drive Unit (Motor)", "ice"), true);
  assert.equal(isImpossiblePart("High-Voltage Battery Pack", "ice"), true);
  assert.equal(isImpossiblePart("Onboard Charger", "ice"), true);
  assert.equal(isImpossiblePart("Engine", "ice"), false);
  assert.equal(isImpossiblePart("Battery", "ice"), false); // the 12V battery
});

test("hybrid: both part families allowed", () => {
  assert.equal(isImpossiblePart("Engine", "hybrid"), false);
  assert.equal(isImpossiblePart("Catalytic Converter", "hybrid"), false);
  assert.equal(isImpossiblePart("Hybrid Battery Pack", "hybrid"), false);
});

// ── expectedPowertrainParts ──────────────────────────────────────────────────

test("BEV expects battery pack + rear drive unit + charger + inverter; AWD adds front unit", () => {
  const rwd = expectedPowertrainParts("bev").map((p) => p.partName);
  assert.ok(rwd.includes("High-Voltage Battery Pack"));
  assert.ok(rwd.includes("Rear Drive Unit (Motor)"));
  assert.ok(!rwd.includes("Front Drive Unit (Motor)"));
  const awd = expectedPowertrainParts("bev", { awd: true }).map((p) => p.partName);
  assert.ok(awd.includes("Front Drive Unit (Motor)"));
});

test("ICE expects engine + transmission; hybrid adds the hybrid battery pack", () => {
  assert.deepEqual(expectedPowertrainParts("ice").map((p) => p.partName), ["Engine", "Transmission"]);
  assert.ok(expectedPowertrainParts("hybrid").map((p) => p.partName).includes("Hybrid Battery Pack"));
});

// ── ensurePowertrainParts ────────────────────────────────────────────────────

const mk = (e) => ({ partName: e.partName, inferred: true });

test("Model X scan: cat converter dropped, battery pack + drive units appended", () => {
  const scanned = [
    { partName: "Liftgate" },
    { partName: "Catalytic Converter" }, // hallucination on a BEV
    { partName: "Driver Side Front Door" },
  ];
  const { parts, added, dropped } = ensurePowertrainParts(scanned, "bev", mk, { awd: true });
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].partName, "Catalytic Converter");
  const names = parts.map((p) => p.partName);
  assert.ok(!names.includes("Catalytic Converter"));
  assert.ok(names.includes("High-Voltage Battery Pack"));
  assert.ok(names.includes("Front Drive Unit (Motor)"));
  assert.ok(names.includes("Rear Drive Unit (Motor)"));
  assert.ok(added.every((p) => p.inferred), "appended parts are inferred");
});

test("already-detected parts are not duplicated", () => {
  const scanned = [{ partName: "Engine — 3.5L V6" }, { partName: "Transmission" }];
  const { added } = ensurePowertrainParts(scanned, "ice", mk);
  assert.equal(added.length, 0);
});

test("a 12V Battery does NOT satisfy the HV battery pack slot", () => {
  const scanned = [{ partName: "Battery" }];
  const { added } = ensurePowertrainParts(scanned, "bev", mk);
  assert.ok(added.map((p) => p.partName).includes("High-Voltage Battery Pack"));
});

console.log(`powertrain: ${passed} passed`);
