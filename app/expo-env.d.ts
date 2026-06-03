/// <reference types="expo/types" />

// Ambient declaration for EXPO_PUBLIC_* env vars used in src/lib/config.ts.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_API_BASE_URL?: string;
  }
}
