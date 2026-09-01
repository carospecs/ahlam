import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeGrade } from "@/lib/grade";
import { effectiveWarranty, warrantyLabel } from "@/lib/warranty";
import { classifyPowertrain } from "@/lib/powertrain";
import { evFitLines, type EvFitLine } from "@/lib/ev-interchange";

// Shared read layer for the public shop surfaces: the apex storefront
// (/shop/[id]), the part page (/p/[id]), and the Ultimate personal websites
// ({slug}.ahlam.io → /site/[slug]). Everything here is read-only and selects
// only columns that are safe to render publicly — never select("*") on shops
// (the row carries Stripe ids).

// plan / trial_ends_at / subscription_status are for hasPersonalSite() gating
// only; they are never rendered.
const BASE_COLUMNS =
  "id, name, location, address_line, zip_code, lat, lng, business_phone, email, website, facebook_url, yelp_url, description, hours, logo_url, cover_url, default_warranty_days, returns_policy, verified, rating_avg, rating_count, plan, trial_ends_at, subscription_status, promo_text";
export const SHOP_PUBLIC_COLUMNS = `${BASE_COLUMNS}, slug`;

// ---------------------------------------------------------------------------
// Demo site — served at demo.ahlam.io (and demo.localhost in dev). The slug is
// reserved so no shop can ever claim it; it renders the real site pages with
// the same fictional yard the marketplace uses for its demo inventory, and is
// the "see an example site" link for the Ultimate pitch.
// ---------------------------------------------------------------------------

const DEMO_SHOP = {
  id: "demo-site",
  name: "Eastgate Auto Recyclers",
  slug: "demo",
  location: "Anaheim, CA",
  address_line: "1420 E. Katella Ave",
  zip_code: "92805",
  lat: 33.804, lng: -117.885,
  business_phone: "(714) 555-0142",
  email: "parts@example.com",
  website: null,
  facebook_url: null,
  yelp_url: null,
  promo_text: null,
  description: "Family-run auto recycler serving Orange County since 1998. Every part is pulled by our own crew, tested where it counts, honestly graded, and photographed as-is.",
  hours: "Mon–Fri 8:00 AM – 5:00 PM\nSat 8:00 AM – 3:00 PM\nSun closed",
  logo_url: null, cover_url: null,
  default_warranty_days: 30,
  returns_policy: "Returns accepted within 30 days with receipt. Electrical parts must be tested on the vehicle before installation.",
  verified: true,
  rating_avg: 4.8, rating_count: 37,
  plan: "founder", trial_ends_at: null, subscription_status: null,
};

const demoPart = (id: string, part: string, grade: string, price: number, fitment: string, category: string, desc: string, note: string, asIs = false) => ({
  id, part, grade, price, fitment, category, photoUrl: null, desc, note,
  warrantyText: warrantyLabel(asIs ? 0 : 30, asIs), asIs, soldAt: null as string | null, soldPrice: null as number | null,
});

const DEMO_PARTS = [
  demoPart("demo-p1", "OEM Alternator", "B", 95, "2013–2017 Honda Accord 2.4L", "Electrical", "Pulled from a clean 2015 Accord. Tested good on the bench.", "Bench-tested, holds charge"),
  demoPart("demo-p2", "Tailgate Assembly", "B", 410, "2009–2014 Ford F-150", "Body / Exterior", "Solid tailgate, latch and handle work. Oxford White.", "No rust on inner lip"),
  demoPart("demo-p3", "Front Bumper Cover", "B", 160, "2016–2018 Toyota Camry", "Body / Exterior", "Factory bumper cover, fog brackets included.", "Minor scuffs, all tabs intact"),
  demoPart("demo-p4", "Alloy Wheel Set (4)", "A", 280, "2015–2017 Subaru Outback", "Wheels / Tires", "Four factory alloys, all straight and balanced.", "17in, light curb rash on one"),
  demoPart("demo-p5", "Left Headlight Assembly", "C", 35, "2014–2018 Nissan Altima", "Lighting", "Headlight core, lens is foggy. Good for a restore.", "Sold as core", true),
];

