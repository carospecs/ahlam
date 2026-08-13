// EV PARTS INTERCHANGE v1 — curated, code-first cross-reference for the
// high-value EV components (packs, drive units, chargers, computers).
//
// WHY CURATED. Hollander-style interchange coverage for EVs is thin, and the AI
// path guesses. But the EV parc is small and platform-shaped: a few dozen
// hand-checked groups cover the vast majority of EV salvage lookups in the US.
// Curated answers are instant, free (no AI call), and editorially accountable —
// every group states its confidence and where the claim comes from.
//
// Style mirrors generations.ts: a static dataset + tiny resolvers, loadable by
// the plain-node test harness. Retrieval hints here are RETRIEVAL, not fitment
// gospel — check-part-number groups always carry a caveat.

import { normKey } from "./generations";

export type EvConfidence = "verified" | "probable" | "check-part-number";

export type EvPartFamily =
  | "hv_battery"
  | "drive_unit_rear"
  | "drive_unit_front"
  | "onboard_charger"
  | "dcdc_converter"
  | "charge_port"
  | "autopilot_computer"
  | "infotainment"
  | "thermal_module"
  | "battery_module";

export type EvApplication = {
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  /** Trim/spec qualifiers this application is limited to (e.g. ["Long Range", "Performance"]). */
  variants?: string[];
  note?: string;
};

export type EvInterchangeGroup = {
  /** Stable slug — referenced by tests and (later) analytics. Never recycle. */
  id: string;
  family: EvPartFamily;
  label: string;
  fits: EvApplication[];
  /** Things that decide fitment inside the group (chemistry, kW rating, hardware rev…). */
  constraints?: string[];
  /** OEM part-number prefixes/families, for "does the stamp match?" checks. */
  partNumberFamilies?: string[];
  confidence: EvConfidence;
  notes?: string;
  sources?: string[];
};

export type EvFitLine = {
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  /** "2017–2023 Tesla Model 3" */
  label: string;
  caveat?: string;
  confidence: EvConfidence;
};

// ── Part name → family ───────────────────────────────────────────────────────
// Modeled on powertrain.ts covers(): a bare "Battery" (or "12V Battery") is a
// low-voltage accessory battery and must NOT map to hv_battery.

const FAMILY_PATTERNS: ReadonlyArray<readonly [EvPartFamily, RegExp]> = [
  ["battery_module", /\bbattery\s?modules?\b/i],
  ["hv_battery", /\b(high.?voltage\s?battery|hv\s?battery|traction\s?battery|battery\s?pack)\b/i],
  ["drive_unit_front", /\bfront\b.*\b(drive\s?unit|motor)\b|\b(drive\s?unit|motor)\b.*\bfront\b/i],
  ["drive_unit_rear", /\brear\b.*\b(drive\s?unit|motor)\b|\b(drive\s?unit|motor)\b.*\brear\b/i],
  ["drive_unit_rear", /\b(drive\s?unit|traction\s?motor|drive\s?motor)\b/i], // unspecified DU → rear (most-common config)
  ["charge_port", /\bcharge\s?port|charging\s?port\b/i],
  ["onboard_charger", /\b(on.?board\s?charger|charger\s?(module|assembly)|obc|power\s?conversion\s?system|pcs|iccu)\b/i],
  ["dcdc_converter", /\b(dc.?dc|inverter)\b/i],
  ["autopilot_computer", /\b(autopilot|fsd|self.?driving|driver\s?assist)\s?(computer|ecu|module|unit)?\b/i],
  ["infotainment", /\b(infotainment|mcu\b|media\s?control\s?unit|touch\s?screen|touchscreen|center\s?display)\b/i],
  ["thermal_module", /\b(octovalve|super\s?manifold|heat\s?pump|thermal\s?management|coolant\s?valve\s?assembly)\b/i],
];

export function evFamilyFromPartName(partName: string): EvPartFamily | null {
  const name = String(partName || "");
  if (!name.trim()) return null;
  for (const [family, re] of FAMILY_PATTERNS) if (re.test(name)) return family;
  return null;
}

// ── Curated dataset ──────────────────────────────────────────────────────────
// Confidence is an editorial statement:
//   verified          — same OEM part family across the listed applications,
//                       corroborated by 2+ sources.
//   probable          — platform commonality strongly implies interchange, but
//                       we haven't pinned the part-number family.
//   check-part-number — revision-sensitive; interchange exists WITHIN a
//                       hardware/part-number revision only. Always caveated.
// Sources are provenance labels only (OEM catalogs, community teardowns) —
// never a licensed interchange database.

