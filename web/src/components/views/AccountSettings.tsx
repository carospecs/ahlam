"use client";

import { useState, useEffect } from "react";

export function AccountSettings({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [showOnline, setShowOnline] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user").then(r => r.json()).then(d => {
      if (d.user) {
        setName(d.user.displayName || "");
        setEmail(d.user.email || "");
        setPhone(d.user.phone || "");
        setBio(d.user.bio || "");
        if (d.user.showOnline !== undefined) setShowOnline(d.user.showOnline);
      }
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const sb = (await import("@/lib/supabase-browser")).supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("profiles").upsert({
      id: user.id, display_name: name, phone, bio,
      is_online: showOnline,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <form onSubmit={save} style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>Display name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>Email</label>
          <input value={email} disabled style={{ ...inp, opacity: 0.5 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inp} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>About you</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Parts specialist, 10 years in the industry…" style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Online status</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Show when you&apos;re online. When off, you can&apos;t see others&apos; status.</div>
          </div>
          <button type="button" onClick={() => setShowOnline(!showOnline)} style={{ width: 48, height: 26, borderRadius: 999, border: "none", background: showOnline ? "var(--accent)" : "var(--line)", cursor: "pointer", position: "relative", transition: "background 0.2s", padding: 0 }}>
            <span style={{ position: "absolute", top: 3, left: showOnline ? 24 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
        <button type="submit" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 11,
          border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, width: "fit-content",
        }}>
          {saved ? "Saved!" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)",
  background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, outline: "none",
};
