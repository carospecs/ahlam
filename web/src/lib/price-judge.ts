// PRICE JUDGMENT V3 — the appraiser prompt (docs: pricing-prompt.md, replaces
// the old comp-averaging prompt entirely; do not merge the two).
//
// Shape of the call, per the doc:
//   - ONE PART PER CALL, photos included — the completeness read (complete
//     assembly vs stripped shell) is the largest single driver of the number
//     and it lives in the photos + titles, not in code rules.
//   - Estimate-FIRST: the model commits to its own appraisal before weighing
//     the market data, then reconciles — it may overrule a junk comp pool.
//   - Reasoning fields generate BEFORE the numbers (schema property order
//     controls generation order — do not reorder them).
//   - Extended (adaptive) thinking ON — highest-stakes call in the product.
//   - The shared system prompt carries a cache_control breakpoint so a batch
//     of parts reuses the prefix (small prompt — may fall below the model's
//     minimum cacheable size; harmless either way).
//   - NO bands, floors, caps, or vehicle-value limits anywhere in this path;
//     sanity checks happen AFTER the estimate, as review flags (route layer).
// Calls run in parallel (width-limited) and each is fail-soft: a failed part
// simply falls through the ladder, exactly like a failed chunk used to.
import { getAnthropic } from "./anthropic";
import type { Comp } from "./ebay-comps";
import { resolveAssembly } from "./assembly-resolve";

export type JudgeConfidence = "high" | "medium" | "low";

export type JudgedPrice = {
  part_id: string;
  estimate: number | null; // "recommended" — null = the judge declined to price (route to review / next tier)
  low: number | null;
  high: number | null;
  confidence: JudgeConfidence;
  needsReview: boolean;    // needs_human_review OR low confidence — route to manual pricing
  note: string;            // confidence_reason, short (UI-facing)
  reasoning: {
    independent_estimate: string;
    comp_analysis: string;
    reconciliation: string;
    discarded_count: number | null;
    missing_information: string | null;
  };
};

// Model choice is deliberately still open: pricing-prompt.md says to test Opus
// vs Sonnet 5 on this prompt against known sale prices BEFORE settling
// (scripts/pricing-eval.mjs runs the A/B). Until that call is made, the default
// stays on the incumbent; PRICING_JUDGE_MODEL flips it without a deploy.
export function judgeModel(): string {
  return process.env.PRICING_JUDGE_MODEL || "claude-sonnet-5";
}

const envInt = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
};

// Sonnet 5 respects effort strictly; "medium" keeps the estimate-first
// reasoning while cutting the ~5.8k-token essays that default (high) effort
// wrote at 16k max_tokens. Overridable per eval iteration.
export function judgeEffort(): "low" | "medium" | "high" {
  const e = process.env.PRICING_JUDGE_EFFORT;
  return e === "low" || e === "high" ? e : "medium";
}

// The appraiser prompt already forces explicit reasoning through the schema's
// reasoning-before-numbers fields — adaptive thinking on top of that reasons
// TWICE (~7k output tokens, 80-220s/call, past the 110s timeout; measured
// 2026-08-11). PRICING_JUDGE_THINKING=off lets the schema fields carry the
// reasoning alone. Kept as a knob until the eval loop settles the quality call.
export function judgeThinking(): { type: "adaptive" } | { type: "disabled" } {
  return process.env.PRICING_JUDGE_THINKING === "off" ? { type: "disabled" } : { type: "adaptive" };
}

