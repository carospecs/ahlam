// CaroSpecs dashboard — shell (sidebar + topbar), shared primitives, view router.
const { useState: useStateD } = React;

const NAV = [
  { section: "Marketplace" },
  { id: "overview", label: "Overview", icon: "LayoutDashboard" },
  { id: "browse", label: "Browse market", icon: "Store" },
  { section: "My shop" },
  { id: "vehicles", label: "Shop vehicles", icon: "Car" },
  { id: "parts", label: "Shop parts", icon: "Wrench" },
  { id: "add", label: "Add vehicle", icon: "CirclePlus" },
  { id: "photos", label: "Photos", icon: "Images" },
  { section: "Assist" },
  { id: "aichat", label: "AI assistant", icon: "Sparkles" },
  { id: "messages", label: "Messages", icon: "MessageSquare", badge: 3 },
];

const PAGE_META = {
  overview: { title: "Overview", sub: "Westside Auto Salvage · Long Beach, CA" },
  browse:   { title: "Browse market", sub: "What buyers see — cars and parts listed for sale" },
  vehicles: { title: "Shop vehicles", sub: "Your cars — sell whole, part them out, or both" },
  parts:    { title: "Shop parts", sub: "Draft, posted, and sold parts across every marketplace" },
  add:      { title: "Add a vehicle", sub: "Snap or upload 4–6 photos — AI does the rest" },
  photos:   { title: "Photos", sub: "Every shot, grouped by vehicle" },
  aichat:   { title: "AI assistant", sub: "Ask about pricing, fitment, and listings" },
  messages: { title: "Messages", sub: "Buyer inquiries from Facebook, OfferUp & eBay" },
};

// ---- shared primitives ----------------------------------------------------
function ConditionBadge({ grade, size = "md" }) {
  const c = window.CONDITION_COLOR[grade];
  const pad = size === "sm" ? "2px 8px" : "3px 10px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      borderRadius: 7, padding: pad, fontSize: size === "sm" ? 11.5 : 12.5, fontWeight: 700,
      color: c, background: `color-mix(in srgb, ${c} 16%, transparent)`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {grade}
    </span>
  );
}

function SellModeBadge({ mode, size = "md" }) {
  const m = window.SELL_MODE[mode];
  if (!m) return null;
  const pad = size === "sm" ? "2px 8px" : "3px 10px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      borderRadius: 7, padding: pad, fontSize: size === "sm" ? 11 : 12, fontWeight: 700,
      color: m.color, background: `color-mix(in srgb, ${m.color} 15%, transparent)`,
    }}>
      <window.Icon name={m.icon} size={size === "sm" ? 11 : 13} /> {m.short}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    Posted: { c: "var(--success)", icon: "Send" },
    Draft:  { c: "var(--muted)", icon: "PencilLine" },
    Sold:   { c: "var(--signal)", icon: "CircleCheck" },
  };
  const m = map[status] || map.Draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7,
      padding: "3px 9px", fontSize: 12, fontWeight: 600, color: m.c,
      background: `color-mix(in srgb, ${m.c} 14%, transparent)`,
    }}>
      <window.Icon name={m.icon} size={12} /> {status}
    </span>
  );
}

function PhotoCell({ icon = "Car", label, style = {}, iconSize = 30 }) {
  return (
    <div className="photo-cell" style={{ borderRadius: "var(--radius-md)", ...style }}>
      <window.Icon name={icon} size={iconSize} strokeWidth={1.5} />
      {label && <span style={{ position: "absolute", bottom: 8, left: 10, fontSize: 11, color: "#6b7793" }}>{label}</span>}
    </div>
  );
}

function MarketChip({ name }) {
  const icon = { Facebook: "Facebook", OfferUp: "Tag", eBay: "ShoppingBag" }[name] || "Globe";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
      color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 9px",
    }}>
      <window.Icon name={icon} size={12} /> {name}
    </span>
  );
}

function Card({ children, style = {}, pad = 18 }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: "var(--radius-lg)", padding: pad, ...style,
    }}>{children}</div>
  );
}

window.UI = { ConditionBadge, SellModeBadge, StatusBadge, PhotoCell, MarketChip, Card };

