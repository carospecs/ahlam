"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, LoaderCircle, Mail, Lock, ScanLine } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { BrandChip } from "./BrandMark";

const EASE = [0.22, 0.8, 0.26, 1] as const;

function BrandPanel({ onHome }: { onHome: () => void }) {
  return (
    <div className="grain login-panel" style={lx.panel}>
      <a style={lx.brand} href="/" onClick={(e) => { e.preventDefault(); onHome(); }}>
        <BrandChip size={34} />
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
      </a>
      <div style={{ maxWidth: 380 }}>
        <span style={lx.pill}>
          <span style={lx.dot} /> Pilot shops · early access
        </span>
        <h1 style={lx.headline}>Photograph a part.<br /><span style={{ color: "var(--accent)" }}>List it in seconds.</span></h1>
        <p style={lx.sub}>Sign in to your shop to add vehicles, review AI-graded parts, and post listings everywhere you sell.</p>
      </div>
      <div style={lx.teaser}>
        <div style={lx.teaserHead}>
          <ScanLine size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>AI review card</span>
        </div>
        <TeaserRow label="Part" value="Alternator" />
        <TeaserRow label="Fits" value="2013–2017 Accord" />
        <TeaserRow label="Condition" value="Good" badge />
        <TeaserRow label="Suggested" value="$85" />
      </div>
      <p style={lx.fine}>AI can make mistakes — every listing is reviewed before posting.</p>
    </div>
  );
}

function TeaserRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div style={lx.trow}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      {badge ? (
        <span style={lx.trowBadge}>{value}</span>
      ) : (
        <span className="tnum" style={{ fontWeight: 600 }}>{value}</span>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 16 3 9.1 7.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.9 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-6.9l-6.5 5C9 41.3 15.9 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.5l6.3 5.3C39.9 36.5 45 30.9 45 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function Field({ label, icon, right, children }: { label: string; icon: string; right?: React.ReactNode; children: React.ReactNode }) {
  const IconComp = icon === "Mail" ? Mail : Lock;
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={lx.fieldRow}>
        <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{label}</span>
        {right}
      </span>
      <span style={lx.inputWrap}>
        <IconComp size={17} color="var(--muted)" style={{ flexShrink: 0 }} />
        {children}
      </span>
    </label>
  );
}

export function Login({ onLogin, onClose }: { onLogin: () => void; onClose?: () => void }) {
  // Return to the marketing landing. onClose flips the parent back to <Landing>
  // (SPA, keeps state); fall back to a hard nav to "/" if it isn't provided.
  const goHome = () => { if (onClose) onClose(); else window.location.href = "/"; };
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "recover">("signin");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth") {
      setError("Google sign-in didn't complete. Please try again, or sign in with your email and password below.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    // If the user starts Google sign-in then hits "back", the page is restored
    // from the bfcache with busy=true — clear it so they can use manual login.
    const onPageShow = () => setBusy(false);
    window.addEventListener("pageshow", onPageShow);
    // When a user returns from a password-reset email, Supabase fires PASSWORD_RECOVERY
    // with a temporary session — switch to the "set new password" form.
    const sb = supabaseBrowser();
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recover");
        setNotice("Choose a new password to finish resetting your account.");
      }
    });
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Lightweight password strength (signup only): 0–4
  const pwScore = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwLabels = ["Too short", "Weak", "Fair", "Good", "Strong"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const sb = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { error: signUpErr } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: displayName || email.split("@")[0] } },
        });
        if (signUpErr) { setError(signUpErr.message); setBusy(false); return; }
        setNotice("Check your email for a confirmation link to activate your account.");
        setBusy(false);
      } else if (mode === "forgot") {
        const { error: resetErr } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/`,
        });
        if (resetErr) { setError(resetErr.message); setBusy(false); return; }
        setNotice("If an account exists for that email, a reset link is on its way.");
        setBusy(false);
      } else if (mode === "recover") {
        const { error: updErr } = await sb.auth.updateUser({ password });
        if (updErr) { setError(updErr.message); setBusy(false); return; }
        onLogin();
      } else {
        const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
        if (signInErr) { setError(signInErr.message); setBusy(false); return; }
        onLogin();
      }
    } catch {
      setError("Something went wrong. Try again.");
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    const sb = supabaseBrowser();
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
  }

  return (
    <div style={lx.screen}>
      <motion.a
        href="/" onClick={(e) => { e.preventDefault(); goHome(); }} style={lx.back}
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
      >
        <ArrowLeft size={15} /> Back to home
      </motion.a>
      <motion.div
        style={lx.card} className="login-card"
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        <BrandPanel onHome={goHome} />
        <div style={lx.formWrap}>
          <div style={lx.formInner} className="fade-up">
            <a style={{ ...lx.brand, marginBottom: 4 }} href="/" onClick={(e) => { e.preventDefault(); goHome(); }} data-mobile-brand>
              <BrandChip size={34} />
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
            </a>
            <h2 style={lx.formTitle}>{
              mode === "signin" ? "Sign in to Ahlam"
              : mode === "signup" ? "Create your account"
              : mode === "forgot" ? "Reset your password"
              : "Set a new password"
            }</h2>
            <p style={lx.formSub}>{
              mode === "signin" ? "Welcome back. Pick up where you left off."
              : mode === "signup" ? "Shop or individual seller — you'll choose next. Same tools either way."
              : mode === "forgot" ? "Enter your email and we'll send you a secure reset link."
              : "Almost done — choose a strong password you'll remember."
            }</p>
            <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 22 }}>
              {mode === "signup" && (
                <Field label="Display name" icon="Mail">
                  <input type="text" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" style={lx.input} />
                </Field>
              )}
              {mode !== "recover" && (
                <Field label="Work email" icon="Mail">
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourshop.com" style={lx.input} />
                </Field>
              )}
              {mode !== "forgot" && (
                <Field label={mode === "recover" ? "New password" : "Password"} icon="Lock" right={mode === "signin" ? <a href="#" style={lx.forgot} onClick={(e) => { e.preventDefault(); setError(""); setNotice(""); setMode("forgot"); }}>Forgot?</a> : null}>
                  <input type="password" required autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={lx.input} />
                </Field>
              )}
              {(mode === "signup" || mode === "recover") && password.length > 0 && (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < pwScore ? (pwScore <= 1 ? "var(--danger)" : pwScore === 2 ? "var(--signal)" : "var(--success)") : "var(--surface2)" }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{pwLabels[pwScore]} · use 8+ chars with a number and symbol</span>
                </div>
              )}
              {error && (
                <div style={{ fontSize: 13, color: "var(--danger)", padding: "6px 0" }}>{error}</div>
              )}
              {notice && (
                <div style={{ fontSize: 13, color: "var(--success)", padding: "6px 0" }}>{notice}</div>
              )}
              <button type="submit" disabled={busy} style={{ ...lx.cta, opacity: busy ? 0.65 : 1 }}>
                {busy && <LoaderCircle size={18} style={{ animation: "spin 0.8s linear infinite" }} />}
                {busy ? "Please wait…" : (
                  mode === "signin" ? "Sign in"
                  : mode === "signup" ? "Create account"
                  : mode === "forgot" ? "Send reset link"
                  : "Save new password"
                )}
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>
            {mode === "signin" || mode === "signup" ? (
              <>
                <div style={lx.divider}><span style={lx.divLine} /> <span style={lx.or}>or</span> <span style={lx.divLine} /></div>
                <button style={lx.google} disabled={busy} onClick={googleSignIn}><GoogleG /> Continue with Google</button>
                <p style={lx.switch}>
                  {mode === "signin" ? "New to Ahlam? " : "Already have an account? "}
                  <a href="#" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setError(""); setNotice(""); setMode(mode === "signin" ? "signup" : "signin"); }}>
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </a>
                </p>
              </>
            ) : mode === "forgot" ? (
              <p style={lx.switch}>
                Remembered it?{" "}
                <a href="#" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setError(""); setNotice(""); setMode("signin"); }}>Back to sign in</a>
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const lx: Record<string, React.CSSProperties> = {
  screen: { position: "relative", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 },
  back: { position: "absolute", top: 20, left: 20, zIndex: 5, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(8px)", color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" },
  card: { width: "min(880px, 100%)", display: "grid", gridTemplateColumns: "1fr 0.92fr", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.6)" },
  panel: { padding: 36, display: "flex", flexDirection: "column", gap: 24, justifyContent: "space-between", borderRight: "1px solid var(--line)", minHeight: 600 },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--foreground)" },
  logoSm: { width: 34, height: 34, borderRadius: 10, background: "var(--accent)", display: "grid", placeItems: "center" },
  pill: { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", background: "var(--accent-tint)", padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--accent)" },
  dot: { width: 6, height: 6, borderRadius: 999, background: "var(--accent)", animation: "pulse-dot 1.8s infinite" },
  headline: { margin: "18px 0 0", fontSize: 38, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.02em" },
  sub: { margin: "14px 0 0", color: "var(--muted)", fontSize: 15, lineHeight: 1.55 },
  teaser: { borderRadius: "var(--radius-lg)", border: "1px solid var(--line)", background: "var(--background)", padding: 16, display: "grid", gap: 8 },
  teaserHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  trow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", borderRadius: 9, padding: "9px 12px", fontSize: 13 },
  trowBadge: { background: "rgba(34,197,94,0.18)", color: "var(--success)", borderRadius: 7, padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  fine: { margin: 0, fontSize: 11.5, color: "var(--muted)" },
  formWrap: { display: "grid", placeItems: "center", padding: 30 },
  formInner: { width: "100%", maxWidth: 360 },
  formTitle: { margin: "8px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" },
  formSub: { margin: "8px 0 0", color: "var(--muted)", fontSize: 14, lineHeight: 1.5 },
  fieldRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  forgot: { color: "var(--muted)", fontSize: 12.5, textDecoration: "none" },
  inputWrap: { display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12 },
  input: { flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 15, padding: "13px 0" },
  cta: { marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", border: "none", borderRadius: 12, background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 600, padding: "13px 0", transition: "background 0.15s" },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
  divLine: { flex: 1, height: 1, background: "var(--line)" },
  or: { color: "var(--muted)", fontSize: 13 },
  google: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", border: "1px solid var(--line)", borderRadius: 12, background: "transparent", color: "var(--foreground)", fontSize: 14.5, fontWeight: 600, padding: "12px 0" },
  switch: { marginTop: 22, textAlign: "center", color: "var(--muted)", fontSize: 13.5 },
};
