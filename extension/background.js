// Ahlam Auto-Poster — background service worker.
//
// Flow: in Ahlam the seller picks one or more no-API marketplaces and posts.
// We download the listing's photos once, stage the listing PER CHANNEL, and open
// every selected marketplace tab AT ONCE. Each marketplace's content script reads
// its own staged entry and fills its form. The seller reviews and clicks Publish
// on each tab. We NEVER auto-submit.
//
// (The side panel can also load a listing for editing first, then fire the same
// open-and-fill.)

importScripts("photo-utils.js");

const MARKET_URL = {
  ebay: "https://www.ebay.com/sl/prelist/suggest",
  facebook: "https://www.facebook.com/marketplace/create/item",
  // OfferUp redirects desktop sellers to its mobile app. We open the official
  // handoff page and report that honestly instead of waiting for a form that
  // never appears.
  offerup: "https://offerup.com/getapp",
  craigslist: "https://post.craigslist.org/",
};

// A whole-car listing goes to Facebook's separate Vehicle form (Year/Make/Model/
// Mileage), not the item form. Detect it from an explicit kind flag or a
// vehicle category so we open the right create URL.
function isVehicleListing(listing) {
  if (!listing) return false;
  if (listing.kind === "vehicle" || listing.type === "vehicle" || listing.isVehicle) return true;
  const cat = String(listing.category || "").toLowerCase();
  return cat.includes("vehicle") || cat === "cars" || cat.includes("car/truck") || cat.includes("car & truck");
}

// The create URL for a channel, given the listing (Facebook splits item vs vehicle).
function marketUrlFor(channel, listing) {
  if (channel === "facebook") {
    return isVehicleListing(listing)
      ? "https://www.facebook.com/marketplace/create/vehicle"
      : "https://www.facebook.com/marketplace/create/item";
  }
  return MARKET_URL[channel];
}

// Let clicking the toolbar icon open the side panel.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.runtime.onStartup?.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});

async function toDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { data: null, error: `Photo download failed (${res.status})` };
    const blob = await res.blob();
    if (!AhlamPhotoUtils.isImageMime(blob.type)) return { data: null, error: "Downloaded file is not an image" };
    if (!blob.size) return { data: null, error: "Downloaded image is empty" };
    if (blob.size > AhlamPhotoUtils.MAX_SOURCE_BYTES) return { data: null, error: "Image is larger than 15 MB" };
    const data = await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
    const inspected = AhlamPhotoUtils.inspectDataUrl(data);
    return inspected.ok ? { data, error: null } : { data: null, error: inspected.error };
  } catch { return { data: null, error: "Couldn't download photo" }; }
}

// Download up to 10 photos once and cache them on the listing as data URLs so each
// marketplace can attach them as real files.
async function withPhotoData(listing) {
  if (Array.isArray(listing.photoData) && listing.photoData.length) {
    const valid = [];
    const photoErrors = [];
    for (const data of listing.photoData.slice(0, 10)) {
      const inspected = AhlamPhotoUtils.inspectDataUrl(data);
      if (inspected.ok) valid.push(data); else photoErrors.push(inspected.error);
    }
    return { ...listing, photoData: valid, photoErrors };
  }
  const urls = Array.isArray(listing.photos) ? listing.photos.slice(0, 10) : [];
  const results = await Promise.all(urls.map(toDataUrl));
  return {
    ...listing,
    photoData: results.map((r) => r.data).filter(Boolean),
    photoErrors: results.map((r) => r.error).filter(Boolean),
  };
}

function initialStatus(channel, listing) {
  if (channel === "offerup") {
    // Don't promise the clipboard is loaded — the side-panel flow never
    // copies (only the website and the FB/eBay content scripts do).
    return { state: "phone_handoff", message: "OfferUp requires its mobile app. Continue on your phone — the listing text is in Ahlam, ready to copy.", updatedAt: Date.now() };
  }
  const skipped = (listing.photoErrors || []).length;
  return {
    state: "opening",
    message: skipped ? `Opening form · ${skipped} invalid photo${skipped === 1 ? " was" : "s were"} skipped` : "Opening marketplace form…",
    updatedAt: Date.now(),
  };
}

async function broadcastQueue(queue) {
  try {
    const tabs = await chrome.tabs.query({ url: ["https://ahlam.io/*", "http://localhost/*"] });
    await Promise.all(tabs.map((tab) => tab.id == null ? null : chrome.tabs.sendMessage(tab.id, { type: "ahlam-queue-update", queue }).catch(() => null)));
  } catch {}
}

async function setChannelStatus(channel, state, message, detail) {
  const { ahlamQueue: queue } = await chrome.storage.local.get("ahlamQueue");
  if (!queue || !queue.channels?.includes(channel)) return null;
  const statuses = { ...(queue.statuses || {}) };
  statuses[channel] = { state, message: message || "", detail: detail || null, updatedAt: Date.now() };
  const filled = Object.entries(statuses).filter(([, value]) => value?.state === "ready").map(([key]) => key);
  const next = { ...queue, statuses, filled };
  await chrome.storage.local.set({ ahlamQueue: next });
  await broadcastQueue(next);
  return next;
}

