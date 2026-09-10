import { supabaseAdmin } from "@/lib/supabase";
import { openSecret, sealSecret } from "@/lib/secret-box";

export const LINKEDIN_STATE_COOKIE = "linkedin_oauth_state";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API_URL = "https://api.linkedin.com/rest";
// Request only company-page permissions. Identity scopes would require a
// separate Sign In with LinkedIn product and are unnecessary for publishing.
const SCOPES = ["w_organization_social", "r_organization_social", "rw_organization_admin"];

function organizationId() {
  return process.env.LINKEDIN_ORGANIZATION_ID || "132924071";
}

function apiVersion() {
  // Keep this overrideable because LinkedIn sunsets monthly Marketing API
  // versions. 202608 is the current documented version at implementation time.
  return process.env.LINKEDIN_API_VERSION || "202608";
}

export function linkedinConfigured() {
  return !!(
    process.env.LINKEDIN_CLIENT_ID &&
    process.env.LINKEDIN_CLIENT_SECRET &&
    process.env.LINKEDIN_REDIRECT_URI &&
    process.env.MARKETING_TOKEN_ENCRYPTION_KEY &&
    organizationId()
  );
}

export function linkedinAutoPublishEnabled() {
  return process.env.LINKEDIN_AUTO_PUBLISH_ENABLED === "true";
}

export function linkedinConsentUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    state,
    scope: SCOPES.join(" "),
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`LinkedIn token request failed (${response.status}): ${text.slice(0, 220)}`);
  const parsed = JSON.parse(text) as TokenResponse;
  if (!parsed.access_token) throw new Error("LinkedIn did not return an access token");
  return parsed;
}

export function exchangeLinkedInCode(code: string) {
  return tokenRequest(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
  }));
}

async function refreshLinkedInToken(refreshToken: string) {
  return tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  }));
}

export async function saveLinkedInConnection(tokens: TokenResponse, accountLabel = "Ahlam, Inc.") {
  const now = Date.now();
  const accessExpiry = new Date(now + Math.max(60, Number(tokens.expires_in || 3600) - 60) * 1000).toISOString();
  const refreshExpiry = tokens.refresh_token_expires_in
    ? new Date(now + Math.max(60, Number(tokens.refresh_token_expires_in) - 60) * 1000).toISOString()
    : null;
  const row = {
    provider: "linkedin",
    organization_id: organizationId(),
    account_label: accountLabel,
    access_token_ciphertext: sealSecret(tokens.access_token),
    refresh_token_ciphertext: tokens.refresh_token ? sealSecret(tokens.refresh_token) : null,
    access_token_expires_at: accessExpiry,
    refresh_token_expires_at: refreshExpiry,
    scopes: String(tokens.scope || SCOPES.join(" ")).split(/\s+/).filter(Boolean),
    status: "active",
    last_error: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin().from("marketing_integrations")
    .upsert(row, { onConflict: "provider" });
  if (error) throw error;
}

export async function getLinkedInConnection() {
  const { data, error } = await supabaseAdmin().from("marketing_integrations")
    .select("provider,organization_id,account_label,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,refresh_token_expires_at,scopes,status,last_error,updated_at")
    .eq("provider", "linkedin")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function markConnection(status: "active" | "reconnect_required" | "error", lastError: string | null) {
  await supabaseAdmin().from("marketing_integrations")
    .update({ status, last_error: lastError, updated_at: new Date().toISOString() })
    .eq("provider", "linkedin");
}

export async function validLinkedInAccessToken(): Promise<string | null> {
  const connection = await getLinkedInConnection();
  if (!connection?.access_token_ciphertext) return null;
  const expiresAt = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 5 * 60_000) return openSecret(connection.access_token_ciphertext);
  if (!connection.refresh_token_ciphertext) {
    await markConnection("reconnect_required", "LinkedIn access expired; reconnect the Ahlam Page.");
    return null;
  }
  try {
    const refreshToken = openSecret(connection.refresh_token_ciphertext);
    const tokens = await refreshLinkedInToken(refreshToken);
    await saveLinkedInConnection({
      ...tokens,
      refresh_token: tokens.refresh_token || refreshToken,
    }, connection.account_label || "Ahlam, Inc.");
    return tokens.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn token refresh failed";
    await markConnection("reconnect_required", message.slice(0, 500));
    return null;
  }
}

function linkedinHeaders(token: string, json = true) {
  return {
    Authorization: `Bearer ${token}`,
    "Linkedin-Version": apiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function linkedInRequest(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...linkedinHeaders(token), ...(init.headers || {}) },
  });
  const text = await response.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* empty upload responses are valid */ }
  if (!response.ok) throw new Error(`LinkedIn API ${response.status}: ${text.slice(0, 350)}`);
  return { response, json };
}

