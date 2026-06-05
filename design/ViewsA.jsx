// Views A — Overview, Vehicles, Add Vehicle (the AI flow).
const { useState: useStateA } = React;

function StatCard({ icon, label, value, delta, tone = "accent" }) {
  const I = window.Icon;
  const toneC = { accent: "var(--accent)", success: "var(--success)", signal: "var(--signal)", muted: "var(--muted)" }[tone];
  return (
    <window.UI.Card pad={18} style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, ${toneC} 15%, transparent)`, display: "grid", placeItems: "center" }}>
          <I name={icon} size={19} color={toneC} />
        </div>
        {delta && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 3 }}><I name="TrendingUp" size={13} /> {delta}</span>}
      </div>
      <div>
        <div className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{value}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{label}</div>
      </div>
    </window.UI.Card>
  );
}

function Overview({ go }) {
  const I = window.Icon;
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="cs-grid4">
        <StatCard icon="Car" label="Vehicles in inventory" value="5" delta="+2 wk" tone="accent" />
        <StatCard icon="Wrench" label="Parts identified" value="42" delta="+9 wk" tone="muted" />
        <StatCard icon="Tag" label="Active listings" value="18" tone="success" />
        <StatCard icon="DollarSign" label="Sold this month" value="$1,840" delta="15 parts" tone="signal" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }} className="cs-grid-2">
        <window.UI.Card pad={0}>
          <div style={ax.cardHead}>
            <span style={ax.cardTitle}>Recent vehicles</span>
            <button style={ax.link} onClick={() => go("vehicles")}>View all <I name="ArrowRight" size={13} /></button>
          </div>
          <div>
            {window.VEHICLES.slice(0, 4).map((v, i) => (
              <div key={v.id} style={{ ...ax.vRow, borderBottom: i < 3 ? "1px solid var(--line)" : "none" }}>
                <window.UI.PhotoCell icon="Car" style={{ width: 52, height: 40, flexShrink: 0 }} iconSize={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.year} {v.make} {v.model} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{v.trim}</span></div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{v.parts} parts · {v.photos} photos · added {v.added}</div>
                </div>
                <div className="tnum" style={{ fontSize: 14, fontWeight: 700 }}>${v.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </window.UI.Card>

        <window.UI.Card pad={0}>
          <div style={ax.cardHead}><span style={ax.cardTitle}>Activity</span></div>
          <div style={{ padding: "4px 18px 14px" }}>
            {window.ACTIVITY.map((a, i) => {
              const toneC = { accent: "var(--accent)", success: "var(--success)", signal: "var(--signal)", muted: "var(--muted)" }[a.tone];
              return (
                <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: i < window.ACTIVITY.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `color-mix(in srgb, ${toneC} 14%, transparent)`, display: "grid", placeItems: "center" }}>
                    <I name={a.icon} size={15} color={toneC} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>{a.text}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{a.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </window.UI.Card>
      </div>
    </div>
  );
}

function Vehicles({ go }) {
  const I = window.Icon;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18, maxWidth: 1180 }}>
      {window.VEHICLES.map((v) => (
        <button key={v.id} onClick={() => window.csOpenVehicle(v)} style={{ all: "unset", cursor: "pointer", display: "block" }}>
        <window.UI.Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ position: "relative" }}>
            <window.UI.PhotoCell icon="Car" label={`${v.photos} photos`} style={{ height: 150, borderRadius: 0 }} iconSize={44} />
            <div style={{ position: "absolute", top: 10, left: 10 }}><window.UI.SellModeBadge mode={v.sellMode} size="sm" /></div>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{v.year} {v.make} {v.model}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>{v.trim} · {v.body} · {v.mileage}</div>
              </div>
              {v.askingPrice
                ? <span className="tnum" style={{ fontSize: 16, fontWeight: 800, color: "var(--signal)" }}>${v.askingPrice.toLocaleString()}</span>
                : <span className="tnum" style={{ fontSize: 16, fontWeight: 800, color: "var(--success)" }}>${v.value.toLocaleString()}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
              <I name="ScanLine" size={13} /> VIN {v.vin}
              <span style={{ marginLeft: "auto", color: v.askingPrice ? "var(--signal)" : "var(--muted)" }}>{v.askingPrice ? "car asking price" : "parts value"}</span>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <Mini label="Parts" value={v.parts} />
              <Mini label="Listed" value={v.listed} />
              <Mini label="Sold" value={v.sold} tone="var(--signal)" />
            </div>
          </div>
        </window.UI.Card>
        </button>
      ))}
      <button onClick={() => go("add")} style={ax.addTile}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center" }}>
          <I name="CirclePlus" size={24} color="var(--accent)" />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Add a vehicle</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>Photograph it and let AI build the inventory</div>
      </button>
    </div>
  );
}

function Mini({ label, value, tone }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: 17, fontWeight: 700, color: tone || "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

// ---- Add vehicle (AI flow) ------------------------------------------------
function AddVehicle({ go }) {
  const I = window.Icon;
  const [phase, setPhase] = useStateA("upload"); // upload | analyzing | results
  const [parts, setParts] = useStateA(window.DEMO_PARTS);
  const [sellMode, setSellMode] = useStateA("parts");
  const photos = [0, 1, 2, 3, 4, 5];

  function analyze() {
    setPhase("analyzing");
    setTimeout(() => setPhase("results"), 2200);
  }
  function removePart(id) { setParts(parts.filter((p) => p.id !== id)); }

  const total = parts.reduce((s, p) => s + p.price, 0);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 20 }}>
      {/* stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Step n={1} label="Photos" on={true} done={phase !== "upload"} />
        <span style={ax.stepLine} />
        <Step n={2} label="AI analysis" on={phase !== "upload"} done={phase === "results"} />
        <span style={ax.stepLine} />
        <Step n={3} label="Review & save" on={phase === "results"} />
      </div>

      {phase === "upload" && (
        <window.UI.Card pad={22} style={{ display: "grid", gap: 18 }}>
          <div style={ax.dropzone}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center" }}>
              <I name="ImageUp" size={24} color="var(--accent)" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Drop 4–6 photos, or take them now</div>
            <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 420, textAlign: "center" }}>
              Front, rear, both sides, and the VIN plate if it's legible. One AI pass reads all of them together.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button style={ax.primaryBtn}><I name="Camera" size={16} /> Take photo</button>
              <button style={ax.ghostBtn}><I name="Upload" size={16} /> Upload</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {photos.map((i) => (
              <window.UI.PhotoCell key={i} icon={i === 5 ? "ScanLine" : "Car"} style={{ aspectRatio: "1", borderRadius: 10 }} iconSize={22} label={i === 5 ? "VIN" : `${i + 1}`} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}><I name="Info" size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />6 of 6 photos ready</span>
            <button style={ax.primaryBtn} onClick={analyze}><I name="Sparkles" size={16} /> Run AI analysis</button>
          </div>
        </window.UI.Card>
      )}

      {phase === "analyzing" && (
        <window.UI.Card pad={48} style={{ display: "grid", placeItems: "center", gap: 16, textAlign: "center" }}>
          <div style={{ position: "relative", width: 64, height: 64 }}>
            <div style={ax.spinner} />
            <I name="ScanLine" size={26} color="var(--accent)" style={{ position: "absolute", inset: 0, margin: "auto" }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Reading all 6 photos…</div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 380 }}>
            GPT-4o Vision is identifying the vehicle and grading every visible part. Usually under 20 seconds.
          </div>
        </window.UI.Card>
      )}

      {phase === "results" && (
        <React.Fragment>
          {/* identified vehicle */}
          <window.UI.Card pad={18} style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <window.UI.PhotoCell icon="Car" style={{ width: 88, height: 66, flexShrink: 0 }} iconSize={28} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{window.DEMO_VEHICLE.make} {window.DEMO_VEHICLE.model} {window.DEMO_VEHICLE.trim}</span>
                <span style={ax.confPill}><I name="CircleCheck" size={12} /> High confidence</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{window.DEMO_VEHICLE.year} · {window.DEMO_VEHICLE.body}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <I name="ScanLine" size={13} /> VIN {window.DEMO_VEHICLE.vin}
                <button style={ax.editChip}><I name="Pencil" size={11} /> Edit</button>
              </div>
            </div>
          </window.UI.Card>

          {/* sell mode choice */}
          <window.UI.Card pad={18} style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>How do you want to sell this?</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>You can change this anytime.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="cs-sellmode">
              {["parts", "whole", "both"].map((mode) => {
                const m = window.SELL_MODE[mode];
                const on = sellMode === mode;
                return (
                  <button key={mode} onClick={() => setSellMode(mode)} style={{
                    textAlign: "left", display: "grid", gap: 7, padding: 14, borderRadius: "var(--radius-md)",
                    border: `1.5px solid ${on ? m.color : "var(--line)"}`,
                    background: on ? `color-mix(in srgb, ${m.color} 12%, transparent)` : "transparent",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${m.color} 16%, transparent)` }}>
                        <I name={m.icon} size={17} color={m.color} />
                      </span>
                      {on && <I name="CircleCheck" size={17} color={m.color} />}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>{m.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </window.UI.Card>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{parts.length} parts found <span style={{ color: "var(--muted)", fontWeight: 500 }}>· tap any field to fix it</span></span>
            <button style={ax.ghostBtn}><I name="Plus" size={15} /> Add a part</button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {parts.map((p) => <PartRow key={p.id} p={p} onRemove={() => removePart(p.id)} />)}
          </div>

          <window.UI.Card pad={16} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", bottom: 0 }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Estimated total inventory value</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: "var(--success)" }}>${total.toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={ax.ghostBtn} onClick={() => setPhase("upload")}>Start over</button>
              <button style={ax.primaryBtn} onClick={() => go(sellMode === "whole" ? "vehicles" : "parts")}><I name="Check" size={16} /> Save vehicle & draft listings</button>
            </div>
          </window.UI.Card>
        </React.Fragment>
      )}
    </div>
  );
}