const app = (
  make: string,
  model: string,
  yearStart: number,
  yearEnd: number,
  note?: string,
  variants?: string[],
): EvApplication => ({ make, model, yearStart, yearEnd, ...(note ? { note } : {}), ...(variants ? { variants } : {}) });

const OEM = "OEM parts catalog";
const TMC = "community-verified (Tesla Motors Club / teardowns)";
const OPENINV = "community-verified (openinverter / EV-rebuild forums)";

export const EV_GROUPS: EvInterchangeGroup[] = [
  // ── Tesla Model 3 / Model Y (shared platform) ─────────────────────────────
  {
    id: "tesla-3y-rear-du",
    family: "drive_unit_rear",
    label: "Tesla Model 3 / Model Y rear PM drive unit (non-Performance)",
    fits: [
      app("Tesla", "Model 3", 2017, 2023, "SR/LR — pre-Highland"),
      app("Tesla", "Model Y", 2020, 2025),
    ],
    constraints: ["Non-Performance spec only — Performance rear units are a separate group"],
    partNumberFamilies: ["1120960-xx-x", "1120990-xx-x"],
    confidence: "verified",
    notes: "Same PMSRM rear drive-unit family across 3/Y; gear ratio identical.",
    sources: [OEM, TMC],
  },
  {
    id: "tesla-3y-rear-du-perf",
    family: "drive_unit_rear",
    label: "Tesla Model 3 / Model Y Performance rear drive unit",
    fits: [
      app("Tesla", "Model 3", 2018, 2023, undefined, ["Performance"]),
      app("Tesla", "Model Y", 2020, 2025, undefined, ["Performance"]),
    ],
    constraints: ["Performance-spec unit only — do not cross with base/LR rear units"],
    confidence: "probable",
    sources: [TMC],
  },
  {
    id: "tesla-3y-front-du",
    family: "drive_unit_front",
    label: "Tesla Model 3 / Model Y front induction drive unit (AWD/Performance)",
    fits: [
      app("Tesla", "Model 3", 2017, 2023, undefined, ["AWD", "Performance"]),
      app("Tesla", "Model Y", 2020, 2025, undefined, ["AWD", "Performance"]),
    ],
    partNumberFamilies: ["1120970-xx-x"],
    confidence: "verified",
    sources: [OEM, TMC],
  },
  {
    id: "tesla-3y-pack-lr-2170",
    family: "hv_battery",
    label: "Tesla Model 3 / Model Y Long Range 2170 NCA pack",
    fits: [
      app("Tesla", "Model 3", 2017, 2023, undefined, ["Long Range", "Performance"]),
      app("Tesla", "Model Y", 2020, 2025, undefined, ["Long Range", "Performance"]),
    ],
    constraints: [
      "Pack chemistry must match — 2170 NCA (LR/Performance) only, never cross with LFP SR packs",
      "Match pack part-number revision; BMS/penthouse revisions changed across years",
    ],
    confidence: "check-part-number",
    sources: [TMC, OPENINV],
  },
  {
    id: "tesla-3-pack-sr-lfp",
    family: "hv_battery",
    label: "Tesla Model 3 Standard Range LFP pack (2021+)",
    fits: [app("Tesla", "Model 3", 2021, 2023, "RWD/SR with LFP prismatic pack", ["Standard Range", "RWD"])],
    constraints: [
      "Pack chemistry must match — LFP (CATL prismatic) only, never cross with 2170 NCA packs",
      "Pre-2021 SR+ cars used a 2170 pack — year alone does not decide, check the part number",
    ],
    confidence: "check-part-number",
    sources: [TMC],
  },
  {
    id: "tesla-3y-pcs-charger",
    family: "onboard_charger",
    label: "Tesla Gen-3 onboard charger / PCS (Model 3 / Y, refreshed S / X)",
    fits: [
      app("Tesla", "Model 3", 2017, 2023),
      app("Tesla", "Model Y", 2020, 2025),
      app("Tesla", "Model S", 2021, 2025, "Palladium refresh"),
      app("Tesla", "Model X", 2021, 2025, "Palladium refresh"),
    ],
    constraints: ["PCS revision (charge rate / market) should match — verify part number"],
    confidence: "probable",
    notes: "Gen-3 Power Conversion System combines the AC charger and DC-DC in one module.",
    sources: [TMC, OPENINV],
  },
  {
    id: "tesla-3y-pcs-dcdc",
    family: "dcdc_converter",
    label: "Tesla Model 3 / Model Y DC-DC (integrated in PCS module)",
    fits: [
      app("Tesla", "Model 3", 2017, 2023),
      app("Tesla", "Model Y", 2020, 2025),
    ],
    constraints: ["DC-DC is part of the PCS assembly on these cars — swap the whole PCS, match revision"],
    confidence: "probable",
    sources: [TMC, OPENINV],
  },
  {
    id: "tesla-3y-charge-port",
    family: "charge_port",
    label: "Tesla Model 3 / Model Y charge port assembly (NACS)",
    fits: [
      app("Tesla", "Model 3", 2017, 2023),
      app("Tesla", "Model Y", 2020, 2025),
    ],
    constraints: ["Motorized charge-port door revisions differ — verify connector and harness plug"],
    confidence: "probable",
    sources: [TMC],
  },
  {
    id: "tesla-3y-octovalve",
    family: "thermal_module",
    label: "Tesla heat-pump thermal module (Octovalve / Super Manifold)",
    fits: [
      app("Tesla", "Model Y", 2020, 2025),
      app("Tesla", "Model 3", 2021, 2023, "Heat-pump cars only (2021+ refresh)"),
    ],
    constraints: ["Heat-pump cars only — 2017-2020 Model 3 uses a non-heat-pump thermal system"],
    confidence: "probable",
    sources: [TMC],
  },
  // Autopilot computers interchange WITHIN a hardware generation only.
  {
    id: "tesla-ap-hw25",
    family: "autopilot_computer",
    label: "Tesla Autopilot computer — HW2.5",
    fits: [
      app("Tesla", "Model S", 2017, 2019),
      app("Tesla", "Model X", 2017, 2019),
      app("Tesla", "Model 3", 2017, 2019, "Early cars, pre-HW3"),
    ],
    constraints: [
      "Hardware generation must match exactly (HW2.5) — never cross with HW3/HW4",
      "Computer is VIN-married; requires Tesla service/config work after swap",
    ],
    confidence: "check-part-number",
    sources: [TMC],
  },
  {
    id: "tesla-ap-hw3",
    family: "autopilot_computer",
    label: "Tesla Autopilot / FSD computer — HW3",
    fits: [
      app("Tesla", "Model S", 2019, 2023),
      app("Tesla", "Model X", 2019, 2023),
      app("Tesla", "Model 3", 2019, 2023),
      app("Tesla", "Model Y", 2020, 2023),
    ],
    constraints: [
      "Hardware generation must match exactly (HW3) — never cross with HW2.5/HW4",
      "Computer is VIN-married; requires Tesla service/config work after swap",
    ],
    confidence: "check-part-number",
    sources: [TMC],
  },
  {
    id: "tesla-ap-hw4",
    family: "autopilot_computer",
    label: "Tesla Autopilot / FSD computer — HW4",
    fits: [
      app("Tesla", "Model 3", 2024, 2026, "Highland"),
      app("Tesla", "Model Y", 2025, 2026, "Juniper"),
      app("Tesla", "Model S", 2023, 2026),
      app("Tesla", "Model X", 2023, 2026),
    ],
    constraints: [
      "Hardware generation must match exactly (HW4) — never cross with HW2.5/HW3",
      "Computer is VIN-married; requires Tesla service/config work after swap",
    ],
    confidence: "check-part-number",
    sources: [TMC],
  },
  // ── Tesla Model S / Model X (pre-refresh platform) ────────────────────────
  {
    id: "tesla-sx-rear-du-large",
    family: "drive_unit_rear",
    label: "Tesla Model S / Model X large rear drive unit (pre-refresh)",
    fits: [
      app("Tesla", "Model S", 2012, 2020),
      app("Tesla", "Model X", 2016, 2020),
    ],
    constraints: ["Match the drive-unit size/spec code (base vs performance sport) on the unit label"],
    confidence: "probable",
    sources: [TMC, OPENINV],
  },
  {
    id: "tesla-sx-front-du",
    family: "drive_unit_front",
    label: "Tesla Model S / Model X small front drive unit (pre-refresh Dual Motor)",
    fits: [
      app("Tesla", "Model S", 2014, 2020, undefined, ["Dual Motor"]),
      app("Tesla", "Model X", 2016, 2020),
    ],
    confidence: "probable",
    notes: "Palladium (2021+) S/X use different drive units — separate platform, not in this group.",
    sources: [TMC, OPENINV],
  },
  {
    id: "tesla-sx-palladium-du",
    family: "drive_unit_rear",
    label: "Tesla Model S / Model X Palladium drive units (2021+)",
    fits: [
      app("Tesla", "Model S", 2021, 2026),
      app("Tesla", "Model X", 2021, 2026),
    ],
    constraints: ["Plaid carbon-sleeved motors are not interchangeable with Long Range units"],
    confidence: "probable",
    sources: [TMC],
  },
  {
    id: "tesla-sx-pack",
    family: "hv_battery",
    label: "Tesla Model S / Model X 18650 pack (pre-refresh)",
    fits: [
      app("Tesla", "Model S", 2012, 2020),
      app("Tesla", "Model X", 2016, 2020),
    ],
    constraints: [
      "Capacity (60/75/85/90/100) and pack revision must match — verify the pack part number",
      "BMS firmware pairing needed after swap",
    ],
    confidence: "check-part-number",
    sources: [TMC, OPENINV],
  },
  {
    id: "tesla-sx-battery-modules",
    family: "battery_module",
    label: "Tesla Model S / Model X 18650 battery modules",
    fits: [
      app("Tesla", "Model S", 2012, 2020),
      app("Tesla", "Model X", 2016, 2020),
    ],
    constraints: ["Module capacity/revision must match the donor pack — check the module part number"],
    confidence: "check-part-number",
    notes: "Widely reused in rebuilds and off-grid conversions; modules cross S↔X within revision.",
    sources: [OPENINV],
  },
  {
    id: "tesla-mcu1",
    family: "infotainment",
    label: "Tesla infotainment MCU1 (Tegra)",
    fits: [
      app("Tesla", "Model S", 2012, 2018),
      app("Tesla", "Model X", 2016, 2018),
    ],
    constraints: ["MCU generation must match; unit is VIN/config-married — needs Tesla service work"],
    confidence: "check-part-number",
    sources: [TMC],
  },
  {
    id: "tesla-mcu2",
    family: "infotainment",
    label: "Tesla infotainment MCU2 (Intel)",
    fits: [
      app("Tesla", "Model S", 2018, 2021),
      app("Tesla", "Model X", 2018, 2021),
    ],
    constraints: ["MCU generation must match; unit is VIN/config-married — needs Tesla service work"],
    confidence: "check-part-number",
    sources: [TMC],
  },
  {
    id: "tesla-mcu3",
    family: "infotainment",
    label: "Tesla infotainment MCU3 (AMD Ryzen, Palladium)",
    fits: [
      app("Tesla", "Model S", 2021, 2026),
      app("Tesla", "Model X", 2021, 2026),
    ],
    constraints: ["MCU generation must match; unit is VIN/config-married — needs Tesla service work"],
    confidence: "check-part-number",
    sources: [TMC],
  },
  // ── Nissan Leaf ───────────────────────────────────────────────────────────
  {
    id: "leaf-pack-24",
    family: "hv_battery",
    label: "Nissan Leaf 24 kWh pack (ZE0/AZE0)",
    fits: [app("Nissan", "Leaf", 2011, 2015)],
    confidence: "verified",
    notes: "2013+ 'lizard' chemistry packs are the preferred replacement and bolt into earlier cars.",
    sources: [OEM, OPENINV],
  },
  {
    id: "leaf-pack-30",
    family: "hv_battery",
    label: "Nissan Leaf 30 kWh pack",
    fits: [app("Nissan", "Leaf", 2016, 2017, undefined, ["SV", "SL"])],
    confidence: "verified",
    notes: "30 kWh was SV/SL only — 2016-2017 S kept the 24 kWh pack. Cross-capacity retrofits are community-documented, not plug-and-play.",
    sources: [OEM, OPENINV],
  },
  {
    id: "leaf-pack-40",
    family: "hv_battery",
    label: "Nissan Leaf 40 kWh pack (ZE1)",
    fits: [app("Nissan", "Leaf", 2018, 2025)],
    confidence: "verified",
    notes: "Retrofits into 2011-2017 cars are community-documented (CAN-bridge required) — not a bolt-in interchange.",
    sources: [OEM, OPENINV],
  },
  {
    id: "leaf-pack-62",
    family: "hv_battery",
    label: "Nissan Leaf Plus 62 kWh pack (ZE1)",
    fits: [app("Nissan", "Leaf", 2019, 2025, "Plus trims only", ["Plus", "S Plus", "SV Plus", "SL Plus"])],
    constraints: ["62 kWh Plus pack only — taller case, different mass; not a drop-in for 40 kWh cars"],
    confidence: "verified",
    sources: [OEM, OPENINV],
  },
  {
    id: "leaf-em57-gen1",
    family: "drive_unit_front",
    label: "Nissan Leaf EM57 motor stack (AZE0, 2013-2017)",
    fits: [app("Nissan", "Leaf", 2013, 2017)],
    confidence: "verified",
    notes: "2011-2012 cars used the earlier EM61 — not in this group.",
    sources: [OEM, OPENINV],
  },
  {
    id: "leaf-em57-gen2",
    family: "drive_unit_front",
    label: "Nissan Leaf EM57 motor stack (ZE1, 2018+)",
    fits: [app("Nissan", "Leaf", 2018, 2025)],
    constraints: ["ZE1 inverter/reduction-gear revisions differ from AZE0 — match the stack revision"],
    confidence: "probable",
    sources: [OPENINV],
  },
  {
    id: "leaf-obc-gen1",
    family: "onboard_charger",
    label: "Nissan Leaf onboard charger (2013-2017)",
    fits: [app("Nissan", "Leaf", 2013, 2017)],
    constraints: ["3.6 kW vs 6.6 kW charger variants — match the kW rating (S base vs SV/SL)"],
    confidence: "check-part-number",
    sources: [OEM, OPENINV],
  },
  {
    id: "leaf-obc-ze1",
    family: "onboard_charger",
    label: "Nissan Leaf onboard charger (ZE1, 2018+)",
    fits: [app("Nissan", "Leaf", 2018, 2025)],
    constraints: ["6.6 kW standard on ZE1 — verify part number against early-build revisions"],
    confidence: "probable",
    sources: [OPENINV],
  },
  // ── Chevrolet Bolt EV / Bolt EUV ──────────────────────────────────────────
  {
    id: "bolt-du",
    family: "drive_unit_front",
    label: "Chevrolet Bolt EV / Bolt EUV drive unit",
    fits: [
      app("Chevrolet", "Bolt EV", 2017, 2023),
      app("Chevrolet", "Bolt EUV", 2022, 2023),
    ],
    confidence: "verified",
    notes: "Same 150 kW front drive unit across Bolt EV and EUV.",
    sources: [OEM],
  },
  {
    id: "bolt-power-electronics",
    family: "dcdc_converter",
    label: "Chevrolet Bolt EV / Bolt EUV power electronics (SPIM / DC-DC)",
    fits: [
      app("Chevrolet", "Bolt EV", 2017, 2023),
      app("Chevrolet", "Bolt EUV", 2022, 2023),
    ],
    confidence: "verified",
    sources: [OEM],
  },
  {
    id: "bolt-obc-72",
    family: "onboard_charger",
    label: "Chevrolet Bolt EV 7.2 kW onboard charger (2017-2021)",
    fits: [app("Chevrolet", "Bolt EV", 2017, 2021)],
    confidence: "verified",
    sources: [OEM],
  },
  {
    id: "bolt-obc-115",
    family: "onboard_charger",
    label: "Chevrolet Bolt EV / EUV 11.5 kW onboard charger (2022-2023)",
    fits: [
      app("Chevrolet", "Bolt EV", 2022, 2023),
      app("Chevrolet", "Bolt EUV", 2022, 2023),
    ],
    confidence: "verified",
    sources: [OEM],
  },
  {
    id: "bolt-pack-60",
    family: "hv_battery",
    label: "Chevrolet Bolt EV 60 kWh pack (2017-2019)",
    fits: [app("Chevrolet", "Bolt EV", 2017, 2019)],
    constraints: [
      "Many packs were replaced under the GM battery recall with newer-spec 66 kWh-family packs — the part number on the pack decides, not the model year",
    ],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "bolt-pack-66",
    family: "hv_battery",
    label: "Chevrolet Bolt EV / EUV 66 kWh pack (2020-2023)",
    fits: [
      app("Chevrolet", "Bolt EV", 2020, 2023),
      app("Chevrolet", "Bolt EUV", 2022, 2023),
    ],
    constraints: ["Verify recall status and pack part number — recall-replacement packs supersede originals"],
    confidence: "check-part-number",
    sources: [OEM],
  },
  // ── Ford Mustang Mach-E / F-150 Lightning ─────────────────────────────────
  {
    id: "mache-rear-du",
    family: "drive_unit_rear",
    label: "Ford Mustang Mach-E rear drive unit",
    fits: [app("Ford", "Mach-E", 2021, 2024)],
    constraints: ["GT rear unit is higher-output — match the output spec/part number"],
    confidence: "verified",
    sources: [OEM],
  },
  {
    id: "mache-pack-sr",
    family: "hv_battery",
    label: "Ford Mustang Mach-E Standard Range pack",
    fits: [app("Ford", "Mach-E", 2021, 2024, undefined, ["Standard Range"])],
    constraints: ["SR vs ER packs differ in module count and case — never cross; 2023+ SR moved to LFP chemistry"],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "mache-pack-er",
    family: "hv_battery",
    label: "Ford Mustang Mach-E Extended Range pack",
    fits: [app("Ford", "Mach-E", 2021, 2024, undefined, ["Extended Range", "GT"])],
    constraints: ["SR vs ER packs differ in module count and case — never cross; verify pack part number"],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "lightning-rear-du",
    family: "drive_unit_rear",
    label: "Ford F-150 Lightning rear drive unit",
    fits: [app("Ford", "Lightning", 2022, 2026)],
    constraints: ["SR and ER trucks use different output calibrations — match the part number"],
    confidence: "probable",
    notes: "Lightning drive units and packs are truck-specific — no Mach-E interchange.",
    sources: [OEM],
  },
  {
    id: "lightning-pack",
    family: "hv_battery",
    label: "Ford F-150 Lightning pack (SR / ER)",
    fits: [app("Ford", "Lightning", 2022, 2026)],
    constraints: ["Standard Range vs Extended Range packs are different assemblies — never cross"],
    confidence: "check-part-number",
    sources: [OEM],
  },
  // ── Volkswagen ID.4 (MEB) ─────────────────────────────────────────────────
  {
    id: "id4-rear-du-app310",
    family: "drive_unit_rear",
    label: "VW ID.4 APP310 rear drive unit (2021-2023)",
    fits: [app("Volkswagen", "ID.4", 2021, 2023)],
    confidence: "verified",
    notes: "MEB APP310 unit; shared motor family with other MEB cars (Audi Q4 e-tron) — verify by part number when crossing brands.",
    sources: [OEM, OPENINV],
  },
  {
    id: "id4-rear-du-app550",
    family: "drive_unit_rear",
    label: "VW ID.4 APP550 rear drive unit (2024+)",
    fits: [app("Volkswagen", "ID.4", 2024, 2026)],
    constraints: ["APP550 is not interchangeable with the earlier APP310 unit"],
    confidence: "verified",
    sources: [OEM],
  },
  {
    id: "id4-pack-82",
    family: "hv_battery",
    label: "VW ID.4 82 kWh (77 usable) pack",
    fits: [app("Volkswagen", "ID.4", 2021, 2026, undefined, ["Pro", "Pro S", "AWD Pro"])],
    constraints: ["Module/BMS revisions changed across model years — match the pack part number"],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "id4-pack-62",
    family: "hv_battery",
    label: "VW ID.4 62 kWh (58 usable) pack (Standard)",
    fits: [app("Volkswagen", "ID.4", 2021, 2023, undefined, ["Standard", "Standard S"])],
    constraints: ["62 vs 77/82 kWh packs differ in module count — never cross"],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "id4-obc",
    family: "onboard_charger",
    label: "VW ID.4 11 kW onboard charger",
    fits: [app("Volkswagen", "ID.4", 2021, 2026)],
    confidence: "probable",
    sources: [OEM],
  },
  // ── Hyundai / Kia (E-GMP + Kona) ──────────────────────────────────────────
  {
    id: "ioniq5-rear-du",
    family: "drive_unit_rear",
    label: "Hyundai Ioniq 5 / Kia EV6 rear drive unit (E-GMP)",
    fits: [
      app("Hyundai", "Ioniq 5", 2022, 2026),
      app("Kia", "EV6", 2022, 2026, "Shared E-GMP motor family"),
    ],
    constraints: ["Match output spec (168 kW RWD vs AWD rear) — verify part number when crossing brands"],
    confidence: "probable",
    sources: [OEM, OPENINV],
  },
  {
    id: "ioniq5-pack",
    family: "hv_battery",
    label: "Hyundai Ioniq 5 pack (58 / 77.4 kWh, E-GMP)",
    fits: [app("Hyundai", "Ioniq 5", 2022, 2026)],
    constraints: [
      "Standard (58 kWh) vs Long Range (77.4 kWh) packs are different assemblies — never cross",
      "E-GMP packs are revision-sensitive — match the pack part number",
    ],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "ioniq5-iccu",
    family: "onboard_charger",
    label: "Hyundai Ioniq 5 / Kia EV6 ICCU (integrated charger + DC-DC)",
    fits: [
      app("Hyundai", "Ioniq 5", 2022, 2026),
      app("Kia", "EV6", 2022, 2026),
    ],
    constraints: ["Known ICCU failure/recall campaigns — later revision part numbers supersede; fit the latest rev"],
    confidence: "check-part-number",
    sources: [OEM, OPENINV],
  },
  {
    id: "kona-ev-du-gen1",
    family: "drive_unit_front",
    label: "Hyundai Kona Electric / Kia Niro EV drive unit (gen 1)",
    fits: [
      app("Hyundai", "Kona Electric", 2019, 2023),
      app("Kia", "Niro EV", 2019, 2022, "Shared 150 kW motor family"),
    ],
    constraints: ["64 kWh (150 kW) vs 39.2 kWh (100 kW) cars use different-output units — match spec"],
    confidence: "probable",
    sources: [OEM, OPENINV],
  },
  {
    id: "kona-ev-pack-gen1",
    family: "hv_battery",
    label: "Hyundai Kona Electric pack (gen 1)",
    fits: [app("Hyundai", "Kona Electric", 2019, 2023)],
    constraints: [
      "39.2 vs 64 kWh packs are different assemblies — never cross",
      "Many packs replaced under the LG recall — the pack part number decides, not the model year",
    ],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "kona-ev-du-gen2",
    family: "drive_unit_front",
    label: "Hyundai Kona Electric drive unit (gen 2, 2024+)",
    fits: [app("Hyundai", "Kona Electric", 2024, 2026)],
    constraints: ["Gen-2 (2024+) components do not interchange with 2019-2023 cars"],
    confidence: "probable",
    sources: [OEM],
  },
  // ── Rivian R1T / R1S ──────────────────────────────────────────────────────
  {
    id: "rivian-quad-du",
    family: "drive_unit_rear",
    label: "Rivian R1T / R1S quad-motor drive units (Bosch-based, 2022-2024)",
    fits: [
      app("Rivian", "R1T", 2022, 2024, undefined, ["Quad-Motor"]),
      app("Rivian", "R1S", 2022, 2024, undefined, ["Quad-Motor"]),
    ],
    constraints: ["Quad-motor corner units only — not interchangeable with Enduro dual-motor units"],
    confidence: "probable",
    notes: "R1T and R1S share the skateboard platform — drive units cross truck↔SUV within motor generation.",
    sources: [OEM, OPENINV],
  },
  {
    id: "rivian-enduro-du",
    family: "drive_unit_rear",
    label: "Rivian R1T / R1S Enduro drive units (dual-motor, 2023+)",
    fits: [
      app("Rivian", "R1T", 2023, 2026, undefined, ["Dual-Motor", "Performance Dual-Motor", "Tri-Motor"]),
      app("Rivian", "R1S", 2023, 2026, undefined, ["Dual-Motor", "Performance Dual-Motor", "Tri-Motor"]),
    ],
    constraints: ["Enduro (in-house) units only — not interchangeable with Bosch-based quad-motor units"],
    confidence: "probable",
    sources: [OEM, OPENINV],
  },
  {
    id: "rivian-pack-gen1",
    family: "hv_battery",
    label: "Rivian R1T / R1S pack (Gen 1, 2022-2024)",
    fits: [
      app("Rivian", "R1T", 2022, 2024),
      app("Rivian", "R1S", 2022, 2024),
    ],
    constraints: [
      "Standard / Large / Max pack sizes are different assemblies — never cross sizes",
      "Match the pack part number — Gen-1 revisions changed across build years",
    ],
    confidence: "check-part-number",
    sources: [OEM],
  },
  {
    id: "rivian-pack-gen2",
    family: "hv_battery",
    label: "Rivian R1T / R1S pack (Gen 2, 2025+)",
    fits: [
      app("Rivian", "R1T", 2025, 2026),
      app("Rivian", "R1S", 2025, 2026),
    ],
    constraints: ["Gen-2 (2025+) packs and architecture do not interchange with Gen-1 trucks"],
    confidence: "check-part-number",
    sources: [OEM],
  },
];

