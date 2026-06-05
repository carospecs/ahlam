// Views C — Browse marketplace, AI assistant, Vehicle profile.
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

// ============ BROWSE MARKETPLACE (what buyers see) ============
function Browse({ go }) {
  const I = window.Icon;
  const [tab, setTab] = useStateC("vehicles"); // vehicles | parts
  const cars = window.VEHICLES.filter((v) => v.sellMode === "whole" || v.sellMode === "both");
  const parts = window.LISTINGS.filter((l) => l.status === "Posted");

  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 18 }}>
      {/* toggle: vehicles / parts */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 5 }}>
          {[["vehicles", "Vehicles", "Car", cars.length], ["parts", "Parts", "Wrench", parts.length]].map(([id, label, icon, n]) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 9, border: "none",
                background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)", fontSize: 14, fontWeight: 600,
              }}>
                <I name={icon} size={16} /> {label}
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{n}</span>
              </button>
            );
          })}
        </div>
        <div style={cx.searchPill}>
          <I name="MapPin" size={15} color="var(--muted)" />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Long Beach, CA · 25 mi</span>
          <I name="ChevronDown" size={14} color="var(--muted)" />
        </div>
      </div>

      {tab === "vehicles" && (
        <div style={cx.grid}>
          {cars.map((v) => (
            <button key={v.id} onClick={() => window.csOpenVehicle(v)} style={cx.cardBtn}>
              <div style={{ position: "relative" }}>
                <window.UI.PhotoCell icon="Car" style={{ height: 168, borderRadius: 0 }} iconSize={46} />
                <div style={{ position: "absolute", top: 10, left: 10 }}><window.UI.SellModeBadge mode={v.sellMode} size="sm" /></div>
              </div>
              <div style={{ padding: 14 }}>
                <div className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>${v.askingPrice.toLocaleString()}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{v.year} {v.make} {v.model} {v.trim}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span>{v.mileage}</span><span>·</span><span>{v.body}</span><span>·</span><span>{v.color}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                  <I name="MapPin" size={13} /> Long Beach, CA
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "parts" && (
        <div style={cx.grid}>
          {parts.map((l) => (
            <button key={l.id} onClick={() => window.csOpenExport(l)} style={cx.cardBtn}>
              <div style={{ position: "relative" }}>
                <window.UI.PhotoCell icon="Wrench" style={{ height: 150, borderRadius: 0 }} iconSize={40} />
                <div style={{ position: "absolute", top: 10, left: 10 }}><window.UI.ConditionBadge grade={l.grade} size="sm" /></div>
              </div>
              <div style={{ padding: 14 }}>
                <div className="tnum" style={{ fontSize: 19, fontWeight: 800 }}>${l.price}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.part}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Fits {l.fitment}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                  <I name="MapPin" size={13} /> Long Beach · {l.views} views
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ VEHICLE PROFILE (whole car + its parts) ============
function VehicleProfile({ v, onBack }) {
  const I = window.Icon;
  const parts = window.partsForVehicle(v);
  const mode = window.SELL_MODE[v.sellMode];
  const showCar = v.sellMode === "whole" || v.sellMode === "both";
  const showParts = v.sellMode === "parts" || v.sellMode === "both";
  const partsValue = parts.reduce((s, p) => s + p.price, 0);

  function copyCar() {
    try { navigator.clipboard && navigator.clipboard.writeText(window.buildVehicleText(v)); } catch (e) {}
    window.csToast("Whole-car listing copied");
  }

  return (
    <div style={{ maxWidth: 1080, display: "grid", gap: 18 }}>
      <button onClick={onBack} style={cx.backLink}><I name="ChevronLeft" size={16} /> Back to shop vehicles</button>

      {/* hero */}
      <window.UI.Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr" }} className="cs-veh-hero">
          <window.UI.PhotoCell icon="Car" style={{ height: "100%", minHeight: 220, borderRadius: 0 }} iconSize={56} />
          <div style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <window.UI.SellModeBadge mode={v.sellMode} />
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{mode.desc}</span>
            </div>
            <h2 style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 800 }}>{v.year} {v.make} {v.model} {v.trim}</h2>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>{v.body} · {v.color} · {v.mileage}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
              <I name="ScanLine" size={14} /> VIN {v.vin}
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
              {showCar && <Stat label="Asking price" value={`$${v.askingPrice.toLocaleString()}`} tone="var(--signal)" />}
              <Stat label="Parts identified" value={v.parts} />
              <Stat label="Parts value" value={`$${partsValue.toLocaleString()}`} tone="var(--success)" />
              <Stat label="Sold" value={v.sold} />
            </div>
          </div>
        </div>
      </window.UI.Card>

      {/* whole-car listing */}
      {showCar && (
        <window.UI.Card pad={18}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><I name="Car" size={16} color="var(--signal)" /> Whole-car listing</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={cx.ghostSm} onClick={copyCar}><I name="Copy" size={14} /> Copy text</button>
              <button style={cx.primarySm} onClick={() => window.csToast("Posted whole car to marketplaces")}><I name="Send" size={14} /> Post car</button>
            </div>
          </div>
          <pre style={cx.pre}>{window.buildVehicleText(v)}</pre>
        </window.UI.Card>
      )}

      {/* its parts */}
      {showParts && (
        <window.UI.Card pad={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><I name="Wrench" size={16} color="var(--accent)" /> Parts from this car <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {parts.length}</span></span>
            <button style={cx.ghostSm} onClick={() => window.csToast("Drafted listings for all parts")}><I name="Sparkles" size={14} /> Draft all</button>
          </div>
          {parts.map((l, i) => (
            <div key={l.id} onClick={() => window.csOpenExport(l)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", cursor: "pointer", borderBottom: i < parts.length - 1 ? "1px solid var(--line)" : "none" }}>
              <window.UI.PhotoCell icon="Wrench" style={{ width: 46, height: 40, flexShrink: 0 }} iconSize={17} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.category}</div>
              </div>
              <window.UI.ConditionBadge grade={l.grade} size="sm" />
              <span className="tnum" style={{ width: 60, textAlign: "right", fontSize: 14, fontWeight: 700 }}>${l.price}</span>
              <window.UI.StatusBadge status={l.status} />
            </div>
          ))}
        </window.UI.Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: tone || "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ============ AI ASSISTANT ============
const AI_SUGGESTIONS = [
  "What's a fair price for the Accord alternator?",
  "Which parts on the F-150 sell fastest?",
  "Write a Facebook post for the Camry wheels",
];
const AI_SEED = [
  { from: "ai", text: "Hi Ray — I'm your CaroSpecs assistant. Ask me about part pricing, fitment, or drafting a listing. I can see your shop inventory." },
];
const AI_REPLIES = {
  default: "Based on comparable sold listings in your area, I'd price that in the $80–95 range for Good condition. Want me to draft the listing text?",
  price: "For a Good-condition 2014 Accord alternator, recent OfferUp & eBay solds in Southern California land around $85. I'd list at $95 with room to negotiate to $85. Want me to draft it?",
  fast: "On your 2013 F-150, the tailgate and bed liner move fastest — trucks part out quickly here. The tailgate's already got 318 views. I'd prioritize posting the doors next.",
  write: "Here's a draft for the Camry wheels:\n\n\"Set of 4 17in factory Camry alloys (2015–2017). All true and balanced, light curb rash on one. No bends. $280. — Westside Auto Salvage, Long Beach\"\n\nWant me to push it to Facebook & OfferUp?",
};

function AIChat() {
  const I = window.Icon;
  const [msgs, setMsgs] = useStateC(AI_SEED);
  const [draft, setDraft] = useStateC("");
  const endRef = useRefC(null);
  useEffectC(() => { endRef.current && endRef.current.scrollIntoView && (endRef.current.parentNode.scrollTop = endRef.current.offsetTop); }, [msgs]);

  function send(text) {
    const t = (text || draft).trim();
    if (!t) return;
    setDraft("");
    setMsgs((m) => [...m, { from: "me", text: t }, { from: "ai", typing: true }]);
    setTimeout(() => {
      let reply = AI_REPLIES.default;
      const lc = t.toLowerCase();
      if (lc.includes("price") || lc.includes("fair") || lc.includes("alternator")) reply = AI_REPLIES.price;
      else if (lc.includes("fast") || lc.includes("sell")) reply = AI_REPLIES.fast;
      else if (lc.includes("write") || lc.includes("post") || lc.includes("draft")) reply = AI_REPLIES.write;
      setMsgs((m) => m.filter((x) => !x.typing).concat({ from: "ai", text: reply }));
    }, 900);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", height: "calc(100vh - 74px - 56px)", minHeight: 460, display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center" }}>
          <I name="Sparkles" size={18} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>CaroSpecs Assistant</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Knows your shop · prices, fitment, listings</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
            {m.from === "ai" && <div style={cx.aiAvatar}><I name="Sparkles" size={14} color="var(--accent)" /></div>}
            <div style={{
              maxWidth: "76%", padding: "11px 15px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap",
              background: m.from === "me" ? "var(--accent)" : "var(--surface2)", color: "#fff",
              borderBottomRightRadius: m.from === "me" ? 4 : 14, borderBottomLeftRadius: m.from === "me" ? 14 : 4,
            }}>
              {m.typing ? <span style={{ color: "var(--muted)" }}>Thinking…</span> : m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && (
        <div style={{ display: "flex", gap: 8, padding: "0 18px 12px", flexWrap: "wrap" }}>
          {AI_SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} style={cx.suggestion}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderTop: "1px solid var(--line)" }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about pricing, fitment, or a listing…" style={cx.aiInput} />
        <button onClick={() => send()} style={cx.aiSend}><I name="ArrowUp" size={18} color="#fff" /></button>
      </div>
    </div>
  );
}

const cx = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 },
  cardBtn: { all: "unset", cursor: "pointer", display: "block", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  searchPill: { display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11 },
  backLink: { display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 600, padding: 0, width: "fit-content" },
  pre: { margin: 0, background: "rgba(15,23,42,0.6)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 15, fontSize: 13, lineHeight: 1.6, color: "var(--foreground)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" },
  ghostSm: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600 },
  primarySm: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600 },
  aiAvatar: { width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center", flexShrink: 0 },
  suggestion: { padding: "9px 14px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 12.5, fontWeight: 500, textAlign: "left" },
  aiInput: { flex: 1, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", color: "var(--foreground)", fontSize: 14, outline: "none" },
  aiSend: { width: 42, height: 42, borderRadius: 11, border: "none", background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 },
};

window.VIEWS = Object.assign(window.VIEWS || {}, { browse: Browse, aichat: AIChat, vehicleProfile: VehicleProfile });
