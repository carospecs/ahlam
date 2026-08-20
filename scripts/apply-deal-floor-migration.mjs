// One-shot: apply supabase/migrations/20260820000000_deal_floor_pct.sql to the
// Supabase project (adds shops.deal_floor_pct).
//
// Usage:
//   SUPABASE_DB_PASSWORD=... node scripts/apply-deal-floor-migration.mjs
//   (falls back to SUPABASE_DB_PASSWORD in web/.env.local)

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

const sql = readFileSync(join(root, "supabase/migrations/20260820000000_deal_floor_pct.sql"), "utf8");
await client.query("begin");
try {
  await client.query(sql);
  await client.query("commit");
  console.log("migration applied");
} catch (e) {
  await client.query("rollback");
  console.error("failed, rolled back:", e.message);
  process.exit(1);
}

const { rows } = await client.query("select column_name, column_default, is_nullable from information_schema.columns where table_schema='public' and table_name='shops' and column_name='deal_floor_pct'");
console.table(rows);
await client.end();
