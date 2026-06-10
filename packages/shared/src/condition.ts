import type { ConditionGrade } from "./types";

// ARA-style A / B / C grading. Legacy Good/Poor (and old D/F) keys are kept so
// rows stored before the migration still render a sensible label + color.
export const CONDITION_GRADE_MAP: Record<string, { label: string; summary: string; detail: string; color: string }> = {
  A: { label: 'Grade A', summary: 'Excellent — clean, works perfectly', detail: 'Excellent condition. Works 100% — no mechanical issues. Clean appearance with no cracks, breaks, or heavy scratches. May show light normal wear but looks good and is ready to install.', color: '#22C55E' },
  B: { label: 'Grade B', summary: 'Good — has scratches, works fine', detail: 'Good condition. Works as intended — fully functional. Has visible scratches, scuffs, or cosmetic blemishes but nothing that affects performance. Not as clean as Grade A but everything works.', color: '#F59E0B' },
  C: { label: 'Grade C', summary: 'Poor — damaged or non-functional', detail: 'Poor condition. Significant damage — cracks, breaks, dents, heavy corrosion, missing parts, leaks, or non-functional. Needs repair before use or sells as a core/project piece.', color: '#EF4444' },
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
