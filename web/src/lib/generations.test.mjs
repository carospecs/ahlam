// Unit tests for the generation-range resolver. Runs with plain `node`:
//
//   node web/src/lib/generations.test.mjs
//
// Registers the same .ts resolution hook as ebay-comps.test.mjs and re-runs itself.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__GENERATIONS_TEST_CHILD) {
  const fs = await import("node:fs");
  const hookPath = pathResolve(HERE, ".generations.ext-hook.mjs");
  // Hook resolves both relative extensionless .ts imports AND the "@/…" alias
  // (part-enrich.ts imports "@/lib/age-pricing"), mapping @/ to web/src/.
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
    { stdio: "inherit", env: { ...process.env, __GENERATIONS_TEST_CHILD: "1" } },
  );
  try { fs.unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const { resolveGeneration, normKey } = await import("./generations.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("generations:");

// ── map hits ─────────────────────────────────────────────────────────────────

test("map hit either side of a generation boundary", () => {
  assert.deepEqual(resolveGeneration("Chevrolet", "Silverado 1500", 2018), { from: 2014, to: 2018, source: "map" });
  assert.deepEqual(resolveGeneration("Chevrolet", "Silverado 1500", 2019), { from: 2019, to: 2026, source: "map" });
});

test("normalization absorbs case and punctuation drift", () => {
  assert.deepEqual(resolveGeneration("FORD", "F-150", 2017), { from: 2015, to: 2020, source: "map" });
  assert.deepEqual(resolveGeneration("Tesla", "Model X", 2018), { from: 2016, to: 2020, source: "map" }); // the verified live-probe vehicle
  assert.deepEqual(resolveGeneration("TOYOTA", "Camry", "2019"), { from: 2018, to: 2024, source: "map" }); // string year
});

test("aliases and platform twins resolve to the shared spans", () => {
  assert.deepEqual(resolveGeneration("DODGE", "RAM 1500", 2005), { from: 2002, to: 2008, source: "map" });
  assert.deepEqual(resolveGeneration("GMC", "Sierra 1500", 2016), { from: 2014, to: 2018, source: "map" });
  assert.deepEqual(resolveGeneration("GMC", "Yukon", 2018), { from: 2015, to: 2020, source: "map" });
});

test("longest model-prefix absorbs decode suffixes; explicit key beats shorter prefix", () => {
  assert.deepEqual(resolveGeneration("CHEVROLET", "Silverado 1500 LD", 2016), { from: 2014, to: 2018, source: "map" });
  assert.deepEqual(resolveGeneration("FORD", "F-150 Lightning", 2023), { from: 2022, to: 2026, source: "map" });
});

// ── fallback ─────────────────────────────────────────────────────────────────

test("unmapped vehicle falls back to ±3 years", () => {
  assert.deepEqual(resolveGeneration("BMW", "328i", 2015), { from: 2012, to: 2018, source: "fallback" });
});

test("map-known model with out-of-map year falls back to ±3 years", () => {
  assert.deepEqual(resolveGeneration("Ford", "F-150", 1995), { from: 1992, to: 1998, source: "fallback" });
});

// ── nulls ────────────────────────────────────────────────────────────────────

test("missing/invalid year, make, or model → null", () => {
  assert.equal(resolveGeneration("Toyota", "Camry", null), null);
  assert.equal(resolveGeneration("Toyota", "Camry", undefined), null);
  assert.equal(resolveGeneration("Toyota", "Camry", ""), null);
  assert.equal(resolveGeneration("Toyota", "Camry", "N/A"), null);
  assert.equal(resolveGeneration("Toyota", "Camry", 1902), null);
  assert.equal(resolveGeneration(null, "Camry", 2019), null);
  assert.equal(resolveGeneration("Toyota", null, 2019), null);
});

test("normKey strips all non-alphanumerics", () => {
  assert.equal(normKey("CR-V"), "crv");
});

console.log(`  ${passed} passed`);
