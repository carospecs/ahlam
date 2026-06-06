// Ahlam mobile — screens 3: Browse market, Vehicle profile, AI chat, Photos.
const { useState: useStateMob3, useRef: useRefMob3 } = React;
const C3 = window.MobileScreens1.C;

// ---------- Browse market (vehicles / parts) ----------
function MBrowse({ onVehicle, onPart, onAccount }) {
  const I = window.Icon;
  const [tab, setTab] = useStateMob3("vehicles");
  const cars = window.VEHICLES.filter((v) => v.sellMode === "whole" || v.sellMode === "both");
  const parts = window.LISTINGS.filter((l) => l.status === "Posted");

  return (
    <div style={{ background: C3.bg, minHeight: "100%", paddingBottom: 110 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 18px 6px" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C3.fg }}>Browse market</div>
          <div style={{ fontSize: 12.5, color: C3.muted, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <I name="MapPin" size={13} /> Long Beach, CA · 25 mi
          </div>
        </div>
        <window.MobileScreens1.MAvatarBtn onClick={onAccount} />
      </div>

      {/* toggle */}
      <div style={{ padding: "10px 18px 4px" }}>
        <div style={{ display: "flex", gap: 6, background: C3.surface, border: `1px solid ${C3.line}`, borderRadius: 13, padding: 5 }}>
          {[["vehicles", "Vehicles", "Car", cars.length], ["parts", "Parts", "Wrench", parts.length]].map(([id, label, icon, n]) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 9, border: "none",
                background: on ? C3.accent : "transparent", color: on ? "#fff" : C3.muted, fontSize: 14, fontWeight: 600,
              }}>
                <I name={icon} size={16} /> {label} <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "12px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {tab === "vehicles" && cars.map((v) => (
          <button key={v.id} onClick={() => onVehicle(v)} style={mb3.card}>
            <div style={{ position: "relative" }}>
              <window.MobileScreens1.MPhoto icon="Car" h={110} iconSize={34} radius={0} />
              <div style={{ position: "absolute", top: 8, left: 8 }}><window.MobileScreens1.MSellBadge mode={v.sellMode} small /></div>
            </div>
            <div style={{ padding: 11, textAlign: "left" }}>
              <div className="tnum" style={{ fontSize: 17, fontWeight: 800, color: C3.fg }}>${v.askingPrice.toLocaleString()}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C3.fg, marginTop: 2 }}>{v.year} {v.make} {v.model}</div>
              <div style={{ fontSize: 11, color: C3.muted, marginTop: 2 }}>{v.mileage} · {v.body}</div>
            </div>
          </button>
        ))}
        {tab === "parts" && parts.map((l) => (
          <button key={l.id} onClick={() => onPart(l)} style={mb3.card}>
            <div style={{ position: "relative" }}>
              <window.MobileScreens1.MPhoto icon="Wrench" h={104} iconSize={30} radius={0} />
              <div style={{ position: "absolute", top: 8, left: 8 }}><window.MobileScreens1.MBadge grade={l.grade} /></div>
            </div>
            <div style={{ padding: 11, textAlign: "left" }}>
              <div className="tnum" style={{ fontSize: 16, fontWeight: 800, color: C3.fg }}>${l.price}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C3.fg, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.part}</div>
              <div style={{ fontSize: 11, color: C3.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.vehicle}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Vehicle profile (whole car + parts) ----------
function MVehicleProfile({ v, onBack, onPart, onToast }) {
  const I = window.Icon;
  const parts = window.partsForVehicle(v);
  const mode = window.SELL_MODE[v.sellMode];
  const showCar = v.sellMode === "whole" || v.sellMode === "both";
  const showParts = v.sellMode === "parts" || v.sellMode === "both";
  const partsValue = parts.reduce((s, p) => s + p.price, 0);

  function copyCar() {
    try { navigator.clipboard && navigator.clipboard.writeText(window.buildVehicleText(v)); } catch (e) {}
    onToast("Whole-car listing copied");
  }

  return (
    <div style={{ background: C3.bg, minHeight: "100%", paddingBottom: 30 }}>
      <window.MobileScreens1.MHeader title={`${v.year} ${v.make} ${v.model}`} sub={`${v.trim} · ${v.mileage}`} onBack={onBack} />
      <window.MobileScreens1.MPhoto icon="Car" h={180} />
      <div style={{ padding: "16px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <window.MobileScreens1.MSellBadge mode={v.sellMode} />
          <span style={{ fontSize: 12, color: C3.muted }}>{mode.desc}</span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {showCar && <MStat label="Asking" value={`$${v.askingPrice.toLocaleString()}`} tone={C3.signal} />}
          <MStat label="Parts" value={v.parts} />
          <MStat label="Parts value" value={`$${partsValue.toLocaleString()}`} tone={C3.success} />
        </div>

        {showCar && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C3.fg, display: "flex", alignItems: "center", gap: 7 }}><I name="Car" size={15} color={C3.signal} /> Whole-car listing</span>
            </div>
            <pre style={mb3.pre}>{window.buildVehicleText(v)}</pre>
            <div style={{ marginTop: 11 }}><window.MobileScreens1.MBtn label="Copy whole-car listing" icon="Copy" onClick={copyCar} /></div>
          </div>
        )}

        {showParts && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C3.fg, display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
              <I name="Wrench" size={15} color={C3.accent} /> Parts from this car <span style={{ color: C3.muted, fontWeight: 500 }}>· {parts.length}</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {parts.map((l) => (
                <button key={l.id} onClick={() => onPart(l)} style={mb3.partRow}>
                  <div className="photo-cell" style={{ width: 48, height: 48, borderRadius: 11, flexShrink: 0 }}>
                    <I name="Wrench" size={18} strokeWidth={1.5} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C3.fg }}>{l.part}</div>
                    <div style={{ fontSize: 11.5, color: C3.muted }}>{l.category}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tnum" style={{ fontSize: 14, fontWeight: 700, color: C3.fg }}>${l.price}</div>
                    <window.MobileScreens1.MBadge grade={l.grade} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MStat({ label, value, tone }) {
  return (
    <div style={{ flex: 1, background: C3.surface, border: `1px solid ${C3.line}`, borderRadius: 13, padding: 13 }}>
      <div className="tnum" style={{ fontSize: 17, fontWeight: 800, color: tone || C3.fg }}>{value}</div>
      <div style={{ fontSize: 11, color: C3.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ---------- AI chat ----------
const MAI_SUGGESTIONS = ["Fair price for the Accord alternator?", "Which F-150 parts sell fastest?", "Write a post for the Camry wheels"];
const MAI_SEED = [{ from: "ai", text: "Hi Ray — I'm your Ahlam assistant. Ask me about pricing, fitment, or drafting a listing." }];
function mAiReply(t) {
  const lc = t.toLowerCase();
  if (lc.includes("price") || lc.includes("fair") || lc.includes("alternator")) return "For a Good-condition 2014 Accord alternator, recent solds near you land around $85. I'd list at $95 with room to $85. Want me to draft it?";
  if (lc.includes("fast") || lc.includes("sell")) return "On your F-150, the tailgate and bed liner move fastest — trucks part out quick here. The tailgate already has 318 views.";
  if (lc.includes("write") || lc.includes("post") || lc.includes("draft")) return "Draft: \"Set of 4 17in Camry alloys (2015–2017). True & balanced, light curb rash on one. $280. — Westside Auto Salvage\". Push to Facebook & OfferUp?";
  return "Based on comparable solds in your area, I'd price that in the $80–95 range for Good condition. Want a listing draft?";
}

function MAIChat({ onAccount }) {
  const I = window.Icon;
  const [msgs, setMsgs] = useStateMob3(MAI_SEED);
  const [draft, setDraft] = useStateMob3("");

  function send(text) {
    const t = (text || draft).trim();
    if (!t) return;
    setDraft("");
    setMsgs((m) => [...m, { from: "me", text: t }, { from: "ai", typing: true }]);
    setTimeout(() => setMsgs((m) => m.filter((x) => !x.typing).concat({ from: "ai", text: mAiReply(t) })), 850);
  }

  return (
    <div style={{ background: C3.bg, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "54px 18px 14px", borderBottom: `1px solid ${C3.line}` }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center" }}>
          <I name="Sparkles" size={19} color={C3.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C3.fg }}>AI assistant</div>
          <div style={{ fontSize: 12, color: C3.muted }}>Knows your shop inventory</div>
        </div>
        <window.MobileScreens1.MAvatarBtn onClick={onAccount} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 9, justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
            {m.from === "ai" && <div style={mb3.aiAv}><I name="Sparkles" size={13} color={C3.accent} /></div>}
            <div style={{
              maxWidth: "78%", padding: "11px 14px", borderRadius: 15, fontSize: 14, lineHeight: 1.5, color: "#fff",
              background: m.from === "me" ? C3.accent : C3.surface2,
              borderBottomRightRadius: m.from === "me" ? 5 : 15, borderBottomLeftRadius: m.from === "me" ? 15 : 5,
            }}>{m.typing ? <span style={{ color: C3.muted }}>Thinking…</span> : m.text}</div>
          </div>
        ))}
      </div>

      {msgs.length <= 1 && (
        <div style={{ display: "flex", gap: 8, padding: "0 16px 10px", flexWrap: "wrap" }}>
          {MAI_SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} style={mb3.sugg}>{s}</button>)}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px 28px", borderTop: `1px solid ${C3.line}` }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about pricing or fitment…" style={mb3.aiInput} />
        <button onClick={() => send()} style={{ width: 42, height: 42, borderRadius: 99, border: "none", background: C3.accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <I name="ArrowUp" size={18} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ---------- Photos ----------
function MPhotos({ onAccount }) {
  const I = window.Icon;
  return (
    <div style={{ background: C3.bg, minHeight: "100%", paddingBottom: 110 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 18px 8px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C3.fg }}>Photos</div>
        <window.MobileScreens1.MAvatarBtn onClick={onAccount} />
      </div>
      <div style={{ padding: "8px 18px 0", display: "grid", gap: 22 }}>
        {window.VEHICLES.slice(0, 3).map((v) => (
          <div key={v.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <I name="Car" size={15} color={C3.accent} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C3.fg }}>{v.year} {v.make} {v.model}</span>
              <span style={{ fontSize: 12, color: C3.muted }}>{v.photos} photos</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {Array.from({ length: v.photos }).map((_, i) => (
                <window.MobileScreens1.MPhoto key={i} icon={i === v.photos - 1 ? "ScanLine" : "Car"} h={86} iconSize={22} radius={11}
                  label={i === v.photos - 1 ? "VIN" : null} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.MobileScreens3 = { MBrowse, MVehicleProfile, MAIChat, MPhotos };

const mb3 = {
  card: { all: "unset", cursor: "pointer", display: "block", background: C3.surface, border: `1px solid ${C3.line}`, borderRadius: 15, overflow: "hidden" },
  pre: { margin: 0, background: C3.surface, border: `1px solid ${C3.line}`, borderRadius: 13, padding: 14, fontSize: 13, lineHeight: 1.55, color: C3.fg, fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" },
  partRow: { display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: C3.surface, border: `1px solid ${C3.line}`, width: "100%" },
  aiAv: { width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center", flexShrink: 0 },
  sugg: { padding: "9px 13px", borderRadius: 999, border: `1px solid ${C3.line}`, background: C3.surface2, color: C3.fg, fontSize: 12, fontWeight: 500, textAlign: "left" },
  aiInput: { flex: 1, border: `1px solid ${C3.line}`, background: C3.surface2, borderRadius: 22, padding: "11px 16px", color: C3.fg, fontSize: 14.5, outline: "none" },
};
