"use client";

import { useState, useEffect } from "react";
import { LoaderCircle, Check, Mail, Lock, ShieldCheck } from "lucide-react";
import { csToast } from "../Dashboard";

export function AccountSettings({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [showOnline, setShowOnline] = useState(true);
  const [saved, setSaved] = useState(false);

  // Change email
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState("");

  // Change password
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

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
    // Verified state comes straight from the session.
    import("@/lib/supabase-browser").then(({ supabaseBrowser }) =>
      supabaseBrowser().auth.getUser().then(({ data: { user } }) => {
        if (user) setEmailVerified(!!(user.email_confirmed_at || user.app_metadata?.provider === "google"));
      })
    );
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

  async function requestEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailBusy(true); setEmailNote("");
    try {
      const r = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setEmailNote(d.error || "Couldn't send the confirmation. Try again.");
      else { setEmailNote(`Confirmation link sent to ${d.sentTo}. Your email changes when you click it, then sign in again.`); setNewEmail(""); }
    } catch { setEmailNote("Network error. Try again."); }
    setEmailBusy(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) { csToast("Use at least 8 characters"); return; }
    if (newPw !== confirmPw) { csToast("New passwords don't match"); return; }
    setPwBusy(true);
    try {
      const sb = (await import("@/lib/supabase-browser")).supabaseBrowser();
      // Re-authenticate with the current password before allowing the change.
      const { error: reErr } = await sb.auth.signInWithPassword({ email, password: curPw });
      if (reErr) { csToast("Current password is wrong. Signed up with Google? Use Forgot password on the sign-in screen to set one first."); setPwBusy(false); return; }
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) { csToast(error.message); setPwBusy(false); return; }
      csToast("Password updated");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch { csToast("Couldn't update the password. Try again."); }
    setPwBusy(false);
  }

  return (
    <div style={{ maxWidth: 560, display: "grid", gap: 16 }}>
      {/* Profile */}
      <section style={card}>
        <div style={cardTitle}>Profile</div>
        <div style={cardHint}>How you appear to buyers and your team.</div>
        <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={lbl}>Display name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inp} />
          </div>
          <div>
            <label style={lbl}>About you</label>
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
          <button type="submit" style={btn}>{saved ? <><Check size={15} /> Saved!</> : "Save profile"}</button>
        </form>
      </section>

      {/* Email */}
      <section style={card}>
        <div style={cardTitle}><Mail size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />Email address</div>
        <div style={cardHint}>Where sign-in, buyer messages, and receipts go.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", fontSize: 14 }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
          {emailVerified && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--success)" }}>
              <ShieldCheck size={13} /> verified
            </span>
          )}
        </div>
        <form onSubmit={requestEmailChange} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" style={{ ...inp, flex: 1, minWidth: 200 }} />
          <button type="submit" disabled={emailBusy} style={{ ...btn, opacity: emailBusy ? 0.6 : 1 }}>
            {emailBusy ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Change email
          </button>
        </form>
        {emailNote && <div style={{ fontSize: 12.5, marginTop: 9, color: emailNote.startsWith("Confirmation") ? "var(--success)" : "var(--danger)", lineHeight: 1.5 }}>{emailNote}</div>}
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 9 }}>We send a confirmation link to the new address. Nothing changes until you click it.</div>
      </section>

      {/* Password */}
      <section style={card}>
        <div style={cardTitle}><Lock size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />Password</div>
        <div style={cardHint}>Use at least 8 characters with a number and a symbol.</div>
        <form onSubmit={changePassword} style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={lbl}>Current password</label>
            <input type="password" required autoComplete="current-password" value={curPw} onChange={e => setCurPw(e.target.value)} style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>New password</label>
              <input type="password" required autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Confirm new password</label>
              <input type="password" required autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inp} />
            </div>
          </div>
          <button type="submit" disabled={pwBusy} style={{ ...btn, opacity: pwBusy ? 0.6 : 1 }}>
            {pwBusy ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Update password
          </button>
        </form>
      </section>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", padding: "18px 20px",
};
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700 };
const cardHint: React.CSSProperties = { fontSize: 12.5, color: "var(--muted)", margin: "3px 0 14px" };
const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 };
const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)",
  background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, outline: "none",
};
const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 11,
  border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, width: "fit-content", cursor: "pointer",
};
