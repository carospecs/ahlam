import { supabase } from "@/lib/supabase";

export interface MarketPart {
  id: string;
  part: string;
  grade: string;
  price: number;
  fitment: string;
  category: string;
  photoUrl: string | null;
  views: number;
  note: string;
  desc: string;
  shopId: string;
  shopName: string;
  location: string;
}

export interface MarketVehicle {
  id: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  body: string;
  color: string;
  mileage: string;
  sellMode: string;
  askingPrice: number | null;
  views: number;
  shopId: string;
  shopName: string;
  location: string;
}

/** Fitment may be a VehicleFit[] (camelCase) or a string. Normalize to text. */
function formatFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit
      .map((f: any) => {
        if (typeof f === "string") return f;
        const yr =
          f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd
            ? `${f.yearStart}–${f.yearEnd}`
            : f.yearStart || "";
        return [yr, f.make, f.model, f.notes].filter(Boolean).join(" ").trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

/**
 * The public marketplace feed for the mobile app. Pulls active part listings and
 * whole/both vehicles from OTHER shops (never the signed-in user's own shop),
 * reading directly from Supabase under the public-read RLS policies.
 */
export async function fetchMarketplace(
  myShopId: string | null
): Promise<{ parts: MarketPart[]; vehicles: MarketVehicle[] }> {
  const [{ data: listingRows }, { data: vehicleRows }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, shops(name, location)")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicles")
      .select("*, shops(name, location)")
      .in("sell_mode", ["whole", "both"])
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);

  const parts: MarketPart[] = (listingRows ?? [])
    .filter((l: any) => l.shop_id !== myShopId)
    .map((l: any) => {
      const c = l.corrected || l.ai_output || {};
      return {
        id: l.id,
        part: c.partName || c.part_name || "Used Part",
        grade: c.condition || "Good",
        price: l.price_usd ?? c.priceUsd ?? c.suggestedPriceUsd ?? 0,
        fitment: formatFit(c.fitment),
        category: c.partCategory || c.part_category || "",
        photoUrl: l.photo_url || null,
        views: l.views || 0,
        note: c.conditionNotes || c.condition_notes || "",
        desc: c.description || "",
        shopId: l.shop_id,
        shopName: l.shops?.name || "Independent seller",
        location: l.shops?.location || "",
      };
    });

  const vehicles: MarketVehicle[] = (vehicleRows ?? [])
    .filter((v: any) => v.shop_id !== myShopId)
    .map((v: any) => ({
      id: v.id,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim || "",
      body: v.body || "",
      color: v.color || "",
      mileage: v.mileage || "",
      sellMode: v.sell_mode || "whole",
      askingPrice: v.asking_price,
      views: v.views || 0,
      shopId: v.shop_id,
      shopName: v.shops?.name || "Independent seller",
      location: v.shops?.location || "",
    }));

  return { parts, vehicles };
}

/** Bump a part listing's view counter (best-effort). */
export async function incrementListingView(listingId: string): Promise<void> {
  try { await supabase.rpc("increment_listing_views", { p_listing_id: listingId }); } catch { /* view counting never blocks UI */ }
}

/** Bump a vehicle's view counter (best-effort). */
export async function incrementVehicleView(vehicleId: string): Promise<void> {
  try { await supabase.rpc("increment_vehicle_views", { p_vehicle_id: vehicleId }); } catch { /* view counting never blocks UI */ }
}

/** Message the seller of a part listing. Uses the contact_seller RPC. */
export async function contactSeller(listingId: string, message: string): Promise<void> {
  const { error } = await supabase.rpc("contact_seller", {
    p_listing_id: listingId,
    p_message: message,
  });
  if (error) throw error;
}

/** Message a shop about a whole-car vehicle (no listing row). Uses contact_shop. */
export async function contactShop(shopId: string, subject: string, message: string): Promise<void> {
  const { error } = await supabase.rpc("contact_shop", {
    p_shop_id: shopId,
    p_subject: subject,
    p_message: message,
  });
  if (error) throw error;
}
