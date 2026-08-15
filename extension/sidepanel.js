// Side-panel "cockpit": the seller reviews and EDITS the Ahlam listing here —
// title, price, condition, category, location, description, and the photos
// (remove / reorder / add their own) — then sends the edited listing to
// Facebook. We fill the form; the seller reviews and hits Publish. Never auto-post.
//
// Source of truth for the working listing is chrome.storage.local.ahlamListing,
// which already carries `photoData` (data URLs) downloaded by the background
// worker, so photo edits survive the hand-off to the marketplace tab.

const CHANNELS = [
  { key: "ebay", name: "eBay regular account" },
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
function getStore(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (r) => resolve(r || {})));
}
function setStore(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, () => resolve()));
}

// Map an Ahlam grade (A/B/C) to a Facebook condition, when condition isn't set.
function gradeToCondition(g) {
  const m = { A: "Used - like new", B: "Used - good", C: "Used - fair" };
  return m[String(g || "").toUpperCase()] || "Used - good";
}

const state = { listing: null, queue: null, saveT: null };

async function load() {
  const { ahlamListing, ahlamQueue } = await getStore(["ahlamListing", "ahlamQueue"]);
  state.queue = ahlamQueue || null;

  if (!ahlamListing) {
    state.listing = null;
    $("empty").style.display = "block";
    $("content").style.display = "none";
    return;
  }

  // Make sure every original photo is a data URL so it can be uploaded to FB and
  // edited here uniformly. Background downloads any http(s) photos into photoData.
  let L = ahlamListing;
  const haveData = Array.isArray(L.photoData) ? L.photoData.length : 0;
  const wantData = Array.isArray(L.photos) ? L.photos.length : 0;
  if (!haveData && wantData) {
    await send("ahlam-prep");
    L = (await getStore("ahlamListing")).ahlamListing || L;
  }

  state.listing = {
    title: L.title || "",
    price: L.price != null ? String(L.price).replace(/[^0-9.]/g, "") : "",
    condition: L.condition || gradeToCondition(L.grade),
    category: L.category || "Auto Parts & Accessories",
    location: L.location || "",
    description: L.description || L.text || "",
    photoData: Array.isArray(L.photoData) ? [...L.photoData] : [],
    photos: Array.isArray(L.photos) ? [...L.photos] : [],
    // carry anything else through untouched
    _raw: L,
  };

  $("empty").style.display = "none";
  $("content").style.display = "block";
  bind();
  renderPhotos();
  renderChannels();
}

function bind() {
  const L = state.listing;
  $("fTitle").value = L.title;
  $("fPrice").value = L.price;
  $("fCondition").value = L.condition;
  $("fCategory").value = L.category;
  $("fLocation").value = L.location;
  $("fDesc").value = L.description;

  const wire = (id, key, clean) => {
    const el = $(id);
    el.oninput = () => { L[key] = clean ? clean(el.value) : el.value; queueSave(); };
  };
  wire("fTitle", "title");
  wire("fPrice", "price", (v) => v.replace(/[^0-9.]/g, ""));
  $("fCondition").onchange = () => { L.condition = $("fCondition").value; queueSave(); };
  wire("fCategory", "category");
  wire("fLocation", "location");
  wire("fDesc", "description");
}

function queueSave() {
  clearTimeout(state.saveT);
  $("saved").textContent = "";
  state.saveT = setTimeout(save, 500);
}
async function save() {
  if (!state.listing) return;
  const L = state.listing;
  // Persist the edited listing back; photoData is the source of truth for FB upload.
  const out = { ...L._raw, title: L.title, price: L.price, condition: L.condition,
    category: L.category, location: L.location, description: L.description,
    text: L.description, photoData: L.photoData, photos: L.photos };
  delete out._raw;
  await setStore({ ahlamListing: out });
  $("saved").textContent = "Saved";
}

