// Per-plan usage caps, enforced server-side via lib/usage.ts against the
// usage_events table. A "scan" is one whole car scanned with AI (all photos of
// one analyze run count once — see the scan-batch logic in lib/usage.ts).
//
// Launch pricing (Jul 2026): Growth $100 = 5 AI scans/mo and eBay-only
// cross-posting; Max $200 = 20 AI scans/mo; Ultimate $350 = unlimited. Waitlist
// members get the "founder" month: top-tier features with 5 AI scans, unlimited
// manual posting. The legacy "Pro" default (pre-launch shops) stays unlimited.

export type UsageKind = "scan" | "car_post" | "export_car" | "export_part";

export interface PlanLimits {
  scanPerMonth: number | null;        // AI car scans / calendar month
  carPostPerDay: number | null;       // whole-car posts / day
  exportCarsPerMonth: number | null;  // cars exported / month
  exportPartsPerMonth: number | null; // parts exported / month  (null = unlimited)
  prepareChannels: string[] | null;   // extension cross-post channels (null = all)
}

const UNLIMITED: PlanLimits = {
  scanPerMonth: null, carPostPerDay: null, exportCarsPerMonth: null, exportPartsPerMonth: null,
  prepareChannels: null,
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  // Free-trial month for regular signups ("Up to 2 cars" on the pricing page).
  starter: { ...UNLIMITED, scanPerMonth: 2 },
  solo: { scanPerMonth: 3, carPostPerDay: 1, exportCarsPerMonth: 20, exportPartsPerMonth: 100, prepareChannels: null },
  growth: { ...UNLIMITED, scanPerMonth: 5, prepareChannels: ["ebay"] },
  max: { ...UNLIMITED, scanPerMonth: 20 },
  // Waitlist founding month: everything unlocked, 5 AI scans, unlimited manual posting.
  founder: { ...UNLIMITED, scanPerMonth: 5 },
  // Expired free month or a canceled subscription (the Stripe webhook writes
  // plan "Free" on cancel): no AI scans, no new posts, no exports.
  free: { scanPerMonth: 0, carPostPerDay: 0, exportCarsPerMonth: 0, exportPartsPerMonth: 0, prepareChannels: [] },
  // ultimate / legacy "pro" → unlimited (fall through to UNLIMITED)
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

// Plans granted as an app-side free month (no Stripe subscription behind them).
// They downgrade to "free" once trial_ends_at passes; paid plans are written by
// the Stripe webhook and never expire app-side.
const TRIAL_PLANS = new Set(["starter", "founder"]);

export function effectivePlan(plan?: string | null, trialEndsAt?: string | Date | null): string {
  const p = (plan || "pro").toLowerCase();
  if (!TRIAL_PLANS.has(p)) return p;
  const ends = trialEndsAt ? new Date(trialEndsAt).getTime() : 0;
  return ends > Date.now() ? p : "free";
}

/** Extension cross-post channels this plan may use (null = all). */
export function prepareChannelsFor(plan?: string | null): string[] | null {
  return limitsFor(plan).prepareChannels;
}

/** Human label for a stored plan id ("founder" → "Founding member"). */
export function planLabel(plan?: string | null): string {
  const p = (plan || "Pro").toLowerCase();
  const labels: Record<string, string> = {
    starter: "Free trial", solo: "Solo", growth: "Growth", max: "Max",
    ultimate: "Ultimate", founder: "Founding member", free: "Free", pro: "Pro",
  };
  return labels[p] ?? (plan as string);
}
