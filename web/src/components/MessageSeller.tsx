"use client";

import { useState } from "react";
import { MessageSquare, LoaderCircle, Check } from "lucide-react";

/**
 * "Message seller" for the PUBLIC pages (/p/[id], /shop/[id]). Signed-in
 * visitors send straight from here (replies land in their Ahlam Messages
 * under Buying); signed-out visitors are taken to sign in first.
 */
export function MessageSeller({
  listingId,
  shopId,
  subject,
  sellerName,
  fullWidth,
  compact,
}: {
  listingId?: string;
  shopId?: string;
  subject?: string;
  sellerName?: string;
  fullWidth?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("Hi, is this still available?");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true); setError("");
    try {
      const { supabaseBrowser } = await import("@/lib/supabase-browser");
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session) {
        window.location.href = "/?signin=1";
        return;
      }
      const r = await fetch("/api/marketplace/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listingId ? { listingId, message: text } : { shopId, subject, message: text }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Couldn't send. Try again."); setBusy(false); return; }
      setSent(true);
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: compact ? "9px 12px" : "12px 16px", borderRadius: 11, background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)", fontSize: 13.5, fontWeight: 700, width: fullWidth ? "100%" : "fit-content" }}>
        <Check size={15} /> Sent. Replies land in your Ahlam messages.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: compact ? "8px 14px" : "11px 18px", borderRadius: 11, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: compact ? 13 : 14, fontWeight: 700, cursor: "pointer", width: fullWidth ? "100%" : undefined }}
      >
        <MessageSquare size={15} /> Message {sellerName || "seller"}
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, width: fullWidth ? "100%" : undefined, minWidth: 240 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        style={{ width: "100%", padding: "10px 12px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", outline: "none" }}
      />
      {error && <div style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 600 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: busy || !text.trim() ? 0.6 : 1 }}
        >
          {busy ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <MessageSquare size={15} />} Send
        </button>
        <button onClick={() => setOpen(false)} style={{ padding: "10px 14px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
