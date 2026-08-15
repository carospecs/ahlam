import { effectiveWarranty } from "@/lib/warranty";

export const CONDITION_COLOR: Record<string, string> = { A: "#22C55E", B: "#84CC16", C: "#EAB308", D: "#F97316", F: "#EF4444" };

export interface Vehicle {
  id: string; year: string; make: string; model: string; trim: string;
  body: string; vin: string; color: string; added: string; photos: number;
  parts: number; value: number; listed: number; sold: number;
  sellMode: string; askingPrice: number | null; mileage: string;
}

export interface Part {
  id: string; name: string; grade: string; price: number; note: string; warn: boolean;
}

export interface Listing {
  id: string; part: string; vehicle: string; grade: string; price: number;
  status: string; markets: string[]; views: number; photos: number;
  fitment: string; category: string; confidence: string;
  note: string; desc: string;
  /** Warranty length in days (0/30/60/90); null = use the shop default. */
  warrantyDays?: number | null;
  /** Sold as-is, no returns (overrides warranty). */
  asIs?: boolean;
}

export interface Thread {
  id: string; name: string; market: string; part: string;
  unread: number; time: string; avatar: string;
  messages: { from: string; text: string; time: string }[];
}

export interface Activity {
  icon: string; text: string; time: string; tone: string;
}

/** Accept both API-friendly labels (Posted/Sold) and database enum values. */
export function statusIs(value: unknown, expected: "draft" | "posted" | "sold" | "active"): boolean {
  const status = String(value ?? "").trim().toLowerCase();
  return expected === "posted" ? status === "posted" || status === "active" : status === expected;
}

export const VEHICLES: Vehicle[] = [
  { id: "v1", year: "2014", make: "Honda", model: "Accord", trim: "EX-L", body: "Sedan", vin: "1HGCR2F8XEA •••••", color: "Modern Steel", added: "2 days ago", photos: 6, parts: 9, value: 1240, listed: 7, sold: 1, sellMode: "parts", askingPrice: null, mileage: "112k mi" },
  { id: "v2", year: "2013", make: "Ford", model: "F-150", trim: "XLT", body: "Pickup", vin: "1FTFW1ET5DF •••••", color: "Oxford White", added: "3 days ago", photos: 5, parts: 12, value: 2310, listed: 10, sold: 3, sellMode: "both", askingPrice: 4200, mileage: "148k mi" },
  { id: "v3", year: "2016", make: "Toyota", model: "Camry", trim: "LE", body: "Sedan", vin: "4T1BF1FK0GU •••••", color: "Celestial Silver", added: "5 days ago", photos: 6, parts: 7, value: 890, listed: 6, sold: 2, sellMode: "whole", askingPrice: 3800, mileage: "96k mi" },
  { id: "v4", year: "2015", make: "Subaru", model: "Forester", trim: "2.5i", body: "SUV", vin: "JF2SJADC0FH •••••", color: "Dark Gray", added: "1 week ago", photos: 4, parts: 8, value: 1050, listed: 8, sold: 4, sellMode: "parts", askingPrice: null, mileage: "131k mi" },
  { id: "v5", year: "2017", make: "Nissan", model: "Altima", trim: "SV", body: "Sedan", vin: "1N4AL3AP4HC •••••", color: "Gun Metallic", added: "1 week ago", photos: 5, parts: 6, value: 720, listed: 5, sold: 5, sellMode: "both", askingPrice: 2900, mileage: "104k mi" },
];

export const DEMO_VEHICLE = { year: "2014–2017", make: "Honda", model: "Accord", trim: "EX-L", body: "Sedan, 4-door", vin: "1HGCR2F8XEA047219", confidence: "high" };

export const DEMO_PARTS: Part[] = [
  { id: "p1", name: "Front Bumper Cover", grade: "B", price: 180, note: "Minor scuffs, no cracks", warn: false },
  { id: "p2", name: "Hood", grade: "B", price: 140, note: "Small dent driver side, paint still solid", warn: false },
  { id: "p3", name: "Left Headlight Assembly", grade: "B", price: 95, note: "Clear lens, tabs intact", warn: false },
  { id: "p4", name: "Right Headlight Assembly", grade: "B", price: 95, note: "Clear lens, tabs intact", warn: false },
  { id: "p5", name: "Grille (Chrome)", grade: "B", price: 60, note: "Clean, no broken clips", warn: false },
  { id: "p6", name: "Driver Front Door", grade: "C", price: 220, note: "Crease low on panel — verify fitment", warn: true },
  { id: "p7", name: "Passenger Mirror", grade: "B", price: 45, note: "Power, paint-matched", warn: false },
  { id: "p8", name: "Windshield", grade: "C", price: 0, note: "Cracked — scrap / recycle", warn: false },
  { id: "p9", name: "Alloy Wheel (set of 4)", grade: "B", price: 320, note: "17in, light curb rash", warn: false },
];

