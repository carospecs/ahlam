// Rich marketing content for each audience landing page at /for/[slug] and the
// /audiences index. Keyed by the same slugs as AUDIENCES in components/site-nav,
// so the set never drifts. The short nav/title/tagline/icon live in site-nav;
// this file holds the long-form, audience-specific copy (headline, intro,
// problems, how-Ahlam-helps features, an outcome line, and FAQs).
//
// Copy rule: no em dashes in any user-facing string. Use periods, commas,
// colons, or parentheses. Keep each audience genuinely specific: a salvage
// yard's pain is not an individual flipper's.

// Feature icons are referenced by key (not imported here) so this stays a plain
// data module. The page maps iconKey -> a lucide icon.
export type FeatureIconKey = "scan" | "grade" | "price" | "post";

export interface AudienceProblem {
  title: string;
  body: string;
}

export interface AudienceFeature {
  iconKey: FeatureIconKey;
  title: string;
  body: string;
}

export interface AudienceFaq {
  q: string;
  a: string;
}

export interface AudienceContent {
  slug: string;
  image: string;        // hero photo in /public
  headline: string;     // page H1 (the big promise)
  intro: string;        // 1-2 sentence subhead, also used as meta description
  problems: AudienceProblem[];
  features: AudienceFeature[];   // ordered scan -> grade -> price -> post
  outcome: string;      // one short payoff / stat line
  faqs: AudienceFaq[];
}

