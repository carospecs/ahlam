// Client-side PII masking (pipeline Stage 0). Draws an image to a canvas and paints a
// SOLID OPAQUE box over each personal-identifier region (license plate / windshield VIN),
// then returns a fresh object URL for the redacted image. It runs entirely in the browser,
// so the plate/VIN never leave the device un-redacted.
//
// Solid masking is deliberate over blur: a blur can sometimes be reversed / read at higher
// resolution; an opaque fill cannot. Best-effort — on any failure it returns the original
// url rather than blocking the flow.

export type PiiBox = { box: [number, number, number, number] }; // [x0,y0,x1,y1], fractions 0–1

const clamp = (n: number) => Math.min(1, Math.max(0, n));

// Draw the image and paint an opaque box over each region. Returns the canvas, or null
// if the image can't be loaded / drawn. Shared by both public helpers below. Downscales
// to maxDim like the rest of the photo pipeline (lib/image.ts) — without this, a
// redacted photo (drawn at full native resolution) can run several MB by itself and,
// bundled with a car's other photos into one save request, blow past the platform's
// request-body size limit.
async function maskToCanvas(url: string, regions: PiiBox[], maxDim = 1600): Promise<HTMLCanvasElement | null> {
  if (!regions.length || typeof document === "undefined") return null;
  const img = await loadImage(url);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) return null;
  const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.fillStyle = "#111";
  const pad = 0.02; // pad ~2% so the plate/VIN edges aren't left peeking
  for (const { box: [x0, y0, x1, y1] } of regions) {
    const px = clamp(x0 - pad) * w;
    const py = clamp(y0 - pad) * h;
    const pw = clamp(x1 + pad) * w - px;
    const ph = clamp(y1 + pad) * h - py;
    if (pw > 0 && ph > 0) ctx.fillRect(px, py, pw, ph);
  }
  return canvas;
}

// Redacted object URL for DISPLAY (thumbnails, hero). Falls back to the original url.
export async function redactImage(url: string, regions: PiiBox[]): Promise<string> {
  try {
    const canvas = await maskToCanvas(url, regions);
    if (!canvas) return url;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    return blob ? URL.createObjectURL(blob) : url;
  } catch {
    return url;
  }
}

// Redacted JPEG data URL for the UPLOADED/SAVED listing image — the customer-facing copy.
// Returns null if there's nothing to redact so the caller can use its normal encode path.
export async function redactImageToDataUrl(url: string, regions: PiiBox[], maxDim = 1600, quality = 0.85): Promise<string | null> {
  try {
    const canvas = await maskToCanvas(url, regions, maxDim);
    return canvas ? canvas.toDataURL("image/jpeg", quality) : null;
  } catch {
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
