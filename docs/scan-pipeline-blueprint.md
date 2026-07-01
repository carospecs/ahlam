# Scan Pipeline Blueprint

Turning the founder's 9-stage image-processing pipeline into an implementable design:
per-stage data contracts, the model-vs-code split, ordering, cost, and how each stage
evolves what already ships today (as of commit `c829581`).

**Framing:** these are pipeline **stages** (focused model calls + deterministic code),
not autonomous agents. The lesson from the prompt-vs-code episode holds: **do not use a
model for what code can do.** A stage is a "model stage" only when it needs pixels or
language; everything else is pure, unit-testable code.

---

## Data model (flows through the pipeline)

```
Image      = { index, originalUrl, redactedUrl?, vehicleFront }
Detection  = { id, photoIndex, partName, bbox, confidence, imageSide, conditionCue }
Part       = { id, partName, side, region, photoIndex, bbox, confidence,
               condition, inferred, compliance?, description?,
               newPartPriceUsd?, suggestedPriceUsd?, flags[] }
Zone       = { photoIndex, bbox, severity }          // a located impact area
Listing    = { vehicle, parts[], headlineTotalUsd, qa[], coverageGaps[] }
```

`condition` is written **only** by Stage 3 and is read-only downstream.
`headlineTotalUsd` = observed, non-inferred, non-damaged parts only.

---

## Stages

### 0 · PII Redaction  — supporting, runs FIRST  ·  MODEL + CODE  ·  NET-NEW
- **In:** raw images. **Out:** `redactedUrl` per image + detected `{plate, vin}` regions.
- **Model:** detect license-plate + windshield-VIN bounding boxes. **Code:** blur those
  regions (server-side image processing, e.g. `sharp`) → a redacted copy.
- **Rule:** the VIN is still read from the **original** internally (fitment); every
  customer-facing surface (thumbnails, listing photos) uses the **redacted** copy.
- *Both were fully legible in the source photos — this is a privacy/legal gate.*

### 1 · Detection & Mapping  ·  MODEL (vision + bbox), per photo, parallel  ·  evolves the current scan
- **In:** original images. **Out:** `detections[]` (observed, in pixels) + a SEPARATE
  `candidateInferred[]` list (implied, not in pixels).
- Each detection carries a **bounding box + confidence** and the photo it came from.
- **Change from today:** the scan currently returns parts without boxes and mixes
  inferred parts in. This stage adds boxes and splits observed vs. candidate-inferred at
  the source. Boxes are what make Stages 0/2/3 rigorous.

### 2 · Deduplication & Reconciliation  ·  CODE  ·  evolves `dropGenericWhenSided` + `photo-select` + `lateralSide`
- **In:** all `detections[]` + per-photo `vehicleFront`. **Out:** one `Part` per physical
  part, tied to its **clearest** photo (best bbox/confidence/orientation-fit).
