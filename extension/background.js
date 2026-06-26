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

const MARKET_URL = {
  facebook: "https://www.facebook.com/marketplace/create/item",
  offerup: "https://offerup.com/post/",
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

// Download up to 10 photos once and cache them on the listing as data URLs so each
// marketplace can attach them as real files.
async function withPhotoData(listing) {
  if (Array.isArray(listing.photoData) && listing.photoData.length) return listing;
  const urls = Array.isArray(listing.photos) ? listing.photos.slice(0, 10) : [];
  const photoData = (await Promise.all(urls.map(toDataUrl))).filter(Boolean);
  return { ...listing, photoData };
}

// Stage the listing for each selected channel, then open every tab at once.
async function openAll(listing, channels) {
  const withData = await withPhotoData(listing);
  const list = (channels || []).filter((c) => MARKET_URL[c]);
  const staged = {};
  for (const ch of list) staged[ch] = { listing: withData, ts: Date.now() };
  const queue = { channels: list, filled: [], ts: Date.now() };
  await chrome.storage.local.set({ ahlamStaged: staged, ahlamListing: withData, ahlamQueue: queue });
  // Open them all; the content scripts each pick up their own staged entry.
  // Facebook routes to the item or vehicle create form based on the listing.
  for (const ch of list) { try { await chrome.tabs.create({ url: marketUrlFor(ch, withData) }); } catch {} }
  return list;
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
      const list = await openAll(listing, channels);
      sendResponse({ ok: true, channels: list });
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
      await openAll(ahlamListing, [msg.channel]);
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

  // A content script finished filling a marketplace form → mark it for the panel.
  if (type === "ahlam-filled") {
    (async () => {
      const { ahlamQueue: q } = await chrome.storage.local.get("ahlamQueue");
      if (q) {
        const filled = new Set(q.filled || []);
        filled.add(msg.channel);
        await chrome.storage.local.set({ ahlamQueue: { ...q, filled: [...filled] } });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});
