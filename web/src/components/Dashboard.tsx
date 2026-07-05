"use client";

import { useState, useEffect, useRef, createContext, useContext, useSyncExternalStore } from "react";
import {
  LayoutDashboard, Store, Car, Wrench, CirclePlus, Images, Sparkles,
  MessageSquare, X, Menu, Bell, Plus, Search, ChevronsUpDown, LogOut,
  Check, CircleCheck, Send, PencilLine, Tag, ShoppingBag,
  Globe, ChevronDown, User, Users, CreditCard, Download, Share2,
  CheckCheck, Info, Copy, ExternalLink, ChevronLeft, ChevronRight, LoaderCircle,
  Sun, Moon, TrendingUp, BookOpen, FolderClosed, MapPin, Trash2, Maximize2,
} from "lucide-react";
import { armAudio, playMessageChime } from "@/lib/notifySound";
import { fileToJpegDataUrl } from "@/lib/image";
import { buildListingText, buildVehicleText, partsForVehicle } from "./data";
import { Overview } from "./views/Overview";
import { Vehicles } from "./views/Vehicles";
import { Browse } from "./views/Browse";
import { Parts } from "./views/Parts";
import { MessagesHub, DeletedChats } from "./views/Messages";
import { AIChat } from "./views/AIChat";
import { AssistantDrawer } from "./AssistantDrawer";
import { Interchange } from "./views/Interchange";
import { ExportCenter } from "./views/ExportCenter";
import { AddVehicle } from "./views/AddVehicle";
import { Analytics } from "./views/Analytics";
import { Gallery } from "./views/Gallery";
import { Files } from "./views/Files";
import { VehicleProfile } from "./views/VehicleProfile";
import { YardManagement } from "./views/YardManagement";
import { Orders } from "./views/Orders";
import { AccountSettings } from "./views/AccountSettings";
import { ShopProfile, TeamRoles, Billing, Notifications } from "./views/SettingsViews";
import { DashboardSkeleton } from "./UI";
import { BrandChip } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import { I18nProvider, useI18n, useT } from "@/lib/i18n";
import { AddressAutocomplete, ZipField } from "./AddressAutocomplete";

export const DataContext = createContext<any>({ user: {}, shop: {}, vehicles: [], listings: [], threads: [], activity: [] });
export function useData() { return useContext(DataContext); }

// Navigation mirrors the actual workflow: scan → catalog → post (Sell), run the shop
// (Business), look outward (Discover), reference material (Library). "Add vehicle /
// parts" is NOT in the list — it's the app's entry point, rendered as the pinned
// "+ New scan" primary button above the groups (see Sidebar).
const NAV = [
  { section: "Sell" }, // primary: home, the headline value (post + measure), and the market
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "export", label: "Export & posting", icon: Send },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "browse", label: "Browse market", icon: Store },
  { section: "Business" }, // run the shop: buyers, deals, ops
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "yard", label: "Yard", icon: MapPin }, // barcodes, bins, labels, NMVTIS
  { id: "interchange", label: "Interchange", icon: BookOpen },
  { section: "Library" }, // your posted inventory + media + documents
  { id: "vehicles", label: "Vehicles posted", icon: Car },
  { id: "parts", label: "Parts posted", icon: Wrench },
  { id: "gallery", label: "Gallery", icon: Images },
  { id: "files", label: "Files", icon: FolderClosed, ownerOnly: true },
];