export const AUDIENCE_CONTENT: Record<string, AudienceContent> = {
  "salvage-yards": {
    slug: "salvage-yards",
    image: "/img/aud-salvage.webp",
    headline: "Turn every car in the lot into priced, posted listings",
    intro:
      "A salvage yard sits on hundreds of sellable parts per car, but the time and the parts expertise to catalog and price them is the bottleneck. Ahlam reads a photo, names every part, grades it, and prices it from real sales, so a two-person yard can list like a ten-person one.",
    problems: [
      {
        title: "Most of the car gets scrapped",
        body: "A typical vehicle has hundreds of sellable parts, but a small crew only has time to pull and list the obvious ones. The alternators, modules, and trim that would have sold go to the crusher with the shell.",
      },
      {
        title: "Pricing takes a parts expert",
        body: "Knowing the fitment, the condition, and what a part actually sells for is years of experience. When the person who knows is out sick, listings stall and good inventory sits.",
      },
      {
        title: "Listing eats the whole day",
        body: "Photographing, typing titles, copying fitment, and pricing each part by hand turns a five-second decision into a five-minute chore. At any real volume, it simply never gets done.",
      },
      {
        title: "You are stuck on one channel",
        body: "Re-posting the same part to eBay, Facebook, OfferUp, and Car-Part.com by hand means most yards pick one and quietly miss every buyer shopping on the rest.",
      },
    ],
    features: [
      {
        iconKey: "scan",
        title: "Scan a whole car at once",
        body: "Photograph the vehicle and Ahlam names every sellable part, from bumpers to control modules. No parts expert on staff required.",
      },
      {
        iconKey: "grade",
        title: "Consistent A, B, C grading",
        body: "Every part is graded on the same rubric, so a Grade B means the same thing on Monday as it does when your newest hire lists it.",
      },
      {
        iconKey: "price",
        title: "Priced from real sales",
        body: "Ahlam suggests the median of what the same part actually sold for across eBay, Facebook, and OfferUp, so lowball or knock-off listings cannot drag your number down.",
      },
      {
        iconKey: "post",
        title: "One scan, every channel",
        body: "Auto-post to eBay today, with clean ready-to-paste listings for Facebook, OfferUp, and Craigslist coming, plus your own Ahlam storefront.",
      },
    ],
    outcome:
      "Yards built for two people can finally list like ten: a whole car catalogued in minutes, not days.",
    faqs: [
      {
        q: "Do I need someone who knows parts?",
        a: "No, and that is the whole point. Ahlam identifies and grades each part from the photo, so a brand new hire can catalog a car on day one.",
      },
      {
        q: "Can it keep up with my volume?",
        a: "Yes. Scan car after car and Ahlam catalogs each one in minutes. Plans scale from a couple of cars on Free up to high-volume yards on Max and Ultimate.",
      },
      {
        q: "Is my VIN and mileage exposed?",
        a: "No. Ahlam reads the VIN and odometer for accuracy but keeps them off public listings until you choose to share them.",
      },
      {
        q: "What does it cost to start?",
        a: "Nothing. The first 50 yards get a full month free with every feature unlocked, no card required. After that, plans run Free, Growth $100, Max $200, and Ultimate $350.",
      },
    ],
  },

  "used-car-dealers": {
    slug: "used-car-dealers",
    image: "/img/aud-dealer.webp",
    headline: "Recover real money from trade-ins that won't retail",
    intro:
      "Every lot has units that will not retail: rough trade-ins, aged inventory, and wrecks headed to the auction block for pennies. Ahlam shows you what the car is worth in parts and lists them for you, with no dismantling expertise required.",
    problems: [
      {
        title: "Dead units bleed money at auction",
        body: "A trade-in that will not pass your front line gets dumped at wholesale for a fraction of what its parts are worth. The catalytic converter, wheels, and panels alone often beat the auction check.",
      },
      {
        title: "Your team sells cars, not parts",
        body: "Figuring out what a part is, what condition it is in, and what it sells for is not your business. So the easy money in parts gets left on the table on every wholesale unit.",
      },
      {
        title: "Wrecked trade-ins have nowhere to go",
        body: "A car with frame or flood damage is worthless retail but full of clean, sellable parts. Without a fast way to list them, you simply eat the loss.",
      },
      {
        title: "No system to catch the value",
        body: "Even when you know a unit is worth more in pieces, there is no quick path from a car on the back lot to money in the account.",
      },
    ],
    features: [
      {
        iconKey: "scan",
        title: "See the parts value in minutes",
        body: "Photograph the unit and Ahlam catalogs every sellable part with a suggested price, so you know the part-out value before it ever goes to auction.",
      },
      {
        iconKey: "grade",
        title: "No parts knowledge needed",
        body: "Ahlam names and grades each part for you on a consistent rubric. Your sales team can run it without ever learning a fitment chart.",
      },
      {
        iconKey: "price",
        title: "Priced from the real market",
        body: "Each part is set at the median of recent sales across eBay, Facebook, and OfferUp, so you list at a number buyers actually pay.",
      },
      {
        iconKey: "post",
        title: "List without a dismantling bay",
        body: "Post to eBay today, with Facebook, OfferUp, and Craigslist coming, plus your own storefront. Sell the parts, drop the shell, keep the margin.",
      },
    ],
    outcome:
      "The catalytic converter, wheels, and panels on one dead trade-in often beat the entire wholesale check.",
    faqs: [
      {
        q: "We sell cars, not parts. Can our team really do this?",
        a: "Yes. Ahlam does the part identification, grading, and pricing. Your team just photographs the car and reviews the listings it writes.",
      },
      {
        q: "Should I part a car out or send it to auction?",
        a: "Scan it first. Ahlam gives you a parts value in minutes, so you can compare it against the wholesale number and choose the bigger one.",
      },
      {
        q: "Does this work for flood or frame-damage units?",
        a: "Especially well. Those cars are worth little retail but full of clean, sellable parts, which is exactly what Ahlam surfaces and prices.",
      },
      {
        q: "What does it cost to try?",
        a: "The first 50 businesses get a full month free, no card. After that, plans run Free, Growth $100, Max $200, and Ultimate $350.",
      },
    ],
  },

  "repair-shops": {
    slug: "repair-shops",
    image: "/img/aud-repair.webp",
    headline: "Sell the good parts off the cars you scrap",
    intro:
      "Repair shops scrap cars all the time: total losses, abandoned jobs, and units not worth fixing. Instead of paying to haul them away, photograph them and let Ahlam turn the good parts into listings while your bays stay billable.",
    problems: [
      {
        title: "You pay to throw away value",
        body: "A car that is not worth repairing still has a strong engine, good wheels, and clean panels. Paying a scrapper to haul it off means paying to give that money away.",
      },
      {
        title: "Your time is billable, listing is not",
        body: "Every hour a mechanic spends photographing and typing listings is an hour not turning a wrench. So the parts never get listed, even when everyone knows they are worth money.",
      },
      {
        title: "Abandoned cars pile up",
        body: "Customers leave cars behind after a quote they will not pay. Those units take up space and become a liability instead of a recovery.",
      },
      {
        title: "You know engines, not eBay",
        body: "You can tell a good alternator by feel, but writing the listing, setting the fitment, and pricing it for an online buyer is a different job entirely.",
      },
    ],
    features: [
      {
        iconKey: "scan",
        title: "Photograph it between jobs",
        body: "Snap a few photos of the car and Ahlam does the cataloging. No bench time lost writing listings or researching parts.",
      },
      {
        iconKey: "grade",
        title: "It already knows the part",
        body: "Ahlam names and grades every sellable part from the photo, so your mechanical know-how does not have to become listing know-how.",
      },
      {
        iconKey: "price",
        title: "Fair prices, set automatically",
        body: "Each part is priced at the median of real sales across eBay, Facebook, and OfferUp, so you never have to guess what an online buyer will pay.",
      },
      {
        iconKey: "post",
        title: "Turn scrap fees into income",
        body: "Post to eBay today, with more channels coming, and recover real money from a car you were about to pay someone to remove.",
      },
    ],
    outcome:
      "The engine and wheels off one total loss can outvalue a month of scrap-haul fees.",
    faqs: [
      {
        q: "We are a repair shop, not a parts seller. Is this for us?",
        a: "Yes. If you scrap or part out cars at all, even occasionally, Ahlam turns that into recovered income without adding a listing job to anyone's day.",
      },
      {
        q: "How much time does it actually take?",
        a: "Minutes. Photograph the car between jobs and review the listings later. Ahlam does the identification, grading, and pricing.",
      },
      {
        q: "Can I list just a few parts off one car?",
        a: "Absolutely. Scan a whole car or enter a single part by hand. Either way the AI helps write and price it.",
      },
      {
        q: "What does it cost?",
        a: "The first 50 shops get a month free with no card. After that, plans run Free, Growth $100, Max $200, and Ultimate $350.",
      },
    ],
  },
};

export function getAudienceContent(slug: string): AudienceContent | undefined {
  return AUDIENCE_CONTENT[slug];
}
