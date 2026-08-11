// One-shot: apply supabase/migrations/20260713000000_shop_slug.sql to the
// Supabase project, then (with --assign-dad) give the Downtown Auto Dismantlers
// shop its slug + ultimate plan so downtownautodismantlers.localhost:3000 renders.
//
// Usage:
//   SUPABASE_DB_PASSWORD=... node scripts/apply-shop-slug-migration.mjs [--assign-dad]
//   (falls back to SUPABASE_DB_PASSWORD in web/.env.local)
//
// Requires `pg` (npm i pg in this folder or run from anywhere pg resolves).
// Blocked 2026-08-11: the password in web/.env.local failed pooler auth —
// reset it in Supabase dashboard (Settings → Database) or `npx supabase login`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = readFileSync(join(root, "web/.env.local"), "utf8");
const envPassword = envFile.match(/^SUPABASE_DB_PASSWORD=(.+)$/m)?.[1]?.trim();
const password = process.env.SUPABASE_DB_PASSWORD || envPassword;
if (!password) throw new Error("No SUPABASE_DB_PASSWORD available");

const PROJECT_REF = "wlwhvimdbthoaravnsmq";
const DAD_SHOP_ID = "159c4cdc-3cbc-4061-9942-5c901486df49"; // DAD's real shop (gmail-owned; Aug dup merged+deleted 2026-08-11)
const DAD_SLUG = "downtownautodismantlers"; // matches the live prod host

const hosts = [
  { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: "postgres" },
  { host: "aws-1-us-east-1.pooler.supabase.com", port: 5432, user: `postgres.${PROJECT_REF}` },
  { host: "aws-0-us-east-1.pooler.supabase.com", port: 5432, user: `postgres.${PROJECT_REF}` },
];

let client;
for (const h of hosts) {
  const c = new pg.Client({ ...h, database: "postgres", password, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await c.connect();
    console.log(`connected via ${h.host}`);
    client = c;
    break;
  } catch (e) {
    console.log(`${h.host}: ${e.message}`);
  }
}
if (!client) throw new Error("could not connect — likely a stale DB password");

const sql = readFileSync(join(root, "supabase/migrations/20260713000000_shop_slug.sql"), "utf8");
await client.query("begin");
try {
  await client.query(sql);
  if (process.argv.includes("--assign-dad")) {
    await client.query(
      "update public.shops set slug = $1, plan = 'ultimate' where id = $2",
      [DAD_SLUG, DAD_SHOP_ID]
    );
    console.log("DAD shop assigned slug + ultimate plan");
  }
  await client.query("commit");
  console.log("migration applied");
} catch (e) {
  await client.query("rollback");
  console.error("failed, rolled back:", e.message);
  process.exit(1);
}

const { rows } = await client.query("select id, name, plan, slug from public.shops order by created_at");
console.table(rows);
await client.end();
