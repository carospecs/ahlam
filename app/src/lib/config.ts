import Constants from "expo-constants";

/**
 * App config. The AI key is NEVER here — the app calls the Ahlam backend
 * (/api/identify), which holds the OpenAI key server-side.
 */
function env(name: string): string | undefined {
  // EXPO_PUBLIC_* vars are inlined at build time; fall back to extra for flexibility.
  return (
    (process.env[name] as string | undefined) ??
    (Constants.expoConfig?.extra?.[name] as string | undefined)
  );
}

export const config = {
  supabaseUrl: env("EXPO_PUBLIC_SUPABASE_URL") ?? "",
  supabaseAnonKey: env("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? "",
  // Where /api/identify and /api/* live (your deployed web app).
  // A physical phone cannot reach its own localhost. Local development can
  // still override this with EXPO_PUBLIC_API_BASE_URL.
  apiBaseUrl: env("EXPO_PUBLIC_API_BASE_URL") ?? "https://ahlam.io",
};
