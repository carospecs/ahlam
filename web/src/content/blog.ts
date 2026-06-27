// Blog: shorter, timely posts (product news, selling tips, customer stories)
// that sit alongside the long-form /guides. Each post renders at /blog/[slug],
// is listed at /blog, and is picked up by the sitemap automatically.
//
// Difference from guides: guides are evergreen reference playbooks; blog posts
// are dated, lighter, and can announce features or share a single idea.
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
    slug: "cross-post-a-used-part-everywhere-in-one-minute",
    title: "Cross-post a used part to eBay, Facebook, OfferUp, and Craigslist in one minute",
    description:
      "How Ahlam takes one graded, priced part and gets it in front of buyers on every marketplace you sell on, without retyping the listing four times.",
    category: "Product",
    author: "The Ahlam team",
    readMinutes: 4,
    published: "2026-06-22",
    image: "/img/scan-lot.webp",
    intro:
      "Most yards have the same problem: the part is photographed, priced, and ready, but getting it live on eBay, Facebook Marketplace, OfferUp, and Craigslist means typing the same description four times. Here is how Ahlam collapses that into one flow.",
    sections: [
      {
        heading: "One listing, every channel",
        paragraphs: [
          "When Ahlam identifies and prices a part, it builds a clean, complete listing once: title, condition grade, fitment, price, and photos. From there, posting it is a choice of where, not a round of retyping.",
          "eBay is fully automated. Connect your account once and a part goes live with a single click, because eBay gives software a real posting API.",
        ],
      },
      {
        heading: "Facebook, OfferUp, and Craigslist: the assistant fills it in",
        paragraphs: [
          "Those three marketplaces do not let software post on your behalf. So instead of pretending otherwise, Ahlam does the next best thing: our browser helper opens the posting form in your own logged-in account, fills in the title, description, price, and category, and loads your photos.",
          "Nothing goes live until you read it over and click Post. You stay in control, your accounts stay safe, and you skip the typing.",
        ],
      },
      {
        heading: "Why we built it this way",
        paragraphs: [
          "Auto-posting bots that click through Facebook in the background get accounts banned and break every time a page changes. A helper that prefills the real form, in your real browser, with you hitting the final button, is both safer and honest about how these platforms work.",
        ],
        bullets: [
          "eBay: one click, fully automatic.",
          "Facebook, OfferUp, Craigslist: prefilled form, you confirm.",
          "Bulk Facebook catalog export for large inventories.",
        ],
      },
    ],
    faqs: [
      {
        q: "Will this get my Facebook or Craigslist account banned?",
        a: "No. The helper only fills the form in your own browser and waits for you to post. It does not post automatically or run in the background, which is what those platforms penalize.",
      },
      {
        q: "Do I have to post to every marketplace?",
        a: "No. Post to as many or as few as you want. Many yards run eBay automatically and only prep Facebook for higher-value parts.",
      },
    ],
  },
  {
    slug: "buyer-messages-should-reach-your-inbox-and-phone",
    title: "Buyer messages should reach your inbox and your phone, not just an app",
    description:
      "A buyer message you do not see is a sale you lose. Here is how Ahlam makes sure every message reaches you by email, in the app, and on your phone.",
    category: "Selling tips",
    author: "The Ahlam team",
    readMinutes: 3,
    published: "2026-06-22",
    image: "/img/aud-seller.webp",
    intro:
      "Speed wins parts sales. The first seller to answer usually gets the deal. That only works if you actually find out a buyer wrote to you, which is why message notifications are not a nice-to-have.",
    sections: [
      {
        heading: "Every message, three ways",
        paragraphs: [
          "When a buyer messages your shop, Ahlam emails you right away with the message and a link to reply. When you answer, the buyer gets an email too, so the conversation keeps moving even when neither of you is staring at the app.",
        ],
        bullets: [
          "Email alert to your shop the moment a buyer writes.",
          "An unread badge in the app so nothing gets buried.",
          "Reply links so you answer in one tap.",
        ],
      },
      {
        heading: "You control the noise",
        paragraphs: [
          "Notifications respect your settings. Turn buyer-message emails off if you live in the app, or keep them on so a message reaches you on the road. The goal is simple: never lose a sale because a message sat unseen.",
        ],
      },
    ],
    faqs: [
      {
        q: "Where do the email alerts go?",
        a: "To your shop's business email if you set one, otherwise to the owner account's email. You can change this in settings.",
      },
    ],
  },
  {
    slug: "how-ai-grades-a-used-parts-condition",
    title: "How AI grades a used part's condition (the A/B/C system)",
    description:
      "Every part Ahlam lists gets an A, B, or C grade. Here is exactly what each grade means, how the AI decides from a photo, and why a consistent rubric sells more parts with fewer returns.",
    category: "Product",
    author: "The Ahlam team",
    readMinutes: 5,
    published: "2026-06-25",
    image: "/marketplace/headlight.webp",
    intro:
      "Condition is the first thing a parts buyer judges and the last thing most listings explain well. Ahlam grades every part on a simple A, B, C scale, so buyers know what they are getting and you stop guessing or arguing with a coworker over what counts as good. Here is how the system works.",
    sections: [
      {
        heading: "What A, B, and C actually mean",
        paragraphs: [
          "The whole point of a grade is that it means the same thing every time. Three letters, three clear tiers, no maybes:",
        ],
        bullets: [
          "Grade A (like new): low miles, no visible damage, often bench-tested. Prices at the top of the comp range.",
          "Grade B (good, usable): normal wear for its age, works as intended, minor cosmetic marks. Prices around the median.",
          "Grade C (rough or untested): high miles, visible damage, or sold as a core or as-is. Prices well below median, clearly labeled.",
        ],
      },
      {
        heading: "What the AI looks at in your photo",
        paragraphs: [
          "The model reads the photo for the things a buyer would: visible wear, corrosion, cracks, missing clips, and mounting damage. It then weighs what it sees against the part type and, if you enter it, the vehicle's mileage. A scuffed bumper and a scuffed alternator are not graded the same way, because cosmetics matter a lot on a body panel and very little on a charging unit.",
          "The grade is a starting point, not a verdict. You can override it in one tap when you know something the photo cannot show, like a bench-test result or a hairline crack on the back side.",
        ],
      },
      {
        heading: "Why a consistent rubric matters",
        paragraphs: [
          "Two staff members grading by feel will never fully agree, and inconsistent grades are one of the top causes of returns and bad reviews. A fixed rubric means a Grade B from your yard reads the same on Monday and Friday, and the same to every buyer who sees it.",
        ],
        bullets: [
          "Fewer returns: buyers receive what the listing promised.",
          "Faster pricing: the grade maps straight to a position in the comp range.",
          "Better reviews: an honest C beats an optimistic A that disappoints.",
        ],
      },
      {
        heading: "Grading in practice",
        paragraphs: [
          "Say you photograph a headlight assembly off a 2017 Camry. The lens is clear, the housing is intact, and the mounting tabs are unbroken, but it carries normal road haze. The AI lands on Grade B and prices it at the median of live comps. You glance at it, confirm, and it posts. The judgment that used to start a debate took about a second.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I change a grade the AI assigns?",
        a: "Yes. The grade is a suggestion you can override in one tap. The AI reads the photo, but you know the part, so the final call is always yours.",
      },
      {
        q: "Does the grade change the suggested price?",
        a: "Yes. Grade A anchors to the top of the comp range, Grade B to the median, and Grade C well below it, so condition and price always move together.",
      },
    ],
  },
  {
    slug: "why-we-price-from-the-median-not-the-average",
    title: "Why we price from the median, not the average",
    description:
      "A single overpriced listing can drag an average up and leave your part sitting for months. Here is why Ahlam prices from the median of real comps, and what that means for how fast your parts sell.",
    category: "Pricing",
    author: "The Ahlam team",
    readMinutes: 4,
    published: "2026-06-26",
    image: "/marketplace/wheel.webp",
    intro:
      "When Ahlam suggests a price, it uses the median of comparable listings, not the average. That one choice is the difference between a price buyers accept and a price that looks reasonable on a spreadsheet but never actually sells. Here is the reasoning.",
    sections: [
      {
        heading: "Average and median are not the same number",
        paragraphs: [
          "The average adds up every comp and divides by the count. The median is the middle number when you line the comps up from lowest to highest. When the data is clean and tightly clustered, the two land close together. Used-parts data is rarely clean.",
        ],
      },
      {
        heading: "One weird listing breaks the average",
        paragraphs: [
          "Marketplaces are full of outliers: a part listed at triple the going rate by a seller who will never move it, or a fire-sale price from someone clearing out a garage. The average chases those extremes. The median quietly ignores them.",
        ],
        bullets: [
          "Five comps at $90, $95, $100, $105, and $400.",
          "Average: $158, dragged up by one fantasy price.",
          "Median: $100, the real middle of the market.",
        ],
      },
      {
        heading: "Why this matters more for used parts",
        paragraphs: [
          "Price that part at $158 and it sits. Price it at $100 and it moves. The median protected you from a single bad data point.",
          "New parts have a list price. Used parts have a market that shifts with condition, mileage, region, and luck. That market is noisy by nature, which is exactly the situation where the median beats the average. The messier the data, the more the median earns its keep.",
        ],
      },
      {
        heading: "What you see in Ahlam",
        paragraphs: [
          "Ahlam pulls live comps for the same part and fitment, takes the median, and shows you the range it came from, so the number is never a black box. You see the middle of the market and the spread around it, then nudge up for a Grade A or down for a Grade C.",
        ],
        bullets: [
          "The suggested price is the median of real, current comps.",
          "You see the full range, so you can position above or below the middle.",
          "Outliers are filtered, so one fantasy listing never sets your price.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does the median ever price too low?",
        a: "Rarely, because you still adjust for condition. The median is the starting point for a Grade B part. A bench-tested Grade A moves up toward the top of the range, and the listing explains why.",
      },
      {
        q: "Where do the comps come from?",
        a: "Live marketplace listings for the same part. Ahlam matches make, model, year range, and key specs, then takes the median of what is actually selling right now.",
      },
    ],
  },
  {
    slug: "ebay-vs-facebook-vs-offerup-where-used-parts-sell",
    title: "Posting to eBay vs Facebook vs OfferUp: where used parts actually sell",
    description:
      "eBay, Facebook Marketplace, and OfferUp each sell used parts to a different buyer. Here is what moves on each channel, what it costs, and a simple rule for deciding where to post.",
    category: "Selling tips",
    author: "The Ahlam team",
    readMinutes: 5,
    published: "2026-06-24",
    image: "/img/aud-export.webp",
    intro:
      "The best marketplace for a used part depends on the part, the buyer, and how far you are willing to ship. eBay, Facebook Marketplace, and OfferUp pull different crowds, and the smart move is matching the part to the channel instead of blasting everything everywhere. Here is the breakdown.",
    sections: [
      {
        heading: "eBay: national reach, shippable parts",
        paragraphs: [
          "eBay is where buyers search by exact fitment from anywhere in the country. That national audience is hard to beat for parts worth shipping: alternators, ECUs, headlights, and small mechanical components. You pay final value fees, but you reach a buyer who knows precisely what they need and will pay for it.",
        ],
        bullets: [
          "Best for: shippable, fitment-specific parts with national demand.",
          "Strength: huge reach and buyers who search by part number.",
          "Cost: final value fees, though the reach usually pays for them.",
        ],
      },
      {
        heading: "Facebook Marketplace: local, fast, fee-free",
        paragraphs: [
          "Facebook is local-first and free to list, which makes it the home for bulky parts that cost too much to ship: bumpers, hoods, doors, wheels, and seats. Buyers come to pick up, cash in hand, often the same day. The tradeoff is more tire-kickers and more messages to manage.",
        ],
        bullets: [
          "Best for: large, heavy parts sold locally for pickup.",
          "Strength: no listing fees and fast local cash sales.",
          "Cost: more low-quality messages and no buyer protection to lean on.",
        ],
      },
      {
        heading: "OfferUp: a second local net",
        paragraphs: [
          "OfferUp overlaps with Facebook on local pickup but reaches a different, mobile-first set of buyers. It is a strong second channel for the same bulky parts, and posting there widens your local net without much extra work.",
        ],
        bullets: [
          "Best for: local pickup, as a backup alongside Facebook.",
          "Strength: a distinct mobile buyer base for the same heavy parts.",
          "Cost: a smaller audience than the big two, so treat it as backup.",
        ],
      },
      {
        heading: "The simple rule, and why cross-posting wins",
        paragraphs: [
          "If it ships cheaply and fits one vehicle, lead with eBay. If it is big and heavy, lead with Facebook and add OfferUp. Most mid-value parts have demand on more than one channel, so the real answer is to post the right ones everywhere they sell. That is the slow part by hand, and the part Ahlam removes: one graded, priced listing, posted everywhere you sell.",
        ],
      },
    ],
    faqs: [
      {
        q: "Should I really post the same part to all three?",
        a: "For mid-value parts, yes. Cross-posting multiplies your buyers for the same few seconds of work in Ahlam. For very large or very cheap parts, lead local and skip the channels that would cost more to ship than the part is worth.",
      },
      {
        q: "Do these marketplaces let software post for me?",
        a: "Only eBay offers a real posting API, so eBay is fully automatic in Ahlam. For Facebook, OfferUp, and Craigslist, Ahlam prefills the form in your own logged-in browser and you click post.",
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG.find((p) => p.slug === slug);
}
