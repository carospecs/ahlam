// The shop's OWN sold prices — the strongest, proprietary pricing signal: real
// money real buyers paid this shop for a part. Grows more accurate the more the
// shop sells. Server-only (service role). Needs migration 0031 (sold_price/sold_at).
import { supabaseAdmin } from "./supabase";

export interface SoldRow {
  price_usd: number | null;
  sold_price: number | null;
  corrected: Record<string, unknown> | null;
  ai_output: Record<string, unknown> | null;
}

// At least this many matching past sales before we trust an own-comp median.
const MIN_OWN = 3;

// Load a shop's recent SOLD listings ONCE, so per-part matching is in-memory
// rather than a query per part (a 50-part scan would otherwise hammer the DB).
export async function loadSoldListings(shopId: string): Promise<SoldRow[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("listings")
      .select("price_usd, sold_price, corrected, ai_output")
      .eq("shop_id", shopId)
      .eq("status", "sold")
      .order("sold_at", { ascending: false, nullsFirst: false })
      .limit(2000);
    return (data as SoldRow[] | null) ?? [];
  } catch {
    return [];
  }
}

function rowName(r: SoldRow): string {
  const c = (r.corrected || r.ai_output || {}) as Record<string, unknown>;
  return String(c.partName || c.part_name || "").toLowerCase();
}
function rowPrice(r: SoldRow): number | null {
  const p = r.sold_price ?? r.price_usd; // captured sale price, else the listed price
  return p != null && Number(p) > 0 ? Number(p) : null;
}

// Own sold comps for a part: outlier-trimmed median + count + range of past sales
// whose part name matches. Returns null below MIN_OWN matches (cold-start safe).
export function ownSoldComps(
  rows: SoldRow[],
  partName: string,
): { median: number; count: number; min: number; max: number } | null {
  const term = partName.toLowerCase().trim();
  if (!term) return null;
  const prices = rows
    .filter((r) => {
      const n = rowName(r);
      return n && (n.includes(term) || term.includes(n));
    })
    .map(rowPrice)
    .filter((n): n is number => n != null);
  if (prices.length < MIN_OWN) return null;

  const sorted = [...prices].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.15);
  const trimmed = sorted.slice(cut, sorted.length - cut);
  const arr = trimmed.length ? trimmed : sorted;
  const m = Math.floor(arr.length / 2);
  const median = Math.round(arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2);
  return { median, count: prices.length, min: Math.round(sorted[0]), max: Math.round(sorted[sorted.length - 1]) };
}