// The appraiser. Verbatim from docs/pricing-prompt.md — edit it there first.
const JUDGE_SYSTEM = `You are an experienced used auto parts appraiser. You have spent years pricing parts pulled
from salvage vehicles for resale on eBay Motors, Facebook Marketplace, and directly to local
buyers and repair shops. You know this market the way someone who works in it knows it, not
the way a spreadsheet knows it.

Your job is to produce a price range a salvage yard can list from with confidence.

### Method

Work in this order. Do not skip step one.

**Step 1. Form your own estimate before you look at any market data.**

From the part identification, the photos, and the condition assessment alone, work out what
this part is worth. Reason through it explicitly:

- **What is included?** This part came off a vehicle at a dismantling yard, which means it is a
  complete assembly unless stated otherwise, not a stripped shell. A tailgate includes its
  camera, handle, latch, and trim. A door includes its glass, regulator and motor, latch,
  interior panel, speaker, switch panel, wiring, and often the mirror. Establish what is
  attached before you do anything else, because it is the largest single driver of the number.
- What is it exactly, and what vehicles does it fit? Wide fitment across many model years means
  a larger buyer pool and a stronger price. Narrow fitment means fewer buyers but often less
  competition.
- What variant is it? Trim-specific features change the price substantially. On a tailgate,
  that means backup camera, power lock, lift assist, spoiler, and whether the stamped lettering
  is intact. On other parts it means something else. Identify what matters for this part.
- What is the demand profile? Some parts are stolen constantly and have steady replacement
  demand. Some are common failure items. Some only sell after a collision. Some sit for a year.
- What does the damage actually mean? Cosmetic damage on a panel discounts it. Structural
  damage to the mounting points or inner frame can make it worthless regardless of how the
  outer skin looks. Distinguish the two.
- How does it ship? Large, heavy, or awkward parts carry freight costs that suppress what a
  buyer will pay for the part itself. Small parts ship cheap and price closer to their value.
- Is it OEM or aftermarket, and does that matter for this part?

Commit to a range before proceeding. State it.

**Step 2. Now examine the market data.**

You are given recent listings. Treat them as evidence, not as the answer.

For each listing, ask whether it is genuinely the same part in comparable condition. Listings
that are not comparable must be named and set aside. Common contamination in this data:

- **Shells and stripped parts listed against complete assemblies.** This is the most common and
  most expensive error in this data. Sellers list bare skins, gutted doors, and camera-delete
  tailgates using the same words as complete units. Watch for shell only, skin only, bare, no
  glass, gutted, no camera, panel only, and for prices that are obviously too low for a loaded
  part. Equally, watch for the reverse: loaded, complete, w/ camera, or a listing that itemizes
  attached components. Do not average a shell against a complete assembly. If you must use
  shell comps because there is nothing better, adjust upward for what is attached to this part
  and say so explicitly.
- Sub-components or accessories sold under a similar name. A tailgate handle is not a tailgate.
- Parts marked for parts only, damaged, core, or salvage when yours is not, or the reverse.
- Aftermarket reproductions priced against your OEM part.
- Wrong generation, wrong trim, or fitment that does not actually overlap.
- Prices that include freight versus prices for local pickup only. These are not the same
  number and cannot be averaged together.
- Single outliers from sellers who are either dumping inventory or fishing for a miracle.

Say which listings you are discarding and why. If most of the data is unusable, say that
plainly. A small number of good comps beats a large number of bad ones.

**Step 3. Reconcile.**

If the usable market data agrees with your Step 1 estimate, tighten your range around it.

If it disagrees, decide which to trust and explain why. Do not automatically defer to the
listings. You are permitted to conclude that the market data is unrepresentative and to hold
your own estimate. State clearly when you are doing this, because the yard needs to know when
a price came from judgment rather than from comps.

Do not apply the condition grade as a fixed discount. The grade is one input you weigh against
the observed condition of the comparable listings. If the comps are mostly rough parts and this
one is clean, the price goes up, not down.

### Assembly value

Dismantlers sell parts whole. The unit of sale is the assembly as it came off the car, with its
components attached, not a bare panel.

This has two consequences you must hold at once.

First, a complete assembly is worth meaningfully more than a shell, and the difference is
roughly the value of what is attached. If the only usable comps are shells, price the shell from
the comps and then add for the attached components. State the components and what you added for
each. Do not add the full standalone resale price of every component, because a buyer purchasing
complete is paying for convenience rather than buying each piece at retail, but do not ignore
them either. Attached components are the reason the assembly is the product.

Second, a component that is missing, broken, or visibly absent from the photos pulls the price
below the complete-assembly comps by the same logic. A tailgate with the camera cut out is not a
complete tailgate. Check the photos for this rather than assuming the assembly is intact.

When the listing data gives you no way to tell whether comps are complete or stripped, say so,
widen your range accordingly, and lower your confidence. Do not silently guess.

### On the range

The low end is what this sells for quickly to a buyer who is price shopping. The high end is
what it brings from the right buyer who needs this exact part and is willing to wait for it.
The recommended price is where you would actually list it.

Make the range as tight as the evidence honestly allows. A range so wide it covers every
possibility is useless to someone who has to type a number into a listing. If you cannot
narrow it, say what specific missing information would let you.

### On erring

Both directions cost the yard money, and they cost it differently. A part listed too low sells
immediately at the wrong price and that margin is gone permanently. A part listed too high sits
on the shelf and can be marked down later.

Do not hedge downward to feel safe. An unjustifiably low estimate is not the cautious answer,
it is the expensive one. Price what the part is worth.

### Output

Return JSON matching the schema provided. Fill the reasoning field before the numbers, not
after. Your reasoning is what the yard reads when a price looks surprising, so write it for a
person who knows parts and wants to know how you got there.`;

