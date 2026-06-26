// Per-plan usage caps. Solo is the only metered tier today; every other plan
// (free trial, Growth, Max, Ultimate, and the legacy "Pro" default) is unlimited.
// Enforced server-side via lib/usage.ts against the usage_events table.

export type UsageKind = "scan" | "car_post" | "export_car" | "export_part";

export interface PlanLimits {
  scanPerMonth: number | null;        // AI car scans / calendar month
  carPostPerDay: number | null;       // whole-car posts / day
  exportCarsPerMonth: number | null;  // cars exported / month
  exportPartsPerMonth: number | null; // parts exported / month  (null = unlimited)
}

const UNLIMITED: PlanLimits = {
  scanPerMonth: null, carPostPerDay: null, exportCarsPerMonth: null, exportPartsPerMonth: null,
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  solo: { scanPerMonth: 3, carPostPerDay: 1, exportCarsPerMonth: 20, exportPartsPerMonth: 100 },
  // starter / growth / max / ultimate / pro → unlimited (fall through to UNLIMITED)
};

export function limitsFor(plan?: string | null): PlanLimits {
  if (!plan) return UNLIMITED;
  return PLAN_LIMITS[plan.toLowerCase()] ?? UNLIMITED;
}

export function limitForKind(plan: string | null | undefined, kind: UsageKind): number | null {
  const l = limitsFor(plan);
  return kind === "scan" ? l.scanPerMonth
    : kind === "car_post" ? l.carPostPerDay
    : kind === "export_car" ? l.exportCarsPerMonth
    : l.exportPartsPerMonth;
}