// ---- shell ----------------------------------------------------------------
function Sidebar({ active, onNav, onSignOut }) {
  const I = window.Icon;
  return (
    <aside style={sx.sidebar}>
      <div style={sx.brand}>
        <span style={sx.logo}><I name="Wrench" size={18} strokeWidth={2.25} color="#fff" /></span>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>CaroSpecs</span>
      </div>

      <nav style={{ display: "grid", gap: 3, marginTop: 4, overflowY: "auto" }}>
        {NAV.map((n, i) => {
          if (n.section) {
            return (
              <div key={"s" + i} style={sx.navSection}>{n.section}</div>
            );
          }
          const on = active === n.id;
          return (
            <button key={n.id} onClick={() => onNav(n.id)} style={{ ...sx.navItem, ...(on ? sx.navItemOn : {}) }}>
              <I name={n.icon} size={18} color={on ? "#fff" : "var(--muted)"} />
              <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>
              {n.badge && <span style={sx.navBadge}>{n.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "grid", gap: 12 }}>
        <div style={sx.shopCard}>
          <div style={sx.shopIcon}><I name="Store" size={16} color="var(--accent)" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Westside Auto Salvage</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Owner · 3 members</div>
          </div>
          <I name="ChevronsUpDown" size={15} color="var(--muted)" />
        </div>
        <button style={sx.signout} onClick={onSignOut}>
          <I name="LogOut" size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Topbar({ meta, onAdd, onSignOut }) {
  const I = window.Icon;
  return (
    <header style={sx.topbar}>
      <div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em" }}>{meta.title}</h1>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--muted)" }}>{meta.sub}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={sx.search}>
          <I name="Search" size={16} color="var(--muted)" />
          <input placeholder="Search parts, vehicles, VIN…" style={sx.searchInput} />
        </div>
        <button style={sx.iconBtn}><I name="Bell" size={18} color="var(--muted)" /><span style={sx.notifDot} /></button>
        <button style={sx.addBtn} onClick={onAdd}>
          <I name="Plus" size={17} /> Add vehicle
        </button>
        <window.ProfileMenu onSignOut={onSignOut} />
      </div>
    </header>
  );
}

function Dashboard({ onSignOut }) {
  const [active, setActive] = useStateD("overview");
  const [vehicle, setVehicle] = useStateD(null);
  const meta = PAGE_META[active];
  const views = window.VIEWS || {};
  const View = views[active] || (() => null);

  React.useEffect(() => {
    window.csOpenVehicle = (v) => setVehicle(v);
  }, []);

  function nav(id) { setVehicle(null); setActive(id); }

  const VehicleProfile = (window.VIEWS && window.VIEWS.vehicleProfile);
  const showProfile = vehicle && VehicleProfile;
  const headMeta = showProfile
    ? { title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, sub: "Vehicle profile — whole car and its parts" }
    : meta;

  return (
    <div style={sx.layout}>
      <Sidebar active={showProfile ? "vehicles" : active} onNav={nav} onSignOut={onSignOut} />
      <main style={sx.main}>
        <Topbar meta={headMeta} onAdd={() => nav("add")} onSignOut={onSignOut} />
        <div style={sx.content} key={showProfile ? "vp" + vehicle.id : active}>
          {showProfile
            ? <VehicleProfile v={vehicle} go={nav} onBack={() => setVehicle(null)} />
            : <View go={nav} />}
        </div>
      </main>
      <window.ExportModal />
      <window.ToastHost />
    </div>
  );
}

const sx = {
  layout: { display: "grid", gridTemplateColumns: "248px 1fr", height: "100vh", overflow: "hidden" },
  sidebar: {
    background: "var(--surface)", borderRight: "1px solid var(--line)",
    padding: 18, display: "flex", flexDirection: "column", gap: 6,
  },
  brand: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 14px" },
  logo: { width: 34, height: 34, borderRadius: 10, background: "var(--accent)", display: "grid", placeItems: "center" },
  navItem: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10,
    border: "none", background: "transparent", color: "var(--muted)", fontSize: 14, fontWeight: 600,
    width: "100%", transition: "background 0.12s, color 0.12s",
  },
  navItemOn: { background: "var(--surface2)", color: "var(--foreground)" },
  navSection: { fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "12px 12px 4px" },
  navBadge: { background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: "grid", placeItems: "center", padding: "0 5px" },
  shopCard: {
    display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12,
    background: "var(--surface2)", border: "1px solid var(--line)",
  },
  shopIcon: { width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center", flexShrink: 0 },
  signout: {
    display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10,
    border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 600,
  },
  main: { display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" },
  topbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
    padding: "16px 28px", borderBottom: "1px solid var(--line)", background: "rgba(27,35,54,0.4)",
  },
  search: {
    display: "flex", alignItems: "center", gap: 9, padding: "0 12px", width: 280,
    background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10,
  },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, padding: "9px 0" },
  iconBtn: { position: "relative", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", display: "grid", placeItems: "center" },
  notifDot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: 999, background: "var(--accent)", border: "1.5px solid var(--surface)" },
  addBtn: {
    display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10,
    border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600,
  },
  content: { flex: 1, overflowY: "auto", padding: 28 },
};

window.Dashboard = Dashboard;
