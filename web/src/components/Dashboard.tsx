"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  LayoutDashboard, Store, Car, Wrench, CirclePlus, Images, Sparkles,
  MessageSquare, X, Menu, Bell, Plus, Search, ChevronsUpDown, LogOut,
  Check, CircleCheck, Send, PencilLine, Tag, ShoppingBag,
  Globe, ChevronDown, User, Users, CreditCard, Download, Share2,
  CheckCheck, Info, Copy, ExternalLink, ChevronLeft, ChevronRight, LoaderCircle,
  Sun, Moon, TrendingUp, BookOpen,
} from "lucide-react";
import { buildListingText, buildVehicleText, partsForVehicle } from "./data";
import { Overview } from "./views/Overview";
import { Vehicles } from "./views/Vehicles";
import { Browse } from "./views/Browse";
import { Parts } from "./views/Parts";
import { Messages } from "./views/Messages";
import { AIChat } from "./views/AIChat";
import { Interchange } from "./views/Interchange";
import { ExportCenter } from "./views/ExportCenter";
import { AddVehicle } from "./views/AddVehicle";
import { Analytics } from "./views/Analytics";
import { VehicleProfile } from "./views/VehicleProfile";
import { AccountSettings } from "./views/AccountSettings";
import { ShopProfile, TeamRoles, Billing, Notifications } from "./views/SettingsViews";
import { DashboardSkeleton } from "./UI";
import { BrandChip } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import { I18nProvider, useI18n, useT } from "@/lib/i18n";

export const DataContext = createContext<any>({ user: {}, shop: {}, vehicles: [], listings: [], threads: [], activity: [] });
export function useData() { return useContext(DataContext); }

const NAV = [
  { section: "Marketplace" },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "browse", label: "Browse market", icon: Store },
  { section: "My shop" },
  { id: "vehicles", label: "Vehicles posted", icon: Car },
  { id: "parts", label: "Parts posted", icon: Wrench },
  { id: "add", label: "Add vehicle / parts", icon: CirclePlus },
  { id: "interchange", label: "Interchange", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { section: "Assist" },
  { id: "aichat", label: "AI assistant", icon: Sparkles },
  { id: "export", label: "Export & posting", icon: Send },
  { id: "messages", label: "Messages", icon: MessageSquare },
];

const META: Record<string, { title: string; sub: string }> = {
  overview: { title: "Overview", sub: "Your shop at a glance" },
  browse: { title: "Browse market", sub: "Cars and parts other shops have listed near you" },
  vehicles: { title: "Vehicles posted", sub: "Your cars — drafts, parting out, whole, or both" },
  parts: { title: "Parts posted", sub: "Your parts — drafts, posted, and sold" },
  add: { title: "Add a vehicle", sub: "Snap or upload up to 8 photos + VIN — AI does the rest" },
  analytics: { title: "Analytics", sub: "Views, inquiries, and sales at a glance" },
  aichat: { title: "AI assistant", sub: "Ask about pricing, fitment, and listings" },
  export: { title: "Export & posting", sub: "Cross-post your listings to Facebook, OfferUp, eBay & more" },
  messages: { title: "Messages", sub: "Buyer inquiries from your listings" },
  interchange: { title: "Parts interchange", sub: "Hollander-style cross-reference — search by VIN or part name" },
};

