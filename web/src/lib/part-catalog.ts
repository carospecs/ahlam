// CANONICAL PART CATALOG — the single source of truth for part naming.
//
// Three vocabularies used to live apart and drift: the vision prompt's PART
// CATALOG block, the judge's assembly map (part-assemblies), and scattered
// class regexes (ASSEMBLY_CLASS / CENTER_PART / LATERAL_PART). The concrete
// cost: vision said "Front Bumper Cover" (a shell) while the judge valued a
// complete front-bumper assembly — shell and assembly prices got mixed, and
// since the raw name string is both the comp-cache key and the judged-price
// rejoin key, every naming drift was also a cache miss.
//
// This module owns the vocabulary. Each entry carries a stable slug (THE
// identifier for cache keys and part_id), what a price for it MEANS
// (saleUnit: complete assembly vs bare shell vs component), sidedness,
// aliases for normalizing free text (including all legacy names), and its
// own eBay query phrasings. The vision prompt's catalog section is GENERATED
// from here (visionCatalogSection) so prompt and catalog cannot drift.
//
// Shell vs assembly: where the market prices them differently (bumpers,
// doors, tailgate/liftgate, headlights, mirrors, engines), the shell is its
// own entry linked via shellSlug/assemblySlug. Vision reports the observable
// part plus a `completeness` signal; resolveSaleUnit() picks the entry —
// complete/unknown resolves to the assembly (the yard's governing rule:
// parts pull complete), "shell" only when visibly detached/stripped.
//
// Legacy names resolve to the ASSEMBLY entry on purpose: historical scans
// said "Front Bumper Cover" while meaning the on-car complete bumper.
// Genuine shells are only reachable via the completeness signal.
//
// (Only imports part-assemblies, which is dependency-free — keeps this
// loadable by the plain-node tests, same rule as ebay-comps.ts.)
import { PART_ASSEMBLIES } from "./part-assemblies";

export type PartCategory = "Body" | "Glass" | "Lighting" | "Wheels" | "Mechanical" | "Interior";
// "either": parts that are neither forced-center nor forced-sided (a strut, a
// seat) — a side is applied when observed but never demanded. Mirrors the
// pre-catalog behavior of names matching neither CENTER_PART nor LATERAL_PART.
export type Sidedness = "center" | "lateral" | "either";
export type SaleUnit = "complete-assembly" | "shell" | "component";
export type Completeness = "complete" | "shell" | "unknown";

export interface CatalogEntry {
  slug: string;                 // stable id, kebab-case — cache keys + part_id build from this
  displayName: string;          // seller-facing listing name (side word added separately)
  category: PartCategory;
  sidedness: Sidedness;
  saleUnit: SaleUnit;           // what a price for this entry MEANS
  assemblyKey: keyof typeof PART_ASSEMBLIES | null; // judge completeness data (INCLUDED block)
  shellSlug?: string;           // on assembly entries: the stripped counterpart
  assemblySlug?: string;        // on shell entries: the complete counterpart
  visionName?: string;          // what vision is told to emit, when it differs from displayName
  visionHidden?: true;          // not offered to vision (shells — reachable only via completeness)
  aliases: string[];            // normalized free-text names that resolve here, incl. ALL legacy names
  ebayQueryTerms: string[];     // priority-ordered comp query phrasings: [primary, …, generic]
}