export const SHOP = { name: "Westside Auto Salvage", location: "Long Beach, CA", phone: "(562) 555-0148", owner: "Ray Delgado", role: "Owner", email: "ray@westsidesalvage.com", initials: "RD", members: [{ name: "Ray Delgado", role: "Owner", initials: "RD" }, { name: "Tomás Vega", role: "Editor", initials: "TV" }, { name: "Jordan Pace", role: "Viewer", initials: "JP" }], plan: "Pro", trialDaysLeft: 18 };

export const LISTINGS: Listing[] = [
  { id: "l1", part: "Front Bumper Cover", vehicle: "2014 Honda Accord", grade: "B", price: 180, status: "Posted", markets: ["Facebook", "OfferUp"], views: 142, photos: 3, fitment: "2013–2017 Honda Accord", category: "Body / Exterior", confidence: "high", note: "Minor scuffs, no cracks. Fog light brackets included, all tabs intact.", desc: "Factory front bumper cover pulled from a clean 2014 Accord EX-L. Paint is Modern Steel, no major rash. Mounting tabs and fog brackets all present. Local pickup or can help arrange shipping." },
  { id: "l2", part: "Tailgate Assembly", vehicle: "2013 Ford F-150", grade: "B", price: 410, status: "Posted", markets: ["Facebook", "eBay"], views: 318, photos: 4, fitment: "2009–2014 Ford F-150", category: "Body / Exterior", confidence: "high", note: "Inner lip clean, light surface wear on handle. Latch works smoothly.", desc: "Solid tailgate off a 2013 F-150 XLT. No rust on the inner lip, handle and latch both function. Oxford White. Heavy item — local pickup preferred." },
  { id: "l3", part: "Driver Front Door", vehicle: "2014 Honda Accord", grade: "C", price: 220, status: "Draft", markets: [], views: 0, photos: 2, fitment: "2013–2017 Honda Accord", category: "Body / Exterior", confidence: "low", note: "Crease low on panel — verify fitment before posting.", desc: "Driver front door shell, glass and regulator included. Low crease on the lower panel, otherwise straight. Power window tested good." },
  { id: "l4", part: "Alloy Wheel (set of 4)", vehicle: "2016 Toyota Camry", grade: "B", price: 280, status: "Posted", markets: ["OfferUp"], views: 96, photos: 5, fitment: "2015–2017 Toyota Camry", category: "Wheels / Tires", confidence: "high", note: "17in, all four true and balanced. Light curb rash on one.", desc: "Set of four 17\" factory alloys off a 2016 Camry LE. Balanced last week, all straight, no bends. One has light curb rash. No TPMS sensors." },
  { id: "l5", part: "Left Headlight Assembly", vehicle: "2015 Subaru Forester", grade: "B", price: 110, status: "Sold", markets: ["Facebook"], views: 204, photos: 2, fitment: "2014–2018 Subaru Forester", category: "Lighting", confidence: "high", note: "Clear lens, tabs intact, no moisture.", desc: "Driver side halogen headlight assembly. Lens is crystal clear, all mounting tabs intact. Bulbs included." },
  { id: "l6", part: "Hood", vehicle: "2017 Nissan Altima", grade: "C", price: 130, status: "Draft", markets: [], views: 0, photos: 2, fitment: "2013–2018 Nissan Altima", category: "Body / Exterior", confidence: "high", note: "Small dent driver side, light surface rust starting.", desc: "Hood off a 2017 Altima SV, Gun Metallic. Small dent on the driver side and surface rust beginning at the edge. Good core / repair candidate." },
  { id: "l7", part: "Grille (Chrome)", vehicle: "2014 Honda Accord", grade: "B", price: 60, status: "Posted", markets: ["Facebook", "OfferUp", "eBay"], views: 73, photos: 1, fitment: "2013–2015 Honda Accord", category: "Body / Exterior", confidence: "high", note: "Clean chrome, no broken clips.", desc: "Factory chrome grille for a 2013–2015 Accord. No broken clips or tabs, chrome is bright with no pitting." },
  { id: "l8", part: "Bed Liner", vehicle: "2013 Ford F-150", grade: "B", price: 150, status: "Sold", markets: ["Facebook"], views: 261, photos: 3, fitment: "2009–2014 Ford F-150 (5.5ft bed)", category: "Truck Bed", confidence: "high", note: "Drop-in liner, no cracks.", desc: "Drop-in bed liner for a 5.5ft F-150 bed. No cracks or warping, all hardware included." },
];

export function partsForVehicle(v: Vehicle) {
  const key = `${v.year} ${v.make} ${v.model}`;
  return LISTINGS.filter((l) => l.vehicle === key);
}