- Merges cross-photo duplicates; collapses generic↔sided ("Front Seat" vs "Driver Side
  Front Seat"); resolves L/R against **which side each photo actually shows**.
- *This is where the inflated part count is corrected — before anything is priced.*

### 3 · Damage Assessment  ·  MODEL (locate zones) + CODE (intersect + propagate)  ·  evolves `propagateImpactDamage`
- **In:** `parts[]` + images. **Out:** each `Part` gets an **authoritative `condition`**.
- **Model:** a dedicated pass that locates **impact zones** (bboxes of caved-in/creased
  areas). **Code:** any part whose bbox **intersects a zone** is downgraded; propagate
  across the zone via the panel-adjacency map as backup.
- **Contract:** this stage OWNS `condition`. Description and Pricing must consume it and
  may not override it. *(Today's version infers the zone from adjacency only — the net-new
  rigor is locating the zone in pixels and intersecting boxes.)*

### 4 · Inference & Restricted-Parts  ·  CODE  ·  evolves `markInferredParts` + `complianceFor`
- **In:** `candidateInferred[]` + `parts[]`. **Out:** inferred parts tagged
  "inferred — verify," kept in a **separate bucket**, excluded from the headline;
  restricted parts (airbag, seat belt) carry compliance warnings.
- Never lists an unverifiable restricted part as if observed.

### 5 · Description Generation  ·  MODEL (text) + CODE (grounding)  ·  NET-NEW
- **In:** reconciled `parts[]` + authoritative `condition` + one **locked vehicle color**.
- **Grounding rules (code-enforced):** lock a single vehicle color once from the best-lit
  photo and reuse everywhere (kills "gray" vs "bronze"); validated L/R; **mandatory
  hedging** ("partially visible," "not confirmed") when a part is occluded (low bbox
  confidence / clipped box); **forbidden** from asserting any condition Stage 3 didn't set.

### 6 · Pricing / Valuation  ·  CODE  ·  evolves current formula + parity
- **In:** reconciled `parts[]` + condition grades + inferred/damaged flags.
- **Condition is a hard input** — a damaged panel cannot price as Grade A.
- **Headline total excludes** duplicates (already merged), inferred parts, and damaged
  items by default (they're still listed/priced individually, just not in the headline).
- **Open:** "part- and trim-specific, not fixed-bucket" needs a real data source, which is
  currently paused (no eBay/external). Until reopened: keep the formula + do the exclusions.

### 7 · QA / Verification  ·  CODE  ·  NET-NEW  (the guardrail that makes it an inspector, not an optimist)
- **In:** the assembled `Listing`. **Out:** consistency flags; blocks silent publish.
- Checks: color used uniformly · side labels coherent · **no Grade-A part inside a damage
  zone** · headline total reconciled against the whole-car estimate · low-confidence /
  contradictory items routed to human review.

### 8 · Coverage / Completeness  ·  CODE  ·  evolves the existing report line
- **In:** `parts[]` + photo set. **Out:** a prompt when high-value categories are absent
  (transmission, alternator, starter, AC compressor, cat) → "add engine-bay/underbody
  photos." *(`missingHighValueCategories` already exists — surface it as an action.)*

---

## Ordering & parallelism

```
raw images
   │
   ├─▶ [0] PII Redaction ........ (vision, per photo)  ─┐  redacted copies
   │                                                    │  (needed at display/save)
   └─▶ [1] Detection & Mapping .. (vision, per photo, parallel)
                │  detections[] + candidateInferred[]
                ▼
           [2] Dedup & Reconcile . (code)  ── parts[] tied to clearest photo
                ▼
           [3] Damage Assessment . (vision zones + code)  ── authoritative condition
                ▼                          ┌───────────────┐
           [4] Inference/Restricted (code) │ can run after │
           [5] Description .... (vision+code, needs condition)
           [6] Pricing ....... (code, needs condition + flags)
                ▼
           [7] QA / Verification . (code guardrail)
           [8] Coverage ......... (code)
```

**Vision passes per scan:** PII, Detection, Damage-zones (≈3 over the photos) + one text
pass for Description — vs. today's single vision call per photo. Focused calls are more
reliable per part, but this is a **~2–3× increase in vision cost/latency**; mitigate with
`flash` where accuracy allows, per-photo parallelism, and batching Description into one call.

---

## Open decisions (need founder input before building)

1. **Cost/latency budget** — this ~2–3×'s the vision calls per scan. Acceptable? Decides
   `flash` vs `pro` per stage and how aggressively we batch.
2. **Pricing data** — "trim-specific, not fixed-bucket" needs the data source you paused.
   Default: keep the formula + add the headline exclusions. Reopen a source, or not?
3. **Bounding-box detection** — this re-architects the scan around a detection model that
   returns boxes (foundational for PII, damage-zone intersection, clearest-photo). Confirm.
4. **PII redaction priority** — fast-track it independent of the rest (legal/privacy)?
   Confirm: keep the original internally for fitment, blur only customer-facing copies.
5. **Headline definition** — exclude duplicates (auto) + inferred + **damaged (Grade C)**
   from the headline total, while still listing/pricing them individually. Confirm.

---

## Phased build (after blueprint is locked)

- **Phase A — quick, mostly code, high value:** headline exclusions (Stage 6 code),
  QA guardrail (Stage 7), coverage prompt (Stage 8, evolve existing) — **plus PII
  redaction (Stage 0)**, net-new but high-stakes.
- **Phase B — the foundation:** Detection & Mapping with bounding boxes (Stage 1), which
  upgrades Dedup (Stage 2) to bbox-aware. Everything downstream gets more rigorous.
- **Phase C — the heavy vision stages:** Damage zone-location (Stage 3 model half) and
  grounded Description (Stage 5).

Each phase ships and is verified independently, evolving the deterministic passes already
in production rather than replacing them.
