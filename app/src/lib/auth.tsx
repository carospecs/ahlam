import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export interface Shop {
  id: string;
  name: string;
  location: string | null;
  business_phone: string | null;
}

interface SessionState {
  loading: boolean;
  session: Session | null;
  /** The shop the user belongs to, or null if they haven't created one yet. */
  shop: Shop | null;
  shopLoading: boolean;
  refreshShop: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoading, setShopLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function refreshShop() {
    if (!session) {
      setShop(null);
      return;
    }
    setShopLoading(true);
    // A user belongs to (at most, for v1) one shop via shop_members.
    const { data } = await supabase
      .from("shop_members")
      .select("shops(id, name, location, business_phone)")
      .limit(1)
      .maybeSingle();
    const s = (data?.shops as Shop | undefined) ?? null;
    setShop(s);
    setShopLoading(false);
  }

  useEffect(() => {
    refreshShop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    setShop(null);
  }

  return (
    <SessionContext.Provider
      value={{ loading, session, shop, shopLoading, refreshShop, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

// --- Auth actions -----------------------------------------------------------

/**
 * Returns { needsConfirmation } so the UI can react correctly:
 * - If the project requires email confirmation, no session is returned and the
 *   user must click the verification link first.
 * - If auto-confirm is on, a session is returned immediately (the auth listener
 *   then redirects), so we should NOT tell the user to check their email.
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Google OAuth via the system browser. Requires Google configured in the
 * Supabase dashboard (Auth > Providers > Google). Uses PKCE: we open the
 * provider URL, then exchange the returned ?code= for a session.
 */
export async function signInWithGoogle() {
  // Web: let Supabase do a normal full-page redirect; detectSessionInUrl (set
  // in supabase.ts for web) completes the session on return. The native
  // in-app-browser + manual code exchange does not apply in the browser.
  if (Platform.OS === "web") {
    const redirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  const redirectTo = Linking.createURL("/");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start Google sign-in.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return; // user cancelled

  const code = new URL(result.url).searchParams.get("code");
  if (!code) throw new Error("Google sign-in did not return a code.");
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) throw exErr;
}
