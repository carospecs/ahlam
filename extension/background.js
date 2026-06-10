// Ahlam Auto-Poster — background service worker.
// Receives a staged listing from the ahlam.io content script, downloads its
// photos to data URLs (done here so we have host permissions and dodge CORS),
// stores everything for the marketplace content script, then opens that tab.

const MARKET_URL = {
  facebook: "https://www.facebook.com/marketplace/create/item",
  offerup: "https://offerup.com/post/",
  craigslist: "https://post.craigslist.org/",
};

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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "ahlam-stage") return;
  (async () => {
    const listing = msg.listing || {};
    const channel = MARKET_URL[msg.channel] ? msg.channel : "facebook";
    // Download up to 10 photos as data URLs so the content script can attach them.
    const urls = Array.isArray(listing.photos) ? listing.photos.slice(0, 10) : [];
    const photoData = (await Promise.all(urls.map(toDataUrl))).filter(Boolean);
    await chrome.storage.local.set({
      ahlamStaged: { channel, listing: { ...listing, photoData }, ts: Date.now() },
    });
    const tab = await chrome.tabs.create({ url: MARKET_URL[channel] });
    sendResponse({ ok: true, tabId: tab.id, photos: photoData.length });
  })();
  return true; // async response
});
