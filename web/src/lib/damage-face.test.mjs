// Tests for applyImpactFaceDamage (front/rear impact → behind-the-impact
// inference). Unlike damage-zones.test.mjs (a mirror), this imports the REAL
// TypeScript via the same resolution hook ebay-comps.test.mjs uses:
//   node web/src/lib/damage-face.test.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__DAMAGE_FACE_TEST_CHILD) {
  const fs = await import("node:fs");
  const hookPath = pathResolve(HERE, ".damage-face.ext-hook.mjs");
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
    { stdio: "inherit", env: { ...process.env, __DAMAGE_FACE_TEST_CHILD: "1" } },
  );
  try { fs.unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const { applyImpactFaceDamage } = await import("./damage-zones.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const mk = (partName, condition = "A", notes = "", price = 500) => ({
  partName, condition, conditionNotes: notes, suggestedPriceUsd: price, confidence: "high",
});

console.log("damage-face (front/rear impact inference):");

test("STRONG front impact condemns mechanicals to verify-first Grade C", () => {
  const list = [
    mk("Front Bumper Cover", "C", "crushed in collision, caved toward radiator"),
    mk("Engine — 2.5L I4", "B"),
    mk("Transmission", "B"),
    mk("Radiator", "A"),
    mk("A/C Compressor", "A"),
    mk("Alternator", "B"),
  ];
  const res = applyImpactFaceDamage(list);
  for (const name of ["Engine — 2.5L I4", "Transmission", "Radiator", "A/C Compressor", "Alternator"]) {
    const p = res.find((x) => x.partName === name);
    assert.equal(p.condition, "C", `${name} condemned`);
    assert.equal(p.suggestedPriceUsd, null, `${name} unpriced`);
    assert.equal(p.confidence, "low");
    assert.ok(p.conditionNotes.includes("Behind the front impact"), `${name} noted`);
  }
});

test("inferred powertrain parts (appended post-damage) are covered too", () => {
  const list = [
    mk("Hood", "C", "hood crushed and bent from frontal impact"),
    { ...mk("Engine", "B", "Inferred from the vehicle's powertrain type", null), inferred: true },
  ];
  const res = applyImpactFaceDamage(list);
  const eng = res.find((x) => x.partName === "Engine");
  assert.equal(eng.condition, "C");
  assert.ok(eng.conditionNotes.includes("Behind the front impact"));
  assert.equal(eng.inferred, true); // passthrough fields survive
});

test("a merely DENTED face panel does NOT condemn mechanicals (weak evidence)", () => {
  const list = [
    mk("Front Bumper Cover", "C", "large dent on corner"),
    mk("Engine — 2.5L I4", "B"),
  ];
  const res = applyImpactFaceDamage(list);
  assert.equal(res.find((x) => x.partName === "Engine — 2.5L I4").condition, "B");
});

test("face spread: crushed front bumper pulls hood/fenders/headlights into the zone (A→B)", () => {
  const list = [
    mk("Front Bumper Cover", "C", "crushed, collision"),
    mk("Hood", "A"),
    mk("Driver Side Front Fender", "A"),
    mk("Passenger Side Headlight Assembly", "A"),
    mk("Driver Side Front Door", "A"), // NOT a front-face part — untouched by this pass
  ];
  const res = applyImpactFaceDamage(list);
  assert.equal(res.find((x) => x.partName === "Hood").condition, "B");
  assert.equal(res.find((x) => x.partName === "Hood").suggestedPriceUsd, null);
  assert.equal(res.find((x) => x.partName === "Driver Side Front Fender").condition, "B");
  assert.equal(res.find((x) => x.partName === "Passenger Side Headlight Assembly").condition, "B");
  assert.equal(res.find((x) => x.partName === "Driver Side Front Door").condition, "A");
  assert.equal(res.find((x) => x.partName === "Driver Side Front Door").suggestedPriceUsd, 500);
});

test("rear impact reaches rear mechanicals, never the engine; EV pack safe on FRONT hit", () => {
  const rear = [
    mk("Tailgate", "C", "caved in from rear collision impact"),
    mk("Fuel Tank", "B"),
    mk("Rear Drive Unit", "B"),
    mk("Engine — 3.5L V6", "B"),
  ];
  const rres = applyImpactFaceDamage(rear);
  assert.equal(rres.find((x) => x.partName === "Fuel Tank").condition, "C");
  assert.equal(rres.find((x) => x.partName === "Rear Drive Unit").condition, "C");
  assert.equal(rres.find((x) => x.partName === "Engine — 3.5L V6").condition, "B"); // front mechanicals untouched by a rear hit

  const front = [
    mk("Front Bumper Cover", "C", "crushed, collision"),
    mk("Battery Pack", "B"),          // floor-mounted, protected — NOT condemned
    mk("Front Drive Unit", "B"),      // in the front crumple path — condemned
  ];
  const fres = applyImpactFaceDamage(front);
  assert.equal(fres.find((x) => x.partName === "Battery Pack").condition, "B");
  assert.equal(fres.find((x) => x.partName === "Front Drive Unit").condition, "C");
});

test("clean car: untouched array and references; pass is idempotent", () => {
  const clean = [mk("Hood", "A"), mk("Engine", "B")];
  const res = applyImpactFaceDamage(clean);
  assert.equal(res, clean); // no faces → same array back

  const wrecked = [mk("Grille", "C", "collision impact, torn"), mk("Radiator", "A")];
  const once = applyImpactFaceDamage(wrecked);
  const twice = applyImpactFaceDamage(once);
  assert.deepEqual(twice, once);
});

console.log(`${passed} passed`);
