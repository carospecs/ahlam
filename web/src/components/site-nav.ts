import type { LucideIcon } from "lucide-react";
import { Warehouse, Car, Wrench } from "lucide-react";

// Single source of truth for the marketing site's audience pages and competitor
// comparisons. Imported by SiteHeader (nav dropdown), SiteFooter, the /audiences
// index, and each /for/[audience] page, so the set never drifts between them.

export interface Audience {
  slug: string;        // route under /for
  nav: string;         // short label for the nav dropdown
  title: string;       // page H1 audience name
  tagline: string;     // one-line description (nav + index)
  icon: LucideIcon;
}

export const AUDIENCES: Audience[] = [
  { slug: "salvage-yards", nav: "Salvage & dismantling yards", title: "salvage & dismantling yards", tagline: "Turn a whole car into priced, posted listings without a parts expert on staff.", icon: Warehouse },
  { slug: "used-car-dealers", nav: "Used car & wholesale dealers", title: "used car & wholesale dealers", tagline: "Recover real money from trade-ins and aged units by parting what won't retail.", icon: Car },
  { slug: "repair-shops", nav: "Mechanics & repair shops", title: "mechanics & repair shops", tagline: "Sell the good parts off cars you scrap instead of paying to haul them away.", icon: Wrench },
];

export function getAudience(slug: string): Audience | undefined {
  return AUDIENCES.find((a) => a.slug === slug);
}

export interface CompareRow {
  slug: string;
  them: string;          // competitor / alternative name
  kind: string;          // category label
  blurb: string;         // one-liner contrast
}

export const COMPARE: CompareRow[] = [
  { slug: "car-part", them: "Car-Part.com", kind: "Parts marketplace", blurb: "Car-Part.com lists what you already typed up. Ahlam identifies, grades, and prices the part from a photo first, then lists it." },
  { slug: "ebay-motors", them: "eBay Motors (by hand)", kind: "Manual listing", blurb: "Listing by hand means knowing the part, the fitment, and the price. Ahlam writes all three for you and posts to eBay in a tap." },
  { slug: "hollander", them: "Hollander / Checkmate", kind: "Yard management system", blurb: "Legacy yard systems are inventory databases built for big operations. Ahlam is a photo-to-listing tool a two-person yard can run today." },
  { slug: "spreadsheets", them: "Spreadsheets & notebooks", kind: "Doing it by hand", blurb: "A spreadsheet records a part after you've identified and priced it. Ahlam does the identifying and pricing, then keeps the record itself." },
];
