# CaroSpecs Design System

Generated with the `ui-ux-pro-max` design intelligence skill, tuned for an
industrial / automotive / trustworthy aesthetic. Single source of truth for
both `web/` (landing) and `app/` (mobile).

## Aesthetic direction

Premium dark + action red. Rugged but modern. Reads as a serious tool for
people who work with their hands, not a cute consumer toy. Dark surfaces,
high-contrast white text, one decisive red CTA per view, amber reserved
exclusively for "AI is unsure — review carefully."

## Color tokens (dark, automotive)

| Role | Hex | Usage |
|------|-----|-------|
| `background` | `#0F172A` | App/page background |
| `surface` | `#1B2336` | Cards, sheets |
| `surface-2` | `#272F42` | Inputs, muted fills |
| `foreground` | `#F8FAFC` | Primary text |
| `muted` | `#94A3B8` | Secondary text |
| `border` | `#334155` | Dividers, card borders |
| `accent` (CTA) | `#DC2626` | Primary action red |
| `accent-hover` | `#B91C1C` | CTA hover/press |
| `signal` (warn) | `#F59E0B` | Low-confidence highlight ONLY |
| `success` | `#22C55E` | "Good" condition badge |
| `caution` | `#F59E0B` | "Fair" condition badge |
| `danger` | `#EF4444` | "Poor" condition badge / errors |

Condition grade colors are semantic, never decorative: Good = green,
Fair = amber, Poor = red — always paired with the text label (never color alone).

## Typography

- **Font:** Plus Jakarta Sans (headings + body) — friendly, modern, professional SaaS.
- **Scale:** 12 / 14 / 16 / 18 / 24 / 32 / 44.
- Body min 16px (mobile, avoids iOS auto-zoom). Line-height 1.5–1.6.
- Weight hierarchy: 700 headings, 600 labels/CTAs, 400 body.
- Tabular figures for prices.

## Spacing & layout

- 4 / 8 px rhythm. Section spacing tiers 16 / 24 / 32 / 48.
- Desktop container max-w-6xl. Mobile-first, breakpoints 375 / 768 / 1024 / 1440.
- Touch targets ≥ 44×44pt. Respect safe areas on mobile.

## Motion

- Micro-interactions 150–300ms, ease-out entering / ease-in exiting.
- Press feedback: scale 0.96 → 1.0 (with haptics on mobile).
- Entrance: staggered fade-in (Y:20→0, opacity 0→1), 30–50ms stagger.
- Respect `prefers-reduced-motion` / Reduce Motion.

## Icons

- **SVG only — never emoji.** Web: `lucide-react`. Mobile: `lucide-react-native`
  or `@expo/vector-icons`. Consistent stroke width (1.75–2px), one family.

## Landing pattern (Waitlist / Coming Soon)

1. Hero with teaser + email capture above the fold (sticky on scroll)
2. Problem statement
3. How it works (3 steps)
4. Review-card preview (the product's "aha")
5. Pricing (free pilot → $49–79)
6. FAQ
7. Final email capture
- Strategy: dark + accent highlights, scarcity/exclusivity, show waitlist momentum.

## Anti-patterns to avoid

- Emoji as structural icons.
- Excessive animation (animate 1–2 elements per view).
- Dark-mode-by-default without contrast checks — all pairs verified ≥ 4.5:1.
- Color-only meaning (always pair condition color with label).
