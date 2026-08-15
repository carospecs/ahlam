// Runs on Facebook Marketplace "create item" AND "create vehicle". Reads the
// staged Ahlam listing and fills the right form: a PART goes to the item form
// (Title / Price / Description + "Auto parts" category); a whole CAR goes to
// Facebook's separate Vehicle form (Vehicle type / Year / Make / Model / Mileage
// / Price / Description). Facebook's form is a dynamic React app with localized,
// frequently-changing labels, so every step is best-effort with fallbacks;
// whatever can't be auto-filled is still on the clipboard for a manual paste.

(async function () {
  const data = await chrome.storage.local.get("ahlamStaged");
  const map = data.ahlamStaged || {};
  const staged = map.facebook;
  if (!staged) return;
  // Ignore stale hand-offs (older than 5 minutes).
  if (Date.now() - (staged.ts || 0) > 5 * 60 * 1000) {
    delete map.facebook; chrome.storage.local.set({ ahlamStaged: map });
    return;
  }

  const L = staged.listing || {};

  // A whole-car listing → Facebook's Vehicle form. Detect from the URL we were
  // routed to (background opens /create/vehicle), or from the listing itself.
  const isVehicle =
    location.pathname.includes("/create/vehicle") ||
    L.kind === "vehicle" || L.type === "vehicle" || L.isVehicle === true ||
    String(L.category || "").toLowerCase().includes("vehicle");

  banner(isVehicle ? "Ahlam — filling your vehicle listing…" : "Ahlam — filling your listing…");
  // Clipboard fallback (so the seller can paste the full text if a field is missed).
  try { await navigator.clipboard.writeText(L.text || L.description || ""); } catch {}

  // ---- helpers -----------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const digits = (v) => String(v == null ? "" : v).replace(/[^0-9.]/g, "");
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
        // Facebook leaves aria-label/placeholder empty and puts the field name in
        // the wrapping <label> (e.g. "Title", "Price"), so check that text too.
        const a = ((e.getAttribute("aria-label") || "") + " " + (e.getAttribute("placeholder") || "") + " " + (e.closest("label")?.textContent || "")).toLowerCase();
        return a.includes(lbl);
      });
      if (el) return el;
    }
    return null;
  }
  function dataUrlToBlob(dataUrl) {
    const inspected = AhlamPhotoUtils.inspectDataUrl(dataUrl);
    if (!inspected.ok) throw new Error(inspected.error);
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1).replace(/\s/g, "");
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: inspected.mime });
  }
  async function imageSource(blob) {
    if (typeof createImageBitmap === "function") {
      try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch {}
    }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Browser couldn't read this image")); };
      img.src = url;
    });
  }
  // Facebook is strict about mismatched filenames and image bytes. Decode every
  // source in Chrome, downscale very large images, and attach a genuine JPEG.
  async function normalizedPhotoFile(dataUrl, index) {
    const source = await imageSource(dataUrlToBlob(dataUrl));
    const rawWidth = source.width || source.naturalWidth || 0;
    const rawHeight = source.height || source.naturalHeight || 0;
    if (!rawWidth || !rawHeight) throw new Error("Image has no readable dimensions");
    const maxEdge = 4096;
    const scale = Math.min(1, maxEdge / Math.max(rawWidth, rawHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rawWidth * scale));
    canvas.height = Math.max(1, Math.round(rawHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser couldn't prepare the image");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    source.close?.();
    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!jpeg || !jpeg.size) throw new Error("Browser couldn't convert the image");
    return new File([jpeg], `ahlam-${index + 1}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  }
  function facebookPhotoError() {
    const nodes = [...document.querySelectorAll('[role="dialog"],[role="alert"]')];
    const pattern = /can(?:not|'t) read files|could(?: not|n't) read|error uploading|unsupported (?:file|photo|image)/i;
    return nodes.find((node) => pattern.test(node.textContent || ""))?.textContent?.trim() || "";
  }
  // Facebook's Category/Condition/Vehicle dropdowns are comboboxes (a button that
  // opens a listbox). Best-effort: find by label text, open it, click the match.
  function findCombo(labels) {
    const cands = [...document.querySelectorAll('[role="combobox"],[aria-haspopup="listbox"],[role="button"],label')];
    for (const lbl of labels) {
      const el = cands.find((e) => ((e.getAttribute("aria-label") || e.textContent || "").toLowerCase().includes(lbl)));
      if (el) return el;
    }
    return null;
  }
  async function pickCombo(labels, optionText) {
    if (optionText == null || optionText === "") return false;
    const combo = findCombo(labels);
    if (!combo) return false;
    combo.click();
    const want = String(optionText).toLowerCase();
    const opt = await waitFor(() => {
      const opts = [...document.querySelectorAll('[role="option"],[role="menuitemradio"],[role="menuitem"]')];
      return opts.find((o) => o.textContent.trim().toLowerCase() === want)
          || opts.find((o) => o.textContent.trim().toLowerCase().includes(want));
    }, 3500, 200);
    if (opt) { opt.click(); return true; }
    document.body.click(); // close popup if nothing matched
    return false;
  }
  // Make/Model on the Vehicle form render as a DROPDOWN once Vehicle type + Year
  // are set, but can be a plain text input in other states. Try the dropdown
  // first, then fall back to typing. (Verified against the live FB vehicle form.)
  async function setComboOrText(labels, value) {
    if (value == null || value === "") return false;
    if (await pickCombo(labels, value)) return true;
    const el = fieldBy(labels);
    if (el) { setNativeValue(el, String(value)); return true; }
    return false;
  }
  // Category is a special case: opening it lists plain <div> rows (not role=option),
  // e.g. "Auto parts", "Vehicles". Open it and click the row whose text matches.
  async function pickCategory(value) {
    if (!value) return false;
    const combo = findCombo(["category"]);
    if (!combo) return false;
    combo.click();
    const want = String(value).toLowerCase();
    const row = await waitFor(() => {
      const rows = [...document.querySelectorAll('div,li,span')].filter((e) => {
        const t = (e.textContent || "").trim().toLowerCase();
        return (t === want || (want.length > 4 && t.includes(want))) && e.querySelectorAll("*").length <= 2;
      });
      return rows.length ? rows[rows.length - 1] : null;
    }, 3500, 200);
    if (row) { row.click(); return true; }
    document.body.click();
    return false;
  }

  // ---- 1. Photos (FB often reveals the other fields only after a photo) ----
  let photoOk = false;
  let photoDetail = "";
  if (Array.isArray(L.photoData) && L.photoData.length) {
    const input = await waitFor(() =>
      document.querySelector('input[type="file"][accept*="image"]') || document.querySelector('input[type="file"]')
    , 15000);
    if (input) {
      const dt = new DataTransfer();
      const failures = [];
      for (let i = 0; i < L.photoData.length; i++) {
        try { dt.items.add(await normalizedPhotoFile(L.photoData[i], i)); }
        catch (error) { failures.push(error?.message || "Unreadable image"); }
      }
      if (dt.files.length) {
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(3000);
        const facebookError = facebookPhotoError();
        photoOk = !facebookError;
        photoDetail = facebookError || (failures.length ? `${dt.files.length} photo(s) attached; ${failures.length} skipped` : `${dt.files.length} photo(s) attached`);
      } else {
        photoDetail = failures[0] || "No readable photos were available";
      }
    } else photoDetail = "Facebook's photo field wasn't found";
  } else {
    photoDetail = (L.photoErrors || [])[0] || "No photo was provided";
  }

  let filled = [];
  let missing = [];

  if (isVehicle) {
    // ---- VEHICLE form (verified live): type → year → make → model → ... -------
    // Order matters: picking Make re-renders Model, so Make must come BEFORE Model
    // or Model gets cleared. Each pick needs a beat for the next field to populate.
    const vtype = L.vehicleType || "Car/Truck";
    const typeOk = await pickCombo(["vehicle type", "type"], vtype);
    await sleep(900); // let Year/Make render

    const yearOk = await pickCombo(["year"], L.year != null ? String(L.year) : "");
    await sleep(500);
    const makeOk = await setComboOrText(["make"], L.make);
    await sleep(700); // Make selection re-renders Model
    const modelOk = await setComboOrText(["model"], L.model);
    await sleep(200);

    const mileageEl = fieldBy(["mileage", "miles", "odometer"]);
    const mileageVal = digits(L.mileage);
    if (mileageEl && mileageVal) setNativeValue(mileageEl, mileageVal);

    const priceEl = fieldBy(["price"]);
    if (priceEl && L.price != null && L.price !== "") setNativeValue(priceEl, digits(L.price));

    // Body style / exterior color are optional on FB; set if we have them.
    if (L.bodyStyle) await pickCombo(["body style", "body"], L.bodyStyle);
    if (L.exteriorColor || L.color) await pickCombo(["exterior color", "color"], L.exteriorColor || L.color);

    let descEl = fieldBy(["description", "details", "tell"]);
    if (!descEl) descEl = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    if (descEl) {
      const body = L.description || L.text || "";
      if (descEl.isContentEditable) { descEl.focus(); document.execCommand("insertText", false, body); }
      else setNativeValue(descEl, body);
    }

    filled = [photoOk && "photos", typeOk && "type", yearOk && "year", makeOk && "make", modelOk && "model",
              (mileageEl && mileageVal) && "mileage", (priceEl && digits(L.price)) && "price", (descEl && (L.description || L.text)) && "description"].filter(Boolean);
    missing = ["photos", "type", "year", "make", "model", "mileage", "price", "description"].filter((f) => !filled.includes(f));
  } else {
    // ---- ITEM form: title / price / description / condition / category ------
    const title = await waitFor(() => fieldBy(["title"]), 20000);
    if (title) setNativeValue(title, String(L.title || "").slice(0, 100));

    const price = fieldBy(["price"]);
    if (price && L.price != null && L.price !== "") setNativeValue(price, digits(L.price));

    let desc = fieldBy(["description", "details", "tell"]);
    if (!desc) desc = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    if (desc) {
      if (desc.isContentEditable) { desc.focus(); document.execCommand("insertText", false, L.description || L.text || ""); }
      else setNativeValue(desc, L.description || L.text || "");
    }

    const cond = await pickCombo(["condition"], L.condition);
    // Parts default to the "Auto parts" category when the listing didn't set one.
    const cat = await pickCategory(L.category || "Auto parts & accessories");

    filled = [photoOk && "photos", (title && L.title) && "title", (price && digits(L.price)) && "price", (desc && (L.description || L.text)) && "description", cat && "category", cond && "condition"].filter(Boolean);
    missing = ["photos", "title", "price", "description", "category", "condition"].filter((f) => !filled.includes(f));
  }

  // ---- Location (shared — typeahead: fill, then pick the first suggestion) -
  let loc = false;
  if (L.location) {
    const locField = fieldBy(["location"]);
    if (locField) {
      setNativeValue(locField, String(L.location));
      locField.focus();
      const sugg = await waitFor(() => document.querySelector('ul[role="listbox"] [role="option"],[role="option"]'), 2500, 200);
      if (sugg) { sugg.click(); }
      loc = true;
      filled.push("location");
    }
  }

  const ready = missing.length === 0;
  const resultText = ready
    ? "Ahlam filled the required Facebook fields and photos. Review the listing, then click Publish."
    : `Ahlam filled ${filled.length} field${filled.length === 1 ? "" : "s"}, but ${missing.join(", ")} still need attention. Your full text is on the clipboard.`;
  window.ahlamShowResult(
    "facebook",
    resultText,
    ready,
    { filled, missing, photos: photoDetail }
  );
  // One-shot only after a verified result was reported. A reload during the fill
  // can still recover the staged listing for up to five minutes.
  delete map.facebook; chrome.storage.local.set({ ahlamStaged: map });

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
})();
