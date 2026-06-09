// eBay Sell API helper. Everything here no-ops cleanly when the app's eBay
// credentials aren't configured, so the rest of the product stays healthy.
import { supabaseAdmin } from "@/lib/supabase";

const ENV = (process.env.EBAY_ENV || "production").toLowerCase() === "sandbox" ? "sandbox" : "production";
const HOSTS = ENV === "sandbox"
  ? { auth: "https://auth.sandbox.ebay.com", api: "https://api.sandbox.ebay.com" }
  : { auth: "https://auth.ebay.com", api: "https://api.ebay.com" };

// Scopes needed to create + publish inventory-based listings.
const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
].join(" ");

export function ebayConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_REDIRECT_URI);
}
export function ebayEnv() { return ENV; }

function basicAuth(): string {
  return Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
}

// The consent URL we send the seller to. `redirect_uri` is the eBay "RuName".
export function consentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.EBAY_CLIENT_ID!,
    redirect_uri: process.env.EBAY_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${HOSTS.auth}/oauth2/authorize?${p.toString()}`;
}

interface TokenResp { access_token: string; refresh_token?: string; expires_in: number; }

export async function exchangeCode(code: string): Promise<TokenResp> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.EBAY_REDIRECT_URI!,
  });
  const r = await fetch(`${HOSTS.api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth()}` },
    body,
  });
  if (!r.ok) throw new Error(`eBay token exchange failed: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function refresh(refreshToken: string): Promise<TokenResp> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, scope: SCOPES });
  const r = await fetch(`${HOSTS.api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth()}` },
    body,
  });
  if (!r.ok) throw new Error(`eBay token refresh failed: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export async function saveTokens(shopId: string, t: TokenResp, label?: string) {
  const db = supabaseAdmin();
  await db.from("shop_integrations").upsert({
    shop_id: shopId, provider: "ebay",
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
    account_label: label || null, env: ENV, updated_at: new Date().toISOString(),
  }, { onConflict: "shop_id,provider" });
}

export async function getConnection(shopId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("shop_integrations").select("*").eq("shop_id", shopId).eq("provider", "ebay").maybeSingle();
  return data || null;
}

// --- Per-seller business policies (multi-tenant) --------------------------
// Each connected shop posts to ITS OWN eBay account, which has its own policies.
// On connect we reuse the seller's existing policies, or create safe defaults,
// and store the IDs on the shop so publishing uses them (not global env vars).
const ACCT_MKT = "EBAY_US";
const ACCT_CAT = "ALL_EXCLUDING_MOTORS_VEHICLES";

export interface ShopPolicies {
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
}

async function existingPolicy(token: string, kind: string, listField: string, idField: string): Promise<string | undefined> {
  const r = await api(token, `/sell/account/v1/${kind}?marketplace_id=${ACCT_MKT}`, "GET");
  return r.ok ? r.json?.[listField]?.[0]?.[idField] : undefined;
}

async function ensurePayment(token: string): Promise<string | undefined> {
  const existing = await existingPolicy(token, "payment_policy", "paymentPolicies", "paymentPolicyId").catch(() => undefined);
  if (existing) return existing;
  const r = await api(token, `/sell/account/v1/payment_policy`, "POST", {
    name: "Ahlam Default Payment", marketplaceId: ACCT_MKT,
    categoryTypes: [{ name: ACCT_CAT }], immediatePay: true,
  });
  return r.json?.paymentPolicyId;
}

async function ensureReturn(token: string): Promise<string | undefined> {
  const existing = await existingPolicy(token, "return_policy", "returnPolicies", "returnPolicyId").catch(() => undefined);
  if (existing) return existing;
  // Used salvage parts sold as-is → no returns by default. Sellers can change it.
  const r = await api(token, `/sell/account/v1/return_policy`, "POST", {
    name: "Ahlam Default Returns", marketplaceId: ACCT_MKT,
    categoryTypes: [{ name: ACCT_CAT }], returnsAccepted: false,
  });
  return r.json?.returnPolicyId;
}

async function ensureFulfillment(token: string): Promise<string | undefined> {
  const existing = await existingPolicy(token, "fulfillment_policy", "fulfillmentPolicies", "fulfillmentPolicyId").catch(() => undefined);
  if (existing) return existing;
  // eBay rejects a pickup-only policy (LOCAL_PICKUP_ONLY_ERROR), so we publish
  // with a free standard-shipping option — the listing text says "Local pickup
  // preferred — message for shipping," and sellers can edit this Ahlam policy in
  // their eBay account to add real shipping costs. ShippingMethodStandard is the
  // generic flat-rate service eBay accepts everywhere.
  const r = await api(token, `/sell/account/v1/fulfillment_policy`, "POST", {
    name: "Ahlam Standard Shipping", marketplaceId: ACCT_MKT,
    categoryTypes: [{ name: ACCT_CAT }],
    handlingTime: { value: 3, unit: "DAY" },
    shippingOptions: [{
      optionType: "DOMESTIC",
      costType: "FLAT_RATE",
      shippingServices: [{
        sortOrder: 1,
        shippingServiceCode: "ShippingMethodStandard",
        shippingCost: { value: "0.0", currency: "USD" },
        freeShipping: true,
      }],
    }],
  });
  return r.json?.fulfillmentPolicyId;
}

async function ensureLocation(token: string, shop?: { name?: string; location?: string } | null): Promise<string | undefined> {
  const list = await api(token, `/sell/inventory/v1/location?limit=1`, "GET").catch(() => ({ ok: false, json: null } as any));
  const existing = list.json?.locations?.[0]?.merchantLocationKey;
  if (existing) return existing;
  const key = "ahlam-loc-1";
  const postalCode = (shop?.location && /\d{5}/.exec(shop.location)?.[0]) || "90001";
  const r = await api(token, `/sell/inventory/v1/location/${key}`, "POST", {
    location: { address: { country: "US", postalCode } },
    name: shop?.name || "Ahlam Yard",
    merchantLocationStatus: "ENABLED",
    locationTypes: ["WAREHOUSE"],
  });
  // 204 (created) or 409 (already exists) both mean the key is usable.
  return r.ok || r.status === 409 ? key : undefined;
}

// Discover/create the shop's eBay policies + location and persist them. Best-effort
// per piece — a failure on one doesn't block the others.
export async function provisionShopPolicies(shopId: string): Promise<ShopPolicies> {
  const token = await validAccessToken(shopId);
  if (!token) return {};
  // Opt into business-policy management (no-op if already opted in).
  await api(token, `/sell/account/v1/program/opt_in`, "POST", { programType: "SELLING_POLICY_MANAGEMENT" }).catch(() => {});

  const db = supabaseAdmin();
  const { data: shop } = await db.from("shops").select("name, location").eq("id", shopId).maybeSingle();

  const [fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey] = await Promise.all([
    ensureFulfillment(token).catch(() => undefined),
    ensurePayment(token).catch(() => undefined),
    ensureReturn(token).catch(() => undefined),
    ensureLocation(token, shop).catch(() => undefined),
  ]);

  const policies: ShopPolicies = { fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey };
  await db.from("shop_integrations").update({
    fulfillment_policy_id: fulfillmentPolicyId || null,
    payment_policy_id: paymentPolicyId || null,
    return_policy_id: returnPolicyId || null,
    location_key: merchantLocationKey || null,
  }).eq("shop_id", shopId).eq("provider", "ebay");
  return policies;
}

// Load the shop's stored policies; fall back to global env vars if a shop hasn't
// been provisioned yet (keeps older connections working).
export async function getShopPolicies(shopId: string): Promise<ShopPolicies> {
  const conn = await getConnection(shopId);
  return {
    fulfillmentPolicyId: conn?.fulfillment_policy_id || process.env.EBAY_FULFILLMENT_POLICY_ID,
    paymentPolicyId: conn?.payment_policy_id || process.env.EBAY_PAYMENT_POLICY_ID,
    returnPolicyId: conn?.return_policy_id || process.env.EBAY_RETURN_POLICY_ID,
    merchantLocationKey: conn?.location_key || process.env.EBAY_LOCATION_KEY,
  };
}

// Returns a valid access token for the shop, refreshing if expired. null = not connected.
export async function validAccessToken(shopId: string): Promise<string | null> {
  const conn = await getConnection(shopId);
  if (!conn?.refresh_token && !conn?.access_token) return null;
  const fresh = conn.expires_at && new Date(conn.expires_at).getTime() > Date.now();
  if (fresh && conn.access_token) return conn.access_token;
  if (!conn.refresh_token) return conn.access_token || null;
  const t = await refresh(conn.refresh_token);
  await saveTokens(shopId, { ...t, refresh_token: t.refresh_token || conn.refresh_token }, conn.account_label);
  return t.access_token;
}

async function api(token: string, path: string, method: string, body?: unknown) {
  const r = await fetch(`${HOSTS.api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // eBay's Inventory API validates BOTH of these locale headers and rejects
      // the call (errorId 25709) if Accept-Language is missing/non-locale, so we
      // pin them explicitly rather than relying on the runtime's default.
      "Content-Language": "en-US",
      "Accept-Language": "en-US",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* publish returns empty on success sometimes */ }
  return { ok: r.ok, status: r.status, json, text };
}

