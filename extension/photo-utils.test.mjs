import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const photos = require("./photo-utils.js");

test("accepts a non-empty base64 image and reports its real MIME", () => {
  assert.deepEqual(photos.inspectDataUrl("data:image/png;base64,iVBORw0KGgo="), {
    ok: true,
    mime: "image/png",
    bytes: 8,
  });
});

test("rejects HTML masquerading as a downloaded photo", () => {
  assert.equal(photos.inspectDataUrl("data:text/html;base64,PGh0bWw+").ok, false);
});

test("rejects malformed and empty data URLs", () => {
  assert.equal(photos.inspectDataUrl("https://example.com/photo.jpg").ok, false);
  assert.equal(photos.inspectDataUrl("data:image/jpeg;base64,").ok, false);
});

test("uses a filename extension that matches the bytes", () => {
  assert.equal(photos.extensionForMime("image/jpeg"), "jpg");
  assert.equal(photos.extensionForMime("image/png; charset=binary"), "png");
  assert.equal(photos.extensionForMime("image/webp"), "webp");
});
