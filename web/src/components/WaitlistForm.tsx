"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [partsPerDay, setPartsPerDay] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          shopName: shopName || undefined,
          partsPerDay: partsPerDay || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
          background: "var(--accent-tint)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <CheckCircle2 style={{ margin: "0 auto", color: "var(--accent)" }} size={30} />
        <p style={{ margin: "10px 0 0", fontSize: 17, fontWeight: 700 }}>
          You&apos;re on the list.
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
          We&apos;ll email you the moment your free pilot invite is ready.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }} noValidate>
      <label htmlFor="wl-email" style={srOnly}>Work email</label>
      <input
        id="wl-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourshop.com"
        className="cs-wl-input"
      />
      {!compact && (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Shop name"
            aria-label="Shop name (optional)"
            className="cs-wl-input"
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={partsPerDay}
            onChange={(e) => setPartsPerDay(e.target.value)}
            placeholder="Parts / day"
            aria-label="Parts listed per day (optional)"
            className="cs-wl-input"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 12,
          border: "none",
          background: "var(--accent)",
          color: "#fff",
          padding: "13px 20px",
          fontSize: 15,
          fontWeight: 700,
          cursor: status === "loading" ? "default" : "pointer",
          opacity: status === "loading" ? 0.65 : 1,
          boxShadow: "0 8px 24px -12px var(--accent)",
        }}
      >
        {status === "loading" && <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />}
        {status === "loading" ? "Joining…" : "Join the waitlist"}
      </button>
      {status === "error" && (
        <p role="alert" style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>
          {message}
        </p>
      )}
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", margin: 0 }}>
        Free 30–60 day pilot for early shops. No card required.
      </p>
    </form>
  );
}

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};
