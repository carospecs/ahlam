"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const Login = lazy(() => import("@/components/Login").then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import("@/components/Dashboard").then((m) => ({ default: m.Dashboard })));

const Loading = () => (
  <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>
    Loading…
  </div>
);

/**
 * Hidden admin entry point. Public ahlam.io only shows the waitlist — sign in /
 * sign up are closed. The founders/test accounts log in here (sign-in only, no
 * account creation) to use the full app. Once authenticated the session persists
 * like any other, so navigating to "/" also lands in the dashboard.
 */
export default function AdminHost() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let hasPersistedSession = false;
    try {
      hasPersistedSession = Object.keys(localStorage).some(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
    } catch { /* localStorage blocked — fall through to the network check */ }
    if (!hasPersistedSession) setAuthed(false);

    const sb = supabaseBrowser();
    sb.auth.getSession()
      .then(({ data: { session } }) => setAuthed(!!session))
      .catch(() => setAuthed(false));

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => setAuthed(!!session));
    return () => subscription.unsubscribe();
  }, []);

  if (authed === null) return <Loading />;

  if (authed) {
    return (
      <Suspense fallback={<Loading />}>
        <Dashboard onSignOut={() => { supabaseBrowser().auth.signOut(); setAuthed(false); }} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <Login signInOnly onLogin={() => setAuthed(true)} onClose={() => { window.location.href = "/"; }} />
    </Suspense>
  );
}