// Stage the listing for each selected channel, then open every tab at once.
async function openAll(listing, channels) {
  const withData = await withPhotoData(listing);
  const list = (channels || []).filter((c) => MARKET_URL[c]);
  const staged = {};
  for (const ch of list) {
    // OfferUp has no desktop form for the personal-account flow, so no content
    // script waits for staged data there.
    if (ch !== "offerup") staged[ch] = { listing: withData, ts: Date.now() };
  }
  const statuses = Object.fromEntries(list.map((ch) => [ch, initialStatus(ch, withData)]));
  const queue = { channels: list, statuses, filled: [], ts: Date.now() };
  await chrome.storage.local.set({ ahlamStaged: staged, ahlamListing: withData, ahlamQueue: queue });
  await broadcastQueue(queue);
  // Open them all; the content scripts each pick up their own staged entry.
  // Facebook routes to the item or vehicle create form based on the listing.
  for (const ch of list) {
    try { await chrome.tabs.create({ url: marketUrlFor(ch, withData) }); }
    catch { await setChannelStatus(ch, "needs_help", `Couldn't open ${ch}. Try again from Ahlam.`); }
  }
  const { ahlamQueue } = await chrome.storage.local.get("ahlamQueue");
  return { channels: list, queue: ahlamQueue || queue };
}

function summary(listing) {
  if (!listing) return null;
  return {
    title: listing.title || "",
    price: listing.price || "",
    photos: (listing.photoData || listing.photos || []).length,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const type = msg?.type;

  // Open & fill one or more marketplaces at once.
  if (type === "ahlam-stage" || type === "ahlam-stage-queue" || type === "ahlam-open-all") {
    (async () => {
      let listing = msg.listing;
      if (!listing) { const r = await chrome.storage.local.get("ahlamListing"); listing = r.ahlamListing; }
      if (!listing) { sendResponse({ ok: false, error: "No listing staged yet" }); return; }
      // Single-channel callers pass `channel`; multi callers pass `channels`.
      const channels = msg.channels && msg.channels.length
        ? msg.channels
        : [msg.channel || "facebook"];
      const opened = await openAll(listing, channels);
      sendResponse({ ok: true, channels: opened.channels, queue: opened.queue });
    })();
    return true;
  }

  // Load a listing into the side-panel editor WITHOUT opening a marketplace yet.
  if (type === "ahlam-load") {
    (async () => {
      const listing = await withPhotoData(msg.listing || {});
      await chrome.storage.local.set({ ahlamListing: listing, ahlamQueue: null, ahlamStaged: {} });
      try { if (_sender?.tab?.id != null) await chrome.sidePanel.open({ tabId: _sender.tab.id }); } catch {}
      sendResponse({ ok: true, photos: (listing.photoData || []).length });
    })();
    return true;
  }

  // Editor asked us to download original photos into data URLs for editing.
  if (type === "ahlam-prep") {
    (async () => {
      const { ahlamListing } = await chrome.storage.local.get("ahlamListing");
      if (!ahlamListing) { sendResponse({ ok: false }); return; }
      const withData = await withPhotoData(ahlamListing);
      await chrome.storage.local.set({ ahlamListing: withData });
      sendResponse({ ok: true, photos: (withData.photoData || []).length });
    })();
    return true;
  }

  // Open one specific channel using the last listing (side-panel "Open" buttons).
  if (type === "ahlam-open") {
    (async () => {
      const { ahlamListing } = await chrome.storage.local.get("ahlamListing");
      if (!ahlamListing) { sendResponse({ ok: false, error: "No listing staged yet" }); return; }
      const opened = await openAll(ahlamListing, [msg.channel]);
      sendResponse({ ok: true, channels: opened.channels, queue: opened.queue });
    })();
    return true;
  }

  // Side panel state read.
  if (type === "ahlam-get-state") {
    (async () => {
      const { ahlamQueue, ahlamListing } = await chrome.storage.local.get(["ahlamQueue", "ahlamListing"]);
      sendResponse({ ok: true, queue: ahlamQueue || null, listing: summary(ahlamListing) });
    })();
    return true;
  }

  // A marketplace content script reports a verified result. Failures stay
  // visible as needs-help instead of being incorrectly counted as filled.
  if (type === "ahlam-result" || type === "ahlam-filled") {
    (async () => {
      const state = type === "ahlam-filled" ? "ready" : (msg.state || (msg.ok ? "ready" : "needs_help"));
      const queue = await setChannelStatus(msg.channel, state, msg.message, msg.detail);
      sendResponse({ ok: true, queue });
    })();
    return true;
  }
});
