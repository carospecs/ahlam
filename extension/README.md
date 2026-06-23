# Ahlam Auto-Poster (browser extension)

Facebook Marketplace, OfferUp, and Craigslist don't offer any API or link that
can pre-fill their "new post" forms — so a website alone can only copy text for
you to paste. This companion Chrome extension closes that gap: when you click
**Auto-fill** in Ahlam → Export & posting, it opens the marketplace and types the
**title, price, description, and photos** into the form for you. You review and
hit Publish.

> eBay is unaffected — it has a real API and already auto-publishes from Ahlam
> with one click. This extension is only for the marketplaces that lack an API.

## Install (one time, ~30 seconds)

1. Open **chrome://extensions** in Chrome (or Edge: `edge://extensions`).
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `extension/` folder.
4. Done — the "Ahlam Auto-Poster" tile appears. Keep it enabled.

Reload ahlam.io. The Export & posting "Post elsewhere" sheet button now says
**"Auto-fill on Facebook Marketplace"** (instead of "Copy & post").

## How it works

1. In Ahlam, open a part/vehicle → **Post elsewhere** → pick a marketplace.
2. Click **Auto-fill on …**. Ahlam hands the listing (text + photos) to the
   extension; the marketplace opens in a new tab.
3. The extension fills Title / Price / Description and attaches the photos.
   - **Facebook / OfferUp**: their forms are dynamic React apps with localized,
     frequently-changing labels, so fill is best-effort — the full text is also
     copied to your clipboard as a fallback (paste with ⌘/Ctrl-V if a field is
     missed). Pick Category/Condition (Facebook requires choosing those), then
     Publish.
   - **Craigslist**: uses stable field names, so it fills cleanly once you reach
     the post form (after choosing category + area). Add photos in the photo step.
4. Review everything and click the marketplace's Publish/Post button. (We never
   auto-publish on these sites — you stay in control.)

### Post everywhere (one after another)
Click **Auto-post everywhere** in the same sheet. The extension opens **Facebook
first**, fills it, and shows an **"I posted — open Craigslist →"** button. After
you publish Facebook, click it to move to Craigslist, then OfferUp. You publish
each one yourself; nothing posts automatically.

### Side panel (the "mini bot")
Click the **Ahlam Auto-Poster toolbar icon** to open the side panel. It shows the
current listing, the status of each marketplace (Queued / Open now / Filled), an
**Open** button per marketplace, and a **Post to all** button — so you can drive
the whole run from one place without going back to the Ahlam tab.

## Privacy

The extension only runs on `ahlam.io` and the marketplace post pages. It receives
a listing from ahlam.io, downloads that listing's photos, fills the form, and
clears the staged data. It sends nothing anywhere else.

## Files

- `manifest.json` — permissions + which pages each script runs on
- `background.js` — downloads photos, stages the listing, opens tabs, runs the queue
- `content-ahlam.js` — on ahlam.io: announces the extension + relays the listing(s)
- `content-banner.js` — shared status banner + the "open next marketplace" button
- `content-facebook.js` / `content-offerup.js` / `content-craigslist.js` — fill each form
- `sidepanel.html` / `sidepanel.js` — the side-panel mini bot (status + Post to all)

## Notes / maintenance

Facebook and OfferUp change their DOM often; if auto-fill stops matching a field,
update the label keywords in the corresponding `content-*.js` (`fieldBy([...])`).
The clipboard fallback means it degrades gracefully to copy/paste, never to nothing.
