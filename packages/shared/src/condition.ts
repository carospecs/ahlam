import type { ConditionGrade } from "./types";

export const CONDITION_GRADE_MAP: Record<string, { label: string; summary: string; detail: string; color: string }> = {
  A: { label: 'Like New', summary: 'No wear, no damage, fully functional', detail: 'No visible wear, no damage, works perfectly. Original finish intact.', color: '#22C55E' },
  B: { label: 'Good', summary: 'Minor wear, fully functional', detail: 'Minor scuffs or light scratches that do not affect function. All tabs and mounts intact.', color: '#84CC16' },
  C: { label: 'Fair', summary: 'Visible wear, functional', detail: 'Visible wear, scratches, scuffs, or minor dents. Functions but shows age.', color: '#EAB308' },
  D: { label: 'Poor', summary: 'Heavily worn, functional but needs work', detail: 'Heavy wear, cracks, dents, or damage. Functions but needs repair.', color: '#F97316' },
  F: { label: 'Core/Scrap', summary: 'Not functional, usable for parts or rebuild', detail: 'Broken, non-functional, or severely damaged. Only good as core/rebuild/project.', color: '#EF4444' },
};

export const CONDITION_GRADES = ["A", "B", "C", "D", "F"] as const;

export const CONDITION_RUBRIC: Record<ConditionGrade, { summary: string; detail: string }> = {} as any;
for (const g of CONDITION_GRADES) {
  CONDITION_RUBRIC[g] = { summary: CONDITION_GRADE_MAP[g].summary, detail: CONDITION_GRADE_MAP[g].detail };
}
