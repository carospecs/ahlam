"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Landing } from "@/components/Landing";
import { supabaseBrowser } from "@/lib/supabase-browser";

const Login = lazy(() => import("@/components/Login").then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import("@/components/Dashboard").then((m) => ({ default: m.Dashboard })));

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Show the login form AND mark it in the URL (?signin) so a refresh keeps the
  // user on the auth screen instead of bouncing back to the marketing page.
  const openLogin = () => {
    setShowLogin(true);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("signin")) {
      url.searchParams.set("signin", "1");
      // pushState (not replaceState) so the sign-in screen is its OWN history
      // entry — pressing browser "back" pops it and returns to the homepage,
      // never to whatever page (e.g. /waitlist) preceded it.
      window.history.pushState({ signin: true }, "", url);
    }
  };

  // Leaving the auth screen (e.g. sign-out) clears the ?signin marker.
  const closeLogin = () => {
    setShowLogin(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("signin")) {
      url.searchParams.delete("signin");
      window.history.replaceState({}, "", url);
    }
  };

  useEffect(() => {
    // Jump straight to the auth form for sign-in intents (OAuth error, ?signin,
    // or a password-recovery link) rather than showing the marketing landing.
    const params = new URLSearchParams(window.location.search);
    if (params.has("signin") || params.get("error") === "auth" || window.location.hash.includes("type=recovery")) {
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
    // sign-in screen pops the pushed entry (no ?signin) → close login → homepage.
    const onPop = () => setShowLogin(new URLSearchParams(window.location.search).has("signin"));
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
  // Auth screen stays reachable here only for OAuth-callback / password-recovery
  // links (?signin / type=recovery). The public landing no longer links to it.
  if (showLogin) return <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>Loading…</div>}><Login onLogin={() => setAuthed(true)} onClose={closeLogin} /></Suspense>;
  // Sign in / sign up are closed to the public pre-launch: every landing CTA goes
  // to the waitlist. Admins log in via the hidden /adminhost route.
  const goWaitlist = () => { window.location.href = "/waitlist"; };
  return <Landing onGetStarted={goWaitlist} onSignIn={goWaitlist} />;
}
