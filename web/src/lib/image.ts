// Client-side image intake helpers. The goal: accept ANY photo a phone or
// computer produces — HEIC/HEIF (iPhone), JPG, PNG, WEBP — and hand the rest of
// the app a browser-renderable JPEG every time.

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif)$/i;

// True for anything we should treat as an image. iPhone HEIC files frequently
// arrive with an EMPTY mime type, so we fall back to the file extension.
export function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
}

function isHeic(file: File): boolean {
  return /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

// True for a PDF. Gemini reads PDFs natively, so we send these straight through
// as application/pdf rather than trying to rasterize them in the browser.
export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

// Anything the AI scanner can ingest: a photo (JPG/PNG/HEIC/WEBP…) or a PDF.
export function looksLikeScannable(file: File): boolean {
  return looksLikeImage(file) || isPdf(file);
}

// Convert HEIC/HEIF to a JPEG File so browsers can preview/encode it. Other
// formats pass through untouched. Never throws — falls back to the original.
export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const heic2any = (await import("heic2any")).default as (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(out) ? out[0] : out;
    const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file; // Safari can already decode HEIC natively downstream.
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

// Turn any scanner input into a data URL the /api/identify route can forward to
// Gemini. PDFs go through as application/pdf (Gemini parses them natively); every
// image type is normalized + downscaled to JPEG.
export async function fileToAIDataUrl(file: File): Promise<string> {
  if (isPdf(file)) return readAsDataUrl(file); // data:application/pdf;base64,...
  return fileToJpegDataUrl(file);
}

// Downscale + re-encode any image to a JPEG data URL. Used both for the AI call
// (vision APIs reject HEIC and choke on multi-MB photos) and for persistence.
// Falls back to the raw data URL if the browser can't decode it.
export async function fileToJpegDataUrl(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  const normalized = await normalizeImageFile(file);
  const raw = await readAsDataUrl(normalized);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = raw;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return raw;
  }
}
