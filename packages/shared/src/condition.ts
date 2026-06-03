import type { ConditionGrade } from "./types";

/**
 * Condition grade rubric. Single source of truth — used in the AI prompt,
 * the review-card help text, and the marketplace description.
 */
export const CONDITION_RUBRIC: Record<
  ConditionGrade,
  { summary: string; detail: string }
> = {
  Good: {
    summary: "No visible damage. Can be sold as-is.",
    detail:
      "No visible damage. Fully functional cosmetically and mechanically. " +
      "Minor wear expected.",
  },
  Fair: {
    summary: "Minor damage that doesn't affect function. Disclose to buyer.",
    detail:
      "Minor damage (small dents, scratches, surface rust) that does not affect " +
      "function. Buyer should be informed.",
  },
  Poor: {
    summary: "Visible damage. Functional status uncertain. Disclose clearly.",
    detail:
      "Visible structural damage, cracks, broken pieces, or missing components. " +
      "Functional status uncertain. Requires clear disclosure.",
  },
};

export const CONDITION_GRADES: ConditionGrade[] = ["Good", "Fair", "Poor"];
