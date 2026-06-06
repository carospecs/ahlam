import type { ConditionGrade } from "./types";

// Two-bucket grading. Legacy A–F keys are kept only so old stored rows still
// render a sensible color; everything new is "Good" or "Poor".
export const CONDITION_GRADE_MAP: Record<string, { label: string; summary: string; detail: string; color: string }> = {
  Good: { label: 'Good', summary: 'Usable as-is, no repair needed', detail: 'Structurally sound and installable as-is. May have normal wear, minor scuffs, dirt, or surface rust, but no cracks, breaks, bends, or broken mounts.', color: '#22C55E' },
  Poor: { label: 'Poor', summary: 'Damaged — needs repair or sold as core', detail: 'Cracks, breaks, dents, bends, heavy corrosion, broken/missing mounts, tears, leaks, or non-functional. Needs repair or sells as a core/project piece.', color: '#EF4444' },
  // Legacy fallback colors
  A: { label: 'Good', summary: '', detail: '', color: '#22C55E' },
  B: { label: 'Good', summary: '', detail: '', color: '#22C55E' },
  C: { label: 'Good', summary: '', detail: '', color: '#22C55E' },
  D: { label: 'Poor', summary: '', detail: '', color: '#EF4444' },
  F: { label: 'Poor', summary: '', detail: '', color: '#EF4444' },
};

export const CONDITION_GRADES = ["Good", "Poor"] as const;

export const CONDITION_RUBRIC: Record<ConditionGrade, { summary: string; detail: string }> = {} as any;
for (const g of CONDITION_GRADES) {
  CONDITION_RUBRIC[g] = { summary: CONDITION_GRADE_MAP[g].summary, detail: CONDITION_GRADE_MAP[g].detail };
}
