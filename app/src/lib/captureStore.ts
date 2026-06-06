import type { AIResult } from "@ahlam/shared";

/**
 * Tiny in-memory hand-off between the capture screen and the review screen.
 * Base64 images are too large to pass through router params, so we stash the
 * pending capture here and the review screen reads it.
 */
type Pending = {
  imageBase64: string;
  imageUri: string;
  result?: AIResult;
};

let pending: Pending | null = null;

export function setPendingCapture(p: Pending) {
  pending = p;
}

export function getPendingCapture(): Pending | null {
  return pending;
}

export function clearPendingCapture() {
  pending = null;
}
