// REAL scan test: feed the user's actual car photos to the SAME vision model and
// system prompt the app uses (gemini-2.5-pro + VISION_SYSTEM_PROMPT, extracted
// live from the identify route so it stays faithful), and print what the AI
// detects — vehicle, parts, condition grades, and suggested prices.
//   node scripts/scan-photos-probe.mjs
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- key ---
const env = {};
for (const f of [join(ROOT, "web/.env.local"), join(ROOT, ".env")]) {
  try {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const KEY = env.GEMINI_API_KEY || env.GEMINI_API_KEY_FALLBACK;
if (!KEY) { console.error("Missing GEMINI_API_KEY"); process.exit(1); }

// --- extract the live system prompt + user instruction from the route ---
const routeSrc = readFileSync(join(ROOT, "web/src/app/api/identify/route.ts"), "utf8");
function extractTemplate(src, varName) {
  const start = src.indexOf("`", src.indexOf(`${varName} =`));
  const end = src.indexOf("`", start + 1);
  return src.slice(start + 1, end);
}
const SYSTEM = extractTemplate(routeSrc, "VISION_SYSTEM_PROMPT");
const USER = 'Catalog every distinct sellable auto part visible in this photo. Inspect each part closely for cracks, breaks, and damage. Report "vehicleFront" and each part\'s "imageSide" as literal observations. Return the JSON { "vehicleFront": ..., "parts": [...] }.';
const MODEL = "gemini-2.5-pro";

const DIR = "/Users/mohammadabbas/Downloads/compressed";
const files = readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

async function scan(file) {
  const base64 = readFileSync(join(DIR, file)).toString("base64");
  const mime = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: USER }, { inline_data: { mime_type: mime, data: base64 } }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) return { file, error: `${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json();
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text ?? "").join("");
  try { return { file, data: JSON.parse(text) }; }
  catch { return { file, error: "unparseable", raw: text.slice(0, 200) }; }
}

console.log(`Scanning ${files.length} photos with ${MODEL} (real app prompt)…\n`);
for (const f of files) {
  const r = await scan(f);
  console.log(`━━━ ${r.file} ━━━`);
  if (r.error) { console.log(`  ERROR ${r.error}\n`); continue; }
  const v = r.data.vehicle || {};
  const yr = v.yearStart && v.yearEnd ? `${v.yearStart}-${v.yearEnd}` : (v.yearStart || "?");
  console.log(`  Vehicle: ${[yr, v.make, v.model, v.bodyStyle].filter(Boolean).join(" ") || "unknown"}  | whole-car $${v.suggestedWholeCarPriceUsd ?? "—"} | conf ${v.confidence ?? "—"}`);
  const parts = r.data.parts || [];
  console.log(`  Parts detected: ${parts.length}`);
  for (const p of parts) {
    const side = p.imageSide && p.imageSide !== "center" ? `${p.imageSide} ` : "";
    console.log(`    • ${side}${p.partName}`.padEnd(34) + `  Grade ${p.condition}  $${p.suggestedPriceUsd ?? "—"}  (${p.confidence})`);
  }
  console.log("");
}
