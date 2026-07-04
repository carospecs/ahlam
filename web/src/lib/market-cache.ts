// MARKET COMP CACHE — researched prices are stable for days and identical across
// scans of the same vehicle, so evidence-backed comps (confidence high/medium)
// are cached in the market_comps table (migration 0037, RLS deny-all, server-only)
// and reused for 14 days. The cache is strictly best-effort: every function here
// swallows its own errors — a missing table or a down database must never break
// the pricing route, it just means a fresh research call.
import { supabaseAdmin } from "./supabase";
import type { MarketConfidence, MarketPricedPart } from "./market-pricing";

export const CACHE_TTL_DAYS = 14;

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

// Read fresh (≤14d) cached comps for the given keys. Returns a key→comp map;
// empty map on any error.
export async function readMarketComps(keys: string[]): Promise<Record<string, CachedComp>> {
  if (!keys.length) return {};
  try {
    const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
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

// Write back evidence-backed research results (high/medium with real comps only —
// a knowledge estimate must not pin a price for 14 days). Best-effort.
export async function writeMarketComps(
  vehicleId: string,
  spec: string,
  rows: { part: MarketPricedPart; grade: string }[],
): Promise<void> {
  const upserts = rows
    .filter(({ part }) => part.usedPartPriceUsd != null && part.compCount > 0 && part.confidence !== "low")
    .map(({ part, grade }) => ({
      comp_key: compKey(vehicleId, spec, part.name, grade),
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
