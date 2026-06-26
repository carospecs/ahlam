// Stripe product ids per plan. Checkout resolves each product's default price
// server-side, so we don't hardcode price_… ids. These product ids are not
// secrets (the same plans are public in the pricing table). Plan keys match
// PricingPlans (web/src/components/PricingPlans.tsx).
//
// GOING LIVE: the hardcoded ids below are TEST-mode products. Create the live
// products in Stripe and either replace these ids or set the matching env vars
// (STRIPE_PRODUCT_SOLO / _STARTER / _GROWTH / _MAX / _ULTIMATE) in production.
// The Solo plan has no product yet, so create it in Stripe first and set its id.
export const PLAN_PRODUCTS: Record<string, string> = {
  solo: process.env.STRIPE_PRODUCT_SOLO || "",
  starter: process.env.STRIPE_PRODUCT_STARTER || "prod_UhkChHkhxheZ4W",
  growth: process.env.STRIPE_PRODUCT_GROWTH || "prod_UhkHNWwjKb4yiB",
  max: process.env.STRIPE_PRODUCT_MAX || "prod_UhkIvKiGYghsYc",
  ultimate: process.env.STRIPE_PRODUCT_ULTIMATE || "prod_UhkJlQmcugczno",
};
