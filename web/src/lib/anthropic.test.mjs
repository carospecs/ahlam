// Unit tests for the pure helpers in anthropic.ts. Runs with plain `node`:
//
//   node web/src/lib/anthropic.test.mjs
import assert from "node:assert/strict";
import { extractSearchSources } from "./anthropic.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("anthropic:");

test("collects url+title from web_search_tool_result blocks", () => {
  const sources = extractSearchSources([
    { type: "text", text: "MEDIAN: $850\nCOMPS: 4" },
    {
      type: "web_search_tool_result",
      content: [
        { type: "web_search_result", url: "https://ebay.com/itm/1", title: "Sold: Model X liftgate" },
        { type: "web_search_result", url: "https://car-part.com/x", title: "Car-Part listing" },
      ],
    },
  ]);
  assert.deepEqual(sources, [
    { title: "Sold: Model X liftgate", url: "https://ebay.com/itm/1" },
    { title: "Car-Part listing", url: "https://car-part.com/x" },
  ]);
});

test("dedupes by url across multiple tool-result blocks", () => {
  const sources = extractSearchSources([
    { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://a.com", title: "A" }] },
    { type: "web_search_tool_result", content: [
      { type: "web_search_result", url: "https://a.com", title: "A again" },
      { type: "web_search_result", url: "https://b.com", title: "B" },
    ] },
  ]);
  assert.deepEqual(sources.map((s) => s.url), ["https://a.com", "https://b.com"]);
});

test("error-object content (non-array) yields no sources, no throw", () => {
  const sources = extractSearchSources([
    { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
  ]);
  assert.deepEqual(sources, []);
});

test("ignores malformed items and falls back to url as title", () => {
  const sources = extractSearchSources([
    { type: "web_search_tool_result", content: [
      { type: "web_search_result" }, // no url — skipped
      { type: "other" },
      { type: "web_search_result", url: "https://c.com" }, // no title — url used
    ] },
    null,
    "text",
  ]);
  assert.deepEqual(sources, [{ title: "https://c.com", url: "https://c.com" }]);
});

console.log(`  ${passed} passed`);
