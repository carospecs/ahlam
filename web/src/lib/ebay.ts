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
      "Content-Language": "en-US",
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
}

// Inventory-API publish flow: item → offer → publish. Returns { listingId, url }.
export async function publishListing(shopId: string, input: EbayListingInput): Promise<{ listingId: string; url: string }> {
  const token = await validAccessToken(shopId);
  if (!token) throw new Error("eBay account not connected");

  // 1. Inventory item
  const item = await api(token, `/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, "PUT", {
    availability: { shipToLocationAvailability: { quantity: input.quantity ?? 1 } },
    condition: input.conditionId || "USED_EXCELLENT",
    product: {
      title: input.title.slice(0, 80),
      description: input.description || input.title,
      imageUrls: input.imageUrls?.length ? input.imageUrls : undefined,
    },
  });
  if (!item.ok) throw new Error(`inventory_item: ${item.text.slice(0, 300)}`);

  // 2. Offer
  const offer = await api(token, `/sell/inventory/v1/offer`, "POST", {
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
  });
  let offerId = offer.json?.offerId;
  if (!offer.ok) {
    // Offer may already exist for this SKU — fetch it.
    const existing = await api(token, `/sell/inventory/v1/offer?sku=${encodeURIComponent(input.sku)}`, "GET");
    offerId = existing.json?.offers?.[0]?.offerId;
    if (!offerId) throw new Error(`offer: ${offer.text.slice(0, 300)}`);
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
