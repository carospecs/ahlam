# Ahlam Onboarding Kit

Owner: Cora (Customer Success & Onboarding)
Last updated: 2026-06-30
Status: Drafts for the co-founders to review and send. Cora drafts; the co-founders send.

## The one job this kit does

Get a yard from "I signed up" to **their first real listings live, fast.** Most signups never post a first part, and a yard that never lists never feels the value and churns. Every piece below is built around the shortest path to that first "aha": **take photos → scan → review price → post.**

---

## How the product actually works (grounded in the code, for whoever sends these)

Read this once so nothing we tell a customer is wrong.

- **The scan engine is Gemini vision, VIN-first.** The app reads the VIN off the photo first (`api/read-vin`), decodes it against NHTSA, then identifies each part for that exact vehicle (`api/identify`). Note for internal accuracy: older docs and notes say "GPT-4o Vision." The live code uses **Gemini**. Don't say "GPT-4o" to customers. (Founders: confirm you're comfortable with us simply saying "AI" externally, which is what the in-app copy does.)
- **Pricing is a transparent formula, not a live market scrape.** The AI estimates the brand-new price of the part, then the app applies a vehicle-age factor and a condition-grade factor (A/B/C) to get a used price (`lib/age-pricing`). Each price carries a **confidence level**, and confidence drops to "low" when the model year is unknown. So the honest line is: "it's a smart starting price you review," not "guaranteed market value."
- **Photos** are captured by labeled slots: Front, Rear, Left, Right, Interior, Detail, VIN plate, Engine, Dash, Extra (`views/Photos.tsx`). A clear VIN-plate shot makes everything downstream better.
- **eBay is the only true one-click auto-publish.** Connect the eBay account once (OAuth), then "List on eBay automatically" posts via the real API (`api/ebay/*`, `views/ExportCenter.tsx`).
- **Facebook Marketplace, OfferUp, and Craigslist have no posting API.** Ahlam copies the listing text and saves the photos, then opens the post form. The optional **Chrome extension ("Ahlam Auto-Poster")** goes one step further and auto-FILLS title, price, description, and photos into those forms. **It never auto-publishes — the user always reviews and clicks Publish.** On a phone, there's no extension; the app uses the OS share sheet to hand off to the marketplace app.
- **Bulk export via CSV:** a general listings CSV, a Facebook/Meta catalog CSV, and a **Car-Part.com / URG** inventory CSV for the pro wholesale channel.
- **Marketplace + escrow** exist on Ahlam itself (`api/marketplace`, `api/payments`), with warranty/returns fields, and **NMVTIS** export for licensed US yards.
- **EN/ES is built in.** There's a real EN/ES language toggle in the dashboard and on the marketing site. The product already supports Spanish, so our materials ship EN and ES.

Anything below marked **[CONFIRM]** is something the code didn't make 100% certain and the founders should verify before sending.

---

# 1. Welcome email (send the moment they sign up)

This replaces nothing in code yet. Today the only automatic email is the waitlist "you're on the list" confirmation (`api/waitlist/route.ts`). This is the email to send the moment a yard gets real access to the app.

**[CONFIRM]** Whether the recipient at this point has live app access or is still waitlist/pilot. The draft below assumes they can log in now. If they're still waitlisted, send the "pilot invite is coming" note instead and hold this one until access is live.

### EN — Welcome

**Subject:** Your Ahlam is ready. Let's get your first part listed in 15 minutes.

Hi {{first_name or shop_name}},

Welcome to Ahlam. You're set up. Here's the only thing that matters today: get one real part listed and out to buyers. It takes about 15 minutes, and once you've done it once, the rest of your yard is just repeating it.

The short version:

1. **Snap photos of a part** (and the VIN plate if you can see it).
2. **Let the scan run.** Ahlam reads the VIN, identifies the part, and fills in a listing with a suggested price.
3. **Review the card.** Check the part name and the price. You're the expert; change anything that looks off.
4. **Post it.** One click to eBay, or copy-and-post to Facebook, OfferUp, and Craigslist.

That's it. That's the whole loop.

Start here: {{app_login_link}}

When you get to posting, the magic moment is sending one part to eBay and Facebook at the same time and watching it go live in both places. Try that with your first part.

