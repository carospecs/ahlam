// Ahlam login — mirrors the waitlist aesthetic (dark + grain, red CTA,
// Wrench logo, Plus Jakarta Sans). Split: brand teaser left, form right.
const { useState: useStateL } = React;

function BrandPanel() {
  const I = window.Icon;
  return (
    <div className="grain login-panel" style={lx.panel}>
      <a style={lx.brand} href="#">
        <span style={lx.logoSm}><I name="Wrench" size={18} strokeWidth={2.25} color="#fff" /></span>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
      </a>

      <div style={{ maxWidth: 380 }}>
        <span style={lx.pill}>
          <span style={lx.dot} /> Pilot shops · early access
        </span>
        <h1 style={lx.headline}>
          Photograph a part.<br />
          <span style={{ color: "var(--accent)" }}>List it in seconds.</span>
        </h1>
        <p style={lx.sub}>
          Sign in to your shop to add vehicles, review AI-graded parts, and post
          listings everywhere you sell.
        </p>
      </div>

      {/* review-card teaser, same as the landing's "aha" */}
      <div style={lx.teaser}>
        <div style={lx.teaserHead}>
          <I name="ScanLine" size={16} color="var(--accent)" />
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

function TeaserRow({ label, value, badge }) {
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

function Login({ onLogin }) {
  const I = window.Icon;
  const [mode, setMode] = useStateL("signin");
  const [email, setEmail] = useStateL("");
  const [password, setPassword] = useStateL("");
  const [busy, setBusy] = useStateL(false);

  function submit(e) {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => { setBusy(false); onLogin(); }, 650);
  }

  return (
    <div style={lx.screen}>
      <div style={lx.card} className="login-card">
        <BrandPanel />

        <div style={lx.formWrap}>
          <div style={lx.formInner} className="fade-up">
            <a style={{ ...lx.brand, marginBottom: 4 }} href="#" data-mobile-brand>
              <span style={lx.logoSm}><I name="Wrench" size={18} strokeWidth={2.25} color="#fff" /></span>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Ahlam</span>
            </a>

            <h2 style={lx.formTitle}>
              {mode === "signin" ? "Sign in to your shop" : "Create your shop account"}
            </h2>
            <p style={lx.formSub}>
              {mode === "signin"
                ? "Welcome back. Pick up where your crew left off."
                : "Set up a shop and invite your team — owners, editors, viewers."}
            </p>

            <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 22 }}>
              <Field label="Work email" icon="Mail">
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourshop.com" style={lx.input}
                />
              </Field>
              <Field
                label="Password"
                icon="Lock"
                right={mode === "signin" ? <a href="#" style={lx.forgot} onClick={(e) => e.preventDefault()}>Forgot?</a> : null}
              >
                <input
                  type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" style={lx.input}
                />
              </Field>

              <button type="submit" disabled={busy} style={{ ...lx.cta, opacity: busy ? 0.65 : 1 }}>
                {busy && <I name="LoaderCircle" size={18} style={{ animation: "spin 0.8s linear infinite" }} />}
                {busy ? "Signing in…" : (mode === "signin" ? "Sign in" : "Create account")}
                {!busy && <I name="ArrowRight" size={16} />}
              </button>
            </form>

            <div style={lx.divider}>
              <span style={lx.divLine} /> <span style={lx.or}>or</span> <span style={lx.divLine} />
            </div>

            <button style={lx.google} onClick={() => { setBusy(true); setTimeout(onLogin, 650); }}>
              <GoogleG /> Continue with Google
            </button>

            <p style={lx.switch}>
              {mode === "signin" ? "New to Ahlam? " : "Already have an account? "}
              <a
                href="#"
                style={{ color: "var(--accent)", fontWeight: 600 }}
                onClick={(e) => { e.preventDefault(); setMode(mode === "signin" ? "signup" : "signin"); }}
              >
                {mode === "signin" ? "Create a shop account" : "Sign in"}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, right, children }) {
  const I = window.Icon;
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={lx.fieldRow}>
        <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{label}</span>
        {right}
      </span>
      <span style={lx.inputWrap}>
        <I name={icon} size={17} color="var(--muted)" style={{ flexShrink: 0 }} />
        {children}
      </span>
    </label>
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

const lx = {
  screen: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 },
  card: {
    width: "min(880px, 100%)", display: "grid", gridTemplateColumns: "1fr 0.92fr",
    background: "var(--surface)", border: "1px solid var(--line)",
    borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.6)",
  },
  panel: {
    padding: 36, display: "flex", flexDirection: "column", gap: 24, justifyContent: "space-between",
    borderRight: "1px solid var(--line)", minHeight: 600,
  },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--foreground)" },
  logoSm: { width: 34, height: 34, borderRadius: 10, background: "var(--accent)", display: "grid", placeItems: "center" },
  pill: {
    display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999,
    border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.1)",
    padding: "5px 12px", fontSize: 12, fontWeight: 500, color: "#fca5a5",
  },
  dot: { width: 6, height: 6, borderRadius: 999, background: "var(--accent)", animation: "pulse-dot 1.8s infinite" },
  headline: { margin: "18px 0 0", fontSize: 38, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.02em" },
  sub: { margin: "14px 0 0", color: "var(--muted)", fontSize: 15, lineHeight: 1.55 },
  teaser: { borderRadius: "var(--radius-lg)", border: "1px solid var(--line)", background: "rgba(15,23,42,0.5)", padding: 16, display: "grid", gap: 8 },
  teaserHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  trow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", borderRadius: 9, padding: "9px 12px", fontSize: 13 },
  trowBadge: { background: "rgba(34,197,94,0.18)", color: "var(--success)", borderRadius: 7, padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  fine: { margin: 0, fontSize: 11.5, color: "var(--muted)" },
  formWrap: { display: "grid", placeItems: "center", padding: 30 },
  formInner: { width: "100%", maxWidth: 360 },
  formTitle: { margin: "8px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" },
  formSub: { margin: "8px 0 0", color: "var(--muted)", fontSize: 14, lineHeight: 1.5 },
  fieldRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  forgot: { color: "var(--muted)", fontSize: 12.5, textDecoration: "none" },
  inputWrap: {
    display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
    background: "rgba(39,47,66,0.6)", border: "1px solid var(--line)", borderRadius: 12,
  },
  input: {
    flex: 1, border: "none", outline: "none", background: "transparent",
    color: "var(--foreground)", fontSize: 15, padding: "13px 0",
  },
  cta: {
    marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
    width: "100%", border: "none", borderRadius: 12, background: "var(--accent)",
    color: "#fff", fontSize: 15, fontWeight: 600, padding: "13px 0", transition: "background 0.15s",
  },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
  divLine: { flex: 1, height: 1, background: "var(--line)" },
  or: { color: "var(--muted)", fontSize: 13 },
  google: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
    border: "1px solid var(--line)", borderRadius: 12, background: "transparent",
    color: "var(--foreground)", fontSize: 14.5, fontWeight: 600, padding: "12px 0",
  },
  switch: { marginTop: 22, textAlign: "center", color: "var(--muted)", fontSize: 13.5 },
};

window.Login = Login;
