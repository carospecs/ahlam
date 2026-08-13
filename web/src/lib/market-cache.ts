// MARKET COMP CACHE — comp-judged prices are identical across near-term rescans
// of the same vehicle, so evidence-backed results (confidence high/medium) are
// cached in the market_comps table (migration 0037, RLS deny-all, server-only).
// TTL is deliberately SHORT (48h): the comps-first path is fast, and a rescan
// must not serve stale asking prices as live — that would quietly reintroduce
// the staleness the design exists to prevent. Strictly best-effort: every
// function here swallows its own errors — a missing table or a down database
// never breaks the pricing route, it just means a fresh comps run.
import { supabaseAdmin } from "./supabase";
import type { MarketConfidence, MarketPricedPart } from "./market-pricing";

export const CACHE_TTL_HOURS = 48;

export type CachedComp = {
  price_usd: number;
  low_usd: number | null;
  high_usd: number | null;
  confidence: MarketConfidence;
  comp_count: number;
  sources: string[];
};

// Pure: the cache key. Normalized so "2021 Toyota Tacoma TRD Sport" scans hit the
// same rows regardless of caller-side casing/whitespace.
export function compKey(vehicleId: string, spec: string, partName: string, grade: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return [norm(vehicleId), norm(spec), norm(partName), norm(grade || "B")].join("|");
}

// Read fresh (≤48h) cached comps for the given keys. Returns a key→comp map;
// empty map on any error.
export async function readMarketComps(keys: string[]): Promise<Record<string, CachedComp>> {
  if (!keys.length) return {};
  try {
    const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("market_comps")
      .select("comp_key, price_usd, low_usd, high_usd, confidence, comp_count, sources")
      .in("comp_key", keys)
      .gte("created_at", cutoff);
    if (error || !data) return {};
    const out: Record<string, CachedComp> = {};
    for (const row of data) {
      if (typeof row.comp_key !== "string" || typeof row.price_usd !== "number" || row.price_usd <= 0) continue;
      out[row.comp_key] = {
        price_usd: row.price_usd,
        low_usd: typeof row.low_usd === "number" ? row.low_usd : null,
        high_usd: typeof row.high_usd === "number" ? row.high_usd : null,
        confidence: row.confidence === "high" ? "high" : "medium",
        comp_count: typeof row.comp_count === "number" ? row.comp_count : 0,
        sources: Array.isArray(row.sources) ? row.sources.filter((s: unknown): s is string => typeof s === "string") : [],
      };
    }
    return out;
  } catch {
    return {};
  }
}

// Write back evidence-backed results (high/medium with real comps only — a
// knowledge estimate must not pin a price even for 48h). Best-effort.
export async function writeMarketComps(
  vehicleId: string,
  spec: string,
  // partId (canonical slug[:side]) keys the cache row when provided so naming
  // drift can't cause misses; part_name stays the human display name.
  rows: { part: MarketPricedPart; grade: string; partId?: string }[],
): Promise<void> {
  const upserts = rows
    .filter(({ part }) => part.usedPartPriceUsd != null && part.compCount > 0 && part.confidence !== "low")
    .map(({ part, grade, partId }) => ({
      comp_key: compKey(vehicleId, spec, partId ?? part.name, grade),
      vehicle: vehicleId,
      part_name: part.name,
      grade: grade || "B",
      price_usd: part.usedPartPriceUsd,
      low_usd: part.usedPartPriceLowUsd,
      high_usd: part.usedPartPriceHighUsd,
      confidence: part.confidence,
      comp_count: part.compCount,
      sources: part.sourceDomains,
      created_at: new Date().toISOString(), // refresh the TTL on re-research
    }));
  if (!upserts.length) return;
  try {
    await supabaseAdmin().from("market_comps").upsert(upserts, { onConflict: "comp_key" });
  } catch {
    /* best-effort — never break pricing over a cache write */
  }
}
