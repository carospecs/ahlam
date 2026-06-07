// Ahlam mobile theme — mirrors docs/DESIGN_SYSTEM.md.
import type { ConditionGrade } from "@ahlam/shared";

export const colors = {
  background: "#F4EFE4",          /* Paper — page backdrop */
  surface: "#FFFCF5",             /* white-cream — card backs */
  surface2: "#D0B98B",            /* Sand — hover/fill, card fronts */
  foreground: "#0d1c30",          /* Ink — body text */
  muted: "#8B7D62",               /* muted ink */
  line: "#D0B98B",                /* Sand border */
  accent: "#DC2626",              /* Redline */
  accentHover: "#B91C1C",
  signal: "#B45309",
  signalBg: "rgba(180, 83, 9, 0.14)",
  success: "#15803D",
  caution: "#B45309",
  danger: "#DC2626",
  white: "#FFFFFF",
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const font = {
  h1: 32,
  h2: 24,
  h3: 18,
  body: 16,
  small: 14,
  tiny: 12,
};

/** Semantic color per condition grade (always paired with the text label). */
export const conditionColor: Record<ConditionGrade, string> = {
  Good: colors.success,
  Poor: colors.danger,
};

/** Safe lookup that tolerates legacy data. */
export function conditionColorOf(grade: string): string {
  return (conditionColor as Record<string, string>)[grade] ?? colors.muted;
}
