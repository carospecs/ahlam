"use client";

import React from "react";
import {
  Sparkles, ArrowUp, Plus, FolderPlus, Folder, FolderOpen,
  MessageSquare, Trash2, Pencil, CornerUpLeft,
} from "lucide-react";

const STORE_KEY = "cs_assistant_v2";
const GREETING = "Hi — I'm your Ahlam assistant. Ask me about used-part pricing, fitment, VINs, or drafting a listing. I answer in English, and switch to your language if you write a full sentence in it.";
const SUGGESTIONS = [
  "What's a fair price for a used alternator?",
  "Which parts sell fastest?",
  "Write a Facebook listing for a starter motor",
];

type Msg = { from: "me" | "ai"; text: string; typing?: boolean };
type Chat = { id: string; projectId: string | null; title: string; autoTitle: boolean; msgs: Msg[]; createdAt: number; lastOpened: number };
type Project = { id: string; name: string };
type Store = { projects: Project[]; chats: Chat[]; activeId: string | null };

function uid() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function newChat(projectId: string | null = null): Chat {
  const now = Date.now();
  return { id: uid(), projectId, title: "New chat", autoTitle: true, msgs: [{ from: "ai", text: GREETING }], createdAt: now, lastOpened: now };
}

export function AIChat(_: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const [store, setStore] = React.useState<Store>({ projects: [], chats: [], activeId: null });
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [renameVal, setRenameVal] = React.useState("");
  const [dialog, setDialog] = React.useState<{ mode: "create" | "rename"; id?: string; value: string; error: string } | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | "all" | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const loaded = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Store;
        if (parsed.chats?.length) {
          // Backfill lastOpened for older saved data.
          parsed.chats.forEach((c) => { if (!c.lastOpened) c.lastOpened = c.createdAt || Date.now(); if (c.autoTitle === undefined) c.autoTitle = c.title === "New chat"; });
          setStore({ ...parsed, activeId: parsed.activeId && parsed.chats.some((c) => c.id === parsed.activeId) ? parsed.activeId : parsed.chats[0].id });
          loaded.current = true;
          return;
        }
      }
    } catch {}
    const c = newChat();
    setStore({ projects: [], chats: [c], activeId: c.id });
    loaded.current = true;
  }, []);

  React.useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
  }, [store]);

  const active = store.chats.find((c) => c.id === store.activeId) || null;
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.msgs]);

  function openChat(id: string) {
    setStore((s) => ({ ...s, activeId: id, chats: s.chats.map((c) => c.id === id ? { ...c, lastOpened: Date.now() } : c) }));
  }
  function createChat(projectId: string | null = null) {
    const c = newChat(projectId);
    setStore((s) => ({ ...s, chats: [c, ...s.chats], activeId: c.id }));
    if (projectId) setOpen((o) => ({ ...o, [projectId]: true }));
  }
  function nameTaken(name: string, exceptId?: string) {
    return store.projects.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase() && p.id !== exceptId);
  }
  function submitDialog() {
    if (!dialog) return;
    const name = dialog.value.trim();
    if (!name) { setDialog({ ...dialog, error: "Please enter a project name." }); return; }
    if (nameTaken(name, dialog.id)) { setDialog({ ...dialog, error: `A project named “${name}” already exists. Choose a different name.` }); return; }
    if (dialog.mode === "create") {
      const p = { id: uid(), name };
      setStore((s) => ({ ...s, projects: [p, ...s.projects] }));
      setOpen((o) => ({ ...o, [p.id]: true }));
    } else if (dialog.id) {
      const id = dialog.id;
      setStore((s) => ({ ...s, projects: s.projects.map((p) => p.id === id ? { ...p, name } : p) }));
    }
    setDialog(null);
  }
  function deleteChat(id: string) {
    setStore((s) => {
      const chats = s.chats.filter((c) => c.id !== id);
      const activeId = s.activeId === id ? (chats[0]?.id ?? null) : s.activeId;
      return chats.length ? { ...s, chats, activeId } : { ...s, chats: [newChat()], activeId: null };
    });
  }
  function deleteProject(id: string) {
    if (!window.confirm("Delete this project? Its chats move back to All chats.")) return;
    setStore((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id), chats: s.chats.map((c) => c.projectId === id ? { ...c, projectId: null } : c) }));
  }
  function commitRename(id: string, kind: "chat" | "project") {
    const v = renameVal.trim();
    setRenaming(null);
    if (!v) return;
    setStore((s) => kind === "chat"
      ? { ...s, chats: s.chats.map((c) => c.id === id ? { ...c, title: v, autoTitle: false } : c) }
      : { ...s, projects: s.projects.map((p) => p.id === id ? { ...p, name: v } : p) });
  }
  function moveChat(chatId: string, projectId: string | null) {
    setStore((s) => ({ ...s, chats: s.chats.map((c) => c.id === chatId ? { ...c, projectId } : c) }));
    if (projectId) setOpen((o) => ({ ...o, [projectId]: true }));
  }
  function onDrop(projectId: string | null) {
    if (dragId) moveChat(dragId, projectId);
    setDragId(null); setDropTarget(null);
  }

  async function send(text?: string) {
    const t = (text || draft).trim();
    if (!t || busy || !active) return;
    setDraft(""); setBusy(true);

    const chatId = active.id;
    const shouldTitle = active.autoTitle;
    const history = active.msgs.filter((m) => !m.typing && m.text !== GREETING).map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: m.text }));
    history.push({ role: "user", content: t });
    const isFirst = active.msgs.filter((m) => m.from === "me").length === 0;

    setStore((s) => ({ ...s, chats: s.chats.map((c) => c.id === chatId ? {
      ...c, title: isFirst && c.autoTitle ? `${t.slice(0, 36)}…` : c.title, lastOpened: Date.now(),
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
    setStore((s) => ({ ...s, chats: s.chats.map((c) => c.id === chatId ? { ...c, msgs: c.msgs.filter((m) => !m.typing).concat({ from: "ai", text: reply }) } : c) }));
    setBusy(false);

    // Auto-title: summarize the whole conversation (until the user renames it).
    if (shouldTitle) {
      const convo = [...history, { role: "assistant", content: reply }];
      fetch("/api/assistant/title", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: convo }) })
        .then((r) => r.json())
        .then((d) => { if (d.title) setStore((s) => ({ ...s, chats: s.chats.map((c) => c.id === chatId && c.autoTitle ? { ...c, title: d.title } : c) })); })
        .catch(() => {});
    }
  }

  // All chats: no manual order — most recently opened first.
  const ungrouped = store.chats.filter((c) => !c.projectId).sort((a, b) => b.lastOpened - a.lastOpened);

  const rowProps = (c: Chat) => ({
    c, active: c.id === store.activeId,
    onClick: () => openChat(c.id),
    onDelete: () => deleteChat(c.id),
    renaming: renaming === c.id, renameVal, setRenameVal,
    startRename: () => { setRenaming(c.id); setRenameVal(c.title); },
    commitRename: () => commitRename(c.id, "chat"),
    onDragStart: () => setDragId(c.id),
    onDragEnd: () => { setDragId(null); setDropTarget(null); },
  });

  return (
    <div style={sx.wrap}>
      <aside style={sx.side}>
        <div style={{ display: "grid", gap: 8 }}>
          <button className="cs-raise" style={sx.newChat} onClick={() => createChat(null)}><Plus size={16} /> New chat</button>
          <button className="cs-raise" style={sx.newProject} onClick={() => setDialog({ mode: "create", value: "", error: "" })}><FolderPlus size={15} /> New project</button>
        </div>

        <div style={sx.scroll}>
          {store.projects.length > 0 && <div style={sx.sectionLabel}>Projects</div>}
          {store.projects.map((p) => {
            const kids = store.chats.filter((c) => c.projectId === p.id).sort((a, b) => b.lastOpened - a.lastOpened);
            const isOpen = open[p.id];
            const isTarget = dropTarget === p.id;
            return (
              <div
                key={p.id}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setDropTarget(p.id); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget((t) => t === p.id ? null : t); }}
                onDrop={(e) => { e.preventDefault(); onDrop(p.id); }}
                style={{ marginBottom: 2, borderRadius: 8, border: isTarget ? "1px dashed var(--accent)" : "1px solid transparent", background: isTarget ? "rgba(220,38,38,0.06)" : "transparent" }}
              >
                <div className="cs-hover-row" style={sx.projRow}>
                  <button style={sx.projBtn} onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}>
                    {isOpen ? <FolderOpen size={15} color="var(--accent)" /> : <Folder size={15} color="var(--muted)" />}
                    <span style={sx.projName}>{p.name}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{kids.length}</span>
                  </button>
                  <button className="cs-icon-btn" style={sx.rowIcon} title="New chat in project" onClick={() => createChat(p.id)}><Plus size={13} color="var(--muted)" /></button>
                  <button className="cs-icon-btn" style={sx.rowIcon} title="Rename project" onClick={() => setDialog({ mode: "rename", id: p.id, value: p.name, error: "" })}><Pencil size={12} color="var(--muted)" /></button>
                  <button className="cs-icon-btn" style={sx.rowIcon} title="Delete project" onClick={() => deleteProject(p.id)}><Trash2 size={12} color="var(--muted)" /></button>
                </div>
                {isOpen && kids.map((c) => (
                  <ChatRow key={c.id} {...rowProps(c)} indent inProject
                    onRemoveFromProject={() => moveChat(c.id, null)} />
                ))}
                {isOpen && kids.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "4px 0 6px 30px" }}>Drop a chat here, or add one with +</div>}
              </div>
            );
          })}

          <div
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setDropTarget("all"); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget((t) => t === "all" ? null : t); }}
            onDrop={(e) => { e.preventDefault(); onDrop(null); }}
            style={{ borderRadius: 8, border: dropTarget === "all" ? "1px dashed var(--accent)" : "1px solid transparent", background: dropTarget === "all" ? "rgba(220,38,38,0.06)" : "transparent", paddingBottom: 6 }}
          >
            <div style={sx.sectionLabel}>{store.projects.length > 0 ? "All chats" : "Chats"} <span style={{ textTransform: "none", fontWeight: 500, opacity: 0.7 }}>· recent first</span></div>
            {ungrouped.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "4px 8px" }}>Drop a chat here to remove it from its project</div>}
            {ungrouped.map((c) => <ChatRow key={c.id} {...rowProps(c)} />)}
          </div>
        </div>
      </aside>

      <div style={sx.panel}>
        <div style={sx.head}>
          <div style={sx.headIcon}><Sparkles size={18} color="var(--accent)" /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{active?.title && active.title !== "New chat" ? active.title : "Ahlam Assistant"}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Cars & parts only · English + your language</div>
          </div>
        </div>

        <div style={sx.msgs}>
          {active?.msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
              {m.from === "ai" && <div style={sx.aiAvatar}><Sparkles size={14} color="var(--accent)" /></div>}
              <div style={{ maxWidth: "76%", padding: "11px 15px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", background: m.from === "me" ? "var(--accent)" : "var(--surface2)", color: m.from === "me" ? "#fff" : "var(--foreground)", borderBottomRightRadius: m.from === "me" ? 4 : 14, borderBottomLeftRadius: m.from === "me" ? 14 : 4 }}>
                {m.typing ? <span style={{ color: "var(--muted)" }}>Thinking…</span> : m.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {active && active.msgs.filter((m) => m.from === "me").length === 0 && (
          <div style={{ display: "flex", gap: 8, padding: "0 18px 12px", flexWrap: "wrap" }}>
            {SUGGESTIONS.map((s) => <button key={s} className="cs-raise" onClick={() => send(s)} style={sx.suggestion}>{s}</button>)}
          </div>
        )}

        <div style={sx.inputRow}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about pricing, fitment, or a listing…" style={sx.input} />
          <button className="cs-raise" onClick={() => send()} disabled={busy} style={{ ...sx.sendBtn, opacity: busy ? 0.6 : 1 }}><ArrowUp size={18} color="#fff" /></button>
        </div>
      </div>

      {dialog && (
        <div style={sx.dlgOverlay} onMouseDown={() => setDialog(null)}>
          <div style={sx.dlg} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{dialog.mode === "create" ? "New project" : "Rename project"}</div>
            <input
              autoFocus value={dialog.value}
              onChange={(e) => setDialog({ ...dialog, value: e.target.value, error: "" })}
              onKeyDown={(e) => { if (e.key === "Enter") submitDialog(); if (e.key === "Escape") setDialog(null); }}
              placeholder="e.g. F-150 parts"
              style={{ ...sx.input, border: `1px solid ${dialog.error ? "var(--danger)" : "var(--line)"}` }}
            />
            {dialog.error && <div style={{ fontSize: 12.5, color: "var(--danger)", lineHeight: 1.4 }}>{dialog.error}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
              <button className="cs-raise" style={sx.dlgCancel} onClick={() => setDialog(null)}>Cancel</button>
              <button className="cs-raise" style={sx.dlgOk} onClick={submitDialog}>{dialog.mode === "create" ? "Create project" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatRow({ c, active, onClick, onDelete, indent, inProject, renaming, renameVal, setRenameVal, startRename, commitRename, onRemoveFromProject, onDragStart, onDragEnd }: {
  c: Chat; active: boolean; onClick: () => void; onDelete: () => void; indent?: boolean; inProject?: boolean;
  renaming: boolean; renameVal: string; setRenameVal: (v: string) => void; startRename: () => void; commitRename: () => void;
  onRemoveFromProject?: () => void; onDragStart: () => void; onDragEnd: () => void;
}) {
  return (
    <div
      className={"cs-chat-row" + (active ? " on" : "")}
      draggable={!renaming}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      style={{ ...sx.chatRow, ...(active ? sx.chatRowOn : {}), paddingLeft: indent ? 30 : 10 }}
      onClick={onClick}
    >
      <MessageSquare size={14} color={active ? "var(--foreground)" : "var(--muted)"} style={{ flexShrink: 0 }} />
      {renaming ? (
        <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onBlur={commitRename} onKeyDown={(e) => e.key === "Enter" && commitRename()} style={sx.renameInput} onClick={(e) => e.stopPropagation()} />
      ) : (
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: active ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
      )}
      <span className="cs-chat-actions" style={sx.chatActions}>
        {inProject && onRemoveFromProject && (
          <button className="cs-icon-btn" style={sx.rowIcon} title="Remove from project (back to All chats)" onClick={(e) => { e.stopPropagation(); onRemoveFromProject(); }}><CornerUpLeft size={12} color="var(--muted)" /></button>
        )}
        <button className="cs-icon-btn" style={sx.rowIcon} title="Rename" onClick={(e) => { e.stopPropagation(); startRename(); }}><Pencil size={12} color="var(--muted)" /></button>
        <button className="cs-icon-btn" style={sx.rowIcon} title="Delete chat" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={12} color="var(--muted)" /></button>
      </span>
    </div>
  );
}

const sx: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", gap: 14, height: "calc(100vh - 74px - 56px)", minHeight: 480 },
  side: { width: 252, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: 12, overflow: "hidden" },
  newChat: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  newProject: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  scroll: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 },
  sectionLabel: { fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "12px 8px 4px" },
  projRow: { display: "flex", alignItems: "center", gap: 2, borderRadius: 8 },
  projBtn: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", borderRadius: 8, border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  projName: { flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", color: "var(--muted)" },
  chatRowOn: { background: "var(--surface2)", color: "var(--foreground)" },
  chatActions: { display: "flex", alignItems: "center", gap: 1, flexShrink: 0 },
  rowIcon: { width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 },
  renameInput: { flex: 1, minWidth: 0, border: "1px solid var(--accent)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13, padding: "3px 6px", borderRadius: 6 },
  panel: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  head: { display: "flex", alignItems: "center", gap: 11, padding: "14px 18px", borderBottom: "1px solid var(--line)" },
  headIcon: { width: 36, height: 36, borderRadius: 10, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center" },
  msgs: { flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 },
  aiAvatar: { width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center", flexShrink: 0 },
  suggestion: { padding: "9px 14px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 12.5, fontWeight: 500, textAlign: "left", cursor: "pointer" },
  inputRow: { display: "flex", alignItems: "center", gap: 10, padding: 14, borderTop: "1px solid var(--line)" },
  input: { flex: 1, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", color: "var(--foreground)", fontSize: 14, outline: "none" },
  sendBtn: { width: 42, height: 42, borderRadius: 11, border: "none", background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0, cursor: "pointer" },
  dlgOverlay: { position: "fixed", inset: 0, zIndex: 160, background: "rgba(7,11,22,0.72)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 },
  dlg: { width: "min(420px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 20, display: "grid", gap: 12, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" },
  dlgCancel: { padding: "9px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  dlgOk: { padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
};