export const PART_CATALOG: CatalogEntry[] = [
  // ── Body ────────────────────────────────────────────────────────────────────
  {
    slug: "hood", displayName: "Hood", category: "Body", sidedness: "center",
    saleUnit: "complete-assembly", assemblyKey: "hood",
    aliases: ["hood", "bonnet", "hood panel"],
    ebayQueryTerms: ["Hood"],
  },
  {
    slug: "front-bumper-assembly", displayName: "Front Bumper Assembly", category: "Body",
    sidedness: "center", saleUnit: "complete-assembly", assemblyKey: "front_bumper",
    shellSlug: "front-bumper-cover", visionName: "Front Bumper",
    // "front bumper cover" is here DELIBERATELY: legacy vision output used the
    // shell's name for on-car complete bumpers; free text resolves to the
    // assembly. Real shells are reachable only via completeness:"shell".
    aliases: ["front bumper", "front bumper assembly", "front bumper cover", "front bumper complete", "bumper front"],
    ebayQueryTerms: ["Front Bumper Assembly", "Front Bumper"],
  },
  {
    slug: "front-bumper-cover", displayName: "Front Bumper Cover", category: "Body",
    sidedness: "center", saleUnit: "shell", assemblyKey: "front_bumper",
    assemblySlug: "front-bumper-assembly", visionHidden: true,
    aliases: ["front bumper cover shell", "bare front bumper cover", "front bumper skin", "front bumper cover only"],
    ebayQueryTerms: ["Front Bumper Cover"],
  },
  {
    slug: "rear-bumper-assembly", displayName: "Rear Bumper Assembly", category: "Body",
    sidedness: "center", saleUnit: "complete-assembly", assemblyKey: "rear_bumper",
    shellSlug: "rear-bumper-cover", visionName: "Rear Bumper",
    aliases: ["rear bumper", "rear bumper assembly", "rear bumper cover", "rear bumper complete", "bumper rear"],
    ebayQueryTerms: ["Rear Bumper Assembly", "Rear Bumper"],
  },
  {
    slug: "rear-bumper-cover", displayName: "Rear Bumper Cover", category: "Body",
    sidedness: "center", saleUnit: "shell", assemblyKey: "rear_bumper",
    assemblySlug: "rear-bumper-assembly", visionHidden: true,
    aliases: ["rear bumper cover shell", "bare rear bumper cover", "rear bumper skin", "rear bumper cover only"],
    ebayQueryTerms: ["Rear Bumper Cover"],
  },
  {
    slug: "grille", displayName: "Grille", category: "Body", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["grille", "grill", "front grille", "front grill", "upper grille"],
    ebayQueryTerms: ["Grille"],
  },
  {
    slug: "front-fender", displayName: "Front Fender", category: "Body", sidedness: "lateral",
    saleUnit: "complete-assembly", assemblyKey: "fender",
    aliases: ["front fender", "fender", "front fender panel", "front wing"],
    ebayQueryTerms: ["Front Fender"],
  },
  {
    slug: "rear-quarter-panel", displayName: "Rear Quarter Panel", category: "Body",
    sidedness: "lateral", saleUnit: "component", assemblyKey: null,
    aliases: ["rear quarter panel", "quarter panel", "rear quarter"],
    ebayQueryTerms: ["Quarter Panel"],
  },
  {
    slug: "front-door-assembly", displayName: "Front Door", category: "Body", sidedness: "lateral",
    saleUnit: "complete-assembly", assemblyKey: "front_door",
    shellSlug: "front-door-shell",
    aliases: ["front door", "front door assembly", "door"],
    ebayQueryTerms: ["Front Door assembly", "Front Door"],
  },
  {
    slug: "front-door-shell", displayName: "Front Door Shell", category: "Body", sidedness: "lateral",
    saleUnit: "shell", assemblyKey: "front_door", assemblySlug: "front-door-assembly", visionHidden: true,
    aliases: ["front door shell", "front door skin", "bare front door", "gutted front door"],
    ebayQueryTerms: ["Front Door Shell"],
  },
  {
    slug: "rear-door-assembly", displayName: "Rear Door", category: "Body", sidedness: "lateral",
    saleUnit: "complete-assembly", assemblyKey: "rear_door",
    shellSlug: "rear-door-shell",
    aliases: ["rear door", "rear door assembly", "back door"],
    ebayQueryTerms: ["Rear Door assembly", "Rear Door"],
  },
  {
    slug: "rear-door-shell", displayName: "Rear Door Shell", category: "Body", sidedness: "lateral",
    saleUnit: "shell", assemblyKey: "rear_door", assemblySlug: "rear-door-assembly", visionHidden: true,
    aliases: ["rear door shell", "rear door skin", "bare rear door", "gutted rear door"],
    ebayQueryTerms: ["Rear Door Shell"],
  },
  {
    slug: "trunk-lid", displayName: "Trunk Lid", category: "Body", sidedness: "center",
    saleUnit: "complete-assembly", assemblyKey: "liftgate",
    aliases: ["trunk lid", "deck lid", "decklid", "trunk"],
    ebayQueryTerms: ["Trunk Lid"],
  },
  {
    slug: "tailgate-assembly", displayName: "Tailgate", category: "Body", sidedness: "center",
    saleUnit: "complete-assembly", assemblyKey: "tailgate",
    shellSlug: "tailgate-shell",
    aliases: ["tailgate", "tail gate", "tailgate assembly"],
    ebayQueryTerms: ["Tailgate assembly", "Tailgate"],
  },
  {
    slug: "tailgate-shell", displayName: "Tailgate Shell", category: "Body", sidedness: "center",
    saleUnit: "shell", assemblyKey: "tailgate", assemblySlug: "tailgate-assembly", visionHidden: true,
    aliases: ["tailgate shell", "tailgate skin", "bare tailgate", "tailgate gate only"],
    ebayQueryTerms: ["Tailgate Shell"],
  },
  {
    slug: "liftgate-assembly", displayName: "Liftgate", category: "Body", sidedness: "center",
    saleUnit: "complete-assembly", assemblyKey: "liftgate",
    shellSlug: "liftgate-shell",
    aliases: ["liftgate", "lift gate", "liftgate assembly", "hatch", "rear hatch"],
    ebayQueryTerms: ["Liftgate assembly", "Liftgate"],
  },
  {
    slug: "liftgate-shell", displayName: "Liftgate Shell", category: "Body", sidedness: "center",
    saleUnit: "shell", assemblyKey: "liftgate", assemblySlug: "liftgate-assembly", visionHidden: true,
    aliases: ["liftgate shell", "liftgate skin", "bare liftgate", "liftgate no glass"],
    ebayQueryTerms: ["Liftgate Shell"],
  },
  {
    slug: "side-mirror-assembly", displayName: "Side Mirror", category: "Body", sidedness: "lateral",
    saleUnit: "complete-assembly", assemblyKey: "mirror",
    shellSlug: "side-mirror-housing",
    aliases: ["side mirror", "mirror", "door mirror", "wing mirror", "side view mirror", "side mirror assembly"],
    ebayQueryTerms: ["Side Mirror assembly", "Side Mirror"],
  },
  {
    slug: "side-mirror-housing", displayName: "Side Mirror Housing", category: "Body", sidedness: "lateral",
    saleUnit: "shell", assemblyKey: "mirror", assemblySlug: "side-mirror-assembly", visionHidden: true,
    aliases: ["side mirror housing", "mirror housing", "mirror housing only"],
    ebayQueryTerms: ["Mirror Housing"],
  },
  {
    slug: "roof-panel", displayName: "Roof Panel", category: "Body", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["roof panel", "roof", "roof skin"],
    ebayQueryTerms: ["Roof Panel"],
  },

  // ── Glass ───────────────────────────────────────────────────────────────────
  {
    slug: "windshield", displayName: "Windshield", category: "Glass", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["windshield", "windscreen", "front glass", "front windshield"],
    ebayQueryTerms: ["Windshield"],
  },
  {
    slug: "back-glass", displayName: "Back Glass", category: "Glass", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["back glass", "rear glass", "rear window", "back window", "rear windshield"],
    ebayQueryTerms: ["Back Glass"],
  },
  {
    slug: "front-door-window", displayName: "Front Door Window", category: "Glass", sidedness: "lateral",
    saleUnit: "component", assemblyKey: null,
    aliases: ["front door window", "front door glass", "front window"],
    ebayQueryTerms: ["Front Door Glass"],
  },
  {
    slug: "rear-door-window", displayName: "Rear Door Window", category: "Glass", sidedness: "lateral",
    saleUnit: "component", assemblyKey: null,
    aliases: ["rear door window", "rear door glass"],
    ebayQueryTerms: ["Rear Door Glass"],
  },
  {
    slug: "quarter-glass", displayName: "Quarter Glass", category: "Glass", sidedness: "lateral",
    saleUnit: "component", assemblyKey: null,
    aliases: ["quarter glass", "quarter window", "vent glass"],
    ebayQueryTerms: ["Quarter Glass"],
  },

  // ── Lighting ────────────────────────────────────────────────────────────────
  {
    slug: "headlight-assembly", displayName: "Headlight Assembly", category: "Lighting",
    sidedness: "lateral", saleUnit: "complete-assembly", assemblyKey: "headlight",
    shellSlug: "headlight-housing",
    aliases: ["headlight assembly", "headlight", "headlamp", "head light", "head lamp", "headlamp assembly"],
    ebayQueryTerms: ["Headlight Assembly"],
  },
  {
    slug: "headlight-housing", displayName: "Headlight Housing", category: "Lighting",
    sidedness: "lateral", saleUnit: "shell", assemblyKey: "headlight",
    assemblySlug: "headlight-assembly", visionHidden: true,
    aliases: ["headlight housing", "headlight housing only", "headlamp housing"],
    ebayQueryTerms: ["Headlight Housing"],
  },
  {
    slug: "taillight-assembly", displayName: "Tail Light Assembly", category: "Lighting",
    sidedness: "lateral", saleUnit: "complete-assembly", assemblyKey: "taillight",
    aliases: ["tail light assembly", "taillight assembly", "tail light", "taillight", "tail lamp", "taillamp", "tail lamp assembly"],
    ebayQueryTerms: ["Tail Light Assembly"],
  },
  {
    slug: "fog-light", displayName: "Fog Light", category: "Lighting", sidedness: "lateral",
    saleUnit: "component", assemblyKey: null,
    aliases: ["fog light", "fog lamp", "foglight", "foglamp"],
    ebayQueryTerms: ["Fog Light"],
  },

  // ── Wheels ──────────────────────────────────────────────────────────────────
  {
    slug: "wheel-rim", displayName: "Wheel / Rim", category: "Wheels", sidedness: "lateral",
    saleUnit: "component", assemblyKey: "wheel",
    aliases: ["wheel rim", "wheel", "rim", "alloy wheel", "steel wheel"],
    ebayQueryTerms: ["Wheel Rim"],
  },
  {
    slug: "tire", displayName: "Tire", category: "Wheels", sidedness: "lateral",
    saleUnit: "component", assemblyKey: null,
    aliases: ["tire", "tyre"],
    ebayQueryTerms: ["Tire"],
  },

  // ── Mechanical ──────────────────────────────────────────────────────────────
  {
    slug: "engine-assembly", displayName: "Engine", category: "Mechanical", sidedness: "center",
    saleUnit: "complete-assembly", assemblyKey: "engine",
    shellSlug: "engine-long-block",
    aliases: ["engine", "engine assembly", "motor", "complete engine", "engine complete", "engine dropout", "engine drop out"],
    ebayQueryTerms: ["Engine assembly", "Engine"],
  },
  {
    slug: "engine-long-block", displayName: "Engine Long Block", category: "Mechanical",
    sidedness: "center", saleUnit: "shell", assemblyKey: "engine",
    assemblySlug: "engine-assembly", visionHidden: true,
    aliases: ["engine long block", "long block"],
    ebayQueryTerms: ["Engine Long Block"],
  },
  {
    slug: "transmission-assembly", displayName: "Transmission", category: "Mechanical",
    sidedness: "center", saleUnit: "complete-assembly", assemblyKey: "transmission",
    aliases: ["transmission", "transmission assembly", "transaxle", "gearbox", "automatic transmission", "manual transmission"],
    ebayQueryTerms: ["Transmission assembly", "Transmission"],
  },
  {
    slug: "radiator", displayName: "Radiator", category: "Mechanical", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["radiator", "engine radiator"],
    ebayQueryTerms: ["Radiator"],
  },
  {
    slug: "alternator", displayName: "Alternator", category: "Mechanical", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["alternator", "generator"],
    ebayQueryTerms: ["Alternator"],
  },
  {
    slug: "starter", displayName: "Starter", category: "Mechanical", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["starter", "starter motor"],
    ebayQueryTerms: ["Starter"],
  },
  {
    slug: "battery", displayName: "Battery", category: "Mechanical", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["battery", "12v battery"],
    ebayQueryTerms: ["Battery"],
  },
  {
    slug: "ac-compressor", displayName: "AC Compressor", category: "Mechanical", sidedness: "center",
    saleUnit: "complete-assembly", assemblyKey: "ac_compressor",
    aliases: ["ac compressor", "a c compressor", "air conditioning compressor", "air con compressor"],
    ebayQueryTerms: ["AC Compressor"],
  },
  {
    slug: "abs-module", displayName: "ABS Module", category: "Mechanical", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["abs module", "abs unit", "abs pump", "abs pump module"],
    ebayQueryTerms: ["ABS Module"],
  },
  {
    slug: "power-steering-pump", displayName: "Power Steering Pump", category: "Mechanical",
    sidedness: "center", saleUnit: "component", assemblyKey: null,
    aliases: ["power steering pump", "steering pump", "ps pump"],
    ebayQueryTerms: ["Power Steering Pump"],
  },
  {
    slug: "strut-shock", displayName: "Strut / Shock", category: "Mechanical", sidedness: "either",
    saleUnit: "component", assemblyKey: null,
    aliases: ["strut shock", "strut", "shock", "shock absorber", "strut assembly"],
    ebayQueryTerms: ["Strut assembly", "Strut"],
  },
  {
    slug: "control-arm", displayName: "Control Arm", category: "Mechanical", sidedness: "either",
    saleUnit: "component", assemblyKey: null,
    aliases: ["control arm"],
    ebayQueryTerms: ["Control Arm"],
  },
  {
    slug: "driveshaft", displayName: "Driveshaft", category: "Mechanical", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["driveshaft", "drive shaft", "propeller shaft", "prop shaft"],
    ebayQueryTerms: ["Drive Shaft"],
  },
  {
    slug: "catalytic-converter", displayName: "Catalytic Converter", category: "Mechanical",
    sidedness: "center", saleUnit: "component", assemblyKey: null, // deliberately no assembly entry (see part-assemblies REVIEW #3)
    aliases: ["catalytic converter", "cat converter", "catalytic convertor"],
    ebayQueryTerms: ["Catalytic Converter"],
  },
  {
    slug: "fuel-pump", displayName: "Fuel Pump", category: "Mechanical", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["fuel pump", "fuel pump assembly"],
    ebayQueryTerms: ["Fuel Pump"],
  },

  // ── Interior ────────────────────────────────────────────────────────────────
  {
    slug: "front-seat", displayName: "Front Seat", category: "Interior", sidedness: "either",
    saleUnit: "complete-assembly", assemblyKey: "seat",
    aliases: ["front seat", "seat", "bucket seat"],
    ebayQueryTerms: ["Front Seat assembly", "Front Seat"],
  },
  {
    slug: "rear-seat", displayName: "Rear Seat", category: "Interior", sidedness: "either",
    saleUnit: "complete-assembly", assemblyKey: "seat",
    aliases: ["rear seat", "back seat", "rear bench seat", "bench seat"],
    ebayQueryTerms: ["Rear Seat assembly", "Rear Seat"],
  },
  {
    slug: "seat-belt", displayName: "Seat Belt", category: "Interior", sidedness: "either",
    saleUnit: "component", assemblyKey: null,
    aliases: ["seat belt", "seatbelt"],
    ebayQueryTerms: ["Seat Belt"],
  },
  {
    slug: "steering-wheel", displayName: "Steering Wheel", category: "Interior", sidedness: "center",
    saleUnit: "component", assemblyKey: null, // resolveAssembly's steering-wheel guard stays honored
    aliases: ["steering wheel"],
    ebayQueryTerms: ["Steering Wheel"],
  },
  {
    slug: "airbag", displayName: "Airbag", category: "Interior", sidedness: "either",
    saleUnit: "component", assemblyKey: null,
    aliases: ["airbag", "air bag", "srs airbag"],
    ebayQueryTerms: ["Airbag"],
  },
  {
    slug: "center-console", displayName: "Center Console", category: "Interior", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["center console", "centre console", "console"],
    ebayQueryTerms: ["Center Console"],
  },
  {
    slug: "dashboard", displayName: "Dashboard", category: "Interior", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["dashboard", "dash", "dash board", "dash panel", "instrument panel"],
    ebayQueryTerms: ["Dashboard"],
  },
  {
    slug: "instrument-cluster", displayName: "Instrument Cluster", category: "Interior",
    sidedness: "center", saleUnit: "complete-assembly", assemblyKey: "instrument_cluster",
    aliases: ["instrument cluster", "gauge cluster", "speedometer", "speedometer cluster", "cluster"],
    ebayQueryTerms: ["Instrument Cluster"],
  },
  {
    slug: "glove-box", displayName: "Glove Box", category: "Interior", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["glove box", "glovebox", "glove compartment"],
    ebayQueryTerms: ["Glove Box"],
  },
  {
    slug: "door-panel", displayName: "Door Panel", category: "Interior", sidedness: "lateral",
    saleUnit: "component", assemblyKey: null, // interior trim card — never a door assembly
    aliases: ["door panel", "door trim panel", "door card"],
    ebayQueryTerms: ["Door Panel"],
  },
  {
    slug: "front-door-panel", displayName: "Front Door Panel", category: "Interior",
    sidedness: "lateral", saleUnit: "component", assemblyKey: null, visionHidden: true,
    aliases: ["front door panel", "front door trim panel", "front door card"],
    ebayQueryTerms: ["Front Door Panel"],
  },
  {
    slug: "rear-door-panel", displayName: "Rear Door Panel", category: "Interior",
    sidedness: "lateral", saleUnit: "component", assemblyKey: null, visionHidden: true,
    aliases: ["rear door panel", "rear door trim panel", "rear door card"],
    ebayQueryTerms: ["Rear Door Panel"],
  },
  {
    slug: "sun-visor", displayName: "Sun Visor", category: "Interior", sidedness: "either",
    saleUnit: "component", assemblyKey: null,
    aliases: ["sun visor", "sunvisor", "visor"],
    ebayQueryTerms: ["Sun Visor"],
  },
  {
    slug: "rear-view-mirror", displayName: "Rear View Mirror", category: "Interior",
    sidedness: "center", saleUnit: "component", assemblyKey: null,
    aliases: ["rear view mirror", "rearview mirror", "interior mirror"],
    ebayQueryTerms: ["Rear View Mirror"],
  },
  {
    slug: "shifter", displayName: "Shifter", category: "Interior", sidedness: "center",
    saleUnit: "component", assemblyKey: null,
    aliases: ["shifter", "gear shifter", "gear selector", "shift assembly"],
    ebayQueryTerms: ["Shifter"],
  },
];

