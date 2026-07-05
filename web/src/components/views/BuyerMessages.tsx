"use client";

import React from "react";
import { Inbox, Send, Store, MessageCircle, Search, X, Trash2 } from "lucide-react";
import { csToast } from "../Dashboard";

interface BMsg { from: string; text: string; time: string }
interface BThread {
  id: string; shopId: string; shopName: string; phone: string | null;
  part: string; market: string; time: string; unread?: number; messages: BMsg[]; lastText: string;
}

// Buyer-side deletes are per-device hides (the seller keeps their copy), keyed
// to the thread's message count at delete time so NEW activity resurfaces the
// conversation instead of silently vanishing forever.
const DELETED_BUYING_KEY = "ahlam_deleted_buying_v2";
function loadDeleted(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(DELETED_BUYING_KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
function saveDeleted(m: Record<string, number>) {
  try { localStorage.setItem(DELETED_BUYING_KEY, JSON.stringify(m)); } catch { /* private mode */ }
}

// The buyer's side of messaging: the conversations the signed-in user started by
// hitting "Message seller" in Browse or on a public listing page, plus the
// seller's replies. Mirrors the seller inbox layout but reads
// /api/messages/mine (keyed on buyer_id).
export function BuyerMessages() {
  const [threads, setThreads] = React.useState<BThread[]>([]);
  // "" = nothing picked yet (auto-select first); null = user closed the pane.
  const [activeId, setActiveId] = React.useState<string | null>("");
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [deleted, setDeleted] = React.useState<Record<string, number>>(loadDeleted);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/messages/mine");
      const d = await r.json();
      if (Array.isArray(d.threads)) setThreads(d.threads);
    } catch { /* keep what we have */ } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, [load]);
  // Hidden only while nothing new happened since the delete.
  const isHidden = React.useCallback(
    (th: BThread) => deleted[th.id] != null && th.messages.length <= deleted[th.id],
    [deleted],
  );

  React.useEffect(() => {
    if (activeId === "" && threads.length) {
      const first = threads.find((th) => !isHidden(th));
      if (first) setActiveId(first.id);
    }
  }, [threads, activeId, isHidden]);

  const ql = query.trim().toLowerCase();
  const notDeleted = threads.filter((th) => !isHidden(th));
  const visible = ql
    ? notDeleted.filter((th) => `${th.shopName} ${th.part} ${th.lastText}`.toLowerCase().includes(ql))
    : notDeleted;
  const t = activeId ? visible.find((x) => x.id === activeId) || null : null;

  // Always land on the newest message, and keep the outer grid pinned:
  // focusing a child of an overflow:hidden box can scroll the box itself,
  // clipping the pane headers out of view.
  React.useEffect(() => {
    // Double-rAF: wait for the grid to finish constraining heights, otherwise
    // scrollHeight equals clientHeight and the scroll is a no-op.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        const g = gridRef.current;
        if (g) { g.scrollTop = 0; g.scrollLeft = 0; }
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [activeId, t?.messages.length, loading]);

  function deleteThread(id: string) {
    const th = threads.find((x) => x.id === id);
    setDeleted((prev) => { const n = { ...prev, [id]: th?.messages.length ?? 0 }; saveDeleted(n); return n; });
    if (activeId === id) {
      const next = notDeleted.find((x) => x.id !== id);
      setActiveId(next ? next.id : null);
    }
    csToast("Conversation deleted. It comes back if the seller replies.");
  }

  async function send() {
    if (!t || sending || !draft.trim()) return;
    // Sending to a thread always unhides it.
    if (deleted[t.id] != null) {
      setDeleted((prev) => { const n = { ...prev }; delete n[t.id]; saveDeleted(n); return n; });
    }
    const text = draft.trim();
    setDraft("");
    setSending(true);
    setThreads((prev) => prev.map((x) => x.id === t.id ? { ...x, messages: [...x.messages, { from: "me", text, time: "Now" }], lastText: text } : x));
    try {
      const r = await fetch("/api/messages/mine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: t.id, body: text }),
      });
      if (!r.ok) { csToast("Couldn't send — try again"); }
      await load();
    } catch { csToast("Couldn't send — check your connection"); }
    finally { setSending(false); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;
  if (!notDeleted.length) {
    return (
      <div style={{ padding: 44, textAlign: "center", color: "var(--muted)", fontSize: 14, border: "1px dashed var(--line)", borderRadius: 14 }}>
        You haven&apos;t messaged any sellers yet. Open <b style={{ color: "var(--foreground)" }}>Browse market</b>, find a part, and hit &ldquo;Message seller&rdquo; — your conversations show up here.
      </div>
    );
  }

  const waNumber = t?.phone?.replace(/[^0-9]/g, "");
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null;

  return (
    <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "100%", minHeight: 380, border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface)", maxWidth: 1180 }} className="cs-chat">
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", minWidth: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Inbox size={16} color="var(--muted)" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Sellers you messaged</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9 }}>
            <Search size={14} color="var(--muted)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, padding: "8px 0" }} />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {visible.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>No conversations match.</div>}
          {visible.map((th) => {
            const on = th.id === (t?.id || "");
            return (
              <button key={th.id} onClick={() => setActiveId(th.id)} style={{ width: "100%", display: "flex", gap: 11, padding: "12px 14px", border: "none", borderBottom: "1px solid var(--line)", alignItems: "flex-start", background: on ? "var(--surface2)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0, border: "1px solid var(--line)" }}>
                  <Store size={17} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.shopName}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{th.time}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600, margin: "1px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.part}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.lastText}</span>
                    {(th.unread || 0) > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 999, minWidth: 17, height: 17, display: "grid", placeItems: "center", padding: "0 5px", flexShrink: 0 }}>{th.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {!t ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 14 }}>Select a conversation</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 999, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0, border: "1px solid var(--line)" }}>
              <Store size={17} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {t.shopId ? <a href={`/shop/${t.shopId}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{t.shopName}</a> : t.shopName}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.part}</div>
            </div>
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" title="Message on WhatsApp" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, background: "#25D366", color: "#fff", fontSize: 12.5, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
            <button onClick={() => deleteThread(t.id)} title="Delete conversation" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Trash2 size={14} />
            </button>
            <button onClick={() => setActiveId(null)} title="Close conversation" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12, background: "var(--background)" }}>
            {t.messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.45, background: m.from === "me" ? "var(--accent)" : "var(--surface2)", color: m.from === "me" ? "#fff" : "var(--foreground)", borderBottomRightRadius: m.from === "me" ? 4 : 14, borderBottomLeftRadius: m.from === "me" ? 14 : 4 }}>
                  {m.text}
                  <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{m.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderTop: "1px solid var(--line)" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${t.shopName}…`}
              style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "11px 14px", color: "var(--foreground)", fontSize: 13.5, outline: "none" }}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            <button disabled={sending || !draft.trim()} onClick={send} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: sending || !draft.trim() ? 0.6 : 1 }}><Send size={15} /> Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