function renderPhotos() {
  const L = state.listing;
  const wrap = $("photos");
  wrap.innerHTML = "";
  $("photoCount").textContent = String(L.photoData.length);

  L.photoData.forEach((src, i) => {
    const cell = document.createElement("div");
    cell.className = "photo";
    cell.innerHTML =
      `<span class="ord">${i + 1}</span>` +
      `<img src="${src}" alt="" />` +
      `<button class="x" title="Remove">×</button>` +
      `<button class="mv l" title="Move left">‹</button>` +
      `<button class="mv r" title="Move right">›</button>`;
    cell.querySelector(".x").onclick = () => { L.photoData.splice(i, 1); renderPhotos(); queueSave(); };
    cell.querySelector(".mv.l").onclick = () => { if (i > 0) { swap(L.photoData, i, i - 1); renderPhotos(); queueSave(); } };
    cell.querySelector(".mv.r").onclick = () => { if (i < L.photoData.length - 1) { swap(L.photoData, i, i + 1); renderPhotos(); queueSave(); } };
    wrap.appendChild(cell);
  });

  // Add-your-own-photo tile (max 10, Facebook's limit-ish).
  if (L.photoData.length < 10) {
    const add = document.createElement("label");
    add.className = "addp";
    add.title = "Add a photo from your device";
    add.innerHTML = `+<input type="file" accept="image/*,.heic,.heif" multiple />`;
    add.querySelector("input").onchange = (e) => addFiles(e.target.files);
    wrap.appendChild(add);
  }
}

function swap(arr, a, b) { const t = arr[a]; arr[a] = arr[b]; arr[b] = t; }

function isHeicFile(file) {
  return /image\/(heic|heif)/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read this photo"));
    reader.readAsDataURL(file);
  });
}

// HEIC conversion happens in a sandboxed iframe (sandbox.html): heic2any needs
// a blob: Web Worker, which the side panel's fixed MV3 CSP forbids. The sandbox
// page has its own relaxed CSP, so we ship files over postMessage.
let heicFrame = null;
let heicFrameLoaded = null;
const heicPending = new Map();
let heicSeq = 0;

function heicSandbox() {
  if (!heicFrame) {
    heicFrame = document.createElement("iframe");
    heicFrame.src = "sandbox.html";
    heicFrame.style.display = "none";
    heicFrameLoaded = new Promise((resolve, reject) => {
      heicFrame.onload = () => resolve();
      heicFrame.onerror = () => reject(new Error("HEIC converter didn't load"));
    });
    document.body.appendChild(heicFrame);
    window.addEventListener("message", (event) => {
      const data = event.data || {};
      if (!data.ahlamHeic) return;
      const pending = heicPending.get(data.id);
      if (!pending) return;
      heicPending.delete(data.id);
      clearTimeout(pending.timer);
      if (data.ok) pending.resolve(data.blob);
      else pending.reject(new Error(data.error || "Couldn't convert this HEIC photo"));
    });
  }
  return heicFrameLoaded;
}

async function convertHeicToJpeg(file) {
  await heicSandbox();
  const id = `heic-${++heicSeq}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      heicPending.delete(id);
      reject(new Error("HEIC conversion timed out — try sharing the photo as JPEG instead"));
    }, 30000);
    heicPending.set(id, { resolve, reject, timer });
    heicFrame.contentWindow.postMessage({ id, blob: file }, "*");
  });
}

async function jpegDataUrl(file) {
  let source = file;
  if (isHeicFile(file)) {
    const blob = await convertHeicToJpeg(file);
    source = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  }
  const raw = await readFile(source);
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Couldn't decode this photo"));
    element.src = raw;
  });
  const maxEdge = 2000;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't prepare this photo");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL("image/jpeg", 0.88);
  if (!result.startsWith("data:image/jpeg;base64,")) throw new Error("Couldn't convert this photo to JPEG");
  return result;
}

async function addFiles(files) {
  const L = state.listing;
  const list = [...files].slice(0, 10 - L.photoData.length);
  if (!list.length) return;
  $("step").textContent = list.some(isHeicFile) ? "Converting iPhone HEIC photos to JPEG…" : "Preparing photos…";
  const results = await Promise.allSettled(list.map(jpegDataUrl));
  const converted = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const failed = results.length - converted.length;
  L.photoData.push(...converted);
  renderPhotos();
  queueSave();
  $("step").textContent = failed
    ? `${converted.length} photo${converted.length === 1 ? "" : "s"} added; ${failed} couldn't be converted. Try exporting that photo as JPEG.`
    : `${converted.length} photo${converted.length === 1 ? "" : "s"} ready as JPEG.`;
}

