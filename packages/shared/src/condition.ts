import type { ConditionGrade } from "./types";

// ARA-style A / B / C grading. Legacy Good/Poor (and old D/F) keys are kept so
// rows stored before the migration still render a sensible label + color.
export const CONDITION_GRADE_MAP: Record<string, { label: string; summary: string; detail: string; color: string }> = {
  A: { label: 'Grade A', summary: 'Like-new — installs as-is', detail: 'Minimal to no damage. Structurally perfect, no cracks, breaks, bends, or broken mounts; at most very light wear. Low-mileage or tested. A buyer installs it with no work.', color: '#22C55E' },
  B: { label: 'Grade B', summary: 'Good — normal wear, usable as-is', detail: 'Moderate wear but fully serviceable. Minor scuffs, light scratches, dirt, or surface rust; all mounts intact and functional. Installable without repair.', color: '#F59E0B' },
  C: { label: 'Grade C', summary: 'Rough — repair or sell as core', detail: 'Significant damage or heavy wear: cracks, breaks, dents, bends, heavy corrosion, broken/missing mounts, tears, leaks, or non-functional. Needs repair or sells as a core/project piece.', color: '#EF4444' },
  // Legacy fallbacks (pre-migration rows)
  Good: { label: 'Grade B', summary: 'Good — usable as-is', detail: '', color: '#F59E0B' },
  Poor: { label: 'Grade C', summary: 'Rough — needs repair or core', detail: '', color: '#EF4444' },
  D: { label: 'Grade C', summary: '', detail: '', color: '#EF4444' },
  F: { label: 'Grade C', summary: '', detail: '', color: '#EF4444' },
};

export const CONDITION_GRADES = ["A", "B", "C"] as const;

export const CONDITION_RUBRIC: Record<ConditionGrade, { summary: string; detail: string }> = {} as any;
for (const g of CONDITION_GRADES) {
  CONDITION_RUBRIC[g] = { summary: CONDITION_GRADE_MAP[g].summary, detail: CONDITION_GRADE_MAP[g].detail };
}
