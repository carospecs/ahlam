"use client";

import { useEffect } from "react";

// Registers the PWA service worker once the app has mounted. Silent on failure
// (e.g. unsupported browsers, http in dev) so it never blocks the app.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
