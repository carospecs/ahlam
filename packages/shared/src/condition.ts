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
    summary: "No cracks or breaks. Intact and sellable as-is.",
    detail:
      "Intact with no cracks, breaks, or missing pieces. Normal light wear " +
      "(minor scratches, dirt, surface dust) is acceptable. Cosmetically and " +
      "structurally sound.",
  },
  Poor: {
    summary: "Cracked, broken, or damaged. Disclose clearly.",
    detail:
      "Any crack, break, chip, shatter, deep gouge, broken mount/tab, fogging " +
      "or moisture inside a lens, dent, bend, or missing component. If there is " +
      "ANY visible damage, grade Poor — never Good.",
  },
};

export const CONDITION_GRADES: ConditionGrade[] = ["Good", "Poor"];
