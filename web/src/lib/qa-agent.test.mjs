// Unit tests for the QA-resolver agent's pure client logic (side-word swapping,
// edit application, warn-case detection). Runs with plain `node`:
//
//   node web/src/lib/qa-agent.test.mjs
//
// qa-agent.ts imports sibling .ts modules extensionlessly ("./scan-qa"), which node's
// type-stripping can't resolve on its own — so, like photo-select.test.mjs, this file
// registers a tiny resolution hook (probes .ts/.tsx for bare relative imports) and
// re-runs itself once under it. No build, no tsc.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__QA_AGENT_TEST_CHILD) {
  const fs = await import("node:fs");
  const hookPath = pathResolve(HERE, ".qa-agent.ext-hook.mjs");
  fs.writeFileSync(
    hookPath,
    [
      'import { fileURLToPath, pathToFileURL } from "node:url";',
      'import { existsSync } from "node:fs";',
      'import { dirname, resolve as pathResolve } from "node:path";',
      "export function resolve(specifier, context, nextResolve) {",
      '  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {',
      "    const abs = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);",
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
    { stdio: "inherit", env: { ...process.env, __QA_AGENT_TEST_CHILD: "1" } },
  );
  try { fs.unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const { swapSideWords, applyQaEdit, hasWarnCases } = await import("./qa-agent.ts");
const { runScanQa } = await import("./scan-qa.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("qa-agent:");

// ── swapSideWords ────────────────────────────────────────────────────────────

test("Driver ↔ Passenger swaps once, capitalization preserved", () => {
  assert.equal(swapSideWords("Driver Side Front Door"), "Passenger Side Front Door");
  assert.equal(swapSideWords("Passenger Side Mirror"), "Driver Side Mirror");
});

test("no double-swap when both words appear (single-pass replace)", () => {
  // Naive sequential replace would turn "driver" → "passenger" → back to "driver".
  assert.equal(
    swapSideWords("driver door, passenger fender"),
    "passenger door, driver fender",
  );
});

test("left/right swap too, and lowercase stays lowercase", () => {
  assert.equal(swapSideWords("front left wheel"), "front right wheel");
});

test("words containing side words are untouched (word boundaries)", () => {
  assert.equal(swapSideWords("Copyright bracket"), "Copyright bracket");
  assert.equal(swapSideWords("Drivers seat"), "Drivers seat"); // 'Drivers' ≠ 'driver'
});

// ── applyQaEdit ──────────────────────────────────────────────────────────────

const part = {
  _id: "1",
  partName: "Driver Side Front Door",
  description: "Passenger side front door in good shape.",
  condition: "A",
  conditionNotes: "sits inside impact zone",
  usedPartPriceUsd: 700, // used-market Grade-B anchor
};

test("swap-side on partName only touches the name", () => {
  const out = applyQaEdit(part, { field: "partName", kind: "swap-side" });
  assert.deepEqual(out, { partName: "Passenger Side Front Door" });
});

test("swap-side on description only touches the description", () => {
  const out = applyQaEdit(part, { field: "description", kind: "swap-side" });
  assert.deepEqual(out, { description: "Driver side front door in good shape." });
});

test("downgrade-B sets Grade B and reprices at the used Grade-B anchor (×1.0)", () => {
  const out = applyQaEdit(part, { field: "condition", kind: "downgrade-B" });
  assert.equal(out.condition, "B");
  assert.equal(out.suggestedPriceUsd, 700);
});

test("downgrade-B with no used anchor leaves the price null (never invents one)", () => {
  const out = applyQaEdit({ ...part, usedPartPriceUsd: null }, { field: "condition", kind: "downgrade-B" });
  assert.equal(out.condition, "B");
  assert.equal(out.suggestedPriceUsd, null);
});

// ── hasWarnCases (mirrors runScanQa's warn conditions) ──────────────────────

test("side conflict in name vs description → warn case", () => {
  assert.equal(hasWarnCases([part], []), true);
});

test("Grade A inside an impact zone → warn case", () => {
  const p = { partName: "Hood", description: "", condition: "A", conditionNotes: "inside impact zone" };
  assert.equal(hasWarnCases([p], []), true);
});

test("conflicting photo colors → warn case; same-family colors → none", () => {
  const clean = { partName: "Hood", description: "", condition: "B", conditionNotes: "" };
  assert.equal(hasWarnCases([clean], ["gray", "gold"]), true);
  assert.equal(hasWarnCases([clean], ["gray", "dark gray"]), false);
});

test("a clean scan raises no cases", () => {
  const clean = { partName: "Hood", description: "Clean hood.", condition: "B", conditionNotes: "" };
  assert.equal(hasWarnCases([clean], ["gray"]), false);
});

// ── runScanQa check 8: off-catalog part names (part-catalog drift alarm) ─────

test("off-catalog part names raise the info-level drift flag; catalog names don't", () => {
  const mk = (partName) => ({ partName, description: "", condition: "B", conditionNotes: "", suggestedPriceUsd: 100 });
  const flags = runScanQa([mk("Driver Side Front Door"), mk("Flux Capacitor Bracket")]);
  const drift = flags.filter((f) => f.level === "info" && /part catalog/.test(f.message));
  assert.equal(drift.length, 1);
  assert.ok(drift[0].message.includes("Flux Capacitor Bracket"));
  assert.ok(!drift[0].message.includes("Front Door"));
  // Legacy and canonical names both resolve — no flag.
  const clean = runScanQa([mk("Front Bumper Cover"), mk("Engine — 2.5L I4"), mk("Wheel / Rim")]);
  assert.equal(clean.filter((f) => /part catalog/.test(f.message)).length, 0);
});

console.log(`qa-agent: ${passed} passed`);
