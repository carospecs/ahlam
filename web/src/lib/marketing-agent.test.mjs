import assert from "node:assert/strict";
import {
  extensionPayload,
  fallbackMarketingDraft,
  marketingWindow,
  parseAgentDraft,
  selectMarketingCandidate,
} from "../../scripts/marketing-core.mjs";

const fridaySummer = marketingWindow(new Date("2026-09-04T16:05:00Z"));
assert.equal(fridaySummer.due, true);
assert.equal(fridaySummer.slotKey, "2026-09-04:facebook");
assert.equal(marketingWindow(new Date("2026-09-04T15:05:00Z")).due, false);
assert.equal(marketingWindow(new Date("2026-12-04T17:05:00Z")).due, true);

const vehicle = {
  id: "v1", year: "2023", make: "Tesla", model: "Model 3", trim: "Long Range",
  status: "active", sell_mode: "whole", asking_price: 24900, photo_url: "https://img.test/car.jpg",
  updated_at: "2026-09-04T00:00:00Z",
};
const listing = {
  id: "l1", vehicle_id: "v1", status: "active", price_usd: 800,
  photo_url: "https://img.test/part.jpg", corrected: { partName: "Front bumper", condition: "B" },
};
assert.equal(selectMarketingCandidate({ vehicles: [vehicle], listings: [listing] }).type, "vehicle");
assert.equal(selectMarketingCandidate({ vehicles: [vehicle], listings: [listing], usedSourceKeys: ["vehicle:v1"] }).type, "part");

const shop = { name: "Downtown Auto Dismantlers", location: "Los Angeles, CA" };
const candidate = selectMarketingCandidate({ vehicles: [vehicle], listings: [] });
const fallback = fallbackMarketingDraft({ shop, candidate, storefrontUrl: "https://downtownautodismantlers.ahlam.io" });
assert.match(fallback.body, /Downtown Auto Dismantlers/);
assert.match(fallback.body, /\$24,900/);

const parsed = parseAgentDraft(
  '{"headline":"2023 Tesla Model 3 available","body":"Downtown Auto Dismantlers has this Tesla Model 3 ready to view.","hashtags":["#Ahlam"]}',
  fallback,
  [shop.name, "Tesla Model 3"],
);
assert.equal(parsed.hashtags[0], "Ahlam");
assert.equal(parseAgentDraft('{"headline":"Invented","body":"Perfect condition!"}', fallback, [shop.name]), fallback);

const payload = extensionPayload({ shop, candidate, draft: parsed });
assert.equal(payload.kind, "vehicle");
assert.equal(payload.year, "2023");
assert.deepEqual(payload.photos, ["https://img.test/car.jpg"]);

console.log("marketing-agent: scheduling, selection, copy safety, and extension payload verified");
