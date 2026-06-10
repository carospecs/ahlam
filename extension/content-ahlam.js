// Runs on ahlam.io. Two jobs:
// 1) Tell the page the extension is installed (so it can show "Auto-fill" buttons).
// 2) Relay a listing the page wants to post → the background worker.

// Mark our presence as early as possible; the web app reads this attribute.
try { document.documentElement.setAttribute("data-ahlam-autopost", "1"); } catch {}

// Re-assert after the framework hydrates (in case it replaces <html> attributes).
document.addEventListener("DOMContentLoaded", () => {
  try { document.documentElement.setAttribute("data-ahlam-autopost", "1"); } catch {}
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const d = event.data;
  if (!d || d.__ahlamAutopost !== true) return;

  if (d.kind === "ping") {
    // Let the page confirm we're alive.
    window.postMessage({ __ahlamAutopostReply: true, installed: true }, "*");
    return;
  }
  if (d.kind === "post" && d.listing) {
    chrome.runtime.sendMessage(
      { type: "ahlam-stage", channel: d.channel || "facebook", listing: d.listing },
      (resp) => {
        window.postMessage({ __ahlamAutopostReply: true, staged: !!resp?.ok, photos: resp?.photos || 0 }, "*");
      }
    );
  }
});
