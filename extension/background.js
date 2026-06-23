// Ahlam Auto-Poster — background service worker.
//
// Two ways to drive it:
//   1. Single channel  — the ahlam.io page (or the side panel) sends one listing
//      for one marketplace. We stage it and open that tab.
//   2. Post everywhere — the page sends one listing for an ordered list of
//      marketplaces (Facebook -> Craigslist -> OfferUp). We download the photos
//      once, open the first marketplace, and after the seller posts it they hit
//      "Open next" (banner button or side panel) to advance. We NEVER auto-submit.
//
// Photos are downloaded here (the worker has host permissions + dodges CORS) to
// data URLs so the marketplace content script can attach them as real files.

const MARKET_URL = {
  facebook: "https://www.facebook.com/marketplace/create/item",
  offerup: "https://offerup.com/post/",
  craigslist: "https://post.craigslist.org/",
};

// Let clicking the toolbar icon open the side-panel "mini bot".
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.runtime.onStartup?.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});

async function toDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

// Download up to 10 photos once and cache them on the stored listing so each
// marketplace in a "post everywhere" run reuses them without re-fetching.
async function withPhotoData(listing) {
  if (Array.isArray(listing.photoData) && listing.photoData.length) return listing;
  const urls = Array.isArray(listing.photos) ? listing.photos.slice(0, 10) : [];
  const photoData = (await Promise.all(urls.map(toDataUrl))).filter(Boolean);
  return { ...listing, photoData };
}

// Stage one channel for its content script to read, then open its tab.
async function openChannel(channel, listing) {
  const ch = MARKET_URL[channel] ? channel : "facebook";
  await chrome.storage.local.set({ ahlamStaged: { channel: ch, listing, ts: Date.now() } });
  return chrome.tabs.create({ url: MARKET_URL[ch] });
}

async function startQueue(listing, channels) {
  const withData = await withPhotoData(listing);
  const list = (channels || []).filter((c) => MARKET_URL[c]);
  const queue = { channels: list, index: 0, filled: [], done: false, ts: Date.now() };
  await chrome.storage.local.set({ ahlamQueue: queue, ahlamListing: withData });
  if (list.length) await openChannel(list[0], withData);
  return queue;
}

async function advanceQueue() {
  const { ahlamQueue: q, ahlamListing } = await chrome.storage.local.get(["ahlamQueue", "ahlamListing"]);
  if (!q || q.done) return q || null;
  const next = q.index + 1;
  if (next >= q.channels.length) {
    const done = { ...q, done: true };
    await chrome.storage.local.set({ ahlamQueue: done });
    return done;
  }
  const updated = { ...q, index: next };
  await chrome.storage.local.set({ ahlamQueue: updated });
  if (ahlamListing) await openChannel(q.channels[next], await withPhotoData(ahlamListing));
  return updated;
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

  // Single channel (legacy + side-panel "open one").
  if (type === "ahlam-stage") {
    (async () => {
      const listing = await withPhotoData(msg.listing || {});
      await chrome.storage.local.set({ ahlamListing: listing });
      const tab = await openChannel(msg.channel || "facebook", listing);
      sendResponse({ ok: true, tabId: tab.id, photos: (listing.photoData || []).length });
    })();
    return true;
  }

  // Post everywhere — ordered queue.
  if (type === "ahlam-stage-queue") {
    (async () => {
      const channels = msg.channels && msg.channels.length ? msg.channels : ["facebook", "craigslist", "offerup"];
      const q = await startQueue(msg.listing || {}, channels);
      sendResponse({ ok: true, channels: q.channels });
    })();
    return true;
  }

  // Post everywhere using the last listing (side panel "Post to all" button).
  if (type === "ahlam-open-all") {
    (async () => {
      const { ahlamListing } = await chrome.storage.local.get("ahlamListing");
      if (!ahlamListing) { sendResponse({ ok: false, error: "No listing staged yet" }); return; }
      const channels = msg.channels && msg.channels.length ? msg.channels : ["facebook", "craigslist", "offerup"];
      const q = await startQueue(ahlamListing, channels);
      sendResponse({ ok: true, channels: q.channels });
    })();
    return true;
  }

  // Advance to the next marketplace (from a banner button or the panel).
  if (type === "ahlam-next") {
    (async () => { const q = await advanceQueue(); sendResponse({ ok: true, queue: q }); })();
    return true;
  }

  // Open a specific channel using the last listing (side panel buttons).
  if (type === "ahlam-open") {
    (async () => {
      const { ahlamListing } = await chrome.storage.local.get("ahlamListing");
      if (!ahlamListing) { sendResponse({ ok: false, error: "No listing staged yet" }); return; }
      await openChannel(msg.channel, await withPhotoData(ahlamListing));
      sendResponse({ ok: true });
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

  // A content script finished filling a marketplace form.
  if (type === "ahlam-filled") {
    (async () => {
      const { ahlamQueue: q } = await chrome.storage.local.get("ahlamQueue");
      if (q && !q.done) {
        const filled = new Set(q.filled || []);
        filled.add(msg.channel);
        await chrome.storage.local.set({ ahlamQueue: { ...q, filled: [...filled] } });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});
