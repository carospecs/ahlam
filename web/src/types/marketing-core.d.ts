declare module "../../scripts/marketing-core.mjs" {
  export const CLIENT_STOREFRONTS: Record<string, string>;
  export function cronRequestAuthorized(secret: unknown, authorization: unknown): boolean;
  export function marketingWindow(now?: Date, timeZone?: string): {
    due: boolean; localDate: string; slotKey: string; weekday: string; hour: number; timeZone: string;
  };
  export function selectMarketingCandidate(input: { vehicles?: any[]; listings?: any[]; usedSourceKeys?: string[] }): any | null;
  export function fallbackMarketingDraft(input: { shop: any; candidate: any; storefrontUrl: string }): { headline: string; body: string; hashtags: string[] };
  export function parseAgentDraft(raw: unknown, fallback: { headline: string; body: string; hashtags: string[] }, requiredNames?: string[]): { headline: string; body: string; hashtags: string[] };
  export function marketingDescription(body: unknown, hashtags?: unknown[]): string;
  export function mergeDraftPayload(existingPayload?: Record<string, any>, edits?: { headline?: unknown; body?: unknown }): Record<string, any>;
  export function extensionPayload(input: { shop: any; candidate: any; draft: any }): Record<string, any>;
}