// ── Resolvers ────────────────────────────────────────────────────────────────

// Model matching: normalized query-model must CONTAIN the application key, so
// decode drift is absorbed one-way ("Mustang Mach-E" matches app "Mach-E";
// "Model 3 Performance" matches "Model 3") while "Bolt EV" never matches
// "Bolt EUV" and a gas "Kona" never matches "Kona Electric".
function modelMatches(queryModel: string, appModel: string): boolean {
  const q = normKey(queryModel), a = normKey(appModel);
  if (!q || !a) return false;
  return q === a || q.includes(a);
}

function appMatches(a: EvApplication, make: string, model: string, year: number): boolean {
  return normKey(a.make) === normKey(make) && modelMatches(model, a.model) && year >= a.yearStart && year <= a.yearEnd;
}

const DU_SIBLING: Partial<Record<EvPartFamily, EvPartFamily>> = {
  drive_unit_rear: "drive_unit_front",
  drive_unit_front: "drive_unit_rear",
};

/** Curated groups containing this exact vehicle application (optionally
 *  restricted to a part family). For drive units, if the requested end
 *  (front/rear) has no group for this vehicle we fall back to the sibling end —
 *  the scanner labels every inferred DU "Rear", but a Leaf/Bolt motor is at the
 *  front. Unknown vehicles and ICE cars simply match nothing. */
