// CaroSpecs mobile — screens 2: Review (AI), Listing detail (export), Listings, Messages, Account
const { useState: useStateMob2, useEffect: useEffectMob2 } = React;
const Cx = window.MobileScreens1.C;
const condCx = window.MobileScreens1.condC;
const m2 = window.__mob;

// 3. Review — AI loading then editable card (mirrors ReviewCard.tsx)
function MReview({ onConfirm, onBack }) {
  const I = window.Icon;
  const [phase, setPhase] = useStateMob2("loading");
  const [grade, setGrade] = useStateMob2("Good");
  const [sellMode, setSellMode] = useStateMob2("parts");
  useEffectMob2(() => { const t = setTimeout(() => setPhase("ready"), 2100); return () => clearTimeout(t); }, []);

  return (
    <div style={{ background: Cx.bg, minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <window.MobileScreens1.MHeader title="Review listing" onBack={onBack} />
      <window.MobileScreens1.MPhoto icon="Wrench" h={170} label="Your photo" />

      {phase === "loading" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
          <div style={{ position: "relative", width: 58, height: 58 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 99, border: `3px solid ${Cx.surface2}`, borderTopColor: Cx.accent, animation: "spin 0.9s linear infinite" }} />
            <I name="ScanLine" size={24} color={Cx.accent} style={{ position: "absolute", inset: 0, margin: "auto" }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: Cx.fg }}>Identifying the part…</div>
          <div style={{ fontSize: 13.5, color: Cx.muted, textAlign: "center", maxWidth: 250 }}>Reading the photo, grading condition, and drafting your listing.</div>
        </div>
      )}

      {phase === "ready" && (
        <div style={{ padding: "16px 18px 28px", display: "grid", gap: 16 }}>
          <RField label="Part name" value="Front Bumper Cover" />
          <RField label="Category" value="Body / Exterior" />
          <RField label="Fits (one vehicle per line)" value="2013–2017 Honda Accord" multiline />

          <div>
            <div style={m2lbl}>Condition</div>
            <div style={{ display: "flex", gap: 9 }}>
              {["Good", "Poor"].map((g) => {
                const on = g === grade;
                return (
                  <button key={g} onClick={() => setGrade(g)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0",
                    borderRadius: 12, fontSize: 15, fontWeight: 600,
                    border: `1px solid ${on ? condCx[g] : Cx.line}`,
                    background: on ? `color-mix(in srgb, ${condCx[g]} 14%, transparent)` : "transparent",
                    color: on ? condCx[g] : Cx.muted,
                  }}>
                    {on && <I name="Check" size={15} color={condCx[g]} />}{g}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12.5, color: Cx.muted, marginTop: 8 }}>{grade === "Good" ? "Usable, normal wear. Sellable as-is." : "Damaged or incomplete. Scrap or for repair."}</div>
          </div>

          <RField label="Condition notes" value="Minor scuffs, no cracks. Fog light brackets included." multiline />
          <RField label="Description" value="Factory front bumper cover off a clean 2014 Accord EX-L. Paint is Modern Steel, no major rash." multiline />
          <RField label="Your price (USD)" value="180" />

          {/* sell mode */}
          <div>
            <div style={m2lbl}>How do you want to sell this car?</div>
            <div style={{ display: "grid", gap: 9 }}>
              {["parts", "whole", "both"].map((mode) => {
                const m = window.SELL_MODE[mode];
                const on = sellMode === mode;
                return (
                  <button key={mode} onClick={() => setSellMode(mode)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 12, textAlign: "left",
                    border: `1.5px solid ${on ? m.color : Cx.line}`,
                    background: on ? `color-mix(in srgb, ${m.color} 12%, transparent)` : "transparent",
                  }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${m.color} 16%, transparent)`, flexShrink: 0 }}>
                      <I name={m.icon} size={17} color={m.color} />
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: Cx.fg }}>{m.label}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: Cx.muted, marginTop: 1 }}>{m.desc}</span>
                    </span>
                    {on && <I name="CircleCheck" size={18} color={m.color} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: Cx.muted, textAlign: "center", marginTop: 2 }}>AI can make mistakes. Double-check before you post.</div>
          <window.MobileScreens1.MBtn label="Looks right — make listing" icon="Check" onClick={() => onConfirm(grade)} />
        </div>
      )}
    </div>
  );
}

function RField({ label, value, multiline }) {
  return (
    <div>
      <div style={m2lbl}>{label}</div>
      <div style={{
        background: Cx.surface, border: `1px solid ${Cx.line}`, borderRadius: 12,
        padding: "12px 14px", fontSize: 15, color: Cx.fg, lineHeight: 1.45,
        minHeight: multiline ? 60 : "auto",
      }}>{value}</div>
    </div>
  );
}
const m2lbl = { fontSize: 11.5, fontWeight: 700, color: Cx.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7 };

// 4. Listing detail — the export surface (mirrors listing/[id].tsx)
function MListingDetail({ listing, onBack, onToast, grade }) {
  const I = window.Icon;
  const [copied, setCopied] = useStateMob2(false);
  const [status, setStatus] = useStateMob2(listing.status || "Draft");
  const l = { ...listing, grade: grade || listing.grade };
  const text = window.buildListingText(l);

  function copy() {
    try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800);
    onToast("Listing text copied");
  }

  return (
    <div style={{ background: Cx.bg, minHeight: "100%", paddingBottom: 28 }}>
      <window.MobileScreens1.MHeader title="Listing" onBack={onBack} />
      <window.MobileScreens1.MPhoto icon="Wrench" h={190} />
      <div style={{ padding: "18px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: Cx.fg }}>{l.part}</h2>
          {status === "Sold" && <span style={{ fontSize: 12, fontWeight: 700, color: Cx.muted }}>SOLD</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <window.MobileScreens1.MBadge grade={l.grade} />
          <span className="tnum" style={{ fontSize: 17, fontWeight: 800, color: Cx.fg }}>${l.price}</span>
        </div>

        <div style={{ ...m2lbl, marginTop: 22 }}>Listing text</div>
        <pre style={{
          margin: 0, background: Cx.surface, border: `1px solid ${Cx.line}`, borderRadius: 14,
          padding: 15, fontSize: 13.5, lineHeight: 1.6, color: Cx.fg, fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap",
        }}>{text}</pre>

        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 14, fontSize: 12.5, color: Cx.muted, lineHeight: 1.5 }}>
          <I name="Info" size={15} color={Cx.muted} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Facebook & OfferUp don't allow auto-posting. Copy this, paste it in, and attach the photo — it's already in your camera roll.</span>
        </div>

        <div style={{ display: "grid", gap: 11, marginTop: 18 }}>
          <window.MobileScreens1.MBtn label={copied ? "Copied!" : "Copy listing text"} icon={copied ? "CheckCheck" : "Copy"} onClick={copy} />
          <window.MobileScreens1.MBtn label="Share to OfferUp / other apps" icon="Share2" variant="secondary" onClick={() => onToast("Opened share sheet")} />
          {status !== "Sold" && <window.MobileScreens1.MBtn label="Mark as sold" variant="secondary" onClick={() => { setStatus("Sold"); onToast("Marked as sold"); }} />}
        </div>
      </div>
    </div>
  );
}

// 5. Listings
function MListings({ onOpen, onNav }) {
  const I = window.Icon;
  const [filter, setFilter] = useStateMob2("All");
  const tabs = ["All", "Draft", "Posted", "Sold"];
  const rows = window.LISTINGS.filter((l) => filter === "All" || l.status === filter);
  const statusC = { Posted: Cx.success, Draft: Cx.muted, Sold: Cx.signal };
  return (
    <div style={{ background: Cx.bg, minHeight: "100%", paddingBottom: 96 }}>
      <window.MobileScreens1.MHeader title="My listings" sub={`${window.LISTINGS.length} parts across every marketplace`} />
      <div style={{ display: "flex", gap: 7, padding: "0 18px 14px", overflowX: "auto" }}>
        {tabs.map((t) => {
          const on = filter === t;
          return (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: "8px 15px", borderRadius: 99, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap",
              border: `1px solid ${on ? Cx.accent : Cx.line}`,
              background: on ? "rgba(220,38,38,0.12)" : "transparent",
              color: on ? "#fca5a5" : Cx.muted,
            }}>{t}</button>
          );
        })}
      </div>
      <div style={{ padding: "0 18px", display: "grid", gap: 11 }}>
        {rows.map((l) => (
          <button key={l.id} onClick={() => onOpen(l)} style={{
            display: "flex", alignItems: "center", gap: 13, padding: 13, borderRadius: 16,
            background: Cx.surface, border: `1px solid ${Cx.line}`, width: "100%",
          }}>
            <div className="photo-cell" style={{ width: 58, height: 58, borderRadius: 12, flexShrink: 0 }}>
              <I name="Wrench" size={22} strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: Cx.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.part}</div>
              <div style={{ fontSize: 12.5, color: Cx.muted, marginBottom: 6 }}>{l.vehicle}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <window.MobileScreens1.MBadge grade={l.grade} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: statusC[l.status], display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: statusC[l.status] }} />{l.status}
                </span>
              </div>
            </div>
            <div className="tnum" style={{ fontSize: 16, fontWeight: 800, color: Cx.fg }}>${l.price}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// 6. Messages — thread list + conversation (buyer chat)
function MMessages() {
  const I = window.Icon;
  const [openId, setOpenId] = useStateMob2(null);
  const [draft, setDraft] = useStateMob2("");
  const marketC = { Facebook: "#60A5FA", OfferUp: Cx.success, eBay: "#F87171" };

  if (openId) {
    const t = window.THREADS.find((x) => x.id === openId);
    return (
      <div style={{ background: Cx.bg, height: "100%", display: "flex", flexDirection: "column" }}>
        <window.MobileScreens1.MHeader
          title={t.name}
          sub={t.part}
          onBack={() => setOpenId(null)}
          right={<div style={mAvatar}>{t.avatar}</div>}
        />
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {t.messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.from === "me" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "78%", padding: "10px 14px", borderRadius: 17, fontSize: 14.5, lineHeight: 1.4, color: "#fff",
                background: msg.from === "me" ? Cx.accent : Cx.surface2,
                borderBottomRightRadius: msg.from === "me" ? 5 : 17,
                borderBottomLeftRadius: msg.from === "me" ? 17 : 5,
              }}>
                {msg.text}
                <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, textAlign: "right" }}>{msg.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px 28px", borderTop: `1px solid ${Cx.line}` }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" style={{
            flex: 1, border: `1px solid ${Cx.line}`, background: Cx.surface2, borderRadius: 22, padding: "11px 16px", color: Cx.fg, fontSize: 14.5, outline: "none",
          }} />
          <button onClick={() => setDraft("")} style={{ width: 42, height: 42, borderRadius: 99, border: "none", background: Cx.accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <I name="Send" size={18} color="#fff" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: Cx.bg, minHeight: "100%", paddingBottom: 96 }}>
      <window.MobileScreens1.MHeader title="Messages" sub="Buyer inquiries from your marketplaces" />
      <div style={{ display: "grid" }}>
        {window.THREADS.map((t) => {
          const last = t.messages[t.messages.length - 1];
          return (
            <button key={t.id} onClick={() => setOpenId(t.id)} style={{
              display: "flex", gap: 13, padding: "13px 18px", border: "none", borderBottom: `1px solid ${Cx.line}`,
              background: "transparent", width: "100%", alignItems: "flex-start",
            }}>
              <div style={mAvatar}>{t.avatar}</div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: Cx.fg }}>{t.name}</span>
                  <span style={{ fontSize: 11.5, color: Cx.muted, flexShrink: 0 }}>{t.time}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: marketC[t.market], flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: Cx.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.part}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: t.unread ? Cx.fg : Cx.muted, fontWeight: t.unread ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {last.from === "me" ? "You: " : ""}{last.text}
                  </span>
                  {t.unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: Cx.accent, color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 5px", flexShrink: 0 }}>{t.unread}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
const mAvatar = { width: 44, height: 44, borderRadius: 99, background: Cx.surface2, border: `1px solid ${Cx.line}`, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: Cx.fg, flexShrink: 0 };

// 7. Account
function MAccount({ onSignOut, onBack }) {
  const I = window.Icon;
  const S = window.SHOP;
  const items = [
    { icon: "Store", label: "Shop profile", sub: S.location },
    { icon: "Users", label: "Team & roles", sub: `${S.members.length} members` },
    { icon: "CreditCard", label: "Billing", sub: `${S.plan} · ${S.trialDaysLeft} days left in trial` },
    { icon: "Bell", label: "Notifications", sub: null },
    { icon: "CircleHelp", label: "Help & support", sub: null },
  ];
  return (
    <div style={{ background: Cx.bg, minHeight: "100%", paddingBottom: 96 }}>
      <window.MobileScreens1.MHeader title="Account" onBack={onBack} />
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, background: Cx.surface, border: `1px solid ${Cx.line}` }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: Cx.accent, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 700 }}>{S.initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: Cx.fg }}>{S.owner}</div>
            <div style={{ fontSize: 13, color: Cx.muted }}>{S.role} · {S.name}</div>
          </div>
        </div>

        <div style={{ marginTop: 16, borderRadius: 18, background: Cx.surface, border: `1px solid ${Cx.line}`, overflow: "hidden" }}>
          {items.map((it, i) => (
            <button key={it.label} style={{
              display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "14px 16px",
              border: "none", borderBottom: i < items.length - 1 ? `1px solid ${Cx.line}` : "none", background: "transparent",
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: Cx.surface2, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <I name={it.icon} size={17} color={Cx.muted} />
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: Cx.fg }}>{it.label}</div>
                {it.sub && <div style={{ fontSize: 12, color: Cx.muted }}>{it.sub}</div>}
              </div>
              <I name="ChevronRight" size={17} color={Cx.line} />
            </button>
          ))}
        </div>

        <button onClick={onSignOut} style={{
          marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%",
          padding: "15px 0", borderRadius: 14, border: `1px solid ${Cx.line}`, background: "transparent", color: Cx.danger, fontSize: 15, fontWeight: 600,
        }}>
          <I name="LogOut" size={18} color={Cx.danger} /> Sign out
        </button>
      </div>
    </div>
  );
}

window.MobileScreens2 = { MReview, MListingDetail, MListings, MMessages, MAccount };