export const CATALOG_BY_SLUG: Record<string, CatalogEntry> = Object.fromEntries(
  PART_CATALOG.map((e) => [e.slug, e]),
);

// ── Normalization ─────────────────────────────────────────────────────────────

export type PartSide = "driver" | "passenger";
export type CanonicalPart = { entry: CatalogEntry; side: PartSide | null; partId: string };

// Free text → { base, side }. Strips the side word (capturing it), the
// "— 2.5L I4" spec suffix that applyVinEngine appends, parens, and slashes.
// The "(?!…mirror)" guard mirrors part-enrich's stripSide: "Driver Side
// Mirror" keeps its "Side" so it lands on the "side mirror" alias.
function normalizeName(freeText: string): { base: string; side: PartSide | null } {
  let side: PartSide | null = null;
  const s = (freeText || "")
    .toLowerCase()
    .replace(/\s*[—–]\s.*$/, "") // "engine — 2.5l i4" → "engine"
    .replace(/[()/,]/g, " ")
    .replace(/\b(driver|passenger)(?:'s)?(?:[ -]side(?!\s+mirror\b))?\b/g, (_m, who: string) => {
      side = who === "driver" ? "driver" : "passenger";
      return " ";
    })
    .replace(/\b(left|lh)\b/g, () => { side = side ?? "driver"; return " "; })
    .replace(/\b(right|rh)\b/g, () => { side = side ?? "passenger"; return " "; })
    .replace(/\s+/g, " ")
    .trim();
  return { base: s, side };
}

