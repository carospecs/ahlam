"use client";

import { useState, useEffect } from "react";
import { Login } from "@/components/Login";
import { Landing } from "@/components/Landing";
import { Dashboard } from "@/components/Dashboard";
import { supabaseBrowser } from "@/lib/supabase-browser";

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

  if (authed) return <Dashboard onSignOut={() => { supabaseBrowser().auth.signOut(); setShowLogin(false); setAuthed(false); }} />;
  if (showLogin) return <Login onLogin={() => setAuthed(true)} />;
  return <Landing onGetStarted={() => setShowLogin(true)} onSignIn={() => setShowLogin(true)} />;
}
