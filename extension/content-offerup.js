// Runs on OfferUp's post flow. Like Facebook, OfferUp is a React SPA with
// localized labels, so this is best-effort: fill title/price/description by their
// accessible labels and attach photos; the full text is on the clipboard as a
// fallback for anything that can't be matched.

(async function () {
  const { ahlamStaged: s } = await chrome.storage.local.get("ahlamStaged");
  if (!s || s.channel !== "offerup") return;
  if (Date.now() - (s.ts || 0) > 5 * 60 * 1000) { chrome.storage.local.remove("ahlamStaged"); return; }
  chrome.storage.local.remove("ahlamStaged");

  const L = s.listing || {};
  try { await navigator.clipboard.writeText(L.text || L.description || ""); } catch {}

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, t = 20000) { const end = Date.now() + t; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(250); } return null; }
  function set(el, v) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, v); else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function fieldBy(labels) {
    const els = [...document.querySelectorAll('input[type="text"],input:not([type]),input[type="number"],textarea')];
    for (const lbl of labels) { const el = els.find((e) => ((e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.name || "").toLowerCase()).includes(lbl)); if (el) return el; }
    return null;
  }
  function dataUrlToFile(du, name) {
    try { const [m, b] = du.split(","); const mime = (m.match(/data:([^;]+)/) || [])[1] || "image/jpeg"; const bin = atob(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new File([a], name, { type: mime }); } catch { return null; }
  }

  if (Array.isArray(L.photoData) && L.photoData.length) {
    const input = await waitFor(() => document.querySelector('input[type="file"][accept*="image"]') || document.querySelector('input[type="file"]'), 15000);
    if (input) { const dt = new DataTransfer(); L.photoData.forEach((d, i) => { const f = dataUrlToFile(d, `ahlam-${i + 1}.jpg`); if (f) dt.items.add(f); }); if (dt.files.length) { input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); } }
  }

  const title = await waitFor(() => fieldBy(["title", "what are you selling", "item name"]), 20000);
  if (title) set(title, String(L.title || "").slice(0, 80));
  const price = fieldBy(["price"]);
  if (price && L.price) set(price, String(L.price).replace(/[^0-9.]/g, ""));
  let desc = fieldBy(["description", "describe"]) || document.querySelector("textarea");
  if (desc) set(desc, L.description || L.text || "");

  const el = document.createElement("div");
  el.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:520px;padding:11px 16px;border-radius:12px;font:600 13px -apple-system,sans-serif;color:#fff;background:#101A2C;border:1px solid #2c3650;box-shadow:0 12px 40px rgba(0,0,0,.4)";
  el.textContent = (title ? "Ahlam filled the listing — review and publish." : "Ahlam couldn't match the fields — full text is on your clipboard, just paste.") ;
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 14000);
})();
