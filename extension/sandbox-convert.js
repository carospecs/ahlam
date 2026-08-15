// Runs inside the sandboxed page (see sandbox.html). Receives {id, blob} from
// the side panel, converts HEIC → JPEG with heic2any, and posts the result
// back. Blobs survive postMessage via structured clone.
window.addEventListener("message", async (event) => {
  const data = event.data || {};
  if (!data.id || !data.blob || !event.source) return;
  try {
    if (typeof window.heic2any !== "function") throw new Error("HEIC converter didn't load");
    const converted = await window.heic2any({ blob: data.blob, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob) throw new Error("Couldn't convert this HEIC photo");
    event.source.postMessage({ ahlamHeic: true, id: data.id, ok: true, blob }, "*");
  } catch (error) {
    event.source.postMessage({ ahlamHeic: true, id: data.id, ok: false, error: String((error && error.message) || error) }, "*");
  }
});
