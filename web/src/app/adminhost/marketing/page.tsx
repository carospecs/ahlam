"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, LoaderCircle, RefreshCw, Send, Sparkles } from "lucide-react";
import { mergeDraftPayload } from "../../../../scripts/marketing-core.mjs";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";

type Draft = {
  id: string;
  platform: "facebook" | "linkedin";
  scheduled_for: string;
  headline: string;
  body: string;
  image_url: string | null;
  payload: Record<string, any>;
  status: "ready" | "opened" | "publishing" | "published" | "failed";
  error: string | null;
  published_url: string | null;
  generator: string;
  shop: { id: string; name: string; location: string | null; business_phone: string | null } | null;
};

type LinkedInStatus = {
  configured: boolean;
  connected: boolean;
  status: string;
  accountLabel: string | null;
  expiresAt: string | null;
  lastError: string | null;
  autoPublishEnabled: boolean;
};

const button: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 10, padding: "11px 15px", minHeight: 44, cursor: "pointer",
  background: "var(--surface)", color: "var(--foreground)", fontSize: 16, fontWeight: 700,
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
};

const STATUS_LABEL: Record<Draft["status"], string> = {
  ready: "Ready to post",
  opened: "Opened in Facebook",
  publishing: "Publishing…",
  published: "Published",
  failed: "Needs attention",
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
  const [linkedin, setLinkedin] = useState<LinkedInStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [response, linkedInResponse] = await Promise.all([
        fetch("/api/admin/marketing-drafts", { cache: "no-store" }),
        fetch("/api/linkedin/status", { cache: "no-store" }),
      ]);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 403 ? "Sign in with a founder account to view this page." : data.error || "Could not load drafts");
      setDrafts(data.drafts || []);
      setRole(data.role || null);
      setEdits(Object.fromEntries((data.drafts || []).map((draft: Draft) => [draft.id, { headline: draft.headline, body: draft.body }])));
      setLinkedin(linkedInResponse.ok ? await linkedInResponse.json() : null);
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

  async function update(draft: Draft, status: "opened" | "published"): Promise<Draft | null> {
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

  async function publishLinkedIn(draft: Draft) {
    if (role !== "admin") return;
    if (!window.confirm(`Publish this post publicly as Ahlam, Inc.?\n\n${(edits[draft.id] || draft).headline}`)) return;
    const saved = await updateCopyOnly(draft);
    if (!saved) return;
    setSaving(draft.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/marketing-drafts/${draft.id}/publish-linkedin`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not publish to LinkedIn");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish to LinkedIn");
      await load();
    }
    setSaving(null);
  }

  async function updateCopyOnly(draft: Draft): Promise<Draft | null> {
    if (role !== "admin") return null;
    setSaving(draft.id);
    setError("");
    const edit = edits[draft.id] || { headline: draft.headline, body: draft.body };
    try {
      const response = await fetch("/api/admin/marketing-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, ...edit }),
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
            <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 16 }}>Facebook drafts arrive Monday and Friday. LinkedIn rotates one client spotlight daily at 9 AM Pacific.</p>
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

        <section className="cs-panel" style={{ marginTop: 12, padding: "15px 17px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <LinkedInIcon size={20} />
          <div style={{ flex: 1, minWidth: 240, lineHeight: 1.45, fontSize: 15.5 }}>
            <strong>LinkedIn company publishing:</strong>{" "}
            {!linkedin ? "Checking connection…" : !linkedin.configured ? "Server setup is incomplete." : !linkedin.connected ? "Ahlam, Inc. is not connected yet." : linkedin.autoPublishEnabled ? `Connected${linkedin.accountLabel ? ` to ${linkedin.accountLabel}` : ""}. Daily auto-publishing is on.` : "Connected. Auto-publishing is paused."}
            {linkedin?.lastError && <div style={{ color: "var(--danger)", marginTop: 3 }}>{linkedin.lastError}</div>}
          </div>
          {role === "admin" && linkedin?.configured && !linkedin.connected && (
            <a href="/api/linkedin/connect" style={{ ...button, textDecoration: "none", background: "#0a66c2", borderColor: "#0a66c2", color: "white" }}>Connect Ahlam LinkedIn</a>
          )}
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
                      <span style={{ fontSize: 13, fontWeight: 800, padding: "5px 8px", borderRadius: 7, background: draft.platform === "linkedin" ? "#e8f3ff" : "#edf4ff", color: draft.platform === "linkedin" ? "#0a66c2" : "#1877f2" }}>{draft.platform === "linkedin" ? "LinkedIn" : "Facebook"}</span>
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
                      {draft.platform === "facebook" ? (
                        <button disabled={busy || role !== "admin"} onClick={() => openFacebook(draft)} style={{ ...button, background: "#1877f2", color: "white", borderColor: "#1877f2" }}>
                          {busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Open &amp; auto-fill Facebook
                        </button>
                      ) : draft.status === "published" && draft.published_url ? (
                        <a href={draft.published_url} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", background: "#0a66c2", borderColor: "#0a66c2", color: "white" }}><ExternalLink size={15} /> View LinkedIn post</a>
                      ) : draft.status === "publishing" ? (
                        <button disabled style={{ ...button, cursor: "not-allowed", opacity: .7 }}><LoaderCircle size={15} /> Publishing locked</button>
                      ) : (
                        <button disabled={busy || role !== "admin" || !linkedin?.connected} onClick={() => publishLinkedIn(draft)} style={{ ...button, background: "#0a66c2", color: "white", borderColor: "#0a66c2" }}>
                          {busy ? <LoaderCircle className="spin" size={15} /> : <LinkedInIcon size={15} color="white" />} {draft.status === "failed" ? "Retry LinkedIn post" : "Publish on LinkedIn"}
                        </button>
                      )}
                      <button onClick={() => copyDraft(draft)} style={button}>{copied === draft.id ? <Check size={16} /> : <Copy size={16} />} {copied === draft.id ? "Copied" : "Copy post"}</button>
                      {draft.platform === "facebook" && draft.status !== "published" && <button disabled={busy || role !== "admin"} onClick={() => update(draft, "published")} style={button}><Check size={15} /> Mark published</button>}
                      <a href={draft.payload?.photos?.[0] || draft.image_url || "#"} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", opacity: draft.image_url ? 1 : .5 }}><ExternalLink size={15} /> Open photo</a>
                    </div>
                    {draft.error && <div role="alert" style={{ fontSize: 14.5, color: "var(--danger)" }}>{draft.error}</div>}
                    <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--muted)" }}>Generated by {draft.generator.endsWith("-sdk") ? "the Ahlam SDK agent" : "the fact-only safety template"}. {draft.platform === "linkedin" ? "Daily publishing runs only when the founder connection and auto-publish switch are active." : "The extension fills Facebook and leaves the final Publish decision visible."}</div>
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