export interface EbayListingInput {
  sku: string; title: string; description: string; price: number;
  quantity?: number; conditionId?: string; imageUrls?: string[];
  categoryId?: string; merchantLocationKey?: string;
  fulfillmentPolicyId?: string; paymentPolicyId?: string; returnPolicyId?: string;
  // Item specifics shown in the listing + used by eBay's filters (Brand, MPN, etc.).
  aspects?: Record<string, string[]>;
  // Vehicles this part fits. eBay shows a "check compatibility" widget and lets
  // buyers filter parts by their car — the #1 thing that makes parts findable.
  compatibility?: EbayCompatibleVehicle[];
}

export interface EbayCompatibleVehicle {
  make?: string; model?: string; year?: string | number;
  trim?: string; engine?: string; notes?: string;
}

// eBay parts compatibility uses one row per (year, make, model[, trim, engine]).
// Expand a fitment year-range into individual rows and cap the total so a wide
// "fits 20 years of 12 models" result doesn't balloon the request.
function compatibilityRows(vehicles: EbayCompatibleVehicle[], cap = 60) {
  const rows: Array<{ compatibilityProperties: Array<{ name: string; value: string }>; notes?: string }> = [];
  for (const v of vehicles) {
    if (!v.make) continue;
    const props = (year?: string) => [
      year ? { name: "Year", value: year } : null,
      { name: "Make", value: String(v.make) },
      v.model ? { name: "Model", value: String(v.model) } : null,
      v.trim ? { name: "Trim", value: String(v.trim) } : null,
      v.engine ? { name: "Engine", value: String(v.engine) } : null,
    ].filter(Boolean) as Array<{ name: string; value: string }>;
    const yr = String(v.year ?? "").trim();
    const range = /^(\d{4})\s*[-–]\s*(\d{4})$/.exec(yr);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
      for (let y = a; y <= b && rows.length < cap; y++) rows.push({ compatibilityProperties: props(String(y)), notes: v.notes });
    } else {
      rows.push({ compatibilityProperties: props(yr || undefined), notes: v.notes });
    }
    if (rows.length >= cap) break;
  }
  return rows;
}