export function evInterchangeFor(q: {
  make: string;
  model: string;
  year: number | string;
  family?: EvPartFamily | null;
}): EvInterchangeGroup[] {
  const year = Math.trunc(Number(q.year));
  if (!q.make || !q.model || !Number.isFinite(year) || year < 2008 || year > 2100) return [];
  const find = (family?: EvPartFamily | null) =>
    EV_GROUPS.filter(
      (g) => (!family || g.family === family) && g.fits.some((a) => appMatches(a, q.make, q.model, year)),
    );
  let groups = find(q.family);
  if (groups.length === 0 && q.family && DU_SIBLING[q.family]) groups = find(DU_SIBLING[q.family]);
  return groups;
}

function caveatFor(group: EvInterchangeGroup, a: EvApplication): string | undefined {
  if (group.confidence === "check-part-number") {
    return a.note || group.constraints?.[0] || group.notes || "Verify the part number before quoting";
  }
  return a.note || group.constraints?.[0] || undefined;
}

const CONF_ORDER: Record<EvConfidence, number> = { verified: 0, probable: 1, "check-part-number": 2 };

/** "Also fits" lines for a donor part: the OTHER applications in every curated
 *  group the donor belongs to. The donor's own model is excluded; every
 *  check-part-number line carries a caveat. Returns [] for ICE/unknown input —
 *  fail silent, never wrong. */