function statusFor(channel, queue) {
  if (!queue || !Array.isArray(queue.channels)) return null;
  if (queue.channels.indexOf(channel) < 0) return null;
  const state = queue.statuses?.[channel]?.state;
  if (state === "ready") return "done";
  if (state === "needs_help") return "help";
  if (state === "phone_handoff") return "phone";
  return "current";
}

function renderChannels() {
  const wrap = $("channels");
  wrap.innerHTML = "";
  for (const c of CHANNELS) {
    const row = document.createElement("div");
    row.className = "chan";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = c.name;
    row.appendChild(name);

    const st = statusFor(c.key, state.queue);
    if (st) {
      const badge = document.createElement("span");
      badge.className = "status " + (st === "done" ? "s-done" : "s-current");
      badge.textContent = st === "done" ? "Filled" : st === "help" ? "Needs help" : st === "phone" ? "Use phone app" : "Opening";
      row.appendChild(badge);
    }

    const btn = document.createElement("button");
    btn.textContent = "Open";
    btn.onclick = async () => { btn.disabled = true; await save(); await send("ahlam-open", { channel: c.key }); btn.disabled = false; };
    row.appendChild(btn);
    wrap.appendChild(row);
  }
  renderStep();
}

function renderStep() {
  const queue = state.queue;
  if (queue && Array.isArray(queue.channels) && queue.channels.length) {
    const statuses = Object.values(queue.statuses || {});
    const finished = statuses.filter((s) => ["ready", "needs_help", "phone_handoff"].includes(s?.state)).length;
    const n = queue.channels.length;
    $("step").textContent = finished >= n
      ? "Handoff ready — review Facebook/Craigslist and finish OfferUp in its phone app."
      : `Preparing ${n} marketplace${n === 1 ? "" : "s"} (${finished}/${n} ready).`;
  } else {
    $("step").textContent = "";
  }
}

$("fillFb").onclick = async () => {
  if (!state.listing) return;
  const btn = $("fillFb");
  btn.disabled = true;
  await save();
  await send("ahlam-stage", { channel: "facebook", listing: storeShape() });
  btn.textContent = "Opening Facebook…";
  setTimeout(() => { btn.disabled = false; btn.textContent = "▶ Fill Facebook listing"; }, 2500);
};

$("postAll").onclick = async () => {
  if (!state.listing) return;
  $("postAll").disabled = true;
  await save();
  const r = await send("ahlam-stage-queue", { listing: storeShape(), channels: ["ebay", "facebook", "craigslist", "offerup"] });
  $("postAll").disabled = false;
  if (!r.ok) $("step").textContent = r.error || "Open a listing in Ahlam first.";
};

// The shape we hand to the background worker (no internal _raw pointer).
function storeShape() {
  const L = state.listing;
  return { ...L._raw, title: L.title, price: L.price, condition: L.condition,
    category: L.category, location: L.location, description: L.description,
    text: L.description, photoData: L.photoData, photos: L.photos };
}

// Re-render only the queue UI on external changes; never clobber the form fields
// the seller is editing.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.ahlamQueue) {
    state.queue = changes.ahlamQueue.newValue || null;
    if (state.listing) renderChannels();
  }
  // A brand-new listing arrived (different title) while panel was open → reload.
  if (changes.ahlamListing && !state.listing) load();
});

load();