function PartRow({ p, onRemove }) {
  const I = window.Icon;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: "var(--radius-md)",
      background: p.warn ? "var(--signal-bg)" : "var(--surface)",
      border: `1px solid ${p.warn ? "color-mix(in srgb, var(--signal) 40%, transparent)" : "var(--line)"}`,
    }}>
      <window.UI.PhotoCell icon="Wrench" style={{ width: 48, height: 48, flexShrink: 0 }} iconSize={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
          {p.warn && <span style={ax.warnTag}><I name="TriangleAlert" size={11} /> Review</span>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>{p.note}</div>
      </div>
      <window.UI.ConditionBadge grade={p.grade} size="sm" />
      <div className="tnum" style={{ width: 64, textAlign: "right", fontSize: 15, fontWeight: 700 }}>
        {p.price > 0 ? `$${p.price}` : <span style={{ color: "var(--muted)", fontSize: 13 }}>scrap</span>}
      </div>
      <button onClick={onRemove} style={ax.iconGhost}><I name="X" size={15} color="var(--muted)" /></button>
    </div>
  );
}

function Step({ n, label, on, done }) {
  const I = window.Icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center",
        fontSize: 13, fontWeight: 700,
        background: done ? "var(--success)" : on ? "var(--accent)" : "var(--surface2)",
        color: on || done ? "#fff" : "var(--muted)", border: on || done ? "none" : "1px solid var(--line)",
      }}>
        {done ? <I name="Check" size={14} color="#fff" /> : n}
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? "var(--foreground)" : "var(--muted)" }}>{label}</span>
    </div>
  );
}

