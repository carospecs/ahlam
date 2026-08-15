// Pre-provision demo accounts for in-person shop demos: create the auth user,
// shop, membership, and profile rows in one pass so on demo day you only type
// an email + password on the shop's computer. Reruns are safe — an existing
// user gets its password reset to the one in the CSV/credentials sheet.
//
// Usage:
//   node scripts/create-demo-accounts.mjs [shops.csv] [--plan founder|starter]
//
// CSV columns (header required; only shop_name is mandatory):
//   shop_name,email,password,location,zip,phone
// Blank email    -> derived from the shop name, e.g. "Joe's Import" -> joesimport@ahlam.io
// Blank password -> generated as two words + 2 digits (e.g. copper-wolf-84):
//                   all lowercase, no ambiguous characters, easy to type on an
//                   unfamiliar keyboard.
//
// Plan default is "founder" (unlimited scans, no trial clock) so a live demo
// can never hit the scan cap or the expired-trial 402 that blocks posting.
// When a shop takes the account over for real, move it to a paid/trial plan:
//   update shops set plan='starter', trial_ends_at=now()+interval '30 days' where id='...';
//
// Requires web/.env.local with NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY pointing at the PRODUCTION Supabase project.
// Writes scripts/demo-credentials.csv — print it or keep it on your phone.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
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

const args = process.argv.slice(2);
const planIdx = args.indexOf("--plan");
const PLAN = planIdx >= 0 ? args[planIdx + 1] : "founder";
const csvPath = resolve(__dirname, args.find((a) => !a.startsWith("--") && a !== PLAN) ?? "demo-shops.csv");
if (!existsSync(csvPath)) {
  console.error(`No CSV at ${csvPath}. Create it with a header row:\n  shop_name,email,password,location,zip,phone`);
  process.exit(1);
}

// Simple CSV parse — handles quoted fields with commas, which shop names have.
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.toLowerCase().trim(), r[i] ?? ""])));
}

function slugEmail(name) {
  const local = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  return `${local}@ahlam.io`;
}

// Typeable password: word-word-NN, lowercase only, no 0/1/l ambiguity.
const WORDS = [
  "copper", "wolf", "maple", "cedar", "river", "stone", "eagle", "prairie",
  "amber", "canyon", "harbor", "meadow", "summit", "trail", "willow", "bridge",
  "falcon", "garnet", "hollow", "juniper", "marble", "north", "orchard", "pines",
  "quartz", "ridge", "sierra", "timber", "valley", "wagon", "anvil", "boulder",
  "chrome", "diesel", "engine", "fender", "garage", "hauler", "ignition", "jack",
];
function genPassword() {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)];
  let a = pick(), b = pick();
  while (b === a) b = pick();
  const n = crypto.randomInt(2, 10) * 10 + crypto.randomInt(2, 10); // digits 2-9 only
  return `${a}-${b}-${n}`;
}

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) return null;
    page++;
  }
}

const shops = parseCsv(readFileSync(csvPath, "utf8"));
const results = [];

for (const row of shops) {
  const name = row.shop_name;
  if (!name) continue;
  const email = row.email || slugEmail(name);
  const password = row.password || genPassword();

  let userId;
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr) {
    // Already registered (rerun): reset the password so the credential sheet
    // is always what actually works.
    const existing = await findUserByEmail(email);
    if (!existing) {
      console.error(`[skip] ${name}: ${createErr.message}`);
      results.push({ name, email, error: createErr.message });
      continue;
    }
    userId = existing.id;
    const { error: updErr } = await db.auth.admin.updateUserById(userId, { password });
    if (updErr) {
      console.error(`[skip] ${name}: password reset failed — ${updErr.message}`);
      results.push({ name, email, error: updErr.message });
      continue;
    }
  } else {
    userId = created.user.id;
  }

  // Upsert the profile ourselves: the on-auth-user-created trigger isn't
  // guaranteed on prod (auth-schema triggers get dropped from pg_dump baselines).
  await db.from("profiles").upsert({ id: userId, display_name: name });

  // One shop per owner; reuse it on rerun instead of duplicating.
  let shopId;
  const { data: membership } = await db
    .from("shop_members").select("shop_id").eq("user_id", userId).limit(1).maybeSingle();
  if (membership?.shop_id) {
    shopId = membership.shop_id;
    await db.from("shops").update({ plan: PLAN }).eq("id", shopId);
  } else {
    const { data: shop, error: shopErr } = await db
      .from("shops")
      .insert({
        name,
        account_type: "shop",
        plan: PLAN,
        location: row.location || null,
        zip_code: row.zip || null,
        business_phone: row.phone || null,
      })
      .select()
      .single();
    if (shopErr) {
      console.error(`[skip] ${name}: shop insert failed — ${shopErr.message}`);
      results.push({ name, email, error: shopErr.message });
      continue;
    }
    shopId = shop.id;
    await db.from("shop_members").insert({ shop_id: shopId, user_id: userId, role: "owner" });
  }
  await db.from("profiles").update({ shop_id: shopId }).eq("id", userId);

  results.push({ name, email, password, shopId });
  console.log(`[ok] ${name} — ${email} / ${password}`);
}

const ok = results.filter((r) => !r.error);
const credsCsv = ["shop_name,email,password,login_url"]
  .concat(ok.map((r) => `"${r.name.replace(/"/g, '""')}",${r.email},${r.password},https://ahlam.io`))
  .join("\n");
const outPath = resolve(__dirname, "demo-credentials.csv");
writeFileSync(outPath, credsCsv + "\n");
console.log(`\n${ok.length}/${results.length} accounts ready (plan: ${PLAN}). Credentials: ${outPath}`);
if (results.some((r) => r.error)) process.exitCode = 1;
