"use client";

import React from "react";
import { Sparkles, ArrowUp, X, Plus, MessageSquare, Trash2, ChevronLeft, History } from "lucide-react";

// A slim, persistent right-side assistant drawer. It lives at the app-shell level
// and pushes the dashboard aside (never overlays it on wide screens), so it stays
// open and keeps its history as the user moves between views — a personal live-chat
// assistant rather than a page of its own. Supports multiple chats with a history
// list so the user can look back into past conversations. Backed by /api/assistant.

const STORE_KEY = "cs_assistant_drawer_v2";
const GREETING = "Hi — I'm your Ahlam assistant. Ask me about used-part pricing, fitment, VINs, or drafting a listing.";
const SUGGESTIONS = [
  "Fair price for a used alternator?",
  "Which parts sell fastest?",
  "Write a Facebook listing for a starter motor",
];

type Msg = { from: "me" | "ai"; text: string; typing?: boolean };
type Chat = { id: string; title: string; msgs: Msg[]; updatedAt: number };
type Store = { chats: Chat[]; activeId: string | null };

function uid() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function freshChat(): Chat {
  return { id: uid(), title: "New chat", msgs: [{ from: "ai", text: GREETING }], updatedAt: Date.now() };
}
function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function AssistantDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [store, setStore] = React.useState<Store>({ chats: [], activeId: null });
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const loaded = React.useRef(false);

  // Load persisted chats once.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Store;
        if (parsed.chats?.length) {
          parsed.chats.forEach((c) => { c.msgs = (c.msgs || []).filter((m) => !m.typing); });
          setStore({ chats: parsed.chats, activeId: parsed.chats.some((c) => c.id === parsed.activeId) ? parsed.activeId : parsed.chats[0].id });
          loaded.current = true;
          return;
        }
      }
    } catch {}
    const c = freshChat();
    setStore({ chats: [c], activeId: c.id });
    loaded.current = true;
  }, []);

  React.useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...store, chats: store.chats.map((c) => ({ ...c, msgs: c.msgs.filter((m) => !m.typing) })) })); } catch {}
  }, [store]);

  const active = store.chats.find((c) => c.id === store.activeId) || null;

  React.useEffect(() => { if (open && !showHistory) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.msgs, open, showHistory]);
  React.useEffect(() => { if (open && !showHistory) setTimeout(() => inputRef.current?.focus(), 150); }, [open, showHistory]);

  // Esc: close history first, then the drawer.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (showHistory) setShowHistory(false); else onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, showHistory, onClose]);

  function newChat() {
    const c = freshChat();
    setStore((s) => ({ chats: [c, ...s.chats], activeId: c.id }));
    setShowHistory(false);
    setDraft("");
  }
  function openChat(id: string) {
    setStore((s) => ({ ...s, activeId: id }));
    setShowHistory(false);
  }
  function deleteChat(id: string) {
    setStore((s) => {
      const chats = s.chats.filter((c) => c.id !== id);
      if (!chats.length) { const c = freshChat(); return { chats: [c], activeId: c.id }; }
      return { chats, activeId: s.activeId === id ? chats[0].id : s.activeId };
    });
  }

  async function send(text?: string) {
    const t = (text || draft).trim();
    if (!t || busy || !active) return;
    setDraft(""); setBusy(true);
    const chatId = active.id;

    const history = active.msgs
      .filter((m) => !m.typing && m.text !== GREETING)
      .map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: m.text }));
    history.push({ role: "user", content: t });
    const isFirst = active.msgs.filter((m) => m.from === "me").length === 0;

    setStore((s) => ({ ...s, chats: s.chats.map((c) => c.id === chatId ? {
      ...c,
      title: isFirst ? (t.length > 38 ? `${t.slice(0, 38)}…` : t) : c.title,
      updatedAt: Date.now(),
      msgs: [...c.msgs, { from: "me", text: t }, { from: "ai", text: "", typing: true }],
    } : c) }));

    let reply = "Something went wrong. Try again.";
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) });
      const data = await res.json();
      reply = res.ok ? data.reply : (data.error || reply);
    } catch {
      reply = "Couldn't reach the assistant. Check your connection and try again.";
    }
    setStore((s) => ({ ...s, chats: s.chats.map((c) => c.id === chatId ? { ...c, updatedAt: Date.now(), msgs: c.msgs.filter((m) => !m.typing).concat({ from: "ai", text: reply }) } : c) }));
    setBusy(false);
  }

  const showSuggestions = !!active && active.msgs.filter((m) => m.from === "me").length === 0;
  const recent = [...store.chats].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside style={{ ...sx.drawer, transform: open ? "translateX(0)" : "translateX(105%)" }} aria-hidden={!open}>
      {/* Header */}
      <div style={sx.head}>
        {showHistory ? (
          <button title="Back to chat" onClick={() => setShowHistory(false)} style={sx.headBtn}><ChevronLeft size={18} color="var(--muted)" /></button>
        ) : (
          <div style={sx.headIcon}><Sparkles size={17} color="var(--accent)" /></div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {showHistory ? "Your chats" : "Ahlam Assistant"}
          </div>
          {!showHistory && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Cars & parts · here on every page</div>}
        </div>
        {!showHistory && <button title="Chat history" onClick={() => setShowHistory(true)} style={sx.headBtn}><History size={16} color="var(--muted)" /></button>}
        <button title="New chat" onClick={newChat} style={sx.headBtn}><Plus size={17} color="var(--muted)" /></button>
        <button title="Close" onClick={onClose} style={sx.headBtn}><X size={16} color="var(--muted)" /></button>
      </div>

      {showHistory ? (
        /* History list — look back into past conversations */
        <div style={sx.histList}>
          {recent.map((c) => (
            <div key={c.id} className="cs-hover-row" style={{ ...sx.histRow, ...(c.id === store.activeId ? sx.histRowOn : {}) }} onClick={() => openChat(c.id)}>
              <MessageSquare size={14} color={c.id === store.activeId ? "var(--foreground)" : "var(--muted)"} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: c.id === store.activeId ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{relTime(c.updatedAt)}</div>
              </div>
              <button title="Delete chat" onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }} style={sx.histDel}><Trash2 size={13} color="var(--muted)" /></button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={sx.msgs}>
            {active?.msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
                {m.from === "ai" && <div style={sx.aiAvatar}><Sparkles size={13} color="var(--accent)" /></div>}
                <div style={{ maxWidth: "82%", padding: "10px 13px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", background: m.from === "me" ? "var(--accent)" : "var(--surface2)", color: m.from === "me" ? "#fff" : "var(--foreground)", borderBottomRightRadius: m.from === "me" ? 4 : 13, borderBottomLeftRadius: m.from === "me" ? 13 : 4 }}>
                  {m.typing ? <span style={{ color: "var(--muted)" }}>Thinking…</span> : m.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {showSuggestions && (
            <div style={sx.suggestions}>
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} style={sx.suggestion}>{s}</button>)}
            </div>
          )}

          <div style={sx.inputRow}>
            <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about pricing, fitment, a listing…" style={sx.input} />
            <button onClick={() => send()} disabled={busy} style={{ ...sx.sendBtn, opacity: busy ? 0.6 : 1 }}><ArrowUp size={17} color="#fff" /></button>
          </div>
        </>
      )}
    </aside>
  );
}

