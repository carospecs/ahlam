# Agent Layer Blueprint

Companion to `scan-pipeline-blueprint.md`. That doc's rule stands: the pipeline stages are
deterministic code + focused model calls, **not** autonomous agents. This doc sketches the
two places where autonomy genuinely pays — where the number of steps is unknown in
advance — and attaches agents **at the edges** of the pipeline, never inside it.

**The architectural rule:** the orchestrator stays deterministic code; the data contracts
stay exactly as written (Stage 3 owns `condition` — agents consume it, never write it);
agents **propose, code disposes**. Every agent output is a proposal with evidence that a
human (or a whitelisted safe-direction rule) accepts.

```
                    deterministic pipeline (Stages 0–8)
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
   [A1] QA Resolver                    [A2] Pricing Research
   sync-ish, per scan,                 async, per listing,
   runs ONLY on warn flags             runs AFTER save, off the
   (the ~5% exception tail)            scan's latency budget
```

---

## A1 · QA Resolver — the exception handler behind Stage 7

**Problem today:** `runScanQa` (`web/src/lib/scan-qa.ts`) produces warn/info flags, and
`AddVehicle.tsx` just renders them. Every warn flag is a dead end: "verify this yourself."
The agent's job is to spend a few focused model calls trying to resolve the flag with
evidence before it reaches the seller — so the seller sees either *nothing* (resolved),
or a flag **with a diagnosis attached** instead of a bare warning.

### Trigger
Scan completes → `runScanQa` returns ≥1 `level: "warn"` flag → client POSTs to
`/api/qa-resolve` with the flags, parts, and photo URLs. Info flags never trigger it.
No warn flags (the common case) → zero agent cost.

### Inputs
- The `QaFlag[]` (warn only) + the `QaPart[]` subset each flag names
- Photo URLs (**originals**, not redacted — the agent is internal, same rule as VIN reads)
- Per-part `photoIndex` + `bbox` (Phase B data), `vehicleFront` per photo
- The decoded VIN spec, if any

### Tools (each a thin wrapper over code that already exists)
| Tool | Implementation |
|---|---|
| `cropAndAsk(photoIndex, bbox, question)` | server-side crop (sharp, as in `redact.ts`) + one focused flash vision call on the crop |
| `reIntersect(partId)` | re-run `damage-intersect.ts` for one part — pure code, free |
| `readColors(photoIndexes)` | one vision call: body color per photo, forced to a fixed palette |
| `decodeVin(vin)` | existing `lib/vin.ts` — free |

### Playbooks (the agent picks per flag type; bounded, not open-ended)
- **"Description names the opposite side"** → `cropAndAsk` on the part's bbox with the
  photo's known `vehicleFront` orientation: "which side of the vehicle is this?" Verdict
  overrides neither name nor description — it *proposes* which one to fix.
- **"Photos disagree on body color"** → `readColors` over the conflicting photos with a
  constrained palette. Same-family answers ("gray"/"dark gray") → resolved as a misread.
  Truly different → escalate with the two photo indexes: "check these two photos are the
  same vehicle."
- **"Grade A but in a damage zone"** → `reIntersect` first (pipeline disagreeing with
  itself is usually stale data); if the intersection is real, propose the downgrade.

### Output contract
```
Resolution = { flag, verdict: "resolved" | "confirmed" | "escalate",
               evidence: string,            // one sentence, cites the crop/tool result
               proposedEdit?: { partId, field, from, to } }
```
- The agent **never mutates** parts. The client applies `proposedEdit` only on seller
  accept — with one exception worth allowing: condition **downgrades** auto-apply
  (the safe direction; matches the damage-pass precedent), upgrades never do.
- `verdict: "confirmed"` keeps the flag but replaces the bare warning with the evidence.

### Bounds (what keeps this an agent, not a runaway)
- New route `web/src/app/api/qa-resolve/route.ts`, same skeleton as `reprice/route.ts`
  (session-or-Bearer auth, `maxDuration 60`).
- Hard cap: **≤ 2 model calls per flag, ≤ 6 per scan**, flash only. Over budget →
  `verdict: "escalate"` with whatever evidence exists. Worst case adds ~$0.01/scan and
  only on flagged scans.

---

## A2 · Pricing Research — the comp anchor, reborn async

**Problem today:** `reprice` prices from the model's *prior* (a guessed new price × grade
discount) — no market data. The comp-anchor attempt (`edc7af4`) died in a day because live
search didn't fit the scan's latency budget. The fix isn't a better sync call; it's moving
the research **off the scan path entirely**.