// alias → entry, exact-match only. Exactness is the point: a "Front Door
// Window Regulator" must NOT fuzzy-match "Front Door Window" — off-catalog
// free text returns null and callers keep their existing regex behavior.
//
// Aliases index first and are collision-checked (a true ambiguity is a bug);
// displayName/visionName fill in only when unclaimed. That ordering is what
// lets a shell's displayName ("Front Bumper Cover") resolve to the ASSEMBLY —
// design decision: legacy free text meant the on-car complete bumper, and a
// genuine shell is addressed by its slug/completeness, not by name.
const ALIAS_INDEX: Map<string, CatalogEntry> = (() => {
  const index = new Map<string, CatalogEntry>();
  for (const entry of PART_CATALOG) {
    for (const raw of entry.aliases) {
      const { base } = normalizeName(raw);
      if (!base) continue;
      const existing = index.get(base);
      if (existing && existing !== entry) {
        throw new Error(`part-catalog: alias "${base}" maps to both "${existing.slug}" and "${entry.slug}"`);
      }
      index.set(base, entry);
    }
  }
  for (const entry of PART_CATALOG) {
    for (const raw of [entry.displayName, entry.visionName]) {
      if (!raw) continue;
      const { base } = normalizeName(raw);
      if (base && !index.has(base)) index.set(base, entry);
    }
  }
  return index;
})();

