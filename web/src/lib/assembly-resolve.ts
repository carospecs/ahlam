// PART NAME → ASSEMBLY DEFINITION — feeds the judge's INCLUDED section (docs:
// pricing-prompt.md "The completeness data has to come from somewhere", option
// one: default by part type, let the photos override).
//
// Two-stage match: a sub-component guard first (a "Door Window Regulator" is NOT
// a door assembly — giving it door completeness data would poison the judgment),
// then ordered name matchers. Returns null for anything that isn't a mapped
// assembly type — the judge then prices without a completeness default.
import { PART_ASSEMBLIES, type PartAssembly } from "./part-assemblies";

// Listing/detection names that are components OF an assembly, not the assembly.
// "belt" also catches seat belts and window belt moldings.
const SUB_COMPONENT =
  /\b(window|glass|regulator|motor|switch|handle|latch|lock|actuator|hinge|trim|panel\s+trim|card|molding|moulding|weatherstrip|belt|emblem|badge|applique|strut|camera|sensor|harness|wiring|speaker|tweeter|liner|bracket|cap|step|pad|reflector|bulb|ballast|lens)\b/i;

// Interior door panels / trim cards are their own SKU, not a door assembly.
const DOOR_PANEL = /\bdoor\s+panel\b/i;

const MATCHERS: [RegExp, keyof typeof PART_ASSEMBLIES][] = [
  [/\bmirror\b/i, "mirror"],
  [/tail\s?gate/i, "tailgate"],
  [/lift\s?gate|\bhatch\b|trunk\s?lid|deck\s?lid|decklid/i, "liftgate"],
  [/(front|driver|passenger|left|right)[^]*\bdoor\b[^]*\bfront\b|\bfront\b[^]*\bdoor\b/i, "front_door"],
  [/\brear\b[^]*\bdoor\b|\bdoor\b[^]*\brear\b|falcon/i, "rear_door"],
  [/\bdoor\b/i, "front_door"],
  [/\bhood\b/i, "hood"],
  [/\bfront\b[^]*bumper|bumper[^]*\bfront\b/i, "front_bumper"],
  [/\brear\b[^]*bumper|bumper[^]*\brear\b/i, "rear_bumper"],
  [/\bfender\b/i, "fender"],
  [/head\s?light|head\s?lamp/i, "headlight"],
  [/tail\s?light|tail\s?lamp/i, "taillight"],
  [/(?<!steering\s)\bwheel\b|\brim\b/i, "wheel"],
  [/\bseat\b/i, "seat"],
  [/\bengine\b(?!\s*(cover|mount|splash|bay))/i, "engine"],
  [/transmission|transaxle/i, "transmission"],
  [/radiator\s?(core\s?)?support/i, "radiator_support"],
  [/instrument\s?cluster|gauge\s?cluster|speedometer/i, "instrument_cluster"],
  [/a\/?c\s?compressor|air\s?con[^]*compressor/i, "ac_compressor"],
];

export function resolveAssembly(partName: string): PartAssembly | null {
  const name = (partName || "").trim();
  if (!name) return null;
  if (/steering\s?wheel/i.test(name)) return null;
  if (DOOR_PANEL.test(name) || SUB_COMPONENT.test(name)) return null;
  for (const [re, key] of MATCHERS) if (re.test(name)) return PART_ASSEMBLIES[key] ?? null;
  return null;
}
