import type { AIResult } from "@ahlam/shared";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * Send a part photo to the Ahlam backend for Gemini Vision identification.
 * The backend holds the Gemini key. Returns an AIResult — on failure the app
 * shows result.userMessage (calm "high demand" copy), never a raw error.
 */
export async function identifyPart(params: {
  imageBase64: string;
  vin?: { make?: string; model?: string; year?: number };
  /** Vision model. Backend is Gemini-only; kept for API compatibility. */
  provider?: "gpt" | "gemini";
}): Promise<AIResult> {
  try {
    // The app has no cookies — send the Supabase access token so the backend
    // can authenticate the request.
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch(`${config.apiBaseUrl}/api/identify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64: params.imageBase64,
        vin: params.vin,
        provider: params.provider ?? "gemini",
      }),
    });
    const data = (await res.json()) as AIResult;
    return data;
  } catch (err) {
    return {
      ok: false,
      userMessage:
        "We couldn't reach the server. Check your connection — your photo is " +
        "saved and will process automatically once you're back online.",
      internalError: err instanceof Error ? err.message : String(err),
    };
  }
}
