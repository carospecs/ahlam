// Automated welcome email, sent the moment a shop is created (api/onboarding).
// Copy source of truth: docs/onboarding/ONBOARDING_KIT.md (Cora's kit, founder
// reviewed). Bilingual in one message: full EN, condensed ES below the divider.
// Copy rule: no em dashes in any user-facing string.

export const ONBOARDING_FROM =
  process.env.ONBOARDING_FROM_EMAIL || "Ahlam <andygarcia@ahlam.io>";
export const ONBOARDING_CC =
  process.env.ONBOARDING_CC_EMAIL || "mohammadabbas@ahlam.io";

export function buildWelcomeEmail(opts: { name: string; appUrl: string }): {
  subject: string;
  text: string;
} {
  const { name, appUrl } = opts;
  const subject = "Your Ahlam is ready. Let's get your first part listed in 15 minutes.";
  const text = `Hi ${name},

Welcome to Ahlam. You're set up. Here's the only thing that matters today: get one real part listed and out to buyers. It takes about 15 minutes, and once you've done it once, the rest of your yard is just repeating it.

The short version:

1. Snap photos of a part (and the VIN plate if you can see it).
2. Let the scan run. Ahlam reads the VIN, identifies the part, and fills in a listing with a suggested price from real market comps.
3. Review the card. Check the part name and the price. You're the expert; change anything that looks off.
4. Post it. One click to eBay, or copy-and-post to Facebook and OfferUp. (Craigslist, Car-Part.com, and DoorDash delivery are coming soon.)

That's it. That's the whole loop.

Start here: ${appUrl}

When you get to posting, the magic moment is sending one part to eBay and Facebook at the same time and watching it go live in both places. Try that with your first part.

Two quick things:
- The price Ahlam suggests is a smart starting point you review, not a fixed number. Trust your gut and adjust.
- Want to post to Facebook or OfferUp with the fields filled in for you on your computer? Install the free Ahlam Auto-Poster (one-time, about 30 seconds). It fills the form; you always review and click Publish yourself. The link is in the app under Export & posting.

Hit reply if anything is confusing. A real person reads these.

Welcome aboard,
Mohammad and Andy
Ahlam

----------------------------------------

Hola ${name},

Bienvenido a Ahlam. Ya está todo configurado. Hoy solo importa una cosa: publicar una pieza real. Toma unos 15 minutos.

En corto: toma fotos de una pieza (y de la placa del VIN), deja correr el escaneo, revisa el nombre y el precio sugerido, y publícala con un clic a eBay o copiando a Facebook y OfferUp. (Craigslist, Car-Part.com y la entrega con DoorDash llegan pronto.)

Empieza aquí: ${appUrl}

¿Prefieres español? Solo contesta este correo. Una persona real lo lee.

Bienvenido,
Mohammad y Andy
Ahlam`;
  return { subject, text };
}
