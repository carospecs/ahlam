// Parts are graded on the ARA-style A / B / C scale:
//   A = installs as-is, like-new (minimal/no damage)
//   B = good, usable as-is with normal wear (moderate)
//   C = rough — needs repair or sells as a core
// Legacy rows stored as Good/Poor (and old A–F) are folded in here so nothing
// in the database has to be rewritten.
export type Grade = "A" | "B" | "C";

export function normalizeGrade(c: unknown): Grade {
  const s = String(c ?? "").trim().toLowerCase();
  if (s === "a" || s === "like new" || s === "like-new" || s === "excellent") return "A";
  if (s === "b" || s === "good" || s === "fair") return "B";
  if (s === "c" || s === "d" || s === "f" || s === "poor" || s === "core" || s === "scrap" || s === "salvage") return "C";
  // Unknown → B (the safe, sellable middle) rather than over- or under-grading.
  return "B";
}
