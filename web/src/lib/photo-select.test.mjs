// Deterministic unit tests for photo-select.ts. Run with plain node:
//
//   node web/src/lib/photo-select.test.mjs
//
// photo-select.ts is TypeScript and imports `@/lib/part-enrich` via the project's
// "@/" path alias. Node v23+ strips TS types natively, but it does NOT know the "@/"
// alias and TS imports are extensionless — so this file registers a tiny in-process
// module-resolution hook (maps "@/x" → <web>/src/x, probing for .ts/.tsx) and then
// re-execs itself once with that hook active. No build, no tsc, no flags to remember.
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));      // <web>/src/lib
const SRC = pathResolve(HERE, "..");                       // <web>/src

// ── Bootstrap: register the "@/" alias hook, then re-run this file under it ──
// The hook must be registered in the process that *imports* photo-select.ts, before
// that import is evaluated. Registering and then dynamically importing in the same
// process works; we use a child process so the file stays runnable as plain `node x`.
if (!process.env.__PHOTO_SELECT_TEST_CHILD) {
  // Inline alias hook written next to this test (data: URL can't be a hook target on
  // all node builds, so we point register() at a small sibling we generate on the fly).
  const hookUrl = pathToFileURL(pathResolve(HERE, ".photo-select.alias-hook.mjs"));
  const fs = await import("node:fs");
  fs.writeFileSync(
    fileURLToPath(hookUrl),
    [
      'import { pathToFileURL } from "node:url";',
      'import { existsSync } from "node:fs";',
      `const SRC = ${JSON.stringify(SRC + "/")};`,
      "function probe(abs) {",
      "  if (existsSync(abs)) return abs;",
      '  for (const ext of [".ts", ".tsx", ".mjs", ".js", ".json"]) if (existsSync(abs + ext)) return abs + ext;',
      "  return abs;",
      "}",
      "export function resolve(specifier, context, nextResolve) {",
      '  if (specifier.startsWith("@/")) {',
      "    return nextResolve(pathToFileURL(probe(SRC + specifier.slice(2))).href, context);",
      "  }",
      "  return nextResolve(specifier, context);",
      "}",
    ].join("\n"),
  );

  const child = spawnSync(
    process.execPath,
    ["--no-warnings=MODULE_TYPELESS_PACKAGE_JSON", fileURLToPath(import.meta.url)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        __PHOTO_SELECT_TEST_CHILD: "1",
        __PHOTO_SELECT_ALIAS_HOOK: hookUrl.href,
      },
    },
  );
  try { fs.unlinkSync(fileURLToPath(hookUrl)); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

register(process.env.__PHOTO_SELECT_ALIAS_HOOK, pathToFileURL(HERE + "/"));

const { partRegion, instanceScore, pickBestInstance } = await import("@/lib/photo-select");

// ── Tiny assert harness ─────────────────────────────────────────────────────
let passed = 0;
const failures = [];
function check(name, cond) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failures.push(name); console.log(`FAIL  ${name}`); }
}
function eq(name, actual, expected) {
  check(`${name} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`, actual === expected);
}

// ── partRegion classification ───────────────────────────────────────────────
eq("partRegion: headlight = front", partRegion("Passenger Side Headlight Assembly"), "front");
eq("partRegion: tailgate = rear", partRegion("Tailgate"), "rear");
eq("partRegion: front door = side", partRegion("Driver Side Front Door"), "side");
// A few more to prove the generalization holds (vehicle-agnostic vocabulary).
eq("partRegion: grille = front", partRegion("Grille"), "front");
eq("partRegion: tail light = rear", partRegion("Driver Side Tail Light Assembly"), "rear");
eq("partRegion: wheel/rim = side", partRegion("Passenger Side Wheel / Rim"), "side");
eq("partRegion: side mirror = side", partRegion("Driver Side Mirror"), "side");
eq("partRegion: hood = front", partRegion("Hood"), "front");
eq("partRegion: rear bumper = rear", partRegion("Rear Bumper Cover"), "rear");
eq("partRegion: front bumper = front", partRegion("Front Bumper Cover"), "front");
eq("partRegion: roof = center", partRegion("Roof Panel"), "center");
eq("partRegion: engine = center", partRegion("Engine"), "center");

