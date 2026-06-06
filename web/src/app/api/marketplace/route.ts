import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

const R = 3959; // Earth radius in miles

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function driveTimeMinutes(miles: number): number {
  return Math.round(miles / 35 * 60); // avg 35 mph surface street
}

// The public marketplace feed. A buyer sees everything OTHER shops have posted
// (active listings + whole-car vehicles) — never their own shop's posts. Falls
// back to a small demo set so the feed never looks empty in a fresh install.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const conditionMin = url.searchParams.get("condition_min");
  const priceMax = url.searchParams.get("price_max");
  const sort = url.searchParams.get("sort");
  const q = url.searchParams.get("q");
  const buyerLat = url.searchParams.get("lat") ? parseFloat(url.searchParams.get("lat")!) : null;
  const buyerLng = url.searchParams.get("lng") ? parseFloat(url.searchParams.get("lng")!) : null;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const db = supabaseAdmin();

  let ownShopId: string | null = null;
  if (user) {
    const { data: profile } = await db
      .from("profiles").select("shop_id").eq("id", user.id).single();
    ownShopId = profile?.shop_id || null;
  }

  // Shops keyed by id for seller info.
  const { data: shops } = await db.from("shops").select("*");
  const shopMap = new Map((shops || []).map((s: any) => [s.id, s]));

  // Active part listings from other shops (filtered in SQL).
  let listQuery = db.from("listings").select("*").eq("status", "active");
  if (ownShopId) listQuery = listQuery.neq("shop_id", ownShopId);
  if (priceMax) listQuery = listQuery.lte("price_usd", Number(priceMax));
  if (sort === "price-asc") listQuery = listQuery.order("price_usd", { ascending: true });
  else if (sort === "price-desc") listQuery = listQuery.order("price_usd", { ascending: false });
  else if (sort === "views") listQuery = listQuery.order("views", { ascending: false });
  else if (sort !== "distance") listQuery = listQuery.order("created_at", { ascending: false });
  const { data: listingRows } = await listQuery;

  let parts = (listingRows || []).map((l: any) => {
    const c = l.corrected || l.ai_output || {};
    const shop = shopMap.get(l.shop_id);
    const shopLat = shop?.lat ? parseFloat(shop.lat) : null;
    const shopLng = shop?.lng ? parseFloat(shop.lng) : null;
    let distance: number | null = null;
    if (buyerLat !== null && buyerLng !== null && shopLat !== null && shopLng !== null) {
      distance = Math.round(haversine(buyerLat, buyerLng, shopLat, shopLng) * 10) / 10;
    }
    return {
      id: l.id,
      part: c.partName || c.part_name || "Used Part",
      grade: ["A","B","C","D","F"].includes(c.condition) ? c.condition : "C",
      price: l.price_usd ?? c.priceUsd ?? c.suggestedPriceUsd ?? c.suggested_price ?? 0,
      fitment: formatFit(c.fitment),
      category: c.partCategory || c.part_category || "",
      photoUrl: l.photo_url || null,
      views: l.views || 0,
      sellerId: l.seller_id || l.created_by,
      shopId: l.shop_id,
      shopName: shop?.name || "Independent seller",
      location: shop?.zip_code || shop?.location || "",
      distance,
      driveTime: distance !== null ? driveTimeMinutes(distance) : null,
      note: c.conditionNotes || c.condition_notes || "",
      desc: c.description || "",
      confidence: c.confidence || "high",
      markets: l.marketplace_url ? ["Marketplace"] : [],
    };
  });

  if (q) {
    const search = q.toLowerCase();
    parts = parts.filter(p => p.part.toLowerCase().includes(search));
  }
  if (category) {
    parts = parts.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  const GRADE_SCORE: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  if (conditionMin) {
    const minScore = GRADE_SCORE[conditionMin.toUpperCase()] ?? 0;
    parts = parts.filter(p => (GRADE_SCORE[p.grade] || 0) >= minScore);
  }

  // Distance sort (happens in-memory since Supabase can't do Haversine in JS).
  if (sort === "distance") {
    parts.sort((a: any, b: any) => (a.distance ?? 9999) - (b.distance ?? 9999));
  }

  // Whole-car vehicles from other shops (filtered in SQL).
  let vehQuery = db.from("vehicles").select("*").in("sell_mode", ["whole", "both"]).eq("status", "active");
  if (ownShopId) vehQuery = vehQuery.neq("shop_id", ownShopId);
  const { data: vehicleRows } = await vehQuery.order("created_at", { ascending: false });

  let vehicles = (vehicleRows || []).map((v: any) => {
    const shop = shopMap.get(v.shop_id);
    const shopLat = shop?.lat ? parseFloat(shop.lat) : null;
    const shopLng = shop?.lng ? parseFloat(shop.lng) : null;
    let distance: number | null = null;
    if (buyerLat !== null && buyerLng !== null && shopLat !== null && shopLng !== null) {
      distance = Math.round(haversine(buyerLat, buyerLng, shopLat, shopLng) * 10) / 10;
    }
    return {
      id: v.id,
      year: v.year, make: v.make, model: v.model, trim: v.trim || "",
      body: v.body || "", color: v.color || "",
      sellMode: v.sell_mode || "whole",
      askingPrice: v.asking_price,
      views: v.views || 0,
      shopId: v.shop_id,
      shopName: shop?.name || "Independent seller",
      location: shop?.zip_code || shop?.location || "",
      distance,
      driveTime: distance !== null ? driveTimeMinutes(distance) : null,
    };
  });

  if (q) {
    const search = q.toLowerCase();
    vehicles = vehicles.filter(v =>
      (v.make || "").toLowerCase().includes(search) ||
      (v.model || "").toLowerCase().includes(search) ||
      String(v.year || "").includes(search)
    );
  }

  if (sort === "distance") {
    vehicles.sort((a: any, b: any) => (a.distance ?? 9999) - (b.distance ?? 9999));
  }

  // Demo fallback so the marketplace is never empty for a brand-new shop.
  const usedDemo = parts.length === 0 && vehicles.length === 0;
  if (usedDemo) {
    return NextResponse.json({ demo: true, parts: DEMO_PARTS, vehicles: DEMO_VEHICLES });
  }

  return NextResponse.json({ demo: false, parts, vehicles });
}

