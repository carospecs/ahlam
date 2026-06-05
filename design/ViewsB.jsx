// Views B — Listings, Photos, Messages (chat).
const { useState: useStateB } = React;

function PartRowB({ l, last }) {
  const I = window.Icon;
  return (
    <div onClick={() => window.csOpenExport(l)} style={{ ...bx.lrow, cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <window.UI.PhotoCell icon="Wrench" style={{ width: 48, height: 40, flexShrink: 0 }} iconSize={17} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.vehicle} · {l.photos} photos</div>
      </div>
      <span style={{ width: 90 }}><window.UI.ConditionBadge grade={l.grade} size="sm" /></span>
      <span className="tnum" style={{ width: 70, textAlign: "right", fontSize: 14, fontWeight: 700 }}>${l.price}</span>
      <span style={{ width: 180, display: "flex", gap: 5, flexWrap: "wrap" }}>
        {l.markets.length ? l.markets.map((m) => <window.UI.MarketChip key={m} name={m} />) : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
      </span>
      <span className="tnum" style={{ width: 60, textAlign: "right", fontSize: 13, color: "var(--muted)" }}>{l.views || "—"}</span>
      <span style={{ width: 96 }}><window.UI.StatusBadge status={l.status} /></span>
      <button style={bx.iconGhost} onClick={(e) => { e.stopPropagation(); window.csOpenExport(l); }}><I name="EllipsisVertical" size={16} color="var(--muted)" /></button>
    </div>
  );
}

function Listings() {
  const I = window.Icon;
  const [filter, setFilter] = useStateB("All");
  const [group, setGroup] = useStateB("part"); // part | car
  const tabs = ["All", "Draft", "Posted", "Sold"];
  const rows = window.LISTINGS.filter((l) => filter === "All" || l.status === filter);

  const head = (
    <div style={{ ...bx.lrow, ...bx.lhead }}>
      <span style={{ width: 48 }} />
      <span style={{ flex: 1 }}>Part</span>
      <span style={{ width: 90 }}>Condition</span>
      <span style={{ width: 70, textAlign: "right" }}>Price</span>
      <span style={{ width: 180 }}>Marketplaces</span>
      <span style={{ width: 60, textAlign: "right" }}>Views</span>
      <span style={{ width: 96 }}>Status</span>
      <span style={{ width: 36 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: 4 }}>
          {tabs.map((t) => {
            const on = filter === t;
            const count = t === "All" ? window.LISTINGS.length : window.LISTINGS.filter((l) => l.status === t).length;
            return (
              <button key={t} onClick={() => setFilter(t)} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, border: "none",
                background: on ? "var(--surface2)" : "transparent", color: on ? "var(--foreground)" : "var(--muted)",
                fontSize: 13.5, fontWeight: 600,
              }}>
                {t} <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* sort by part / car */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: 4 }}>
            {[["part", "By part", "Wrench"], ["car", "By car", "Car"]].map(([id, label, icon]) => {
              const on = group === id;
              return (
                <button key={id} onClick={() => setGroup(id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: "none",
                  background: on ? "var(--surface2)" : "transparent", color: on ? "var(--foreground)" : "var(--muted)",
                  fontSize: 13, fontWeight: 600,
                }}><I name={icon} size={14} /> {label}</button>
              );
            })}
          </div>
          <button style={bx.primaryBtn} onClick={() => window.csOpenExport(window.LISTINGS.find(l => l.status === "Draft") || window.LISTINGS[0])}><I name="Send" size={15} /> Post selected</button>
        </div>
      </div>

      {group === "part" && (
        <div className="cs-parts-card">
        <window.UI.Card pad={0}>
          {head}
          {rows.map((l, i) => <PartRowB key={l.id} l={l} last={i === rows.length - 1} />)}
        </window.UI.Card>
        </div>
      )}

      {group === "car" && (
        <div style={{ display: "grid", gap: 16 }}>
          {window.VEHICLES.map((v) => {
            const vParts = window.partsForVehicle(v).filter((l) => filter === "All" || l.status === filter);
            if (!vParts.length) return null;
            return (
              <window.UI.Card key={v.id} pad={0}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--line)" }}>
                  <window.UI.PhotoCell icon="Car" style={{ width: 44, height: 34, flexShrink: 0 }} iconSize={18} />
                  <button onClick={() => window.csOpenVehicle(v)} style={{ all: "unset", cursor: "pointer", flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{v.year} {v.make} {v.model} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{v.trim}</span></span>
                  </button>
                  <window.UI.SellModeBadge mode={v.sellMode} size="sm" />
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{vParts.length} parts</span>
                </div>
                {vParts.map((l, i) => <PartRowB key={l.id} l={l} last={i === vParts.length - 1} />)}
              </window.UI.Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Photos() {
  const I = window.Icon;
  const groups = window.VEHICLES.slice(0, 4);
  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 26 }}>
      {groups.map((v) => (
        <div key={v.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <window.Icon name="Car" size={16} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{v.year} {v.make} {v.model} {v.trim}</span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{v.photos} photos · added {v.added}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {Array.from({ length: v.photos }).map((_, i) => (
              <window.UI.PhotoCell
                key={i}
                icon={i === v.photos - 1 ? "ScanLine" : "Car"}
                label={i === v.photos - 1 ? "VIN plate" : ["Front", "Rear", "Left", "Right", "Interior", "Detail"][i] || `Shot ${i + 1}`}
                style={{ aspectRatio: "4/3", borderRadius: 12 }}
                iconSize={26}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Messages (chat) ------------------------------------------------------
function Messages() {
  const I = window.Icon;
  const [activeId, setActiveId] = useStateB(window.THREADS[0].id);
  const [draft, setDraft] = useStateB("");
  const t = window.THREADS.find((x) => x.id === activeId);

  return (
    <div style={bx.chatWrap} className="cs-chat">
      {/* thread list */}
      <div style={bx.threadList}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9 }}>
          <I name="Inbox" size={16} color="var(--muted)" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Inbox</span>
          <span style={bx.inboxBadge}>3 new</span>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {window.THREADS.map((th) => {
            const on = th.id === activeId;
            const last = th.messages[th.messages.length - 1];
            return (
              <button key={th.id} onClick={() => setActiveId(th.id)} style={{ ...bx.threadItem, background: on ? "var(--surface2)" : "transparent" }}>
                <div style={bx.avatar}>{th.avatar}</div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{th.name}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{th.time}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600, margin: "1px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{th.part}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last.from === "me" ? "You: " : ""}{last.text}</span>
                    {th.unread > 0 && <span style={bx.unread}>{th.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* conversation */}
      <div style={bx.convo}>
        <div style={bx.convoHead}>
          <div style={bx.avatar}>{t.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <window.UI.MarketChip name={t.market} /> {t.part}
            </div>
          </div>
          <button style={bx.iconGhost}><I name="ExternalLink" size={16} color="var(--muted)" /></button>
        </div>

        <div style={bx.msgs}>
          {t.messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "70%", padding: "10px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.45,
                background: m.from === "me" ? "var(--accent)" : "var(--surface2)",
                color: "#fff", borderBottomRightRadius: m.from === "me" ? 4 : 14, borderBottomLeftRadius: m.from === "me" ? 14 : 4,
              }}>
                {m.text}
                <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={bx.composer}>
          <button style={bx.iconGhost}><I name="Paperclip" size={17} color="var(--muted)" /></button>
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply…" style={bx.composerInput}
            onKeyDown={(e) => { if (e.key === "Enter") setDraft(""); }}
          />
          <button style={{ ...bx.primaryBtn, padding: "9px 14px" }} onClick={() => setDraft("")}>
            <I name="Send" size={15} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}

const bx = {
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600 },
  iconGhost: { width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0 },
  lrow: { display: "flex", alignItems: "center", gap: 14, padding: "12px 18px" },
  lhead: { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--line)" },
  // chat
  chatWrap: { display: "grid", gridTemplateColumns: "320px 1fr", height: "calc(100vh - 74px - 56px)", minHeight: 480, border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface)", maxWidth: 1180 },
  threadList: { display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", minWidth: 0 },
  inboxBadge: { marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "rgba(220,38,38,0.14)", borderRadius: 999, padding: "2px 9px" },
  threadItem: { display: "flex", gap: 11, padding: "12px 14px", border: "none", borderBottom: "1px solid var(--line)", width: "100%", alignItems: "flex-start" },
  avatar: { width: 38, height: 38, borderRadius: 999, background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "var(--foreground)", flexShrink: 0, border: "1px solid var(--line)" },
  unread: { fontSize: 10.5, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 999, minWidth: 17, height: 17, display: "grid", placeItems: "center", padding: "0 5px", flexShrink: 0 },
  convo: { display: "flex", flexDirection: "column", minWidth: 0 },
  convoHead: { display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--line)" },
  msgs: { flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12, background: "rgba(15,23,42,0.4)" },
  composer: { display: "flex", alignItems: "center", gap: 10, padding: 14, borderTop: "1px solid var(--line)" },
  composerInput: { flex: 1, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "10px 14px", color: "var(--foreground)", fontSize: 13.5, outline: "none" },
};

window.VIEWS = Object.assign(window.VIEWS || {}, { parts: Listings, photos: Photos, messages: Messages });
