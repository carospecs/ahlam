"use client";

import React from "react";
import { Inbox, ExternalLink, Paperclip, Send, X, Gauge, Search, CircleDot, Handshake, Ban, Check, LoaderCircle, Trash2, Share2, Tag, Globe, Store, Undo2, History } from "lucide-react";

// Conversation lifecycle: open = still chatting, dealt = a deal was made,
// closed = ended with no deal.
const STATUS_META = {
  open: { label: "Open", color: "var(--accent)", Icon: CircleDot },
  dealt: { label: "Deal", color: "var(--success)", Icon: Handshake },
  closed: { label: "Closed", color: "var(--muted)", Icon: Ban },
} as const;
type ConvStatus = keyof typeof STATUS_META;
import { MarketChip } from "../UI";
import { useData, csToast } from "../Dashboard";
import { BuyerMessages } from "./BuyerMessages";

const DELETED_KEY = "ahlam_deleted_chats";
function loadDeleted(): Map<string, number> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (raw) return new Map(JSON.parse(raw));
  } catch {}
  return new Map();
}
function saveDeleted(m: Map<string, number>) {
  localStorage.setItem(DELETED_KEY, JSON.stringify([...m.entries()]));
}
const PERMA_DELETED_KEY = "ahlam_permadeleted_chats";
function loadPermaDeleted(): Set<string> {
  try {
    const raw = localStorage.getItem(PERMA_DELETED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}
function savePermaDeleted(s: Set<string>) {
  localStorage.setItem(PERMA_DELETED_KEY, JSON.stringify([...s]));
}

function reloadData(): Promise<any> { return (window as any).csReloadData?.() ?? Promise.resolve(); }

interface Attachment { name: string; mileage?: boolean }
interface LocalMsg { from: string; text: string; time: string; attachments?: Attachment[] }

// A buyer is asking about the whole car (so mileage is relevant) when their
// messages mention the car / mileage rather than a specific part.
function asksAboutCar(messages: any[]): boolean {
  return messages.some((m) => m.from !== "me" && /(whole car|the car\b|the vehicle\b|mileage|miles\b|odometer|how many miles)/i.test(m.text));
}

// The most recent message the buyer (not "me") sent — used to pick quick replies.
function lastBuyerText(messages: LocalMsg[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from !== "me") return messages[i].text;
  return "";
}

// Saved replies for the questions yards get over and over ("is this still
// available?", "will it fit?", "what's your best price?"). One tap drops the
// reply into the composer to review and send — no typing the same thing 20x/day.
// Ordered so whatever the buyer just asked surfaces first, then sensible defaults.
function quickReplies(part: string, messages: LocalMsg[]): { id: string; label: string; text: string }[] {
  const p = part || "part";
  const last = lastBuyerText(messages).toLowerCase();
  const all = [
    { id: "avail", label: "Still available", text: `Yes — the ${p} is still available. Want to come take a look, or should I set it aside for you?`, match: /still|available|you have|in stock|sold|gone|left/ },
    { id: "fit", label: "Confirm fitment", text: `Happy to check fitment — what's the year, make, and model of your vehicle? The VIN is even better if you have it.`, match: /fit|work on|compatible|my car|my vehicle|vin|year|model|will it/ },
    { id: "offer", label: "Respond to offer", text: `Thanks for the offer! The lowest I can do on the ${p} is $___ . Let me know and I'll hold it for you.`, match: /price|how much|offer|lowest|best|deal|\$|negotiat|cheaper|discount/ },
    { id: "pickup", label: "Pickup & hours", text: `You're welcome to pick it up — we're open ___ . I'll have the ${p} pulled and ready when you get here.`, match: /pick ?up|where|located|location|address|come get|hours|open|directions/ },
    { id: "ship", label: "Shipping", text: `I can ship the ${p} — send me your ZIP code and I'll get you an exact shipping quote.`, match: /ship|deliver|mail|send it|postage/ },
  ];
  const matched = all.filter((r) => r.match.test(last));
  const defaults = all.filter((r) => r.id === "avail" || r.id === "fit");
  return [...matched, ...defaults]
    .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
    .slice(0, 4)
    .map(({ id, label, text }) => ({ id, label, text }));
}

export function Messages({ go, onVehicle, showDeleted }: { go: (id: string) => void; onVehicle?: (v: any) => void; showDeleted?: boolean }) {
  const { threads } = useData();
  const [activeId, setActiveId] = React.useState<string>("");
  const [draft, setDraft] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [localMsgs, setLocalMsgs] = React.useState<Record<string, LocalMsg[]>>({});
  const [dismissed, setDismissed] = React.useState<Record<string, boolean>>({});
  const [query, setQuery] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<"all" | ConvStatus>("all");
  const [localStatus, setLocalStatus] = React.useState<Record<string, ConvStatus>>({});
  // The status the user has *picked* for the open conversation but not saved yet.
  const [pendingStatus, setPendingStatus] = React.useState<ConvStatus | null>(null);
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [deleted, setDeleted] = React.useState<Map<string, number>>(loadDeleted);
  const [permaDeleted] = React.useState<Set<string>>(loadPermaDeleted);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { saveDeleted(deleted); }, [deleted]);

  const marketMeta: Record<string, { icon: typeof Share2; color: string }> = {
    Ahlam: { icon: Store, color: "var(--accent)" },
    Facebook: { icon: Share2, color: "#1877f2" },
    OfferUp: { icon: Tag, color: "var(--accent)" },
    Craigslist: { icon: Globe, color: "var(--success)" },
  };

  const statusOf = (th: any): ConvStatus => localStatus[th.id] ?? (th.status as ConvStatus) ?? "open";

  async function saveStatus(conversationId: string, status: ConvStatus) {
    const prev = localStatus[conversationId];
    setSavingStatus(true);
    setLocalStatus((s) => ({ ...s, [conversationId]: status }));   // optimistic
    try {
      const r = await fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, status }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setLocalStatus((s) => ({ ...s, [conversationId]: prev ?? "open" }));   // revert
        csToast(d.needsMigration ? "Apply migration 0014 to save conversation status" : "Couldn't save status");
        return;
      }
      setPendingStatus(null);
      csToast(`Saved — marked ${STATUS_META[status].label.toLowerCase()}`);
      reloadData();
    } catch {
      setLocalStatus((s) => ({ ...s, [conversationId]: prev ?? "open" }));
      csToast("Couldn't save status");
    } finally {
      setSavingStatus(false);
    }
  }

  React.useEffect(() => { if (!activeId && threads.length) setActiveId(threads[0].id); }, [threads, activeId]);
  // Auto-clean deleted conversations older than 30 days.
  React.useEffect(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    setDeleted((p) => {
      const n = new Map(p); let changed = false;
      for (const [id, ts] of n) { if (ts < cutoff) { n.delete(id); changed = true; } }
      return changed ? n : p;
    });
  }, []);
  // Reset the composer + any unsaved status pick when switching conversations.
  React.useEffect(() => { setDraft(""); setAttachments([]); setPendingStatus(null); }, [activeId]);

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

  if (!threads.length && !deleted.size) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No conversations yet.</div>;

  const ql = query.trim().toLowerCase();
  const statusCounts = { all: threads.length, open: 0, dealt: 0, closed: 0 } as Record<string, number>;
  threads.forEach((th: any) => { statusCounts[statusOf(th)]++; });
  const visibleThreads = threads.filter((th: any) => {
    if (permaDeleted.has(th.id)) return false;
    if (statusFilter !== "all" && statusOf(th) !== statusFilter) return false;
    if (!ql) return true;
    const last = th.messages[th.messages.length - 1];
    return `${th.name} ${th.part} ${last?.text || ""}`.toLowerCase().includes(ql);
  });

  const deletedThreads = threads.filter((th: any) => deleted.has(th.id) && !permaDeleted.has(th.id));
  const visibleThreads2 = showDeleted ? deletedThreads : visibleThreads.filter((th: any) => !deleted.has(th.id));
  const t = visibleThreads2.find((x: any) => x.id === activeId) || visibleThreads2[0] || null;
  const msgs: LocalMsg[] = t ? [...t.messages, ...(localMsgs[t.id] || [])] : [];
  const hasMileageAttached = attachments.some((a) => a.mileage);
  const showMileageSuggestion = t ? asksAboutCar(msgs) && !dismissed[t.id] && !hasMileageAttached : false;
  // Offer quick replies whenever the buyer sent the last message (i.e. it's the
  // seller's turn) and the composer is empty, so they don't overwrite a draft.
  const awaitingReply = !!t && msgs.length > 0 && msgs[msgs.length - 1].from !== "me";
  const replies = t && awaitingReply && !draft.trim() ? quickReplies(t.part, msgs) : [];

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
            {totalUnread > 0 && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "2px 9px" }}>{totalUnread} new</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9 }}>
            <Search size={14} color="var(--muted)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, padding: "8px 0" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "open", "dealt", "closed"] as const).map((f) => {
              const on = statusFilter === f;
              return (
                <button key={f} onClick={() => setStatusFilter(f)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`, background: on ? "var(--accent-tint)" : "transparent", color: on ? "var(--accent)" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {f === "all" ? "All" : STATUS_META[f].label} <span style={{ opacity: 0.7 }}>{statusCounts[f]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {visibleThreads2.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{
            query ? `No conversations match “${query}”.` : statusFilter === "all" ? "No conversations." : `No ${STATUS_META[statusFilter as ConvStatus].label.toLowerCase()} conversations.`
          }</div>}
          {visibleThreads2.map((th: any) => {
            const on = th.id === activeId;
            const last = th.messages[th.messages.length - 1];
            const m = marketMeta[th.market] || null;
            return (
              <div key={th.id} style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)" }}>
                <button onClick={() => setActiveId(th.id)} style={{ flex: 1, minWidth: 0, display: "flex", gap: 11, padding: "12px 14px", border: "none", alignItems: "flex-start", background: on ? "var(--surface2)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                  {(() => { const IconComp = m?.icon; return (
                  <div style={{ width: 38, height: 38, borderRadius: 999, background: m ? `${m.color}18` : "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "1px solid var(--line)" }}>
                    {IconComp ? <IconComp size={17} color={m!.color} /> : <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{th.avatar}</span>}
                  </div>
                  ); })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          {(() => { const st = statusOf(th); const M = STATUS_META[st]; return <M.Icon size={12} color={M.color} style={{ flexShrink: 0 }} />; })()}
                          {th.buyerId ? (
                            <a href={`/profile/${th.buyerId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "inherit", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.name}</a>
                          ) : (
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.name}</span>
                          )}
                          {th.isOnline && <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--success)", display: "inline-block", flexShrink: 0 }} />}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{th.time}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600, margin: "1px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.part}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last.from === "me" ? "You: " : ""}{last.text}</span>
                      {th.unread > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 999, minWidth: 17, height: 17, display: "grid", placeItems: "center", padding: "0 5px", flexShrink: 0 }}>{th.unread}</span>}
                    </div>
                  </div>
                </button>
                {showDeleted ? (
                  <button onClick={() => setDeleted((p) => { const n = new Map(p); n.delete(th.id); return n; })} title="Restore conversation" style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><Undo2 size={14} color="var(--accent)" /></button>
                ) : (
                  <button onClick={() => { setDeleted((p) => { const n = new Map(p); n.set(th.id, Date.now()); return n; }); if (activeId === th.id) setActiveId(visibleThreads2.find((x: any) => x.id !== th.id)?.id || ""); }} title="Delete conversation" style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><Trash2 size={13} color="var(--muted)" /></button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!t ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 14 }}>Select a conversation</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--line)" }}>
          {(() => { const m2 = marketMeta[t.market]; const IconComp = m2?.icon; return (
          <div style={{ width: 38, height: 38, borderRadius: 999, background: m2 ? `${m2.color}18` : "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "1px solid var(--line)" }}>
            {IconComp ? <IconComp size={17} color={m2!.color} /> : <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{t.avatar}</span>}
          </div>
          ); })()}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {t.buyerId ? (
                <a href={`/profile/${t.buyerId}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{t.name}</a>
              ) : (
                t.name
              )}
              {t.isOnline && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--success)", display: "inline-block", flexShrink: 0 }} title="Online" />}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <MarketChip name={t.market} /> {t.part}
            </div>
          </div>
          {(() => {
            const saved = statusOf(t);
            const selected = pendingStatus ?? saved;
            const dirty = pendingStatus !== null && pendingStatus !== saved;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} className="cs-hide-mobile">
                <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)" }}>
                  {(["open", "dealt", "closed"] as const).map((s) => {
                    const on = selected === s; const M = STATUS_META[s];
                    return (
                      <button key={s} onClick={() => setPendingStatus(s)} title={`Mark ${M.label}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "none", background: on ? "var(--surface)" : "transparent", color: on ? M.color : "var(--muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
                        <M.Icon size={14} /> {M.label}
                      </button>
                    );
                  })}
                </div>
                {dirty && (
                  <button onClick={() => saveStatus(t.id, pendingStatus!)} disabled={savingStatus}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: savingStatus ? 0.6 : 1 }}>
                    {savingStatus ? <LoaderCircle size={13} className="spin" /> : <Check size={14} />} Save changes
                  </button>
                )}
              </div>
            );
          })()}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12, background: "var(--background)" }}>
          {msgs.map((m: LocalMsg, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.45, background: m.from === "me" ? "var(--accent)" : "var(--surface2)", color: m.from === "me" ? "#fff" : "var(--foreground)", borderBottomRightRadius: m.from === "me" ? 4 : 14, borderBottomLeftRadius: m.from === "me" ? 14 : 4 }}>
                {m.text}
                {m.attachments?.map((a, ai) => (
                  <div key={ai} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: m.text ? 8 : 0, padding: "7px 10px", borderRadius: 9, background: "rgba(255,255,255,0.16)", fontSize: 12.5, fontWeight: 600 }}>
                    {a.mileage ? <Gauge size={14} /> : <Paperclip size={14} />} {a.name}
                  </div>
                ))}
                <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 4, textAlign: "right", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  {m.from === "me" && <Check size={11} color="var(--success)" />}
                  {m.time}
                </div>
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

        {/* Saved quick replies — one tap fills the composer to review and send */}
        {replies.length > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "10px 14px 0", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>Quick reply:</span>
            {replies.map((r) => (
              <button key={r.id} onClick={() => setDraft(r.text)} title={r.text}
                style={{ padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {r.label}
              </button>
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
      )}
    </div>
  );
}

// Messages has two sides: "Selling" (inquiries received about your listings) and
// "Buying" (sellers you've messaged from the marketplace + their replies). The
// toggle lets one inbox cover both without a separate nav item.
export function MessagesHub(props: { go: (id: string) => void; onVehicle?: (v: any) => void; showDeleted?: boolean }) {
  const { threads } = useData();
  const [tab, setTab] = React.useState<"selling" | "buying">("selling");
  const sellingCount = threads.length;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)", width: "fit-content" }}>
        {([["selling", "Selling"], ["buying", "Buying"]] as const).map(([id, label]) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 16px", borderRadius: 8, border: "none", background: on ? "var(--surface)" : "transparent", color: on ? "var(--foreground)" : "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
              {label}
              {id === "selling" && sellingCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: on ? "var(--accent)" : "var(--muted)", opacity: 0.85 }}>{sellingCount}</span>}
            </button>
          );
        })}
      </div>
      {tab === "selling" ? <Messages {...props} /> : <BuyerMessages />}
    </div>
  );
}

