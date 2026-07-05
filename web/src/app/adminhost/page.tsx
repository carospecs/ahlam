"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import Link from "next/link";
import { RefreshCw, Users, LogOut, ExternalLink, Send, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const Login = lazy(() => import("@/components/Login").then((m) => ({ default: m.Login })));

const Loading = () => (
  <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>
    Loading…
  </div>
);

/**
 * Founder console. Sign-in only (no account creation); the data behind it is
 * served by GET /api/admin/stats, which is gated to the ADMIN_EMAILS allowlist
 * server-side — a non-admin session just sees "not authorized". The regular
 * app lives at "/" for everyone, founders included.
 */

type Row = {
  userId: string;
  email: string; joined: string | null; lastSignIn: string | null;
  shopId: string | null; shopName: string | null; accountType: string | null;
  plan: string | null; planRaw: string | null; planId: string | null;
  subscriptionStatus: string | null; hasStripeCustomer: boolean;
  trialEndsAt: string | null; trialDaysLeft: number | null;
  scansThisMonth: number; carPostsThisMonth: number;
  listings: number; activeListings: number; vehicles: number;
};
type Stats = {
  totals: {
    users: number; newUsers7d: number; shops: number;
    waitlist: number; waitlistEmailed: number;
    listings: number; activeListings: number; vehicles: number;
    scansThisMonth: number; carPostsThisMonth: number; paying: number;
  };
  planCounts: Record<string, number>;
  rows: Row[];
};

const PLAN_ORDER = ["founder", "starter", "growth", "max", "ultimate", "solo", "pro", "free"];
const PLAN_LABELS: Record<string, string> = {
  founder: "Founding member", starter: "Free trial", growth: "Growth", max: "Max",
  ultimate: "Ultimate", solo: "Solo", pro: "Pro (legacy)", free: "Free (expired)",
};

export default function AdminHost() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let hasPersistedSession = false;
    try {
      hasPersistedSession = Object.keys(localStorage).some(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
    } catch { /* localStorage blocked — fall through to the network check */ }
    if (!hasPersistedSession) setAuthed(false);

    const sb = supabaseBrowser();
    sb.auth.getSession()
      .then(({ data: { session } }) => setAuthed(!!session))
      .catch(() => setAuthed(false));

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => setAuthed(!!session));
    return () => subscription.unsubscribe();
  }, []);

  if (authed === null) return <Loading />;
  if (!authed) {
    return (
      <Suspense fallback={<Loading />}>
        <Login signInOnly onLogin={() => setAuthed(true)} onClose={() => { window.location.href = "/"; }} />
      </Suspense>
    );
  }
  return <Console onSignOut={() => { supabaseBrowser().auth.signOut(); setAuthed(false); }} />;
}

