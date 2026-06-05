// Modals + chrome — Export/listing-detail modal, Profile menu, Toast.
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

// ---- Toast ----------------------------------------------------------------
function ToastHost() {
  const [msg, setMsg] = useStateM(null);
  useEffectM(() => {
    window.csToast = (text) => {
      setMsg(text);
      clearTimeout(window.__csToastT);
      window.__csToastT = setTimeout(() => setMsg(null), 2200);
    };
  }, []);
  if (!msg) return null;
  return (
    <div style={mx.toast} className="fade-up">
      <window.Icon name="CircleCheck" size={17} color="var(--success)" />
      {msg}
    </div>
  );
}

// ---- Profile menu ---------------------------------------------------------
function ProfileMenu({ onSignOut }) {
  const I = window.Icon;
  const S = window.SHOP;
  const [open, setOpen] = useStateM(false);
  const ref = useRefM(null);
  useEffectM(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={mx.profileBtn} onClick={() => setOpen(!open)}>
        <span style={mx.avatar}>{S.initials}</span>
        <span style={{ textAlign: "left", lineHeight: 1.2 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{S.owner}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>{S.role}</span>
        </span>
        <I name="ChevronDown" size={15} color="var(--muted)" />
      </button>

      {open && (
        <div style={mx.menu} className="fade-up">
          <div style={mx.menuHead}>
            <span style={{ ...mx.avatar, width: 40, height: 40, fontSize: 15 }}>{S.initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{S.owner}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{S.email}</div>
            </div>
          </div>
          <div style={mx.planRow}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{S.plan} plan</div>
              <div style={{ fontSize: 11.5, color: "var(--signal)" }}>{S.trialDaysLeft} days left in trial</div>
            </div>
            <button style={mx.upgradeBtn}>Manage</button>
          </div>
          {[
            { icon: "User", label: "Account settings" },
            { icon: "Store", label: "Shop profile" },
            { icon: "Users", label: "Team & roles" },
            { icon: "CreditCard", label: "Billing" },
            { icon: "Bell", label: "Notifications" },
          ].map((m) => (
            <button key={m.label} style={mx.menuItem} onClick={() => { setOpen(false); window.csToast(`${m.label} — demo`); }}>
              <I name={m.icon} size={16} color="var(--muted)" /> {m.label}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
          <button style={{ ...mx.menuItem, color: "var(--danger)" }} onClick={onSignOut}>
            <I name="LogOut" size={16} color="var(--danger)" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Export / listing-detail modal ----------------------------------------
const MARKET_META = {
  Facebook: { icon: "Facebook", auto: false, color: "#4267B2" },
  OfferUp:  { icon: "Tag", auto: false, color: "#3FB950" },
  eBay:     { icon: "ShoppingBag", auto: true, color: "#E53238" },
};

function ExportModal() {
  const I = window.Icon;
  const [listing, setListing] = useStateM(null);
  const [status, setStatus] = useStateM("Draft");
  const [copied, setCopied] = useStateM(false);

  useEffectM(() => {
    window.csOpenExport = (l) => { setListing(l); setStatus(l.status); setCopied(false); };
    function onKey(e) { if (e.key === "Escape") setListing(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!listing) return null;
  const text = window.buildListingText(listing);
  const lowConf = listing.confidence === "low";

  function copy() {
    try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800);
    window.csToast("Listing text copied to clipboard");
  }
  function exportCsv() {
    window.csToast("Exported listing as CSV");
  }
  function close() { setListing(null); }

  const photos = Array.from({ length: Math.max(listing.photos, 1) });

  return (
    <div style={mx.overlay} onMouseDown={close}>
      <div style={mx.modal} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div style={mx.modalHead}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <window.UI.StatusBadge status={status} />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{listing.category}</span>
          </div>
          <button style={mx.closeBtn} onClick={close}><I name="X" size={18} color="var(--muted)" /></button>
        </div>

        <div style={mx.modalBody} className="cs-modal-body">
          {/* left — photos + facts */}
          <div style={mx.leftCol}>
            <window.UI.PhotoCell icon="Wrench" style={{ aspectRatio: "4/3", borderRadius: "var(--radius-md)" }} iconSize={40} label="Primary photo" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {photos.slice(0, 3).map((_, i) => (
                <window.UI.PhotoCell key={i} icon="Camera" style={{ aspectRatio: "1", borderRadius: 9 }} iconSize={16} />
              ))}
            </div>
            <div style={{ marginTop: 4 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{listing.part}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <window.UI.ConditionBadge grade={listing.grade} size="sm" />
                <span className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--success)" }}>${listing.price}</span>
              </div>
              <Fact icon="Car" label="Fits" value={listing.fitment} />
              <Fact icon="Eye" label="Marketplace views" value={listing.views || "—"} />
            </div>
            {lowConf && (
              <div style={mx.lowConf}>
                <I name="TriangleAlert" size={15} color="var(--signal)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>AI wasn't fully confident here. Double-check the part name and fitment before posting.</span>
              </div>
            )}
          </div>

          {/* right — generated listing text + export */}
          <div style={mx.rightCol}>
            <div style={mx.sectionLabel}>Marketplace listing text</div>
            <pre style={mx.preview}>{text}</pre>

            <div style={mx.note}>
              <I name="Info" size={14} color="var(--muted)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Facebook & OfferUp don't allow auto-posting. Copy this text, paste it in, and attach the photos — they're already saved.</span>
            </div>

            <div style={mx.sectionLabel}>Copy for marketplace</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {window.MARKETS.map((m) => {
                const meta = MARKET_META[m];
                const posted = listing.markets.includes(m);
                return (
                  <button key={m} style={mx.marketBtn} onClick={copy}>
                    <I name={meta.icon} size={16} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m}</span>
                    {posted
                      ? <span style={mx.postedDot}><I name="Check" size={11} /> Posted</span>
                      : <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{meta.auto ? "Auto-post" : "Copy & paste"}</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button style={{ ...mx.primaryBtn, flex: 1 }} onClick={copy}>
                <I name={copied ? "CheckCheck" : "Copy"} size={16} /> {copied ? "Copied!" : "Copy listing text"}
              </button>
              <button style={mx.ghostBtn} onClick={exportCsv}><I name="Download" size={16} /> CSV</button>
              <button style={mx.ghostBtn} onClick={() => window.csToast("Opened share sheet")}><I name="Share2" size={16} /></button>
            </div>

            <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />

            <div style={mx.sectionLabel}>Status</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Draft", "Posted", "Sold"].map((s) => {
                const on = status === s;
                return (
                  <button key={s} onClick={() => { setStatus(s); window.csToast(`Marked as ${s}`); }} style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: on ? "rgba(220,38,38,0.12)" : "transparent",
                    color: on ? "#fca5a5" : "var(--muted)",
                  }}>{s}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, fontSize: 13 }}>
      <window.Icon name={icon} size={14} color="var(--muted)" />
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ marginLeft: "auto", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const mx = {
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 18px", fontSize: 13.5, fontWeight: 500, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.7)" },
  profileBtn: { display: "flex", alignItems: "center", gap: 9, padding: "5px 10px 5px 5px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)" },
  avatar: { width: 30, height: 30, borderRadius: 9, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flexShrink: 0 },
  menu: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 270, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 8, zIndex: 100, boxShadow: "0 24px 50px -20px rgba(0,0,0,0.7)" },
  menuHead: { display: "flex", alignItems: "center", gap: 11, padding: "8px 8px 12px" },
  planRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, margin: "0 0 6px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)" },
  upgradeBtn: { fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 8, padding: "6px 12px" },
  menuItem: { display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 9, border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 500, textAlign: "left" },
  overlay: { position: "fixed", inset: 0, zIndex: 150, background: "rgba(7,11,22,0.72)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 },
  modal: { width: "min(820px, 100%)", maxHeight: "90vh", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" },
  closeBtn: { width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center" },
  modalBody: { display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 22, padding: 20, overflowY: "auto" },
  leftCol: { display: "flex", flexDirection: "column", gap: 10 },
  rightCol: { display: "flex", flexDirection: "column", gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 },
  preview: { margin: 0, background: "rgba(15,23,42,0.6)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 14, fontSize: 12.5, lineHeight: 1.65, color: "var(--foreground)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" },
  note: { display: "flex", gap: 8, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "10px 12px" },
  marketBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "11px 6px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)" },
  postedDot: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "var(--success)" },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600 },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600 },
  lowConf: { display: "flex", gap: 8, fontSize: 12, color: "var(--signal)", lineHeight: 1.5, background: "var(--signal-bg)", border: "1px solid color-mix(in srgb, var(--signal) 40%, transparent)", borderRadius: 10, padding: "10px 12px" },
};

window.ProfileMenu = ProfileMenu;
window.ExportModal = ExportModal;
window.ToastHost = ToastHost;