const ax = {
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" },
  cardTitle: { fontSize: 14, fontWeight: 700 },
  link: { display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600 },
  vRow: { display: "flex", alignItems: "center", gap: 13, padding: "13px 18px" },
  addTile: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
    border: "1.5px dashed var(--line)", borderRadius: "var(--radius-lg)", background: "transparent",
    color: "var(--foreground)", padding: 24, minHeight: 280,
  },
  stepLine: { flex: 1, height: 2, background: "var(--line)", borderRadius: 2, maxWidth: 80 },
  dropzone: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "32px 20px",
    border: "1.5px dashed var(--line)", borderRadius: "var(--radius-md)", background: "rgba(39,47,66,0.3)",
  },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600 },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 600 },
  spinner: { position: "absolute", inset: 0, borderRadius: 999, border: "3px solid var(--surface2)", borderTopColor: "var(--accent)", animation: "spin 0.9s linear infinite" },
  confPill: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 16%, transparent)", borderRadius: 999, padding: "3px 9px" },
  editChip: { display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4, fontSize: 11, fontWeight: 600, color: "var(--muted)", border: "1px solid var(--line)", background: "transparent", borderRadius: 999, padding: "2px 8px" },
  warnTag: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "var(--signal)", background: "var(--signal-bg)", borderRadius: 6, padding: "2px 7px" },
  iconGhost: { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0 },
};

window.VIEWS = Object.assign(window.VIEWS || {}, { overview: Overview, vehicles: Vehicles, add: AddVehicle });
