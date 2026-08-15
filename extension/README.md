# Ahlam Auto-Poster (browser extension)

Facebook Marketplace and Craigslist don't offer a public listing API. This
companion Chrome extension opens their posting pages and fills the supported
fields for you. OfferUp personal listings use its mobile app, so Ahlam prepares
the listing and opens the official phone handoff instead of pretending a desktop
form exists. You always review and publish.

> Shops that have completed eBay business policies can still use Ahlam's direct
> one-click eBay integration. Smaller sellers can instead choose **eBay regular
> account**: the extension creates and fills an ordinary eBay draft.

## Install (one time, ~30 seconds)

1. Open **chrome://extensions** in Chrome (or Edge: `edge://extensions`).
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `extension/` folder.
4. Done — the "Ahlam Auto-Poster" tile appears. Keep it enabled.

Reload ahlam.io. The Export & posting "Post elsewhere" sheet button now says
**"Auto-fill on Facebook Marketplace"** (instead of "Copy & post").

## How it works

1. In Ahlam, open a part/vehicle → **Post elsewhere**.
2. **Tick the marketplaces** you want and click **Prepare marketplaces**. Ahlam hands the
   listing (text + photos) to the extension, which opens every selected
   marketplace in its own tab at once.
3. Supported browser tabs fill Title / Price / Description and attach the photos (Facebook
   also fills Category / Condition / Location).
   - **Facebook**: its form is a dynamic React app with localized,
     frequently-changing labels, so fill is verified field-by-field — the full text is also
     copied to your clipboard as a fallback (paste with ⌘/Ctrl-V if a field is
     missed), then Publish.
   - **eBay regular account**: eBay suggests the category, then Ahlam fills the
     ordinary draft. Review delivery and item specifics, then click List it.
   - **OfferUp**: continue in the OfferUp phone app. The listing text is copied
     before the handoff so you do not need to retype it.
   - **Craigslist**: uses stable field names, so it fills cleanly once you reach
     the post form (after choosing category + area). Add photos in the photo step.
4. Review everything and click the marketplace's Publish/Post button. (We never
   auto-publish on these sites — you stay in control.)

### Pick where, then open & fill all at once
In the "Post elsewhere" sheet, **tap the marketplaces you want** and click
**Prepare marketplaces**. Facebook/Craigslist open in browser tabs; OfferUp opens
its official app handoff. Ahlam reports a separate result for every marketplace
instead of leaving the page at an endless loading message.

### Optional: edit first in the side panel
If you'd rather review and tweak before anything opens, click the **Ahlam
Auto-Poster toolbar icon** to open the side-panel editor. There you can fix the
**title, price, condition, category, location, and description** (autosaves), and
**manage the photos** — remove any, reorder them with the ‹ › arrows, and **add
your own** from your device (up to 10). iPhone HEIC/HEIF photos are converted to
browser-safe JPEGs automatically. Then click **▶ Fill Facebook listing**, or
use the **Other marketplaces** section to open Craigslist or hand off to OfferUp.
We never auto-publish anywhere.

Open the panel any time from the **Ahlam Auto-Poster toolbar icon**.

## Privacy

The extension only runs on `ahlam.io` and the marketplace post pages. It receives
a listing from ahlam.io, downloads that listing's photos, fills the form, and
clears the staged data. It sends nothing anywhere else.

## Files

- `manifest.json` — permissions + which pages each script runs on
- `background.js` — downloads photos, stages the listing, opens tabs, runs the queue
- `content-ahlam.js` — on ahlam.io: announces the extension + relays the listing(s)
- `content-banner.js` — shared "filled — review & publish" status banner
- `photo-utils.js` — validates photo MIME, size, and data before upload
- `vendor/heic2any.min.js` — local HEIC/HEIF decoder used by the side panel (MIT)
- `content-ebay.js` / `content-facebook.js` / `content-craigslist.js` — fill supported browser forms
  (Facebook also fills Category / Condition / Location via combobox best-effort)
- `sidepanel.html` / `sidepanel.js` — the side-panel **editor** (edit fields + photos, Fill Facebook)

## Notes / maintenance

Facebook changes its DOM often; if auto-fill stops matching a field,
update the label keywords in the corresponding `content-*.js` (`fieldBy([...])`).
The clipboard fallback means it degrades gracefully to copy/paste, never to nothing.
