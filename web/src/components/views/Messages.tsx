"use client";

import React from "react";
import { Inbox, ExternalLink, Paperclip, Send, X, Gauge, Search } from "lucide-react";
import { MarketChip } from "../UI";
import { useData, csToast } from "../Dashboard";

function reloadData(): Promise<any> { return (window as any).csReloadData?.() ?? Promise.resolve(); }

interface Attachment { name: string; mileage?: boolean }
interface LocalMsg { from: string; text: string; time: string; attachments?: Attachment[] }

// A buyer is asking about the whole car (so mileage is relevant) when their
// messages mention the car / mileage rather than a specific part.
function asksAboutCar(messages: any[]): boolean {
  return messages.some((m) => m.from !== "me" && /(whole car|the car\b|the vehicle\b|mileage|miles\b|odometer|how many miles)/i.test(m.text));
}

export function Messages({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { threads } = useData();
  const [activeId, setActiveId] = React.useState<string>("");
  const [draft, setDraft] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [localMsgs, setLocalMsgs] = React.useState<Record<string, LocalMsg[]>>({});
  const [dismissed, setDismissed] = React.useState<Record<string, boolean>>({});
  const [query, setQuery] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (!activeId && threads.length) setActiveId(threads[0].id); }, [threads, activeId]);
  // Reset the composer when switching conversations.
  React.useEffect(() => { setDraft(""); setAttachments([]); }, [activeId]);

  // Near-real-time: refresh inbox while this view is open (no WebSocket infra yet).
  React.useEffect(() => {
    const iv = setInterval(() => { reloadData(); }, 20000);
    return () => clearInterval(iv);
  }, []);

  // Mark a conversation read on open so the unread badge reflects reality.
  const totalUnread = threads.reduce((s: number, th: any) => s + (th.unread || 0), 0);
  React.useEffect(() => {
    const th = threads.find((x: any) => x.id === activeId);
    if (th && th.unread > 0) {
      fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeId }) })
        .then(() => reloadData())
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (!threads.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No conversations yet.</div>;

  const ql = query.trim().toLowerCase();
  const visibleThreads = threads.filter((th: any) => {
    if (!ql) return true;
    const last = th.messages[th.messages.length - 1];
    return `${th.name} ${th.part} ${last?.text || ""}`.toLowerCase().includes(ql);
  });

  const t = threads.find((x: any) => x.id === activeId) || threads[0];
  const msgs: LocalMsg[] = [...t.messages, ...(localMsgs[t.id] || [])];
  const hasMileageAttached = attachments.some((a) => a.mileage);
  const showMileageSuggestion = asksAboutCar(msgs) && !dismissed[t.id] && !hasMileageAttached;

  function addFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files.map((f) => ({ name: f.name }))]);
  }
  function attachMileage() {
    // Attach the private dashboard/mileage photo to the draft — does NOT send it.
    setAttachments((prev) => [...prev, { name: "Dashboard — mileage", mileage: true }]);
    csToast("Mileage photo attached — review, then send when ready");
  }
  function removeAttachment(i: number) { setAttachments((prev) => prev.filter((_, idx) => idx !== i)); }
  async function send() {
    if (sending || (!draft.trim() && !attachments.length)) return;
    const conv = t.id;
    const text = draft.trim();
    const atts = attachments;
    // Optimistic: show it instantly, then persist.
    setLocalMsgs((prev) => ({ ...prev, [conv]: [...(prev[conv] || []), { from: "me", text, time: "Now", attachments: atts }] }));
    setDraft(""); setAttachments([]);
    if (!text) return; // attachment-only (e.g. mileage photo) isn't persisted server-side yet
    setSending(true);
    try {
      const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: conv, body: text }) });
      if (!r.ok) { csToast("Couldn't send — kept locally"); setSending(false); return; }
      // Reload brings the persisted message; drop the optimistic copy to avoid a dupe.
      await reloadData();
      setLocalMsgs((prev) => { const n = { ...prev }; delete n[conv]; return n; });
    } catch {
      csToast("Couldn't send — check your connection");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "calc(100vh - 74px - 56px)", minHeight: 480, border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface)", maxWidth: 1180 }} className="cs-chat">
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", minWidth: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Inbox size={16} color="var(--muted)" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Inbox</span>
            {totalUnread > 0 && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "rgba(220,38,38,0.14)", borderRadius: 999, padding: "2px 9px" }}>{totalUnread} new</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9 }}>
            <Search size={14} color="var(--muted)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, padding: "8px 0" }} />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {visibleThreads.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>No conversations match “{query}”.</div>}
          {visibleThreads.map((th: any) => {
            const on = th.id === activeId;
            const last = th.messages[th.messages.length - 1];
            return (
              <button key={th.id} onClick={() => setActiveId(th.id)} style={{ display: "flex", gap: 11, padding: "12px 14px", border: "none", borderBottom: "1px solid var(--line)", width: "100%", alignItems: "flex-start", background: on ? "var(--surface2)" : "transparent" }}>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "var(--foreground)", flexShrink: 0, border: "1px solid var(--line)" }}>{th.avatar}</div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{th.name}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{th.time}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600, margin: "1px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.part}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last.from === "me" ? "You: " : ""}{last.text}</span>
                    {th.unread > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 999, minWidth: 17, height: 17, display: "grid", placeItems: "center", padding: "0 5px", flexShrink: 0 }}>{th.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "var(--foreground)", flexShrink: 0, border: "1px solid var(--line)" }}>{t.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <MarketChip name={t.market} /> {t.part}
            </div>
          </div>
          <button style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}><ExternalLink size={16} color="var(--muted)" /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12, background: "rgba(15,23,42,0.4)" }}>
          {msgs.map((m: LocalMsg, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.45, background: m.from === "me" ? "var(--accent)" : "var(--surface2)", color: "#fff", borderBottomRightRadius: m.from === "me" ? 4 : 14, borderBottomLeftRadius: m.from === "me" ? 14 : 4 }}>
                {m.text}
                {m.attachments?.map((a, ai) => (
                  <div key={ai} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: m.text ? 8 : 0, padding: "7px 10px", borderRadius: 9, background: "rgba(255,255,255,0.16)", fontSize: 12.5, fontWeight: 600 }}>
                    {a.mileage ? <Gauge size={14} /> : <Paperclip size={14} />} {a.name}
                  </div>
                ))}
                <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Private mileage suggestion — small corner prompt, only for whole-car inquiries */}
        {showMileageSuggestion && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: "1px solid var(--line)", background: "var(--signal-bg)" }}>
            <Gauge size={15} color="var(--signal)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--foreground)" }}>Buyer's asking about the car — share the mileage photo? <span style={{ color: "var(--muted)" }}>(kept private otherwise)</span></span>
            <button onClick={attachMileage} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 600 }}>Yes</button>
            <button onClick={() => setDismissed((p) => ({ ...p, [t.id]: true }))} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>No</button>
          </div>
        )}

        {/* Pending attachments — attached to the draft, not yet sent */}
        {attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 14px 0" }}>
            {attachments.map((a, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--line)", fontSize: 12, fontWeight: 600 }}>
                {a.mileage ? <Gauge size={13} color="var(--signal)" /> : <Paperclip size={13} color="var(--muted)" />} {a.name}
                <button onClick={() => removeAttachment(i)} style={{ border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}><X size={13} color="var(--muted)" /></button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderTop: "1px solid var(--line)" }}>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} title="Attach files" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}><Paperclip size={17} color="var(--muted)" /></button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a reply…" style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "10px 14px", color: "var(--foreground)", fontSize: 13.5, outline: "none" }} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
          <button disabled={sending} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, opacity: sending ? 0.7 : 1 }} onClick={send}><Send size={15} /> Send</button>
        </div>
      </div>
    </div>
  );
}
