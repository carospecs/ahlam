import { createClient } from "@supabase/supabase-js";
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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
// Accounts to preserve during cleanup — reuse the app's admin allowlist.
// Fail SAFE: if it's empty this destructive script refuses to run rather than
// deleting every account (including the admins).
const KEEP_EMAILS = (env.ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
if (KEEP_EMAILS.length === 0) {
  console.error("Refusing to clean up: set ADMIN_EMAILS so this knows which accounts to keep.");
  process.exit(1);
}

async function runSql(sql) {
  const url = `https://api.supabase.com/v1/projects/wlwhvimdbthoaravnsmq/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SQL error (${res.status}): ${txt}`);
  }
  const data = await res.json();
  return data;
}

async function cleanup() {
  // 1. Find admin user IDs
  const { data: { users }, error: luErr } = await sb.auth.admin.listUsers();
  if (luErr) throw luErr;

  const adminIds = users.filter(u => KEEP_EMAILS.includes(u.email.toLowerCase())).map(u => u.id);
  const toDeleteUsers = users.filter(u => !KEEP_EMAILS.includes(u.email.toLowerCase()));
  console.log("Admin users kept: " + adminIds.length);
  console.log("Non-admin users to delete: " + toDeleteUsers.length);

  const adminIdList = adminIds.map(id => `'${id}'`).join(",");

  // 2. Delete data tables respecting FK order
  const statements = [
    `DELETE FROM contact_messages;`,
    `DELETE FROM messages;`,
    `DELETE FROM conversations;`,
    `DELETE FROM activity_log;`,
    `DELETE FROM listings;`,
    `DELETE FROM vehicles;`,
    `DELETE FROM shop_members;`,
    adminIds.length > 0 ? `UPDATE profiles SET shop_id = NULL WHERE id IN (${adminIdList});` : `DELETE FROM profiles;`,
    `DELETE FROM shops;`,
    adminIds.length > 0 ? `DELETE FROM profiles WHERE id NOT IN (${adminIdList});` : `DELETE FROM profiles;`,
    `DELETE FROM waitlist;`,
  ];

  for (const sql of statements) {
    try {
      await runSql(sql);
      console.log(`OK: ${sql.slice(0, 60)}...`);
    } catch (e) {
      console.error(`FAIL: ${sql.slice(0, 60)}... ${e.message}`);
    }
  }

  // 3. Delete non-admin auth users
  for (const u of toDeleteUsers) {
    try {
      await sb.auth.admin.deleteUser(u.id);
      console.log("Deleted auth user: " + u.email);
    } catch (e) {
      console.error("Error deleting user " + u.email + ": " + e.message);
    }
  }

  console.log("Cleanup complete!");
}

cleanup().catch(function(e) { console.error("Cleanup failed:", e); process.exit(1); });
