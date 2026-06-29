# Sample: Dex (Paid Ads) — Google Ads Account Audit

> Illustrative audit of an example Google Ads account spending ~$4k/mo. Shows the format; numbers are made up.

I went top-down through the account, and the biggest leak is at the top, so start there.

**Wasted spend, the headline.** 38% of last month's spend went to search terms that have nothing to do with what you sell, because the campaign is running on broad match with no negative keyword list. You're paying for "free [product]" and a competitor's brand name, neither of which converts. That's roughly $1,500/mo lit on fire. The fix is a negative keyword list and pulling broad match back to phrase on the terms that actually convert. This alone should drop CPA meaningfully without touching anything else.

**Structure.** Everything is crammed into one campaign with one ad group, so Google can't optimize and you can't read what's working. I'd split into three: brand (cheap, defensive, high intent), non-brand prospecting, and a separate retargeting/RLSA layer. Brand traffic converting at a low CPA is currently flattering the blended number and hiding how expensive cold acquisition really is.

**Bidding.** You're on Maximize Clicks, which optimizes for the one thing that doesn't matter. With enough conversion history, move to Maximize Conversions, then to a Target CPA once you have ~30 conversions/month to feed it. Don't set a tCPA before then or it'll choke.

**Tracking, and this matters most.** Your conversion action looks like it's counting page views, not actual signups, which means every number above is suspect. Before we optimize anything, Nova and I should confirm the conversion is firing on the real event with proper de-duplication. If tracking is wrong, we're optimizing toward a lie.

**Creative.** One ad per ad group, no testing. Quill can give us three distinct angles to run so we actually learn what message pulls.

**The order I'd do it:** negatives and match types this week (fastest money saved), fix conversion tracking with Nova in parallel, then restructure into three campaigns, then bidding, then creative tests. Don't touch budgets until the structure and tracking are clean, otherwise you can't tell what changed.

Quick math on the test plan: at a target of $120 CPA and ~$80/day on non-brand, give each creative angle about 10 to 14 days to reach a meaningful sample before declaring a winner. Calling it on 5 conversions is how you fool yourself.

All of these are recommendations. I won't change a budget or pause anything in the account myself. Tell me which to start with and I'll lay out the exact steps for you to click through.