const META: Record<string, { title: string; sub: string }> = {
  overview: { title: "Overview", sub: "Your shop at a glance" },
  browse: { title: "Browse market", sub: "Cars and parts other shops have listed near you" },
  orders: { title: "Orders", sub: "Purchases, sales, and escrow — pay and get paid securely" },
  vehicles: { title: "Vehicles posted", sub: "Your cars — drafts, parting out, whole, or both" },
  parts: { title: "Parts posted", sub: "Your parts — drafts, posted, and sold" },
  add: { title: "Add a vehicle", sub: "Snap or upload up to 15 photos + VIN — AI does the rest" },
  analytics: { title: "Analytics", sub: "Views, inquiries, and sales at a glance" },
  aichat: { title: "AI assistant", sub: "Ask about pricing, fitment, and listings" },
  export: { title: "Export & posting", sub: "Cross-post your listings to Facebook, OfferUp, eBay & more" },
  messages: { title: "Messages", sub: "Buyer inquiries from your listings" },
  "deleted-chats": { title: "Deleted chats", sub: "Recover or permanently delete" },
  interchange: { title: "Parts interchange", sub: "Hollander-style cross-reference — search by VIN or part name" },
  yard: { title: "Yard management", sub: "Track part locations and barcodes across your lot" },
  gallery: { title: "Photo gallery", sub: "Every photo across your inventory, grouped by car" },
  files: { title: "Files", sub: "VIN reports & shop documents — owner only" },
  settings: { title: "Account settings", sub: "Your name, contact, and online status" },
  shop: { title: "Shop profile", sub: "Your public storefront — appears on every listing" },
  team: { title: "Team & roles", sub: "Invite teammates and set their permissions" },
  billing: { title: "Billing", sub: "Plan, usage, and payment method" },
  notifications: { title: "Notifications", sub: "Choose what we email you about" },
};

function Sidebar({ active, onNav, onSignOut, open, onClose }: {
  active: string; onNav: (id: string) => void; onSignOut: () => void;
  open: boolean; onClose: () => void;
}) {
  const { shop, role } = useData();
  const t = useT();
  const nav = NAV.filter((n: any) => !n.ownerOnly || role === "owner");

  return (
    <aside style={sx.sidebar} className={"cs-sidebar" + (open ? " open" : "")}>
      <div style={sx.brand}>
        <BrandChip size={34} />
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
        <button className="cs-navclose" onClick={onClose} style={sx.navClose}><X size={18} color="var(--muted)" /></button>
      </div>
      {/* Primary action — every screen funnels into the scan, so it's a pinned filled
          button above the groups, not a nav row buried mid-list. */}
      <button
        className="cs-raise"
        onClick={() => onNav("add")}
        title={t("Add vehicle / parts")}
        style={{ ...sx.newScan, ...(active === "add" ? sx.newScanOn : {}) }}
      >
        <CirclePlus size={18} /> {t("New scan")}
      </button>
      <nav style={{ display: "grid", gap: 3, marginTop: 4, overflowY: "auto" }}>
        {nav.map((n, i) => {
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
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 11.5, color: "var(--muted)", textDecoration: "none" }}>{t("Privacy Policy")}</a>
      </div>
    </aside>
  );
}

function Topbar({ meta, onMenu, onSignOut, onNav, onToggleAssistant }: {
  meta: { title: string; sub: string }; onMenu: () => void;
  onSignOut: () => void; onNav?: (id: string) => void; onToggleAssistant?: () => void;
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
        <NotificationBell onNav={onNav} />
        <button
          title={t("AI assistant")}
          aria-label={t("AI assistant")}
          onClick={() => onToggleAssistant?.()}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--accent)", cursor: "pointer" }}
        >
          <Sparkles size={17} />
        </button>
        <span title="Language" className="cs-lang" style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden" }}>
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
        <span className="cs-profile-text" style={{ textAlign: "left", lineHeight: 1.2 }}>
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
            { icon: Trash2, label: "Deleted chats", id: "deleted-chats" },
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
  overview: Overview, vehicles: Vehicles, browse: Browse, orders: Orders, parts: Parts, export: ExportCenter, analytics: Analytics,
  messages: MessagesHub, aichat: AIChat, add: AddVehicle, interchange: Interchange, vehicleProfile: VehicleProfile,
  settings: AccountSettings, shop: ShopProfile, team: TeamRoles, billing: Billing, notifications: Notifications,
  files: Files, yard: YardManagement, gallery: Gallery,
  "deleted-chats": DeletedChats,
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

// ---------------------------------------------------------------------------
// New-message notifications (AHLAM-73): an unread store the bell reads, plus a
// background poller that fires a toast + chime + browser notification the moment
// a new buyer message lands. Email is sent server-side (api/marketplace/contact),
// so a seller is reached three ways: in-app, sound, and email.
let _unread = 0;
let _latestId: string | null = null;
const unreadSubs = new Set<() => void>();
function setUnread(n: number) {
  if (n === _unread) return;
  _unread = n;
  unreadSubs.forEach((f) => f());
}
function subscribeUnread(cb: () => void) { unreadSubs.add(cb); return () => unreadSubs.delete(cb); }
function useUnreadCount() {
  return useSyncExternalStore(subscribeUnread, () => _unread, () => 0);
}

// Ask once for browser-notification permission (best effort).
function requestNotifyPermission() {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
  } catch {}
}

function fireBrowserNotification(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // Skip if the tab is focused — the toast already covers that case.
    if (typeof document !== "undefined" && document.visibilityState === "visible") return;
    const n = new Notification(title, { body, icon: "/icon.svg", tag: "ahlam-message" });
    n.onclick = () => { window.focus(); try { (window as any).csGoMessages?.(); } catch {} n.close(); };
  } catch {}
}