const DEMO_VEHICLES = [
  { id: "demo-v1", year: "2015", make: "Honda", model: "Accord", trim: "EX-L", body: "Sedan", color: "Modern Steel", sellMode: "both", askingPrice: 4200, photoUrl: null, mileage: "142k mi" },
  { id: "demo-v2", year: "2012", make: "Ford", model: "F-150", trim: "XLT", body: "SuperCrew", color: "Oxford White", sellMode: "both", askingPrice: null, photoUrl: null, mileage: "198k mi" },
];

const DEMO_SOLD = [
  { ...demoPart("demo-s1", "Side Mirror, Driver Side", "B", 85, "2018–2022 Honda Civic", "Body / Exterior", "Power, heated.", ""), soldAt: new Date(Date.now() - 4 * 864e5).toISOString(), soldPrice: 85 },
  { ...demoPart("demo-s2", "Radiator", "B", 110, "2013–2017 Honda Accord 2.4L", "Cooling", "Pressure-tested, no leaks.", ""), soldAt: new Date(Date.now() - 7 * 864e5).toISOString(), soldPrice: 110 },
];

const DEMO_REVIEWS = [
  { id: "demo-r1", rating: 5, body: "Had the exact Accord alternator I needed, tested it in front of me. In and out in 15 minutes.", verified_purchase: true, author: "Miguel R." },
  { id: "demo-r2", rating: 5, body: "Best prices in OC for body panels. The condition grades are honest.", verified_purchase: true, author: "Sandra T." },
];

// TEMP LOCAL PREVIEW (2026-08-11): serves Downtown Auto Dismantlers' real profile
// before the shop_slug migration lands, so the site can be previewed locally.
// Remove this block (and its three hooks below) once the migration is applied —
// the DB row 159c4cdc-3cbc-4061-9942-5c901486df49 then takes over via slug lookup.
const DAD_PREVIEW = {
  ...DEMO_SHOP,
  id: "159c4cdc-3cbc-4061-9942-5c901486df49",
  name: "Downtown Auto Dismantlers Inc.",
  slug: "downtownautodismantlers",
  location: "Los Angeles, CA 90001",
  address_line: "6828 McKinley Ave",
  zip_code: "90001",
  lat: 33.9731, lng: -118.2479,
  business_phone: "(323) 758-5167",
  email: "downtownautodismantling@gmail.com",
  website: "http://trade9527.car-part.com",
  facebook_url: "https://www.facebook.com/people/Downtown-Auto-Dismantlers-Inc/61590698635809/",
  yelp_url: "https://www.yelp.com/biz/downtown-auto-dismantlers-los-angeles-2",
  description: "We've sold quality used OEM auto parts in Los Angeles since 2013, specializing in Toyota, Honda, Chevy, Ford, and Dodge. We're now expanding into EV, including Tesla, with delivery for EV parts only.",
  hours: "Mon–Fri 8am–5pm, Sat 8am–3pm",
  default_warranty_days: 60,
  returns_policy: "60-day warranty on labor. Engine and transmission carry a 90-day warranty with exchange.",
  promo_text: "Labor Day Sale (Aug 31–Sept 7): 10% off all parts",
  verified: false,
  rating_avg: 0, rating_count: 0,
  plan: "ultimate",
};

export const getShopById = cache(async (id: string): Promise<any | null> => {
  if (id === DEMO_SHOP.id) return DEMO_SHOP;
  if (id === DAD_PREVIEW.id) return DAD_PREVIEW; // TEMP LOCAL PREVIEW
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("shops").select(SHOP_PUBLIC_COLUMNS).eq("id", id).single();
    if (data) return data;
    // Pre-migration fallback: until 20260713000000_shop_slug.sql is applied the
    // slug column doesn't exist and the select above errors (42703). The apex
    // storefront must keep working through that window.
    if (error?.code === "42703") {
      const { data: row } = await db.from("shops").select(BASE_COLUMNS).eq("id", id).single();
      return row ? { ...row, slug: null } : null;
    }
    return null;
  } catch {
    return null;
  }
});

