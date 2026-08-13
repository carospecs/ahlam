// Tests for the curated EV interchange dataset + resolvers (ev-interchange.ts).
// Imports the REAL TypeScript via the same self-respawn resolution hook
// damage-face.test.mjs uses:
//   node web/src/lib/ev-interchange.test.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__EV_INTERCHANGE_TEST_CHILD) {
  const fs = await import("node:fs");
  const hookPath = pathResolve(HERE, ".ev-interchange.ext-hook.mjs");
  const SRC = pathResolve(HERE, "..");
  fs.writeFileSync(
    hookPath,
    [
      'import { fileURLToPath, pathToFileURL } from "node:url";',
      'import { existsSync } from "node:fs";',
      'import { dirname, resolve as pathResolve } from "node:path";',
      `const SRC = ${JSON.stringify(SRC)};`,
      "export function resolve(specifier, context, nextResolve) {",
      '  const aliased = specifier.startsWith("@/");',
      '  if ((aliased || specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {',
      "    const abs = aliased",
      "      ? pathResolve(SRC, specifier.slice(2))",
      "      : pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);",
      "    if (!existsSync(abs)) {",
      '      for (const ext of [".ts", ".tsx"]) {',
      "        if (existsSync(abs + ext)) return nextResolve(pathToFileURL(abs + ext).href, context);",
      "      }",
      "    }",
      "  }",
      "  return nextResolve(specifier, context);",
      "}",
    ].join("\n"),
  );
  const child = spawnSync(
    process.execPath,
    ["--no-warnings=MODULE_TYPELESS_PACKAGE_JSON", "--import", `data:text/javascript,import { register } from "node:module"; register(${JSON.stringify(pathToFileURL(hookPath).href)});`, fileURLToPath(import.meta.url)],
    { stdio: "inherit", env: { ...process.env, __EV_INTERCHANGE_TEST_CHILD: "1" } },
  );
  try { fs.unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const { EV_GROUPS, evFamilyFromPartName, evInterchangeFor, evFitLines, evRetrievalHints } =
  await import("./ev-interchange.ts");
const { expectedPowertrainParts } = await import("./powertrain.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("ev-interchange (curated EV cross-reference):");

// ── Data invariants ──────────────────────────────────────────────────────────

test("group ids are unique, stable-looking slugs", () => {
  const ids = EV_GROUPS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate group id");
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad slug: ${id}`);
});

test("every application has a sane year range and every group has >=1 application", () => {
  for (const g of EV_GROUPS) {
    assert.ok(g.fits.length >= 1, `${g.id} has no applications`);
    for (const a of g.fits) {
      assert.ok(Number.isInteger(a.yearStart) && Number.isInteger(a.yearEnd), `${g.id}: non-integer years`);
      assert.ok(a.yearStart <= a.yearEnd, `${g.id}: yearStart > yearEnd for ${a.make} ${a.model}`);
      assert.ok(a.yearStart >= 2008 && a.yearEnd <= 2100, `${g.id}: implausible years`);
      assert.ok(a.make && a.model, `${g.id}: empty make/model`);
    }
  }
});

test("every group has a valid confidence tier", () => {
  const valid = new Set(["verified", "probable", "check-part-number"]);
  for (const g of EV_GROUPS) assert.ok(valid.has(g.confidence), `${g.id}: bad confidence ${g.confidence}`);
});

test("every check-part-number group carries constraints or notes", () => {
  for (const g of EV_GROUPS) {
    if (g.confidence !== "check-part-number") continue;
    assert.ok((g.constraints && g.constraints.length > 0) || g.notes, `${g.id} is check-part-number but has neither constraints nor notes`);
  }
});

test("no group references licensed interchange databases", () => {
  const banned = /hollander|car-?part/i;
  for (const g of EV_GROUPS) {
    for (const s of g.sources || []) assert.ok(!banned.test(s), `${g.id} cites a licensed database: ${s}`);
    assert.ok(!banned.test(g.notes || ""), `${g.id} notes cite a licensed database`);
  }
});

// ── Symmetry: every application resolves back to its own group ───────────────

test("every application in every group resolves back to that group", () => {
  for (const g of EV_GROUPS) {
    for (const a of g.fits) {
      for (const year of [a.yearStart, a.yearEnd]) {
        const hits = evInterchangeFor({ make: a.make, model: a.model, year, family: g.family });
        assert.ok(
          hits.some((h) => h.id === g.id),
          `${year} ${a.make} ${a.model} (${g.family}) does not resolve back to ${g.id}`,
        );
      }
    }
  }
});

// ── Resolver behavior ────────────────────────────────────────────────────────

test("2021 Model Y rear drive unit cross-fits 2017-2023 Model 3", () => {
  const lines = evFitLines({ make: "Tesla", model: "Model Y", year: 2021, partName: "Rear Drive Unit (Motor)" });
  const m3 = lines.find((l) => l.model === "Model 3" && l.yearStart === 2017 && l.yearEnd === 2023);
  assert.ok(m3, "expected a 2017-2023 Tesla Model 3 line");
  assert.equal(m3.label, "2017–2023 Tesla Model 3");
  assert.ok(!lines.some((l) => l.model === "Model Y"), "donor's own model must be excluded");
});

test("2013 Leaf pack lookup never returns the 62 kWh Plus group", () => {
  const groups = evInterchangeFor({ make: "Nissan", model: "Leaf", year: 2013, family: "hv_battery" });
  assert.ok(groups.length > 0, "2013 Leaf should match a pack group");
  assert.ok(groups.every((g) => g.id !== "leaf-pack-62"), "62 kWh Plus group leaked into a 2013 lookup");
  assert.ok(groups.some((g) => g.id === "leaf-pack-24"), "expected the 24 kWh group");
});

test("2018 Model 3 autopilot computer never groups with 2024+ hardware", () => {
  const groups = evInterchangeFor({ make: "Tesla", model: "Model 3", year: 2018, family: "autopilot_computer" });
  assert.ok(groups.length > 0, "2018 Model 3 should match an AP group");
  for (const g of groups) {
    assert.notEqual(g.id, "tesla-ap-hw4");
    for (const a of g.fits) assert.ok(a.yearStart < 2024, `${g.id} contains a 2024+ application`);
  }
});

test("Bolt EV <-> Bolt EUV drive unit crosses both directions", () => {
  const fromEv = evFitLines({ make: "Chevrolet", model: "Bolt EV", year: 2018, partName: "Front Drive Unit (Motor)" });
  assert.ok(fromEv.some((l) => l.model === "Bolt EUV" && l.yearStart === 2022 && l.yearEnd === 2023), "Bolt EV should cross to Bolt EUV");
  const fromEuv = evFitLines({ make: "Chevrolet", model: "Bolt EUV", year: 2022, partName: "Front Drive Unit (Motor)" });
  assert.ok(fromEuv.some((l) => l.model === "Bolt EV" && l.yearStart === 2017 && l.yearEnd === 2023), "Bolt EUV should cross back to Bolt EV");
});

test("scanner's 'Rear Drive Unit' on a front-motor EV falls back to the front-DU group", () => {
  // The scanner appends "Rear Drive Unit (Motor)" on every BEV, but a Bolt's
  // motor is at the front — the sibling-family fallback must still resolve it.
  const lines = evFitLines({ make: "Chevrolet", model: "Bolt EV", year: 2018, partName: "Rear Drive Unit (Motor)" });
  assert.ok(lines.some((l) => l.model === "Bolt EUV"), "sibling drive-unit fallback failed");
});

test("check-part-number lines always carry a caveat", () => {
  const cases = [
    { make: "Tesla", model: "Model 3", year: 2018, partName: "Autopilot Computer" },
    { make: "Tesla", model: "Model Y", year: 2021, partName: "High-Voltage Battery Pack" },
    { make: "Chevrolet", model: "Bolt EV", year: 2021, partName: "Battery Pack" },
  ];
  let checked = 0;
  for (const q of cases) {
    for (const l of evFitLines(q)) {
      if (l.confidence !== "check-part-number") continue;
      checked++;
      assert.ok(l.caveat && l.caveat.length > 0, `${q.partName} → ${l.label} lacks a caveat`);
    }
  }
  assert.ok(checked > 0, "expected at least one check-part-number line across the cases");
});

test("retrieval hints return sibling year ranges for comps widening", () => {
  const hints = evRetrievalHints("Tesla", "Model Y", 2021, "Rear Drive Unit (Motor)");
  assert.ok(hints.some((h) => h.make === "Tesla" && h.model === "Model 3" && h.from === 2017 && h.to === 2023));
  assert.ok(hints.every((h) => Number.isInteger(h.from) && Number.isInteger(h.to) && h.from <= h.to));
});

// ── Part-name → family mapping ───────────────────────────────────────────────

test("every expected BEV powertrain part name maps to a family", () => {
  for (const p of expectedPowertrainParts("bev", { awd: true })) {
    assert.ok(evFamilyFromPartName(p.partName), `unmapped BEV part name: ${p.partName}`);
  }
});

test("a 12V battery is never an HV pack", () => {
  assert.equal(evFamilyFromPartName("Battery"), null);
  assert.equal(evFamilyFromPartName("12V Battery"), null);
  assert.equal(evFamilyFromPartName("Battery Pack"), "hv_battery");
  assert.equal(evFamilyFromPartName("HV Battery"), "hv_battery");
  assert.equal(evFamilyFromPartName("High Voltage Battery"), "hv_battery");
  assert.equal(evFamilyFromPartName("Traction Battery"), "hv_battery");
});

test("non-EV part names map to null", () => {
  for (const name of ["Steering Wheel", "Alternator", "Front Bumper Cover", "Window Regulator", ""]) {
    assert.equal(evFamilyFromPartName(name), null, `${name || "(empty)"} should not map`);
  }
});

// ── Safety: fail silent, never wrong ─────────────────────────────────────────

test("ICE and unknown vehicles return nothing", () => {
  assert.deepEqual(evInterchangeFor({ make: "Toyota", model: "Camry", year: 2015, family: "hv_battery" }), []);
  assert.deepEqual(evFitLines({ make: "Toyota", model: "Camry", year: 2015, partName: "Alternator" }), []);
  assert.deepEqual(evFitLines({ make: "Lucid", model: "Air", year: 2022, partName: "High-Voltage Battery Pack" }), []);
  assert.deepEqual(evFitLines({ make: "", model: "", year: "", partName: "" }), []);
  assert.deepEqual(evInterchangeFor({ make: "Tesla", model: "Model 3", year: "not-a-year", family: "hv_battery" }), []);
});

console.log(`ev-interchange: ${passed} tests passed`);
