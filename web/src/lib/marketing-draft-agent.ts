import { getAnthropic } from "@/lib/anthropic";
import { parseAgentDraft } from "../../scripts/marketing-core.mjs";

const MARKETING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "body", "hashtags"],
  properties: {
    headline: { type: "string" },
    body: { type: "string" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
} as const;

type Draft = { headline: string; body: string; hashtags: string[] };

function vehicleName(candidate: any) {
  return [candidate?.vehicle?.year, candidate?.vehicle?.make, candidate?.vehicle?.model, candidate?.vehicle?.trim]
    .filter(Boolean).join(" ").trim();
}

function publicFactPacket(shop: any, candidate: any, storefrontUrl: string) {
  return {
    shop: {
      name: shop.name,
      location: shop.location,
      phone: shop.business_phone,
      storefrontUrl,
    },
    inventory: candidate.type === "vehicle" ? {
      type: "whole_vehicle",
      year: candidate.vehicle.year,
      make: candidate.vehicle.make,
      model: candidate.vehicle.model,
      trim: candidate.vehicle.trim,
      body: candidate.vehicle.body,
      color: candidate.vehicle.color,
      mileage: candidate.vehicle.mileage,
      askingPriceUsd: candidate.price,
    } : {
      type: "part",
      partName: candidate.partName,
      conditionGrade: candidate.grade,
      priceUsd: candidate.price,
      sourceVehicle: candidate.vehicle ? {
        year: candidate.vehicle.year,
        make: candidate.vehicle.make,
        model: candidate.vehicle.model,
        trim: candidate.vehicle.trim,
      } : null,
    },
  };
}

export async function generateMarketingDraft({
  shop,
  candidate,
  storefrontUrl,
  fallback,
  platform = "facebook",
}: {
  shop: any;
  candidate: any;
  storefrontUrl: string;
  fallback: Draft;
  platform?: "facebook" | "linkedin";
}): Promise<Draft & { generator: string; agentRunId: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...fallback, generator: "deterministic", agentRunId: null };
  }

  const facts = publicFactPacket(shop, candidate, storefrontUrl);
  const itemName = candidate.type === "vehicle" ? vehicleName(candidate) : candidate.partName;
  try {
    const response = await getAnthropic().messages.create(
      {
        model: process.env.MARKETING_AGENT_MODEL || process.env.PRICING_MODEL || "claude-opus-4-8",
        max_tokens: 1200,
        output_config: {
          format: { type: "json_schema", schema: MARKETING_SCHEMA as unknown as Record<string, unknown> },
        },
        system: [
          "You are Ahlam's client marketing editor for independent auto dismantlers.",
          platform === "linkedin"
            ? "Write one concise LinkedIn company-page post in Ahlam's voice using only the supplied public inventory facts. Credit the client shop, explain Ahlam's practical role, and send readers to the shop's storefront."
            : "Write one concise Facebook Marketplace draft using only the supplied public inventory facts.",
          "Never invent condition, warranty, compatibility, availability, mechanical claims, or discounts.",
          "Name the shop and item, use plain language, include the storefront URL, and invite the buyer to message the shop.",
          "No em dashes. Headline under 100 characters. Body under 900 characters.",
          "Do not claim the post has already been published or scheduled.",
        ].join(" "),
        messages: [{ role: "user", content: JSON.stringify(facts) }],
      },
      { timeout: 20_000 },
    );
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") throw new Error("SDK returned no text");
    const parsed = parseAgentDraft(text.text, fallback, [shop.name, itemName]);
    return parsed === fallback
      ? { ...fallback, generator: "deterministic", agentRunId: response.id }
      : { ...parsed, generator: "anthropic-sdk", agentRunId: response.id };
  } catch (error) {
    console.warn("Marketing SDK draft failed; using the fact-only template", error instanceof Error ? error.message : "unknown error");
    return { ...fallback, generator: "deterministic", agentRunId: null };
  }
}
