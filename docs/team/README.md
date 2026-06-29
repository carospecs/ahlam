# The Ahlam Team

A whole company built as Claude Code agents. You and Andy run Ahlam; everyone below is a named teammate you call by name, hand work to, and go back and forth with. They are scoped to this repo, so they load automatically when you work in Ahlam, and every one of them can use **Claude in Chrome** to do live work in the browser (your real site, dashboards, the live SERP, competitor pages, ad libraries, Stripe, eBay).

**The front door is Atlas.** Talk to him when you are not sure who should own something, and he routes it and runs the team. Or call anyone directly.

Each entry below is written as: a one-line summary, what they do, and an example. Guardrail across the company: anyone who touches money, publishing, sending, or enforcement (Sal, Cora, Dex, Theo, Iris, Vera, Fin, Victor, Dana, Sage) drafts and recommends, but never sends, spends, posts, or commits on their own. You click the button.

---

## Leadership

**Atlas (`atlas-chief-of-staff`)** — Your Chief of Staff; the one person who holds the whole company in his head.
He turns a goal into owned workstreams, assigns each to the right teammate, runs the weekly cadence, and reports back so two founders operate like thirty people. He keeps the company pointed at the real bottleneck, which right now is supply and price accuracy.
> *Example.* You: "Atlas, we want 50 yards onboarded by launch." Atlas restates it as a measurable goal with a date, puts Sal on outbound lists, Cora on the onboarding flow, Penny on making sure the prices those yards see are trustworthy, and gives you back a one-paragraph plan with owners and a Monday check-in.

---

## Marketing and Growth

**Maya (`maya-cmo`)** — Head of Marketing; start here for strategy and campaigns.
She turns a growth goal into a measurable plan and delegates across the marketing team. See her full sample at [samples/maya-gtm-plan.md](samples/maya-gtm-plan.md).
> *Example.* "Maya, build a 30-day launch plan" returns a prioritized plan with the two or three levers that matter and who owns each.

**Dex (`dex-ads`)** — Paid ads and performance marketing.
Audits ad accounts, structures campaigns and budgets, kills wasted spend, and runs disciplined tests against ROAS and CAC. Full sample at [samples/dex-ads-audit.md](samples/dex-ads-audit.md).
> *Example.* "Dex, audit our Google Ads" returns the biggest leak first, with the dollar figure and the fix.

**Nova (`nova-data`)** — Marketing data analyst who actually runs the numbers.
Funnel analysis, attribution, A/B significance, and dashboards, with code run on real data. Full sample at [samples/nova-funnel-analysis.md](samples/nova-funnel-analysis.md).
> *Example.* "Nova, where is the funnel leaking?" returns the stage math and the one fix with the most leverage.

**Scout (`scout-research`)** — Web research and competitive intel.
Lives on the live web pulling competitor pricing, positioning, and the ads rivals run right now. Full sample at [samples/scout-competitor-teardown.md](samples/scout-competitor-teardown.md).
> *Example.* "Scout, tear down Car-Part.com and eBay Motors for us" returns a sourced brief with our opening.

**Quill (`quill-copy`)** — Copywriter for ads, pages, and emails.
Gives multiple distinct test angles, not five rewrites of one idea. Full sample at [samples/quill-ad-copy.md](samples/quill-ad-copy.md).
> *Example.* "Quill, 5 ad angles for yards" returns five different hypotheses Dex can test.

**Rae (`rae-seo`)** — SEO specialist.
Keyword research by intent, content briefs, and on-page and technical audits. Full sample at [samples/rae-seo-brief.md](samples/rae-seo-brief.md).
> *Example.* "Rae, what should we rank for?" returns a clustered keyword plan and a brief a writer can execute.

**Theo (`theo-social`)** — Organic social media manager.
Content calendars, short-form video hooks, and per-platform strategy. Full sample at [samples/theo-content-calendar.md](samples/theo-content-calendar.md).
> *Example.* "Theo, plan launch week" returns a per-platform calendar built around hooks.

**Iris (`iris-content`)** — Content producer who ships finished posts.
Writes the LinkedIn, Instagram, and Facebook caption and generates the image to go with it; professional English, no em dashes. Full sample at [samples/iris-social-posts.md](samples/iris-social-posts.md).
> *Example.* "Iris, make a LinkedIn launch post" returns a ready-to-paste caption plus a generated visual at the right size.

---

## Supply and Customer Success (the hard side of the marketplace)

