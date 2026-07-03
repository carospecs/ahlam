// Claude pricing engine — the used-part pricing authority (see docs/PRICING_SYSTEM.md).
// Gemini vision still catalogs/grades parts; Claude prices them. Routes branch on
// anthropicEnabled() and fall back to the Gemini pricing path when the key is absent
// or a call fails, so production never depends on this being configured.
import Anthropic from "@anthropic-ai/sdk";

export function anthropicEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// One-line model switch: PRICING_MODEL env var, defaults to Claude Opus 4.8.
export function pricingModel(): string {
  return process.env.PRICING_MODEL || "claude-opus-4-8";
}

let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  // maxRetries capped at 1: pricing sits in the scan's critical path, and the
  // caller has its own Gemini fallback — better to fall back than retry twice.
  return (client ??= new Anthropic({ maxRetries: 1 }));
}

// Structured-output schema for the pricing call. No numeric min/max constraints
// (unsupported by the API); the route re-validates with its num() guard.
const PRICING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "usedPartPriceUsd", "usedPartPriceLowUsd", "usedPartPriceHighUsd"],
        properties: {
          name: { type: "string" },
          usedPartPriceUsd: { type: ["number", "null"] },
          usedPartPriceLowUsd: { type: ["number", "null"] },
          usedPartPriceHighUsd: { type: ["number", "null"] },
        },
      },
    },
  },
} as const;

// Same pricing persona as the Gemini reprice prompt, minus the JSON-shape
// instructions — the json_schema output format enforces the shape.
const PRICING_SYSTEM =
  "You price USED auto parts for salvage yards / dismantlers. For the exact vehicle the user names, give the typical " +
  "price each listed part ACTUALLY SELLS FOR as a USED/recycled part (car-part.com, eBay sold listings, LKQ) in good " +
  "used condition — NEVER the new/OEM/MSRP price; a used part sells for a fraction of new. " +
  "Be conservative on large painted body panels (doors, liftgate, hood, fenders, quarter panels, bumper covers): they " +
  "move slowly and sell near the LOW end of any range. Left & right of a paired part get the SAME price. " +
  "Use realistic round numbers; if you truly have no basis for one, use null. " +
  "usedPartPriceLowUsd / usedPartPriceHighUsd is the realistic USED-market range (low ≤ price ≤ high): tight (±15% or " +
  "less) when you know the part and vehicle well, wider when you're less sure. Null range when the price is null. " +
  "Echo each part's exact given name.";

export type RawPricedPart = {
  name: string;
  usedPartPriceUsd: number | null;
  usedPartPriceLowUsd: number | null;
  usedPartPriceHighUsd: number | null;
};

export async function claudePriceParts(
  input: {
    vehicleId: string;
    spec: string;
    powertrainLine: string | null;
    parts: { name: string; grade: string; inferred?: boolean }[];
  },
  opts?: { signal?: AbortSignal },
): Promise<RawPricedPart[] | null> {
  const list = input.parts
    .map((p, i) => `${i + 1}. ${p.name}${p.inferred ? " (inferred)" : ""}`)
    .join("\n");
  const user =
    `USED ${input.vehicleId}${input.spec ? ` (${input.spec})` : ""}.\n` +
    `${input.powertrainLine ? input.powertrainLine + "\n" : ""}` +
    `Parts (some may be marked inferred — not photographed but expected present on this vehicle; price them normally):\n` +
    list;
  try {
    const resp = await getAnthropic().messages.create(
      {
        model: pricingModel(),
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: PRICING_SCHEMA as unknown as Record<string, unknown> },
        },
        system: PRICING_SYSTEM,
        messages: [{ role: "user", content: user }],
      },
      { timeout: 40_000, signal: opts?.signal },
    );
    const text = resp.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as { parts?: RawPricedPart[] };
    if (!Array.isArray(parsed.parts)) return null;
    // The model sometimes echoes the "(inferred)" marker we append to the list line
    // into the name — strip it so the route's match-by-name doesn't silently fall
    // back to positional matching (live smoke-test finding).
    return parsed.parts.map((p) => ({
      ...p,
      name: typeof p.name === "string" ? p.name.replace(/\s*\(inferred\)\s*$/i, "") : p.name,
    }));
  } catch {
    return null; // caller falls back to the Gemini pricing path
  }
}

// Pure helper: pull cited source pages out of web_search_tool_result content
// blocks. No live call site since the advisory market check was removed
// (2026-07-03); kept for the eval scripts and any future web-search feature.
// Free of SDK/env access at call time so plain `node` can unit-test it.
export function extractSearchSources(content: unknown[]): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const block of content) {
    const b = block as { type?: string; content?: unknown };
    if (b?.type !== "web_search_tool_result" || !Array.isArray(b.content)) continue;
    for (const item of b.content) {
      const r = item as { type?: string; url?: string; title?: string };
      if (r?.type !== "web_search_result" || typeof r.url !== "string" || !r.url) continue;
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({ title: typeof r.title === "string" ? r.title : r.url, url: r.url });
    }
  }
  return out;
}