export function buildListingText(l: Listing, shop = SHOP) {
  const lines: string[] = [];
  lines.push(l.part);
  if (l.fitment) lines.push(`Fits: ${l.fitment}`);
  lines.push(`Condition: ${l.grade}${l.note ? ` — ${l.note}` : ""}`);
  // Trust line: the part was AI-identified and its fitment checked against the
  // vehicle's VIN. We never print the VIN itself (it stays private).
  if ((l as any).vin) lines.push("Fitment verified by Ahlam AI from the vehicle VIN.");
  if (l.desc) lines.push("", l.desc);
  if (l.price > 0) lines.push("", `Price: $${l.price}`);
  // Warranty / returns terms (WAR-1/2/4): the listing's own, else the shop default.
  const { days, asIs } = effectiveWarranty({ warrantyDays: l.warrantyDays, asIs: l.asIs }, (shop as any).defaultWarrantyDays);
  if (asIs) lines.push("", "Sold as-is — no returns.");
  else if (days) lines.push("", `Warranty: ${days}-day guarantee on this part.`);
  const returnsPolicy = (shop as any).returnsPolicy;
  if (returnsPolicy && !asIs) lines.push(String(returnsPolicy));
  const tail = [shop.name, shop.location, shop.phone].filter(Boolean).join(" • ");
  if (tail) lines.push("", `— ${tail}`);
  return lines.join("\n");
}

export function buildVehicleText(v: Vehicle, shop = SHOP) {
  const lines: string[] = [];
  lines.push(`${v.year} ${v.make} ${v.model} ${v.trim}`);
  lines.push(`${v.body} • ${v.color} • ${v.mileage}`);
  // Year/make/model came from the VIN, decoded by AI. VIN number stays private.
  if (v.vin) lines.push("Year, make and model verified by Ahlam AI from the VIN.");
  const desc = (v as any).description || "";
  if (desc) lines.push("", desc);
  lines.push("", "Mechanic-owned salvage vehicle. Clean parts car or project. Runs and drives — sold as-is.");
  if (v.askingPrice) lines.push("", `Asking: $${v.askingPrice.toLocaleString()}`);
  const tail = [shop.name, shop.location, shop.phone].filter(Boolean).join(" • ");
  lines.push("", `— ${tail}`);
  return lines.join("\n");
}

export const SELL_MODE: Record<string, { label: string; short: string; icon: string; color: string; desc: string }> = {
  parts: { label: "Parting out", short: "Parts only", icon: "Wrench", color: "var(--accent)", desc: "Sell individual parts. The car itself isn't listed." },
  whole: { label: "Whole car", short: "Whole car", icon: "Car", color: "var(--signal)", desc: "Sell the complete vehicle as one listing." },
  both: { label: "Car + parts", short: "Both", icon: "Layers", color: "var(--success)", desc: "List the whole car AND part it out — whichever sells first." },
};

export const THREADS: Thread[] = [
  { id: "t1", name: "Marcus T.", market: "Facebook", part: "Tailgate Assembly — 2013 F-150", unread: 2, time: "9:41 AM", avatar: "MT", messages: [{ from: "them", text: "Hey, is the F-150 tailgate still available?", time: "9:32 AM" }, { from: "them", text: "Any rust on the inside lip?", time: "9:33 AM" }, { from: "me", text: "Yes it's available! Inner lip is clean, just light surface wear on the handle. $410.", time: "9:38 AM" }, { from: "them", text: "Can you do $375? I can pick up today.", time: "9:41 AM" }] },
  { id: "t2", name: "Dana R.", market: "OfferUp", part: "Alloy Wheel (set of 4) — Camry", unread: 0, time: "Yesterday", avatar: "DR", messages: [{ from: "them", text: "Are all 4 wheels straight? No bends?", time: "Yesterday" }, { from: "me", text: "All 4 are true, balanced last week. Light curb rash on one. $280 firm.", time: "Yesterday" }, { from: "them", text: "Sounds good, I'll come by Saturday.", time: "Yesterday" }] },
  { id: "t3", name: "Luis G.", market: "eBay", part: "Front Bumper Cover — Accord", unread: 1, time: "Mon", avatar: "LG", messages: [{ from: "them", text: "Does the bumper come with the fog light brackets?", time: "Mon" }, { from: "me", text: "It does — both brackets included, no broken tabs.", time: "Mon" }, { from: "them", text: "Perfect. Shipping to 90011?", time: "Mon" }] },
  { id: "t4", name: "Priya S.", market: "Facebook", part: "Left Headlight — Forester", unread: 0, time: "Mon", avatar: "PS", messages: [{ from: "them", text: "Is the headlight still good? Lens not foggy?", time: "Mon" }, { from: "me", text: "Crystal clear, tabs intact. Sold one already, this is the last.", time: "Mon" }, { from: "them", text: "I'll take it. Thanks!", time: "Mon" }] },
];

export const ACTIVITY: Activity[] = [
  { icon: "ScanLine", text: "AI identified 9 parts on 2014 Honda Accord", time: "2d ago", tone: "accent" },
  { icon: "CircleCheck", text: "Bed Liner (F-150) marked sold — $150", time: "2d ago", tone: "success" },
  { icon: "Send", text: "Posted Grille to Facebook, OfferUp, eBay", time: "3d ago", tone: "muted" },
  { icon: "TriangleAlert", text: "Driver Door flagged low-confidence — review fitment", time: "3d ago", tone: "signal" },
  { icon: "MessageSquare", text: "New inquiry from Marcus T. on F-150 Tailgate", time: "4d ago", tone: "muted" },
];