// Attach vehicle compatibility to an inventory item. Best-effort: a category that
// doesn't support parts compatibility shouldn't block the whole listing.
async function setCompatibility(token: string, sku: string, vehicles: EbayCompatibleVehicle[]) {
  const compatibleProducts = compatibilityRows(vehicles);
  if (!compatibleProducts.length) return;
  await api(token, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}/product_compatibility`, "PUT", { compatibleProducts });
}

// Inventory-API publish flow: item → offer → publish. Returns { listingId, url }.
export async function publishListing(shopId: string, input: EbayListingInput): Promise<{ listingId: string; url: string }> {
  const token = await validAccessToken(shopId);
  if (!token) throw new Error("eBay account not connected");

  // Drop empty aspect values so we never send `{ "Brand": [] }`.
  const aspects = input.aspects
    ? Object.fromEntries(Object.entries(input.aspects).map(([k, v]) => [k, (v || []).filter(Boolean)]).filter(([, v]) => (v as string[]).length))
    : undefined;

  // 1. Inventory item
  const item = await api(token, `/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, "PUT", {
    availability: { shipToLocationAvailability: { quantity: input.quantity ?? 1 } },
    condition: input.conditionId || "USED_EXCELLENT",
    product: {
      title: input.title.slice(0, 80),
      description: input.description || input.title,
      imageUrls: input.imageUrls?.length ? input.imageUrls : undefined,
      aspects: aspects && Object.keys(aspects).length ? aspects : undefined,
    },
  });
  if (!item.ok) throw new Error(`inventory_item: ${item.text.slice(0, 300)}`);

  // 1b. Vehicle fitment (best-effort — never blocks the listing).
  if (input.compatibility?.length) {
    try { await setCompatibility(token, input.sku, input.compatibility); } catch { /* category may not support compatibility */ }
  }

  // 2. Offer
  const offerBody = {
    sku: input.sku,
    marketplaceId: "EBAY_US",
    format: "FIXED_PRICE",
    availableQuantity: input.quantity ?? 1,
    categoryId: input.categoryId || "6028", // "Other Car & Truck Parts"
    listingDescription: input.description || input.title,
    pricingSummary: { price: { value: String(input.price), currency: "USD" } },
    merchantLocationKey: input.merchantLocationKey,
    listingPolicies: {
      fulfillmentPolicyId: input.fulfillmentPolicyId,
      paymentPolicyId: input.paymentPolicyId,
      returnPolicyId: input.returnPolicyId,
    },
  };
  const offer = await api(token, `/sell/inventory/v1/offer`, "POST", offerBody);
  let offerId = offer.json?.offerId;
  if (!offer.ok) {
    // An offer already exists for this SKU (e.g. a prior attempt). Fetch it AND
    // update it with the current location + policies — a stale offer created
    // before provisioning has no location and would fail publish on Item.Country.
    const existing = await api(token, `/sell/inventory/v1/offer?sku=${encodeURIComponent(input.sku)}`, "GET");
    offerId = existing.json?.offers?.[0]?.offerId;
    if (!offerId) throw new Error(`offer: ${offer.text.slice(0, 300)}`);
    const upd = await api(token, `/sell/inventory/v1/offer/${offerId}`, "PUT", offerBody);
    if (!upd.ok) throw new Error(`offer_update: ${upd.text.slice(0, 300)}`);
  }

  // 3. Publish
  const pub = await api(token, `/sell/inventory/v1/offer/${offerId}/publish`, "POST");
  if (!pub.ok) throw new Error(`publish: ${pub.text.slice(0, 400)}`);
  const listingId = pub.json?.listingId || offerId;
  const url = ENV === "sandbox" ? `https://sandbox.ebay.com/itm/${listingId}` : `https://www.ebay.com/itm/${listingId}`;
  return { listingId, url };
}