export function canonicalizePart(freeText: string): CanonicalPart | null {
  const { base, side } = normalizeName(freeText);
  if (!base) return null;
  const entry = ALIAS_INDEX.get(base);
  if (!entry) return null;
  const usableSide = entry.sidedness === "center" ? null : side;
  return { entry, side: usableSide, partId: usableSide ? `${entry.slug}:${usableSide}` : entry.slug };
}

// Stable pricing/cache id for a free-text name, or null when off-catalog.
export function canonicalPartId(freeText: string): string | null {
  return canonicalizePart(freeText)?.partId ?? null;
}

// Deterministic sale-unit resolver: vision reports the observable part and a
// completeness signal; this picks the entry a price will be attached to.
// complete/unknown/absent → the assembly (yard governing rule: parts pull
// complete); "shell" → the stripped counterpart when one exists.
export function resolveSaleUnit(nameOrSlug: string, completeness?: Completeness): CatalogEntry | null {
  const entry = CATALOG_BY_SLUG[nameOrSlug] ?? canonicalizePart(nameOrSlug)?.entry ?? null;
  if (!entry) return null;
  if (completeness === "shell") {
    if (entry.saleUnit === "shell") return entry;
    return entry.shellSlug ? CATALOG_BY_SLUG[entry.shellSlug] ?? entry : entry;
  }
  if (entry.saleUnit === "shell" && completeness === "complete" && entry.assemblySlug) {
    return CATALOG_BY_SLUG[entry.assemblySlug] ?? entry;
  }
  return entry;
}

