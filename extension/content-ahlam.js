// Runs on ahlam.io. Two jobs:
// 1) Tell the page the extension is installed (so it can show "Auto-fill" buttons).
// 2) Relay a listing the page wants to post → the background worker.

// Mark our presence as early as possible; the web app reads this attribute.
try { document.documentElement.setAttribute("data-ahlam-autopost", "1"); } catch {}

// Re-assert after the framework hydrates (in case it replaces <html> attributes).
document.addEventListener("DOMContentLoaded", () => {
  try { document.documentElement.setAttribute("data-ahlam-autopost", "1"); } catch {}
});

function reply(payload) {
  window.postMessage({ __ahlamAutopostReply: true, ...payload }, "*");
}

// Relay live per-market status changes back into the Ahlam page. This closes the
// loop that previously left the website stuck on “fill in progress” forever.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ahlam-queue-update") reply({ kind: "queueStatus", queue: msg.queue || null });
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const d = event.data;
  if (!d || d.__ahlamAutopost !== true) return;

  if (d.kind === "ping") {
    // Let the page confirm we're alive.
    reply({ installed: true });
    return;
  }
  if (d.kind === "load" && d.listing) {
    // Load into the side-panel editor (no marketplace tab opens yet).
    chrome.runtime.sendMessage(
      { type: "ahlam-load", listing: d.listing },
      (resp) => {
        reply({ loaded: !!resp?.ok, photos: resp?.photos || 0, error: resp?.error || null });
      }
    );
    return;
  }
  if (d.kind === "post" && d.listing) {
    chrome.runtime.sendMessage(
      { type: "ahlam-stage", channel: d.channel || "facebook", listing: d.listing },
      (resp) => {
        reply({ staged: !!resp?.ok, photos: resp?.photos || 0, queue: resp?.queue || null, error: resp?.error || null });
      }
    );
  }
  // Post everywhere: one listing -> an ordered run of marketplaces.
  if (d.kind === "postAll" && d.listing) {
    chrome.runtime.sendMessage(
      { type: "ahlam-stage-queue", listing: d.listing, channels: d.channels },
      (resp) => {
        reply({ queued: !!resp?.ok, channels: resp?.channels || [], queue: resp?.queue || null, error: resp?.error || null });
      }
    );
  }
});
