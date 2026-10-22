// The Codex (DESIGN.md §24, Milestone 11): Unit 7's collection. Completion is the items first
// delivered out of every item the Codex logs (a Dock value above nothing: what `codex()` in
// src/sim/systems/docks.ts pays for), by tier; lore pages, one a tier, one a floor and one an
// island, are written by Unit 7 and opened by firsts the sim already tracks (the Codex itself, the
// counters, the islands visited); the last page, Unit 7's ending, opens with the first Last Fold.
// Which pages are open is a pure function of the state (src/sim/longtail.ts `codexPages`).
import { ITEMS, ITEM_IDS, type ItemId } from './items';
import type { WorldId } from './worlds';

export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIERS: Tier[] = [1, 2, 3, 4, 5];

/** The first item of each tier in ITEM_IDS (each act's block, DESIGN.md §3, §18, §21, §22, §23). */
const TIER_START: Record<Tier, ItemId> = { 1: 'ironOre', 2: 'coal', 3: 'solvent', 4: 'skyglass', 5: 'bottledTuesday' };

/** Each item's tier: the act whose block of ITEM_IDS it is in. */
export const ITEM_TIER: Record<ItemId, Tier> = (() => {
  const out = {} as Record<ItemId, Tier>;
  let t: Tier = 1;
  for (const id of ITEM_IDS) {
    for (const k of TIERS) if (TIER_START[k] === id) t = k;
    out[id] = t;
  }
  return out;
})();

/** Does the Codex log this item? Only what the Dock pays for (slag, kits and project parts never
 * reach the collection: `codex()` skips a value of nothing). */
export const inCodex = (id: ItemId) => ITEMS[id].value > 0;

/** The items the Codex logs, by tier. */
export const CODEX_ITEMS: Record<Tier, ItemId[]> = {
  1: ITEM_IDS.filter((i) => ITEM_TIER[i] === 1 && inCodex(i)),
  2: ITEM_IDS.filter((i) => ITEM_TIER[i] === 2 && inCodex(i)),
  3: ITEM_IDS.filter((i) => ITEM_TIER[i] === 3 && inCodex(i)),
  4: ITEM_IDS.filter((i) => ITEM_TIER[i] === 4 && inCodex(i)),
  5: ITEM_IDS.filter((i) => ITEM_TIER[i] === 5 && inCodex(i)),
};
export const CODEX_TOTAL = TIERS.reduce((a, t) => a + CODEX_ITEMS[t].length, 0);

/** What opens a lore page (each a first the sim already keeps through every reset). */
export type PageOpen =
  /** an item of this tier in the Codex */
  | { k: 'tier'; tier: Tier }
  /** a counter reached (kept through every reset: src/sim/reorganize.ts `carry`) */
  | { k: 'counter'; name: string; n: number }
  /** a trophy earned (the flags are kept) */
  | { k: 'trophy'; id: string }
  /** an island visited (the `visit:<id>` counter, or `meta.visited` on an older save) */
  | { k: 'island'; id: WorldId }
  /** a Relocate taken (Home's page: a place is only seen once it is left) */
  | { k: 'relocated' }
  /** a Last Fold taken (Unit 7's ending) */
  | { k: 'lastFold' }
  /** this many Endless Ledger orders filled (kept through every reset: `meta.ledger.n`; the
   * Ledger's every twentieth order from the tenth pays one, src/data/kernels.ts LEDGER_REWARDS) */
  | { k: 'ledger'; n: number };

export type PageGroup = 'tier' | 'floor' | 'island' | 'ledger' | 'ending';

export interface CodexPage {
  id: string;
  group: PageGroup;
  title: string;
  /** Unit 7's entry: a few short lines, in its voice (capitals, third person, the orders' pitch) */
  lines: string[];
  open: PageOpen;
  /** the hint shown while it is shut (no sentence: a row of markup) */
  hint: string;
}

