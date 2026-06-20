"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";

const REASONS: { value: string; label: string }[] = [
  { value: "unprofessional", label: "Unprofessional behavior" },
  { value: "suspicious", label: "Suspicious activity" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "counterfeit_or_stolen", label: "Counterfeit or stolen parts" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

// "Report this business" — opens a small modal, posts to /api/report, which emails
// both founders for review. Drop it anywhere a business is shown (shop profile,
// message thread) with the shop's id + name.
export function ReportBusiness({ shopId, businessName }: { shopId?: string; businessName?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("unprofessional");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!details.trim()) { setError("Please add a short description."); return; }
    setState("sending"); setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, businessName, reason, details }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't submit the report."); setState("error"); return; }
      setState("done");
    } catch {
      setError("Network error. Please try again."); setState("error");
    }
  }

  function close() {
    setOpen(false);
    // Reset after the modal animates out so reopening is clean.
    setTimeout(() => { setState("idle"); setDetails(""); setReason("unprofessional"); setError(null); }, 200);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
      >
        <Flag size={13} /> Report
      </button>

      {open && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(7,11,22,0.6)", display: "grid", placeItems: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cs-glass"
            style={{ width: "100%", maxWidth: 440, borderRadius: 16, padding: 22, position: "relative" }}
          >
            <button onClick={close} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}><X size={18} /></button>

            {state === "done" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Report submitted</div>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 18px" }}>
                  Thanks. Both founders review every report and will follow up on next steps.
                </p>
                <button onClick={close} className="cs-raise" style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                  <Flag size={17} color="var(--accent)" />
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Report{businessName ? ` ${businessName}` : " this business"}</h3>
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Flag unprofessional behavior or suspicious activity. Both founders review every report.
                </p>

                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, marginBottom: 14, fontFamily: "inherit" }}
                >
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>

                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>What happened?</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  placeholder="Describe the behavior or activity you're reporting…"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />

                {error && <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 10 }}>{error}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                  <button onClick={close} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={submit} disabled={state === "sending"} className="cs-raise" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: state === "sending" ? "not-allowed" : "pointer", opacity: state === "sending" ? 0.6 : 1, fontFamily: "inherit" }}>
                    {state === "sending" ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
