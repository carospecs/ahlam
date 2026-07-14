// Shared helpers for the buyer/seller chat: attachment shape + local-time
// formatting. Message timestamps are stored as timestamptz (created_at) and
// formatted HERE, in the viewer's browser, so "9:41 PM" always means the
// viewer's 9:41 PM — never the server's timezone (the legacy `time` text
// column was rendered from the server clock and drifted from real time).

export interface MsgAttachment {
  url: string;
  name?: string;
}

/** Format an ISO timestamp in the viewer's local time. Same-day → "9:41 PM";
 * older → "Jul 3 · 9:41 PM" (with year when it differs). Falls back to the
 * legacy pre-formatted label for old rows with no usable timestamp. */
export function fmtMsgTime(at?: string | null, fallback?: string | null): string {
  if (!at) return fallback || "";
  const d = new Date(at);
  if (isNaN(d.getTime())) return fallback || "";
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const sameYear = d.getFullYear() === now.getFullYear();
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" as const }) });
  return `${day} · ${time}`;
}