export function evFitLines(q: { make: string; model: string; year: number | string; partName: string }): EvFitLine[] {
  const family = evFamilyFromPartName(q.partName);
  if (!family) return [];
  const groups = evInterchangeFor({ make: q.make, model: q.model, year: q.year, family });
  const seen = new Set<string>();
  const lines: EvFitLine[] = [];
  for (const g of groups) {
    for (const a of g.fits) {
      // Skip the donor's own model — the listing already says what it came off.
      if (normKey(a.make) === normKey(q.make) && modelMatches(q.model, a.model)) continue;
      const caveat = caveatFor(g, a);
      const key = [normKey(a.make), normKey(a.model), a.yearStart, a.yearEnd, caveat || ""].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({
        make: a.make,
        model: a.model,
        yearStart: a.yearStart,
        yearEnd: a.yearEnd,
        label: `${a.yearStart}–${a.yearEnd} ${a.make} ${a.model}`,
        ...(caveat ? { caveat } : {}),
        confidence: g.confidence,
      });
    }
  }
  return lines.sort((x, y) => CONF_ORDER[x.confidence] - CONF_ORDER[y.confidence]);
}

/** Sibling applications for comps-retrieval widening (same shape idea as
 *  generations.ts): every application in the donor's curated groups, including
 *  the donor's own curated year range. Exported for the pricing workstream to
 *  wire into comps retrieval later — NOT wired into reprice here. */
export function evRetrievalHints(
  make: string,
  model: string,
  year: number | string,
  partName: string,
): { make: string; model: string; from: number; to: number }[] {
  const family = evFamilyFromPartName(partName);
  if (!family) return [];
  const groups = evInterchangeFor({ make, model, year, family });
  const seen = new Set<string>();
  const out: { make: string; model: string; from: number; to: number }[] = [];
  for (const g of groups) {
    for (const a of g.fits) {
      const key = [normKey(a.make), normKey(a.model), a.yearStart, a.yearEnd].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ make: a.make, model: a.model, from: a.yearStart, to: a.yearEnd });
    }
  }
  return out;
}