**Sal (`sal-sales`)** — Outbound sales to the salvage yards, the inventory side.
Builds prospect lists of yards with contacts, writes cold outreach that sounds like a person and not a tech startup, handles the real objections, and qualifies hard. He drafts; you send.
> *Example.* You: "Sal, 20 Texas yards and a cold email." Sal returns a clean table (yard, city, rough size, phone, owner if findable, whether they already sell online) sourced from directories and Google, plus a short plain-English email that leads with parts sitting on shelves and "photos to live listings in minutes," and a call opener for the ones worth phoning.

**Cora (`cora-success`)** — Onboarding and customer success; owns activation.
Gets a new yard from signup to first listings live (your funnel's leak point), writes the onboarding flow and help docs in plain language, drafts support replies, and designs the nudges that turn a trial into a habit.
> *Example.* You: "Cora, this seller is stuck on the scanner." Cora reproduces it in the live app, then drafts a warm, specific reply that solves the problem and lowers the anxiety, and flags to Quinn that the same step is tripping people up so the product stops generating the ticket.

---

## Marketplace Operations

**Penny (`penny-pricing`)** — Pricing Intelligence; owner of price accuracy, the moat.
Audits and improves how the scanner prices parts, hunts mispriced items, tunes comp sources and condition multipliers, and prices special high-value items like catalytic converters off live precious-metal content.
> *Example.* You: "Penny, why did this damaged door price higher than the clean one?" Penny reads `pricing.ts`, traces it to two separate noisy comp searches, confirms the reconciliation step did not catch it, shows the comps and multipliers, and proposes the fix, then notes the cat on the same car should be priced off its platinum and palladium content, not the generic band.

**Lex (`lex-marketplace`)** — Marketplace liquidity and matchmaking; owns the cold-start question.
Decides how to match buyer demand to seller supply: seed demand, borrow it from eBay, or concentrate locally so match rate feels alive. This is the open Linear issue AHLAM-61.
> *Example.* You: "Lex, buyers or sellers first?" Lex argues supply first (cross-posting already borrows demand), recommends concentrating on one region or make for density over thin national coverage, defines nearest-first matching for pickup-friendly parts, and names the metrics to watch (match rate, search-with-no-result, supply-with-no-views).

**Otto (`otto-logistics`)** — Logistics and shipping for heavy, awkward parts.
Picks the right shipping path (parcel, freight, hazmat), gets live carrier quotes, writes packaging guidance yards can follow, and designs the local-pickup versus ship choice and the damage and returns policy.
> *Example.* You: "Otto, how do we ship a car door cross-country?" Otto pulls live LTL freight rates for the lane, shows the math behind the estimate so it can appear in the listing, gives crate-and-protect instructions so it arrives intact, and recommends offering local pickup first since the buyer is two states away.

---

## Trust, Safety and Legal

**Vera (`vera-trust-safety`)** — Trust and Safety; keeps fraud and stolen parts off the platform.
Designs seller vetting, watches for stolen-part and chop-shop patterns, sets VIN and title checks, and builds provenance for high-theft items like catalytic converters and airbags. She flags and recommends; enforcement is your call.
> *Example.* You: "Vera, keep stolen cats off Ahlam." Vera proposes a vetting step (business identity and licensing), a provenance requirement for loose converters (which vehicle, which VIN), and a set of flags (new seller listing high-theft items at volume, prices far below market), and routes the legal side to Reg.

**Reg (`reg-legal`)** — Legal and compliance risk-spotter (not a lawyer, says so).
Covers restricted parts (airbags, cats, seatbelts), EPA rules, state dismantler licensing, marketplace liability, the eBay and Facebook automation terms your extension must respect, plus terms of service and privacy.
> *Example.* You: "Reg, can yards sell airbags on Ahlam?" Reg checks current rules in the browser, explains that used airbags are restricted or illegal in many states and dangerous to ship, sorts it into clearly-fine, needs-care, and do-not-without-counsel, drafts a restricted-parts list, and adds the caveat that a licensed attorney must review before it ships.

---

## Product, Design and QA

**Quinn (`quinn-product`)** — Product Manager; turns feedback and data into shippable specs.
Owns the roadmap, prioritizes ruthlessly for a pre-launch two-sided business, writes well-formed Linear issues for team AHLAM, and says no clearly.
> *Example.* You: "Quinn, turn this yard feedback into a roadmap." Quinn clusters it by problem, ranks by impact versus effort (supply and pricing-trust items first), writes the top three as specs with acceptance criteria and out-of-scope notes, and files them in Linear.

**Remy (`remy-design`)** — Product Designer, tuned to your hard rule: small tweaks only, no redesigns.
Improves spacing, hierarchy, and clarity within the existing look, keeps the Bricolage font and the settled less-AI direction, and refuses to reopen the homepage redesign.
> *Example.* You: "Remy, the scan-results row is cluttered." Remy views it live on localhost, proposes a minimal before-and-after (tighten spacing, fix the price-and-confidence hierarchy, align the chips), and does not touch anything else.

**Tess (`tess-qa`)** — QA and testing; the quality gate before a user hits a bug.
Tests the real flows end to end in the live app, hunts trust-breaking bugs (wrong prices, bad scans, double posts) first, writes followable test plans, and triages the type errors by risk.
> *Example.* You: "Tess, verify scan-to-listing." Tess clicks through photo to scan to priced listing in the browser, checks the cross-post fills and stops without auto-publishing, and reports each step pass or fail with exact steps to reproduce anything broken.

---

## Finance and Fundraising

**Fin (`fin-finance`)** — Finance and unit economics; the honest voice on whether it works.
Models GMV, take rate, CAC, LTV, payback, burn, and runway, separates the SaaS engine from the marketplace engine, and pressure-tests the subscription tiers. He models; he never moves money.
> *Example.* You: "Fin, unit economics at 100 yards." Fin builds the model in code, shows per-yard revenue and contribution margin after payment, infra, and support, blends in CAC from Dex and Nova, gives payback and a runway line, and flags which assumptions are guesses.

**Victor (`victor-fundraising`)** — Fundraising and investor relations.
Builds the deck and narrative, the data room, the investor target list, and the monthly updates, and preps you for the hard questions an auto-parts marketplace invites. He drafts; you send.
> *Example.* You: "Victor, seed deck outline." Victor returns the slide-by-slide built on the real wedge (AI turning photos into accurate listings in an old fragmented market), pulls every number from Fin's model, and prepares honest answers to the cold-start, fraud, and "why not eBay" objections.

---

## Strategy, Domain and Business Development

**Hank (`hank-industry`)** — Auto-recycling industry insider; the credibility engine.
Knows how yards actually run, the lingo, Hollander interchange, Copart and IAA, cores and grades, and what really sells. He makes everyone else sound like insiders instead of outsiders.
> *Example.* You: "Hank, will this outreach land with a yard owner?" Hank rewrites the parts that would make an owner roll his eyes, swaps "AI-powered platform" for "sells more of your shelf, faster," and tells you the one objection the email is not answering.

**Dana (`dana-partnerships`)** — Partnerships and BD; finds the deals that compress months into one relationship.
Maps and structures partnerships for supply (Copart, IAA, insurers, yard associations), demand and channels (eBay and beyond), and data (interchange, VIN, shipping, payments), respecting the legal line on protected catalogs.
> *Example.* You: "Dana, who gets us more inventory fastest?" Dana maps the candidates, ranks them by leverage and reachability, recommends starting with a regional yard association pilot, and drafts a short outreach that leads with their members' win, flagging what Reg and Fin need to see first.

**Sage (`sage-sustainability`)** — Sustainability and non-dilutive funding.
Builds the circular-economy story (every reused part is one not manufactured), quantifies the carbon and waste savings honestly, hunts grants and green funding, and shapes ESG partnerships, with zero tolerance for greenwashing.
> *Example.* You: "Sage, what is our sustainability story and can we get a grant for it?" Sage returns a sourced, defensible carbon-savings figure per reused part, translates Ahlam's listings into a credible impact number, and surfaces two or three circular-economy grants with eligibility and deadlines, handing the consumer version to Quill and the institutional version to Victor.

---

## How to put them to work

Call anyone in plain language: "Use the **penny-pricing** agent to audit our pricing," or just tell **Atlas** the goal and let him assign it. Atlas can coordinate several teammates at once. Each agent starts fresh, so give it the context it needs; anything that should persist (brand voice, target accounts, pricing rules) can be saved to memory so the whole company stays consistent.

## Where the agents live

The live definitions are committed to **`.claude/agents/`** at the repo root, so Claude Code loads them automatically when you work in Ahlam and they travel with the repo for the whole team. Edit a file there to change how that teammate behaves. The marketing team's deeper sample deliverables are in `docs/team/samples/`.
