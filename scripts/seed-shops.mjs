// One-off: create owner accounts + shop rows for shops that want a page,
// bypassing the signup-email/onboarding UI flow. Public storefront pages
// (/shop/[id]) need no login; the account is only for the owner to later
// log in and add listings, location, logo, etc.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "../web/.env.local"), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const SHOPS = [
  "Downtown Auto Dismantlers",
  "Aacon Auto Parts",
  "Avalanche Auto Wrecking",
  "Speedy Auto Wrecking",
  "A&B Auto Salvage",
  "El Apache Auto Wrecking",
];

function slugEmail(name) {
  const local = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  return `${local}@ahlam.io`;
}

function genPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!1";
}

const results = [];

for (const name of SHOPS) {
  const email = slugEmail(name);
  const password = genPassword();

  const { data: userRes, error: userErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (userErr) {
    console.error(`[skip] ${name}: auth create failed — ${userErr.message}`);
    results.push({ name, email, error: userErr.message });
    continue;
  }
  const userId = userRes.user.id;

  const { data: shop, error: shopErr } = await db
    .from("shops")
    .insert({ name, account_type: "shop", plan: "starter", trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString() })
    .select()
    .single();
  if (shopErr) {
    console.error(`[skip] ${name}: shop insert failed — ${shopErr.message}`);
    results.push({ name, email, error: shopErr.message });
    continue;
  }

  await db.from("shop_members").insert({ shop_id: shop.id, user_id: userId, role: "owner" });
  await db.from("profiles").update({ shop_id: shop.id }).eq("id", userId);

  results.push({ name, email, password, shopId: shop.id, url: `https://ahlam.io/shop/${shop.id}` });
}

console.log(JSON.stringify(results, null, 2));
