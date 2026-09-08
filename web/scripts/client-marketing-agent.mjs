#!/usr/bin/env node
import { Agent, CursorAgentError } from "@cursor/sdk";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLIENT_STOREFRONTS,
  extensionPayload,
  fallbackMarketingDraft,
  marketingWindow,
  parseAgentDraft,
  selectMarketingCandidate,
} from "./marketing-core.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(SCRIPT_DIR, "..");
const REPO_DIR = resolve(WEB_DIR, "..");

function loadEnvFile(path) {
  if (!path || !existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(process.env.MARKETING_ENV_FILE || resolve(WEB_DIR, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const nowArg = process.argv.find((arg) => arg.startsWith("--now="))?.slice(6);
const now = nowArg ? new Date(nowArg) : new Date();
const force = process.argv.includes("--force");
const noSdk = process.argv.includes("--no-sdk");
const window = marketingWindow(now);
if (!force && !window.due) {
  console.log(`No marketing run due: ${window.weekday} ${window.hour}:00 ${window.timeZone}`);
  process.exit(0);
}

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function promptFor(shop, candidate, fallback, storefrontUrl) {
  const factPacket = {
    shop: {
      name: shop.name,
      location: shop.location,
      phone: shop.business_phone,
      description: shop.description,
      storefrontUrl,
    },
    inventory: candidate.type === "vehicle" ? {
      type: "whole_vehicle",
      year: candidate.vehicle.year,
      make: candidate.vehicle.make,
      model: candidate.vehicle.model,
      trim: candidate.vehicle.trim,
      body: candidate.vehicle.body,
      color: candidate.vehicle.color,
      mileage: candidate.vehicle.mileage,
      askingPriceUsd: candidate.price,
    } : {
      type: "part",
      partName: candidate.partName,
      conditionGrade: candidate.grade,
      priceUsd: candidate.price,
      sourceVehicle: candidate.vehicle ? {
        year: candidate.vehicle.year,
        make: candidate.vehicle.make,
        model: candidate.vehicle.model,
        trim: candidate.vehicle.trim,
      } : null,
    },
  };
  return `You are the Ahlam client marketing editor. Write one concise Facebook Marketplace draft from the facts below.

Rules:
- Use only supplied facts. Never invent condition, warranty, compatibility, availability, or mechanical claims.
- Name the shop and the inventory item.
- Use plain language a local buyer understands. No em dashes.
- Include the storefront URL and a simple invitation to message the shop.
- Return JSON only with keys: headline, body, hashtags (array without #).
- Keep headline under 100 characters and body under 900 characters.
- Do not publish, browse, edit files, or call external services. This is a review draft only.

Facts:
${JSON.stringify(factPacket, null, 2)}

Safe fallback for reference:
${JSON.stringify(fallback, null, 2)}`;
}

async function generateDraft(shop, candidate, fallback, storefrontUrl) {
  if (noSdk) return { ...fallback, generator: "deterministic", agentRunId: null };
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) return { ...fallback, generator: "deterministic", agentRunId: null };
  try {
    const result = await Agent.prompt(promptFor(shop, candidate, fallback, storefrontUrl), {
      apiKey,
      model: { id: process.env.CURSOR_AGENT_MODEL || "auto" },
      local: {
        cwd: REPO_DIR,
        settingSources: [],
        sandboxOptions: { enabled: true },
      },
    });
    if (result.status !== "finished" || !result.result) {
      console.warn(`[fallback] ${shop.name}: SDK run ${result.id} ended ${result.status}`);
      return { ...fallback, generator: "deterministic", agentRunId: result.id };
    }
    const inventoryName = candidate.type === "vehicle"
      ? [candidate.vehicle.make, candidate.vehicle.model].filter(Boolean).join(" ")
      : candidate.partName;
    const draft = parseAgentDraft(result.result, fallback, [shop.name, inventoryName]);
    return draft === fallback
      ? { ...fallback, generator: "deterministic", agentRunId: result.id }
      : { ...draft, generator: "cursor-sdk", agentRunId: result.id };
  } catch (error) {
    if (error instanceof CursorAgentError) {
      console.warn(`[fallback] ${shop.name}: SDK unavailable (${error.isRetryable ? "retryable" : "not retryable"})`);
    } else {
      console.warn(`[fallback] ${shop.name}: SDK draft could not be parsed`);
    }
    return { ...fallback, generator: "deterministic", agentRunId: null };
  }
}

async function activeInventory(shopId) {
  const [vehiclesResult, listingsResult] = await Promise.all([
    db.from("vehicles")
      .select("id,year,make,model,trim,body,color,mileage,asking_price,sell_mode,status,title,description,photo_url,photo_urls,created_at,updated_at")
      .eq("shop_id", shopId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    db.from("listings")
      .select("id,vehicle_id,status,price_usd,corrected,ai_output,photo_url,photo_urls,created_at,updated_at")
      .eq("shop_id", shopId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
  ]);
  if (vehiclesResult.error) throw vehiclesResult.error;
  if (listingsResult.error) throw listingsResult.error;
  return { vehicles: vehiclesResult.data || [], listings: listingsResult.data || [] };
}

const { data: shops, error: shopsError } = await db.from("shops")
  .select("id,name,location,business_phone,description,marketing_enabled")
  .eq("marketing_enabled", true)
  .order("name");
if (shopsError) throw shopsError;

let created = 0;
let skipped = 0;
for (const shop of shops || []) {
  const storefrontUrl = CLIENT_STOREFRONTS[shop.id] || `https://ahlam.io/shop/${shop.id}`;
  try {
    const [{ vehicles, listings }, historyResult] = await Promise.all([
      activeInventory(shop.id),
      db.from("marketing_post_drafts")
        .select("source_vehicle_id,source_listing_id")
        .eq("shop_id", shop.id)
        .eq("platform", "facebook")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (historyResult.error) throw historyResult.error;
    const usedSourceKeys = (historyResult.data || []).map((row) => row.source_listing_id
      ? `listing:${row.source_listing_id}`
      : row.source_vehicle_id ? `vehicle:${row.source_vehicle_id}` : null).filter(Boolean);
    const candidate = selectMarketingCandidate({ vehicles, listings, usedSourceKeys });
    if (!candidate) {
      console.log(`[skip] ${shop.name}: no active inventory with a public photo and price`);
      skipped++;
      continue;
    }

    const fallback = fallbackMarketingDraft({ shop, candidate, storefrontUrl });
    const draft = await generateDraft(shop, candidate, fallback, storefrontUrl);
    const payload = extensionPayload({ shop, candidate, draft });
    const row = {
      shop_id: shop.id,
      source_vehicle_id: candidate.vehicle?.id || null,
      source_listing_id: candidate.listing?.id || null,
      platform: "facebook",
      slot_key: window.slotKey,
      scheduled_for: now.toISOString(),
      headline: draft.headline,
      body: draft.body,
      image_url: candidate.photos[0] || null,
      payload,
      status: "ready",
      generator: draft.generator,
      agent_run_id: draft.agentRunId,
    };
    const { data, error } = await db.from("marketing_post_drafts")
      .upsert(row, { onConflict: "shop_id,platform,slot_key", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      created++;
      console.log(`[ready] ${shop.name}: ${candidate.label}`);
    } else {
      skipped++;
      console.log(`[skip] ${shop.name}: ${window.slotKey} already exists`);
    }
  } catch (error) {
    skipped++;
    const message = error instanceof Error ? error.message : String(error?.message || error?.details || JSON.stringify(error));
    console.error(`[error] ${shop.name}: ${message}`);
  }
}

console.log(`Marketing run complete: ${created} draft(s) ready, ${skipped} skipped`);
if ((shops || []).length && created === 0 && skipped === 0) process.exitCode = 1;
