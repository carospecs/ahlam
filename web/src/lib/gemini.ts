// Gemini API client with automatic key fallback.
// Tries the primary GEMINI_API_KEY first; on quota/billing errors (402, 403, 429)
// retries the same request with GEMINI_API_KEY_FALLBACK.

export function getPrimaryKey(): string | undefined {
  return process.env.GEMINI_API_KEY || undefined;
}

export function getFallbackKey(): string | undefined {
  return process.env.GEMINI_API_KEY_FALLBACK || undefined;
}

// POST to a Gemini model endpoint. Returns the JSON response on success, or
// throws on failure (after exhausting both keys).
export async function geminiGenerate(
  model: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const keys = [getPrimaryKey(), getFallbackKey()].filter(Boolean) as string[];
  if (!keys.length) throw new Error("GEMINI_API_KEY missing");

  let lastErr: Error | null = null;
  for (const key of keys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    const isQuota = [402, 403, 429].includes(res.status);
    if (!isQuota) return res; // non-quota error → surface immediately
    lastErr = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  throw lastErr || new Error("Gemini API unavailable");
}
