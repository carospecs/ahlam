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
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG.find((p) => p.slug === slug);
}