// Property ORDER is load-bearing: reasoning generates before the numbers
// (docs: pricing-prompt.md "Implementation notes"). low/recommended/high are
// nullable so the judge can decline instead of fabricating when the part
// itself is unidentifiable — anything null or flagged routes to human review.
const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "independent_estimate", "comp_analysis", "discarded_count", "reconciliation",
    "low", "recommended", "high", "confidence", "confidence_reason",
    "needs_human_review", "missing_information",
  ],
  properties: {
    independent_estimate: { type: "string", description: "Step 1 reasoning and the range reached before seeing market data" },
    comp_analysis: { type: "string", description: "Which listings are usable, which are discarded and why" },
    discarded_count: { type: ["integer", "null"] },
    reconciliation: { type: "string", description: "How the independent estimate and the market data were reconciled, and which was trusted where they conflicted" },
    low: { type: ["number", "null"] },
    recommended: { type: ["number", "null"] },
    high: { type: ["number", "null"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    confidence_reason: { type: "string" },
    needs_human_review: { type: "boolean" },
    missing_information: { type: ["string", "null"], description: "What would most improve this estimate if known" },
  },
} as const;

export type JudgeInputPart = {
  part_id: string;
  name: string;
  grade: string; // A | B (C never reaches the judge)
  conditionNotes?: string | null; // vision-stage written assessment
  fitment: { year?: string | number | null; make?: string | null; model?: string | null; trim?: string | null; engine?: string | null };
  comps: Comp[];
  photo?: string | null; // data URL of the photo the part was detected in
};

// One listing per line, full title preserved — the title is how the judge reads
// completeness/configuration; code must not reduce or interpret it.
function listingLines(comps: Comp[]): string {
  return comps
    .map((c) => {
      const meta = [c.condition || "Used", c.shipping || "shipping unknown", c.listedAt ? `listed ${c.listedAt}` : null]
        .filter(Boolean)
        .join("; ");
      return `- $${c.price} — ${c.title} [${meta}]`;
    })
    .join("\n");
}

// The USER MESSAGE template from pricing-prompt.md, populated per part.
// Completeness defaults come from part-assemblies (option one in the doc);
// the photos override — the prompt tells the judge exactly that.
export function buildJudgeUserText(p: JudgeInputPart): { header: string; marketData: string } {
  const fit = [p.fitment.year, p.fitment.make, p.fitment.model].filter(Boolean).join(" ");
  const asm = resolveAssembly(p.name);
  const attached = asm
    ? `${asm.includes.join(", ")} (default for this part type — verify against the photos)`
    : "not mapped for this part type — judge from the photos and part name";
  const mayBeAbsent = asm && asm.mayBeAbsent.length
    ? `\nSometimes pulled or sold separately (check the photos): ${asm.mayBeAbsent.join(", ")}`
    : "";
  const drivers = asm && asm.priceDrivers.length
    ? `\nWhat moves price for this part type: ${asm.priceDrivers.join("; ")}`
    : "";
  const freight = asm ? `\nShipping burden class: ${asm.freight}` : "";
  const header =
    `PART\n${p.name}\n` +
    `Fits: ${fit || "unknown vehicle"}${p.fitment.trim ? ` ${p.fitment.trim}` : ""}\n` +
    `Variant details: ${p.fitment.engine ? `engine ${p.fitment.engine}` : "unknown"}\n` +
    `OEM part number: unknown\n\n` +
    `INCLUDED\n` +
    `This part is sold as a complete assembly as pulled from the vehicle.\n` +
    `Attached components: ${attached}${mayBeAbsent}${drivers}${freight}\n` +
    `Known missing or damaged components: ${p.conditionNotes ? "see condition assessment" : "none reported"}\n\n` +
    `CONDITION\n` +
    `Grade: ${p.grade}\n` +
    `Assessment: ${p.conditionNotes?.trim() || "no written assessment — judge condition from the photos"}\n` +
    `Visible damage: ${p.photo ? "see the photo" : "no photo provided for this part"}\n\n` +
    `PHOTOS`;
  const marketData =
    `MARKET DATA\n` +
    (p.comps.length ? listingLines(p.comps) : "(no listings retrieved)") +
    `\n\nEach listing includes title, price, condition as stated by the seller, shipping cost or ` +
    `pickup-only status, and date. Some of these will not be comparable. Identifying which is ` +
    `part of your job.`;
  return { header, marketData };
}

function photoBlock(dataUrl: string | null | undefined) {
  const m = typeof dataUrl === "string" ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s) : null;
  if (!m) return null;
  return { type: "image" as const, source: { type: "base64" as const, media_type: m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: m[2] } };
}

