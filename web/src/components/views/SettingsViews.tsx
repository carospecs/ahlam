"use client";

import React from "react";
import { CreditCard, Mail, Trash2, LoaderCircle, Check, Plus, Shield, Crown, Eye, PencilLine, ImagePlus, Info } from "lucide-react";
import { Card } from "../UI";
import { useData, csToast } from "../Dashboard";

function reloadData() { (window as any).csReloadData?.(); }

interface ViewProps { go: (id: string) => void; onVehicle?: (v: any) => void }

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)",
  background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, outline: "none",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 };
const saveBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 11,
  border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, width: "fit-content",
};

// ---------------------------------------------------------------------------
// Shop profile
// ---------------------------------------------------------------------------
export function ShopProfile(_: ViewProps) {
  const { user } = useData();
  const canEdit = user?.role === "owner" || user?.role === "editor";
  const [form, setForm] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const logoRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      const s = d.shop || {};
      setLogoUrl(s.logo_url || null);
      setForm({
        name: s.name || "", location: s.location || "", business_phone: s.business_phone || "",
        email: s.email || "", website: s.website || "", description: s.description || "", hours: s.hours || "",
      });
    });
  }, []);

  function set(k: string, v: string) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/shop/logo", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Upload failed"); setUploading(false); return; }
      setLogoUrl(d.logoUrl);
      csToast("Logo updated");
      reloadData();
    } catch { csToast("Upload failed — check your connection"); }
    setUploading(false);
  }

  const initials = (form?.name || "S").split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/shop", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { csToast(d.error || "Could not save"); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    csToast("Shop profile saved");
  }

  if (!form) return <Loading />;

  return (
    <div style={{ maxWidth: 620 }}>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
        This is your public storefront — it appears on every listing buyers see in the marketplace.
      </p>
      <form onSubmit={save} style={{ display: "grid", gap: 16 }}>
        <Field label="Shop logo">
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Shop logo" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: "1px solid var(--line)" }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 14, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 22, fontWeight: 800 }}>{initials}</div>
            )}
            {canEdit && (
              <div style={{ display: "grid", gap: 6 }}>
                <button type="button" onClick={() => logoRef.current?.click()} disabled={uploading} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, opacity: uploading ? 0.6 : 1, width: "fit-content" }}>
                  {uploading ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <ImagePlus size={15} />} {logoUrl ? "Replace logo" : "Upload logo"}
                </button>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>PNG, JPG, or WebP · up to 4 MB · shown on listings & your storefront</span>
              </div>
            )}
          </div>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Shop name"><input value={form.name} onChange={(e) => set("name", e.target.value)} style={inp} disabled={!canEdit} /></Field>
          <Field label="Location"><input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Long Beach, CA" style={inp} disabled={!canEdit} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Contact phone"><input value={form.business_phone} onChange={(e) => set("business_phone", e.target.value)} placeholder="(562) 555-0148" style={inp} disabled={!canEdit} /></Field>
          <Field label="Public email"><input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="sales@yourshop.com" style={inp} disabled={!canEdit} /></Field>
        </div>
        <Field label="Website"><input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="yourshop.com" style={inp} disabled={!canEdit} /></Field>
        <Field label="Business hours">
          <HoursEditor value={form.hours} onChange={(v) => set("hours", v)} disabled={!canEdit} />
        </Field>
        <Field label="About your shop">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Family-owned salvage yard. Quality used OEM parts with a 30-day guarantee." style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} disabled={!canEdit} />
        </Field>
        {canEdit ? (
          <button type="submit" disabled={busy} style={{ ...saveBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : saved ? <Check size={16} /> : null}
            {busy ? "Saving…" : saved ? "Saved!" : "Save shop profile"}
          </button>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Only owners and editors can change the shop profile.</div>
        )}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team & roles
// ---------------------------------------------------------------------------
const ROLE_META: Record<string, { label: string; icon: any; desc: string }> = {
  owner: { label: "Owner", icon: Crown, desc: "Full access — billing, team, everything" },
  editor: { label: "Editor", icon: PencilLine, desc: "Create & edit listings, not billing/team" },
  viewer: { label: "Viewer", icon: Eye, desc: "Read-only access to the dashboard" },
};

export function TeamRoles(_: ViewProps) {
  const [data, setData] = React.useState<any>(null);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("editor");
  const [busy, setBusy] = React.useState(false);

  function load() { fetch("/api/team").then((r) => r.json()).then(setData); }
  React.useEffect(load, []);

  const isOwner = data?.role === "owner";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { csToast("Enter a valid email"); return; }
    setBusy(true);
    const r = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { csToast(d.error || "Could not invite"); return; }
    setEmail(""); csToast(`Invite sent to ${email}`); load();
  }

  async function changeRole(memberId: string, newRole: string) {
    const r = await fetch("/api/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, role: newRole }) });
    const d = await r.json();
    if (!r.ok) { csToast(d.error || "Could not update"); return; }
    csToast("Role updated"); load();
  }

  async function remove(body: any, msg: string) {
    const r = await fetch("/api/team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { csToast(d.error || "Could not remove"); return; }
    csToast(msg); load();
  }

  if (!data) return <Loading />;

  return (
    <div style={{ maxWidth: 680, display: "grid", gap: 20 }}>
      {isOwner && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Invite a teammate</div>
          <form onSubmit={invite} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, flex: 1, minWidth: 200 }}>
              <Mail size={15} color="var(--muted)" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 14, padding: "11px 0" }} />
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inp, width: 130 }}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="owner">Owner</option>
            </select>
            <button type="submit" disabled={busy} style={{ ...saveBtn, opacity: busy ? 0.6 : 1 }}>
              {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={16} />} Invite
            </button>
          </form>
        </Card>
      )}

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Members <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {data.members.length}</span></div>
        <Card pad={0}>
          {data.members.map((m: any, i: number) => {
            const meta = ROLE_META[m.role] || ROLE_META.viewer;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < data.members.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{m.initials}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name} {m.isYou && <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 500 }}>· you</span>}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                </div>
                {isOwner && !m.isYou ? (
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} style={{ ...inp, width: 120, padding: "8px 10px" }}>
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px" }}>
                    <meta.icon size={13} /> {meta.label}
                  </span>
                )}
                {isOwner && !m.isYou && (
                  <button onClick={() => remove({ memberId: m.id }, `Removed ${m.name}`)} style={iconBtn} title="Remove"><Trash2 size={15} color="var(--danger)" /></button>
                )}
              </div>
            );
          })}
        </Card>
      </div>

      {data.invites.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Pending invites <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {data.invites.length}</span></div>
          <Card pad={0}>
            {data.invites.map((iv: any, i: number) => (
              <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: i < data.invites.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0 }}><Mail size={16} color="var(--muted)" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{iv.email}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Invited as {iv.role} · pending</div>
                </div>
                {isOwner && <button onClick={() => remove({ inviteId: iv.id }, "Invite revoked")} style={iconBtn} title="Revoke"><Trash2 size={15} color="var(--danger)" /></button>}
              </div>
            ))}
          </Card>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {Object.entries(ROLE_META).map(([k, m]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--muted)" }}>
            <m.icon size={14} color="var(--accent)" /> <b style={{ color: "var(--foreground)" }}>{m.label}</b> — {m.desc}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export function Billing(_: ViewProps) {
  const { listings, vehicles, shop } = useData();
  const active = listings.filter((l: any) => l.status === "Posted").length;
  const sold = listings.filter((l: any) => l.status === "Sold").length;
  const identified = listings.length;
  const revenue = listings.filter((l: any) => l.status === "Sold").reduce((s: number, l: any) => s + (l.price || 0), 0);
  const trialLeft = shop.trialDaysLeft ?? 0;
  const [busy, setBusy] = React.useState<"checkout" | "portal" | null>(null);

  // Send the user to Stripe. The endpoints go live once STRIPE_SECRET_KEY +
  // STRIPE_PRICE_ID are set; until then they return a clear "not configured".
  async function go(kind: "checkout" | "portal") {
    setBusy(kind);
    try {
      const r = await fetch(`/api/billing/${kind}`, { method: "POST" });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      csToast(d.error || "Billing isn't available right now");
    } catch { csToast("Couldn't reach billing — try again"); }
    setBusy(null);
  }

  return (
    <div style={{ maxWidth: 680, display: "grid", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 14%, transparent)", borderRadius: 999, padding: "4px 11px" }}>
              <Shield size={13} /> {shop.plan || "Pro"} plan
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>$49<span style={{ fontSize: 14, fontWeight: 500, color: "var(--muted)" }}>/mo</span></div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Unlimited listings · {shop.members?.length || 1} team seats · {trialLeft} days left in trial</div>
          </div>
          <button onClick={() => go("portal")} disabled={busy !== null} style={{ ...saveBtn, opacity: busy ? 0.6 : 1 }}>
            {busy === "portal" ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Manage subscription
          </button>
        </div>
      </Card>

      {/* What happens when the trial ends — clear, no anxiety. */}
      <Card style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--signal) 16%, transparent)", flexShrink: 0 }}><Info size={17} color="var(--signal)" /></span>
        <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.55 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>What happens after the {trialLeft}-day trial?</div>
          Your data and listings are <b>never deleted</b>. If you don't add a card, your shop switches to read-only — existing listings stay <b>visible</b> on the marketplace, but you won't be able to add new vehicles, post, or message buyers until you subscribe. Add a card anytime to keep everything active. Cancel whenever — no contracts.
          <div style={{ marginTop: 10 }}>
            <button onClick={() => go("checkout")} disabled={busy !== null} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
              {busy === "checkout" ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <CreditCard size={15} />} Subscribe — keep my shop active
            </button>
          </div>
        </div>
      </Card>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>This month's usage</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Pro includes <b style={{ color: "var(--foreground)" }}>unlimited</b> listings, vehicles & AI scans — no caps or overage fees.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Parts identified", value: identified, tone: "var(--foreground)" },
            { label: "Active listings", value: active, tone: "var(--success)" },
            { label: "Sold", value: sold, tone: "var(--signal)" },
            { label: "Revenue", value: `$${revenue.toLocaleString()}`, tone: "var(--success)" },
          ].map((s) => (
            <Card key={s.label} pad={14} style={{ textAlign: "center" }}>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 800, color: s.tone }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Payment method</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <CreditCard size={20} color="var(--muted)" />
          <div style={{ flex: 1, fontSize: 13.5, color: "var(--muted)" }}>No card on file — add one to keep your shop active after the trial.</div>
          <button onClick={() => go("checkout")} disabled={busy !== null} style={{ ...saveBtn, background: "transparent", border: "1px solid var(--line)", color: "var(--foreground)", opacity: busy ? 0.6 : 1 }}>
            {busy === "checkout" ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Add card
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12, opacity: 0.7 }}>Payments are processed securely by Stripe. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID to enable live billing.</div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
const NOTIF_FIELDS = [
  { key: "buyer_messages", label: "New buyer messages", desc: "Email me when a buyer contacts me about a listing" },
  { key: "weekly_summary", label: "Weekly summary", desc: "A digest of views, messages, and sales every Monday" },
  { key: "ai_alerts", label: "AI identification alerts", desc: "Tell me when AI flags a low-confidence part to review" },
  { key: "marketing", label: "Product & feature updates", desc: "Occasional news about new Ahlam features" },
];

export function Notifications(_: ViewProps) {
  const { user } = useData();
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>(
    user?.notificationPrefs || { buyer_messages: true, weekly_summary: true, ai_alerts: true, marketing: false }
  );
  const [saving, setSaving] = React.useState(false);

  async function toggle(key: string) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    try {
      const sb = (await import("@/lib/supabase-browser")).supabaseBrowser();
      const { data: { user: u } } = await sb.auth.getUser();
      if (u) await sb.from("profiles").upsert({ id: u.id, notification_prefs: next });
      csToast("Notification preferences saved");
    } catch {
      csToast("Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, display: "grid", gap: 12 }}>
      <p style={{ margin: "0 0 6px", fontSize: 13.5, color: "var(--muted)" }}>Choose what lands in your inbox. {saving && "Saving…"}</p>
      {NOTIF_FIELDS.map((f) => (
        <Card key={f.key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{f.desc}</div>
          </div>
          <Toggle on={!!prefs[f.key]} onClick={() => toggle(f.key)} />
        </Card>
      ))}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{ width: 44, height: 26, borderRadius: 999, border: "none", background: on ? "var(--accent)" : "var(--surface2)", position: "relative", flexShrink: 0, cursor: "pointer", transition: "background 0.15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left 0.15s" }} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Structured weekly hours editor. Serializes to a readable string stored in the
// shop's single `hours` text column (so the storefront can show it as-is) and
// parses that same format back on load.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type HoursRow = { open: boolean; from: string; to: string };
const DEFAULT_ROWS: HoursRow[] = DAYS.map((_, i) => ({ open: i < 5, from: "09:00", to: "17:00" }));

function to12(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  let h = Number(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m[2]} ${ap}`;
}
function from12(s: string): string {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let h = Number(m[1]);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}
function serializeHours(rows: HoursRow[]): string {
  return DAYS.map((d, i) => (rows[i].open ? `${d} ${to12(rows[i].from)}–${to12(rows[i].to)}` : `${d} Closed`)).join(" · ");
}
function parseHours(value: string): HoursRow[] | null {
  if (!value) return null;
  const rows = DEFAULT_ROWS.map((r) => ({ ...r }));
  let matched = 0;
  for (const tok of value.split("·").map((s) => s.trim())) {
    const dm = tok.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b\s*(.*)$/i);
    if (!dm) continue;
    const di = DAYS.findIndex((d) => d.toLowerCase() === dm[1].toLowerCase());
    if (di < 0) continue;
    const rest = dm[2].trim();
    if (/^closed$/i.test(rest)) { rows[di] = { ...rows[di], open: false }; matched++; continue; }
    const tm = rest.match(/^(.+?)[–-](.+)$/);
    if (tm) { const f = from12(tm[1]); const t = from12(tm[2]); if (f && t) { rows[di] = { open: true, from: f, to: t }; matched++; } }
  }
  return matched > 0 ? rows : null;
}

function HoursEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const parsedOnce = React.useMemo(() => parseHours(value), [value]);
  const legacy = !parsedOnce && value ? value : "";
  const [rows, setRows] = React.useState<HoursRow[]>(parsedOnce || DEFAULT_ROWS.map((r) => ({ ...r })));

  function update(i: number, patch: Partial<HoursRow>) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setRows(next);
    onChange(serializeHours(next));
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 11, background: "var(--surface2)", padding: 12, display: "grid", gap: 6 }}>
      {legacy && (
        <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Current hours “{legacy}” — set them below to switch to a structured schedule.
        </div>
      )}
      {DAYS.map((d, i) => (
        <div key={d} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{d}</span>
          <button type="button" disabled={disabled} onClick={() => update(i, { open: !rows[i].open })} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: rows[i].open ? "var(--success)" : "var(--muted)", background: "transparent", border: "none", width: 64 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: rows[i].open ? "var(--success)" : "var(--muted)" }} /> {rows[i].open ? "Open" : "Closed"}
          </button>
          {rows[i].open ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="time" value={rows[i].from} disabled={disabled} onChange={(e) => update(i, { from: e.target.value })} style={timeInp} />
              <span style={{ color: "var(--muted)" }}>–</span>
              <input type="time" value={rows[i].to} disabled={disabled} onChange={(e) => update(i, { to: e.target.value })} style={timeInp} />
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Closed all day</span>
          )}
        </div>
      ))}
    </div>
  );
}
const timeInp: React.CSSProperties = { padding: "6px 9px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13, outline: "none", fontFamily: "inherit" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
function Loading() {
  return <div style={{ padding: 40, color: "var(--muted)", fontSize: 14 }}>Loading…</div>;
}
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0, cursor: "pointer" };
