"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Landing } from "@/components/Landing";
import { I18nProvider } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase-browser";

const Login = lazy(() => import("@/components/Login").then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import("@/components/Dashboard").then((m) => ({ default: m.Dashboard })));

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<"signin" | "signup">("signin");

  // Show the auth form AND mark it in the URL (?signin / ?signup) so a refresh
  // keeps the user on the auth screen instead of bouncing back to marketing.
  const openAuth = (mode: "signin" | "signup") => {
    setLoginMode(mode);
    setShowLogin(true);
    const url = new URL(window.location.href);
    if (!url.searchParams.has(mode)) {
      url.searchParams.delete(mode === "signin" ? "signup" : "signin");
      url.searchParams.set(mode, "1");
      // pushState (not replaceState) so the auth screen is its OWN history
      // entry — pressing browser "back" pops it and returns to the homepage.
      window.history.pushState({ [mode]: true }, "", url);
    }
  };

  // Leaving the auth screen (e.g. sign-out) clears the ?signin/?signup marker.
  const closeLogin = () => {
    setShowLogin(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("signin") || url.searchParams.has("signup")) {
      url.searchParams.delete("signin");
      url.searchParams.delete("signup");
      window.history.replaceState({}, "", url);
    }
  };

  useEffect(() => {
    // Jump straight to the auth form for auth intents (OAuth error, ?signin,
    // ?signup, or a password-recovery link) rather than the marketing landing.
    const params = new URLSearchParams(window.location.search);
    if (params.has("signup")) {
      setLoginMode("signup");
      setShowLogin(true);
    } else if (params.has("signin") || params.get("error") === "auth" || window.location.hash.includes("type=recovery")) {
      setShowLogin(true);
    }

    // PERF: the public landing must not wait on a network getSession() round-trip.
    // Supabase persists the session in localStorage, so synchronously check for a
    // token: if there's none, render the marketing page immediately (anonymous
    // visitors are the common case). getSession() still runs below to confirm and
    // upgrade returning users to the dashboard.
    let hasPersistedSession = false;
    try {
      hasPersistedSession = Object.keys(localStorage).some(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
    } catch { /* localStorage blocked — fall through to the network check */ }
    if (!hasPersistedSession) setAuthed(false);

    const sb = supabaseBrowser();
    sb.auth
      .getSession()
      .then(({ data: { session } }) => {
        setAuthed(!!session);
      })
      .catch(() => {
        // Never leave the user stuck on "Loading…": fail open to the landing page.
        setAuthed(false);
      });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });

    // Keep the login view in sync with browser history: pressing "back" from the
    // auth screen pops the pushed entry (no ?signin/?signup) → close → homepage.
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      if (p.has("signup")) setLoginMode("signup");
      setShowLogin(p.has("signin") || p.has("signup"));
    };
    window.addEventListener("popstate", onPop);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  if (authed === null) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (authed) return <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>Loading…</div>}><Dashboard onSignOut={() => { supabaseBrowser().auth.signOut(); closeLogin(); setAuthed(false); }} /></Suspense>;
  if (showLogin) return <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>Loading…</div>}><Login key={loginMode} initialMode={loginMode} onLogin={() => setAuthed(true)} onClose={closeLogin} /></Suspense>;
  // Launched: the landing's CTAs open sign-up (create account) or sign-in.
  return <I18nProvider><Landing onGetStarted={() => openAuth("signup")} onSignIn={() => openAuth("signin")} /></I18nProvider>;
}
