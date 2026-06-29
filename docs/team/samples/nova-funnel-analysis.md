# Sample: Nova (Data Analyst) - Funnel Leak Analysis

> Illustrative readout from an example trial funnel. Numbers are made up to show the format and the reasoning.

You asked where the funnel is leaking. Short answer: it's the activation step, not acquisition. Here's the math.

```
Stage                Users     Conv to next     Drop
Landing page visit   10,000          -             -
Started signup        1,200        12.0%        8,800
Completed signup        840        70.0%          360
Activated (1st use)     210        25.0%          630   <-- the leak
Converted to paid        63        30.0%          147
```

Top-of-funnel is fine. A 12% visit-to-signup-start and 70% signup completion are both healthy. The problem is **activation: only 25% of people who finish signing up ever take the first real action**. Three quarters of the people who gave you their email never actually use the product, and you can't convert someone who never showed up.

Why this is the right place to focus: if you lifted activation from 25% to 40% (a realistic target, not a fantasy) and held everything else constant, paid conversions go from 63 to about 101 with zero extra ad spend. No other single fix in this funnel comes close to that leverage. Pouring more traffic in at the top just fills a leaky bucket faster.

What I'd want to look at next to find the cause: time-to-first-action for the 25% who do activate (if it's near-instant, the activated users are people who were already sold, and the onboarding is doing nothing for everyone else), plus the drop-off point inside onboarding itself. My hypothesis is the first-run experience asks for too much before showing any value, but that's a hypothesis, not a finding, until we see the step data.

One caution on the paid number: 63 conversions is a small monthly base, so the 30% trial-to-paid rate has a wide confidence interval, roughly 23% to 38%. Don't treat 30% as precise or make big bets on a 2-point move in it. The activation gap, by contrast, is large enough that it's clearly real and clearly the priority.

**Recommendation:** treat activation as the metric of record for the next month. I'll pull the onboarding step data and the time-to-first-action distribution so we can see exactly where inside onboarding people stall, then hand the messaging fixes to Quill and any flow changes back to you.
