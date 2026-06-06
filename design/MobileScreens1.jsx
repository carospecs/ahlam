// Ahlam mobile — primitives, bottom nav, sign-in, overview, capture (Add tab).
const { useState: useStateMob, useEffect: useEffectMob } = React;

const C = {
  bg: "#0F172A", surface: "#1B2336", surface2: "#272F42", fg: "#F8FAFC",
  muted: "#94A3B8", line: "#334155", accent: "#DC2626", success: "#22C55E",
  signal: "#F59E0B", danger: "#EF4444",
};
const condC = { Good: C.success, Poor: C.danger };

// ---------- primitives ----------
function MBtn({ label, icon, variant = "primary", onClick, style = {} }) {
  const I = window.Icon;
  const v = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    secondary: { background: "transparent", color: C.fg, border: `1px solid ${C.line}` },
  }[variant];
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
      width: "100%", padding: "15px 18px", borderRadius: 14, fontSize: 16, fontWeight: 600, ...v, ...style,
    }}>
      {icon && <I name={icon} size={19} color={variant === "primary" ? "#fff" : C.fg} />}
      {label}
    </button>
  );
}

function MBadge({ grade }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700,
      color: condC[grade], background: `color-mix(in srgb, ${condC[grade]} 16%, transparent)`,
      borderRadius: 8, padding: "4px 11px",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: condC[grade] }} /> {grade}
    </span>
  );
}

function MSellBadge({ mode, small }) {
  const m = window.SELL_MODE[mode];
  if (!m) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: small ? 11 : 12.5, fontWeight: 700,
      color: m.color, background: `color-mix(in srgb, ${m.color} 16%, transparent)`, borderRadius: 7, padding: small ? "3px 8px" : "4px 10px",
    }}>
      <window.Icon name={m.icon} size={small ? 11 : 13} /> {m.short}
    </span>
  );
}

function MPhoto({ icon = "Car", h = 180, label, iconSize = 42, radius = 16 }) {
  return (
    <div className="photo-cell" style={{ height: h, borderRadius: radius, width: "100%" }}>
      <window.Icon name={icon} size={iconSize} strokeWidth={1.5} />
      {label && <span style={{ position: "absolute", bottom: 9, left: 12, fontSize: 12, color: "#6b7793" }}>{label}</span>}
    </div>
  );
}

function MHeader({ title, sub, onBack, right }) {
  const I = window.Icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "54px 18px 14px" }}>
      {onBack && <button onClick={onBack} style={mob.backBtn}><I name="ChevronLeft" size={20} color={C.fg} /></button>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em" }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// avatar that opens Account (top corner)
function MAvatarBtn({ onClick }) {
  return <button onClick={onClick} style={mob.avatarBtn}>{window.SHOP.initials}</button>;
}

// ---------- bottom nav (6 items per spec) ----------
function MTabBar({ active, onNav }) {
  const I = window.Icon;
  const tabs = [
    { id: "photos", icon: "Images", label: "Photos" },
    { id: "aichat", icon: "Sparkles", label: "AI chat" },
    { id: "add", icon: "CirclePlus", label: "Add" },
    { id: "overview", icon: "LayoutDashboard", label: "Overview" },
    { id: "browse", icon: "Store", label: "Browse" },
    { id: "messages", icon: "MessageSquare", label: "Messages", badge: 3 },
  ];
  return (
    <div style={mob.tabBar}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onNav(t.id)} style={mob.tabItem}>
            <div style={{ position: "relative" }}>
              <I name={t.icon} size={22} color={on ? C.accent : C.muted} strokeWidth={on ? 2.4 : 2} />
              {t.badge && <span style={mob.tabBadge}>{t.badge}</span>}
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: on ? C.accent : C.muted }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Sign in ----------
function MSignIn({ onAuth }) {
  const I = window.Icon;
  return (
    <div className="grain" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "60px 26px 40px", background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 40 }}>
        <span style={mob.logo}><I name="Wrench" size={20} strokeWidth={2.25} color="#fff" /></span>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.fg }}>Ahlam</span>
      </div>
      <div style={{ marginTop: 20 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: C.fg, lineHeight: 1.12 }}>
          Photograph a part.<br /><span style={{ color: C.accent }}>List it in seconds.</span>
        </h1>
        <p style={{ margin: "14px 0 0", fontSize: 15, color: C.muted, lineHeight: 1.5 }}>
          Sign in to your shop to snap parts, review AI grades, and post listings everywhere you sell.
        </p>
      </div>
      <div style={{ marginTop: 36, display: "grid", gap: 13 }}>
        <div style={mob.field}><I name="Mail" size={18} color={C.muted} /><input defaultValue="ray@westsidesalvage.com" style={mob.input} /></div>
        <div style={mob.field}><I name="Lock" size={18} color={C.muted} /><input type="password" defaultValue="password" style={mob.input} /></div>
        <MBtn label="Sign in" icon="ArrowRight" onClick={onAuth} style={{ marginTop: 6 }} />
        <MBtn label="Create a shop account" variant="secondary" onClick={onAuth} />
      </div>
      <p style={{ marginTop: "auto", fontSize: 11.5, color: C.muted, textAlign: "center", lineHeight: 1.5 }}>
        AI can make mistakes — every listing is reviewed before posting.
      </p>
    </div>
  );
}

