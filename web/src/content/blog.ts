// Blog: the single content hub for Ahlam. Long-form, evergreen articles that
// rank for the searches salvage yards and parts buyers actually make, plus the
// occasional comparison. Each post renders at /blog/[slug], is listed at /blog,
// and is picked up by the sitemap automatically.
//
// (The former /guides section was consolidated into this Blog to remove the
// redundant second content hub. Old /guides/:slug URLs redirect here via
// next.config.mjs, and the slugs are preserved so no links break.)
//
// Add a post by appending an entry. The routes, index, and sitemap read this
// array, so no other wiring is needed.
//
// Copy rule: no em dashes in any user-facing string. Use periods, commas,
// colons, or parentheses.

export interface BlogSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: string;
  author: string;
  readMinutes: number;
  published: string; // ISO date
  image: string; // hero / thumbnail from /public
  intro: string;
  sections: BlogSection[];
  faqs?: { q: string; a: string }[];
}

export const BLOG: BlogPost[] = [
  {
    slug: "ahlam-vs-car-part-ebay-hollander-and-spreadsheets",
    title: "Ahlam vs Car-Part.com, eBay Motors, Hollander, and spreadsheets",
    description:
      "A head-to-head look at how Ahlam compares to the tools yards already use to list used parts: Car-Part.com, eBay Motors by hand, Hollander and Checkmate, and plain spreadsheets.",
    category: "Comparison",
    author: "The Ahlam team",
    readMinutes: 6,
    published: "2026-06-28",
    image: "/img/compare.webp",
    intro:
      "Every yard already has a way to list parts. The question is not whether you have a system, it is whether that system identifies, grades, and prices the part for you, or leaves all three to a person. Here is how Ahlam stacks up against the four tools most yards actually use.",
    sections: [
      {
        heading: "Ahlam vs Car-Part.com",
        paragraphs: [
          "Car-Part.com is where serious parts buyers search, and being listed there matters. But Car-Part.com lists what you already typed up. It assumes the part is already identified, graded, and priced before it ever reaches the listing.",
          "Ahlam does that first step. You photograph the part, Ahlam identifies it, grades the condition on a consistent rubric, and prices it from live comps, then hands you a clean listing. The two are complements, not rivals: let Ahlam do the identification and pricing, then distribute through the marketplaces your buyers already use.",
        ],
        bullets: [
          "Car-Part.com: distribution to dedicated parts buyers.",
          "Ahlam: the identify, grade, and price step that comes before the listing.",
          "Best together: Ahlam builds the listing, Car-Part.com helps sell it.",
        ],
      },
      {
        heading: "Ahlam vs eBay Motors by hand",
        paragraphs: [
          "eBay Motors offers huge national reach, and it is the right home for shippable, fitment-specific parts. The catch is the work. Listing by hand means knowing the part, the exact fitment, and the price, then typing all of it into eBay's form for every single item.",
          "Ahlam writes all three for you and posts to eBay in a tap. You still reach the same national audience, you just skip the part where you become a full-time lister to get there.",
        ],
      },
      {
        heading: "Ahlam vs Hollander and Checkmate",
        paragraphs: [
          "Legacy yard management systems like Hollander and Checkmate are deep, mature inventory databases built for large dismantlers, with interchange and full ERP-grade recordkeeping. They are powerful, and for a yard pulling hundreds of cars a month they still win.",
          "But they are also expensive, desk-bound, and slow to learn, which is overkill for a small yard listing a few dozen parts a week. Ahlam is a photo-to-listing tool a two-person yard can run today, from a phone, with no training. Different tool for a different size of operation.",
        ],
      },
      {
        heading: "Ahlam vs spreadsheets and notebooks",
        paragraphs: [
          "Plenty of yards still run on a spreadsheet or a notebook, and there is nothing wrong with a simple record. But a spreadsheet only records a part after you have already identified and priced it. It captures the answer, it does not give you the answer.",
          "Ahlam does the identifying and pricing, then keeps the record itself. You get the part name, the grade, the price, the listing, and the log, from one photo, instead of doing the hard part in your head and then typing it into a cell.",
        ],
      },
      {
        heading: "How to choose",
        paragraphs: [
          "If you dismantle hundreds of cars a month and need deep, ERP-grade inventory, a traditional system still fits best. For everyone else, the real bottleneck is the time and expertise to identify, grade, price, and list parts. That is exactly the step Ahlam removes, and it works alongside Car-Part.com and eBay rather than replacing them.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does Ahlam replace Car-Part.com or eBay?",
        a: "No. Ahlam handles identification, grading, pricing, and listing, then posts to eBay and prepares listings for the marketplaces you already use. Think of it as the step that comes before distribution, not a competitor to it.",
      },
      {
        q: "Should a large dismantler switch to Ahlam?",
        a: "If you rely on ERP-grade inventory and interchange from a system like Hollander or Checkmate, keep it. Many yards layer Ahlam on top to speed up the identify-and-price step that legacy software leaves to staff expertise.",
      },
    ],
  },
  {
    slug: "how-to-price-a-used-alternator",
    title: "How to Price a Used Alternator (2026 Pricing Guide)",
    description:
      "A practical framework for pricing a used alternator from a salvage vehicle, using amperage, mileage, condition grade, and live marketplace comps.",
    category: "Pricing",
    author: "The Ahlam team",
    readMinutes: 6,
    published: "2026-05-01",
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
    author: "The Ahlam team",
    readMinutes: 5,
    published: "2026-04-15",
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
    author: "The Ahlam team",
    readMinutes: 8,
    published: "2026-06-01",
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
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG.find((p) => p.slug === slug);
}
