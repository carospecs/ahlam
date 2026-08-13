// Shared .ts import-resolution hook for scripts that import the app's lib code
// directly (the same hook every web/src/lib/*.test.mjs inlines, extracted once).
//
// Resolves:
//   - extensionless relative imports to .ts/.tsx  ("./anthropic" → anthropic.ts)
//   - the "@/…" path alias to web/src/            ("@/lib/vin" → web/src/lib/vin.ts)
// Node ≥23.6 strips the types natively; no transpile step.
//
// Usage in a script (parent re-execs itself as a child with the hook registered,
// forwarding argv so CLI flags survive):
//
//   import { respawnedWithHook } from "./ts-hook.mjs";
//   respawnedWithHook(import.meta.url);   // no-op in the child, exits the parent
//
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, "../web/src");

export function resolve(specifier, context, nextResolve) {
  const aliased = specifier.startsWith("@/");
  if ((aliased || specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const abs = aliased
      ? pathResolve(SRC, specifier.slice(2))
      : pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
    if (!existsSync(abs)) {
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(abs + ext)) return nextResolve(pathToFileURL(abs + ext).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

export function respawnedWithHook(importMetaUrl, flag = "__TS_HOOK_CHILD") {
  if (process.env[flag]) return; // already the hooked child — carry on
  const hookHref = pathToFileURL(fileURLToPath(import.meta.url)).href;
  const child = spawnSync(
    process.execPath,
    [
      "--no-warnings=MODULE_TYPELESS_PACKAGE_JSON",
      "--import",
      `data:text/javascript,import { register } from "node:module"; register(${JSON.stringify(hookHref)});`,
      fileURLToPath(importMetaUrl),
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: { ...process.env, [flag]: "1" } },
  );
  process.exit(child.status ?? 1);
}
