// The app grades every part with just two buckets: "Good" or "Poor".
// This also folds in any legacy A–F grades still stored in older rows.
export type Grade = "Good" | "Poor";

export function normalizeGrade(c: unknown): Grade {
  const s = String(c ?? "").trim().toLowerCase();
  if (s === "poor" || s === "d" || s === "f" || s === "core" || s === "scrap" || s === "salvage") return "Poor";
  // "Good", legacy A/B/C ("Like New"/"Good"/"Fair"), and anything unknown → Good.
  return "Good";
}