function Sidebar({ active, onNav, onSignOut, open, onClose }: {
  active: string; onNav: (id: string) => void; onSignOut: () => void;
  open: boolean; onClose: () => void;
}) {
  const { shop } = useData();
  const t = useT();

  return (
    <aside style={sx.sidebar} className={"cs-sidebar" + (open ? " open" : "")}>
      <div style={sx.brand}>
        <BrandChip size={34} />
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
        <button className="cs-navclose" onClick={onClose} style={sx.navClose}><X size={18} color="var(--muted)" /></button>
      </div>
      <nav style={{ display: "grid", gap: 3, marginTop: 4, overflowY: "auto" }}>
        {NAV.map((n, i) => {
          if ("section" in n) {
            return <div key={"s" + i} style={sx.navSection}>{t(n.section!)}</div>;
          }
          const on = active === n.id;
          const IconComp = n.icon;
          return (
            <button key={n.id} className="cs-nav-item" onClick={() => onNav(n.id)} style={{ ...sx.navItem, ...(on ? sx.navItemOn : {}) }}>
              <IconComp size={18} color={on ? "var(--accent)" : "var(--muted)"} />
              <span style={{ flex: 1, textAlign: "left" }}>{t(n.label!)}</span>
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", display: "grid", gap: 12 }}>
        {shop.name && (
          <div style={sx.shopCard}>
            <div style={sx.shopIcon}><Store size={16} color="var(--accent)" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shop.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("Owner")} · {shop.members?.length || 0} {t("members")}</div>
            </div>
          </div>
        )}
        <button style={sx.signout} onClick={onSignOut}><LogOut size={16} /> {t("Sign out")}</button>
      </div>
    </aside>
  );
}

function Topbar({ meta, onMenu, onSignOut, onNav }: {
  meta: { title: string; sub: string }; onMenu: () => void;
  onSignOut: () => void; onNav?: (id: string) => void;
}) {
  const t = useT();
  const { lang, setLang } = useI18n();
  return (
    <header style={sx.topbar} className="cs-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button className="cs-hamburger" onClick={onMenu} style={sx.hamburger}><Menu size={20} color="var(--foreground)" /></button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em" }}>{t(meta.title)}</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--muted)" }} className="cs-sub">{t(meta.sub)}</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span title="Language" style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden" }}>
          {(["en", "es"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} aria-label={l === "en" ? "English" : "Español"} style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "#fff" : "var(--muted)" }}>{l.toUpperCase()}</button>
          ))}
        </span>
        <ThemeToggle />
        <ProfileMenu onSignOut={onSignOut} onNav={onNav} />
      </div>
    </header>
  );
}

