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
  image: string; // hero / thumbnail from /public
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
    image: "/marketplace/alternator.webp",
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
    image: "/img/aud-dealer.webp",
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
    image: "/img/compare.webp",
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
  {
    slug: "ahlam-vs-car-part-ebay-hollander-spreadsheets",
    title: "Ahlam vs Car-Part.com, eBay, Hollander, and Spreadsheets: A Fair Comparison",
    description:
      "How Ahlam compares to Car-Part.com, listing on eBay by hand, Hollander and Checkmate yard systems, and spreadsheets. Ahlam identifies, grades, and prices every part from a photo, then writes and posts the listing.",
    category: "Software",
    readMinutes: 8,
    updated: "2026-07-04",
    image: "/img/compare.webp",
    intro:
      "Most tools start after the hard part is done. They store a part you already identified, or list a price you already set. Ahlam starts at the photo: it identifies every sellable part, grades its condition, prices it from real market comps, then writes the listing and posts it. Here is how that compares to the tools small yards actually weigh, honestly, including where each alternative genuinely fits.",
    sections: [
      {
        heading: "The seven jobs, side by side",
        paragraphs: [
          "Compare any of these options on the same seven jobs: identifying the part from a photo, grading condition on a consistent A, B, C rubric, pricing from real market comps, writing the listing, posting to eBay and more in one tap, working for a two-person yard, and starting free.",
          "Most tools handle the storing and the listing. Ahlam is the only one that does the identifying, grading, and pricing first. Car-Part.com, eBay, and yard systems offer partial pricing help (you can search what others ask), and eBay and yard systems can partially automate posting. None of them looks at a photo and tells you what the part is, what shape it is in, and what it should sell for.",
        ],
      },
      {
        heading: "Ahlam vs Car-Part.com",
        paragraphs: [
          "Car-Part.com is the largest used-parts locator in the trade, the place buyers and yards have searched for decades to find a specific part sitting in stock somewhere.",
          "But it shows what you have already typed up and priced. You bring the part name, the fitment, the grade, and the number, then it lists and locates it.",
          "Ahlam works a step earlier. It reads a photo, identifies the part, grades its condition, and prices it from real comps, then hands you a finished listing ready for everywhere you sell, with a direct Car-Part.com feed coming soon.",
        ],
        bullets: [
          "Where Car-Part.com fits: decades of buyer trust, deep interchange and fitment data, and the go-to network when a buyer needs one specific part.",
          "Where Ahlam wins: identifies and grades the part for you straight from a photo, prices from live market comps instead of your own guess, and posts to eBay, Facebook, OfferUp, and your own storefront too.",
        ],
      },
      {
        heading: "Ahlam vs listing on eBay by hand",
        paragraphs: [
          "eBay is where a huge share of used-parts buyers already shop, and its sold-listing history is a genuine pricing signal.",
          "The catch is the work. Listing by hand means you already know what the part is, which cars it fits, what condition to call it, and what to charge, then you type all of it in, one part at a time.",
          "Ahlam does the knowing for you. It names the part, grades it, prices it from the median of real sales, writes the listing, and posts it to eBay in a tap, with Facebook and OfferUp next.",
        ],
        bullets: [
          "Where eBay fits: an enormous buyer base actively searching for parts, sold-listing history as a real pricing reference, and built-in payments, shipping, and buyer protection.",
          "Where Ahlam wins: no parts expertise needed (the AI identifies and grades), median-of-comps pricing instead of a manual lookup per part, and one scan becomes listings across every channel.",
        ],
      },
      {
        heading: "Ahlam vs Hollander and Checkmate",
        paragraphs: [
          "Hollander and Checkmate are the backbone of large, established dismantlers: serious inventory databases with interchange numbers, tear-down tracking, and multi-yard reporting.",
          "That power comes with a price tag, a learning curve, and a workflow built around a full back office. It is a lot of system for a yard run by one or two people.",
          "Ahlam is not trying to replace that for a 40-person operation. It is the photo-to-listing tool a small yard can open today, scan a car, and have priced, posted listings by lunch, with no implementation project.",
        ],
        bullets: [
          "Where Hollander and Checkmate fit: mature inventory control for high-volume yards, industry-standard interchange and tear-down tracking, and multi-location reporting with established integrations.",
          "Where Ahlam wins: live in minutes with no setup or training project, the AI does the identifying, grading, and pricing, and it is priced for a two-person yard, free to start.",
        ],
      },
      {
        heading: "Ahlam vs spreadsheets and notebooks",
        paragraphs: [
          "A spreadsheet is free, familiar, and completely under your control, which is exactly why most small yards still run on one.",
          "But a spreadsheet only records a part after you have done the hard parts: figuring out what it is, what shape it is in, and what it should sell for.",
          "Ahlam does that work and keeps the record itself, so your inventory, grades, prices, and live listings all live in one place that also posts them for sale.",
        ],
        bullets: [
          "Where spreadsheets fit: free, flexible, nothing new to learn, total control over your own columns and notes, and fine for a handful of parts a week.",
          "Where Ahlam wins: identifies, grades, and prices so you just review, inventory and live listings in one system instead of two, and scales to a whole car in minutes, not an afternoon.",
        ],
      },
      {
        heading: "The fastest way to compare is to scan one car",
        paragraphs: [
          "Every option here earns its place for someone. The question is whether it does the part that actually slows you down: knowing what a part is, what it is worth, and getting it listed.",
          "Create your account for your free first month, or book a 15-minute walkthrough and we will scan one of your vehicles live and price every part on the spot.",
        ],
      },
    ],
    faqs: [
      { q: "Does Ahlam replace Car-Part.com?", a: "No. Car-Part.com handles distribution to trade buyers. Ahlam handles the step before it: identifying, grading, pricing, and writing the listing. A direct Car-Part.com feed is coming soon, so the two will work together." },
      { q: "Can Ahlam post to eBay today?", a: "Yes. eBay auto-posting is live now, with one-tap prep for Facebook Marketplace and OfferUp. Craigslist, Car-Part.com, and DoorDash delivery are in development." },
      { q: "Is Ahlam a yard management system?", a: "No. Hollander and Checkmate are ERP-grade inventory systems for high-volume dismantlers. Ahlam is a photo-to-listing tool built so a one or two person yard can price and post a whole car in minutes." },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
