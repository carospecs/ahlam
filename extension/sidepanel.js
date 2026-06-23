// Side-panel "mini bot": shows the staged listing and lets the seller open each
// marketplace (or post to all in order). It reflects live state by reading the
// background's stored queue and re-rendering whenever storage changes.

const CHANNELS = [
  { key: "facebook", name: "Facebook Marketplace" },
  { key: "craigslist", name: "Craigslist" },
  { key: "offerup", name: "OfferUp" },
];

const $ = (id) => document.getElementById(id);

function send(type, extra) {
  return new Promise((resolve) => {
    try { chrome.runtime.sendMessage({ type, ...(extra || {}) }, (r) => resolve(r || {})); }
    catch { resolve({}); }
  });
}

function statusFor(channel, queue) {
  if (!queue || !Array.isArray(queue.channels)) return null;
  const i = queue.channels.indexOf(channel);
  if (i < 0) return null;
  if ((queue.filled || []).includes(channel)) return "done";
  if (i === queue.index && !queue.done) return "current";
  if (i < queue.index || queue.done) return "done";
  return "pending";
}

async function render() {
  const { listing, queue } = await send("ahlam-get-state");
  const hasListing = !!(listing && (listing.title || listing.photos));

  $("empty").style.display = hasListing ? "none" : "block";
  $("content").style.display = hasListing ? "block" : "none";
  if (!hasListing) return;

  $("listingTitle").textContent = listing.title || "Untitled listing";
  $("listingPrice").textContent = listing.price ? `$${String(listing.price).replace(/[^0-9.]/g, "")}` : "No price";
  $("listingPhotos").textContent = listing.photos ? `${listing.photos} photo${listing.photos === 1 ? "" : "s"}` : "No photos";

  const wrap = $("channels");
  wrap.innerHTML = "";
  for (const c of CHANNELS) {
    const row = document.createElement("div");
    row.className = "chan";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = c.name;
    row.appendChild(name);

    const st = statusFor(c.key, queue);
    if (st) {
      const badge = document.createElement("span");
      badge.className = "status " + (st === "done" ? "s-done" : st === "current" ? "s-current" : "s-pending");
      badge.textContent = st === "done" ? "Filled" : st === "current" ? "Open now" : "Queued";
      row.appendChild(badge);
    }

    const btn = document.createElement("button");
    btn.textContent = "Open";
    btn.onclick = async () => { btn.disabled = true; await send("ahlam-open", { channel: c.key }); btn.disabled = false; };
    row.appendChild(btn);

    wrap.appendChild(row);
  }

  if (queue && !queue.done && Array.isArray(queue.channels) && queue.channels.length) {
    const cur = queue.channels[queue.index];
    const curName = (CHANNELS.find((c) => c.key === cur) || {}).name || cur;
    $("step").textContent = `Step ${queue.index + 1} of ${queue.channels.length}: review and publish on ${curName}, then click "I posted — open next".`;
  } else if (queue && queue.done) {
    $("step").textContent = "All marketplaces opened. Nice work.";
  } else {
    $("step").textContent = "";
  }
}

$("postAll").onclick = async () => {
  $("postAll").disabled = true;
  const r = await send("ahlam-open-all");
  $("postAll").disabled = false;
  if (!r.ok) $("step").textContent = r.error || "Open a listing in Ahlam first.";
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.ahlamQueue || changes.ahlamListing)) render();
});

render();