function Console({ onSignOut }: { onSignOut: () => void }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "forbidden" }
    | { kind: "error"; message: string }
    | { kind: "ready"; stats: Stats }
  >({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/admin/stats", { cache: "no-store" });
      if (r.status === 403) { setState({ kind: "forbidden" }); return; }
      if (!r.ok) { setState({ kind: "error", message: `Request failed (${r.status})` }); return; }
      setState({ kind: "ready", stats: await r.json() });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Network error" });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Per-shop plan change straight from the table.
  const [savingShop, setSavingShop] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState("");
  async function changePlan(shopId: string, shopName: string, plan: string) {
    setSavingShop(shopId);
    setSaveNote("");
    try {
      const r = await fetch("/api/admin/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, plan }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setSaveNote(`Could not change ${shopName}: ${d.error || r.status}`);
      else setSaveNote(`${shopName} is now on ${plan}${plan === "starter" || plan === "founder" ? " (fresh 30-day clock)" : ""}.`);
      await load();
    } catch {
      setSaveNote(`Network error changing ${shopName}. Refresh and check.`);
    }
    setSavingShop(null);
  }

  // Delete a user (two-step confirm per row). Their shop goes too when they
  // were its only member.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  async function deleteUser(userId: string, email: string) {
    setDeleting(userId);
    setSaveNote("");
    try {
      const r = await fetch("/api/admin/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setSaveNote(`Could not delete ${email}: ${d.error || r.status}`);
      else setSaveNote(`Deleted ${email}${d.shopDeleted ? " and their shop" : ""}.`);
      await load();
    } catch {
      setSaveNote(`Network error deleting ${email}. Refresh and check.`);
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
    catch { return iso; }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "40px 24px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1 className="cs-display" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            Founder console
          </h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/adminhost/waitlist" style={btnGhost}><Send size={15} /> Waitlist & launch email</Link>
            <Link href="/" style={btnGhost}><ExternalLink size={15} /> Open the app</Link>
            <button onClick={load} className="cs-raise" style={btnGhost}><RefreshCw size={15} /> Refresh</button>
            <button onClick={onSignOut} style={btnGhost}><LogOut size={15} /> Sign out</button>
          </div>
        </div>

        {state.kind === "loading" && <Note>Loading the numbers…</Note>}
        {state.kind === "forbidden" && (
          <Note>
            This account is not on the admin allowlist (<code>ADMIN_EMAILS</code>).
            The app itself lives at <Link href="/" style={{ color: "var(--accent)", fontWeight: 600 }}>ahlam.io</Link>.
          </Note>
        )}
        {state.kind === "error" && <Note>Could not load stats: {state.message}</Note>}

        {state.kind === "ready" && (() => {
          const { totals, planCounts, rows } = state.stats;
          const tiles = [
            { label: "Users", value: totals.users, sub: `+${totals.newUsers7d} this week` },
            { label: "Paying (autopay)", value: totals.paying, sub: "live Stripe subscriptions" },
            { label: "Shops", value: totals.shops, sub: `${totals.vehicles} vehicles in inventory` },
            { label: "Waitlist", value: totals.waitlist, sub: `${totals.waitlistEmailed} emailed` },
            { label: "Listings", value: totals.listings, sub: `${totals.activeListings} live on the market` },
            { label: "AI scans this month", value: totals.scansThisMonth, sub: `${totals.carPostsThisMonth} cars posted` },
          ];
          const planIds = PLAN_ORDER.filter((p) => planCounts[p]).concat(
            Object.keys(planCounts).filter((p) => !PLAN_ORDER.includes(p)),
          );
          const maxPlan = Math.max(1, ...planIds.map((p) => planCounts[p] ?? 0));
          return (
            <>
              {/* Headline tiles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 26 }}>
                {tiles.map((t) => (
                  <div key={t.label} className="cs-panel" style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)" }}>{t.label}</div>
                    <div className="tnum" style={{ fontSize: 30, fontWeight: 800, marginTop: 6, lineHeight: 1 }}>{t.value.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{t.sub}</div>
                  </div>
                ))}
              </div>

              {/* Plan mix (per shop) */}
              <div className="cs-panel" style={{ marginTop: 16, padding: "18px 20px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Plans <span style={{ color: "var(--muted)", fontWeight: 500 }}>· one per shop</span></div>
                <div style={{ display: "grid", gap: 8 }}>
                  {planIds.map((p) => (
                    <div key={p} style={{ display: "grid", gridTemplateColumns: "150px 1fr 40px", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, color: "var(--foreground)" }}>{PLAN_LABELS[p] ?? p}</span>
                      <div style={{ height: 10, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}>
                        <div style={{ width: `${((planCounts[p] ?? 0) / maxPlan) * 100}%`, height: "100%", borderRadius: 4, background: "var(--accent)" }} />
                      </div>
                      <span className="tnum" style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>{planCounts[p]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Users table */}
              {saveNote && (
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: saveNote.startsWith("Could not") || saveNote.startsWith("Network") ? "var(--danger)" : "var(--success)" }}>
                  {saveNote}
                </div>
              )}
              <div className="cs-panel" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--muted)", background: "var(--surface2)" }}>
                        {["User", "Shop", "Plan", "Expires", "Autopay", "Scans (mo)", "Listings", "Joined", "Last seen", ""].map((h) => (
                          <th key={h} style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.email + i} style={{ borderTop: "1px solid var(--line)" }}>
                          <td style={{ padding: "11px 14px", fontWeight: 600 }}>{r.email}</td>
                          <td style={td}>{r.shopName ? `${r.shopName}${r.accountType === "individual" ? " · individual" : ""}` : "no shop yet"}</td>
                          <td style={td}>
                            {r.shopId && r.planRaw ? (
                              <select
                                value={r.planRaw.toLowerCase()}
                                disabled={savingShop === r.shopId}
                                onChange={(e) => changePlan(r.shopId!, r.shopName || r.email, e.target.value)}
                                style={{ background: "var(--surface2)", color: "var(--foreground)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: savingShop === r.shopId ? 0.5 : 1 }}
                              >
                                {PLAN_ORDER.map((p) => (
                                  <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>
                                ))}
                              </select>
                            ) : "—"}
                          </td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>
                            {r.planId === "starter" || r.planId === "founder"
                              ? <span style={{ color: "var(--foreground)" }}>{fmtDate(r.trialEndsAt)} <span style={{ color: "var(--muted)" }}>({r.trialDaysLeft}d)</span></span>
                              : r.planId === "free"
                                ? <span style={{ color: "var(--danger)", fontWeight: 600 }}>expired</span>
                                : r.subscriptionStatus === "active"
                                  ? "auto-renews"
                                  : "—"}
                          </td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>
                            {r.subscriptionStatus === "active"
                              ? <span style={{ color: "var(--success)", fontWeight: 700 }}>on</span>
                              : r.subscriptionStatus === "canceled"
                                ? <span style={{ color: "var(--danger)", fontWeight: 600 }}>canceled</span>
                                : r.hasStripeCustomer
                                  ? <span style={{ color: "var(--muted)" }}>card on file</span>
                                  : <span style={{ color: "var(--muted)" }}>off</span>}
                          </td>
                          <td style={tdNum}>{r.scansThisMonth}</td>
                          <td style={tdNum}>{r.listings ? `${r.activeListings}/${r.listings}` : "0"}</td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.joined)}</td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.lastSignIn)}</td>
                          <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                            {confirmDelete === r.userId ? (
                              <span style={{ display: "inline-flex", gap: 6 }}>
                                <button
                                  onClick={() => deleteUser(r.userId, r.email)}
                                  disabled={deleting === r.userId}
                                  style={{ border: "none", borderRadius: 8, background: "var(--danger)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 10px", cursor: "pointer", opacity: deleting === r.userId ? 0.6 : 1 }}
                                >
                                  {deleting === r.userId ? "Deleting…" : "Really delete?"}
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  style={{ border: "1px solid var(--line)", borderRadius: 8, background: "transparent", color: "var(--muted)", fontSize: 12, fontWeight: 600, padding: "6px 10px", cursor: "pointer" }}
                                >
                                  Keep
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(r.userId)}
                                title={`Delete ${r.email}`}
                                aria-label={`Delete ${r.email}`}
                                style={{ border: "1px solid var(--line)", borderRadius: 8, background: "transparent", color: "var(--muted)", padding: "6px 8px", cursor: "pointer", display: "inline-grid", placeItems: "center" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
                  <Users size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  Changing the plan applies instantly. Picking Free trial or Founding member starts a fresh 30-day clock. Listings shows live/total. Autopay comes from Stripe; if a customer later buys a plan at checkout, Stripe overwrites whatever is set here. Deleting a user also removes their shop and its listings when they were its only member.
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="cs-panel" style={{ marginTop: 26, padding: "22px 24px", fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6 }}>{children}</div>;
}

const td: React.CSSProperties = { padding: "11px 14px", color: "var(--muted)" };
const tdNum: React.CSSProperties = { padding: "11px 14px", color: "var(--foreground)", fontVariantNumeric: "tabular-nums" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