// --- Whole-vehicle listings (eBay Motors) -----------------------------------
// Motors vehicle categories aren't supported by the Inventory API, so whole
// cars go through the classic Trading API (AddFixedPriceItem) on site 100
// (eBay Motors US), authenticated with the seller's OAuth token via the
// IAF-token header. NOTE: untested against production Motors — verify in
// sandbox first; vehicle listings carry much higher insertion fees.
function xmlEscape(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function tradingHost(): string {
  return ENV === "sandbox" ? "https://api.sandbox.ebay.com/ws/api.dll" : "https://api.ebay.com/ws/api.dll";
}

export interface EbayVehicleInput {
  title: string; description: string; price: number;
  year?: string | number; make?: string; model?: string; trim?: string;
  vin?: string; mileage?: string; bodyType?: string; imageUrls?: string[];
  categoryId?: string; // eBay Motors "Cars & Trucks" = 6001
  fulfillmentPolicyId?: string; paymentPolicyId?: string; returnPolicyId?: string;
}

export async function publishVehicleListing(shopId: string, input: EbayVehicleInput): Promise<{ listingId: string; url: string }> {
  const token = await validAccessToken(shopId);
  if (!token) throw new Error("eBay account not connected");

  const specifics: Array<[string, string | number | undefined]> = [
    ["Year", input.year], ["Make", input.make], ["Model", input.model],
    ["Trim", input.trim], ["VIN", input.vin], ["Mileage", input.mileage], ["Body Type", input.bodyType],
  ];
  const specXml = specifics
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([n, v]) => `<NameValueList><Name>${xmlEscape(n)}</Name><Value>${xmlEscape(String(v))}</Value></NameValueList>`)
    .join("");
  const picsXml = (input.imageUrls || []).filter((u) => /^https?:\/\//.test(u))
    .map((u) => `<PictureURL>${xmlEscape(u)}</PictureURL>`).join("");
  const profilesXml = (input.fulfillmentPolicyId || input.paymentPolicyId || input.returnPolicyId)
    ? `<SellerProfiles>${input.paymentPolicyId ? `<SellerPaymentProfile><PaymentProfileID>${xmlEscape(input.paymentPolicyId)}</PaymentProfileID></SellerPaymentProfile>` : ""}${input.returnPolicyId ? `<SellerReturnProfile><ReturnProfileID>${xmlEscape(input.returnPolicyId)}</ReturnProfileID></SellerReturnProfile>` : ""}${input.fulfillmentPolicyId ? `<SellerShippingProfile><ShippingProfileID>${xmlEscape(input.fulfillmentPolicyId)}</ShippingProfileID></SellerShippingProfile>` : ""}</SellerProfiles>`
    : "";

  const body = `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Item>
    <Title>${xmlEscape(input.title.slice(0, 80))}</Title>
    <Description>${xmlEscape(input.description || input.title)}</Description>
    <PrimaryCategory><CategoryID>${xmlEscape(input.categoryId || "6001")}</CategoryID></PrimaryCategory>
    <StartPrice>${Number(input.price).toFixed(2)}</StartPrice>
    <Country>US</Country>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>1</Quantity>
    <ItemSpecifics>${specXml}</ItemSpecifics>
    ${picsXml ? `<PictureDetails>${picsXml}</PictureDetails>` : ""}
    ${profilesXml}
  </Item>
</AddFixedPriceItemRequest>`;

  const r = await fetch(tradingHost(), {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "100", // eBay Motors US
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1193",
      "X-EBAY-API-CALL-NAME": "AddFixedPriceItem",
      "X-EBAY-API-IAF-TOKEN": token,
      "Content-Type": "text/xml",
    },
    body,
  });
  const text = await r.text();
  const ack = /<Ack>(\w+)<\/Ack>/.exec(text)?.[1];
  const itemId = /<ItemID>(\d+)<\/ItemID>/.exec(text)?.[1];
  if ((ack !== "Success" && ack !== "Warning") || !itemId) {
    const err = /<ShortMessage>([^<]+)<\/ShortMessage>/.exec(text)?.[1] || text.slice(0, 300);
    throw new Error(`eBay Motors: ${err}`);
  }
  const url = ENV === "sandbox" ? `https://www.sandbox.ebay.com/itm/${itemId}` : `https://www.ebay.com/itm/${itemId}`;
  return { listingId: itemId, url };
}
