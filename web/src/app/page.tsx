"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Landing } from "@/components/Landing";
import { supabaseBrowser } from "@/lib/supabase-browser";

const Login = lazy(() => import("@/components/Login").then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import("@/components/Dashboard").then((m) => ({ default: m.Dashboard })));

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // Jump straight to the auth form for sign-in intents (OAuth error, ?signin,
    // or a password-recovery link) rather than showing the marketing landing.
    const params = new URLSearchParams(window.location.search);
    if (params.has("signin") || params.get("error") === "auth" || window.location.hash.includes("type=recovery")) {
      setShowLogin(true);
    }

    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authed === null) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (authed) return <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>Loading…</div>}><Dashboard onSignOut={() => { supabaseBrowser().auth.signOut(); setShowLogin(false); setAuthed(false); }} /></Suspense>;
  if (showLogin) return <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted)", fontSize: 14 }}>Loading…</div>}><Login onLogin={() => setAuthed(true)} /></Suspense>;
  return <Landing onGetStarted={() => setShowLogin(true)} onSignIn={() => setShowLogin(true)} />;
}
