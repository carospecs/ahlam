import Constants from "expo-constants";

/**
 * App config. The AI key is NEVER here — the app calls the CaroSpecs backend
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
  apiBaseUrl: env("EXPO_PUBLIC_API_BASE_URL") ?? "http://localhost:3000",
};