export const getShopBySlug = cache(async (slug: string): Promise<any | null> => {
  if (slug === DEMO_SHOP.slug) return DEMO_SHOP;
  if (slug === DAD_PREVIEW.slug) return DAD_PREVIEW; // TEMP LOCAL PREVIEW
  try {
    const db = supabaseAdmin();
    // Pre-migration (no slug column) this errors and returns null — every
    // personal site 404s until the migration lands, which is correct.
    const { data } = await db.from("shops").select(SHOP_PUBLIC_COLUMNS).ilike("slug", slug).single();
    return data || null;
  } catch {
    return null;
  }
});

export function fmtFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit
      .map((f: any) => {
        if (typeof f === "string") return f;
        const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : f.yearStart || "";
        return [yr, f.make, f.model].filter(Boolean).join(" ").trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

/** Curated "Also fits" lines for a listing (EV interchange v1). Only fires when
 *  the listing's primary fitment entry resolves to a BEV whose part is in our
 *  hand-checked dataset (lib/ev-interchange) — everything else returns [].
 *  Pure static-data lookup: no AI, no DB, never throws. */
export function evAlsoFits(fitment: any, partName: string): EvFitLine[] {
  try {
    const f = Array.isArray(fitment) ? fitment[0] : null;
    if (!f || typeof f !== "object" || !f.make || !f.model || !partName) return [];
    const year = Number(f.yearStart || f.yearEnd);
    if (!Number.isFinite(year)) return [];
    if (classifyPowertrain({ make: String(f.make), model: String(f.model) }).type !== "bev") return [];
    return evFitLines({ make: String(f.make), model: String(f.model), year, partName }).slice(0, 4);
  } catch {
    return [];
  }
}

/** Listing row → the part shape the storefront and site pages render. */
export function mapPart(l: any, defaultWarrantyDays?: number | null) {
  const c = l.corrected || l.ai_output || {};
  const w = effectiveWarranty({ warrantyDays: c.warrantyDays, asIs: c.asIs }, defaultWarrantyDays);
  return {
    id: l.id as string,
    part: (c.partName || c.part_name || "Used Part") as string,
    grade: normalizeGrade(c.condition),
    price: (l.price_usd ?? c.suggestedPriceUsd ?? 0) as number,
    fitment: fmtFit(c.fitment),
    category: (c.partCategory || c.part_category || "") as string,
    photoUrl: (l.photo_url || (Array.isArray(l.photo_urls) ? l.photo_urls[0] : null) || null) as string | null,
    desc: (c.description || "") as string,
    note: (c.conditionNotes || c.condition_notes || "") as string,
    warrantyText: warrantyLabel(w.days, w.asIs),
    asIs: w.asIs,
    soldAt: (l.sold_at || null) as string | null,
    soldPrice: (l.sold_price ?? null) as number | null,
  };
}

export function mapVehicle(v: any) {
  return {
    id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim || "",
    body: v.body || "", color: v.color || "", sellMode: v.sell_mode || "whole", askingPrice: v.asking_price,
    photoUrl: (v.photo_url || (Array.isArray(v.photo_urls) ? v.photo_urls[0] : null) || null) as string | null,
    mileage: v.mileage || "",
  };
}

/** Everything a shop has live: active parts, sellable vehicles, recent reviews
 *  (with author display names). */
export async function getShopInventory(shop: { id: string; default_warranty_days?: number | null }) {
  if (shop.id === DEMO_SHOP.id) return { parts: DEMO_PARTS, vehicles: DEMO_VEHICLES, reviews: DEMO_REVIEWS };
  let parts: any[] = [];
  let vehicles: any[] = [];
  let reviews: any[] = [];
  try {
    const db = supabaseAdmin();
    const [l, v, rv] = await Promise.all([
      db.from("listings").select("*").eq("shop_id", shop.id).eq("status", "active").order("created_at", { ascending: false }),
      db.from("vehicles").select("*").eq("shop_id", shop.id).in("sell_mode", ["whole", "both"]).eq("status", "active").order("created_at", { ascending: false }),
      db.from("reviews").select("id, rating, body, verified_purchase, created_at, author_id").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(20),
    ]);
    parts = (l.data || []).map((row: any) => mapPart(row, shop.default_warranty_days));
    vehicles = (v.data || []).filter((x: any) => x.status === "active").map(mapVehicle);
    reviews = rv.data || [];
    const authorIds = Array.from(new Set(reviews.map((r: any) => r.author_id)));
    if (authorIds.length) {
      const { data: profs } = await db.from("profiles").select("id, display_name").in("id", authorIds);
      const nameOf = new Map((profs || []).map((p: any) => [p.id, p.display_name]));
      reviews = reviews.map((r: any) => ({ ...r, author: nameOf.get(r.author_id) || "Buyer" }));
    }
  } catch {
    // render an empty storefront rather than erroring the whole page
  }
  return { parts, vehicles, reviews };
}

/** Parts this shop sold recently — the personal site's public social-proof
 *  section. Sales land here automatically: both the manual sold flip and the
 *  escrow release write status='sold' + sold_at on the same listings table. */
export async function getRecentlySold(shop: { id: string; default_warranty_days?: number | null }, limit = 12) {
  if (shop.id === DEMO_SHOP.id) return DEMO_SOLD;
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("listings")
      .select("id, photo_url, photo_urls, corrected, ai_output, price_usd, sold_price, sold_at")
      .eq("shop_id", shop.id)
      .eq("status", "sold")
      .order("sold_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    return (data || []).map((row: any) => mapPart(row, shop.default_warranty_days));
  } catch {
    return [];
  }
}

/** Single-listing loader shared by the apex part page and the site part page.
 *  Returns the listing in any status plus its shop's public row — callers
 *  decide how to treat sold/removed. */
export const getListingDetail = cache(async (id: string): Promise<any | null> => {
  // Demo-site part pages (demo.ahlam.io/p/demo-p1 etc.).
  const demo = [...DEMO_PARTS, ...DEMO_SOLD].find((p) => p.id === id);
  if (demo) {
    return {
      ...demo,
      shopId: DEMO_SHOP.id,
      status: demo.soldAt ? "sold" : "active",
      description: demo.desc,
      conditionNotes: demo.note,
      shopName: DEMO_SHOP.name,
      location: DEMO_SHOP.zip_code,
      phone: DEMO_SHOP.business_phone,
      verified: DEMO_SHOP.verified,
      warrantyDays: demo.asIs ? 0 : 30,
      returnsPolicy: DEMO_SHOP.returns_policy,
      shop: DEMO_SHOP,
    };
  }
  try {
    const db = supabaseAdmin();
    const { data: l } = await db.from("listings").select("*").eq("id", id).single();
    if (!l) return null;
    const shop = l.shop_id ? await getShopById(l.shop_id) : null;
    const c = l.corrected || l.ai_output || {};
    const warranty = effectiveWarranty({ warrantyDays: c.warrantyDays, asIs: c.asIs }, shop?.default_warranty_days);
    return {
      id: l.id as string,
      shopId: (l.shop_id || null) as string | null,
      status: (l.status || "active") as string,
      part: (c.partName || c.part_name || "Used Part") as string,
      grade: normalizeGrade(c.condition),
      price: (l.price_usd ?? c.suggestedPriceUsd ?? 0) as number,
      fitment: fmtFit(c.fitment),
      alsoFits: evAlsoFits(c.fitment, (c.partName || c.part_name || "") as string),
      category: (c.partCategory || c.part_category || "") as string,
      description: (c.description || "") as string,
      conditionNotes: (c.conditionNotes || "") as string,
      photoUrl: (l.photo_url || null) as string | null,
      shopName: (shop?.name || "Independent seller") as string,
      location: (shop?.zip_code || shop?.location || "") as string,
      phone: (shop?.business_phone || null) as string | null,
      verified: !!shop?.verified,
      warrantyDays: warranty.days,
      asIs: warranty.asIs,
      warrantyText: warrantyLabel(warranty.days, warranty.asIs),
      returnsPolicy: (shop?.returns_policy || "") as string,
      shop,
    };
  } catch {
    return null;
  }
});

/** Keyword-rich SEO title: "2016–2021 Honda Civic Front Left Door — used auto
 *  part near 77066". */
export function partSeoTitle(l: { fitment?: string; part: string; location?: string }): string {
  const head = [l.fitment, l.part].filter(Boolean).join(" ");
  const near = l.location ? ` near ${l.location}` : "";
  return `${head} — used auto part${near}`.trim();
}