// Fitment may be a VehicleFit[] (from the app) or a plain string. Normalize to
// a readable "2013–2017 Honda Accord" style string.
function formatFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit.map((f: any) => {
      if (typeof f === "string") return f;
      const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : (f.yearStart || "");
      return [yr, f.make, f.model, f.notes].filter(Boolean).join(" ").trim();
    }).filter(Boolean).join(", ");
  }
  return "";
}

const DEMO_PARTS = [
  { id: "m1", part: "OEM Alternator", grade: "B", price: 95, fitment: "2013–2017 Honda Accord 2.4L", category: "Electrical", photoUrl: null, views: 64, sellerId: null, shopId: "demo-a", shopName: "Eastgate Auto Recyclers", location: "92805", distance: 3.2, driveTime: 5, note: "Bench-tested, holds charge", desc: "Pulled from a clean 2015 Accord. Tested good on the bench.", confidence: "high", markets: [] },
  { id: "m2", part: "Tailgate Assembly", grade: "B", price: 410, fitment: "2009–2014 Ford F-150", category: "Body / Exterior", photoUrl: null, views: 188, sellerId: null, shopId: "demo-b", shopName: "Harbor Salvage", location: "90732", distance: 8.1, driveTime: 14, note: "No rust on inner lip", desc: "Solid tailgate, latch and handle work. Oxford White.", confidence: "high", markets: [] },
  { id: "m3", part: "Front Bumper Cover", grade: "B", price: 160, fitment: "2016–2018 Toyota Camry", category: "Body / Exterior", photoUrl: null, views: 41, sellerId: null, shopId: "demo-a", shopName: "Eastgate Auto Recyclers", location: "92805", distance: 3.2, driveTime: 5, note: "Minor scuffs, all tabs intact", desc: "Factory bumper cover, fog brackets included.", confidence: "high", markets: [] },
  { id: "m4", part: "Alloy Wheel (set of 4)", grade: "B", price: 280, fitment: "2015–2017 Subaru Outback", category: "Wheels / Tires", photoUrl: null, views: 97, sellerId: null, shopId: "demo-c", shopName: "Vega Used Parts", location: "90746", distance: 5.7, driveTime: 10, note: "17in, balanced, light curb rash", desc: "Four factory alloys, all straight and balanced.", confidence: "high", markets: [] },
  { id: "m5", part: "Left Headlight Assembly", grade: "D", price: 35, fitment: "2014–2018 Nissan Altima", category: "Lighting", photoUrl: null, views: 22, sellerId: null, shopId: "demo-b", shopName: "Harbor Salvage", location: "90732", distance: 8.1, driveTime: 14, note: "Hazy lens, sold as core", desc: "Headlight core, lens is foggy. Good for a restore.", confidence: "medium", markets: [] },
  { id: "m6", part: "Starter Motor", grade: "B", price: 70, fitment: "2012–2016 Chevy Cruze 1.4L", category: "Electrical", photoUrl: null, views: 53, sellerId: null, shopId: "demo-c", shopName: "Vega Used Parts", location: "90746", distance: 5.7, driveTime: 10, note: "Spins strong, clean teeth", desc: "Removed working. 30-day guarantee.", confidence: "high", markets: [] },
];

const DEMO_VEHICLES = [
  { id: "mv1", year: "2013", make: "Ford", model: "F-150", trim: "XLT", body: "Pickup", color: "Oxford White", mileage: "148k mi", sellMode: "both", askingPrice: 4200, views: 212, vin: "", shopId: "demo-b", shopName: "Harbor Salvage", location: "90732", distance: 8.1, driveTime: 14 },
  { id: "mv2", year: "2016", make: "Toyota", model: "Camry", trim: "LE", body: "Sedan", color: "Silver", mileage: "96k mi", sellMode: "whole", askingPrice: 3800, views: 154, vin: "", shopId: "demo-a", shopName: "Eastgate Auto Recyclers", location: "92805", distance: 3.2, driveTime: 5 },
  { id: "mv3", year: "2015", make: "Subaru", model: "Outback", trim: "2.5i", body: "Wagon", color: "Dark Gray", mileage: "131k mi", sellMode: "both", askingPrice: 5100, views: 88, vin: "", shopId: "demo-c", shopName: "Vega Used Parts", location: "90746", distance: 5.7, driveTime: 10 },
];
