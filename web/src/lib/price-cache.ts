// Durable cache for grounded (Gemini web-search) sold-price lookups. Cuts cost
// (the same part+vehicle query isn't paid for twice) and variance (repeat scans
// get the same number instead of the LLM's run-to-run drift). Best-effort — any
// failure just means a cache miss. Server-only. Needs migration 0032.
import { supabaseAdmin } from "./supabase";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // refresh weekly so prices stay current

const key = (q: string) => q.toLowerCase().trim();

// Return a cached price for `query` if present and fresh, else null.
export async function getCachedPrice(query: string): Promise<number | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("price_cache")
      .select("price, created_at")
      .eq("query", key(query))
      .maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.created_at as string).getTime() > TTL_MS) return null; // stale
    const p = Number(data.price);
    return p > 0 ? p : null;
  } catch {
    return null;
  }
}

// Store (or refresh) a grounded price for `query`.
export async function setCachedPrice(query: string, price: number, source = "grounded"): Promise<void> {
  try {
    await supabaseAdmin()
      .from("price_cache")
      .upsert({ query: key(query), price, source, created_at: new Date().toISOString() }, { onConflict: "query" });
  } catch {
    /* cache is best-effort */
  }
}
