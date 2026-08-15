// Regular-account eBay flow. This avoids forcing a small dismantler through
// Ahlam's business-policy API connection: eBay creates a normal draft in the
// seller's own account, Ahlam fills the draft, and the seller reviews List it.
(async function () {
  const data = await chrome.storage.local.get("ahlamStaged");
  const map = data.ahlamStaged || {};
  const staged = map.ebay;
  if (!staged) return;
  if (Date.now() - (staged.ts || 0) > 5 * 60 * 1000) {
    delete map.ebay; chrome.storage.local.set({ ahlamStaged: map });
    return;
  }

  const L = staged.listing || {};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitFor(fn, timeout = 20000, step = 250) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const value = fn(); if (value) return value; await sleep(step); }
    return null;
  }
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function buttonByText(pattern) {
    return [...document.querySelectorAll("button")].find((button) => pattern.test((button.textContent || "").trim()));
  }
  function imageFile(dataUrl, index) {
    const inspected = AhlamPhotoUtils.inspectDataUrl(dataUrl);
    if (!inspected.ok) return null;
    try {
      const payload = dataUrl.slice(dataUrl.indexOf(",") + 1).replace(/\s/g, "");
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const ext = AhlamPhotoUtils.extensionForMime(inspected.mime);
      return new File([bytes], `ahlam-${index + 1}.${ext}`, { type: inspected.mime, lastModified: Date.now() });
    } catch { return null; }
  }
  function showProgress(text) {
    let el = document.getElementById("__ahlam_banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "__ahlam_banner";
      el.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:11px 16px;border-radius:12px;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;background:#101A2C;border:1px solid #2c3650;box-shadow:0 12px 40px rgba(0,0,0,.4)";
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
  }

  try { await navigator.clipboard.writeText(L.text || L.description || ""); } catch {}

  // Step 1: seed eBay's catalog/category search.
  if (location.pathname.includes("/sl/prelist/suggest")) {
    showProgress("Ahlam — starting your regular eBay listing…");
    const title = await waitFor(() => document.querySelector('input[aria-label*="selling" i], input[type="text"]'));
    if (!title) return window.ahlamShowResult("ebay", "Ahlam couldn't find eBay's listing search. The title is on your clipboard.", false);
    setNativeValue(title, String(L.title || "").slice(0, 80));
    await sleep(200);
    const search = buttonByText(/^Search$/i);
    if (search && !search.disabled) search.click();
    else window.ahlamShowResult("ebay", "Ahlam filled the title, but eBay's Search button needs one click.", false);
    return;
  }

  // Step 2: use eBay's suggested category without copying another seller's
  // catalog details. This produces the ordinary personal-account draft.
  if (location.pathname.includes("/sl/prelist/identify")) {
    showProgress("Ahlam — using eBay's suggested category…");
    const continueButton = await waitFor(() => buttonByText(/Continue without match/i), 20000);
    if (continueButton) continueButton.click();
    else window.ahlamShowResult("ebay", "Pick a matching item or Continue without match; Ahlam will fill the next page.", false);
    return;
  }

  if (!location.pathname.includes("/lstng") && !location.pathname.includes("/sl/list")) return;
  showProgress("Ahlam — filling your regular eBay draft…");

  const filled = [];
  const missing = [];
  const title = await waitFor(() => document.querySelector('input[aria-label="Item title"], input[name*="title" i]'));
  if (title && L.title) { setNativeValue(title, String(L.title).slice(0, 80)); filled.push("title"); } else missing.push("title");

  const price = await waitFor(() => document.querySelector('input[aria-label="Item price"], input[name*="price" i]'), 10000);
  const priceValue = String(L.price || "").replace(/[^0-9.]/g, "");
  if (price && priceValue) { setNativeValue(price, priceValue); filled.push("price"); } else missing.push("price");

  const descriptionText = L.description || L.text || "";
  const descriptionFrame = await waitFor(() => document.querySelector('iframe[id*="rte" i], iframe[name*="summary" i]'), 10000);
  let description = null;
  try { description = descriptionFrame?.contentDocument?.querySelector('[aria-label="Description"], body[contenteditable="true"], textarea'); } catch {}
  if (description && descriptionText) {
    if (description.isContentEditable || description.tagName === "BODY") {
      description.focus(); description.textContent = descriptionText;
      description.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: descriptionText }));
    } else setNativeValue(description, descriptionText);
    filled.push("description");
  } else missing.push("description");

  let photoCount = 0;
  if (Array.isArray(L.photoData) && L.photoData.length) {
    const photoInput = await waitFor(() => document.querySelector('input[type="file"][accept*="image" i], input[type="file"][multiple]'), 12000);
    if (photoInput) {
      const files = new DataTransfer();
      L.photoData.forEach((dataUrl, index) => { const file = imageFile(dataUrl, index); if (file) files.items.add(file); });
      if (files.files.length) {
        photoInput.files = files.files;
        photoInput.dispatchEvent(new Event("change", { bubbles: true }));
        photoCount = files.files.length;
        filled.push("photos");
      }
    }
  }
  if (!photoCount) missing.push("photos");

  const ready = missing.length === 0;
  window.ahlamShowResult(
    "ebay",
    ready
      ? "Ahlam filled your regular eBay draft. Review delivery and item specifics, then click List it."
      : `Ahlam filled ${filled.join(", ") || "the draft"}; finish ${missing.join(", ")} and review delivery before listing.`,
    ready,
    { filled, missing, photos: photoCount }
  );
  delete map.ebay; chrome.storage.local.set({ ahlamStaged: map });
})();
