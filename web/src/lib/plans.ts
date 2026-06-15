// Stripe product ids per plan (test mode). Checkout resolves each product's
// default price server-side, so we don't need to hardcode price_… ids. These
// product ids are not secrets (the same plans are public in the pricing table).
// Plan keys match PricingPlans (web/src/components/PricingPlans.tsx).
export const PLAN_PRODUCTS: Record<string, string> = {
  starter: "prod_UhkChHkhxheZ4W",
  growth: "prod_UhkHNWwjKb4yiB",
  max: "prod_UhkIvKiGYghsYc",
  ultimate: "prod_UhkJlQmcugczno",
};