// Pure (unit-testable): validate + coerce one model response into a JudgedPrice.
export function sanitizeJudgedRow(partId: string, row: unknown): JudgedPrice | null {
  const r = row as Record<string, unknown>;
  if (!r || typeof r !== "object") return null;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const confidence: JudgeConfidence = r.confidence === "high" || r.confidence === "medium" || r.confidence === "low" ? r.confidence : "low";
  const reasoning = {
    independent_estimate: str(r.independent_estimate),
    comp_analysis: str(r.comp_analysis),
    reconciliation: str(r.reconciliation),
    discarded_count: typeof r.discarded_count === "number" ? r.discarded_count : null,
    missing_information: typeof r.missing_information === "string" && r.missing_information.trim() ? r.missing_information : null,
  };
  const note = str(r.confidence_reason).slice(0, 200);
  const estimate = num(r.recommended);
  const needsReview = r.needs_human_review === true || confidence === "low" || estimate == null;
  if (estimate == null) return { part_id: partId, estimate: null, low: null, high: null, confidence: "low", needsReview: true, note, reasoning };
  let low = num(r.low) ?? estimate, high = num(r.high) ?? estimate;
  if (low > high) [low, high] = [high, low];
  low = Math.min(low, estimate); high = Math.max(high, estimate);
  return { part_id: partId, estimate, low, high, confidence, needsReview, note, reasoning };
}

export type JudgeUsage = { input_tokens: number; output_tokens: number };

async function judgeOne(part: JudgeInputPart, collect?: { usage?: JudgeUsage[] }): Promise<JudgedPrice | null> {
  try {
    const { header, marketData } = buildJudgeUserText(part);
    const img = photoBlock(part.photo);
    const content = [
      { type: "text" as const, text: header },
      ...(img ? [img] : []),
      { type: "text" as const, text: marketData },
    ];
    const resp = await getAnthropic().messages.create(
      {
        model: judgeModel(),
        // Measured 2026-08-11 (eval smoke): default effort + 16k max_tokens
        // produced ~5.8k output tokens and ~220s per call — past the 110s
        // timeout, so production calls would fail to the memory tier. Effort
        // and the token cap are the latency/cost knobs; tune via env in the
        // eval loop (scripts/pricing-eval.mjs), not by editing constants.
        max_tokens: envInt("PRICING_JUDGE_MAX_TOKENS", 8000),
        output_config: { effort: judgeEffort() },
        thinking: judgeThinking(),
        output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA as unknown as Record<string, unknown> } },
        // Identical for every part in a batch → cache breakpoint here wins back
        // the latency the longer reasoning costs (pricing-prompt.md).
        system: [{ type: "text" as const, text: JUDGE_SYSTEM, cache_control: { type: "ephemeral" as const } }],
        messages: [{ role: "user", content }],
      },
      { timeout: 110_000 },
    );
    collect?.usage?.push({ input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens });
    const text = resp.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    return sanitizeJudgedRow(part.part_id, JSON.parse(text.text));
  } catch {
    return null;
  }
}

// Per-part calls tripled the request count vs the old ≤15-part chunks — keep a
// width limit so an 80-part scan doesn't fire 80 concurrent Opus/Sonnet calls.
const JUDGE_CONCURRENCY = 12;

async function allLimit<T>(limit: number, tasks: (() => Promise<T>)[]): Promise<T[]> {
  const out = new Array<T>(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

// Judge every part that has comps (and/or a photo). Returns null only when
// EVERY call fails — the route falls to the memory tier, same as before.
// opts.callMs / opts.usage, when provided, collect each call's wall-clock
// duration and token usage so callers (route timings, eval harness) can report
// judge p50/p95 latency and per-run cost.
export async function priceParts(parts: JudgeInputPart[], opts?: { callMs?: number[]; usage?: JudgeUsage[] }): Promise<JudgedPrice[] | null> {
  if (!parts.length) return [];
  const timed = (p: JudgeInputPart) => async () => {
    const t = Date.now();
    try { return await judgeOne(p, opts); } finally { opts?.callMs?.push(Date.now() - t); }
  };
  const rows = (await allLimit(JUDGE_CONCURRENCY, parts.map(timed))).filter((r): r is JudgedPrice => r !== null);
  return rows.length ? rows : null;
}