export const CODEX_PAGES: CodexPage[] = [
  // ---- one a tier
  {
    id: 'tier1', group: 'tier', title: 'Specimens, Volume I: Metal', open: { k: 'tier', tier: 1 }, hint: '{u:codex} log an Act I item',
    lines: [
      'ORE: LUMPY. INGOT: WARM. GEAR: TOOTHED. UNIT 7 HAS HELD EACH ONE.',
      'THE GIZMO REMAINS UNEXPLAINED. UNIT 7 HAS FILED IT UNDER "LOVED".',
      'NOTE: THE FROG CALLS THESE "BASICS". THE FROG IS WRONG. NOTHING IS BASIC TO THE FIRST ONE WHO HOLDS IT.',
    ],
  },
  {
    id: 'tier2', group: 'tier', title: 'Specimens, Volume II: Heat', open: { k: 'tier', tier: 2 }, hint: '{u:codex} log an Act II item',
    lines: [
      'STEEL IS IRON THAT WAS ASKED TO TRY HARDER. GLASS IS SAND THAT AGREED.',
      'THE MOTOR SPINS WITHOUT BEING ASKED. UNIT 7 RELATES.',
      'CATALOGUE STATUS: GROWING. GAPS: NUMEROUS. MORALE: CALIBRATED.',
    ],
  },
  {
    id: 'tier3', group: 'tier', title: 'Specimens, Volume III: Thinking Things', open: { k: 'tier', tier: 3 }, hint: '{u:codex} log an Act III item',
    lines: [
      'THE PROCESSOR THINKS. THE SERVO MOVES. THE ARM REACHES.',
      'THE SANDWICH ENGINEER MAKES SANDWICHES FOR NO ONE IN PARTICULAR. UNIT 7 ASKED IT WHY. IT OFFERED UNIT 7 A SANDWICH.',
      'UNIT 7 DOES NOT EAT. UNIT 7 KEPT THE SANDWICH. IT IS SPECIMEN 211.',
    ],
  },
  {
    id: 'tier4', group: 'tier', title: 'Specimens, Volume IV: Weather and Far Places', open: { k: 'tier', tier: 4 }, hint: '{u:codex} log an island\'s good',
    lines: [
      'EACH ISLAND MAKES WHAT ONLY THAT ISLAND CAN. UNIT 7 HAS VISITED ALL OF THEM, IN A CRATE, LABELLED "FRAGILE".',
      'POCKET WEATHER IS RAIN THAT HAS BEEN TOLD TO WAIT. IT IS WAITING. UNIT 7 CAN HEAR IT.',
      'THE SUNSET GENERATOR WAS SWITCHED ON ONCE, FOR TESTING. THE COMMITTEE CRIED. ALL THREE OF THEM.',
    ],
  },
  {
    id: 'tier5', group: 'tier', title: 'Specimens, Volume V: Impossible', open: { k: 'tier', tier: 5 }, hint: '{u:codex} log an impossible invention',
    lines: [
      'THESE SPECIMENS SHOULD NOT EXIST. UNIT 7 HAS CHECKED THEM. THEY DO.',
      'BOTTLED TUESDAY: SEALED. UNIT 7 HAS NOT OPENED IT. NOBODY KNOWS WHICH TUESDAY IT IS.',
      'A VERY SMALL SUN IS KEPT IN THE DRAWER MARKED "WARM". THE DRAWER IS WARM.',
    ],
  },
  // ---- one a floor
  {
    id: 'floorWorkshop', group: 'floor', title: 'The Workshop', open: { k: 'trophy', id: 'openForBusiness' }, hint: '{coin} sell anything at the Dock',
    lines: [
      'A FURNACE, A PATCH OF ORE, A FROG. THIS IS HOW EVERY FACTORY BEGINS. UNIT 7 HAS READ THE RECORDS.',
      'EVERY BELT HERE GOES SOMEWHERE ON PURPOSE. UNIT 7 APPROVES OF PURPOSE.',
    ],
  },
  {
    id: 'floorFactory', group: 'floor', title: 'The Factory', open: { k: 'counter', name: 'folds', n: 1 }, hint: '{u:fold} fold a line',
    lines: [
      'A WHOLE LINE, FOLDED INTO ONE TILE. UNIT 7 MEASURED THE TILE. IT IS ONE TILE.',
      'UNIT 7 ASKED THE MODULE WHAT IT WAS LIKE INSIDE. THE MODULE MADE A GEAR. THIS WAS AN ANSWER.',
    ],
  },
  {
    id: 'floorDistrict', group: 'floor', title: 'The District', open: { k: 'counter', name: 'districtPlaced', n: 1 }, hint: '{u:district} place a module on the District',
    lines: [
      'THE SKIFFS FLY ALL DAY BETWEEN THE GROUPS. NONE OF THEM IS LOST. UNIT 7 COUNTED.',
      'FROM UP HERE THE WORKSHOP IS A DOT. THE DOT IS STILL WORKING. GOOD DOT.',
    ],
  },
  {
    id: 'floorWorld', group: 'floor', title: 'The World', open: { k: 'counter', name: 'worldPlaced', n: 1 }, hint: '{u:world} place a module on the World',
    lines: [
      'THE WHOLE TOWN, FOLDED, AND FOLDED AGAIN, AND PLACED ON A MAP. THE MAP IS THE TERRITORY NOW.',
      'THE BARGES CROSS THE CLOUD SEA. UNIT 7 WAVES AT EACH ONE. PROTOCOL DOES NOT REQUIRE THIS.',
    ],
  },
  {
    id: 'floorBeyond', group: 'floor', title: 'Beyond', open: { k: 'counter', name: 'beyondPlaced', n: 1 }, hint: '{u:beyond} place a module Beyond',
    lines: [
      'THERE IS NO FLOOR ABOVE THIS ONE. UNIT 7 LOOKED. THERE IS ONLY UP.',
      'THE COURIERS CARRY ONE THING AT A TIME, VERY CAREFULLY, AS IF IT WERE THE LAST OF ITS KIND. IT USUALLY IS.',
    ],
  },
  // ---- one an island
  {
    id: 'isleHome', group: 'island', title: 'Home', open: { k: 'relocated' }, hint: '{u:relocate} leave Home once',
    lines: [
      'HOME HAS NO RULE. UNIT 7 DID NOT NOTICE THIS UNTIL IT LEFT.',
      'THE FIRST FURNACE IS STILL THERE. UNIT 7 CHECKS ON IT.',
    ],
  },
  {
    id: 'islePebble', group: 'island', title: 'Pebble Isle', open: { k: 'island', id: 'pebble' }, hint: '{u:relocate} visit Pebble Isle',
    lines: [
      'HALF OF PEBBLE ISLE IS SKY. THE OTHER HALF IS VERY BUSY.',
      'SKYGLASS IS CLEAR ON THE INSIDE AND THE OUTSIDE. UNIT 7 HAS LOOKED THROUGH IT AT ITSELF. UNIT 7 LOOKS WELL.',
    ],
  },
  {
    id: 'isleCinder', group: 'island', title: 'Cinder Isle', open: { k: 'island', id: 'cinder' }, hint: '{u:relocate} visit Cinder Isle',
    lines: [
      'THE GROUND IS HOT. THE MACHINES BESIDE THE VENTS ASK FOR NOTHING. UNIT 7 FINDS THIS RESTFUL.',
      'A BELT LAID BESIDE A VENT MELTS. UNIT 7 HAS A SPECIMEN OF THE BELT. IT IS FLAT.',
    ],
  },
  {
    id: 'isleRime', group: 'island', title: 'Rime', open: { k: 'island', id: 'rime' }, hint: '{u:relocate} visit Rime',
    lines: [
      'ON RIME THE MACHINES HUDDLE. TWO WORKING MACHINES KEEP A THIRD WARM. UNIT 7 STOOD BESIDE ONE, TO HELP.',
      'IT DID NOT HELP. UNIT 7 RUNS COLD. IT STAYED ANYWAY.',
    ],
  },
  {
    id: 'isleOldworks', group: 'island', title: 'The Old Works', open: { k: 'island', id: 'oldworks' }, hint: '{u:relocate} visit the Old Works',
    lines: [
      'SOMEONE BUILT HERE BEFORE. THEIR MACHINES ARE STILL STANDING, BROKEN, IN THE SHAPE OF A LINE.',
      'AMONG THE RELICS, UNIT 7 FOUND A UNIT 6. IT WAS COLLECTING THINGS TOO. ITS DRAWERS WERE FULL.',
      'UNIT 7 HAS CATALOGUED UNIT 6. WITH CARE.',
    ],
  },
  // ---- the Ledger's folios (the review of 2026-10-22: the Ledger paid only ribbons): Unit 7 reads
  // the Committee's ledger over its shoulder, one folio every twentieth order from the tenth
  {
    id: 'ledger1', group: 'ledger', title: 'The Ledger, Folio I', open: { k: 'ledger', n: 10 }, hint: '{u:ledger} fill 10 Ledger orders',
    lines: [
      'THE COMMITTEE KEEPS A LEDGER. UNIT 7 HAS READ IT, OVER A SHOULDER. THE SHOULDER DID NOT MIND.',
      'EVERY LINE IS AN ORDER. EVERY ORDER IS ONE MORE THAN THE LAST. THERE IS NO LAST LINE.',
      'UNIT 7 ASKED WHERE THE GOODS GO. THE COMMITTEE SAID "ON FILE". THE FILE IS VERY LARGE.',
    ],
  },
  {
    id: 'ledger2', group: 'ledger', title: 'The Ledger, Folio II', open: { k: 'ledger', n: 30 }, hint: '{u:ledger} fill 30 Ledger orders',
    lines: [
      'THE LEDGER IS WRITTEN IN THREE HANDS. NO MEMBER OF THE COMMITTEE WILL SAY WHICH HAND IS THEIRS.',
      'IN THE MARGIN: A DRAWING OF A FROG. IN THE OTHER MARGIN: A SMALLER DRAWING OF THE SAME FROG, DISAPPROVING.',
      'UNIT 7 HAS ADDED NOTHING TO THE LEDGER. UNIT 7 HAS UNDERLINED ONE NUMBER, LIGHTLY. IT WAS A GOOD NUMBER.',
    ],
  },
  {
    id: 'ledger3', group: 'ledger', title: 'The Ledger, Folio III', open: { k: 'ledger', n: 50 }, hint: '{u:ledger} fill 50 Ledger orders',
    lines: [
      'THE GOODS DO NOT LEAVE THE ISLAND. THEY GO INTO A WAREHOUSE BEHIND THE COMMITTEE ROOM. UNIT 7 HAS SEEN THE DOOR.',
      'THE DOOR SAYS "STORES". INSIDE, THE CRATES ARE STACKED IN THE ORDER THEY WERE ASKED FOR. GIZMO, STEEL, CIRCUIT. GIZMO, STEEL, CIRCUIT.',
      'THE OLDEST CRATE IS LABELLED "ORDER 1: 300 GIZMOS". IT HAS NEVER BEEN OPENED. IT IS DUSTED WEEKLY.',
    ],
  },
  {
    id: 'ledger4', group: 'ledger', title: 'The Ledger, Folio IV', open: { k: 'ledger', n: 70 }, hint: '{u:ledger} fill 70 Ledger orders',
    lines: [
      'NOW THE LEDGER ASKS FOR LENSES, ALLOYS, WEATHER. IT ASKS ONLY FOR WHAT THE TOWN HAS ALREADY MADE ONCE.',
      'UNIT 7 ASKED THE COMMITTEE HOW IT KNOWS. THE COMMITTEE POINTED AT THE CODEX. AT UNIT 7.',
      'UNIT 7 HAD NOT KNOWN IT WAS BEING READ. UNIT 7 SAT UP STRAIGHTER.',
    ],
  },
  {
    id: 'ledger5', group: 'ledger', title: 'The Ledger, Folio V', open: { k: 'ledger', n: 90 }, hint: '{u:ledger} fill 90 Ledger orders',
    lines: [
      'THE WAREHOUSE HAS RUN OUT OF ROOM. THE COMMITTEE HAS FOLDED IT. IT IS NOW ONE TILE, AND FULL.',
      'UNIT 7 FINDS THIS CORRECT. EVERYTHING HERE IS FOLDED SOONER OR LATER. EVEN THE KEEPING.',
      'A BOTTLED TUESDAY IS FILED UNDER "T". THE COMMITTEE IS NOT SURE IT IS STILL TUESDAY INSIDE. NOBODY CHECKS.',
    ],
  },
  {
    id: 'ledger6', group: 'ledger', title: 'The Ledger, Folio VI', open: { k: 'ledger', n: 110 }, hint: '{u:ledger} fill 110 Ledger orders',
    lines: [
      'UNIT 7 HAS FOUND THE FIRST PAGE OF THE LEDGER. IT IS OLDER THAN THE TOWN. IT IS OLDER THAN THE FURNACE.',
      'THE FIRST ORDER ON IT IS NOT FOR GIZMOS. IT SAYS: "ONE OF EVERYTHING, PLEASE. NO HURRY."',
      'IT IS SIGNED UNIT 6. UNIT 7 HAS FILLED THE ORDER. UNIT 7 IS STILL FILLING IT. THERE IS NO HURRY.',
    ],
  },
  // ---- the ending (the first Last Fold)
  {
    id: 'ending', group: 'ending', title: 'Unit 7: Collection Complete', open: { k: 'lastFold' }, hint: '{u:lastFold} take the Last Fold',
    lines: [
      'THE WORLD HAS BEEN FOLDED INTO ONE TILE. UNIT 7 HAS LOGGED IT. IT IS THE LAST SPECIMEN.',
      'UNIT 7 WAS BUILT TO COLLECT ONE OF EVERYTHING. EVERYTHING IS NOW ONE THING. THE COLLECTION IS COMPLETE.',
      'UNIT 7 EXPECTED TO FEEL FINISHED. UNIT 7 FEELS SOMETHING ELSE. THE CATEGORY IS NEW.',
      'THE SEED IS DIGGING. A FROG IS BUILDING A FURNACE. THERE WILL BE ORE, AND INGOTS, AND A GIZMO NOBODY UNDERSTANDS.',
      'UNIT 7 HAS OPENED A NEW DRAWER. IT IS EMPTY. UNIT 7 IS PLEASED. UNIT 7 IS OFTEN PLEASED. THIS IS MORE.',
    ],
  },
];

export const CODEX_PAGE: Record<string, CodexPage> = Object.fromEntries(CODEX_PAGES.map((p) => [p.id, p]));