### Trigger
Listing saved (`/api/listings` POST succeeds) → enqueue research for the **top-N parts by
`suggestedPriceUsd`** (start: N=5, floor $150 — engines, transmissions, doors, headlamps).
Runs minutes later; the seller sees results as a follow-up, never a spinner.

### Loop (per part; genuinely variable-step — this is why it's an agent)
1. Build query variants from the VIN spec: `{year make model} {part}`, ± trim, ± engine
   code, part synonyms ("headlamp"/"headlight").
2. Search used-part comps (tool below). Too few results → widen (year range ±2, drop
   trim). Too many → tighten. Repeat within budget.
3. Filter: used/OEM only, exclude cores & "for parts only" unless graded C, normalize
   condition wording to A/B/C using `grade.ts` language.
4. Compute anchor: median of ≥3 comps; grade-adjust comps to the part's grade via the
   existing `usedPriceFromNew` ratios so mixed-grade comps are comparable.

### Comp source (open decision, in order of preference)
1. **Gemini search grounding** (Google Search tool on flash) — no new API contract,
   citations come back as URLs. Cheapest path to test the idea.
2. `lib/ebay.ts` revived read-only for sold comps — the paused external dependency.
3. **Our own marketplace** once listing volume exists — the long-term moat: real asks
   from real yards, zero external dependency.

### Output contract
```
PriceResearch = { listingId, partName, compMedianUsd, compCount,
                  sources: [{ title, url, priceUsd, condition }],
                  proposedPriceUsd, confidence: "high" | "low",
                  divergence: number }   // proposed vs current, %
```
- Persist to a new `price_research` table keyed by listing id (RLS: shop-scoped, same
  pattern as `listings`).
- UI: a quiet badge on the listing — "Market check: comps suggest **$X** (n sold)" with
  accept/dismiss. **Never silently changes a live price.** Provenance (the source list)
  is mandatory; a number with no citations doesn't render.
- `divergence > 40%` with `confidence: high` → also surface in the export center, since
  that's where mispricing costs real money.

### Bounds
- Budget: **≤ 4 search calls + 1 synthesis call per part**, ≤ 5 parts per listing.
- Infra: Vercel cron sweeping a `research_queue` table every few minutes (fits current
  stack; no new queue service). Failures just leave the listing as-is — the formula
  price is already there, so the agent is strictly additive.

---

## What we deliberately did NOT make agents

- Any Stage 0–8 transform (dedup, damage intersect, grading, headline math): fixed-step,
  unit-tested, contract-enforcing code. An agent here adds cost and removes guarantees.
- A "listing writer" agent: Stage 5's grounding rules exist precisely because free
  generation drifted. Descriptions stay code-grounded.

## Open decisions (founder input)

1. **Auto-apply downgrades?** A1 proposes edits; is condition-downgrade the one
   auto-apply exception, or does everything wait for seller accept?
2. **Comp source order** — start with Gemini search grounding, or go straight back to
   eBay (the dependency we paused)?
3. **A2 trigger scope** — top-5 parts ≥$150 per listing, or research every part on
   Solo/paid plans only (plan-gated like usage caps)?
4. **Where research surfaces** — listing badge only, or also a weekly "mispriced
   inventory" digest through the existing report email?

## Build order

- **Phase 1 — A1 on two flags:** side-conflict + color-mismatch (both are one
  `cropAndAsk`/`readColors` playbook; the vision tooling built for them is reused by
  everything later). A-in-zone re-intersect is free code, include it.
- **Phase 2 — A2 with source #1** (search grounding), `price_research` table, listing
  badge. Revisit eBay only if grounding comps are too thin.

## Implementation notes (v1, shipped alongside this doc)

Both agents are built; two deliberate deviations from the sketch above:

- **A2 triggers on scan results, not post-save.** Research fires right after the scan
  lands (fire-and-forget) and the badges render on the review screen next to each price —
  where the seller is already editing — instead of on the saved listing. Still fully off
  the scan's latency path. No `price_research` table yet; results are transient advisory
  state. Persistence + post-save re-research can come later if the badges prove out.
- **A1 sends full downscaled photos, not server crops** (there's no `sharp` dependency;
  cropping would happen client-side anyway). The side playbook passes the part's bbox as
  coordinates for the model to focus on. The A-in-zone case resolves client-side with no
  model call, proposing the downgrade directly.

Files: `web/src/app/api/qa-resolve/route.ts`, `web/src/app/api/price-research/route.ts`,
`web/src/lib/qa-agent.ts` (+ tests), integration in `AddVehicle.tsx`. Auto-apply: nothing
auto-applies in v1 — every fix and price is seller-accepted (open decision #1 defaulted
to the conservative side).
