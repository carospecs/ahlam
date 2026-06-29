# Marketing Team

A full marketing department for **Ahlam** built as Claude Code subagents. You run the company (co-founders: you and Andy); these are the people on the marketing org. They're scoped to this project, so when you work in the Ahlam repo with Claude Code, the whole team is available by name. Each one is a named agent you call by name, hand a job to, and go back and forth with like a real teammate. Every agent can use **Claude in Chrome** to do live work in the browser (read your real site, dashboards, the live SERP, competitor pages, ad libraries).

## The team

| Agent | Name | Role | Call them for |
|-------|------|------|---------------|
| `maya-cmo` | **Maya** | Head of Marketing / CMO (team lead) | Strategy, campaign plans, priorities, and delegating work to the rest of the team. Start here when you have a goal, not a task. |
| `dex-ads` | **Dex** | Paid Ads / Performance | Google, Meta, TikTok, LinkedIn ads. Account audits, budgets, ROAS/CAC, killing wasted spend, structuring tests. |
| `nova-data` | **Nova** | Marketing Data Analyst | Funnel analysis, attribution, ROAS/CAC/LTV math, A/B test significance, reading and building dashboards. Runs code on your data. |
| `scout-research` | **Scout** | Web Research & Competitive Intel | Competitor teardowns, live pricing, the ads rivals are running right now, market scans, lead lists. Lives on the live web. |
| `quill-copy` | **Quill** | Copywriter | Ad copy, landing pages, emails, headlines, value props. Multiple test angles, not just rewrites. |
| `rae-seo` | **Rae** | SEO Specialist | Keyword research, search intent, content briefs, on-page and technical SEO audits. |
| `theo-social` | **Theo** | Social Media Manager | Organic social: content calendars, short-form video hooks, per-platform strategy, community. |
| `iris-content` | **Iris** | Content Producer | Finished, ready-to-publish posts for LinkedIn / Instagram / Facebook. Writes the caption **and** generates the image. Professional English, no em dashes. |

## How to put them to work

Call an agent by name in plain language:

- "Use the **maya-cmo** agent to build a 30-day go-to-market plan for our launch."
- "Have **dex-ads** audit our Google Ads account and find the wasted spend."
- "Get **iris-content** to make a LinkedIn launch post with an image."
- "Ask **scout-research** what our top 3 competitors charge and how they position."

Maya can coordinate several teammates at once when a job needs more than one person. Each agent starts fresh each time, so give it the context it needs. Anything that should persist (brand voice, target audience, account details) can be saved to memory so the whole team stays consistent.

## Browser access

Every agent has **Claude in Chrome** wired in. They call `tabs_context_mcp` first to see what you already have open, then read live pages directly: your site, GA4, Ads Managers, the Meta Ad Library, the live Google SERP, competitor pages. Agents that touch money or publishing (Dex, Theo, Iris) will never spend, post, or change a setting on their own. They surface the action and you click the button.

## Samples

The `samples/` folder has one example deliverable per agent so you can see the kind of work each one produces before you rely on them.

| Agent | Sample |
|-------|--------|
| Maya | [samples/maya-gtm-plan.md](samples/maya-gtm-plan.md) |
| Dex | [samples/dex-ads-audit.md](samples/dex-ads-audit.md) |
| Nova | [samples/nova-funnel-analysis.md](samples/nova-funnel-analysis.md) |
| Scout | [samples/scout-competitor-teardown.md](samples/scout-competitor-teardown.md) |
| Quill | [samples/quill-ad-copy.md](samples/quill-ad-copy.md) |
| Rae | [samples/rae-seo-brief.md](samples/rae-seo-brief.md) |
| Theo | [samples/theo-content-calendar.md](samples/theo-content-calendar.md) |
| Iris | [samples/iris-social-posts.md](samples/iris-social-posts.md) |

## Where the agents live

The live agent definitions are committed to **`.claude/agents/`** at the root of this repo. Because they're in the project, Claude Code loads them automatically whenever you work in Ahlam, and they travel with the repo for the whole team. Edit a file in `.claude/agents/` to change how that teammate behaves.

The copies of the samples and this README live under `docs/marketing-team/` for reference.
