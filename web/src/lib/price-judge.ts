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

// Fast tier for high-volume judgment-over-data; the strong model is reserved for
// the zero-comp grounded fallback (lib/market-pricing).
export function judgeModel(): string {
  return process.env.PRICING_JUDGE_MODEL || "claude-haiku-4-5";
}

const JUDGE_PROMPT =
  "Price used auto parts the way an experienced dismantler eyeballs them.\n\n" +
  "For each part you get: the part + its fitment, and a list of real comps (actual listings with prices, mostly " +
  "asking/active listings — sold data is noted per comp when available).\n\n" +
  "For each part:\n" +
  "- Look at the comps. Ignore the junk: damaged, incomplete, wrong generation, wrong engine family, obvious one-off " +
  "local distress sales.\n" +
  "- From what's left, give a reasonable price and a sensible range around it.\n" +
  "- Interchange parts count as valid comps (an SR engine fits a TRD Sport; same-generation trims share most panels).\n" +
  "- If comps are mostly asking prices rather than sold, price toward the lower-middle of them (asking prices run high).\n" +
  "- Never mix hybrid-specific parts with non-hybrid comps — hybrid pools are different and thinner.\n\n" +
  "Don't overthink it. Don't show your work. Don't write explanations.\n\n" +
  'confidence: "high" if several sold comps agree; "med" if few or mostly asking; "low" if comps are sparse or scattered. ' +
  'note: one short line, e.g. "6 comps, clean fitment".';

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
