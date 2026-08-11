/**
 * Assembly definitions for dismantler-sold parts.
 *
 * Governing rule: parts pulled at a dismantling yard are sold COMPLETE, as they came off the
 * vehicle. This map defines what "complete" means for each part type so the pricing judge knows
 * what it is valuing, and so comp listings for stripped shells are not averaged against it.
 *
 * `includes`      what ships with the assembly by default
 * `mayBeAbsent`   components sometimes pulled separately or missing; capture as exceptions
 * `shellTerms`    listing language indicating a STRIPPED comp, priced far below a complete unit
 * `completeTerms` listing language indicating a complete comp
 * `priceDrivers`  what moves the number within this part type
 * `freight`       shipping burden, which suppresses what a buyer pays for the part itself
 *
 * TODO(andy): correct against how the yard actually pulls and sells. The three entries most
 * likely to be wrong are flagged with REVIEW.
 */

export type Freight = "small" | "standard" | "oversized" | "freight";

export interface PartAssembly {
  key: string;
  name: string;
  includes: string[];
  mayBeAbsent: string[];
  shellTerms: string[];
  completeTerms: string[];
  priceDrivers: string[];
  freight: Freight;
}

export const PART_ASSEMBLIES: Record<string, PartAssembly> = {
  front_door: {
    key: "front_door",
    name: "Front door assembly",
    includes: [
      "outer skin", "inner structure", "door glass", "window regulator", "window motor",
      "door latch / actuator", "interior trim panel", "speaker", "switch panel",
      "interior and exterior handles", "wiring harness", "weatherstripping", "side mirror",
    ],
    // REVIEW: some yards pull mirrors separately because they sell well on their own.
    mayBeAbsent: ["side mirror", "speaker", "tweeter"],
    shellTerms: ["shell only", "skin only", "bare", "gutted", "no glass", "panel only", "husk"],
    completeTerms: ["complete", "loaded", "w/ glass", "with regulator", "assembly"],
    priceDrivers: [
      "driver front carries the master window and lock switch panel and is worth more than passenger",
      "power vs manual windows",
      "color match to a common color",
      "structural damage to hinge or latch mounting points makes it scrap regardless of skin condition",
      "rust on the lower seam",
    ],
    freight: "freight",
  },

  rear_door: {
    key: "rear_door",
    name: "Rear door assembly",
    includes: [
      "outer skin", "inner structure", "door glass", "window regulator", "window motor",
      "door latch / actuator", "interior trim panel", "speaker", "switch panel",
      "interior and exterior handles", "wiring harness", "weatherstripping",
    ],
    mayBeAbsent: ["speaker", "switch panel on manual-window trims"],
    shellTerms: ["shell only", "skin only", "bare", "gutted", "no glass", "panel only"],
    completeTerms: ["complete", "loaded", "w/ glass", "with regulator", "assembly"],
    priceDrivers: [
      "single-switch panel rather than a master, so lower than a driver front",
      "quarter glass on some body styles",
      "extended cab and access cab doors are a separate market from crew cab",
      "structural damage to hinge or latch mounting points",
    ],
    freight: "freight",
  },

  tailgate: {
    key: "tailgate",
    name: "Tailgate assembly",
    includes: [
      "gate", "backup camera", "exterior handle", "latch and rods", "hinges",
      "trim and applique", "lift assist / torsion bar", "wiring harness", "emblems and lettering",
    ],
    mayBeAbsent: ["backup camera", "lift assist", "bed step"],
    shellTerms: ["shell only", "no camera", "camera delete", "skin only", "bare", "gate only"],
    completeTerms: ["complete", "loaded", "w/ camera", "with camera", "w/ handle", "assembly"],
    priceDrivers: [
      "backup camera presence is a large single swing",
      "power lock and power release",
      "stamped lettering intact",
      "high theft demand keeps replacement volume steady",
      "dents in the outer skin discount, but a bent inner structure makes it scrap",
    ],
    freight: "freight",
  },

  liftgate: {
    key: "liftgate",
    name: "Liftgate / hatch assembly",
    includes: [
      "gate", "glass", "wiper motor and arm", "backup camera", "latch and actuator",
      "struts", "interior trim panel", "third brake light", "wiring harness", "spoiler",
    ],
    mayBeAbsent: ["spoiler", "wiper motor", "backup camera"],
    shellTerms: ["shell only", "no glass", "bare", "skin only"],
    completeTerms: ["complete", "loaded", "w/ glass", "assembly"],
    priceDrivers: [
      "power liftgate motors and struts add substantially",
      "glass intact",
      "rear wiper assembly present",
    ],
    freight: "freight",
  },

  hood: {
    key: "hood",
    name: "Hood",
    includes: ["hood panel", "hinges", "insulation pad", "latch striker", "emblems"],
    mayBeAbsent: ["insulation pad", "hood scoop"],
    shellTerms: ["skin only", "no hinges"],
    completeTerms: ["complete", "w/ hinges", "assembly"],
    priceDrivers: [
      "aluminum vs steel",
      "color match",
      "creases and dents, since hoods are the most visible panel on the car",
      "hood scoop or vent on sport trims",
    ],
    freight: "freight",
  },

  front_bumper: {
    key: "front_bumper",
    name: "Front bumper assembly",
    includes: [
      "bumper cover", "reinforcement bar", "absorber", "brackets", "fog lights",
      "grille if integrated", "parking sensors", "trim and moldings",
    ],
    mayBeAbsent: ["fog lights", "parking sensors", "reinforcement bar", "tow hook cover"],
    shellTerms: ["cover only", "bare cover", "no brackets", "no reinforcement"],
    completeTerms: ["complete", "assembly", "w/ reinforcement", "w/ fogs", "loaded"],
    priceDrivers: [
      "sensors, cameras, and fog lights add meaningfully",
      "cover only is a fraction of a complete assembly",
      "cracks in mounting tabs, which are the usual failure point",
      "color match",
    ],
    freight: "freight",
  },

  rear_bumper: {
    key: "rear_bumper",
    name: "Rear bumper assembly",
    includes: [
      "bumper cover", "reinforcement bar", "absorber", "brackets", "parking sensors",
      "reflectors", "step pad", "trim and moldings",
    ],
    mayBeAbsent: ["parking sensors", "reinforcement bar", "tow hitch cover"],
    shellTerms: ["cover only", "bare cover", "no brackets", "no reinforcement"],
    completeTerms: ["complete", "assembly", "w/ reinforcement", "loaded"],
    priceDrivers: ["sensor presence", "chrome vs painted", "step pad condition on trucks"],
    freight: "freight",
  },

  fender: {
    key: "fender",
    name: "Fender",
    includes: ["fender panel", "liner", "brackets", "side marker", "trim and moldings"],
    mayBeAbsent: ["liner", "side marker", "flare"],
    shellTerms: ["panel only", "no liner", "bare"],
    completeTerms: ["complete", "w/ liner", "assembly"],
    priceDrivers: ["color match", "flare or trim on off-road packages", "rust at the wheel arch"],
    freight: "oversized",
  },

  headlight: {
    key: "headlight",
    name: "Headlight assembly",
    includes: ["housing", "lens", "bulbs or LED modules", "ballast", "brackets", "wiring pigtail"],
    mayBeAbsent: ["bulbs", "ballast", "control module"],
    shellTerms: ["housing only", "no bulb", "no ballast", "for parts", "broken tab"],
    completeTerms: ["complete", "w/ bulb", "w/ ballast", "assembly", "working"],
    priceDrivers: [
      "halogen vs HID vs LED vs adaptive is the dominant variable and the prices are far apart",
      "lens clarity and yellowing",
      "broken mounting tabs, which are the most common defect and heavily discount the part",
      "matched pairs sell for more than the sum of two singles",
    ],
    freight: "standard",
  },

  taillight: {
    key: "taillight",
    name: "Taillight assembly",
    includes: ["housing", "lens", "bulbs or LED board", "sockets", "wiring pigtail", "gasket"],
    mayBeAbsent: ["bulbs", "sockets"],
    shellTerms: ["housing only", "no bulb", "for parts", "cracked lens"],
    completeTerms: ["complete", "assembly", "working", "w/ bulbs"],
    priceDrivers: ["LED vs incandescent", "lens cracks or moisture staining", "pairs vs singles"],
    freight: "standard",
  },

  mirror: {
    key: "mirror",
    name: "Side mirror assembly",
    includes: ["housing", "glass", "motor", "cover cap", "turn signal", "blind spot module", "wiring pigtail"],
    mayBeAbsent: ["cover cap", "blind spot module"],
    shellTerms: ["housing only", "no glass", "no motor", "manual"],
    completeTerms: ["complete", "power", "heated", "w/ signal", "assembly"],
    priceDrivers: [
      "power vs manual, heated, memory, auto-dim, blind spot, and puddle lamp each add",
      "painted to match vs textured black",
      "pin count on the connector, which buyers filter on",
    ],
    freight: "standard",
  },

  wheel: {
    key: "wheel",
    name: "Wheel / rim",
    includes: ["rim", "center cap", "TPMS sensor"],
    mayBeAbsent: ["center cap", "TPMS sensor", "tire"],
    shellTerms: ["no cap", "no sensor", "curbed", "bent"],
    completeTerms: ["w/ cap", "w/ tpms", "set of 4", "complete"],
    priceDrivers: [
      "sets of four are worth far more than four times a single",
      "curb rash and bends",
      "finish, since machined and chrome-clad refinish poorly",
      "OEM vs aftermarket matters more here than on most parts",
    ],
    freight: "oversized",
  },

  seat: {
    key: "seat",
    name: "Seat assembly",
    includes: ["frame", "cushions", "upholstery", "tracks", "motors", "airbag module", "wiring", "headrest"],
    mayBeAbsent: ["headrest", "seat belt buckle"],
    shellTerms: ["frame only", "no motor", "core", "for reupholster"],
    completeTerms: ["complete", "power", "w/ airbag", "assembly", "heated"],
    priceDrivers: [
      "leather vs cloth",
      "power, heated, cooled, and memory",
      "deployed side airbag makes it a core rather than a resale part",
      "wear on the driver bolster, which is the first thing to fail",
    ],
    freight: "freight",
  },

  engine: {
    key: "engine",
    name: "Engine assembly",
    includes: [
      "long block", "intake manifold", "exhaust manifolds", "alternator", "starter",
      "AC compressor", "power steering pump", "sensors", "wiring harness", "flywheel or flexplate",
    ],
    mayBeAbsent: ["alternator", "starter", "AC compressor", "turbo", "intake manifold"],
    shellTerms: ["long block", "short block", "core", "bare", "no accessories", "for parts"],
    completeTerms: ["complete", "drop out", "dropout", "run tested", "w/ accessories", "assembly"],
    priceDrivers: [
      "mileage and whether it is compression or run tested",
      "complete drop-out vs long block is a large gap",
      "warranty offered",
      "engine code and exact fitment year range",
    ],
    freight: "freight",
  },

  transmission: {
    key: "transmission",
    name: "Transmission assembly",
    includes: ["case and internals", "torque converter", "valve body", "TCM if integrated", "sensors", "bellhousing"],
    mayBeAbsent: ["torque converter", "TCM", "shift linkage"],
    shellTerms: ["core", "no converter", "for parts", "bare case", "rebuild core"],
    completeTerms: ["complete", "w/ converter", "tested", "assembly"],
    priceDrivers: [
      "torque converter included or not",
      "mileage and test status",
      "2WD vs 4WD and exact gear ratio",
      "warranty offered",
    ],
    freight: "freight",
  },

  radiator_support: {
    key: "radiator_support",
    name: "Radiator core support",
    includes: ["support structure", "brackets", "hood latch", "fan shroud mounts", "sensors"],
    mayBeAbsent: ["hood latch", "horn"],
    shellTerms: ["cut", "partial", "bare"],
    completeTerms: ["complete", "assembly", "uncut"],
    priceDrivers: ["uncut vs cut", "collision damage", "aluminum vs steel vs composite"],
    freight: "freight",
  },

  instrument_cluster: {
    key: "instrument_cluster",
    name: "Instrument cluster",
    includes: ["cluster", "lens", "housing", "bulbs or LEDs"],
    mayBeAbsent: [],
    shellTerms: ["for parts", "not working", "no display", "core"],
    completeTerms: ["tested", "working", "complete"],
    priceDrivers: [
      "mileage displayed, since buyers care and some jurisdictions regulate this",
      "exact part number match, which matters more here than on almost any other part",
      "trim-specific display features",
    ],
    freight: "small",
  },

  ac_compressor: {
    key: "ac_compressor",
    name: "AC compressor",
    includes: ["compressor", "clutch", "pulley", "connector pigtail"],
    mayBeAbsent: ["clutch", "pulley"],
    shellTerms: ["core", "for parts", "seized", "no clutch"],
    completeTerms: ["tested", "working", "complete", "w/ clutch"],
    priceDrivers: ["tested vs core", "refrigerant type", "clutch condition"],
    freight: "standard",
  },
};

/**
 * REVIEW ITEMS for Andy:
 * 1. front_door.mayBeAbsent lists the side mirror. Does the yard pull mirrors with the door or
 *    separately? This changes the door price and creates a second SKU if separate.
 * 2. rear_door price drivers assume rear doors sell below fronts. Confirm the rough spread.
 * 3. Catalytic converters are deliberately excluded from this map. California rules around
 *    used converter sale and marking are strict and worth handling as their own case rather
 *    than as a normal part. Confirm how the yard handles them before adding an entry.
 */