// ---------- Overview (main page) ----------
function MOverview({ onNav, onAccount, onVehicle }) {
  const I = window.Icon;
  const stats = [
    { icon: "Car", label: "Vehicles", value: "5", tone: C.accent },
    { icon: "Wrench", label: "Parts ID'd", value: "42", tone: C.muted },
    { icon: "Tag", label: "Active", value: "18", tone: C.success },
    { icon: "DollarSign", label: "Sold / mo", value: "$1,840", tone: C.signal },
  ];
  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 110 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 18px 8px" }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted }}>Overview</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.fg }}>{window.SHOP.name}</div>
        </div>
        <MAvatarBtn onClick={onAccount} />
      </div>

      <div style={{ padding: "8px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 15 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${s.tone} 15%, transparent)`, display: "grid", placeItems: "center" }}>
              <I name={s.icon} size={17} color={s.tone} />
            </div>
            <div className="tnum" style={{ fontSize: 23, fontWeight: 800, color: C.fg, marginTop: 11 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "24px 18px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.fg }}>Your vehicles</span>
          <button onClick={() => onNav("browse")} style={mob.link}>Browse market</button>
        </div>
        <div style={{ display: "grid", gap: 11 }}>
          {window.VEHICLES.slice(0, 4).map((v) => (
            <button key={v.id} onClick={() => onVehicle(v)} style={mob.vehRow}>
              <div className="photo-cell" style={{ width: 56, height: 48, borderRadius: 11, flexShrink: 0 }}>
                <I name="Car" size={22} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.fg }}>{v.year} {v.make} {v.model}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{v.parts} parts · {v.mileage}</div>
              </div>
              <MSellBadge mode={v.sellMode} small />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Capture (Add tab) ----------
function MCapture({ onCapture, onAccount }) {
  const I = window.Icon;
  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 110 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 18px 8px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.fg }}>Add a vehicle</div>
        <MAvatarBtn onClick={onAccount} />
      </div>
      <div style={{ padding: "16px 18px 0" }}>
        <button onClick={onCapture} style={mob.captureHero}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: C.accent, display: "grid", placeItems: "center" }}>
            <I name="Camera" size={30} color="#fff" />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.fg }}>Photograph a part</div>
          <div style={{ fontSize: 13.5, color: C.muted, textAlign: "center", lineHeight: 1.5, maxWidth: 260 }}>
            Snap it — AI identifies the part, grades condition, and drafts the listing.
          </div>
        </button>
        <div style={{ marginTop: 12 }}>
          <MBtn label="Upload from library" icon="ImageUp" variant="secondary" onClick={onCapture} />
        </div>
        <div style={{ marginTop: 22, display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
          <I name="Info" size={15} color={C.muted} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Snap the VIN plate too and we'll keep the vehicle history on file.</span>
        </div>
      </div>
    </div>
  );
}

window.MobileScreens1 = { MSignIn, MOverview, MCapture, MHeader, MTabBar, MBtn, MBadge, MSellBadge, MPhoto, MAvatarBtn, C, condC };

const mob = {
  logo: { width: 38, height: 38, borderRadius: 11, background: C.accent, display: "grid", placeItems: "center" },
  field: { display: "flex", alignItems: "center", gap: 11, padding: "0 15px", background: "rgba(39,47,66,0.6)", border: `1px solid ${C.line}`, borderRadius: 13 },
  input: { flex: 1, border: "none", outline: "none", background: "transparent", color: C.fg, fontSize: 15, padding: "14px 0" },
  backBtn: { width: 38, height: 38, borderRadius: 11, border: `1px solid ${C.line}`, background: C.surface2, display: "grid", placeItems: "center", flexShrink: 0 },
  avatarBtn: { width: 40, height: 40, borderRadius: 12, background: C.accent, color: "#fff", fontSize: 14, fontWeight: 700, border: "none", flexShrink: 0 },
  captureHero: { width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "30px 20px", borderRadius: 22, border: `1.5px dashed ${C.line}`, background: "rgba(39,47,66,0.35)" },
  link: { border: "none", background: "transparent", color: C.accent, fontSize: 13.5, fontWeight: 600 },
  vehRow: { display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: C.surface, border: `1px solid ${C.line}`, width: "100%" },
  tabBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 82, paddingBottom: 20, display: "flex", background: "rgba(27,35,54,0.94)", backdropFilter: "blur(12px)", borderTop: `1px solid ${C.line}` },
  tabItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "none", background: "transparent", paddingTop: 10 },
  tabBadge: { position: "absolute", top: -5, right: -8, minWidth: 15, height: 15, borderRadius: 99, background: C.accent, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 4px" },
};
window.__mob = mob;