// Mounted once at the dashboard shell. Polls a tiny endpoint and alerts on a new
// inbound message. Seeds a baseline on first poll so it never fires for history.
function MessageNotifier() {
  useEffect(() => {
    armAudio();
    requestNotifyPermission();
    let seeded = false;
    let stopped = false;

    async function poll() {
      try {
        const r = await fetch("/api/messages/unread", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        setUnread(d.total || 0);
        if (!seeded) { seeded = true; _latestId = d.latestId || null; return; }
        if (d.latestId && d.latestId !== _latestId) {
          _latestId = d.latestId;
          const name = d.latest?.name || "A buyer";
          const preview = d.latest?.preview || "sent you a new message";
          playMessageChime();
          csToast(`New message from ${name}`);
          fireBrowserNotification(`New message from ${name}`, preview);
        } else {
          _latestId = d.latestId || _latestId;
        }
      } catch {}
    }

    poll();
    const iv = setInterval(() => { if (!stopped) poll(); }, 20_000);
    const onFocus = () => { if (!stopped) poll(); };
    window.addEventListener("focus", onFocus);
    return () => { stopped = true; clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, []);
  return null;
}

// A topbar bell that shows the unread badge and jumps to Messages.
function NotificationBell({ onNav }: { onNav?: (id: string) => void }) {
  const unread = useUnreadCount();
  return (
    <button
      title="Messages"
      aria-label={unread > 0 ? `${unread} unread messages` : "Messages"}
      onClick={() => onNav?.("messages")}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", cursor: "pointer" }}
    >
      <Bell size={17} />
      {unread > 0 && (
        <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: "var(--danger)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--background)" }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

// Part editor — opened from "Parts posted". Kept simple (just the info), the way
// the vehicle page edits a part. The marketplace/export stuff lives behind the
// "Export" button, which opens an enlarged overlay (like the photo viewer).
const gradeOf = (l: any) => (l.grade === "Poor" ? "C" : l.grade === "Good" ? "B" : (["A", "B", "C"].includes(l.grade) ? l.grade : "B"));
function ExportModal() {
  const [listing, setListing] = useState<any>(null);
  const [name, setName] = useState("");
  const [fitment, setFitment] = useState("");
  const [grade, setGrade] = useState("B");
  const [status, setStatus] = useState("Draft");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null); // photo open in the viewer
  const [showExport, setShowExport] = useState(false);           // export overlay open
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (window as any).csOpenExport = (l: any) => {
      setListing(l); setName(l.part || ""); setFitment(l.fitment || ""); setGrade(gradeOf(l));
      setStatus(l.status); setPrice(String(l.price ?? "")); setDesc(l.desc || "");
      setLightbox(null); setShowExport(false); setCopied(false);
    };
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Esc unwinds the deepest layer first: photo viewer → export overlay → modal.
      setLightbox((lb) => {
        if (lb !== null) return null;
        setShowExport((se) => { if (se) return false; setListing(null); return false; });
        return null;
      });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!listing) return null;
  const text = buildListingText({ ...listing, part: name, fitment, grade, price: Number(price) || listing.price, desc });
  const lowConf = listing.confidence === "low";
  const photoUrls: string[] = [listing.image, ...(Array.isArray(listing.images) ? listing.images : [])].filter((u: any) => u && /^https?:\/\//.test(u));
  const dirty = name !== (listing.part || "") || fitment !== (listing.fitment || "") || grade !== gradeOf(listing) || status !== listing.status || String(price) !== String(listing.price ?? "") || desc !== (listing.desc || "");

  function close() { setListing(null); }

  // Upload photo(s) to this part from the editor — base64 → PATCH → instant preview.
  async function addPhotos(files: FileList) {
    const arr = Array.from(files).slice(0, 8);
    if (!arr.length) return;
    setUploading(true);
    try {
      // Normalize every photo to a downscaled JPEG data URL — converts iPhone
      // HEIC/HEIF so it isn't stored mislabeled as JPEG.
      const b64s = await Promise.all(arr.map((f) => fileToJpegDataUrl(f)));
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: listing.id, photosBase64: b64s }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't upload photo"); setUploading(false); return; }
      setListing((prev: any) => ({ ...prev, image: b64s[0] })); // optimistic preview
      csToast("Photo added");
      (window as any).csReloadData?.();
    } catch { csToast("Couldn't upload photo"); }
    setUploading(false);
  }
  function copy() { try { navigator.clipboard?.writeText(text); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1800); csToast("Listing text copied"); }
  function exportCSV() {
    const headers = ["Part", "Fitment", "Price", "Grade", "Status", "Description"];
    const row = [name, fitment || "", String(Number(price) || listing.price || ""), grade, status, (desc || "").replace(/\n/g, " ")];
    const csv = [headers, row].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${(name || "listing").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url); csToast("Downloaded CSV");
  }
  async function share() {
    try { if ((navigator as any).share) { await (navigator as any).share({ title: name, text }); return; } } catch { return; }
    try { await navigator.clipboard?.writeText(text); csToast("Listing copied — ready to share"); } catch { csToast("Press Ctrl/Cmd+C to copy"); }
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/listings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, partName: name, fitment, condition: grade, status, priceUsd: price === "" ? undefined : Number(price), description: desc }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't save"); setSaving(false); return; }
      csToast("Part updated");
      (window as any).csReloadData?.();
      setSaving(false);
      close();
    } catch { csToast("Couldn't save — check your connection"); setSaving(false); }
  }

  const fieldInput: React.CSSProperties = { width: "100%", border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, padding: "10px 12px", borderRadius: 10, boxSizing: "border-box" };
  const pickBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, border: on ? "1px solid var(--accent)" : "1px solid var(--line)", background: on ? "var(--accent-tint)" : "transparent", color: on ? "var(--accent)" : "var(--muted)", cursor: "pointer" });

  return (
    <>
    <div style={mx.overlay} onMouseDown={close}>
      <div style={{ ...mx.modal, width: "min(680px, 100%)" }} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
        <div style={mx.modalHead}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "3px 9px", fontSize: 12, fontWeight: 600, color: status === "Posted" ? "var(--success)" : status === "Sold" ? "var(--signal)" : "var(--muted)", background: `color-mix(in srgb, ${status === "Posted" ? "var(--success)" : status === "Sold" ? "var(--signal)" : "var(--muted)"} 14%, transparent)` }}>
              {status === "Posted" ? <Send size={12} /> : status === "Sold" ? <CircleCheck size={12} /> : <PencilLine size={12} />} {status}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{listing.category}</span>
          </div>
          <button style={mx.closeBtn} onClick={close}><X size={18} color="var(--muted)" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, padding: 20, overflowY: "auto" }} className="cs-modal-body">
          <div style={mx.leftCol}>
            {photoUrls.length > 0 ? (
              <>
                <button onClick={() => setLightbox(0)} title="Click to enlarge" style={{ padding: 0, border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden", cursor: "zoom-in", background: "var(--surface2)", position: "relative", aspectRatio: "4/3", display: "block" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrls[0]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <span style={{ position: "absolute", bottom: 8, right: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#fff", background: "rgba(7,11,22,0.62)", borderRadius: 7, padding: "4px 8px" }}><Maximize2 size={12} /> Enlarge</span>
                </button>
                {photoUrls.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                    {photoUrls.slice(1, 5).map((u, i) => (
                      <button key={i} onClick={() => setLightbox(i + 1)} style={{ padding: 0, border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden", cursor: "zoom-in", aspectRatio: "1", background: "var(--surface2)", display: "block" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button onClick={() => { if (!uploading) fileRef.current?.click(); }} className="photo-cell" style={{ width: "100%", aspectRatio: "4/3", borderRadius: "var(--radius-md)", display: "grid", placeItems: "center", gap: 8, position: "relative", overflow: "hidden", border: "1px dashed var(--line)", cursor: uploading ? "default" : "pointer", background: "radial-gradient(circle at 30% 25%, rgba(148,163,184,0.10), transparent 60%), linear-gradient(135deg, #20283c 0%, #161d2e 100%)" }}>
                {uploading ? <LoaderCircle size={28} style={{ animation: "spin 0.8s linear infinite", color: "#7a86a3" }} /> : <Plus size={32} strokeWidth={1.5} color="#7a86a3" />}
                <span style={{ fontSize: 12, color: "#8b97b3", fontWeight: 600 }}>{uploading ? "Uploading…" : "Click to upload a photo"}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) addPhotos(e.target.files); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 12px", borderRadius: 10, border: "1px dashed var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: uploading ? "default" : "pointer" }}>
              {uploading ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={15} />} {uploading ? "Uploading…" : photoUrls.length ? "Add / replace photo" : "Upload a photo"}
            </button>
            {lowConf && (
              <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--signal)", lineHeight: 1.5, background: "var(--signal-bg)", border: "1px solid color-mix(in srgb, var(--signal) 40%, transparent)", borderRadius: 10, padding: "10px 12px" }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>AI wasn't fully confident here — double-check the name and fitment.</span>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div>
              <div style={mx.sectionLabel}>Part name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Right Side Mirror" style={fieldInput} />
            </div>
            <div>
              <div style={mx.sectionLabel}>Fits (vehicle)</div>
              <input value={fitment} onChange={(e) => setFitment(e.target.value)} placeholder="e.g. 2016–2021 Honda Civic" style={fieldInput} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 130 }}>
                <div style={mx.sectionLabel}>Price</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "9px 11px" }}>
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>$</span>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="tnum" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 700 }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={mx.sectionLabel}>Condition</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["A", "B", "C"].map((g) => <button key={g} onClick={() => setGrade(g)} style={pickBtn(grade === g)}>{g}</button>)}
                </div>
              </div>
            </div>
            <div>
              <div style={mx.sectionLabel}>Status</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Draft", "Posted", "Sold"].map((s) => <button key={s} onClick={() => setStatus(s)} style={{ ...pickBtn(status === s), fontWeight: 600 }}>{s}</button>)}
              </div>
            </div>
            <div>
              <div style={mx.sectionLabel}>Description</div>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Condition, what's included, fitment notes…" style={{ ...fieldInput, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
              <button onClick={save} disabled={saving || !dirty} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 11, border: "none", background: dirty ? "var(--accent)" : "var(--surface2)", color: dirty ? "#fff" : "var(--muted)", fontSize: 14, fontWeight: 600, cursor: dirty ? "pointer" : "default", opacity: saving ? 0.6 : 1 }}>
                {saving ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Check size={16} />} {saving ? "Saving…" : "Save changes"}
              </button>
              <button onClick={() => setShowExport(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                <Send size={15} /> Export
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Export — opens enlarged (like the photo viewer) with the marketplace text + copy. */}
    {showExport && (
      <div onMouseDown={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(4,7,14,0.9)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 24 }}>
        <div onMouseDown={(e) => e.stopPropagation()} className="fade-up" style={{ width: "min(620px, 100%)", maxHeight: "88vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.85)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>Export — {name}</div>
            <button style={mx.closeBtn} onClick={() => setShowExport(false)}><X size={18} color="var(--muted)" /></button>
          </div>
          <div style={mx.sectionLabel}>Marketplace listing text</div>
          <pre style={mx.preview}>{text}</pre>
          <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", marginTop: 8 }}>
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
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={{ ...mx.primaryBtn, flex: 1 }} onClick={copy}><Copy size={16} /> {copied ? "Copied!" : "Copy listing text"}</button>
            <button style={mx.ghostBtn} onClick={exportCSV}><Download size={16} /> CSV</button>
            <button style={mx.ghostBtn} onClick={share}><Share2 size={16} /></button>
          </div>
        </div>
      </div>
    )}

    {lightbox !== null && photoUrls[lightbox] && (
      <Lightbox images={photoUrls} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    )}
    </>
  );
}

