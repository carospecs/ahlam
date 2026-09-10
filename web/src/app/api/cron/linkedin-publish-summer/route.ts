// Daylight-time twin. The shared route's Pacific-local gate rejects this call
// during standard time, so only one daily invocation can publish.
export const runtime = "nodejs";
export const maxDuration = 60;
export { GET } from "../linkedin-publish/route";
