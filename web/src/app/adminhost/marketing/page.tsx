"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, LoaderCircle, RefreshCw, Send, Sparkles } from "lucide-react";
import { mergeDraftPayload } from "../../../../scripts/marketing-core.mjs";

type Draft = {
  id: string;
  scheduled_for: string;
  headline: string;
  body: string;
  image_url: string | null;
  payload: Record<string, any>;
  status: "ready" | "opened" | "published";
  generator: string;
  shop: { id: string; name: string; location: string | null; business_phone: string | null } | null;
};

const button: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 10, padding: "11px 15px", minHeight: 44, cursor: "pointer",
  background: "var(--surface)", color: "var(--foreground)", fontSize: 16, fontWeight: 700,
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
};

const STATUS_LABEL: Record<Draft["status"], string> = {
  ready: "Ready to post",
  opened: "Opened in Facebook",
  published: "Published",
};

export default function MarketingQueuePage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { headline: string; body: string }>>({});
  const [extensionReady, setExtensionReady] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/marketing-drafts", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 403 ? "Sign in with a founder account to view this page." : data.error || "Could not load drafts");
      setDrafts(data.drafts || []);
      setRole(data.role || null);
      setEdits(Object.fromEntries((data.drafts || []).map((draft: Draft) => [draft.id, { headline: draft.headline, body: draft.body }])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load drafts");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const detect = () => setExtensionReady(document.documentElement.getAttribute("data-ahlam-autopost") === "1");
    detect();
    const timer = window.setInterval(detect, 400);
    return () => window.clearInterval(timer);
  }, []);

  const readyCount = useMemo(() => drafts.filter((draft) => draft.status === "ready").length, [drafts]);

  async function update(draft: Draft, status: Draft["status"]): Promise<Draft | null> {
    if (role !== "admin") return null;
    setSaving(draft.id);
    setError("");
    const edit = edits[draft.id] || { headline: draft.headline, body: draft.body };
    try {
      const response = await fetch("/api/admin/marketing-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, status, ...edit }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save draft");
      const savedDraft = { ...draft, ...data.draft, shop: draft.shop } as Draft;
      setDrafts((items) => items.map((item) => item.id === draft.id ? savedDraft : item));
      setSaving(null);
      return savedDraft;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft");
      setSaving(null);
      return null;
    }
  }

  async function copyDraft(draft: Draft) {
    const edit = edits[draft.id] || { headline: draft.headline, body: draft.body };
    const payload = mergeDraftPayload(draft.payload, edit) as Record<string, any>;
    await navigator.clipboard.writeText(`${edit.headline}\n\n${String(payload.description || edit.body)}`);
    setCopied(draft.id);
    window.setTimeout(() => setCopied((id) => id === draft.id ? null : id), 1800);
  }

  async function openFacebook(draft: Draft) {
    let fallbackCopy: Promise<boolean> | null = null;
    // Open Facebook during the click itself. Waiting for the save request first
    // causes Safari/Chrome to block both the new tab and clipboard permission.
    if (!extensionReady) {
      const edit = edits[draft.id] || { headline: draft.headline, body: draft.body };
      const previewPayload = mergeDraftPayload(draft.payload, edit) as Record<string, any>;
      fallbackCopy = navigator.clipboard
        .writeText(`${String(previewPayload.title || edit.headline)}\n\n${String(previewPayload.description || edit.body)}`)
        .then(() => true)
        .catch(() => false);
      window.open(draft.payload.kind === "vehicle" ? "https://www.facebook.com/marketplace/create/vehicle" : "https://www.facebook.com/marketplace/create/item", "_blank", "noopener");
    }
    const saved = await update(draft, "opened");
    if (!saved) return;
    const payload = saved.payload;
    if (extensionReady) {
      window.postMessage({ __ahlamAutopost: true, kind: "postAll", channels: ["facebook"], listing: payload }, "*");
    } else if (fallbackCopy && !(await fallbackCopy)) {
      setError("Facebook opened, but the browser could not copy the post. Click Copy post, then paste it into Facebook.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "34px 22px 70px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/adminhost" style={{ ...button, textDecoration: "none" }}><ArrowLeft size={15} /> Founder console</Link>
          <div>
            <h1 className="cs-display" style={{ fontSize: 28, margin: 0 }}>Client marketing</h1>
            <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 16 }}>Fresh inventory drafts arrive Monday and Friday at 9 AM Pacific.</p>
          </div>
          <button onClick={load} style={{ ...button, marginLeft: "auto" }}><RefreshCw size={15} /> Refresh</button>
        </header>

        <section className="cs-panel" style={{ marginTop: 20, padding: "15px 17px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Sparkles size={19} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ lineHeight: 1.55, fontSize: 16 }}>
            <strong>{readyCount} ready for review.</strong> Check the vehicle, price, and photo. Then click <strong>Open &amp; auto-fill Facebook</strong>. The extension fills the form; you make the final Publish decision.
            {!extensionReady && <div style={{ color: "var(--signal)", marginTop: 4 }}>Extension not detected. The fallback copies the post and opens Facebook, but installing the Auto-Poster gives you the one-click fill.</div>}
          </div>
        </section>

        {loading && <div style={{ padding: 34, color: "var(--muted)", display: "flex", gap: 8 }}><LoaderCircle className="spin" size={17} /> Loading drafts…</div>}
        {error && <div role="alert" style={{ marginTop: 14, padding: 13, borderRadius: 10, background: "var(--danger-tint)", color: "var(--danger)", fontSize: 16 }}>{error}</div>}

        <div style={{ display: "grid", gap: 15, marginTop: 16 }}>
          {!loading && !error && drafts.length === 0 && (
            <div className="cs-panel" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 16 }}>No marketing drafts yet. The scheduled worker will add the next batch at 9 AM Pacific.</div>
          )}
          {drafts.map((draft) => {
            const edit = edits[draft.id] || { headline: draft.headline, body: draft.body };
            const busy = saving === draft.id;
            return (
              <article key={draft.id} className="cs-panel" style={{ padding: 0, overflow: "hidden" }}>
                <div className="cs-marketing-draft" style={{ display: "grid", gridTemplateColumns: draft.image_url ? "minmax(210px, 30%) 1fr" : "1fr" }}>
                  {draft.image_url && <img src={draft.image_url} alt="Inventory selected for this draft" style={{ width: "100%", height: "100%", minHeight: 265, objectFit: "cover", background: "var(--surface2)" }} />}
                  <div style={{ padding: 18, display: "grid", gap: 11 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 18 }}>{draft.shop?.name || "Client shop"}</strong>
                      <span style={{ fontSize: 14, fontWeight: 800, padding: "5px 8px", borderRadius: 7, background: draft.status === "published" ? "var(--success-tint)" : "var(--accent-tint)", color: draft.status === "published" ? "var(--success)" : "var(--accent)" }}>{STATUS_LABEL[draft.status]}</span>
                      <span style={{ marginLeft: "auto", fontSize: 15, color: "var(--muted)" }}>{new Date(draft.scheduled_for).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, color: "var(--muted)" }}>
                      Headline
                      <input value={edit.headline} disabled={role !== "admin"} onChange={(event) => setEdits((all) => ({ ...all, [draft.id]: { ...edit, headline: event.target.value } }))} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "12px", minHeight: 46, background: "var(--background)", color: "var(--foreground)", font: "inherit", fontSize: 16 }} />
                    </label>
                    <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, color: "var(--muted)" }}>
                      Post text
                      <textarea value={edit.body} disabled={role !== "admin"} rows={7} onChange={(event) => setEdits((all) => ({ ...all, [draft.id]: { ...edit, body: event.target.value } }))} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "12px", resize: "vertical", background: "var(--background)", color: "var(--foreground)", font: "inherit", fontSize: 16, lineHeight: 1.55 }} />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button disabled={busy || role !== "admin"} onClick={() => openFacebook(draft)} style={{ ...button, background: "#1877f2", color: "white", borderColor: "#1877f2" }}>
                        {busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Open &amp; auto-fill Facebook
                      </button>
                      <button onClick={() => copyDraft(draft)} style={button}>{copied === draft.id ? <Check size={16} /> : <Copy size={16} />} {copied === draft.id ? "Copied" : "Copy post"}</button>
                      {draft.status !== "published" && <button disabled={busy || role !== "admin"} onClick={() => update(draft, "published")} style={button}><Check size={15} /> Mark published</button>}
                      <a href={draft.payload?.photos?.[0] || draft.image_url || "#"} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", opacity: draft.image_url ? 1 : .5 }}><ExternalLink size={15} /> Open photo</a>
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--muted)" }}>Generated by {draft.generator.endsWith("-sdk") ? "the Ahlam SDK agent" : "the fact-only safety template"}. Nothing is published automatically.</div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
