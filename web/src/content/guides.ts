// SEO content engine: long-form guides that rank for the searches salvage
// yards and parts buyers actually make. Each guide renders as its own page at
// /guides/[slug], is listed at /guides, and is included in the sitemap.
//
// Keep these genuinely useful (not keyword stuffing): real pricing logic,
// seasonality, and an honest software comparison. Add new guides by appending
// an entry and the routes, index, and sitemap pick it up automatically.
//
// Copy rule: no em dashes in any user-facing string. Use periods, commas,
// colons, or parentheses.

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  category: string;
  readMinutes: number;
  updated: string; // ISO date
  intro: string;
  sections: GuideSection[];
  faqs?: { q: string; a: string }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-to-price-a-used-alternator",
    title: "How to Price a Used Alternator (2026 Pricing Guide)",
    description:
      "A practical framework for pricing a used alternator from a salvage vehicle, using amperage, mileage, condition grade, and live marketplace comps.",
    category: "Pricing",
    readMinutes: 6,
    updated: "2026-05-01",
    intro:
      "A used alternator is one of the most commonly pulled and re-sold parts in any yard. Price it too high and it sits. Price it too low and you leave money on the bench. Here is how experienced yards actually land on a number.",
    sections: [
      {
        heading: "Start from the live market, not the original MSRP",
        paragraphs: [
          "New OEM alternators can list for $250 to $600, but used buyers anchor to what comparable used units sell for, not the dealer price. Pull three to five active comps for the same make, model, year range, and amperage, then take the median.",
          "Ahlam does this for you. When you photograph the part, it pulls live eBay sold and active comps and suggests a price range, so you start from real demand instead of a guess.",
        ],
      },
      {
        heading: "Adjust for condition grade",
        paragraphs: [
          "Condition is the single biggest swing factor. Use a consistent A, B, and C rubric so a grade of Good means the same thing every time:",
        ],
        bullets: [
          "Grade A (like new, low miles, bench-tested): price at the top of the comp range.",
          "Grade B (reliable, moderate wear, spins strong): price at the median.",
          "Grade C (high miles, or sold as a core or untested): 40 to 60 percent of the median, clearly labeled as-is.",
        ],
      },
      {
        heading: "Factor in testability and warranty",
        paragraphs: [
          "A bench-tested alternator with even a 30-day guarantee commands 15 to 25 percent more than an identical untested unit, because it removes the buyer's biggest fear. If you can test it, say so in the listing and price accordingly.",
        ],
      },
      {
        heading: "A quick worked example",
        paragraphs: [
          "Say you pulled a 130-amp alternator from a 2015 Honda Accord with 70,000 miles. Comps cluster at $85 to $120 used. It spins strong and you bench-tested it, so it is a solid Grade A or B. List it at $110 with the note bench-tested, 30-day guarantee. The test justifies the top of the range.",
        ],
      },
    ],
    faqs: [
      { q: "Should I sell untested alternators as cores?", a: "Yes. If you cannot verify output, list it as an untested core at 40 to 60 percent of the working-unit price. Honest labeling cuts returns and protects your rating." },
      { q: "How much does amperage change the price?", a: "Higher-amp units (for example towing or premium-audio variants) are scarcer and sell for more. Always match the amperage exactly when pulling comps." },
    ],
  },
  {
    slug: "best-time-of-year-to-sell-used-auto-parts",
    title: "The Best Time of Year to Sell Used Auto Parts",
    description:
      "Seasonality drives used-parts demand. Learn which parts sell fastest each season so you can time listings, pricing, and inventory pulls.",
    category: "Selling strategy",
    readMinutes: 5,
    updated: "2026-04-15",
    intro:
      "Used-parts demand is seasonal and predictable. Aligning what you pull and list with the calendar can meaningfully shorten how long inventory sits.",
    sections: [
      {
        heading: "Spring: body and cooling parts",
        paragraphs: [
          "As tax refunds land and the weather improves, DIY repairs and project cars ramp up. Body panels, bumpers, mirrors, and cooling-system parts (radiators, condensers, fans) move quickly. Price body parts confidently from March through May.",
        ],
      },
      {
        heading: "Summer: A/C and road-trip wear items",
        paragraphs: [
          "Heat exposes weak A/C systems, so compressors, condensers, and blower motors spike. Long-distance driving also lifts demand for suspension and braking components.",
        ],
      },
      {
        heading: "Fall and winter: starting, charging, and heating",
        paragraphs: [
          "Cold weather kills marginal batteries, starters, and alternators, and drivers suddenly care about heater cores and blend doors. This is prime season for charging-system parts, exactly the items covered in our alternator pricing guide.",
        ],
      },
      {
        heading: "Year-round: high-demand mechanical",
        paragraphs: [
          "Engines, transmissions, and ECUs sell steadily regardless of season because they are failure-driven, not weather-driven. Keep these listed continuously and let pricing, not timing, do the work.",
        ],
      },
    ],
    faqs: [
      { q: "Should I discount out-of-season parts?", a: "A modest 10 to 15 percent off can clear out-of-season inventory, but high-value mechanical parts hold value year-round, so do not over-discount those." },
    ],
  },
  {
    slug: "salvage-yard-software-comparison-2026",
    title: "Salvage Yard Software Comparison (2026)",
    description:
      "An honest look at yard management and parts-listing software in 2026: Car-Part, Hollander and Checkmate, eBay Motors, and AI-first tools like Ahlam.",
    category: "Software",
    readMinutes: 8,
    updated: "2026-06-01",
    intro:
      "The right software depends on your size and workflow. Here is a candid comparison of the main options yards weigh in 2026, including where each is strong and where it falls short.",
    sections: [
      {
        heading: "Traditional yard management systems (Hollander, Checkmate, Pinnacle)",
        paragraphs: [
          "These are mature, deep systems built for large dismantlers: inventory, interchange, and integration with Car-Part.com. They are powerful, but they are also expensive, desk-bound, and have a steep learning curve. That is overkill for a small yard listing a few dozen parts a week.",
        ],
      },
      {
        heading: "Marketplaces (Car-Part.com, eBay Motors)",
        paragraphs: [
          "Car-Part.com is where serious parts buyers search, and eBay Motors offers huge reach. But both assume you already know what the part is, how to grade it, and how to price it. They handle distribution, not identification.",
        ],
      },
      {
        heading: "AI-first listing tools (Ahlam)",
        paragraphs: [
          "Newer tools remove the expertise bottleneck. You photograph a part, the AI identifies it, grades condition on a consistent rubric, suggests a price from live comps, and helps you post across channels. This is the biggest workflow change for small yards in years. It turns a five-minute listing into a five-second one.",
        ],
        bullets: [
          "Best for: small to mid-size yards and independent sellers who want speed and do not have a dedicated lister.",
          "Strengths: photo-to-listing speed, consistent condition grading, live pricing, and multi-channel posting.",
          "Pair with: Car-Part or eBay for distribution, while the AI tool handles identification and pricing.",
        ],
      },
      {
        heading: "How to choose",
        paragraphs: [
          "If you dismantle hundreds of cars a month and need deep, ERP-grade inventory, a traditional system still wins. If your bottleneck is the time and expertise to identify, grade, price, and list parts, an AI-first tool will move the needle fastest, and it complements the marketplaces rather than replacing them.",
        ],
      },
    ],
    faqs: [
      { q: "Can I use an AI listing tool alongside Car-Part.com?", a: "Yes, and that is the recommended setup for small yards. Use the AI tool to identify, grade, price, and draft the listing, then distribute through the marketplaces your buyers already use." },
      { q: "Do I need to replace my existing system?", a: "Not necessarily. Many yards layer an AI listing tool on top of their current workflow to speed up the identify-and-price step that software has historically left to staff expertise." },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
