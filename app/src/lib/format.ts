import type { CorrectedListing } from "@carospecs/shared";
import type { Shop } from "@/lib/auth";

/**
 * Build the marketplace-ready listing text. Used both when saving and when
 * exporting (copy / share). Plain text so it pastes cleanly into Facebook
 * Marketplace, OfferUp, etc.
 */
export function buildListingText(
  listing: Pick<
    CorrectedListing,
    "partName" | "condition" | "conditionNotes" | "description" | "priceUsd" | "fitment"
  >,
  shop?: Pick<Shop, "name" | "location" | "business_phone"> | null
): string {
  const lines: string[] = [];
  lines.push(listing.partName);
  if (listing.fitment.length) {
    const fits = listing.fitment
      .map((f) => `${f.yearStart}–${f.yearEnd} ${f.make} ${f.model}`.trim())
      .join(", ");
    lines.push(`Fits: ${fits}`);
  }
  lines.push(
    `Condition: ${listing.condition}${
      listing.conditionNotes ? ` — ${listing.conditionNotes}` : ""
    }`
  );
  if (listing.description) lines.push("", listing.description);
  if (listing.priceUsd > 0) lines.push("", `Price: $${listing.priceUsd}`);

  if (shop) {
    const tail = [shop.name, shop.location, shop.business_phone]
      .filter(Boolean)
      .join(" • ");
    if (tail) lines.push("", `— ${tail}`);
  }
  return lines.join("\n");
}