function ProfileMenu({ onSignOut, onNav }: { onSignOut: () => void; onNav?: (id: string) => void }) {
  const { user } = useData();
  const t = useT();
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => { setLight(document.documentElement.getAttribute("data-theme") === "light"); }, []);

  function toggleTheme() {
    const next = !light;
    setLight(next);
    document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
    try { localStorage.setItem("cs-theme", next ? "light" : "dark"); } catch {}
  }

  const initials = (user.displayName || "U").split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={mx.profileBtn} onClick={() => setOpen(!open)}>
        <span style={mx.avatar}>{initials}</span>
        <span style={{ textAlign: "left", lineHeight: 1.2 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{user.displayName || "User"}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>{user.email || ""}</span>
        </span>
        <ChevronDown size={15} color="var(--muted)" />
      </button>
      {open && (
        <div style={mx.menu} className="fade-up">
          <div style={mx.menuHead}>
            <span style={{ ...mx.avatar, width: 40, height: 40, fontSize: 15 }}>{initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{user.displayName || "User"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email || ""}</div>
            </div>
          </div>
          {[
            { icon: User, label: "Account settings", id: "settings" },
            { icon: Store, label: "Shop profile", id: "shop" },
            { icon: Users, label: "Team & roles", id: "team" },
            { icon: CreditCard, label: "Billing", id: "billing" },
            { icon: Bell, label: "Notifications", id: "notifications" },
          ].map((m) => (
            <button key={m.label} className="cs-nav-item" style={mx.menuItem} onClick={() => { setOpen(false); onNav?.(m.id); }}>
              <m.icon size={16} color="var(--muted)" /> {t(m.label)}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
          <div style={{ ...mx.menuItem, justifyContent: "space-between", cursor: "default" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Globe size={16} color="var(--muted)" /> {t("Language")}</span>
            <span style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
              {(["en", "es"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{ padding: "4px 10px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "#fff" : "var(--muted)" }}>{l.toUpperCase()}</button>
              ))}
            </span>
          </div>
          <button className="cs-nav-item" style={mx.menuItem} onClick={toggleTheme}>
            {light ? <Moon size={16} color="var(--muted)" /> : <Sun size={16} color="var(--muted)" />}
            {light ? t("Dark mode") : t("Light mode")}
          </button>
          <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
          <button style={{ ...mx.menuItem, color: "var(--danger)" }} onClick={onSignOut}>
            <LogOut size={16} color="var(--danger)" /> {t("Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}

const VIEWS: Record<string, React.ComponentType<any>> = {
  overview: Overview, vehicles: Vehicles, browse: Browse, parts: Parts, export: ExportCenter, analytics: Analytics,
  messages: Messages, aichat: AIChat, add: AddVehicle, interchange: Interchange, vehicleProfile: VehicleProfile,
  settings: AccountSettings, shop: ShopProfile, team: TeamRoles, billing: Billing, notifications: Notifications,
};

let toastFn: (msg: string) => void = () => {};
export function csToast(msg: string) { toastFn(msg); }

function ToastHost() {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    toastFn = (text: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, msg: text }].slice(-4)); // cap the stack at 4
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
    };
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div style={mx.toastStack}>
      {toasts.map((t) => (
        <div key={t.id} style={mx.toast} className="fade-up">
          <CircleCheck size={17} color="var(--success)" style={{ flexShrink: 0 }} />
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function ExportModal() {
  const [listing, setListing] = useState<any>(null);
  const [status, setStatus] = useState("Draft");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (window as any).csOpenExport = (l: any) => { setListing(l); setStatus(l.status); setPrice(String(l.price ?? "")); setDesc(l.desc || ""); setCopied(false); };
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setListing(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!listing) return null;
  // Build the marketplace text from the in-progress edits so the preview is live.
  const text = buildListingText({ ...listing, price: Number(price) || listing.price, desc });
  const lowConf = listing.confidence === "low";
  const photos = Array.from({ length: Math.max(listing.photos, 1) });
  const dirty = status !== listing.status || String(price) !== String(listing.price ?? "") || desc !== (listing.desc || "");

  function copy() {
    try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800);
    csToast("Listing text copied to clipboard");
  }
  function close() { setListing(null); }

  // Persist status / price / description for this part listing, then refresh.
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/listings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, status, priceUsd: price === "" ? undefined : Number(price), description: desc }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't save"); setSaving(false); return; }
      csToast("Listing updated");
      (window as any).csReloadData?.();
      setSaving(false);
      close();
    } catch { csToast("Couldn't save — check your connection"); setSaving(false); }
  }

  return (
    <div style={mx.overlay} onMouseDown={close}>
      <div style={mx.modal} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
        <div style={mx.modalHead}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "3px 9px", fontSize: 12, fontWeight: 600, color: status === "Posted" ? "var(--success)" : status === "Sold" ? "var(--signal)" : "var(--muted)", background: `color-mix(in srgb, ${status === "Posted" ? "var(--success)" : status === "Sold" ? "var(--signal)" : "var(--muted)"} 14%, transparent)` }}>
              {status === "Posted" ? <Send size={12} /> : status === "Sold" ? <CircleCheck size={12} /> : <PencilLine size={12} />} {status}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{listing.category}</span>
          </div>
          <button style={mx.closeBtn} onClick={close}><X size={18} color="var(--muted)" /></button>
        </div>
        <div style={mx.modalBody} className="cs-modal-body">
          <div style={mx.leftCol}>
            <div className="photo-cell" style={{ aspectRatio: "4/3", borderRadius: "var(--radius-md)", display: "grid", placeItems: "center", position: "relative", overflow: "hidden", background: "radial-gradient(circle at 30% 25%, rgba(148,163,184,0.10), transparent 60%), linear-gradient(135deg, #20283c 0%, #161d2e 100%)" }}>
              <Wrench size={40} strokeWidth={1.5} color="#5b6680" />
              <span style={{ position: "absolute", bottom: 8, left: 10, fontSize: 11, color: "#6b7793" }}>Primary photo</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {photos.slice(0, 3).map((_, i) => (
                <div key={i} className="photo-cell" style={{ aspectRatio: "1", borderRadius: 9, display: "grid", placeItems: "center", background: "radial-gradient(circle at 30% 25%, rgba(148,163,184,0.10), transparent 60%), linear-gradient(135deg, #20283c 0%, #161d2e 100%)" }}>
                  <Wrench size={16} strokeWidth={1.5} color="#5b6680" />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 4 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{listing.part}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "3px 10px", fontSize: 12.5, fontWeight: 700, color: listing.grade === "Good" ? "var(--success)" : "var(--danger)", background: `color-mix(in srgb, ${listing.grade === "Good" ? "var(--success)" : "var(--danger)"} 16%, transparent)` }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: listing.grade === "Good" ? "var(--success)" : "var(--danger)" }} />{listing.grade}
                </span>
                <span className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--success)" }}>${listing.price}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, fontSize: 13 }}>
                <Car size={14} color="var(--muted)" /><span style={{ color: "var(--muted)" }}>Fits</span><span style={{ marginLeft: "auto", fontWeight: 600, textAlign: "right" }}>{listing.fitment}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 4, fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Views</span><span style={{ marginLeft: "auto", fontWeight: 600 }}>{listing.views || "—"}</span>
              </div>
            </div>
            {lowConf && (
              <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--signal)", lineHeight: 1.5, background: "var(--signal-bg)", border: "1px solid color-mix(in srgb, var(--signal) 40%, transparent)", borderRadius: 10, padding: "10px 12px" }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>AI wasn't fully confident here. Double-check the part name and fitment before posting.</span>
              </div>
            )}
          </div>
          <div style={mx.rightCol}>
            <div style={mx.sectionLabel}>Marketplace listing text</div>
            <pre style={mx.preview}>{text}</pre>
            <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "10px 12px" }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Facebook & OfferUp don't allow auto-posting. Copy this text, paste it in, and attach the photos — they're already saved.</span>
            </div>
            <div style={mx.sectionLabel}>Copy for marketplace</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {["Facebook", "OfferUp", "eBay"].map((m) => {
                const posted = listing.markets?.includes(m);
                return (
                  <button key={m} style={mx.marketBtn} onClick={copy}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m}</span>
                    {posted ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "var(--success)" }}><Check size={11} /> Posted</span> : <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Copy & paste</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button style={{ ...mx.primaryBtn, flex: 1 }} onClick={copy}>
                <Copy size={16} /> {copied ? "Copied!" : "Copy listing text"}
              </button>
              <button style={mx.ghostBtn} onClick={() => csToast("Exported listing as CSV")}><Download size={16} /> CSV</button>
              <button style={mx.ghostBtn} onClick={() => csToast("Opened share sheet")}><Share2 size={16} /></button>
            </div>
            <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 120 }}>
                <div style={mx.sectionLabel}>Price</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "8px 10px" }}>
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>$</span>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="tnum" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 700 }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={mx.sectionLabel}>Status</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Draft", "Posted", "Sold"].map((s) => {
                    const on = status === s;
                    return (
                      <button key={s} onClick={() => setStatus(s)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, border: on ? "1px solid var(--accent)" : "1px solid var(--line)", background: on ? "var(--accent-tint)" : "transparent", color: on ? "var(--accent)" : "var(--muted)" }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={mx.sectionLabel}>Description</div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Add a description buyers will see…" style={{ width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, lineHeight: 1.5, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            <button onClick={save} disabled={saving || !dirty} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 11, border: "none", background: dirty ? "var(--accent)" : "var(--surface2)", color: dirty ? "#fff" : "var(--muted)", fontSize: 14, fontWeight: 600, cursor: dirty ? "pointer" : "default", opacity: saving ? 0.6 : 1 }}>
              {saving ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Check size={16} />} {saving ? "Saving…" : "Submit changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One-time guided tour shown after onboarding. Persists dismissal in localStorage
// so it never nags returning users.
function FirstRunTour({ go }: { go: (id: string) => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem("cs-tour-done")); } catch {} }, []);
  if (!show) return null;
  function done() { try { localStorage.setItem("cs-tour-done", "1"); } catch {} setShow(false); }
  const steps = [
    { icon: CirclePlus, title: "Add a vehicle", desc: "Snap photos — AI grades & prices the parts.", id: "add" },
    { icon: Store, title: "Browse the market", desc: "See what other shops have listed nearby.", id: "browse" },
    { icon: Send, title: "Export & post", desc: "Copy clean listings to every marketplace.", id: "export" },
  ];
  return (
    <div className="fade-up" style={{ marginBottom: 20, border: "1px solid color-mix(in srgb, var(--accent) 40%, var(--line))", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--accent) 7%, var(--surface))", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent)", display: "grid", placeItems: "center" }}><Sparkles size={16} color="#fff" /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Welcome to Ahlam — here's the quick tour</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Three things to try first. Click any to jump in.</div>
        </div>
        <button onClick={done} style={{ padding: "7px 13px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>Got it</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="cs-grid4">
        {steps.map((s) => (
          <button key={s.id} onClick={() => { done(); go(s.id); }} className="cs-card-btn" style={{ textAlign: "left", display: "grid", gap: 6, padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)" }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent-tint)", display: "grid", placeItems: "center" }}><s.icon size={17} color="var(--accent)" /></span>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>{s.title}</span>
            <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CreateShopGate({ user, onDone, onSignOut }: { user: any; onDone: () => void; onSignOut: () => void }) {
  const [accountType, setAccountType] = useState<"shop" | "individual" | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [needForm, setNeedForm] = useState(false);

  const isIndiv = accountType === "individual";

  // On mount, try to claim a pending invite or an existing membership first.
  // Fail open: if the check is slow or errors (e.g. a migration isn't applied),
  // never trap the user on the spinner — fall through to the account picker.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.joined) { onDone(); return; }
        setNeedForm(true); setBusy(false);
      })
      .catch(() => { setNeedForm(true); setBusy(false); })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(type: "shop" | "individual") {
    setAccountType(type); setError("");
    // Individuals don't name a shop — default their workspace to their own name.
    if (type === "individual" && !name.trim()) setName(user?.displayName || (user?.email ? user.email.split("@")[0] : ""));
    if (type === "shop") setName("");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(isIndiv ? "Your name is required" : "Shop name is required"); return; }
    if (!/^\d{5}$/.test(zip.trim())) { setError("Please enter your 5-digit ZIP code"); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, location, zip, phone, accountType }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Could not create account"); setBusy(false); return; }
      onDone();
    } catch { setError("Network error — check your connection"); setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--background)" }}>
      <div style={{ width: "min(440px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 28, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.6)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 13, background: "var(--accent)", display: "grid", placeItems: "center", marginBottom: 16 }}>
          {isIndiv ? <User size={22} color="#fff" /> : <Store size={22} color="#fff" />}
        </div>

        {busy && !needForm ? (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>Setting things up</h1>
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
              <LoaderCircle size={20} style={{ animation: "spin 0.8s linear infinite" }} /> Checking your invites…
            </div>
          </>
        ) : !accountType ? (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>How will you use Ahlam?</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
              Welcome{user?.displayName ? `, ${user.displayName}` : ""}. Pick the option that fits you — you get the same tools either way.
            </p>
            <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
              {[
                { type: "shop" as const, icon: Store, title: "I'm a shop / business", desc: "Salvage yard, mechanic, or dealer. You'll name your shop and can invite a team." },
                { type: "individual" as const, icon: User, title: "I'm an individual seller", desc: "Selling your own car or parts. No shop name needed." },
              ].map((o) => (
                <button key={o.type} onClick={() => pick(o.type)} className="cs-card-btn" style={{ textAlign: "left", display: "flex", gap: 13, alignItems: "flex-start", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}><o.icon size={19} color="var(--accent)" /></span>
                  <span>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{o.title}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>{isIndiv ? "Set up your account" : "Set up your shop"}</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
              {isIndiv ? "Just a few details and you're ready to list." : "Create your shop to start posting vehicles and parts."}
              {" "}<a href="#" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setAccountType(null); setError(""); }}>Change</a>
            </p>
            <form onSubmit={create} style={{ display: "grid", gap: 14, marginTop: 22 }}>
              <Gfield label={isIndiv ? "Your name" : "Shop name"}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={isIndiv ? "Alex Johnson" : "Westside Auto Salvage"} style={gInp} autoFocus /></Gfield>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                <Gfield label="Location (optional)"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Long Beach, CA" style={gInp} /></Gfield>
                <Gfield label="ZIP code"><input value={zip} onChange={(e) => setZip(e.target.value.replace(/[^0-9]/g, ""))} placeholder="90805" maxLength={5} inputMode="numeric" style={gInp} /></Gfield>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6 }}>Your ZIP lets buyers see your area and find your listings by nearest.</div>
              <Gfield label={isIndiv ? "Contact phone (optional)" : "Business phone (optional)"}><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(562) 555-0148" style={gInp} /></Gfield>
              {error && <div style={{ fontSize: 13, color: "var(--danger)" }}>{error}</div>}
              <button type="submit" disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: "none", borderRadius: 12, background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 600, padding: "13px 0", opacity: busy ? 0.65 : 1 }}>
                {busy && <LoaderCircle size={18} style={{ animation: "spin 0.8s linear infinite" }} />} {busy ? "Creating…" : isIndiv ? "Create account" : "Create shop"}
              </button>
            </form>
          </>
        )}
        <button onClick={onSignOut} style={{ marginTop: 16, width: "100%", background: "transparent", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Sign out</button>
      </div>
    </div>
  );
}

function Gfield({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{label}</span>{children}</label>;
}
const gInp: React.CSSProperties = { border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 15, padding: "12px 14px", borderRadius: 12 };

export function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [active, setActive] = useState("overview");
  const [vehicle, setVehicle] = useState<any>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [data, setData] = useState<any>({ role: "seller", user: {}, shop: {}, vehicles: [], listings: [], threads: [], activity: [] });
  const [loading, setLoading] = useState(true);

  const reload = () => fetch("/api/data")
    .then((r) => r.json())
    .then((d) => { setData(d); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => { reload(); }, []);
  // Let views (e.g. Add vehicle) trigger a data refresh after they save.
  useEffect(() => { (window as any).csReloadData = reload; }, []);

  if (!loading && !data.user?.shopId) {
    return <CreateShopGate user={data.user} onDone={() => { setLoading(true); reload(); }} onSignOut={onSignOut} />;
  }

  const effectiveActive = vehicle ? "vehicleProfile" : (active || "overview");

  const ViewComponent: React.ComponentType<any> = vehicle
    ? VehicleProfile
    : VIEWS[effectiveActive] || Overview;

  const meta = vehicle
    ? { title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, sub: "Vehicle profile — whole car and its parts" }
    : META[effectiveActive] || META.overview;

  function navTo(id: string) { setVehicle(null); setActive(id); setNavOpen(false); }

  return (
    <DataContext.Provider value={data}>
      <I18nProvider>
      <div style={sx.layout} className="cs-layout">
        {navOpen && <div className="cs-backdrop" onClick={() => setNavOpen(false)} style={sx.backdrop} />}
        <Sidebar active={effectiveActive} onNav={navTo} onSignOut={onSignOut} open={navOpen} onClose={() => setNavOpen(false)} />
        <main style={sx.main} className="cs-main">
          <Topbar meta={meta} onNav={navTo} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} />
          <div style={sx.content} className="cs-content" key={vehicle ? "vp" + vehicle.id : effectiveActive}>
            {loading ? (
              <DashboardSkeleton />
            ) : vehicle ? (
              <VehicleProfile v={vehicle} onBack={() => setVehicle(null)} go={navTo} />
            ) : (
              <>
                {effectiveActive === "overview" && <FirstRunTour go={navTo} />}
                <ViewComponent go={navTo} onVehicle={(v: any) => setVehicle(v)} />
              </>
            )}
          </div>
        </main>
        <ExportModal />
        <ToastHost />
      </div>
      </I18nProvider>
    </DataContext.Provider>
  );
}

const sx: Record<string, React.CSSProperties> = {
  layout: { display: "grid", gridTemplateColumns: "248px 1fr", height: "100vh", overflow: "hidden" },
  sidebar: { background: "var(--surface)", borderRight: "1px solid var(--line)", padding: 18, display: "flex", flexDirection: "column", gap: 6 },
  brand: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 14px" },
  navClose: { display: "none", marginLeft: "auto", width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", placeItems: "center" },
  hamburger: { display: "none", width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", placeItems: "center", flexShrink: 0 },
  backdrop: { position: "fixed", inset: 0, zIndex: 90, background: "rgba(7,11,22,0.6)", backdropFilter: "blur(2px)" },
  logo: { width: 34, height: 34, borderRadius: 10, background: "var(--accent)", display: "grid", placeItems: "center" },
  navItem: { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "none", background: "transparent", color: "var(--muted)", fontSize: 14, fontWeight: 600, width: "100%", transition: "background 0.12s, color 0.12s" },
  navItemOn: { background: "var(--surface2)", color: "var(--foreground)", boxShadow: "inset 3px 0 0 var(--accent)" },
  navSection: { fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "12px 12px 4px" },
  shopCard: { display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--line)" },
  shopIcon: { width: 30, height: 30, borderRadius: 8, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 },
  signout: { display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 600 },
  main: { display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "16px 28px", borderBottom: "1px solid var(--line)", background: "var(--surface)" },
  search: { display: "flex", alignItems: "center", gap: 9, padding: "0 12px", width: 280, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10 },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, padding: "9px 0" },
  addBtn: { display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600 },
  content: { flex: 1, overflowY: "auto", padding: 28 },
};

const mx: Record<string, React.CSSProperties> = {
  toastStack: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" },
  toast: { display: "flex", alignItems: "center", gap: 9, maxWidth: "min(420px, 90vw)", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 18px", fontSize: 13.5, fontWeight: 500, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.7)", pointerEvents: "auto" },
  profileBtn: { display: "flex", alignItems: "center", gap: 9, padding: "5px 10px 5px 5px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)" },
  avatar: { width: 30, height: 30, borderRadius: 9, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flexShrink: 0 },
  menu: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 270, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 8, zIndex: 100, boxShadow: "0 24px 50px -20px rgba(0,0,0,0.7)" },
  menuHead: { display: "flex", alignItems: "center", gap: 11, padding: "8px 8px 12px" },
  menuItem: { display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 9, border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 500, textAlign: "left" },
  overlay: { position: "fixed", inset: 0, zIndex: 150, background: "rgba(7,11,22,0.72)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 },
  modal: { width: "min(820px, 100%)", maxHeight: "90vh", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" },
  closeBtn: { width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center" },
  modalBody: { display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 22, padding: 20, overflowY: "auto" },
  leftCol: { display: "flex", flexDirection: "column", gap: 10 },
  rightCol: { display: "flex", flexDirection: "column", gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 },
  preview: { margin: 0, background: "var(--background)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 14, fontSize: 12.5, lineHeight: 1.65, color: "var(--foreground)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" },
  marketBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "11px 6px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)" },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600 },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600 },
};