Two quick things:
- The price Ahlam suggests is a smart starting point you review, not a fixed number. Trust your gut and adjust.
- Want to post to Facebook, OfferUp, or Craigslist with the fields filled in for you on your computer? Install the free Ahlam Auto-Poster (one-time, ~30 seconds). It fills the form; you always review and click Publish yourself. Link is in the app under Export & posting.

Hit reply if anything is confusing. A real person reads these.

Welcome aboard,
Mohammad and Andy
Ahlam

### ES — Bienvenida (brief)

**Asunto:** Tu Ahlam ya está listo. Pongamos tu primera pieza en venta en 15 minutos.

Hola {{first_name or shop_name}},

Bienvenido a Ahlam. Ya está todo configurado. Hoy solo importa una cosa: publicar una pieza real y ponerla frente a los compradores. Toma unos 15 minutos, y cuando lo haces una vez, el resto del yarda es solo repetir lo mismo.

En corto:

1. **Toma fotos de una pieza** (y de la placa del VIN si la puedes ver).
2. **Deja correr el escaneo.** Ahlam lee el VIN, identifica la pieza y arma el anuncio con un precio sugerido.
3. **Revisa la tarjeta.** Verifica el nombre de la pieza y el precio. Tú eres el experto; cambia lo que no cuadre.
4. **Publícala.** Un clic a eBay, o copiar y pegar a Facebook, OfferUp y Craigslist.

Eso es todo. Ese es el ciclo completo.

Empieza aquí: {{app_login_link}}

El precio que sugiere Ahlam es un buen punto de partida que tú revisas, no un número fijo. Ajústalo con tu criterio.

¿Quieres responder en español? Solo contesta este correo. Una persona real lo lee.

Bienvenido,
Mohammad y Andy
Ahlam

---

# 2. "Your first 15 minutes" quick-start checklist

The shortest path to first listings live. Drop this into the app as a checklist, the welcome email, or a one-page PDF. Keep it to one screen.

### EN — Your first 15 minutes

The goal: one part listed and live before you put your phone down.

- [ ] **Log in** at {{app_login_link}}.
- [ ] **Pick one part you actually want to sell today.** Don't try to do the whole yard. One good part.
- [ ] **Take the photos.** Get a clear shot of the part, and if you can, a clear shot of the **VIN plate**. The VIN is what makes the scan accurate.
- [ ] **Run the scan.** Ahlam reads the VIN, names the part, and suggests a price. Give it a few seconds.
- [ ] **Review the card.** Two things to check: is the **part name right**, and is the **price reasonable**? Fix anything off. You always have the final say.
- [ ] **Post it.**
  - eBay: connect your eBay account once, then click **List on eBay automatically.**
  - Facebook / OfferUp / Craigslist: click **Post elsewhere**, and either paste it in yourself or let the Ahlam Auto-Poster fill the form for you (you click Publish).
- [ ] **You did it.** That's the loop. Now do four more this week and you'll have a feel for it.

Stuck on any step? Reply to your welcome email. We answer fast.

### ES — Tus primeros 15 minutos

La meta: una pieza publicada y en vivo antes de soltar el teléfono.

- [ ] **Inicia sesión** en {{app_login_link}}.
- [ ] **Elige una sola pieza** que de verdad quieras vender hoy. No intentes hacer todo el yarda. Una buena pieza.
- [ ] **Toma las fotos.** Una foto clara de la pieza y, si puedes, una foto clara de la **placa del VIN**. El VIN es lo que hace que el escaneo sea preciso.
- [ ] **Corre el escaneo.** Ahlam lee el VIN, nombra la pieza y sugiere un precio. Dale unos segundos.
- [ ] **Revisa la tarjeta.** Dos cosas: ¿está bien el **nombre de la pieza** y es **razonable el precio**? Corrige lo que no cuadre. La última palabra siempre es tuya.
- [ ] **Publícala.**
  - eBay: conecta tu cuenta de eBay una vez y haz clic en **Publicar en eBay automáticamente.**
  - Facebook / OfferUp / Craigslist: haz clic en **Publicar en otro lugar** y pégalo tú mismo, o deja que el Ahlam Auto-Poster llene el formulario por ti (tú haces clic en Publicar).
- [ ] **Lo lograste.** Ese es el ciclo. Ahora haz cuatro más esta semana y le tomarás el ritmo.

¿Atorado? Responde a tu correo de bienvenida. Contestamos rápido.

