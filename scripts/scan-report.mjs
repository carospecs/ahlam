// SCAN REPORT — turns the dev server's reprice-timing log lines into a readable
// per-scan speed + pricing report. Zero API calls; reads the log only.
//
//   node scripts/scan-report.mjs                 # all scans in the current dev log
//   node scripts/scan-report.mjs --log <path>    # a different log file
//
// Each /api/reprice call logs one JSON line tagged "reprice-timing" (see
// web/src/app/api/reprice/route.ts): per-tier ms, judge p50/p95, counts, phase
// (full | fast | grounded-followup). This renders them scan by scan so a human
// test session produces the same evidence the eval harness would.
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const li = argv.indexOf("--log");
const LOG = li >= 0 ? argv[li + 1] : "/tmp/ahlam-dev.log";

let raw;
try { raw = readFileSync(LOG, "utf8"); } catch { console.error(`No log at ${LOG} — is the dev server running?`); process.exit(1); }

const rows = [];
for (const line of raw.split("\n")) {
  const i = line.indexOf('{"tag":"reprice-timing"');
  if (i < 0) continue;
  try { rows.push(JSON.parse(line.slice(i))); } catch { /* partial line */ }
}
if (!rows.length) { console.log("No reprice-timing lines yet — run a scan first."); process.exit(0); }

const s = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);
console.log(`${rows.length} pricing call(s) in ${LOG}:\n`);
for (const r of rows) {
  const c = r.counts ?? {};
  console.log(`■ ${r.vehicle ?? "unknown vehicle"}  [${r.phase ?? "full"}]  pricedBy=${r.pricedBy}`);
  console.log(`  parts ${r.parts}  · cached ${c.cached ?? 0} · judged ${c.judged ?? 0} · zero-comp ${c.zeroComp ?? 0} · review-flagged ${c.reviewFlagged ?? 0}`);
  console.log(`  TOTAL ${s(r.totalMs)}  = cache ${s(r.cacheMs)} + ebay ${s(r.ebayMs)} + judge ${s(r.judgeMs)} (${r.judgeCalls ?? 0} calls, p50 ${s(r.judgeP50Ms)}, p95 ${s(r.judgeP95Ms)}) + grounded ${s(r.groundedMs)} + memory ${s(r.memoryMs)}`);
  console.log();
}

// Session-level summary across full/fast phases (followups excluded from wall clock).
const primary = rows.filter((r) => r.phase !== "grounded-followup");
if (primary.length) {
  const tot = primary.map((r) => r.totalMs).filter((x) => x != null).sort((a, b) => a - b);
  const med = tot[Math.floor(tot.length / 2)];
  console.log(`── ${primary.length} scan pricing pass(es): median wall ${s(med)}, worst ${s(tot[tot.length - 1])}`);
}
