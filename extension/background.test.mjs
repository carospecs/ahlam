import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const AhlamPhotoUtils = require("./photo-utils.js");

function loadWorker() {
  const store = {};
  const opened = [];
  let onMessage;
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener(fn) { onMessage = fn; } },
    },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    storage: {
      local: {
        async get(keys) {
          if (typeof keys === "string") return { [keys]: store[keys] };
          const list = Array.isArray(keys) ? keys : Object.keys(store);
          return Object.fromEntries(list.map((key) => [key, store[key]]));
        },
        async set(values) { Object.assign(store, values); },
      },
    },
    tabs: {
      async create({ url }) { opened.push(url); return { id: opened.length, url }; },
      async query() { return []; },
      async sendMessage() {},
    },
  };
  const context = vm.createContext({ chrome, AhlamPhotoUtils, importScripts() {}, console, FileReader: class {} });
  vm.runInContext(fs.readFileSync(new URL("./background.js", import.meta.url), "utf8"), context);

  async function send(message) {
    return await new Promise((resolve, reject) => {
      const keepAlive = onMessage(message, {}, resolve);
      if (!keepAlive) reject(new Error("Worker did not keep the response channel open"));
    });
  }
  return { send, store, opened };
}

const jpeg = "data:image/jpeg;base64,/9j/2Q==";

test("opens Facebook while treating OfferUp as a phone handoff", async () => {
  const worker = loadWorker();
  const result = await worker.send({
    type: "ahlam-stage-queue",
    channels: ["facebook", "offerup"],
    listing: { title: "Alternator", photoData: [jpeg] },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(worker.opened, [
    "https://www.facebook.com/marketplace/create/item",
    "https://offerup.com/getapp",
  ]);
  assert.equal(worker.store.ahlamQueue.statuses.facebook.state, "opening");
  assert.equal(worker.store.ahlamQueue.statuses.offerup.state, "phone_handoff");
  assert.equal(worker.store.ahlamStaged.offerup, undefined);
});

test("opens the ordinary eBay listing flow for a regular account", async () => {
  const worker = loadWorker();
  await worker.send({ type: "ahlam-stage", channel: "ebay", listing: { title: "Alternator", photoData: [jpeg] } });
  assert.deepEqual(worker.opened, ["https://www.ebay.com/sl/prelist/suggest"]);
  assert.equal(worker.store.ahlamQueue.statuses.ebay.state, "opening");
  assert.ok(worker.store.ahlamStaged.ebay);
});

test("does not count a failed marketplace fill as ready", async () => {
  const worker = loadWorker();
  await worker.send({ type: "ahlam-stage", channel: "facebook", listing: { title: "Alternator", photoData: [jpeg] } });
  await worker.send({ type: "ahlam-result", channel: "facebook", ok: false, message: "Photo needs attention" });
  assert.equal(worker.store.ahlamQueue.statuses.facebook.state, "needs_help");
  assert.deepEqual(Array.from(worker.store.ahlamQueue.filled), []);
});

test("counts only a verified successful fill as ready", async () => {
  const worker = loadWorker();
  await worker.send({ type: "ahlam-stage", channel: "facebook", listing: { title: "Alternator", photoData: [jpeg] } });
  await worker.send({ type: "ahlam-result", channel: "facebook", ok: true, message: "Ready" });
  assert.equal(worker.store.ahlamQueue.statuses.facebook.state, "ready");
  assert.deepEqual(Array.from(worker.store.ahlamQueue.filled), ["facebook"]);
});
