// Static subdomain -> shop id map, so a shop's page is reachable at
// https://<slug>.ahlam.io instead of the raw /shop/<uuid> link.
// Read by middleware.ts to rewrite the request to /shop/[id].
//
// Add a shop here any time you want it to get a subdomain; no DB migration
// needed. Keep slugs lowercase, hyphen-free (DNS labels only).
export const SHOP_SUBDOMAINS: Record<string, string> = {
  // Points at the yard's real shop record (owned by their actual login,
  // downtownautodismantling@gmail.com) — not the placeholder account/shop
  // this file originally seeded, which Andy correctly deleted as a dupe
  // during the ultimate-personal-sites work (PR #51, 2026-08-11).
  downtownautodismantlers: "159c4cdc-3cbc-4061-9942-5c901486df49",
  aaconautoparts: "b696bcc7-10e9-4f01-ad49-56f9fe5eb25b",
  avalancheautowrecking: "de61192c-a92a-4c6c-a8be-d26eb0891dfa",
  speedyautowrecking: "82e638d7-7c4c-467a-97b1-baa5c7a71332",
  aandbautosalvage: "555bb92c-64a2-4092-a1fd-0024cedaed6b",
  elapacheautowrecking: "749da208-9fa9-466a-a6d0-eca31cde97aa",
};

// Reverse map (shop id -> slug), built once at module scope for O(1) lookups.
const SLUG_BY_SHOP_ID: Record<string, string> = Object.fromEntries(
  Object.entries(SHOP_SUBDOMAINS).map(([slug, id]) => [id, slug]),
);

/** Reverse lookup: shop UUID -> its static subdomain slug, or null. */
export function slugForShopId(id: string): string | null {
  return SLUG_BY_SHOP_ID[id] ?? null;
}
