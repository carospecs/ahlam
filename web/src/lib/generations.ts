// VEHICLE GENERATIONS — static year-ranges for high-volume US salvage vehicles,
// used ONLY to widen eBay retrieval ("2019-2023 Silverado 1500 door" surfaces
// range-titled listings the single-year query misses). Retrieval, not fitment:
// whether a cross-year listing actually fits is still the judge's call from the
// title — never a code rule.
// (No lib imports on purpose — keeps this loadable by the plain-node tests.)

export type GenRange = { from: number; to: number; source: "map" | "fallback" };

// "F-150" → "f150"; "CR-V" → "crv". Absorbs NHTSA-decode punctuation/case drift.
export function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type Spans = readonly (readonly [number, number])[];

// Platform twins share arrays. Boundary-overlap models (Ram 1500 Classic sold
// alongside the 2019+ body; JK/JL Wrangler) pick one edge — extra wrong-gen
// listings the range query surfaces are the judge's problem by design.
const F_SUPER_DUTY: Spans = [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2022], [2023, 2026]];
const GM_1500: Spans = [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]];
const GM_HD: Spans = [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]];
const GM_BIG_SUV: Spans = [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]];
const RAM_1500: Spans = [[1994, 2001], [2002, 2008], [2009, 2018], [2019, 2026]];
const RAM_HD: Spans = [[1994, 2002], [2003, 2009], [2010, 2018], [2019, 2026]];

