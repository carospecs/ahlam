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
  /** Optional — omit to let the shop's own DB description win. Only pin this
   *  when the DB row doesn't have a good one yet. */
  description?: string;
  hours: string;
  verified: boolean;
  plan: string;
  trial_ends_at: null;
  subscription_status: string;
  same_as: string[];
  /** Optional time-boxed marketing banner, shown site-wide in the header.
   *  Pinned in code (not a DB column) so it's a one-line edit to update or
   *  clear — e.g. a seasonal sale. */
  promo_text?: string;
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
    // description intentionally NOT pinned — the shop's real DB row already
    // carries a detailed, up-to-date description (founding story, warranty,
    // services); pinning here would silently override and regress it.
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
    promo_text: "Labor Day Sale (Aug 31–Sept 7): 10% off all parts",
  },
  aaconautoparts: {
    id: "b696bcc7-10e9-4f01-ad49-56f9fe5eb25b",
    slug: "aaconautoparts",
    name: "Aacon Auto Parts",
    location: "Los Angeles, CA",
    address_line: "7721 S Alameda St",
    zip_code: "90001",
    lat: 33.9699,
    lng: -118.2338,
    business_phone: "(323) 589-5048",
    description:
      "Family-owned auto salvage yard serving Los Angeles since 1992. Specializes in used parts for American cars, but carries parts for most major brands — helping customers, mechanic shops, and other wrecking yards across LA find what they need, efficiently.",
    hours: "Mon–Fri 8:00 AM – 5:00 PM\nSat–Sun closed",
    verified: false,
    plan: "ultimate",
    trial_ends_at: null,
    subscription_status: "active",
    same_as: [
      "https://www.yelp.com/biz/aacon-auto-parts-los-angeles",
      "http://recycler.car-part.com/AaconAutoParts/",
    ],
  },
  speedyautowrecking: {
    id: "82e638d7-7c4c-467a-97b1-baa5c7a71332",
    slug: "speedyautowrecking",
    name: "Speedy Auto Wrecking",
    location: "Los Angeles, CA",
    address_line: "543 Gallardo St",
    zip_code: "90033",
    lat: 34.0541,
    lng: -118.2236,
    business_phone: "(562) 541-5784",
    description:
      "A fast, no-nonsense salvage yard in East Los Angeles — used parts for domestic and foreign vehicles, same-day service, free price quotes, and top-dollar offers if you're looking to sell your car.",
    hours: "Mon–Fri 8:00 AM – 5:00 PM\nSat 8:00 AM – 2:00 PM\nSun closed",
    verified: false,
    plan: "ultimate",
    trial_ends_at: null,
    subscription_status: "active",
    same_as: ["http://trade3726.car-part.com/"],
  },
  elapacheautowrecking: {
    id: "749da208-9fa9-466a-a6d0-eca31cde97aa",
    slug: "elapacheautowrecking",
    name: "El Apache Auto Wrecking",
    location: "Los Angeles, CA",
    address_line: "542 N Mission Rd",
    zip_code: "90033",
    lat: 34.0548,
    lng: -118.2244,
    business_phone: "(323) 225-7181",
    description:
      "Auto salvage yard in Boyle Heights offering engines, transmissions, and body parts, plus drum & rotor resurfacing, catalytic converter shield installs, and radiator repair.",
    hours: "Mon–Sat 8:00 AM – 5:00 PM\nSun 10:00 AM – 2:00 PM",
    verified: false,
    plan: "ultimate",
    trial_ends_at: null,
    subscription_status: "active",
    same_as: [
      "https://elapacheautowrecking.com",
      "https://www.yelp.com/biz/el-apache-auto-wrecking-los-angeles",
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
