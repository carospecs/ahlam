import type { AIResult } from "@carospecs/shared";
import { config } from "@/lib/config";

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
    const res = await fetch(`${config.apiBaseUrl}/api/identify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