// ── 1. Founder's exact failure: passenger headlight, side-profile vs front ──
// Same physical part detected in two photos. The "points-right" (side-profile) shot
// shows it edge-on; the "toward-camera" (front) shot shows it clearly → keep the front.
{
  const sideProfile = { partName: "Passenger Side Headlight Assembly", confidence: "high", photoFront: "points-right" };
  const headOn = { partName: "Passenger Side Headlight Assembly", confidence: "high", photoFront: "toward-camera" };
  // Order it so a naive "keep first" would pick the WRONG (side-profile) one — proving
  // the fit logic, not list order, drives the choice.
  const best = pickBestInstance([sideProfile, headOn]);
  check("founder bug: front headlight beats side-profile headlight", best === headOn);
  check("founder bug: front score > side-profile score", instanceScore(headOn) > instanceScore(sideProfile));
}

// ── 2. Tailgate prefers the rear (away-from-camera) shot over the front shot ──
{
  const front = { partName: "Tailgate", confidence: "high", photoFront: "toward-camera" };
  const rear = { partName: "Tailgate", confidence: "high", photoFront: "away-from-camera" };
  const best = pickBestInstance([front, rear]);
  check("tailgate prefers away-from-camera over toward-camera", best === rear);
}

// ── 3. Side part (front door) prefers a side-profile over a head-on shot ──
{
  const headOn = { partName: "Driver Side Front Door", confidence: "high", photoFront: "toward-camera" };
  const sideProfile = { partName: "Driver Side Front Door", confidence: "high", photoFront: "points-left" };
  const best = pickBestInstance([headOn, sideProfile]);
  check("front door prefers side-profile over head-on", best === sideProfile);
  // ...and the other side-profile orientation works identically.
  const sideProfileR = { partName: "Driver Side Front Door", confidence: "high", photoFront: "points-right" };
  check("front door prefers points-right side-profile over head-on", pickBestInstance([headOn, sideProfileR]) === sideProfileR);
}

// ── 4. Confidence breaks ties when orientation is equal/unknown ──
{
  // Equal orientation (both unknown) → higher confidence wins.
  const lowU = { partName: "Tailgate", confidence: "low", photoFront: "unknown" };
  const highU = { partName: "Tailgate", confidence: "high", photoFront: "unknown" };
  check("confidence breaks tie (both unknown): high beats low", pickBestInstance([lowU, highU]) === highU);

  // Same matching orientation on both → confidence is the only differentiator.
  const medMatch = { partName: "Tailgate", confidence: "medium", photoFront: "away-from-camera" };
  const highMatch = { partName: "Tailgate", confidence: "high", photoFront: "away-from-camera" };
  check("confidence breaks tie (both matching): high beats medium", pickBestInstance([medMatch, highMatch]) === highMatch);

  // Center part (orientation-neutral) → scored by confidence only.
  const engLow = { partName: "Engine", confidence: "low", photoFront: "toward-camera" };
  const engHigh = { partName: "Engine", confidence: "high", photoFront: "points-left" };
  check("center part scored by confidence only", pickBestInstance([engLow, engHigh]) === engHigh);
  eq("center part: orientation does not change score (low)", instanceScore(engLow), 0);
  eq("center part: orientation does not change score (high)", instanceScore(engHigh), 2);
}

// ── 5. A strong orientation match must outweigh higher confidence ──
// The whole point of the founder fix: a clear front shot of a front part beats a
// high-confidence side-profile glimpse even if the side-profile read "high".
{
  const highSideProfile = { partName: "Passenger Side Headlight Assembly", confidence: "high", photoFront: "points-right" };
  const lowHeadOn = { partName: "Passenger Side Headlight Assembly", confidence: "low", photoFront: "toward-camera" };
  check("matching orientation outweighs confidence", pickBestInstance([highSideProfile, lowHeadOn]) === lowHeadOn);
}

// ── 6. Stability: a genuine tie keeps the FIRST candidate ──
{
  const a = { partName: "Tailgate", confidence: "high", photoFront: "away-from-camera" };
  const b = { partName: "Tailgate", confidence: "high", photoFront: "away-from-camera" };
  check("tie keeps first candidate (stable)", pickBestInstance([a, b]) === a);
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error("FAILURES:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
console.log("All photo-select tests passed.");
