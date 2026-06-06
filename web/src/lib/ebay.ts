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