// US-market model-year generations, keys `${normKey(make)}|${normKey(model)}`.
const GEN: Record<string, Spans> = {
  // Pickups
  "ford|f150": [[1997, 2003], [2004, 2008], [2009, 2014], [2015, 2020], [2021, 2026]],
  "ford|f150lightning": [[2022, 2026]],
  "ford|f250": F_SUPER_DUTY,
  "ford|f350": F_SUPER_DUTY,
  "chevrolet|silverado1500": GM_1500,
  "chevrolet|silverado": GM_1500,
  "gmc|sierra1500": GM_1500,
  "gmc|sierra": GM_1500,
  "chevrolet|silverado2500": GM_HD,
  "chevrolet|silverado3500": GM_HD,
  "gmc|sierra2500": GM_HD,
  "gmc|sierra3500": GM_HD,
  "ram|1500": RAM_1500,
  "dodge|ram1500": RAM_1500,
  "ram|2500": RAM_HD,
  "ram|3500": RAM_HD,
  "dodge|ram2500": RAM_HD,
  "dodge|ram3500": RAM_HD,
  "toyota|tacoma": [[1995, 2004], [2005, 2015], [2016, 2023], [2024, 2026]],
  "toyota|tundra": [[2000, 2006], [2007, 2021], [2022, 2026]],
  "nissan|frontier": [[1998, 2004], [2005, 2021], [2022, 2026]],
  // Sedans
  "toyota|camry": [[1997, 2001], [2002, 2006], [2007, 2011], [2012, 2017], [2018, 2024], [2025, 2026]],
  "toyota|corolla": [[1998, 2002], [2003, 2008], [2009, 2013], [2014, 2019], [2020, 2026]],
  "toyota|prius": [[2004, 2009], [2010, 2015], [2016, 2022], [2023, 2026]],
  "honda|accord": [[1998, 2002], [2003, 2007], [2008, 2012], [2013, 2017], [2018, 2022], [2023, 2026]],
  "honda|civic": [[2001, 2005], [2006, 2011], [2012, 2015], [2016, 2021], [2022, 2026]],
  "nissan|altima": [[2002, 2006], [2007, 2012], [2013, 2018], [2019, 2025]],
  "nissan|sentra": [[2007, 2012], [2013, 2019], [2020, 2026]],
  "ford|fusion": [[2006, 2012], [2013, 2020]],
  "ford|mustang": [[1994, 2004], [2005, 2014], [2015, 2023], [2024, 2026]],
  "ford|focus": [[2000, 2007], [2008, 2011], [2012, 2018]],
  "chevrolet|malibu": [[1997, 2003], [2004, 2007], [2008, 2012], [2013, 2015], [2016, 2025]],
  "chevrolet|cruze": [[2011, 2015], [2016, 2019]],
  "hyundai|elantra": [[2011, 2016], [2017, 2020], [2021, 2026]],
  "hyundai|sonata": [[2011, 2014], [2015, 2019], [2020, 2026]],
  "kia|optima": [[2011, 2015], [2016, 2020]],
  // SUVs / CUVs / vans
  "ford|explorer": [[2002, 2005], [2006, 2010], [2011, 2019], [2020, 2026]],
  "ford|escape": [[2001, 2007], [2008, 2012], [2013, 2019], [2020, 2026]],
  "chevrolet|equinox": [[2005, 2009], [2010, 2017], [2018, 2024], [2025, 2026]],
  "chevrolet|tahoe": GM_BIG_SUV,
  "chevrolet|suburban": GM_BIG_SUV,
  "gmc|yukon": GM_BIG_SUV,
  "chevrolet|traverse": [[2009, 2017], [2018, 2023], [2024, 2026]],
  "honda|crv": [[1997, 2001], [2002, 2006], [2007, 2011], [2012, 2016], [2017, 2022], [2023, 2026]],
  "honda|pilot": [[2003, 2008], [2009, 2015], [2016, 2022], [2023, 2026]],
  "honda|odyssey": [[1999, 2004], [2005, 2010], [2011, 2017], [2018, 2026]],
  "toyota|rav4": [[2001, 2005], [2006, 2012], [2013, 2018], [2019, 2025], [2026, 2026]],
  "toyota|highlander": [[2001, 2007], [2008, 2013], [2014, 2019], [2020, 2026]],
  "toyota|4runner": [[1996, 2002], [2003, 2009], [2010, 2024], [2025, 2026]],
  "toyota|sienna": [[2004, 2010], [2011, 2020], [2021, 2026]],
  "nissan|rogue": [[2008, 2013], [2014, 2020], [2021, 2026]],
  "jeep|wrangler": [[1997, 2006], [2007, 2017], [2018, 2026]],
  "jeep|grandcherokee": [[1999, 2004], [2005, 2010], [2011, 2021], [2022, 2026]],
  "jeep|cherokee": [[2014, 2023]],
  "kia|sorento": [[2011, 2015], [2016, 2020], [2021, 2026]],
  "subaru|outback": [[2010, 2014], [2015, 2019], [2020, 2026]],
  "subaru|forester": [[2009, 2013], [2014, 2018], [2019, 2026]],
  // Tesla (NHTSA make "TESLA")
  "tesla|model3": [[2017, 2023], [2024, 2026]],
  "tesla|modely": [[2020, 2025], [2026, 2026]],
  "tesla|models": [[2012, 2020], [2021, 2026]],
  "tesla|modelx": [[2016, 2020], [2021, 2026]],
};

export function resolveGeneration(
  make?: string | null,
  model?: string | null,
  year?: string | number | null,
): GenRange | null {
  const y = Math.trunc(Number(year));
  if (!make || !model || !Number.isFinite(y) || y < 1980 || y > 2100) return null;
  const mk = normKey(make), md = normKey(model);
  if (!mk || !md) return null;
  // Exact key first, else longest model-prefix within the make — absorbs decode
  // suffixes ("Silverado 1500 LD", "F-150 Pickup") without a fuzzy matcher.
  let spans = GEN[`${mk}|${md}`];
  if (!spans) {
    let bestLen = 0;
    for (const key of Object.keys(GEN)) {
      const [kMake, kModel] = key.split("|");
      if (kMake === mk && md.startsWith(kModel) && kModel.length > bestLen) {
        spans = GEN[key];
        bestLen = kModel.length;
      }
    }
  }
  const hit = spans?.find(([a, b]) => y >= a && y <= b);
  if (hit) return { from: hit[0], to: hit[1], source: "map" };
  return { from: y - 3, to: y + 3, source: "fallback" }; // unknown vehicle or out-of-map year
}
