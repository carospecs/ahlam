"use client";

import React from "react";
import { CreditCard, Mail, Trash2, LoaderCircle, Check, Plus, Shield, Crown, Eye, PencilLine, ImagePlus, Info, Banknote, ShieldCheck, ExternalLink, Globe } from "lucide-react";
import { Card } from "../UI";
import { useData, csToast } from "../Dashboard";
import { AddressAutocomplete, ZipField } from "../AddressAutocomplete";
import { PricingPlans } from "../PricingPlans";
import { WARRANTY_DAYS } from "@/lib/warranty";
import { effectivePlan } from "@/lib/plan-limits";
import { slugify, validateSlug, siteOrigin } from "@/lib/slug";
import { normalizeImageFile } from "@/lib/image";

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
// Seller verification — submit a request, then show pending / verified state.
// A verified badge appears on the storefront and every listing.
function VerificationCard({ canManage }: { canManage: boolean }) {
  const [state, setState] = React.useState<any>(null);
  const [method, setMethod] = React.useState("business");
  const [detail, setDetail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function load() {
    fetch("/api/verification").then((r) => r.json()).then(setState).catch(() => setState({ verified: false, request: null }));
  }
  React.useEffect(load, []);

  async function submit() {
    if (!detail.trim()) { csToast("Add your contact or document link"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, detail }) });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Could not submit"); setBusy(false); return; }
      csToast("Verification request submitted");
      load();
    } catch { csToast("Could not submit"); }
    setBusy(false);
  }

  if (!state) return null;
  const verified = state.verified;
  const pending = state.request?.status === "pending";

  return (
    <Card style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${verified ? "var(--success)" : "var(--accent)"} 16%, transparent)`, flexShrink: 0 }}>
        <ShieldCheck size={17} color={verified ? "var(--success)" : "var(--accent)"} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Seller verification</div>
        {verified ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--success)", marginTop: 6 }}><Check size={15} /> Verified — the badge shows on your listings</div>
        ) : pending ? (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Request received — we’re reviewing it. The verified badge appears once approved.</div>
        ) : canManage ? (
          <>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, marginTop: 4 }}>
              Get a verified badge so buyers trust you. Submit a business email, phone, or a link to your dealer/business license.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...inp, width: 150 }}>
                <option value="business">Business email</option>
                <option value="phone">Phone number</option>
                <option value="license">License / permit link</option>
              </select>
              <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={method === "phone" ? "(555) 123-4567" : method === "license" ? "https://… link to your license" : "you@yourbusiness.com"} style={{ ...inp, flex: 1, minWidth: 180 }} />
              <button onClick={submit} disabled={busy} style={{ ...saveBtn, opacity: busy ? 0.6 : 1 }}>
                {busy ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <ShieldCheck size={15} />} Request
              </button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Ask the shop owner to request verification.</div>
        )}
      </div>
    </Card>
  );
}

export function ShopProfile({ go }: ViewProps) {
  const { user } = useData();
  const canEdit = user?.role === "owner" || user?.role === "editor";
  const [form, setForm] = React.useState<any>(null);
  const [shopMeta, setShopMeta] = React.useState<{ id: string | null; verified: boolean; slug: string | null; plan: string | null; trial_ends_at: string | null; subscription_status: string | null }>({ id: null, verified: false, slug: null, plan: null, trial_ends_at: null, subscription_status: null });
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  // Snapshot of the last saved form, so edits (hours, about, …) that haven't
  // been saved yet get a visible prompt instead of silently dying when the
  // user navigates away without scrolling down to the save button.
  const savedFormRef = React.useRef<string>("");
  const dirty = form ? JSON.stringify(form) !== savedFormRef.current : false;
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState<"logo" | "cover" | null>(null);
  const logoRef = React.useRef<HTMLInputElement>(null);
  const coverRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      const s = d.shop || {};
      setLogoUrl(s.logo_url || null);
      setCoverUrl(s.cover_url || null);
      setShopMeta({ id: s.id || null, verified: !!s.verified, slug: s.slug || null, plan: s.plan || null, trial_ends_at: s.trial_ends_at || null, subscription_status: s.subscription_status || null });
      const loaded = {
        name: s.name || "", location: s.location || "", business_phone: s.business_phone || "",
        zip_code: s.zip_code || "",
        email: s.email || "", website: s.website || "", description: s.description || "", hours: s.hours || "",
        default_warranty_days: typeof s.default_warranty_days === "number" ? s.default_warranty_days : 30,
        returns_policy: s.returns_policy || "",
      };
      savedFormRef.current = JSON.stringify(loaded);
      setForm(loaded);
    });
  }, []);

  function set(k: string, v: string) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function uploadImage(kind: "logo" | "cover", fileIn: File | undefined) {
    if (!fileIn) return;
    setUploading(kind);
    // Convert iPhone HEIC/HEIF to JPEG so the picker's HEIC files aren't rejected
    // by the server (which only accepts PNG/JPG/WebP). Other formats pass through.
    const file = await normalizeImageFile(fileIn);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    try {
      const r = await fetch("/api/shop/logo", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Upload failed"); setUploading(null); return; }
      if (kind === "logo") setLogoUrl(d.url); else setCoverUrl(d.url);
      csToast(kind === "logo" ? "Logo updated" : "Cover photo updated");
      reloadData();
    } catch { csToast("Upload failed — check your connection"); }
    setUploading(null);
  }

  const initials = (form?.name || "S").split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/shop", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { csToast(d.error || "Could not save"); return; }
    savedFormRef.current = JSON.stringify(form);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    csToast("Shop profile saved");
  }

  if (!form) return <Loading />;

  // Profile completeness — complete storefronts convert browsers into buyers.
  const checklist: [string, boolean][] = [
    ["Logo", !!logoUrl],
    ["Cover photo", !!coverUrl],
    ["Shop name", !!form.name?.trim()],
    ["About", !!form.description?.trim()],
    ["Phone", !!form.business_phone?.trim()],
    ["Email or website", !!(form.email?.trim() || form.website?.trim())],
    ["Location", !!(form.location?.trim() || form.zip_code?.trim())],
    ["Hours", !!form.hours?.trim()],
    ["Returns policy", !!form.returns_policy?.trim()],
  ];
  const done = checklist.filter(([, ok]) => ok).length;
  const missing = checklist.filter(([, ok]) => !ok).map(([label]) => label);

  const section = (title: string, hint: string, children: React.ReactNode) => (
    <Card>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 14px" }}>{hint}</div>
      <div style={{ display: "grid", gap: 14 }}>{children}</div>
    </Card>
  );

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", maxWidth: 1080 }}>
      {/* ------------------------------ Editor ------------------------------ */}
      <form onSubmit={save} style={{ flex: "1 1 520px", minWidth: 0, display: "grid", gap: 16 }}>
        {section("Storefront images", "The first thing buyers see on your page and your listings.", (
          <>
            <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp,.heic,.heif" hidden onChange={(e) => { uploadImage("cover", e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,.heic,.heif" hidden onChange={(e) => { uploadImage("logo", e.target.files?.[0]); e.target.value = ""; }} />
            <div style={{ position: "relative", marginBottom: 26 }}>
              <button
                type="button"
                onClick={() => canEdit && coverRef.current?.click()}
                disabled={uploading === "cover" || !canEdit}
                title={canEdit ? "Change the cover photo" : undefined}
                style={{ display: "block", width: "100%", height: 150, padding: 0, borderRadius: 14, border: "1px dashed var(--line)", overflow: "hidden", cursor: canEdit ? "pointer" : "default", background: coverUrl ? "transparent" : "linear-gradient(120deg, color-mix(in srgb, var(--accent) 18%, var(--surface2)), var(--surface2))", position: "relative" }}
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>
                    {canEdit ? (uploading === "cover" ? "Uploading…" : "+ Add a cover photo (your yard, storefront, or best inventory)") : "No cover photo yet"}
                  </span>
                )}
                {coverUrl && canEdit && (
                  <span style={{ position: "absolute", right: 10, bottom: 10, fontSize: 11.5, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "4px 10px" }}>
                    {uploading === "cover" ? "Uploading…" : "Change cover"}
                  </span>
                )}
              </button>
              <div style={{ position: "absolute", left: 18, bottom: -24, display: "flex", alignItems: "flex-end", gap: 10 }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Shop logo" style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: "3px solid var(--surface)", boxShadow: "0 8px 20px -10px rgba(0,0,0,0.6)" }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 16, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 800, border: "3px solid var(--surface)" }}>{initials}</div>
                )}
                {canEdit && (
                  <button type="button" onClick={() => logoRef.current?.click()} disabled={uploading === "logo"} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, opacity: uploading === "logo" ? 0.6 : 1, marginBottom: 6 }}>
                    {uploading === "logo" ? <LoaderCircle size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <ImagePlus size={14} />} {logoUrl ? "Replace logo" : "Upload logo"}
                  </button>
                )}
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>PNG, JPG, or WebP · up to 4 MB each. The logo shows beside every listing; the cover tops your storefront page.</span>
          </>
        ))}

        {section("Basics", "Your name and story — buyers read this before they message.", (
          <>
            <Field label="Shop name"><input value={form.name} onChange={(e) => set("name", e.target.value)} style={inp} disabled={!canEdit} /></Field>
            <Field label="About your shop">
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Family-owned salvage yard since 2004. Quality used OEM parts, tested before they ship, with a 30-day guarantee." style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} disabled={!canEdit} />
            </Field>
          </>
        ))}

        {section("Contact", "How buyers reach you outside Ahlam messages.", (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Contact phone"><input value={form.business_phone} onChange={(e) => set("business_phone", e.target.value)} placeholder="(555) 123-4567" style={inp} disabled={!canEdit} /></Field>
              <Field label="Public email"><input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="sales@yourshop.com" style={inp} disabled={!canEdit} /></Field>
            </div>
            <Field label="Website"><input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="yourshop.com" style={inp} disabled={!canEdit} /></Field>
          </>
        ))}

        {section("Location", "Buyers sort the marketplace by distance — this is how they find you.", (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="City"><AddressAutocomplete value={form.location} onChange={(v) => set("location", v)} onSelect={(p) => { if (p.zip) set("zip_code", p.zip); }} placeholder="Start typing your city…" style={inp} disabled={!canEdit} /></Field>
            <Field label="ZIP code"><ZipField value={form.zip_code} onChange={(v) => set("zip_code", v)} onResolve={(r) => { set("zip_code", r.zip); if (!form.location?.trim()) set("location", r.location); }} placeholder="12345" style={inp} disabled={!canEdit} /></Field>
          </div>
        ))}

        {section("Business hours", "Shown on your storefront so buyers know when to call or come by.", (
          <HoursEditor value={form.hours} onChange={(v) => set("hours", v)} disabled={!canEdit} />
        ))}

        {section("Store policies", "Defaults that apply to every listing — clear terms close more sales.", (
          <>
            <Field label="Default warranty">
              <div style={{ display: "flex", gap: 8 }}>
                {WARRANTY_DAYS.map((d) => {
                  const on = Number(form.default_warranty_days) === d;
                  return (
                    <button key={d} type="button" disabled={!canEdit} onClick={() => set("default_warranty_days", d as any)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`, background: on ? "var(--accent-tint)" : "transparent", color: on ? "var(--accent)" : "var(--muted)", fontSize: 13.5, fontWeight: 700, cursor: canEdit ? "pointer" : "default" }}>{d === 0 ? "None" : `${d} days`}</button>
                  );
                })}
              </div>
              <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6, display: "block" }}>Applies to any part that doesn&apos;t set its own warranty. Used parts standardly carry 30–90 days.</span>
            </Field>
            <Field label="Returns policy">
              <textarea value={form.returns_policy} onChange={(e) => set("returns_policy", e.target.value)} rows={3} placeholder="e.g. Returns accepted within 30 days with receipt. Electrical parts must be tested on the vehicle before installation. Core charges refunded on return of the old unit." style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} disabled={!canEdit} />
            </Field>
          </>
        ))}

        <VerificationCard canManage={user?.role === "owner"} />

        {canEdit ? (
          <button type="submit" disabled={busy} style={{ ...saveBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : saved ? <Check size={16} /> : null}
            {busy ? "Saving…" : saved ? "Saved!" : "Save shop profile"}
          </button>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Only owners and editors can change the shop profile.</div>
        )}

        {/* Edits anywhere in this long form (hours especially) are easy to
            lose — surface a sticky save prompt the moment anything is dirty. */}
        {canEdit && dirty && !busy && (
          <div style={{ position: "sticky", bottom: 14, zIndex: 5, display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 13, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 10px 30px -12px rgba(0,0,0,0.45)" }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>You have unsaved changes.</span>
            <button type="submit" style={{ ...saveBtn, padding: "9px 18px" }}>Save now</button>
          </div>
        )}
      </form>

      {/* ------------------------- Storefront preview ------------------------ */}
      <div style={{ flex: "1 1 300px", maxWidth: 380, position: "sticky", top: 12, display: "grid", gap: 14 }}>
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ height: 110, background: coverUrl ? "transparent" : "linear-gradient(120deg, color-mix(in srgb, var(--accent) 22%, var(--surface2)), var(--surface2))" }}>
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
          </div>
          <div style={{ padding: "0 18px 18px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: -26 }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 13, objectFit: "cover", border: "3px solid var(--surface)" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 13, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 19, fontWeight: 800, border: "3px solid var(--surface)" }}>{initials}</div>
              )}
              <div style={{ minWidth: 0, paddingBottom: 2 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.name || "Your shop"}</span>
                  {shopMeta.verified && <ShieldCheck size={15} color="var(--success)" style={{ flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{[form.location, form.zip_code].filter(Boolean).join(" · ") || "Add your location"}</div>
              </div>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {form.description || "Your about text shows here. Two or three sentences on what you stock and why buyers should trust you."}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {Number(form.default_warranty_days) > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 14%, transparent)", borderRadius: 999, padding: "3px 9px" }}>{form.default_warranty_days}-day warranty</span>
              )}
              {form.returns_policy?.trim() && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "3px 9px" }}>Returns policy</span>
              )}
              {form.hours?.trim() && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--surface2)", borderRadius: 999, padding: "3px 9px" }}>Hours listed</span>
              )}
            </div>
            {shopMeta.id && (
              <a href={`/shop/${shopMeta.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, fontSize: 13, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
                View your public storefront <ExternalLink size={13} />
              </a>
            )}
          </div>
        </Card>

        <WebsiteCard shopMeta={shopMeta} shopName={form.name || ""} canEdit={canEdit} go={go} />

        <Card>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Profile completeness</div>
            <div className="tnum" style={{ fontSize: 13, fontWeight: 800, color: done === checklist.length ? "var(--success)" : "var(--foreground)" }}>{done}/{checklist.length}</div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--surface2)", overflow: "hidden", marginTop: 10 }}>
            <div style={{ width: `${(done / checklist.length) * 100}%`, height: "100%", borderRadius: 4, background: done === checklist.length ? "var(--success)" : "var(--accent)" }} />
          </div>
          {missing.length > 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
              Still missing: <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{missing.join(", ")}</span>. Complete storefronts get more buyer messages.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginTop: 10 }}>Complete — your storefront looks professional.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Your website — the Ultimate plan's personal site ({slug}.ahlam.io). The shop
// claims its address here; the site itself is generated from the profile and
// inventory they already keep, nothing else to manage.
// ---------------------------------------------------------------------------
function WebsiteCard({ shopMeta, shopName, canEdit, go }: {
  shopMeta: { slug: string | null; plan: string | null; trial_ends_at: string | null; subscription_status: string | null };
  shopName: string;
  canEdit: boolean;
  go: (id: string) => void;
}) {
  const plan = effectivePlan(shopMeta.plan, shopMeta.trial_ends_at, shopMeta.subscription_status);
  const qualifies = plan === "ultimate" || plan === "founder";
  const [slug, setSlug] = React.useState<string>("");
  const [savedSlug, setSavedSlug] = React.useState<string | null>(null);
  const [check, setCheck] = React.useState<{ state: "idle" | "checking" | "ok" | "bad"; reason?: string }>({ state: "idle" });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setSavedSlug(shopMeta.slug);
    setSlug(shopMeta.slug || slugify(shopName));
    // Suggest from the shop name only until a slug is claimed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopMeta.slug, shopName ? "named" : "unnamed"]);

  // Debounced live availability check while typing.
  React.useEffect(() => {
    if (!qualifies || !slug || slug === savedSlug) { setCheck({ state: "idle" }); return; }
    const v = validateSlug(slug);
    if (!v.ok) { setCheck({ state: "bad", reason: v.reason }); return; }
    setCheck({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/shop/slug-check?slug=${encodeURIComponent(slug)}`);
        const d = await r.json();
        setCheck(d.available ? { state: "ok" } : { state: "bad", reason: d.reason || "That address is taken." });
      } catch { setCheck({ state: "idle" }); }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, savedSlug, qualifies]);

  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/shop", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Could not save"); setBusy(false); return; }
      setSavedSlug(slug);
      setCheck({ state: "idle" });
      csToast("Your website address is live");
    } catch { csToast("Network error — try again"); }
    setBusy(false);
  }

  if (!qualifies) {
    return (
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700 }}>
          <Globe size={15} color="var(--sand)" /> Your own website
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
          On the Ultimate plan we build and host a professional website for your business — your inventory,
          hours, and reviews on your own address, updated automatically as you list and sell.
        </p>
        <button type="button" onClick={() => go("billing")} style={{ marginTop: 12, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          See Ultimate
        </button>
      </Card>
    );
  }

  const dirty = slug !== (savedSlug || "");
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700 }}>
        <Globe size={15} color="var(--sand)" /> Your website
      </div>
      <p style={{ margin: "8px 0 12px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
        Included with your plan. Your inventory, hours, and reviews publish here automatically — sold parts
        move to &ldquo;Recently sold&rdquo; on their own.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface2)" }}>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          disabled={!canEdit}
          placeholder="your-shop-name"
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, outline: "none", fontFamily: "var(--font-mono)" }}
        />
        <span style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--muted)", fontWeight: 600, borderLeft: "1px solid var(--line)", whiteSpace: "nowrap" }}>.ahlam.io</span>
      </div>
      {dirty && check.state === "bad" && <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>{check.reason}</div>}
      {dirty && check.state === "ok" && <div style={{ marginTop: 8, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>Available</div>}
      {dirty && savedSlug && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
          Changing your address breaks links and search results pointing at the old one.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        {canEdit && dirty && (
          <button type="button" onClick={save} disabled={busy || check.state !== "ok"} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: busy || check.state !== "ok" ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {busy ? <LoaderCircle size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : null}
            {savedSlug ? "Change address" : "Claim address"}
          </button>
        )}
        {savedSlug && (
          <a href={siteOrigin(savedSlug)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
            View my site <ExternalLink size={13} />
          </a>
        )}
      </div>
    </Card>
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
    setEmail("");
    csToast(d.emailSent ? `Invite emailed to ${email}` : `Invite saved — email couldn't be sent, share the sign-up link with them directly`);
    load();
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
// Seller payouts via Stripe Connect. The shop must finish onboarding before
// buyers can pay by card; status comes from the account.updated webhook.
function PayoutCard({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/payments/connect").then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  async function setup() {
    setBusy(true);
    try {
      const r = await fetch("/api/payments/connect", { method: "POST" });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      csToast(d.error || "Payouts aren't available right now");
    } catch { csToast("Couldn't reach Stripe — try again"); }
    setBusy(false);
  }

  const ready = status?.chargesEnabled && status?.payoutsEnabled;
  const started = status?.connected && !ready;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${ready ? "var(--success)" : "var(--accent)"} 16%, transparent)`, flexShrink: 0 }}>
          {ready ? <ShieldCheck size={17} color="var(--success)" /> : <Banknote size={17} color="var(--accent)" />}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Get paid for sales</div>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, marginTop: 4 }}>
            {ready
              ? "Payouts are active. Buyers can pay by card; funds are held in escrow and released to your bank when the buyer confirms they got the part."
              : started
                ? "Onboarding started but not finished — complete it so buyers can check out."
                : "Connect a bank account through Stripe so buyers can pay by card. Ahlam holds the payment in escrow and pays you out when the buyer confirms receipt."}
          </div>
          {ready ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--success)", marginTop: 10 }}>
              <Check size={14} /> Payouts active
            </div>
          ) : status?.configured === false ? (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, opacity: 0.8 }}>Payments aren’t connected on this deployment yet (set STRIPE_SECRET_KEY).</div>
          ) : canManage ? (
            <button onClick={setup} disabled={busy || !status} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, marginTop: 10, opacity: busy ? 0.6 : 1 }}>
              {busy ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <ExternalLink size={15} />} {started ? "Finish payout setup" : "Set up payouts"}
            </button>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>Ask the shop owner to set up payouts.</div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function Billing(_: ViewProps) {
  const { listings, vehicles, shop, user } = useData();
  const active = listings.filter((l: any) => l.status === "Posted").length;
  const sold = listings.filter((l: any) => l.status === "Sold").length;
  const identified = listings.length;
  const revenue = listings.filter((l: any) => l.status === "Sold").reduce((s: number, l: any) => s + (l.price || 0), 0);
  const trialLeft = shop.trialDaysLeft ?? 0;
  // Trial copy only makes sense on the free-month plans; legacy "Pro" and paid
  // plans have no trial clock (their trialDaysLeft is 0 and would read as an
  // expired trial).
  const onTrial = shop.planId === "starter" || shop.planId === "founder";
  const [busy, setBusy] = React.useState<"checkout" | "portal" | null>(null);

  // Send the user to Stripe. The endpoints go live once STRIPE_SECRET_KEY +
  // STRIPE_PRICE_ID are set; until then they return a clear "not configured".
  async function go(kind: "checkout" | "portal", plan?: string) {
    setBusy(kind);
    try {
      const r = await fetch(`/api/billing/${kind}`, {
        method: "POST",
        headers: plan ? { "Content-Type": "application/json" } : undefined,
        body: plan ? JSON.stringify({ plan }) : undefined,
      });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      csToast(d.error || "Billing isn't available right now");
    } catch { csToast("Couldn't reach billing — try again"); }
    setBusy(null);
  }

  return (
    <div style={{ maxWidth: 1080, display: "grid", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 14%, transparent)", borderRadius: 999, padding: "4px 11px" }}>
              <Shield size={13} /> {shop.plan || "Pro"} plan
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>{shop.members?.length || 1} team seats{onTrial ? ` · ${trialLeft} days left in your free month` : ""}. Choose or change your plan below.</div>
          </div>
          <button onClick={() => go("portal")} disabled={busy !== null} style={{ ...saveBtn, opacity: busy ? 0.6 : 1 }}>
            {busy === "portal" ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Manage subscription
          </button>
        </div>
      </Card>

      {/* Choose / change plan — same themed plans as the homepage. */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Plans</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 18 }}>Pick a plan or upgrade. Checkout is handled securely by Stripe.</div>
        {/* The $0 trial card is hidden here: "subscribing" to it would stamp a
            trial plan over a paying shop via the Stripe webhook. */}
        <PricingPlans onChoose={(planId) => go("checkout", planId)} ctaLabel="Subscribe" exclude={["starter"]} />
      </Card>

      <PayoutCard canManage={user?.role === "owner"} />

      {/* What happens when the free month ends — clear, no anxiety. Only shown
          to shops actually on a free month. */}
      {onTrial && <Card style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--signal) 16%, transparent)", flexShrink: 0 }}><Info size={17} color="var(--signal)" /></span>
        <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.55 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>What happens after your free month?</div>
          Your data and listings are <b>never deleted</b>. If you don't add a card, your shop switches to read-only — existing listings stay <b>visible</b> on the marketplace, but you won't be able to add new vehicles, post, or message buyers until you subscribe. Add a card anytime to keep everything active. Cancel whenever — no contracts.
          <div style={{ marginTop: 10 }}>
            <button onClick={() => go("checkout")} disabled={busy !== null} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
              {busy === "checkout" ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <CreditCard size={15} />} Subscribe — keep my shop active
            </button>
          </div>
        </div>
      </Card>}

      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>This month's usage</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Your usage this billing period — see your plan&apos;s included listings above.</div>
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
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12, opacity: 0.7 }}>Payments are processed securely by Stripe. Set STRIPE_SECRET_KEY and the STRIPE_PRODUCT_* ids to enable live billing.</div>
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
