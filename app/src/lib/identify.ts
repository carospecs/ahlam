import type { AIResult } from "@carospecs/shared";
import { config } from "@/lib/config";

/**
 * Send a part photo to the CaroSpecs backend for GPT-4o Vision identification.
 * The backend holds the OpenAI key. Returns an AIResult — on failure the app
 * shows result.userMessage (calm "high demand" copy), never a raw error.
 */
export async function identifyPart(params: {
  imageBase64: string;
  vin?: { make?: string; model?: string; year?: number };
}): Promise<AIResult> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/api/identify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: params.imageBase64,
        vin: params.vin,
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
