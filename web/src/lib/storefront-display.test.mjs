import assert from "node:assert/strict";
import { test } from "node:test";
import { storefrontPriceLabel } from "./storefront-display.mjs";

test("unpriced inventory asks the buyer to call instead of showing $0", () => {
  assert.equal(storefrontPriceLabel(0), "Call for price");
  assert.equal(storefrontPriceLabel(null), "Call for price");
  assert.equal(storefrontPriceLabel("not-a-price"), "Call for price");
});

test("priced inventory is formatted for the storefront", () => {
  assert.equal(storefrontPriceLabel(150), "$150");
  assert.equal(storefrontPriceLabel("1250"), "$1,250");
});

