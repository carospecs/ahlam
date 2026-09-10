const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export function cronRequestAuthorized(secret, authorization) {
  return typeof secret === "string" && secret.length >= 32 && authorization === `Bearer ${secret}`;
}

// Keep the storefront URL in the saved draft even if the public site is later
// served from a different host. shop-subdomains.test.mjs checks these IDs
// against the same registry that middleware uses.
export const CLIENT_STOREFRONTS = {
  "159c4cdc-3cbc-4061-9942-5c901486df49": "https://downtownautodismantlers.ahlam.io",
  "9e40bef8-f3d4-4f5a-bc99-b01af1053499": "https://aaconautoparts.ahlam.io",
  "de61192c-a92a-4c6c-a8be-d26eb0891dfa": "https://avalancheautowrecking.ahlam.io",
  "82e638d7-7c4c-467a-97b1-baa5c7a71332": "https://speedyautowrecking.ahlam.io",
  "555bb92c-64a2-4092-a1fd-0024cedaed6b": "https://aandbautosalvage.ahlam.io",
  "749da208-9fa9-466a-a6d0-eca31cde97aa": "https://elapacheautowrecking.ahlam.io",
};

function zonedParts(now, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function marketingWindow(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const p = zonedParts(now, timeZone);
  const localDate = `${p.year}-${p.month}-${p.day}`;
  return {
    due: (p.weekday === "Mon" || p.weekday === "Fri") && Number(p.hour) === 9,
    localDate,
    slotKey: `${localDate}:facebook`,
    weekday: p.weekday,
    hour: Number(p.hour),
    timeZone,
  };
}

/** Daily Ahlam company-page window. Two Vercel cron entries call the route at
 *  16:05 and 17:05 UTC; this local-time gate makes exactly one of them due at
 *  9 AM Pacific through daylight-saving changes. */
export function linkedinWindow(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const p = zonedParts(now, timeZone);
  const localDate = `${p.year}-${p.month}-${p.day}`;
  return {
    due: Number(p.hour) === 9,
    localDate,
    slotKey: `${localDate}:linkedin`,
    weekday: p.weekday,
    hour: Number(p.hour),
    timeZone,
  };
}

const active = (status) => ["active", "posted"].includes(String(status || "").toLowerCase());
const photoList = (row) => [...new Set([
  row?.photo_url,
  ...(Array.isArray(row?.photo_urls) ? row.photo_urls : []),
].filter((url) => typeof url === "string" && /^https?:\/\//.test(url)))];

const vehicleLabel = (vehicle) => [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
  .filter(Boolean).join(" ").trim();

/** Pick one truthful, postable item. Whole cars win; otherwise use a real part. */
export function selectMarketingCandidate({ vehicles = [], listings = [], usedSourceKeys = [] }) {
  const used = new Set(usedSourceKeys);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const wholeCars = vehicles
    .filter((v) => active(v.status) && ["whole", "both"].includes(v.sell_mode) && photoList(v).length)
    .map((v) => ({
      type: "vehicle",
      sourceKey: `vehicle:${v.id}`,
      vehicle: v,
      listing: null,
      photos: photoList(v),
      label: vehicleLabel(v),
      price: Number(v.asking_price) || null,
      updatedAt: v.updated_at || v.created_at || "",
    }));

  const parts = listings
    .filter((l) => active(l.status) && photoList(l).length && Number(l.price_usd) > 0)
    .map((l) => {
      const vehicle = vehicleById.get(l.vehicle_id) || null;
      const details = l.corrected || l.ai_output || {};
      const partName = details.partName || details.part_name || "Auto part";
      return {
        type: "part",
        sourceKey: `listing:${l.id}`,
        vehicle,
        listing: l,
        photos: photoList(l),
        label: [vehicle ? vehicleLabel(vehicle) : "", partName].filter(Boolean).join(" — "),
        partName,
        grade: details.condition || "B",
        price: Number(l.price_usd),
        updatedAt: l.updated_at || l.created_at || "",
      };
    });

  const ranked = [...wholeCars, ...parts].sort((a, b) => {
    const freshA = used.has(a.sourceKey) ? 0 : 1;
    const freshB = used.has(b.sourceKey) ? 0 : 1;
    if (freshA !== freshB) return freshB - freshA;
    if (a.type !== b.type) return a.type === "vehicle" ? -1 : 1;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  return ranked[0] || null;
}

function money(value) {
  return Number(value) > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : null;
}

export function fallbackMarketingDraft({ shop, candidate, storefrontUrl }) {
  const price = money(candidate.price);
  if (candidate.type === "vehicle") {
    const title = `${candidate.label} now available`;
    const facts = [candidate.vehicle.color, candidate.vehicle.body, candidate.vehicle.mileage]
      .filter(Boolean).join(" · ");
    const body = [
      `Now available at ${shop.name}: ${candidate.label}.`,
      facts || null,
      price ? `Asking ${price}.` : "Message us for current pricing.",
      `See the vehicle and contact ${shop.name}: ${storefrontUrl}`,
    ].filter(Boolean).join("\n\n");
    return { headline: title, body, hashtags: ["UsedCars", "AutoRecycling", "Ahlam"] };
  }

  const title = `${candidate.partName} for ${candidate.vehicle ? vehicleLabel(candidate.vehicle) : "your vehicle"}`;
  const body = [
    `${candidate.partName} now available from ${shop.name}.`,
    candidate.vehicle ? `Removed from a ${vehicleLabel(candidate.vehicle)}.` : null,
    `Condition grade ${String(candidate.grade || "B").toUpperCase()}${price ? ` · ${price}` : ""}.`,
    `See the listing and contact ${shop.name}: ${storefrontUrl}`,
  ].filter(Boolean).join("\n\n");
  return { headline: title, body, hashtags: ["UsedAutoParts", "AutoRecycling", "Ahlam"] };
}

/** Fact-only company-page copy. This is intentionally different from the
 *  marketplace draft: Ahlam is speaking, the client is credited, and the
 *  public storefront is the call to action. */
export function fallbackLinkedInDraft({ shop, candidate, storefrontUrl }) {
  const price = money(candidate.price);
  const item = candidate.type === "vehicle"
    ? candidate.label
    : `${candidate.partName}${candidate.vehicle ? ` from a ${vehicleLabel(candidate.vehicle)}` : ""}`;
  const availability = price ? `It is listed at ${price}.` : "Contact the shop for current pricing.";
  const headline = `Client inventory spotlight: ${shop.name}`;
  const body = [
    `${shop.name} currently lists ${item} in its live inventory.`,
    availability,
    "Ahlam helps independent auto dismantlers turn real inventory into a searchable website, practical pricing assistance, and cross-listing-ready content without retyping the same details.",
    `See what is currently available from ${shop.name}: ${storefrontUrl}`,
  ].join("\n\n");
  return {
    headline,
    body,
    hashtags: ["AutoRecycling", "UsedAutoParts", "SalvageYard", "Ahlam"],
  };
}

export function parseAgentDraft(raw, fallback, requiredNames = []) {
  if (!raw) return fallback;
  try {
    const fenced = String(raw).match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || String(raw);
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start < 0 || end <= start) return fallback;
    const parsed = JSON.parse(fenced.slice(start, end + 1));
    const headline = String(parsed.headline || "").trim().slice(0, 150);
    const body = String(parsed.body || "").trim().slice(0, 1600);
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((x) => String(x).replace(/^#/, "").trim()).filter(Boolean).slice(0, 5)
      : fallback.hashtags;
    if (!headline || !body) return fallback;
    if (requiredNames.some((name) => name && !`${headline} ${body}`.toLowerCase().includes(name.toLowerCase()))) return fallback;
    if (/\b(?:guaranteed|flawless|perfect condition)\b/i.test(body)) return fallback;
    return { headline, body, hashtags };
  } catch {
    return fallback;
  }
}

function cleanHashtags(hashtags = []) {
  return [...new Set((Array.isArray(hashtags) ? hashtags : [])
    .map((tag) => String(tag).replace(/^#/, "").trim())
    .filter(Boolean))].slice(0, 5);
}

function hashtagsFromDescription(description) {
  return cleanHashtags([...String(description || "").matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)]
    .map((match) => match[1]));
}

export function marketingDescription(body, hashtags = []) {
  const tags = cleanHashtags(hashtags);
  return [String(body || "").trim(), tags.length ? tags.map((tag) => `#${tag}`).join(" ") : null]
    .filter(Boolean).join("\n\n");
}

/** Preserve the generated hashtags when a founder edits a draft's copy. */
export function mergeDraftPayload(existingPayload = {}, { headline, body } = {}) {
  const payload = { ...(existingPayload || {}) };
  const hashtags = cleanHashtags(payload.hashtags).length
    ? cleanHashtags(payload.hashtags)
    : hashtagsFromDescription(payload.description || payload.text);
  if (headline != null) payload.title = String(headline);
  if (body != null) {
    payload.body = String(body);
    payload.hashtags = hashtags;
    payload.description = marketingDescription(body, hashtags);
    payload.text = payload.description;
  }
  return payload;
}

export function extensionPayload({ shop, candidate, draft }) {
  const description = marketingDescription(draft.body, draft.hashtags);
  const base = {
    title: draft.headline,
    price: candidate.price || "",
    body: draft.body,
    hashtags: cleanHashtags(draft.hashtags),
    description,
    text: description,
    photos: candidate.photos,
    location: shop.location || "",
    condition: candidate.type === "vehicle" ? "Used - Good" : "Used - Good",
    category: candidate.type === "vehicle" ? "Vehicles" : "Auto parts",
  };
  if (candidate.type !== "vehicle") return base;
  const v = candidate.vehicle;
  return {
    ...base,
    kind: "vehicle",
    vehicleType: "Car/Truck",
    year: v.year || "",
    make: v.make || "",
    model: v.model || "",
    trim: v.trim || "",
    mileage: String(v.mileage || "").replace(/[^0-9]/g, ""),
    bodyStyle: v.body || "",
    exteriorColor: v.color || "",
  };
}

export function linkedinPayload({ shop, candidate, draft, storefrontUrl }) {
  return {
    title: draft.headline,
    body: draft.body,
    hashtags: cleanHashtags(draft.hashtags),
    text: marketingDescription(`${draft.headline}\n\n${draft.body}`, draft.hashtags),
    imageUrl: candidate.photos[0] || null,
    imageAlt: `${candidate.label} available from ${shop.name}`.slice(0, 300),
    storefrontUrl,
    sourceLabel: candidate.label,
    kind: candidate.type,
  };
}
