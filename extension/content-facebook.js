// Runs on Facebook Marketplace "create item". Reads the staged Ahlam listing and
// fills Title / Price / Description + attaches the photos. Facebook's form is a
// dynamic React app with localized, frequently-changing labels, so every step is
// best-effort with fallbacks; whatever can't be auto-filled is still on the
// clipboard for a manual paste.

(async function () {
  const data = await chrome.storage.local.get("ahlamStaged");
  const staged = data.ahlamStaged;
  if (!staged || staged.channel !== "facebook") return;
  // Ignore stale hand-offs (older than 5 minutes).
  if (Date.now() - (staged.ts || 0) > 5 * 60 * 1000) { chrome.storage.local.remove("ahlamStaged"); return; }
  chrome.storage.local.remove("ahlamStaged"); // one-shot

  const L = staged.listing || {};
  banner("Ahlam — filling your listing…");
  // Clipboard fallback (so the seller can paste the full text if a field is missed).
  try { await navigator.clipboard.writeText(L.text || L.description || ""); } catch {}

  // ---- helpers -----------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeout = 20000, step = 250) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(step); }
    return null;
  }
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function fieldBy(labels) {
    const els = [...document.querySelectorAll('input[type="text"],input:not([type]),input[type="number"],textarea,[contenteditable="true"]')];
    for (const lbl of labels) {
      const el = els.find((e) => {
        const a = (e.getAttribute("aria-label") || e.getAttribute("placeholder") || "").toLowerCase();
        return a.includes(lbl);
      });
      if (el) return el;
    }
    return null;
  }
  function dataUrlToFile(dataUrl, name) {
    try {
      const [meta, b64] = dataUrl.split(",");
      const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], name, { type: mime });
    } catch { return null; }
  }

  // ---- 1. Photos (FB often reveals the text fields only after a photo) ----
  if (Array.isArray(L.photoData) && L.photoData.length) {
    const input = await waitFor(() =>
      document.querySelector('input[type="file"][accept*="image"]') || document.querySelector('input[type="file"]')
    , 15000);
    if (input) {
      const dt = new DataTransfer();
      L.photoData.forEach((du, i) => { const f = dataUrlToFile(du, `ahlam-${i + 1}.jpg`); if (f) dt.items.add(f); });
      if (dt.files.length) {
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  // ---- 2. Title / Price / Description ------------------------------------
  const title = await waitFor(() => fieldBy(["title"]), 20000);
  if (title) setNativeValue(title, String(L.title || "").slice(0, 100));

  const price = fieldBy(["price"]);
  if (price && L.price != null && L.price !== "") setNativeValue(price, String(L.price).replace(/[^0-9.]/g, ""));

  // Description is usually a textarea; fall back to any contenteditable.
  let desc = fieldBy(["description", "details", "tell"]);
  if (!desc) desc = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
  if (desc) {
    if (desc.isContentEditable) { desc.focus(); document.execCommand("insertText", false, L.description || L.text || ""); }
    else setNativeValue(desc, L.description || L.text || "");
  }

  const filled = [title && "title", price && "price", desc && "description"].filter(Boolean);
  banner(
    filled.length
      ? `Ahlam filled: ${filled.join(", ")}. Pick Category/Condition, then Publish. (Full text copied — paste if anything's missing.)`
      : `Ahlam couldn't find the fields automatically — the full text is on your clipboard, just paste it.`,
    filled.length ? "ok" : "warn"
  );

  // ---- tiny status banner -------------------------------------------------
  function banner(text, kind) {
    let el = document.getElementById("__ahlam_banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "__ahlam_banner";
      el.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:560px;padding:11px 16px;border-radius:12px;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;background:#101A2C;border:1px solid #2c3650;box-shadow:0 12px 40px rgba(0,0,0,0.4);display:flex;gap:10px;align-items:center";
      document.documentElement.appendChild(el);
    }
    const dot = kind === "warn" ? "#F59E0B" : kind === "ok" ? "#22C55E" : "#D8392E";
    el.innerHTML = `<span style="width:9px;height:9px;border-radius:50%;background:${dot};flex:0 0 auto"></span><span>${text}</span>`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.remove(), kind === "ok" || kind === "warn" ? 14000 : 60000);
  }
  // hoist banner for earlier calls
  function noop() {}
})();