// Full-screen photo viewer — opens centered above everything; click the backdrop,
// the ✕, or press Esc to exit. Arrow keys / on-screen arrows page through photos.
function Lightbox({ images, index, onClose, onIndex }: { images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const many = images.length > 1;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" && many) onIndex((index + 1) % images.length);
      else if (e.key === "ArrowLeft" && many) onIndex((index - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, many, onIndex]);
  const navBtn: React.CSSProperties = { position: "absolute", top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(7,11,22,0.55)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,7,14,0.92)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 28 }}>
      <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 18, right: 20, width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(7,11,22,0.55)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={20} /></button>
      {many && <button onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length); }} aria-label="Previous" style={{ ...navBtn, left: 20 }}><ChevronLeft size={24} /></button>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "86vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 30px 90px -20px rgba(0,0,0,0.9)" }} />
      {many && <button onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length); }} aria-label="Next" style={{ ...navBtn, right: 20 }}><ChevronRight size={24} /></button>}
      {many && <div style={{ position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", fontSize: 12.5, fontWeight: 600, color: "#fff", background: "rgba(7,11,22,0.6)", borderRadius: 999, padding: "6px 14px" }}>{index + 1} / {images.length}</div>}
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
      <div className="login-card" style={{ width: "min(840px, 100%)", display: "grid", gridTemplateColumns: "1fr 0.9fr", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.6)" }}>
        {/* Brand panel — auto-hides on mobile via .login-panel */}
        <div className="grain login-panel" style={{ padding: 34, display: "flex", flexDirection: "column", gap: 22, justifyContent: "space-between", borderRight: "1px solid var(--line)", minHeight: 500 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><BrandChip size={34} /><span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span></span>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", background: "var(--accent-tint)", padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} /> Now live · first month free</span>
            <h1 style={{ margin: "16px 0 0", fontSize: 31, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>You&apos;re one step<br /><span style={{ color: "var(--accent)" }}>from your first listing.</span></h1>
            <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 14, lineHeight: 1.55 }}>Set up your {isIndiv ? "account" : "shop"} and your AI-graded inventory starts building itself.</p>
          </div>
          <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--line)", background: "var(--background)", padding: 15, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}><Sparkles size={15} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 12.5 }}>AI review card</span></div>
            {[["Part", "Alternator"], ["Fits", "2013–2017 Accord"], ["Suggested", "$85"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", background: "var(--surface2)", borderRadius: 8, padding: "8px 11px", fontSize: 12.5 }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </div>
        {/* Form column */}
        <div style={{ padding: 30 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
                <Gfield label="Location (optional)"><AddressAutocomplete value={location} onChange={setLocation} onSelect={(p) => { if (p.zip) setZip(p.zip); }} placeholder="Start typing your city…" style={gInp} /></Gfield>
                <Gfield label="ZIP code"><ZipField value={zip} onChange={setZip} onResolve={(r) => { setZip(r.zip); if (!location.trim()) setLocation(r.location); }} placeholder="12345" style={gInp} /></Gfield>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6 }}>Your ZIP lets buyers see your area and find your listings by nearest.</div>
              <Gfield label={isIndiv ? "Contact phone (optional)" : "Business phone (optional)"}><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" style={gInp} /></Gfield>
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
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [data, setData] = useState<any>({ role: "seller", user: {}, shop: {}, vehicles: [], listings: [], threads: [], activity: [] });
  const [loading, setLoading] = useState(true);

  const reload = () => fetch("/api/data")
    .then((r) => r.json())
    .then((d) => { setData(d); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => { reload(); }, []);
  // Let views (e.g. Add vehicle) trigger a data refresh after they save.
  useEffect(() => { (window as any).csReloadData = reload; }, []);

  // Handle returns from Stripe (checkout + Connect payout onboarding): toast the
  // result, land the user on the right view, and strip the marker from the URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const order = p.get("order");
    const payouts = p.get("payouts");
    const billing = p.get("billing");
    if (order === "success") { csToast("Payment complete — held safely in escrow"); setActive("orders"); }
    else if (order === "cancelled") { csToast("Checkout cancelled — no charge made"); }
    else if (payouts === "done") { csToast("Payout setup updated"); setActive("billing"); }
    else if (billing === "success") { csToast("Subscription active — your plan is live"); setActive("billing"); }
    else if (billing === "cancelled") { csToast("Checkout cancelled — no charge made"); }
    if (order || payouts || billing) {
      ["order", "id", "payouts", "billing"].forEach((k) => p.delete(k));
      const url = new URL(window.location.href);
      url.search = p.toString();
      window.history.replaceState({}, "", url);
    }
  }, []);

  // Online presence heartbeat — marks user online every 60s, goes offline on unmount.
  useEffect(() => {
    const beat = () => fetch("/api/online/heartbeat", { method: "POST" }).catch(() => {});
    beat();
    const iv = setInterval(beat, 60_000);
    return () => { clearInterval(iv); fetch("/api/online/heartbeat", { method: "DELETE" }).catch(() => {}); };
  }, []);

  function navTo(id: string) { setVehicle(null); setActive(id); setNavOpen(false); }

  // Let a browser notification click jump straight to the inbox. MUST run
  // before the CreateShopGate early return below — a hook after a conditional
  // return crashes React (#300, "rendered fewer hooks") the moment a shop-less
  // account loads, which is every brand-new signup.
  useEffect(() => { (window as any).csGoMessages = () => navTo("messages"); }, []);

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

  return (
    <DataContext.Provider value={data}>
      <I18nProvider>
      <div style={sx.layout} className="cs-layout">
        {navOpen && <div className="cs-backdrop" onClick={() => setNavOpen(false)} style={sx.backdrop} />}
        <Sidebar active={effectiveActive} onNav={navTo} onSignOut={onSignOut} open={navOpen} onClose={() => setNavOpen(false)} />
        <main style={sx.main} className={"cs-main" + (assistantOpen ? " cs-assistant-open" : "")}>
          <Topbar meta={meta} onNav={navTo} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} onToggleAssistant={() => setAssistantOpen((o) => !o)} />
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
        <MessageNotifier />
        <AssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} />
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
  newScan: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "11px 14px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, width: "100%", cursor: "pointer", marginTop: 2 },
  newScanOn: { boxShadow: "0 0 0 2px var(--surface), 0 0 0 4px var(--accent)" },
  navSection: { fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "12px 12px 4px" },
  shopCard: { display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--line)" },
  shopIcon: { width: 30, height: 30, borderRadius: 8, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 },
  signout: { display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 600 },
  // minHeight:0 is required: as a grid item, min-height defaults to `auto`, so a
  // tall view (e.g. the AI chat) grows .cs-main past 100vh and pushes the fixed
  // Topbar off-screen. Pinning it lets .cs-content scroll internally instead.
  main: { display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" },
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
