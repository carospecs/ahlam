// PRICE JUDGMENT — a plain function that calls the model ONCE, not an agent.
// (docs: PRICING_MIGRATION_INSTRUCTION — pricing has no decisions about what to
// do next: comps were already retrieved by our code (lib/ebay-comps); the model's
// only job is dismantler-style judgment over them. One batched call on a FAST
// model tier, JSON in / JSON out, no tool use, no loop, no prose.)
import { getAnthropic } from "./anthropic";
import type { Comp } from "./ebay-comps";

export type JudgeConfidence = "high" | "med" | "low";

export type JudgedPrice = {
  part_id: string;
  estimate: number;
  low: number;
  high: number;
  confidence: JudgeConfidence;
  note: string;
};

// Judgment tier. Sonnet, not Haiku, on purpose: live testing showed Haiku
// anchoring a Model X battery pack to $800 module listings while its own note
// said complete packs run $5,645-6,001 — the completeness/configuration read
// off messy titles is exactly where the brief says to spend on a stronger judge
// instead of re-adding code rules. (~1-3¢ per scan; the strong PRICING_MODEL is
// still reserved for the zero-comp grounded fallback in lib/market-pricing.)
export function judgeModel(): string {
  return process.env.PRICING_JUDGE_MODEL || "claude-sonnet-5";
}

// The dismantler lives here — everything below is for the judge to WEIGH in one
// judgment, not rules for code to execute. That distinction is the entire point
// (docs: PRICING_MIGRATION_INSTRUCTION (2)).
const JUDGE_PROMPT =
  "Price used auto parts the way an experienced dismantler eyeballs them.\n\n" +
  "For each part you get its details and a list of real eBay listings (actual titles and prices).\n\n" +
  "Look at the listings and use judgment — all of this at once, not as steps:\n\n" +
  "- Ignore anything that isn't really a comp: wrong vehicle, broken/for-parts, or an unrelated item that slipped " +
  "into the search.\n" +
  '- Read what each listing actually is. A cheaper "long block, no turbo" or "shell only" is a different ' +
  "configuration, not the same part — weigh it, don't just average it in.\n" +
  "- Fitment: parts that interchange count (an SR or SR5 engine fits a TRD Sport). Parts that don't interchange " +
  "don't — a color-keyed, 2WD/4WD, or cab-specific panel from the wrong config is not a match. Use the titles to " +
  "tell which is which. Don't assume trim always matters, and don't assume it never does.\n" +
  "- These are asking prices, so they run high. How much they overshoot depends on the listings: discount more when " +
  "there are many of them, little to none when supply is thin and sellers are holding firm. Land on what it would " +
  "actually sell for.\n" +
  "- Options and condition move price within the same fitment — camera wiring, heated, damper, color-match, damage. " +
  "Match like for like where the titles tell you.\n\n" +
  "Then give one reasonable price and a sensible range around it. Don't overthink it. Don't show your work. Don't " +
  "write explanations.\n\n" +
  'confidence: "high" if several real comps agree; "med" if few or scattered; "low" if the comps barely fit or ' +
  'barely exist. note: one short line.';

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["part_id", "estimate", "low", "high", "confidence", "note"],
        properties: {
          part_id: { type: "string" },
          estimate: { type: "number" },
          low: { type: "number" },
          high: { type: "number" },
          confidence: { type: "string", enum: ["high", "med", "low"] },
          note: { type: "string" },
        },
      },
    },
  },
} as const;

export type JudgeInputPart = {
  part_id: string;
  name: string;
  condition: "good" | "fair" | "unknown";
  fitment: { year?: string | number | null; make?: string | null; model?: string | null; trim?: string | null; engine?: string | null };
  comps: Comp[];
};

// Pure (unit-tested): validate + coerce the model's output rows.
export function sanitizeJudgedRow(row: unknown): JudgedPrice | null {
  const r = row as Record<string, unknown>;
  if (!r || typeof r.part_id !== "string" || !r.part_id.trim()) return null;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
  const estimate = num(r.estimate);
  if (estimate == null) return null;
  let low = num(r.low) ?? estimate, high = num(r.high) ?? estimate;
  if (low > high) [low, high] = [high, low];
  low = Math.min(low, estimate); high = Math.max(high, estimate);
  const confidence: JudgeConfidence = r.confidence === "high" || r.confidence === "med" || r.confidence === "low" ? r.confidence : "low";
  return { part_id: r.part_id.trim(), estimate, low, high, confidence, note: typeof r.note === "string" ? r.note.slice(0, 120) : "" };
}

// ONE batched model call over every part that has comps. Returns null on any
// failure — the route falls to the memory tier. No retries beyond the SDK's own;
// this call is cheap and the ladder has fallbacks.
export async function priceParts(parts: JudgeInputPart[]): Promise<JudgedPrice[] | null> {
  if (!parts.length) return [];
  try {
    const resp = await getAnthropic().messages.create(
      {
        model: judgeModel(),
        max_tokens: 8000,
        system: JUDGE_PROMPT,
        output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA as unknown as Record<string, unknown> } },
        messages: [{ role: "user", content: JSON.stringify({ parts }) }],
      },
      { timeout: 60_000 },
    );
    const text = resp.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as { parts?: unknown[] };
    if (!Array.isArray(parsed.parts)) return null;
    const rows = parsed.parts.map(sanitizeJudgedRow).filter((r): r is JudgedPrice => r !== null);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}
