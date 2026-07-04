// LIVE EVAL — the market-pricing agent against real vehicles, with guardrails.
//
//   node scripts/market-price-eval.mjs
//
// Needs ANTHROPIC_API_KEY in web/.env.local. Live API, costs real (small) money.
// First output line to watch: whether json_schema + web_search "compose" on the
// current API build — the code handles both outcomes; this tells you which path
// is active. Then three fixture vehicles run with sanity guardrails (ranges wide
// on purpose — they catch category errors like retail-fantasy or clearance-floor
// prices, not day-to-day market drift).
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Re-exec under a resolution hook so plain node can import the .ts lib
// (same pattern as web/src/lib/qa-agent.test.mjs).
if (!process.env.__MARKET_EVAL_CHILD) {
  const hookPath = resolve(__dirname, ".market-eval.ext-hook.mjs");
  writeFileSync(
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
    { stdio: "inherit", env: { ...process.env, __MARKET_EVAL_CHILD: "1" } },
  );
  try { unlinkSync(hookPath); } catch { /* best-effort */ }
  process.exit(child.status ?? 1);
}

// Load env (the lib reads process.env directly).
try {
  const envRaw = readFileSync(resolve(__dirname, "../web/.env.local"), "utf8");
  for (const line of envRaw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* fall through to the key check */ }
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in web/.env.local — cannot run the live eval.");
  process.exit(1);
}

const { marketPriceParts, composePathActive } = await import("../web/src/lib/market-pricing.ts");

const FIXTURES = [
  {
    vehicleId: "2021 Toyota Tacoma TRD Sport", spec: "engine 3.5L V6, drivetrain 4WD", powertrainLine: null,
    parts: [
      { name: "Tailgate", grade: "A" },
      { name: "Engine", grade: "B", inferred: true },
      { name: "Headlight Assembly", grade: "B" },
    ],
    // Tacoma tailgates are a theft-magnet part: real eBay listings run $600-800+.
    guards: { Tailgate: [500, 1200], Engine: [2000, 6500], "Headlight Assembly": [100, 600] },
  },
  {
    vehicleId: "2018 Tesla Model X 100D", spec: "drivetrain AWD",
    powertrainLine: "This vehicle is a BATTERY-ELECTRIC vehicle (BEV): it has NO engine, NO transmission, NO catalytic converter, NO exhaust.",
    parts: [
      { name: "Liftgate", grade: "B" },
      { name: "High-Voltage Battery Pack", grade: "B", inferred: true },
    ],
    guards: { Liftgate: [700, 2800], "High-Voltage Battery Pack": [6000, 20000] },
  },
  {
    vehicleId: "2019 Honda Civic LX", spec: "engine 2.0L I4", powertrainLine: null,
    parts: [
      { name: "Front Bumper Cover", grade: "B" },
      { name: "Side Mirror", grade: "B" },
    ],
    guards: { "Front Bumper Cover": [100, 600], "Side Mirror": [50, 400] },
  },
];

let failures = 0;
for (const f of FIXTURES) {
  const t0 = Date.now();
  const rows = await marketPriceParts({ vehicleId: f.vehicleId, spec: f.spec, powertrainLine: f.powertrainLine, parts: f.parts });
  console.log(`\n${f.vehicleId} (${((Date.now() - t0) / 1000).toFixed(1)}s) — output path: ${composePathActive()}`);
  if (!rows) { console.log("  FAIL: agent returned null"); failures++; continue; }
  for (const p of f.parts) {
    const r = rows.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
    const guard = f.guards[p.name];
    if (!r || r.usedPartPriceUsd == null) { console.log(`  FAIL  ${p.name}: no price returned`); failures++; continue; }
    const ok = r.usedPartPriceUsd >= guard[0] && r.usedPartPriceUsd <= guard[1];
    if (!ok) failures++;
    console.log(
      `  ${ok ? "pass" : "FAIL"}  ${p.name.padEnd(26)} $${String(r.usedPartPriceUsd).padStart(6)} ` +
      `[${r.usedPartPriceLowUsd}–${r.usedPartPriceHighUsd}] ${r.confidence} · ${r.compCount} comps · ${r.sourceDomains.join(",") || "no sources"}` +
      (ok ? "" : `   (guard ${guard[0]}–${guard[1]})`),
    );
  }
}

console.log(failures ? `\n${failures} guardrail failure(s).` : "\nAll guardrails pass.");
process.exit(failures ? 1 : 0);
