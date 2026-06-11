// Core data model shared across web + app + database.
// Keep this in sync with supabase/migrations.

/** ARA-style parts grade: A (like-new), B (good/usable), C (rough/core). */
export type ConditionGrade = "A" | "B" | "C";

/** AI confidence bucket. "low" triggers the yellow "review carefully" UI. */
export type Confidence = "high" | "medium" | "low";

export type ListingStatus = "draft" | "active" | "sold" | "removed";

/** A single vehicle this part is compatible with. */
export interface VehicleFit {
  make: string;
  model: string;
  /** Inclusive year range, e.g. { start: 2013, end: 2017 }. */
  yearStart: number;
  yearEnd: number;
  /** Optional trim/engine note, e.g. "LX/EX, 2.4L". */
  notes?: string;
}

/**
 * Structured output we ask GPT-4o Vision to return for a part photo.
 * This is the raw AI prediction — stored verbatim as a training example.
 */
export interface AIPartOutput {
  partName: string;
  partCategory: string;
  /** Vehicles this part fits. May be empty if AI can't tell. */
  fitment: VehicleFit[];
  condition: ConditionGrade;
  /** One sentence explaining the condition grade. */
  conditionNotes: string;
  /** ARA-style damage code, e.g. "DT-LF-2" (dent, left-front, ~2in) or "" if none. */
  damageCode?: string;
  /** 2-sentence marketplace description. */
  description: string;
  /** AI's suggested price in USD, if it can estimate one. Employee can override. */
  suggestedPriceUsd: number | null;
  /**
   * Warranty length in days the seller guarantees the part (0/30/60/90).
   * null/undefined means "fall back to the shop default". When `asIs` is set
   * the part carries no warranty regardless of this value.
   */
  warrantyDays?: number | null;
  /** "Sold as-is, no returns" flag — for glass/body/cosmetic parts (WAR-4). */
  asIs?: boolean;
  /** Per-field and overall confidence. Low => highlight + warn the user. */
  confidence: Confidence;
  /** Optional: fields the model was unsure about, for targeted highlighting. */
  lowConfidenceFields?: (keyof AIPartOutput)[];
  pricingInsight?: {
    suggestedPrice: number
    priceRange: { min: number; max: number }
    similarCount: number
  }
}

/** What the employee actually saved after reviewing/correcting the AI output. */
export interface CorrectedListing
  extends Omit<AIPartOutput, "confidence" | "lowConfidenceFields"> {
  /** Final price the shop is asking. */
  priceUsd: number;
}

/** A row in the listings table. Every prediction+correction pair is training data. */
export interface Listing {
  id: string;
  shopId: string;
  createdBy: string; // user id
  photoUrl: string;
  /** Raw AI output, stored verbatim. */
  aiOutput: AIPartOutput;
  /** Human-reviewed final values. Null until reviewed. */
  corrected: CorrectedListing | null;
  /** Optional VIN captured from a VIN-plate photo, for the shop's own records. */
  vin: string | null;
  /** Free-text "Other" section (VIN history etc). Optional, shop's choice. */
  otherNotes: string | null;
  status: ListingStatus;
  /** Marketplace URL after the shop posts it (copy-paste flow). */
  marketplaceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result wrapper for an AI call so the UI can render error/low-confidence states.
 * `data` is an array: one entry per distinct sellable part detected in the photo.
 */
export type AIResult =
  | { ok: true; data: AIPartOutput[] }
  | {
      ok: false;
      /** User-facing message. NEVER leak raw errors or "couldn't identify". */
      userMessage: string;
      /** Internal error detail — emailed to the team, never shown to the shop. */
      internalError: string;
    };

export interface WaitlistEntry {
  email: string;
  shopName?: string;
  location?: string;
  partsPerDay?: number;
  source?: string;
}
