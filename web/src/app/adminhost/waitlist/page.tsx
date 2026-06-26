"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Download, ArrowLeft, Users } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Admin-only waitlist viewer. Reachable at /adminhost/waitlist after signing in
// at /adminhost. The data is fetched from GET /api/waitlist, which is gated to
// the founder/admin email allowlist (ADMIN_EMAILS) server-side.

interface Row {
  email: string;
  shop_name: string | null;
  location: string | null;
  parts_per_day: number | null;
  source: string | null;
  created_at: string;
}

type State =
  | { kind: "loading" }
  | { kind: "signedout" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; rows: Row[] };

export default function WaitlistAdmin() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    // Must be signed in (session lives in the @supabase/ssr cookie the API reads).
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    if (!session) { setState({ kind: "signedout" }); return; }
    try {
      const res = await fetch("/api/waitlist", { cache: "no-store" });
      if (res.status === 403) { setState({ kind: "forbidden" }); return; }
      if (!res.ok) { setState({ kind: "error", message: `Request failed (${res.status})` }); return; }
      const json = await res.json();
      setState({ kind: "ready", rows: json.rows ?? [] });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Network error" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
    catch { return iso; }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link href="/adminhost" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <h1 className="cs-display" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Users size={22} color="var(--accent)" /> Waitlist
          </h1>
          {state.kind === "ready" && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "4px 12px" }}>{state.rows.length} signups</span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button onClick={load} className="cs-raise" style={btnGhost}><RefreshCw size={15} /> Refresh</button>
            {state.kind === "ready" && state.rows.length > 0 && (
              <a href="/api/waitlist?format=csv" style={btnSolid}><Download size={15} /> Export CSV</a>
            )}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          {state.kind === "loading" && <Note>Loading signups…</Note>}
          {state.kind === "signedout" && (
            <Note>
              You are not signed in. <Link href="/adminhost" style={{ color: "var(--accent)", fontWeight: 600 }}>Sign in</Link> with a founder/admin account to view the waitlist.
            </Note>
          )}
          {state.kind === "forbidden" && (
            <Note>This account is not on the admin allowlist. Sign in with a founder email (or set <code>ADMIN_EMAILS</code>).</Note>
          )}
          {state.kind === "error" && <Note>Could not load the waitlist: {state.message}</Note>}
          {state.kind === "ready" && (
            state.rows.length === 0 ? (
              <Note>No signups yet. They will appear here the moment someone joins from the site.</Note>
            ) : (
              <div className="cs-panel" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--muted)", background: "var(--surface2)" }}>
                        {["Email", "Shop", "Location", "Parts/day", "Source", "Joined"].map((h) => (
                          <th key={h} style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.rows.map((r, i) => (
                        <tr key={r.email + i} style={{ borderTop: "1px solid var(--line)" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.email}</td>
                          <td style={td}>{r.shop_name || "—"}</td>
                          <td style={td}>{r.location || "—"}</td>
                          <td style={td}>{r.parts_per_day ?? "—"}</td>
                          <td style={td}>{r.source || "—"}</td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="cs-panel" style={{ padding: "22px 24px", fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6 }}>{children}</div>;
}

const td: React.CSSProperties = { padding: "12px 16px", color: "var(--muted)" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const btnSolid: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
