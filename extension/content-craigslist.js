// Runs on craigslist.org. Craigslist's posting form uses stable field names
// (PostingTitle, price, PostingBody), so it fills cleanly once you reach the form
// (after picking your category & area). Photos are added via the photo step.

(async function () {
  const { ahlamStaged: s } = await chrome.storage.local.get("ahlamStaged");
  if (!s || s.channel !== "craigslist") return;
  if (Date.now() - (s.ts || 0) > 30 * 60 * 1000) { chrome.storage.local.remove("ahlamStaged"); return; }

  const L = s.listing || {};
  try { await navigator.clipboard.writeText(L.text || L.description || ""); } catch {}

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, t = 30000) { const end = Date.now() + t; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(300); } return null; }
  function set(el, v) {
    const setter = Object.getOwnPropertyDescriptor((el.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement).prototype, "value").set;
    setter.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // The posting form only appears after category + area selection — wait for it.
  const titleEl = await waitFor(() => document.querySelector("#PostingTitle, input[name='PostingTitle']"));
  if (!titleEl) { chrome.storage.local.remove("ahlamStaged"); return; }
  chrome.storage.local.remove("ahlamStaged");

  set(titleEl, String(L.title || "").slice(0, 70));
  const priceEl = document.querySelector("#price, input[name='price']");
  if (priceEl && L.price) set(priceEl, String(L.price).replace(/[^0-9.]/g, ""));
  const bodyEl = document.querySelector("#PostingBody, textarea[name='PostingBody']");
  if (bodyEl) set(bodyEl, L.description || L.text || "");
  const cityEl = document.querySelector("#postal_city, input[name='postal_city']");
  if (cityEl && L.location) set(cityEl, L.location);

  const el = document.createElement("div");
  el.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:11px 16px;border-radius:12px;font:600 13px -apple-system,sans-serif;color:#fff;background:#101A2C;border:1px solid #2c3650;box-shadow:0 12px 40px rgba(0,0,0,.4)";
  el.textContent = "Ahlam filled the listing — add your photos in the next step, then publish.";
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 14000);
})();
