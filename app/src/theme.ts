// CaroSpecs mobile theme — mirrors docs/DESIGN_SYSTEM.md.
import type { ConditionGrade } from "@carospecs/shared";

export const colors = {
  background: "#0F172A",
  surface: "#1B2336",
  surface2: "#272F42",
  foreground: "#F8FAFC",
  muted: "#94A3B8",
  line: "#334155",
  accent: "#DC2626",
  accentHover: "#B91C1C",
  signal: "#F59E0B",
  signalBg: "rgba(245, 158, 11, 0.12)",
  success: "#22C55E",
  caution: "#F59E0B",
  danger: "#EF4444",
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
  Fair: colors.caution,
  Poor: colors.danger,
};
