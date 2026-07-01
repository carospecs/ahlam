import type { LucideIcon } from "lucide-react";
import { Warehouse, Car, Wrench } from "lucide-react";

// Single source of truth for the marketing site's audience pages. Imported by
// SiteHeader (nav dropdown), SiteFooter, the /audiences index, and each
// /for/[audience] page, so the set never drifts between them.

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
