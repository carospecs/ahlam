// Shared, dependency-free photo validation used by the service worker and the
// marketplace content scripts. Keep this file browser + Node compatible so the
// risky MIME/size rules have a small regression test.
(function (root, factory) {
  const api = factory();
  root.AhlamPhotoUtils = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
  const IMAGE_MIME = /^image\/[a-z0-9.+-]+$/i;

  function cleanMime(value) {
    return String(value || "").split(";", 1)[0].trim().toLowerCase();
  }

  function isImageMime(value) {
    return IMAGE_MIME.test(cleanMime(value));
  }

  function estimateDataUrlBytes(value) {
    const match = String(value || "").match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return -1;
    const payload = match[2].replace(/\s/g, "");
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
  }

  function inspectDataUrl(value) {
    const match = String(value || "").match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return { ok: false, error: "Invalid image data" };
    const mime = cleanMime(match[1]);
    if (!isImageMime(mime)) return { ok: false, error: "Downloaded file is not an image" };
    const bytes = estimateDataUrlBytes(value);
    if (bytes <= 0) return { ok: false, error: "Image is empty" };
    if (bytes > MAX_SOURCE_BYTES) return { ok: false, error: "Image is larger than 15 MB" };
    return { ok: true, mime, bytes };
  }

  function extensionForMime(value) {
    const mime = cleanMime(value);
    return ({
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/heic": "heic",
      "image/heif": "heif",
    })[mime] || "img";
  }

  return { MAX_SOURCE_BYTES, cleanMime, isImageMime, estimateDataUrlBytes, inspectDataUrl, extensionForMime };
});
