// Launch-day verification helper (temporary; safe to delete).
// Usage: node scripts/launch-verify.mjs <command> [args]
//   seed-waitlist <email>          add a waitlist row (as a real member would)
//   check-shop <email>             print the user's shop plan/trial fields
//   set-plan <email> <plan>        set the user's shop plan (for gating tests)
//   exhaust-scans <email> <n>      insert n scan usage events for the user's shop
//   batch-test <email>             insert the same scan batch twice; expect 1 row
//   cleanup <email>                delete the test user + their shop + usage rows
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
// Resolve @supabase/supabase-js from web/node_modules (pnpm layout).
const require = createRequire(new URL("../web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const env = {};
for (const line of readFileSync(new URL("../web/.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const [cmd, email, arg] = process.argv.slice(2);
if (!cmd || !email) { console.log("need: <command> <email> [arg]"); process.exit(1); }

async function findUser(em) {
  for (let page = 1; page <= 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const hit = (data?.users || []).find((u) => (u.email || "").toLowerCase() === em.toLowerCase());
    if (hit) return hit;
    if (!data?.users?.length) break;
  }
  return null;
}

async function shopFor(em) {
  const user = await findUser(em);
  if (!user) return { user: null, shop: null };
  const { data: prof } = await db.from("profiles").select("shop_id").eq("id", user.id).maybeSingle();
  if (!prof?.shop_id) return { user, shop: null };
  const { data: shop } = await db.from("shops").select("id, name, plan, trial_ends_at, subscription_status").eq("id", prof.shop_id).maybeSingle();
  return { user, shop };
}

if (cmd === "seed-waitlist") {
  const { error } = await db.from("waitlist").upsert({ email: email.toLowerCase(), shop_name: "Launch Test Yard", source: "launch-verify" }, { onConflict: "email" });
  console.log(error ? `ERROR: ${error.message}` : `waitlist row upserted for ${email}`);
} else if (cmd === "check-shop") {
  const { user, shop } = await shopFor(email);
  console.log(JSON.stringify({ userId: user?.id ?? null, shop }, null, 2));
} else if (cmd === "set-plan") {
  const { shop } = await shopFor(email);
  if (!shop) { console.log("no shop"); process.exit(1); }
  const { error } = await db.from("shops").update({ plan: arg }).eq("id", shop.id);
  console.log(error ? `ERROR: ${error.message}` : `plan -> ${arg}`);
} else if (cmd === "exhaust-scans") {
  const { shop } = await shopFor(email);
  if (!shop) { console.log("no shop"); process.exit(1); }
  const n = Number(arg) || 5;
  const rows = Array.from({ length: n }, () => ({ shop_id: shop.id, kind: "scan", quantity: 1 }));
  const { error } = await db.from("usage_events").insert(rows);
  console.log(error ? `ERROR: ${error.message}` : `inserted ${n} scan events for shop ${shop.id}`);
} else if (cmd === "batch-test") {
  const { shop } = await shopFor(email);
  if (!shop) { console.log("no shop"); process.exit(1); }
  const batch = `verify-${Date.now()}`;
  for (let i = 0; i < 2; i++) {
    const { error } = await db.from("usage_events").upsert(
      { shop_id: shop.id, kind: "scan", quantity: 1, batch_id: batch },
      { onConflict: "shop_id,kind,batch_id", ignoreDuplicates: true },
    );
    if (error) { console.log(`upsert ${i}: ERROR: ${error.message}`); process.exit(1); }
  }
  const { data } = await db.from("usage_events").select("id").eq("shop_id", shop.id).eq("batch_id", batch);
  console.log(`rows for batch after two upserts: ${data?.length} (expect 1)`);
} else if (cmd === "cleanup") {
  const { user, shop } = await shopFor(email);
  if (shop) {
    await db.from("usage_events").delete().eq("shop_id", shop.id);
    await db.from("listings").delete().eq("shop_id", shop.id);
    await db.from("vehicles").delete().eq("shop_id", shop.id);
    await db.from("shop_members").delete().eq("shop_id", shop.id);
    await db.from("shops").delete().eq("id", shop.id);
    console.log(`deleted shop ${shop.id} (${shop.name})`);
  }
  if (user) {
    await db.from("profiles").delete().eq("id", user.id);
    const { error } = await db.auth.admin.deleteUser(user.id);
    console.log(error ? `user delete ERROR: ${error.message}` : `deleted user ${user.email}`);
  }
  const { error: wlErr } = await db.from("waitlist").delete().eq("email", email.toLowerCase()).eq("source", "launch-verify");
  console.log(wlErr ? `waitlist delete ERROR: ${wlErr.message}` : "waitlist test row removed (if any)");
} else {
  console.log("unknown command");
}