const sx: Record<string, React.CSSProperties> = {
  drawer: {
    position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 150,
    width: "min(390px, 100vw)", display: "flex", flexDirection: "column",
    background: "var(--surface)", borderLeft: "1px solid var(--line)",
    boxShadow: "-24px 0 60px -30px rgba(0,0,0,0.6)",
    transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  head: { display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", borderBottom: "1px solid var(--line)" },
  headIcon: { width: 32, height: 32, borderRadius: 9, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 },
  headBtn: { width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 },
  msgs: { flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  aiAvatar: { width: 27, height: 27, borderRadius: 8, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 },
  suggestions: { display: "flex", flexDirection: "column", gap: 7, padding: "0 16px 12px" },
  suggestion: { padding: "9px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 12.5, fontWeight: 500, textAlign: "left", cursor: "pointer" },
  inputRow: { display: "flex", alignItems: "center", gap: 9, padding: 13, borderTop: "1px solid var(--line)" },
  input: { flex: 1, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 11, padding: "11px 14px", color: "var(--foreground)", fontSize: 13.5, outline: "none" },
  sendBtn: { width: 40, height: 40, borderRadius: 10, border: "none", background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0, cursor: "pointer" },
  histList: { flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 2 },
  histRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 9, cursor: "pointer" },
  histRowOn: { background: "var(--surface2)" },
  histDel: { width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 },
};
