// Pinned public profiles for shops served off the static subdomain map
// (lib/shop-subdomains.ts). Two jobs:
//
// 1. NAP consistency for local SEO: name / address / phone here are verified
//    against Google, Yelp, and chamber directories and deliberately WIN over
//    whatever the shop typed into its DB row when the two are merged.
// 2. Pre-migration availability: prod doesn't have shops.slug yet (42703), and
//    the DAD row carries plan "starter" with an expired trial — which would
//    fail hasPersonalSite() and serve a Disallow-all robots.txt. The gating
//    fields pinned here (plan / trial_ends_at / subscription_status) keep the
//    personal site live until the row is fixed up.
//
// Each entry contains ONLY the fields we deliberately pin, so spreading it
// over a real DB row never clobbers db-owned fields (logo_url, email, rating,
// returns policy, …) with nulls. staticShopRow() widens an entry to the full
// SHOP_PUBLIC_COLUMNS shape (mirroring DEMO_SHOP in lib/shop-site.ts) for the
// last-resort path where the DB is unreachable and the pin must render alone.

/** Fields we pin per shop. `same_as` feeds JSON-LD sameAs links. */
export type ShopStaticProfile = {
  id: string;
  slug: string;
  name: string;
  location: string;
  address_line: string;
  zip_code: string;
  lat: number;
  lng: number;
  business_phone: string;
  description: string;
  hours: string;
  verified: boolean;
  plan: string;
  trial_ends_at: null;
  subscription_status: string;
  same_as: string[];
};

export const SHOP_STATIC_PROFILES: Record<string, ShopStaticProfile> = {
  downtownautodismantlers: {
    id: "159c4cdc-3cbc-4061-9942-5c901486df49",
    slug: "downtownautodismantlers",
    name: "Downtown Auto Dismantlers Inc.",
    location: "Los Angeles, CA",
    address_line: "6828 McKinley Ave",
    zip_code: "90001",
    lat: 33.9776,
    lng: -118.2566,
    business_phone: "(323) 758-5167",
    description:
      "Family-owned salvage yard and used OEM auto parts supplier in South Los Angeles, serving the greater LA area with engines, transmissions, body parts, and more. We also buy junk cars.",
    hours: "Mon–Fri 8:00 AM – 5:00 PM\nSat 8:00 AM – 3:00 PM\nSun closed",
    verified: true,
    plan: "ultimate",
    trial_ends_at: null,
    subscription_status: "active",
    same_as: [
      "http://trade9527.car-part.com/",
      "https://www.facebook.com/DOWNTOWNAUTOinc/",
      "https://www.yelp.com/biz/downtown-auto-dismantlers-los-angeles-2",
    ],
  },
};

/** A pinned profile widened to the full public shop-row shape (the columns in
 *  SHOP_PUBLIC_COLUMNS / the DEMO_SHOP shape), for rendering with no DB row at
 *  all. Unknown fields default to null so the site pages degrade gracefully. */
export function staticShopRow(slug: string): any | null {
  const p = SHOP_STATIC_PROFILES[slug];
  if (!p) return null;
  return {
    email: null,
    website: null,
    logo_url: null,
    cover_url: null,
    default_warranty_days: null,
    returns_policy: null,
    rating_avg: null,
    rating_count: null,
    ...p,
  };
}