async function loadPublicImage(imageUrl: string) {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:") throw new Error("LinkedIn images must use HTTPS");
  const allowedHosts = new Set<string>();
  for (const configured of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    try { if (configured) allowedHosts.add(new URL(configured).hostname.toLowerCase()); } catch { /* ignore invalid optional config */ }
  }
  const allowed = (hostname: string) => {
    const host = hostname.toLowerCase();
    return allowedHosts.has(host) || host === "ahlam.io" || host.endsWith(".ahlam.io") || host.endsWith(".supabase.co");
  };
  if (!allowed(url.hostname)) throw new Error("Post image must come from an Ahlam or Supabase public host");
  const maxBytes = 20 * 1024 * 1024;
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not load post image (${response.status})`);
  if (!allowed(new URL(response.url).hostname)) throw new Error("Post image redirected to an untrusted host");
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) throw new Error("Post image URL did not return an image");
  const declaredBytes = Number(response.headers.get("content-length") || 0);
  if (declaredBytes > maxBytes) throw new Error("Post image must be 20 MB or smaller");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Post image response had no body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Post image must be 20 MB or smaller");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks, total);
  if (!bytes.length) throw new Error("Post image was empty");
  return { bytes, contentType };
}

async function uploadLinkedInImage(token: string, imageUrl: string) {
  const owner = `urn:li:organization:${organizationId()}`;
  const { json } = await linkedInRequest(token, "/images?action=initializeUpload", {
    method: "POST",
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const uploadUrl = json?.value?.uploadUrl;
  const image = json?.value?.image;
  if (!uploadUrl || !image) throw new Error("LinkedIn did not initialize the image upload");
  const source = await loadPublicImage(imageUrl);
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": source.contentType },
    body: source.bytes,
  });
  if (!upload.ok) throw new Error(`LinkedIn image upload failed (${upload.status})`);
  return image as string;
}

export async function publishLinkedInPost(input: { text: string; imageUrl?: string | null; imageAlt?: string | null }) {
  if (!linkedinConfigured()) throw new Error("LinkedIn publishing is not configured");
  const token = await validLinkedInAccessToken();
  if (!token) throw new Error("LinkedIn needs to be connected again");
  let imageUrn: string | null = null;
  if (input.imageUrl) {
    try { imageUrn = await uploadLinkedInImage(token, input.imageUrl); }
    catch (error) {
      // A broken source image must not stop a truthful daily update. The post
      // falls back to text and the queue retains the image URL for diagnosis.
      console.warn("[linkedin] image upload skipped", error instanceof Error ? error.message : error);
    }
  }
  const body = {
    author: `urn:li:organization:${organizationId()}`,
    commentary: input.text.slice(0, 3000),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    ...(imageUrn ? { content: { media: { id: imageUrn, altText: String(input.imageAlt || "Ahlam client inventory").slice(0, 300) } } } : {}),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  try {
    const { response } = await linkedInRequest(token, "/posts", { method: "POST", body: JSON.stringify(body) });
    const postId = response.headers.get("x-restli-id");
    if (!postId) throw new Error("LinkedIn published the post but did not return its id");
    await markConnection("active", null);
    return {
      postId,
      url: `https://www.linkedin.com/feed/update/${postId}/`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn publishing failed";
    if (/401|403|token|permission|scope/i.test(message)) await markConnection("reconnect_required", message.slice(0, 500));
    else await markConnection("error", message.slice(0, 500));
    throw error;
  }
}