export function DeletedChats({ go }: { go: (id: string) => void }) {
  const { threads } = useData();
  const [deleted, setDeleted] = React.useState<Map<string, number>>(loadDeleted);
  const [perma, setPerma] = React.useState<Set<string>>(loadPermaDeleted);

  React.useEffect(() => { saveDeleted(deleted); }, [deleted]);
  React.useEffect(() => { savePermaDeleted(perma); }, [perma]);

  const list = threads.filter((th: any) => deleted.has(th.id) && !perma.has(th.id));

  function recover(id: string) {
    setDeleted((p) => { const n = new Map(p); n.delete(id); return n; });
    csToast("Conversation restored to Inbox");
  }
  function deleteForever(id: string) {
    setDeleted((p) => { const n = new Map(p); n.delete(id); return n; });
    setPerma((p) => { const n = new Set(p); n.add(id); return n; });
    csToast("Conversation permanently deleted");
  }

  if (!list.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>No deleted conversations.</div>;

  return (
    <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 2 }}>
      {list.map((th: any) => (
        <div key={th.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {th.name}
              <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {th.part}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Deleted {new Date(deleted.get(th.id)!).toLocaleDateString()}
            </div>
          </div>
          <button onClick={() => recover(th.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Recover
          </button>
          <button onClick={() => deleteForever(th.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Delete forever
          </button>
        </div>
      ))}
    </div>
  );
}
