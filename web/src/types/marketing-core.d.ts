declare module "../../scripts/marketing-core.mjs" {
  export const CLIENT_STOREFRONTS: Record<string, string>;
  export function marketingWindow(now?: Date, timeZone?: string): {
    due: boolean; localDate: string; slotKey: string; weekday: string; hour: number; timeZone: string;
  };
  export function selectMarketingCandidate(input: { vehicles?: any[]; listings?: any[]; usedSourceKeys?: string[] }): any | null;
  export function fallbackMarketingDraft(input: { shop: any; candidate: any; storefrontUrl: string }): { headline: string; body: string; hashtags: string[] };
  export function extensionPayload(input: { shop: any; candidate: any; draft: any }): Record<string, any>;
}
