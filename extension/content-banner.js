// Shared status banner shown on each marketplace once the form is filled. When
// the fill is part of a "post everywhere" run, it adds an "Open next" button so
// the seller moves on to the next marketplace AFTER they publish this one. We
// never advance or submit on our own.
window.ahlamShowResult = async function (channel, text, ok) {
  const LABEL = { facebook: "Facebook Marketplace", offerup: "OfferUp", craigslist: "Craigslist" };
  let nextCh = null;
  try {
    chrome.runtime.sendMessage({ type: "ahlam-filled", channel });
    const { ahlamQueue: q } = await chrome.storage.local.get("ahlamQueue");
    if (q && !q.done && Array.isArray(q.channels)) {
      const i = q.channels.indexOf(channel);
      if (i >= 0 && i + 1 < q.channels.length) nextCh = q.channels[i + 1];
    }
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

  if (nextCh) {
    const btn = document.createElement("button");
    btn.textContent = `I posted — open ${LABEL[nextCh] || nextCh} →`;
    btn.style.cssText = "margin-left:4px;white-space:nowrap;padding:7px 12px;border-radius:9px;border:none;cursor:pointer;background:#D8392E;color:#fff;font:700 12.5px -apple-system,sans-serif";
    btn.onclick = () => { chrome.runtime.sendMessage({ type: "ahlam-next" }); wrap.remove(); };
    wrap.appendChild(btn);
  }

  const close = document.createElement("button");
  close.textContent = "✕";
  close.setAttribute("aria-label", "Dismiss");
  close.style.cssText = "background:transparent;border:none;color:#7c89a8;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px";
  close.onclick = () => wrap.remove();
  wrap.appendChild(close);

  document.documentElement.appendChild(wrap);
  // A queue step waits for the seller; a one-off banner auto-hides.
  if (!nextCh) setTimeout(() => wrap.remove(), 15000);
};
