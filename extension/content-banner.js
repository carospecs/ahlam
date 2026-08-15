// Shared status banner shown on each marketplace once the form is filled. All
// selected marketplaces open at once now, so there's no "open next" step — each
// tab just reports it was filled and reminds the seller to review and Publish.
// We never advance or submit on our own.
window.ahlamShowResult = async function (channel, text, ok, detail) {
  try {
    chrome.runtime.sendMessage({
      type: "ahlam-result",
      channel,
      ok: !!ok,
      state: ok ? "ready" : "needs_help",
      message: text,
      detail: detail || null,
    });
  } catch {}

  const old = document.getElementById("__ahlam_banner");
  if (old) old.remove();

  const wrap = document.createElement("div");
  wrap.id = "__ahlam_banner";
  wrap.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:600px;padding:11px 14px;border-radius:12px;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;background:#101A2C;border:1px solid #2c3650;box-shadow:0 12px 40px rgba(0,0,0,.4);display:flex;gap:10px;align-items:center";

  const dot = ok ? "#22C55E" : "#F59E0B";
  const msg = document.createElement("span");
  msg.style.cssText = "display:flex;gap:9px;align-items:center";
  msg.innerHTML = `<span style="width:9px;height:9px;border-radius:50%;background:${dot};flex:0 0 auto"></span><span></span>`;
  msg.lastChild.textContent = text;
  wrap.appendChild(msg);

  const close = document.createElement("button");
  close.textContent = "✕";
  close.setAttribute("aria-label", "Dismiss");
  close.style.cssText = "background:transparent;border:none;color:#7c89a8;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px";
  close.onclick = () => wrap.remove();
  wrap.appendChild(close);

  document.documentElement.appendChild(wrap);
  setTimeout(() => wrap.remove(), 18000);
};