// ── Generated vision-prompt fragments ────────────────────────────────────────
// The vision prompt's PART CATALOG section and side-rule name lists are built
// from the catalog so the prompt cannot drift from the vocabulary. Shells are
// excluded (visionHidden) — vision reports the observable part; the
// completeness signal is what reaches a shell entry.

const CATEGORY_ORDER: PartCategory[] = ["Body", "Glass", "Lighting", "Wheels", "Mechanical", "Interior"];

function visionNames(filter?: (e: CatalogEntry) => boolean): CatalogEntry[] {
  return PART_CATALOG.filter((e) => !e.visionHidden && (!filter || filter(e)));
}

export function visionNameOf(e: CatalogEntry): string {
  return e.visionName ?? e.displayName;
}

export function visionCatalogSection(): string {
  const lines: string[] = [
    'PART CATALOG — only catalog parts from this list, using these exact names (add "Left"/"Right" only when the rules below apply). If a part is not visible, OMIT it:',
  ];
  for (const cat of CATEGORY_ORDER) {
    const entries = visionNames((e) => e.category === cat);
    if (!entries.length) continue;
    if (cat === "Wheels") {
      lines.push(
        '- Wheels: "Wheel / Rim" and "Tire" — these are ALWAYS two separate listings, never combined. A rim and the tire on it sell separately for more, so list each on its own line with its own price.',
      );
      continue;
    }
    lines.push(`- ${cat}: ${entries.map((e) => `"${visionNameOf(e)}"`).join(", ")}`);
  }
  lines.push("- If you see a common, obviously-sellable part not on this list, you may include it, but prefer the catalog names.");
  return lines.join("\n");
}

export function visionCenterList(): string {
  return visionNames((e) => e.sidedness === "center").map(visionNameOf).join(", ");
}

export function visionLateralList(): string {
  return visionNames((e) => e.sidedness === "lateral").map(visionNameOf).join(", ");
}
