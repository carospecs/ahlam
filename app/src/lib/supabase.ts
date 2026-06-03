import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { config } from "@/lib/config";

/**
 * Supabase client for the app. Uses AsyncStorage to persist the session so
 * users stay logged in. Auth: email (verification) + Google (set up in the
 * Supabase dashboard). Apple sign-in intentionally deferred for v1.
 *
 * On web, detectSessionInUrl is enabled so that OAuth redirects (Google)
 * are handled automatically when the user lands back on the app.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
