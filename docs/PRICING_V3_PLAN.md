# Pricing V3 — Evidence-First Pricing That Learns

Date: 2026-07-17 · Status: proposed
Diagram + full diagnosis: https://claude.ai/code/artifact/e4a1faea-c603-4181-93dc-b508d5133419

## The problem, precisely

The current ladder (cache → eBay comps + Sonnet judge / Opus web-search fallback →
Opus memory → Gemini memory → vision prices) fails in seven ways, ranked by impact:

1. **Asking-price-only comps** — eBay Browse returns active ASKING listings (sold
   data is approval-gated). The judge guesses the asking→sold markdown per part.
2. **Noisy retrieval, diluted judgment** — `compQuery` is "year make model part":
   no generation range, so wrong-gen parts pollute pools; ONE Sonnet call judges up
   to 80 parts × 12 titles at once and per-part attention drops.
3. **Tier roulette** — an eBay hiccup silently drops the scan to memory tiers; same
   car prices differently between scans; memory prices render like researched ones.
4. **String-matched join** — prices rejoin parts by echoed name; three regexes
   already patch known drift; new drift silently keeps the vision price.
   *(2026-08-12: largely addressed — `web/src/lib/part-catalog.ts` is now the
   canonical vocabulary; the judge path and the 48h comp cache key on stable
   `slug[:side]` ids and unmatched judge ids log `reprice-unmatched-part-id`.
   The memory/Gemini tiers still echo names and translate on merge.)*
5. **One national band per part type** — Corolla and Range Rover fenders share a
   $90–350 sanity band; luxury prices get dropped, cheap-car prices pass too high.
6. **No learning loop** — seller price edits and eBay sold events are discarded;
   the only memory is a 48h exact-vehicle cache.
7. **No measurement** — no golden set, no tier telemetry; changes judged by vibes.

Also: `docs/PRICING_SYSTEM.md` is two generations stale (describes the removed
age-formula system) — rewrite it when Phase 0 lands.

## Phase 0 — Measure (do first, ~1 day)

- **Golden set**: ~50 parts / ~10 vehicles (economy, truck, luxury, EV; new & old),
  hand-priced by Andy. Fixture file + extend `scripts/claude-price-test.mjs` into a
  regression eval scored on median % error. Every later phase must beat the baseline.
- **Tier telemetry**: `pricing_events` table — per scan-part: winning tier, price,
  band, compCount, latency, vehicle segment. Answers "how often is it roulette?".
- **Prod config check**: verify `ANTHROPIC_API_KEY` + `EBAY_CLIENT_ID/SECRET` are set
  in Vercel prod. If missing, prod has been running bottom-tier this whole time.

## Phase 1 — Retrieval + judgment quality (fixes 1, 2)

- **Generation-aware queries**: resolve generation year-range (static map per
  make/model + VIN year), query "2019-2023 Silverado 1500 door"; two variants
  (specific + generic) per part, merged pool.
- **Chunk the judge**: ≤15 parts per Sonnet call, calls in parallel.
- **Asking→sold calibration table**: nightly job (~20 grounded sold-price queries)
  computes per-part-class discount ratios; judge receives the table instead of
  guessing. Apply for eBay Marketplace Insights in parallel — real sold data
  replaces the table if granted.

## Phase 2 — Price ledger (fixes 6, feeds 5)

- **`part_price_observations`**: every judged price (+comp stats), every seller
  price edit, every eBay sold event — keyed `make + model + generation + part_type`.
- **Ledger prior tier**: generation-level medians slot between cache and comps;
  high-volume parts eventually price instantly from Ahlam's own data (moat).
- **Seller edits are ground truth**: capture the override delta on listing update.

## Phase 3 — Consistency + honest confidence (fixes 3, 4, 5)

- **Segment-aware bands**: per segment (economy / mainstream / luxury / EV-truck),
  regenerated weekly from ledger + comps.
- **Kill tier roulette**: persist priced results with the scan; never silently
  reprice on render. Memory-tier scans get flagged and upgraded to comps by a
  background job when eBay recovers.
- **Provenance everywhere**: "5 comps · ebay.com" vs "AI estimate" badge on every
  price, all tiers — not just market tiers.
- **Stable part IDs** through every model call (`part_id` echo, log unmatched rows)
  instead of name-string matching. *(Shipped for the judge path + comp cache via
  part-catalog, 2026-08-12; memory tiers remain name-echoed.)*