---

# 3. Activation nudge sequence

The funnel truth: people stall right after signup, and again around day three. These nudges exist to get them to first listing, then to a habit. Keep each one short. Where a person has already listed a part, **skip the nudge** for that milestone (don't tell someone who's active that they haven't started).

**[CONFIRM]** We can only branch these on real behavior if the app exposes "has this yard posted a listing yet?" There's a `listings` table and usage tracking (`api/usage`, `api/listings`), so the signal exists. Founders/Quinn: confirm we can query "first listing posted? yes/no" per shop so these sends are behavior-aware, not just time-based.

### Day 0 — Welcome (immediate)
Use the full welcome email in section 1. One job: get them into the app and through the first loop.

### Day 1 — Check-in (about 24 hours later)

Branch on behavior:
- **If they have NOT posted a listing yet** → send the nudge below.
- **If they HAVE** → send the "nice, here's the multiplier" variant instead.

**Subject (not listed yet):** One part. 15 minutes. Want me to walk you through it?

Hi {{first_name}},

Quick check-in. The hardest part of Ahlam is the first listing, and after that it's easy. If you've got 15 minutes, grab one part, snap a photo of it and the VIN plate, and let the scan do the heavy lifting.

Here's the 15-minute checklist: {{checklist_link}}

If something got in the way, just reply and tell me what. I'll get you unstuck.

Mohammad and Andy

**Subject (already listed):** You posted your first part. Here's the trick that saves the most time.

Hi {{first_name}},

Nice work getting your first part up. Here's where Ahlam starts paying for itself: post one part to eBay and Facebook at the same time. Connect eBay once, then use "Post elsewhere" for the rest. Same part, two markets, almost no extra effort.

Try it on your next one.

Mohammad and Andy

### Day 3 — Stall-buster (where people give up)

Send only if they still haven't posted a listing.

**Subject:** Is something in the way? (honest question)

Hi {{first_name}},

You signed up but I don't see a first listing yet, and that usually means one of three things got in the way:

- **The photos or scan felt fiddly.** Tip: one clear shot of the part plus a clear shot of the VIN plate is all the scan really needs.
- **You weren't sure about the price.** It's just a starting number. Change it to whatever you'd actually sell it for.
- **Posting looked like a lot of steps.** eBay is one click after you connect it once. For Facebook/OfferUp/Craigslist the Auto-Poster fills the form for you.

Tell me which one it was (or that it was none of these) and I'll make it easy. Five minutes of your time and I think you'll see why yards stick with this.

Mohammad and Andy

### Week 1 — "Scan 5 parts this week" goal (about day 7)

This builds the habit. Send to anyone who's listed at least one part; soften it for anyone who hasn't yet.

**Subject:** This week's goal: 5 parts scanned

Hi {{first_name}},

A quick goal that turns Ahlam from "tried it" into "use it every day": **scan 5 parts this week.** Five is enough to feel the rhythm of photo → scan → review → post, and to see listings showing up across your channels.

Pick five parts you'd sell anyway. Knock them out in one session. Then tell me how long it took, I'm curious.

If you want to go faster, the CSV exports can bulk-list a batch at once (including a Car-Part.com / URG feed for the wholesale buyers).

Mohammad and Andy

**[CONFIRM]** "5 parts this week" is a Cora-chosen activation target, not a number from the product. Founders: confirm 5 is the right bar, or set your own.

---

# 4. Help-doc / FAQ entries (first questions a non-technical owner hits)

Short, plain, reassuring. These can live in a Help page or get pasted into a reply.

### How does the scanning work?

You take photos of a part. Ahlam's AI reads the VIN off the photo (if it can see the VIN plate), figures out the exact year/make/model, and identifies the part. Then it fills in a listing for you: the part name, a description, a condition grade, and a suggested price. You review it and fix anything before it goes anywhere. The clearer your VIN-plate photo, the better everything else comes out.

### Is the suggested price right?

Think of it as a smart starting point, not a final number. Ahlam estimates what the part costs new, then adjusts for how old the vehicle is and the condition grade (A, B, or C) to land on a used price. Each price also shows a confidence level, and it's lower when Ahlam couldn't pin down the model year. You're the expert. If your gut says a number, use your number. The price is yours to change on every listing.

### How do I post and cross-post to other marketplaces?

- **eBay:** Connect your eBay account once. After that, one click posts a listing to eBay automatically through eBay's official system.
- **Facebook Marketplace, OfferUp, Craigslist:** These don't allow automatic posting, so Ahlam copies your listing text and saves your photos, then opens the post form for you to finish. If you install the free **Ahlam Auto-Poster** browser extension on your computer, it goes further and fills in the title, price, description, and photos for you. You always review and click Publish yourself. Nothing posts on its own.
- **On your phone:** Ahlam hands the listing and photos to the marketplace's app using your phone's share button.
- **Lots of parts at once:** Use the CSV exports to bulk-list, including a Car-Part.com / URG feed for wholesale repair-shop buyers.

The crowd-pleaser: pick a part and send it to eBay and Facebook at the same time. Same work, two markets.

### Will the Auto-Poster post things without me?

No. The extension fills the form so you don't have to type. You review every listing and click Publish yourself. It never publishes on its own, on any site.

### Is my data safe?

Short version: your listings and photos are yours. The Ahlam Auto-Poster extension only runs on ahlam.io and the marketplace post pages, it takes a listing's text and photos to fill the form, and then clears that staged data. It doesn't send your data anywhere else.

**[CONFIRM]** Before publishing the data-safety answer, founders should confirm the high-level wording matches the actual privacy policy (`web/src/app/privacy`). The extension's own privacy note is in `extension/README.md`; the sentence above is drawn from it. Keep this answer high-level and accurate rather than detailed.

### Can I use Ahlam in Spanish?

Yes. There's an EN/ES toggle in the app (and on the website). Switch any time. You can also just reply to us in Spanish and we'll answer in Spanish.

---

# 5. Note to the co-founders: what to automate, and what Quinn should build into the product

### Send these automatically (email automation, low lift)

Right now the only automatic email is the waitlist confirmation (`api/waitlist/route.ts`, via Gmail SMTP in `lib/mailer.ts`). The activation sequence should be automated on top of that same sender, triggered by signup and by behavior:

1. **Day 0 welcome** — fire on real app access (not just waitlist join). Highest-leverage automation; do this first.
2. **Day 1 check-in** — branch on "has this yard posted a listing?"
3. **Day 3 stall-buster** — send only to yards with zero listings.
4. **Week 1 "scan 5 parts" goal** — send to anyone past day 7; soften for non-activators.

These four are a clean drip sequence. The only thing they need that doesn't exist yet is the **"has this shop posted its first listing?" signal**, wired to the email trigger.

### Flag to Quinn — things the product should do instead of (or alongside) a manual email

- **First-listing milestone signal.** The whole behavior-aware sequence depends on a per-shop "has posted ≥1 listing" flag the email system can read. The data exists (`listings`, `api/usage`); it needs to be exposed as a trigger. Highest priority.
- **In-app first-run checklist.** The strongest activation lever isn't an email, it's an in-product "Your first 15 minutes" checklist that appears on first login and ticks off photo → scan → review → post. There's an `api/onboarding` route already; worth checking what it does and whether it can drive this. Most yards activate or churn before they open an email.
- **First-listing celebration + the cross-post nudge in-app.** The moment a yard posts its first part, show "post this same part to Facebook/eBay too" right there. That's the aha moment; catching it in the product beats catching it a day later in email.
- **Auto-Poster install prompt at the right moment.** Surface the extension install exactly when a user first clicks "Post elsewhere" on desktop, not buried in a settings page.
- **VIN-photo coaching at capture.** Since scan accuracy and price confidence both hinge on a readable VIN plate, a gentle in-capture hint ("add a VIN-plate shot for a more accurate scan") would lift activation quality more than any email can.

### Recurring-issue watch (route to Quinn as they show up)

From the issue tracker (`ahlam-issues.md`), the things most likely to generate early support tickets and dent first-session trust: pricing that ignores trim/variant on price-sensitive parts (PRC-1), inflated commodity/core pricing (PRC-2), parts lacking their own photos (PHO-1), and the Craigslist hand-off giving no clear confirmation (CHN-2). Several are marked done; I'll watch onboarding conversations for these specifically and flag live recurrences to Quinn with examples.

### Reminder on guardrails

Cora drafts; the co-founders send. Nothing here was sent, committed, or wired into the live app. Items marked **[CONFIRM]** need a founder decision before they go out.
