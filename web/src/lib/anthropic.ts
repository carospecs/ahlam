export function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export async function anthropicGenerate(
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: { type: "text" | "image"; text?: string; source?: { type: "base64"; media_type: string; data: string } }[] }[],
): Promise<Response> {
  const key = getAnthropicKey();
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  });
  return res;
}
