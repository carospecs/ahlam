// Vercel Hobby permits one invocation per cron entry. This daylight-time entry
// and the standard-time twin both reuse the local-time gate in the main route,
// so exactly the 9 AM Pacific invocation creates drafts.
export const runtime = "nodejs";
export const maxDuration = 60;
export { GET } from "../marketing-drafts/route";
