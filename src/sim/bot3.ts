// The Act III bot (ROADMAP.md Milestone 7, DESIGN.md §21): a competent player from the end of the
// Act II plan, once the Great Drill's stage 3 stands, on into the District. Honest like bot2.ts,
// whose hands it shares (Act2Bot.act): every action is a command through g.act, building commands
// at 4 a second at most, clicks on their own 4-a-second pace, and it reads only what the screen
// shows (research and order progress, the Chute's stock, module buffers and pips, route readouts).
//
// The Act II bot stays on as the Workshop lab's keeper (its valves, its relays, Overdrive, Sparks,
// the Drawer) and as this bot's builder: Workshop layouts, Factory placements by search and nested
// folds are pushed onto its plan as its own steps. What is new here:
//  - research page 3 in a sensible order (WISH3), paid by the Factory (the old Bay floor re-laid to
//    feed the Factory Hopper), the lab and, once open, the District Hopper;
//  - the Factory Chute in the annex, fed by source modules found by search;
//  - tier 3 lines on the Workshop (chunk D) from one generic layout per recipe: a chain of machines
//    facing east, each fed through its back by the one before and from above and below by Chute
//    Mouths outside the fold box (a fold box may not hold one), the product belted north to the
//    corridor and so to the Hopper, so the audit runs at speed;
//  - groups nested on the Factory's bench (its west 6x6) from those modules and their feeders;
//  - the District: groups placed beside what they feed, skiff routes to the module, Hopper, Bay or
//    Dock that wants their goods (a byproduct always to the Dock), a skiff more on any route
//    carrying under 90% of its want, lots bought as the floor fills, Overdrive on route groups;
//  - the Floating City at the District Bay, and Act III orders the District can fill.
import type { Game, Cmd } from './Game';
import { Act2Bot, BAY_PLAN, PHASE_M, PHASE_Z, working, type Dest, type FPl, type Pl, type PlaceZone, type Step as Step2 } from './bot2';
import { RESEARCH, type ResearchId } from '../data/research';
import { ITEMS, type ItemId } from '../data/items';
import { RECIPE } from '../data/recipes';
import { HIGH, type HighFloorId } from '../data/floors';
import { TICK_RATE } from '../engine/time';
import { available, megaComplete } from './systems/research';
import { BYPRODUCTS, mainItem, stampCost, stampRefusal } from './systems/modules';
import { hent, hentAt, hfloor, hfoldRefusal, HIGH_IDS, highW, routeCap, routeWant, bayWants, lotPrice, hplaceRefusal, maxRoutes, routeRefusal } from './systems/high';
import { claimLoad, claimPrice, claimsHeld, placedClaims } from './systems/claims';
import { ffoldRefusal } from './systems/nested';
import { ORDER } from '../data/orders';
import { hopperWantsWaste } from './transfer';
import { FACTORY } from '../data/land';
import type { Box, Dir, FEnt, ModuleDesign } from './world';

const E: Dir = 0, S: Dir = 1, W: Dir = 2, N: Dir = 3;

/** Act III research, in the order this player takes it (a node whose cost the bank already holds
 * goes first, as in bot2). */
export const WISH3: ResearchId[] = ['zoning', 'chutes', 'bearings', 'servos', 'floatingCity', 'chemistry', 'vulcanizing', 'processors', 'sensors', 'robotics', 'districtFolds', 'batteries', 'recycling', 'hydroponics', 'sandwiches', 'sandwichEngineering', 'scrapTransmuter'];

// ------------------------------------------------------------------ Workshop lines

interface MachineSpec { kind: 'press' | 'assembler'; recipe: string; n?: ItemId; s?: ItemId }

/** A tier 3 line drawn by the generic layout: machines in a row facing east, each fed through its
 * back by the one before (the first by the `w` Chute Mouth), and from above (`n`) and below (`s`). */
export interface LineSpec { name: string; product: ItemId; w: ItemId; ms: MachineSpec[]; needs: ResearchId[]; stand?: boolean; mix?: ItemId }

export const LINES: Record<string, LineSpec> = {
  gears: { name: 'Gears', product: 'gear', w: 'ironIngot', needs: [], ms: [{ kind: 'press', recipe: 'pressPlate' }, { kind: 'assembler', recipe: 'cutGear' }] },
  motors: {
    name: 'Motors', product: 'motor', w: 'glass', needs: [],
    ms: [{ kind: 'assembler', recipe: 'etchCircuit', n: 'copperWire', s: 'plastic' }, { kind: 'assembler', recipe: 'buildMotor', n: 'steel', s: 'copperWire' }],
  },
  gearboxes: {
    name: 'Gearboxes', product: 'gearbox', w: 'steel', needs: ['bearings'],
    ms: [{ kind: 'press', recipe: 'pressBearing' }, { kind: 'assembler', recipe: 'buildGearbox', n: 'gear', s: 'steel' }],
  },
  servos: {
    name: 'Servos', product: 'servo', w: 'steel', needs: ['bearings', 'servos'],
    ms: [{ kind: 'press', recipe: 'pressBearing' }, { kind: 'assembler', recipe: 'buildGearbox', n: 'gear', s: 'steel' }, { kind: 'assembler', recipe: 'buildServo', n: 'motor', s: 'circuit' }],
  },
  rotors: {
    name: 'Lift rotors', product: 'liftRotor', w: 'steel', needs: ['bearings', 'floatingCity'],
    ms: [{ kind: 'press', recipe: 'pressBearing' }, { kind: 'assembler', recipe: 'buildGearbox', n: 'gear', s: 'steel' }, { kind: 'assembler', recipe: 'buildLiftRotor', n: 'motor', s: 'steel' }],
  },
  // chemistry's unpowered steps (the rubber comes down the Chute from the Factory's Rubber II feed).
  // A fold box takes two kinds of machine or one feeding another, so each is a pair (measured: a
  // lone Sensor assembler was refused, "A module is a line"): Sensors etch their own circuits from
  // the Chute's wire, plastic and glass; Robot arms build their own sensors, the servos and steel
  // from the Chute
  sensors: {
    name: 'Sensors', product: 'sensor', w: 'glass', needs: ['sensors'],
    ms: [{ kind: 'assembler', recipe: 'etchCircuit', n: 'copperWire', s: 'plastic' }, { kind: 'assembler', recipe: 'buildSensor', n: 'glass', s: 'rubber' }],
  },
  arms: {
    // (it stands unfolded, feeding the Hopper: its group, Arms II, takes two Servos II chains, a
    // Circuits II and a Rubber II from outside, more than the bench round it holds, measured, and
    // the folded copy alone on the Factory made no arms)
    name: 'Robot arms', product: 'robotArm', w: 'glass', needs: ['robotics'], stand: true,
    ms: [{ kind: 'assembler', recipe: 'buildSensor', n: 'circuit', s: 'rubber' }, { kind: 'assembler', recipe: 'buildArm', n: 'servo', s: 'steel' }],
  },
  // the Self-Folding Umbrella (servo + 2 rubber + plastic + steel): four inputs, a 1x1 Assembler's
  // three faces, so the steel and the plastic share its back belt (`mix`); one machine is not a line,
  // so it stands, feeding the Hopper (Relocation wants 20)
  umbrellas: { name: 'Umbrellas', product: 'umbrella', w: 'steel', mix: 'plastic', needs: ['robotics'], stand: true, ms: [{ kind: 'assembler', recipe: 'foldUmbrella', n: 'servo', s: 'rubber' }] },
  // bearings for the Sky Anchor (800): a press on the Chute's steel, standing in the umbrellas' slot
  // once the Mk2 has made Relocation's umbrellas (a lone press is not a line, so it never folds; the
  // Gearboxes line's press feeds its own assembler), feeding the Hopper
  bearings: { name: 'Bearings', product: 'bearing', w: 'steel', needs: ['bearings'], stand: true, ms: [{ kind: 'press', recipe: 'pressBearing' }] },
};

/** The chemistry corner (chunk E's south-east, x 17-23, y 6-9, once the lab's concrete plant, its
 * gravel press and the steel line are lifted: LAB_C). A Chem Vat draws power and power never
 * crosses a fold box, so the box holds its own plant: an oil Boiler (fed by a Chute Mouth) steaming
 * an Engine, and a Pole 7 tiles from E's (so the two grids never join). The vat at (21,7) faces
 * west: its product belted west along row 7 into the loop at (16,7) and so to the Hopper; its back
 * (22,7) and top (21,6) take inputs; its waste goes out of its south side into two crates.
 * Solvent: a sand Miner on the patch (21,6) feeds the vat from above (a Miner and a Chem Vat:
 * two kinds of machine, so it folds, and the module holds a sand claim), oil from the Chute.
 * Rubber: plastic from above, solvent from behind, both from the Chute. */
const CHEM_PLANT: Pl[] = [
  { kind: 'chuteMouth', x: 17, y: 9, rot: E, recipe: 'oil' },
  { kind: 'boiler', x: 18, y: 9, rot: E },
  { kind: 'steamEngine', x: 19, y: 9, rot: E },
  { kind: 'pole', x: 20, y: 9, rot: E },
  ...[20, 19, 18, 17].map((x): Pl => ({ kind: 'belt', x, y: 7, rot: W })),
];

export interface CornerSpec { name: string; product: ItemId; needs: ResearchId[]; parts: Pl[]; box: Box; last: { x: number; y: number }; stand?: ResearchId[] }

const CORNER_SOLVENT: Pl[] = [
  ...CHEM_PLANT,
  { kind: 'miner', x: 21, y: 6, rot: S },
  { kind: 'chemVat', x: 21, y: 7, rot: W, recipe: 'mixSolvent' },
  { kind: 'chuteMouth', x: 22, y: 7, rot: W, recipe: 'oil' },
  { kind: 'belt', x: 21, y: 8, rot: E },
  { kind: 'crate', x: 22, y: 8, rot: E },
  { kind: 'crate', x: 23, y: 8, rot: N },
];

export const CORNER: Record<string, CornerSpec> = {
  // run until research has the solvent it wants (Vulcanizing and Processors: a player lets the
  // line pay its research before folding it), then folded
  solvent: { name: 'Solvent', product: 'solvent', needs: ['chemistry'], box: { x: 18, y: 6, w: 4, h: 4 }, last: { x: 21, y: 7 }, parts: CORNER_SOLVENT },
  // the solvent vat's chains: a second machine at (20,7) takes the solvent through its back and its
  // other input from above, belted down from a Chute Mouth at (20,5) outside the box
  rubber: {
    name: 'Rubber', product: 'rubber', needs: ['vulcanizing'], box: { x: 18, y: 6, w: 4, h: 4 }, last: { x: 20, y: 7 },
    parts: chain({ kind: 'chemVat', x: 20, y: 7, rot: W, recipe: 'cureRubber' }, 'plastic'),
  },
  processors: {
    name: 'Processors', product: 'processor', needs: ['processors'], box: { x: 18, y: 6, w: 4, h: 4 }, last: { x: 20, y: 7 },
    parts: chain({ kind: 'assembler', x: 20, y: 7, rot: W, recipe: 'etchProcessor' }, 'circuit'),
  },
};

/** The Solvent line again, unfolded, once the corner is free: it feeds the Hopper Batteries' 150
 * solvent (`stand`: lifted once that research has it; measured, the third pass: the Solvent line
 * folds once Vulcanizing and Processors are paid, and nothing else here sent the Hopper solvent:
 * the Solvent feed's copies starved for oil, and Batteries waited the hour out). Its oil is the
 * Chute's, the feeders' byproduct. */
CORNER.solventB = { name: 'Solvent (again)', product: 'solvent', needs: ['chemistry'], box: { x: 18, y: 6, w: 4, h: 4 }, last: { x: 21, y: 7 }, parts: CORNER_SOLVENT, stand: ['batteries'] };

/** Batteries (DESIGN.md §21 Tier 3: 2 copper ingots + solvent + plastic in the Chem Vat): the
 * solvent vat's chain like Rubber's, its plastic from above (the Chute Mouth at (20,5)) and its
 * copper ingots from below, belted in along row 8 from a Chute Mouth at (17,8) outside the box (the
 * Chute's copper comes from the Copper ingots feed). */
CORNER.batteries = {
  name: 'Batteries', product: 'battery', needs: ['batteries'], box: { x: 18, y: 6, w: 4, h: 4 }, last: { x: 20, y: 7 },
  parts: [
    ...chain({ kind: 'chemVat', x: 20, y: 7, rot: W, recipe: 'cellBattery' }, 'plastic'),
    { kind: 'chuteMouth', x: 17, y: 8, rot: E, recipe: 'copperIngot' },
    { kind: 'belt', x: 18, y: 8, rot: E }, { kind: 'belt', x: 19, y: 8, rot: E }, { kind: 'belt', x: 20, y: 8, rot: N },
  ],
};

/** The corner's own solvent vat with its sludge kept (Relocation's chain, the fourth pass): the
 * sand Miner at (21,6) into a Chem Vat at (21,7) facing west, oil from a Chute Mouth at its back
 * (22,7), its solvent west along row 7 into the loop at (16,7) and so to the Hopper; its sludge
 * leaves by its south side (21,8). A Pole at (22,6) joins the lab's grid (these lines stand and are
 * never folded, so their power may cross: an oil Boiler of their own burned the oil the vat wanted,
 * measured) (row 6 west of the Pole is left free: the lab's oil splitter at (19,5) would send oil
 * into a belt at (19,6)). Once Recycling is known the solvent vat runs in Byproduct mode, twice the
 * sludge for the oil (`modes`; DESIGN.md §21 Modes names this use). Measured, the third pass: the Factory's
 * Solvent copies never got their Plastic copies, "no room", so no sludge came at all; the oil feed's
 * Plastic copies are put back for their oil, `oil2`). */
const SOLVENT_CORE: Pl[] = [
  { kind: 'miner', x: 21, y: 6, rot: S },
  { kind: 'chemVat', x: 21, y: 7, rot: W, recipe: 'mixSolvent' },
  { kind: 'chuteMouth', x: 22, y: 7, rot: W, recipe: 'oil' },
  ...[20, 19, 18, 17].map((x): Pl => ({ kind: 'belt', x, y: 7, rot: W })),
  { kind: 'pole', x: 22, y: 6, rot: E },
];

/** Sludge for Hydroponics (300): the solvent vat's sludge belted south and round row 9 and up column
 * 18 into the same loop, so the Hopper takes it while Hydroponics wants it. It stands until
 * Hydroponics has its sludge. */
CORNER.sludge = {
  name: 'Sludge', product: 'sludge', needs: ['chemistry'], box: { x: 18, y: 6, w: 5, h: 4 }, last: { x: 21, y: 7 }, stand: ['hydroponics'],
  parts: [
    ...SOLVENT_CORE,
    { kind: 'belt', x: 21, y: 8, rot: S }, { kind: 'belt', x: 21, y: 9, rot: W }, { kind: 'belt', x: 20, y: 9, rot: W }, { kind: 'belt', x: 19, y: 9, rot: W },
    { kind: 'belt', x: 18, y: 9, rot: N }, { kind: 'belt', x: 18, y: 8, rot: N },
  ],
};

/** Hydroponics' line (DESIGN.md §21 Tier 3: 2 sludge + gravel → fertilizer in the Chem Vat,
 * fertilizer → 3 produce in the Greenhouse): the solvent vat's sludge goes south into a fertilizer
 * vat at (21,8) facing west into a Greenhouse (19,8)-(20,9) facing west, whose produce goes up
 * (18,8) into the loop and so to the Hopper. The fertilizer vat's gravel comes from a press behind
 * it (22,8) crushing the Chute's slag (every Act II module's waste comes down with its goods) from
 * a Chute Mouth at (22,9). It stands, feeding the Hopper, until Sandwiches has its 400 produce. */
const CORNER_PRODUCE: Pl[] = [
  ...SOLVENT_CORE,
  { kind: 'chemVat', x: 21, y: 8, rot: W, recipe: 'brewFertilizer' },
  { kind: 'press', x: 22, y: 8, rot: W, recipe: 'crushGravel' }, { kind: 'chuteMouth', x: 22, y: 9, rot: N, recipe: 'slag' },
  { kind: 'greenhouse', x: 19, y: 8, rot: W, recipe: 'growProduce' },
];
CORNER.produce = { name: 'Produce', product: 'produce', needs: ['hydroponics'], box: { x: 18, y: 6, w: 5, h: 4 }, last: { x: 19, y: 8 }, parts: [...CORNER_PRODUCE, { kind: 'belt', x: 18, y: 8, rot: N }], stand: ['sandwiches'] };

/** Sandwiches (3 produce + plastic in an Assembler): the Produce line with an Assembler at (18,8)
 * facing north, taking the Greenhouse's produce through its side and plastic from a Chute Mouth at
 * (17,8), its sandwiches up into the loop to the Hopper. It stands, feeding the Hopper, until
 * Sandwich Engineering has its 150 sandwiches. */
CORNER.sandwich = {
  name: 'Sandwiches', product: 'sandwich', needs: ['sandwiches'], box: { x: 18, y: 6, w: 5, h: 4 }, last: { x: 18, y: 8 }, stand: ['sandwichEngineering'],
  parts: [...CORNER_PRODUCE, { kind: 'assembler', x: 18, y: 8, rot: N, recipe: 'makeSandwich' }, { kind: 'chuteMouth', x: 17, y: 8, rot: E, recipe: 'plastic' }],
};

/** The Autonomous Sandwich Engineer (robot arm + processor + 10 sandwiches + battery, Assembler Mk2
 * only, DESIGN.md §21 Tier 3): its four inputs meet at a Mk2 at (16,9)-(17,10) facing west, whose
 * Engineers side-load onto the kit line's column 15 and so up the corridor to the Hopper.
 * - Sandwiches into its east face: the solvent vat's sludge goes down (21,8) into the fertilizer
 *   vat (21,9), then the Greenhouse (19,9)-(20,10), then the sandwich Assembler (18,9) facing the
 *   Mk2 (its plastic from (18,10)).
 * - Batteries into its north face: the solvent vat's front is a Splitter (20,7) whose west side
 *   feeds a battery vat (19,7) (copper ingots and plastic side-loaded onto (19,8) from (20,8) and
 *   (18,8)), the batteries belted round (18,7)-(17,8); its north side sends the rest of the solvent
 *   along row 6 into the lab's loop at (17,6) (a battery takes 1 solvent, an Engineer's 10
 *   sandwiches 20 of the vat's crafts: without the overflow the battery belt fills and the vat, its
 *   sludge and the sandwiches stop, measured).
 * - Processors into its north face from a Chute Mouth at (16,8) (a Processors II Chute feeder).
 * - Arms into its south face: a sensor Assembler (17,12) into an arm Assembler (17,11), as the arms
 *   line, each fed by Chute Mouths.
 * Poles at (22,8), (20,5) and (19,11); an oil Boiler (23,7) and Engine (23,8) of its own (650 kW of
 * machines). It stands, feeding the Hopper, until Relocation has its 3 Engineers. */
CORNER.engineer = {
  name: 'Engineers', product: 'sandwichEngineer', needs: ['sandwichEngineering'], box: { x: 16, y: 6, w: 7, h: 8 }, last: { x: 16, y: 9 }, stand: ['relocation'],
  parts: [
    { kind: 'miner', x: 21, y: 6, rot: S },
    { kind: 'chemVat', x: 21, y: 7, rot: W, recipe: 'mixSolvent' }, { kind: 'chuteMouth', x: 22, y: 7, rot: W, recipe: 'oil' },
    { kind: 'belt', x: 21, y: 8, rot: S },
    { kind: 'chemVat', x: 21, y: 9, rot: W, recipe: 'brewFertilizer' },
    { kind: 'press', x: 22, y: 9, rot: W, recipe: 'crushGravel' }, { kind: 'chuteMouth', x: 23, y: 9, rot: W, recipe: 'slag' },
    { kind: 'greenhouse', x: 19, y: 9, rot: W, recipe: 'growProduce' },
    { kind: 'assembler', x: 18, y: 9, rot: W, recipe: 'makeSandwich' }, { kind: 'chuteMouth', x: 18, y: 10, rot: N, recipe: 'plastic' },
    { kind: 'splitter', x: 20, y: 7, rot: W },
    { kind: 'belt', x: 20, y: 6, rot: W }, { kind: 'belt', x: 19, y: 6, rot: W }, { kind: 'belt', x: 18, y: 6, rot: W },
    { kind: 'chemVat', x: 19, y: 7, rot: W, recipe: 'cellBattery' },
    { kind: 'belt', x: 19, y: 8, rot: N }, { kind: 'chuteMouth', x: 20, y: 8, rot: W, recipe: 'copperIngot' }, { kind: 'chuteMouth', x: 18, y: 8, rot: E, recipe: 'plastic' },
    { kind: 'belt', x: 18, y: 7, rot: W }, { kind: 'belt', x: 17, y: 7, rot: S }, { kind: 'belt', x: 17, y: 8, rot: S },
    { kind: 'assemblerMk2', x: 16, y: 9, rot: W, recipe: 'buildEngineer' },
    { kind: 'chuteMouth', x: 16, y: 8, rot: S, recipe: 'processor' },
    { kind: 'assembler', x: 17, y: 11, rot: N, recipe: 'buildArm' }, { kind: 'chuteMouth', x: 18, y: 11, rot: W, recipe: 'servo' }, { kind: 'chuteMouth', x: 16, y: 11, rot: E, recipe: 'steel' },
    { kind: 'assembler', x: 17, y: 12, rot: N, recipe: 'buildSensor' }, { kind: 'chuteMouth', x: 17, y: 13, rot: N, recipe: 'glass' },
    { kind: 'chuteMouth', x: 18, y: 12, rot: W, recipe: 'circuit' }, { kind: 'chuteMouth', x: 16, y: 12, rot: E, recipe: 'rubber' },
    { kind: 'pole', x: 22, y: 8, rot: E }, { kind: 'pole', x: 20, y: 5, rot: E }, { kind: 'pole', x: 19, y: 11, rot: E },
    { kind: 'chuteMouth', x: 23, y: 6, rot: S, recipe: 'oil' }, { kind: 'boiler', x: 23, y: 7, rot: S }, { kind: 'steamEngine', x: 23, y: 8, rot: E },
  ],
};

/** Umbrellas in the corner once the Engineers are in (Relocation's last 20): an Assembler Mk2 at
 * (16,8)-(17,9) facing west onto the kit line's column 15, its four inputs each from its own Chute
 * Mouth (servo from (17,7), rubber and plastic into its east face, steel into its south face): the
 * slot's 1x1 umbrella Assembler shares its back between steel and plastic through a Merger, and once
 * its steel buffer filled while the plastic stock stood at 0 the Merger held a steel it could not
 * hand on for good (measured, the fourth pass: 5-13 of 20). Poles at (22,6) and (18,10) join the
 * lab's grid; an oil Boiler and Engine of its own for the Mk2's 200 kW. It stands until Relocation
 * has its umbrellas. */
CORNER.umbrellas2 = {
  name: 'Umbrellas (Mk2)', product: 'umbrella', needs: ['robotics'], box: { x: 16, y: 7, w: 3, h: 4 }, last: { x: 16, y: 8 }, stand: ['relocation'],
  parts: [
    { kind: 'assemblerMk2', x: 16, y: 8, rot: W, recipe: 'foldUmbrella' },
    { kind: 'chuteMouth', x: 17, y: 7, rot: S, recipe: 'servo' }, { kind: 'chuteMouth', x: 18, y: 8, rot: W, recipe: 'rubber' },
    { kind: 'chuteMouth', x: 18, y: 9, rot: W, recipe: 'plastic' }, { kind: 'chuteMouth', x: 16, y: 10, rot: N, recipe: 'steel' },
    { kind: 'pole', x: 22, y: 6, rot: E }, { kind: 'pole', x: 18, y: 10, rot: E },
    { kind: 'chuteMouth', x: 23, y: 6, rot: S, recipe: 'oil' }, { kind: 'boiler', x: 23, y: 7, rot: S }, { kind: 'steamEngine', x: 23, y: 8, rot: E },
  ],
};

// ---- Act III's Megaprojects (the fifth pass): the City's stage 2 wants glass and sandwiches at the
// District Bay, the Transmuter coils, so each is a corner line folded with its own power plant
// (power never crosses a fold box: a Pole at y 9, 7 tiles from E's at (19,2), so the grids never
// join; every Chute Mouth outside the box), nested on the bench with the copies that feed it, and
// copies stood on the District, routed to the Bay while it wants their goods. A Glass copy alone
// can't join a group (it takes nothing in, so no trunk inside the box reaches it), which is why
// the glass is fired in a kiln that burns a Plastic copy's oil.

/** Glass for the City's Spires (2,500): the sand Miner (21,6) into a Kiln (21,7) facing west, its
 * glass west along row 7 into the loop; its plant a Pole (21,9), an Engine (21,10) and an oil Boiler
 * (22,10) fed from a Chute Mouth at (23,10). Its design takes oil (the boiler's) and makes glass. */
CORNER.glassF = {
  name: 'Glassworks', product: 'glass', needs: ['glassworks'], box: { x: 20, y: 6, w: 3, h: 5 }, last: { x: 21, y: 7 },
  parts: [
    { kind: 'miner', x: 21, y: 6, rot: S },
    { kind: 'kiln', x: 21, y: 7, rot: W, recipe: 'fireGlass' },
    ...[20, 19, 18, 17].map((x): Pl => ({ kind: 'belt', x, y: 7, rot: W })),
    { kind: 'pole', x: 21, y: 9, rot: E },
    { kind: 'steamEngine', x: 21, y: 10, rot: E },
    { kind: 'boiler', x: 22, y: 10, rot: W }, { kind: 'chuteMouth', x: 23, y: 10, rot: W, recipe: 'oil' },
  ],
};

/** Sandwiches for the City's Spires (300), folded: the Sandwiches line (CORNER.sandwich) laid so
 * every Chute Mouth stands outside the box (x 18-22, y 6-10): the solvent vat's oil belted in from
 * (23,7), the gravel press (22,8) behind the fertilizer vat crushing slag from (23,8), the plastic
 * from (17,8); a Pole (21,9), two Engines (21,10) and (20,10) on oil Boilers (22,10) and (19,10)
 * (the two vats and the Greenhouse draw 350 kW). Solvent and sandwiches leave along row 7. */
CORNER.sandwichF = {
  name: 'Sandwich works', product: 'sandwich', needs: ['sandwiches'], box: { x: 18, y: 6, w: 5, h: 5 }, last: { x: 18, y: 8 },
  parts: [
    { kind: 'miner', x: 21, y: 6, rot: S },
    { kind: 'chemVat', x: 21, y: 7, rot: W, recipe: 'mixSolvent' },
    { kind: 'belt', x: 22, y: 7, rot: W }, { kind: 'chuteMouth', x: 23, y: 7, rot: W, recipe: 'oil' },
    ...[20, 19, 18, 17].map((x): Pl => ({ kind: 'belt', x, y: 7, rot: W })),
    { kind: 'chemVat', x: 21, y: 8, rot: W, recipe: 'brewFertilizer' },
    { kind: 'press', x: 22, y: 8, rot: W, recipe: 'crushGravel' }, { kind: 'chuteMouth', x: 23, y: 8, rot: W, recipe: 'slag' },
    { kind: 'greenhouse', x: 19, y: 8, rot: W, recipe: 'growProduce' },
    { kind: 'assembler', x: 18, y: 8, rot: N, recipe: 'makeSandwich' }, { kind: 'chuteMouth', x: 17, y: 8, rot: E, recipe: 'plastic' },
    { kind: 'pole', x: 21, y: 9, rot: E },
    { kind: 'steamEngine', x: 21, y: 10, rot: E }, { kind: 'boiler', x: 22, y: 10, rot: W }, { kind: 'chuteMouth', x: 23, y: 10, rot: W, recipe: 'oil' },
    { kind: 'steamEngine', x: 20, y: 10, rot: E }, { kind: 'boiler', x: 19, y: 10, rot: E }, { kind: 'chuteMouth', x: 19, y: 11, rot: N, recipe: 'oil' },
  ],
};

/** Transmuter coils (processor + 2 batteries + 4 rubber): the solvent vat (21,7) into a battery vat
 * (20,7) into a coil Assembler (19,7) facing west onto row 7: the battery vat's plastic from (20,5),
 * its copper belted up column 20 from (20,12); the coil's processors side-loaded onto (19,6) from
 * (18,6), its rubber up column 19 from (19,12); the solvent vat's sludge into two crates east of it
 * (21,8)-(22,8); a Pole (21,9), an Engine (21,10) on an oil Boiler (21,11) fed from (22,11). The
 * lab's oil splitter at (19,5) is a plain belt west while it runs (`OIL_W`: its south side would
 * push oil onto the processor belt). */
CORNER.coils = {
  name: 'Coils', product: 'transmuterCoil', needs: ['scrapTransmuter'], box: { x: 19, y: 6, w: 3, h: 6 }, last: { x: 19, y: 7 },
  parts: [
    { kind: 'miner', x: 21, y: 6, rot: S },
    { kind: 'chemVat', x: 21, y: 7, rot: W, recipe: 'mixSolvent' }, { kind: 'chuteMouth', x: 22, y: 7, rot: W, recipe: 'oil' },
    { kind: 'crate', x: 21, y: 8, rot: E }, { kind: 'crate', x: 22, y: 8, rot: E },
    { kind: 'chemVat', x: 20, y: 7, rot: W, recipe: 'cellBattery' },
    { kind: 'belt', x: 20, y: 6, rot: S }, { kind: 'chuteMouth', x: 20, y: 5, rot: S, recipe: 'plastic' },
    ...[8, 9, 10, 11].map((y): Pl => ({ kind: 'belt', x: 20, y, rot: N })), { kind: 'chuteMouth', x: 20, y: 12, rot: N, recipe: 'copperIngot' },
    { kind: 'assembler', x: 19, y: 7, rot: W, recipe: 'windCoil' },
    { kind: 'belt', x: 19, y: 6, rot: S }, { kind: 'chuteMouth', x: 18, y: 6, rot: E, recipe: 'processor' },
    ...[8, 9, 10, 11].map((y): Pl => ({ kind: 'belt', x: 19, y, rot: N })), { kind: 'chuteMouth', x: 19, y: 12, rot: N, recipe: 'rubber' },
    { kind: 'belt', x: 18, y: 7, rot: W }, { kind: 'belt', x: 17, y: 7, rot: W },
    { kind: 'pole', x: 21, y: 9, rot: E },
    { kind: 'steamEngine', x: 21, y: 10, rot: E }, { kind: 'boiler', x: 21, y: 11, rot: N }, { kind: 'chuteMouth', x: 22, y: 11, rot: W, recipe: 'oil' },
  ],
};

/** The lab's oil at (19,5) while the coils line runs: a plain belt west into the loop, not the
 * splitter (whose south side would push oil onto the coil line's processor belt at (19,6)). */
export const OIL_W: Pl[] = [{ kind: 'belt', x: 19, y: 5, rot: W }, { kind: 'belt', x: 18, y: 5, rot: W }];

/** The Batteries line again, unfolded, until the Scrap Transmuter has its 100 batteries (measured,
 * the fifth pass: the Hopper banked 8 batteries in four hours; the Batteries copies feeding the
 * Chute make 0.02 a second, short of oil, and the Engineer's vat keeps its own). */
CORNER.batteriesB = { ...CORNER.batteries, name: 'Batteries (again)', stand: ['scrapTransmuter'] };

/** Lines on an ore patch of their own (not a slot, not the corner). Copper ingots: the Great Drill's
 * second copper patch (chunk D, (13,13) 2x2) under a Miner facing north into a Smelter, the ingots
 * east onto the kit line's column 15 and so to the Hopper (batteries research wants 800), the slag
 * north into a brick press at (14,12) that hands its bricks to the same column. A Miner and a Smelter
 * are two kinds of machine, so it folds ("Copper ingots", as Iron ingots folds); its copies feed the
 * Factory Chute the battery vat's copper (`FEEDS.copper`). Nothing but a Factory module made copper
 * ingots before: the Copper wire design presses its own. */
export const PATCH: Record<string, CornerSpec> = {
  copper: {
    name: 'Copper ingots', product: 'copperIngot', needs: [], box: { x: 14, y: 13, w: 1, h: 2 }, last: { x: 14, y: 13 },
    parts: [
      { kind: 'miner', x: 14, y: 14, rot: N },
      { kind: 'smelter', x: 14, y: 13, rot: E, recipe: 'smeltCopper' },
      { kind: 'press', x: 14, y: 12, rot: E, recipe: 'pressBrick' },
    ],
  },
};

/** Every Chute Mouth of a line has its item in the Chute's stock: a line is measured only while its
 * Chute inputs are coming in (the fifth pass: in runs 4 and 5 the Servos line folded on its buffers
 * with the Chute's circuits at 0, "Servos" taking nothing in, so Servos II took no circuits and the
 * Floating City waited on servos). Slot lines only: a corner vat draws the Chute's oil as it comes, so
 * its stock stands at 0 while the line runs well. */
export function stocked(g: Game, parts: Pl[]): boolean {
  return parts.every((p) => p.kind !== 'chuteMouth' || !p.recipe || (g.s.chute?.[p.recipe as ItemId] ?? 0) >= 1);
}

function chain(second: Pl, item: ItemId): Pl[] {
  const solvent = CORNER_SOLVENT.filter((p) => !(p.kind === 'belt' && p.y === 7 && p.x === 20));
  return [...solvent, second, { kind: 'belt', x: 20, y: 6, rot: S }, { kind: 'chuteMouth', x: 20, y: 5, rot: S, recipe: item }];
}

/** The lab for chemistry: Act II's lab without the concrete plant, its gravel press and the steel
 * line (the District's groups make concrete and steel now), so chunk E's south-east corner is free
 * for the chemistry corner. Circuits go on to the Hopper (Sensors and Processors want them). */
export const LAB_C = PHASE_Z.filter((p) => !['gravel', 'g18', 'concrete', 'steel', 'steelSlagHeap'].includes(p));

/** A Factory module placed by search to feed the Chute (or another of its feed), for a Workshop
 * line that takes a good no hand-laid feeder makes: `to` the Chute or a feed's index, `by` where its
 * waste goes. */
interface Feed { design: string; to: 'chute' | 'dock' | number; by?: 'chute' | 'dock' | 'hopper' | number }
export const FEEDS: Record<string, Feed[]> = {
  // oil: Plastic copies whose plastic sells at the Dock and whose oil goes down the Chute
  oil: [0, 1, 2, 3].map((): Feed => ({ design: 'Plastic', to: 'dock', by: 'chute' })),
  oil2: [0, 1, 2, 3].map((): Feed => ({ design: 'Plastic', to: 'dock', by: 'chute' })),
  // (again for the coils line, once the battery feed is lifted: the oil2 copies found no room)
  oil3: [0, 1, 2, 3].map((): Feed => ({ design: 'Plastic', to: 'dock', by: 'chute' })),
  // rubber: a Rubber II group (its own Plastic copies inside: it takes nothing) into the Chute (a
  // Rubber copy with its Plastic feeders found no room by the Chute, measured)
  rubber: [{ design: 'Rubber II', to: 'chute', by: 'dock' }],
  // servos for the arms line: two Servos II groups, each fed by a Motors II and a Circuits II group
  // (an arm takes 2 servos every 16 s; with one the line stood starved of servos, measured)
  // copper ingots for the battery vat and Batteries research (the research drain sends the Hopper
  // what research wants of the Chute's stock)
  copper: [{ design: 'Copper ingots', to: 'chute', by: 'dock' }, { design: 'Copper ingots', to: 'chute', by: 'dock' }],
  // solvent and sludge: Solvent copies send their solvent down the Chute (Batteries research wants
  // 150, the research drain sends it) and their sludge to the Factory Hopper, which takes it while
  // Hydroponics wants it (300); their oil from Plastic copies whose plastic sells
  chem: [
    { design: 'Solvent', to: 'chute', by: 'chute' }, { design: 'Plastic', to: 'dock', by: 0 }, { design: 'Plastic', to: 'dock', by: 0 },
    { design: 'Solvent', to: 'chute', by: 'chute' }, { design: 'Plastic', to: 'dock', by: 3 }, { design: 'Plastic', to: 'dock', by: 3 },
  ],
  // batteries down the Chute (the Lighthouse wants 200, the Engineer one each): a Batteries copy fed
  // its plastic and oil by a Plastic copy, more oil by a second, its copper by a Copper ingots copy
  battery: [
    { design: 'Batteries', to: 'chute', by: 'dock' }, { design: 'Plastic', to: 0, by: 0 }, { design: 'Plastic', to: 'dock', by: 0 }, { design: 'Copper ingots', to: 0, by: 'dock' },
  ],
  servos2: [] as Feed[],
  servos: [
    { design: 'Servos II', to: 'chute', by: 'dock' }, { design: 'Motors II', to: 0, by: 'dock' }, { design: 'Circuits II', to: 0, by: 'dock' },
    { design: 'Servos II', to: 'chute', by: 'dock' }, { design: 'Motors II', to: 3, by: 'dock' }, { design: 'Circuits II', to: 3, by: 'dock' },
  ],
};
FEEDS.servos2 = FEEDS.servos;
FEEDS.servos3 = FEEDS.servos;
FEEDS.servos4 = FEEDS.servos;

/** The Workshop's line slots: machine rows in chunk D (x 8-15, y 7-15, free once Act II's lab is
 * built), the product belted up column 12 into the corridor (row 6) and so to the Hopper. */
const SLOT_ROWS = [8, 12];
const OUT_X = 12;

/** The generic layout of a line in the slot at row y: machines right-aligned to x 11. */
export function lineLayout(spec: LineSpec, y: number): { parts: Pl[]; box: Box; last: { x: number; y: number } } {
  const k = spec.ms.length;
  const x0 = OUT_X - k;
  // (a fourth input shares the back with the first through a Merger, which takes its two inputs
  // in turn: one for one, as the umbrella wants them; a belt with a Mouth side-loading onto it
  // filled with steel and starved the machine of plastic, measured, the fourth pass: 13 of 20)
  const parts: Pl[] = spec.mix
    ? [{ kind: 'chuteMouth', x: x0 - 2, y, rot: E, recipe: spec.w }, { kind: 'merger', x: x0 - 1, y, rot: E }, { kind: 'chuteMouth', x: x0 - 1, y: y - 1, rot: S, recipe: spec.mix }]
    : [{ kind: 'chuteMouth', x: x0 - 1, y, rot: E, recipe: spec.w }];
  spec.ms.forEach((m, i) => {
    const x = x0 + i;
    parts.push({ kind: m.kind, x, y, rot: E, recipe: m.recipe });
    if (m.n) parts.push({ kind: 'chuteMouth', x, y: y - 1, rot: S, recipe: m.n });
    if (m.s) parts.push({ kind: 'chuteMouth', x, y: y + 1, rot: N, recipe: m.s });
  });
  // the output column into the corridor, with a Buffer Crate at each slot's row: the corridor to
  // the Hopper runs full with the lab's banked goods, so a line side-loading into it waited for gaps
  // and stood blocked (measured, the third pass: the Gears line never folded in run 3, 45 min, and
  // the Gearboxes line after it); two crates (100) let it run at speed through its audit, then
  // drain into the corridor as it has room. (The same crates whichever slot is in use, so the two
  // lines' layouts agree on the shared column.)
  for (let yy = y; yy >= 7; yy--) parts.push({ kind: SLOT_ROWS.includes(yy) ? 'crate' : 'belt', x: OUT_X, y: yy, rot: N });
  return { parts, box: { x: x0, y, w: k, h: 1 }, last: { x: OUT_X - 1, y } };
}

/** The standing Machine Kit line (row 15): ingots pressed into plates, cut into gears, packed with
 * steel into kits, belted east and up column 15 into the corridor: the Hopper banks them as parts
 * for stamps of Act II machines (DESIGN.md §18 Machine Kits). Never folded. */
export const KIT_LINE: Pl[] = [
  { kind: 'chuteMouth', x: 8, y: 15, rot: E, recipe: 'ironIngot' },
  { kind: 'press', x: 9, y: 15, rot: E, recipe: 'pressPlate' },
  { kind: 'assembler', x: 10, y: 15, rot: E, recipe: 'cutGear' },
  { kind: 'assembler', x: 11, y: 15, rot: E, recipe: 'packKit' },
  { kind: 'chuteMouth', x: 11, y: 14, rot: S, recipe: 'steel' },
  { kind: 'belt', x: 12, y: 15, rot: E }, { kind: 'belt', x: 13, y: 15, rot: E }, { kind: 'belt', x: 14, y: 15, rot: E },
  ...[15, 14, 13, 12, 11, 10, 9, 8, 7].map((y): Pl => ({ kind: 'belt', x: 15, y, rot: N })),
];

// ------------------------------------------------------------------ the Factory

const ft = (pts: [number, number, Dir][]): FPl[] => pts.map(([x, y, rot]) => ({ kind: 'trunk', x, y, rot }));
const fm = (design: string, x: number, y: number, rot: Dir): FPl => ({ kind: 'module', x, y, rot, design });

/** The old Bay floor while Zoning is researched: the Drill works lifted (its bits are scrap once the
 * Drill is done) and row 7 turned east into the Factory Hopper, so the Concrete, Steel and Circuits
 * copies that fed it pay research instead; the ingots and wire beside the Dock keep selling. */
export const ZONE_PLAN: FPl[] = [
  ...BAY_PLAN.filter((p) => p.design !== 'Drill works' && !(p.kind === 'trunk' && p.y === 7)),
  ...ft([[3, 7, E], [4, 7, E], [5, 7, E], [6, 7, E], [7, 7, E], [8, 7, E], [9, 7, E], [10, 7, N]]),
  fm('Iron ingots', 10, 3, N), fm('Iron ingots', 11, 3, N), fm('Copper wire', 10, 0, S),
];

/** The Factory Chute (DESIGN.md §21) at the foot of the annex, fed by a spine trunk down column 14
 * with source modules on both sides facing it (hand-laid: the search placer could not fit feeders
 * with side trunks for their byproducts). A feeder's byproduct has no side trunk, so it rides out of
 * its front with its product and down the Chute: the Workshop drains it (DRAINS). */
export const CHUTE = { x: 14, y: 7 };
const SPINE: FPl[] = ft([0, 1, 2, 3, 4, 5, 6].map((y): [number, number, Dir] => [14, y, S]));
const FEED_SLOTS: [number, number, Dir][] = [[13, 7, E], [15, 7, W], ...[6, 5, 4, 3, 2, 1, 0].flatMap((y): [number, number, Dir][] => [[13, y, E], [15, y, W]])];
/** The design a Chute feeder of each item is (feedShort). */
const CHUTE_FEEDER: Partial<Record<ItemId, string>> = {
  ironIngot: 'Iron ingots', steel: 'Steel', copperWire: 'Copper wire', plastic: 'Plastic', glass: 'Glass',
  gear: 'Gears II', motor: 'Motors II', circuit: 'Circuits II', gearbox: 'Gearboxes II', servo: 'Servos II', rubber: 'Rubber II',
};
export function chuteFloor(feeders: string[]): FPl[] {
  return [...SPINE, ...feeders.slice(0, FEED_SLOTS.length).flatMap((f, i) => (f ? [fm(f, ...FEED_SLOTS[i])] : []))];
}

/** The Chute's drains on the Workshop (chunk D): oil to the Hopper (Chemistry banks it), slag pressed
 * into bricks; both up into the corridor. Byproducts that come down the Chute never fill its stock
 * and stop the feeder upstream. */
export const DRAINS: Pl[] = [
  { kind: 'chuteMouth', x: 13, y: 11, rot: N, recipe: 'oil' },
  ...[10, 9, 8, 7].map((y): Pl => ({ kind: 'belt', x: 13, y, rot: N })),
  { kind: 'chuteMouth', x: 14, y: 11, rot: N, recipe: 'slag' },
  { kind: 'press', x: 14, y: 10, rot: N, recipe: 'pressBrick' },
  ...[9, 8, 7].map((y): Pl => ({ kind: 'belt', x: 14, y, rot: N })),
];

/** A plastic drain once the Rubber II group feeds the Chute: its second Plastic copy's plastic
 * comes down with the rubber, and a full plastic stock stops the feed (measured: the Sensors line
 * starved for rubber). A Chute Mouth at (5,7) side-loads the plastic onto the Act I belt up column
 * 6 into the Hopper's south side, which banks it (a drain into the shared corridor jammed it,
 * measured); the Mouth pushes only when the belt has room. */
const NO_PARTS: Pl[] = [];
export const PLASTIC_DRAIN: Pl[] = [{ kind: 'chuteMouth', x: 5, y: 7, rot: E, recipe: 'plastic' }];

/** A research drain beside it, (5,8): a Chute Mouth sending the Hopper an item the selected research
 * still wants while the Chute holds a stock of it and no running line draws it (measured: Sensors
 * waited 2.7 h on 200 rubber while the Rubber II feed stood full at the Chute and the District's
 * copies waited on coal claims). */
const researchDrain = (item: ItemId): Pl[] => [{ kind: 'chuteMouth', x: 5, y: 8, rot: E, recipe: item }];

/** The drains once the chemistry corner runs: the slag press only (the oil is the vats'). */
export const DRAINS_C: Pl[] = DRAINS.filter((p) => !(p.x === 13));

/** The bench: groups are built in the 12x8's west 6x6 and nested there; their trunks run anywhere
 * on the 12x8. Modules a group takes in from outside its box stand east of the bench. */
const BENCH: Box = { x: 0, y: 0, w: 6, h: 6 };
const benchZone = (): PlaceZone => ({ mods: BENCH, trunks: { x: 0, y: 0, w: FACTORY.w, h: FACTORY.h } });
const extZone = (): PlaceZone => ({ mods: { x: 6, y: 0, w: FACTORY.w - 6, h: FACTORY.h }, trunks: { x: 0, y: 0, w: FACTORY.w, h: FACTORY.h } });
/** The Chute's feeds (FEEDS): east of the bench, the annex too, with trunks anywhere on the floor (the
 * Chute stands in the annex; the bench zones stop at the 12x8's edge). */
const feedZone = (g: Game, bench = false): PlaceZone => ({ mods: { x: bench ? 0 : 6, y: 0, w: g.fw - (bench ? 0 : 6), h: g.fh }, trunks: { x: 0, y: 0, w: g.fw, h: g.fh } });

/** A group nested on the bench (DESIGN.md §18 Nested folds) for the District: members[0] is the
 * hub, whose product leaves the box for the Factory Dock or Hopper while it is audited; each member
 * names the member its product feeds (an index) or a sink, and where its byproduct goes. `ext` are
 * modules outside the box feeding the hub: the group's ins on the District. */
interface Member { design: string; to: number | 'dock' | 'hopper' | 'bay'; by?: number | 'dock' | 'bay' }
export interface GroupSpec { name: string; members: Member[]; ext?: { design: string; by?: 'dock'; to?: number }[] }

export const GROUPS: Record<string, GroupSpec> = {
  gearsII: { name: 'Gears II', members: [{ design: 'Gears', to: 'dock' }, { design: 'Iron ingots', to: 0, by: 'dock' }] },
  motorsII: {
    name: 'Motors II',
    members: [{ design: 'Motors', to: 'dock' }, { design: 'Copper wire', to: 0, by: 'dock' }, { design: 'Plastic', to: 0, by: 'dock' }, { design: 'Glass', to: 0 }, { design: 'Steel', to: 0, by: 'dock' }],
  },
  circuitsII: { name: 'Circuits II', members: [{ design: 'Circuits', to: 'dock', by: 'dock' }, { design: 'Glass', to: 0 }, { design: 'Plastic', to: 0, by: 'dock' }] },
  gearboxesII: {
    name: 'Gearboxes II',
    members: [{ design: 'Gearboxes', to: 'dock' }, { design: 'Gears', to: 0 }, { design: 'Iron ingots', to: 1, by: 'dock' }, { design: 'Steel', to: 0, by: 'dock' }],
  },
  servosII: {
    name: 'Servos II',
    members: [{ design: 'Servos', to: 'dock' }, { design: 'Gears', to: 0 }, { design: 'Iron ingots', to: 1, by: 'dock' }, { design: 'Steel', to: 0, by: 'dock' }],
    ext: [{ design: 'Motors II', by: 'dock' }, { design: 'Circuits II', by: 'dock' }],
  },
  rotorsII: {
    name: 'Rotors II',
    // (one Steel copy: a second could not reach the rotor assembly's back past three routes)
    members: [{ design: 'Lift rotors', to: 'hopper' }, { design: 'Gears', to: 0 }, { design: 'Iron ingots', to: 1, by: 'dock' }, { design: 'Steel', to: 0, by: 'dock' }],
    ext: [{ design: 'Motors II', by: 'dock' }],
  },
  // concrete for the Floating City: the Concrete copy takes the slag of an ingot and a steel copy and
  // a Plastic copy's oil; the ingots feed a Gears copy, the one main route inside the box
  concreteII: {
    name: 'Concrete II',
    members: [{ design: 'Gears', to: 'dock' }, { design: 'Concrete', to: 'dock' }, { design: 'Iron ingots', to: 0, by: 1 }, { design: 'Steel', to: 'dock', by: 1 }, { design: 'Plastic', to: 'dock', by: 1 }],
  },
  // chemistry (DESIGN.md §21 Tier 3): oil is the bottleneck (a Plastic copy's 0.12 a second feeds
  // an eighth of a vat), so every group carries its own Plastic copies for their oil
  // (a Plastic copy's plastic into the Rubber, a second one's oil: a fold box wants a main route
  // inside, and one copy sending both into the hub could not be laid, measured; two Rubber copies
  // and two Plastic copies crosswise, so the group would make nothing but rubber, could not be laid
  // on the bench either, measured: its spare plastic is drained on the Workshop, PLASTIC_DRAIN)
  rubberII: { name: 'Rubber II', members: [{ design: 'Rubber', to: 'dock', by: 'dock' }, { design: 'Plastic', to: 0, by: 'dock' }, { design: 'Plastic', to: 'dock', by: 0 }] },
  processorsII: {
    name: 'Processors II',
    members: [{ design: 'Processors', to: 'dock', by: 'dock' }, { design: 'Circuits', to: 0 }, { design: 'Glass', to: 1 }, { design: 'Plastic', to: 1, by: 0 }, { design: 'Plastic', to: 'dock', by: 0 }],
  },
  // (the Sensors line etches its own circuits: its copy takes glass, wire, plastic and rubber)
  sensorsII: {
    name: 'Sensors II',
    members: [{ design: 'Sensors', to: 'dock' }, { design: 'Glass', to: 0 }, { design: 'Copper wire', to: 0, by: 'dock' }, { design: 'Plastic', to: 0, by: 'dock' }],
    ext: [{ design: 'Rubber II', by: 'dock' }],
  },
  // (the arms line builds its own sensors: its copy takes glass, circuits, rubber, servos and steel;
  // the Servos II group's own feeders come too: alone it starves and the audit makes nothing)
  armsII: {
    name: 'Arms II',
    members: [{ design: 'Robot arms', to: 'dock' }, { design: 'Steel', to: 0, by: 'dock' }, { design: 'Glass', to: 0 }],
    ext: [{ design: 'Servos II', by: 'dock' }, { design: 'Motors II', by: 'dock', to: 0 }, { design: 'Circuits II', by: 'dock', to: 0 }, { design: 'Circuits II', by: 'dock' }, { design: 'Rubber II', by: 'dock' }],
  },
  // Act III's Megaprojects (the fifth pass, CORNER.glassF, sandwichF, coils): each corner design
  // with the Plastic copies whose oil fires its boilers (and vats), joined to it by that oil. By
  // then the servos feed's trunks wall the bench off from the Dock and the Hopper (measured: Glass
  // II "no room" three times at 12:25 on an empty bench; the Factory Bay beside it takes only the
  // Drill's goods), so the plan lifts that feed while it nests these and lays it again after
  // (a nested fold wants a main route inside the box, and a Plastic copy's oil is a byproduct: the
  // Plastic copy firing the kiln sends its plastic into a Rubber copy, whose oil a second Plastic
  // copy sends, measured: "Box a group that works together" with the kiln and one Plastic copy; the
  // Plastic copy feeding both placed after both, or it finds no room)
  glassII: {
    name: 'Glass II',
    members: [{ design: 'Glassworks', to: 'dock' }, { design: 'Rubber', to: 'dock' }, { design: 'Plastic', to: 1, by: 0 }, { design: 'Plastic', to: 'dock', by: 1 }],
  },
  sandwichesII: {
    name: 'Sandwiches II',
    // (one Plastic copy: a second found no room on the bench, measured)
    members: [{ design: 'Sandwich works', to: 'dock' }, { design: 'Plastic', to: 0, by: 0 }, { design: 'Iron ingots', to: 'dock', by: 0 }],
  },
  coilsII: {
    name: 'Coils II',
    // (one Plastic copy: a second found no room on the bench, measured)
    members: [{ design: 'Coils', to: 'dock', by: 'dock' }, { design: 'Plastic', to: 0, by: 0 }, { design: 'Copper ingots', to: 0, by: 'dock' }],
    ext: [{ design: 'Processors II', by: 'dock' }, { design: 'Rubber II', by: 'dock' }],
  },
};

// ------------------------------------------------------------------ the plan

export type Step3 =
  | { k: 'need'; r: ResearchId }
  /** the old Bay floor re-laid to pay Zoning (skipped when Zoning is known) */
  | { k: 'zone' }
  /** the Workshop lab's phase (bot2's parts): M makes motors, Z circuits */
  | { k: 'lab'; phase: 'M' | 'Z' }
  /** Gizmo works II copies lifted from the annex to the District (its first income) */
  | { k: 'gizmos' }
  /** the 12x8 and the annex cleared, the Factory Chute placed and its first feeders found */
  | { k: 'chuteFloor'; feeders: string[] }
  /** one more Chute feeder (a design making an item the Workshop lines take) */
  | { k: 'feeder'; design: string; free?: boolean }
  /** the standing kit line */
  | { k: 'kits' }
  /** a Workshop line started in a free slot (it folds beside the plan) */
  | { k: 'line'; line: string }
  /** wait for a line's fold */
  | { k: 'lineDone'; line: string }
  /** a group built on the bench and nested (blocking: one bench) */
  | { k: 'group'; group: string }
  /** keep at least n copies of a design on the District */
  | { k: 'district'; design: string; n: number }
  /** an Act III order taken when nothing else is active (bot2's order desk) */
  | { k: 'order'; id: string }
  /** the lab re-laid for the chemistry corner (LAB_C) */
  | { k: 'chemLab' }
  /** Factory modules placed by search to feed the Chute (FEEDS) */
  | { k: 'feed'; feed: string }
  /** a feed's copies lifted back to the inventory (the oil feed once the corner's last line folds) */
  | { k: 'unfeed'; feed: string }
  /** District folds (depth 3) made, at least n (blocking until made or given up) */
  | { k: 'dfold'; n: number }
  /** a standing slot line lifted (its slot freed for the next) */
  | { k: 'stop'; line: string }
  | { k: 'mark'; name: string };

export const PLAN3: Step3[] = [
  // motors for Zoning and Chutes from the lab, circuits and concrete from the old Bay floor
  { k: 'lab', phase: 'M' },
  { k: 'zone' },
  { k: 'need', r: 'zoning' },
  { k: 'gizmos' },
  { k: 'need', r: 'chutes' },
  { k: 'chuteFloor', feeders: ['Iron ingots', 'Steel', 'Copper wire', 'Plastic', 'Glass', 'Steel'] },
  { k: 'district', design: 'Gizmo works II', n: 6 },
  { k: 'kits' },
  { k: 'line', line: 'gears' },
  { k: 'line', line: 'motors' },
  { k: 'lineDone', line: 'gears' },
  { k: 'group', group: 'gearsII' },
  { k: 'feeder', design: 'Gears II' },
  { k: 'lineDone', line: 'motors' },
  { k: 'group', group: 'motorsII' },
  { k: 'feeder', design: 'Motors II' },
  { k: 'district', design: 'Motors II', n: 1 },
  { k: 'need', r: 'bearings' },
  { k: 'line', line: 'gearboxes' },
  { k: 'lineDone', line: 'gearboxes' },
  { k: 'group', group: 'gearboxesII' },
  { k: 'district', design: 'Gearboxes II', n: 2 },
  { k: 'district', design: 'Motors II', n: 2 },
  { k: 'need', r: 'servos' },
  { k: 'group', group: 'circuitsII' },
  { k: 'feeder', design: 'Circuits II' },
  { k: 'line', line: 'servos' },
  { k: 'lineDone', line: 'servos' },
  { k: 'group', group: 'servosII' },
  { k: 'district', design: 'Circuits II', n: 1 },
  { k: 'district', design: 'Servos II', n: 2 },
  { k: 'order', id: 'ballet' },
  { k: 'district', design: 'Motors II', n: 4 },
  // concrete for the Floating City's research (the old Bay floor that made it is gone) and its Platform
  { k: 'group', group: 'concreteII' },
  { k: 'district', design: 'Concrete II', n: 4 },
  { k: 'need', r: 'floatingCity' },
  { k: 'line', line: 'rotors' },
  { k: 'lineDone', line: 'rotors' },
  { k: 'group', group: 'rotorsII' },
  { k: 'district', design: 'Rotors II', n: 2 },
  { k: 'district', design: 'Motors II', n: 6 },
  // chemistry (the Act III bot's re-measure, DESIGN.md §21 Pacing): the lab's concrete corner
  // becomes the chemistry corner; Solvent folds there (a sand Miner with the Chem Vat), its copies
  // feed the Chute and nest with Plastic copies for their oil; then Rubber, Processors, Sensors and,
  // after Robotics, Robot arms, each a line, a group and District copies paying research
  { k: 'chemLab' },
  // oil for the vats: four Plastic copies selling their plastic and sending their oil down the
  // Chute (a copy's oil is 0.12 a second, a vat at full speed wants 1; a Chute feeder's oil only
  // comes while its plastic is drawn, measured: the stock stood at 0.49 oil for an hour)
  { k: 'feed', feed: 'oil' },
  { k: 'need', r: 'chemistry' },
  { k: 'line', line: 'solvent' },
  { k: 'lineDone', line: 'solvent' },
  { k: 'need', r: 'vulcanizing' },
  { k: 'line', line: 'rubber' },
  { k: 'lineDone', line: 'rubber' },
  { k: 'group', group: 'rubberII' },
  { k: 'feed', feed: 'rubber' },
  { k: 'district', design: 'Rubber II', n: 3 },
  { k: 'need', r: 'processors' },
  { k: 'line', line: 'processors' },
  { k: 'lineDone', line: 'processors' },
  // the corner's last line is folded: the oil feed's four Plastic copies back to the inventory, for
  // the Processors II group (the District's copies hold every coal claim by then, and a block costs
  // more than the coin on hand, measured: Processors II not laid, short of two Plastic copies)
  { k: 'unfeed', feed: 'oil' },
  { k: 'group', group: 'processorsII' },
  { k: 'district', design: 'Processors II', n: 2 },
  { k: 'need', r: 'sensors' },
  { k: 'line', line: 'sensors' },
  { k: 'lineDone', line: 'sensors' },
  { k: 'group', group: 'sensorsII' },
  { k: 'district', design: 'Sensors II', n: 3 },
  { k: 'district', design: 'Circuits II', n: 4 },
  { k: 'need', r: 'robotics' },
  { k: 'feed', feed: 'servos' },
  // the arms line stands unfolded, feeding the Hopper (LINES.arms)
  { k: 'line', line: 'arms' },
  { k: 'district', design: 'Sensors II', n: 5 },
  { k: 'need', r: 'districtFolds' },
  { k: 'dfold', n: 2 },
  // the fifth pass: glass for the Floating City's Spires (2,500 at the District Bay): the corner's
  // Kiln on its own plant, folded, nested with a Plastic copy for its boiler's oil (CORNER.glassF), while
  // the bench is still free (the feeds after it may use it: feedStep)
  { k: 'line', line: 'glassF' },
  { k: 'lineDone', line: 'glassF' },
  { k: 'unfeed', feed: 'servos' },
  { k: 'group', group: 'glassII' },
  { k: 'district', design: 'Glass II', n: 3 },
  { k: 'feed', feed: 'servos2' },
  // Relocation's chain (the third pass): batteries (the Lighthouse wants 200, the Engineer one each)
  // and Hydroponics' sludge. Copper ingots fold on chunk D's second copper patch and feed the Chute;
  // Solvent copies send the Chute solvent and the Factory Hopper their sludge; the battery vat is the
  // chemistry corner's last line, its copies feeding the Chute
  { k: 'line', line: 'copper' },
  { k: 'lineDone', line: 'copper' },
  { k: 'feed', feed: 'copper' },
  { k: 'line', line: 'solventB' },
  { k: 'lineDone', line: 'solventB' },
  { k: 'need', r: 'batteries' },
  { k: 'line', line: 'batteries' },
  { k: 'lineDone', line: 'batteries' },
  { k: 'feed', feed: 'battery' },
  // the fourth pass: the oil feed's four Plastic copies back (oil for the corner's own solvent vat,
  // the sludge's only source here: the chem feed's Solvent copies on the Factory never had room for
  // their Plastic copies, measured), the sludge for Hydroponics from the corner
  { k: 'mark', name: 'relocChain' },
  { k: 'feed', feed: 'oil2' },
  { k: 'line', line: 'sludge' },
  { k: 'lineDone', line: 'sludge' },
  { k: 'need', r: 'hydroponics' },
  // the fourth pass: produce for Sandwiches, then sandwiches for Sandwich Engineering, each a
  // standing corner line feeding the Hopper (CORNER.produce, CORNER.sandwich)
  { k: 'line', line: 'produce' },
  { k: 'lineDone', line: 'produce' },
  { k: 'need', r: 'sandwiches' },
  { k: 'line', line: 'sandwich' },
  { k: 'lineDone', line: 'sandwich' },
  // the fifth pass: sandwiches for the Spires (300): the Sandwiches line laid to fold (CORNER.sandwichF),
  // nested at once (the servos feed lifted meanwhile: its trunks wall the bench off from the Dock)
  { k: 'line', line: 'sandwichF' },
  { k: 'lineDone', line: 'sandwichF' },
  { k: 'unfeed', feed: 'servos2' },
  { k: 'group', group: 'sandwichesII' },
  { k: 'district', design: 'Sandwiches II', n: 3 },
  { k: 'feed', feed: 'servos3' },
  // processors down the Chute from a Processors II feeder (the coils line's, then the Engineer's)
  { k: 'feeder', design: 'Processors II', free: true },
  // the Scrap Transmuter (40 processors, 100 batteries: the battery vat again, standing, feeding the
  // Hopper), then its coils (CORNER.coils), nested with Plastic and Copper ingots copies and fed by
  // Processors II and Rubber II groups. Oil first: the battery feed's copies (0.02 batteries a
  // second) lifted and four Plastic copies sending their oil down the Chute in their room (measured:
  // the Chute's oil at 0, the battery vat starved, 63 batteries in an hour)
  { k: 'unfeed', feed: 'battery' },
  { k: 'feed', feed: 'oil3' },
  { k: 'line', line: 'batteriesB' },
  { k: 'lineDone', line: 'batteriesB' },
  { k: 'need', r: 'scrapTransmuter' },
  { k: 'line', line: 'coils' },
  { k: 'lineDone', line: 'coils' },
  // the feeds on the bench lifted for the coils group, the servos feed laid again after
  { k: 'unfeed', feed: 'oil2' },
  { k: 'unfeed', feed: 'oil3' },
  { k: 'unfeed', feed: 'servos3' },
  { k: 'group', group: 'coilsII' },
  { k: 'district', design: 'Coils II', n: 3 },
  { k: 'district', design: 'Processors II', n: 6 },
  { k: 'feed', feed: 'servos4' },
  // the Engineer and the umbrellas (Relocation's price) after Act III's Megaprojects, since
  // Relocation waits for Charting, which waits for them: umbrellas from a slot, the Mk2 in the
  // corner (CORNER.engineer)
  { k: 'line', line: 'umbrellas' },
  { k: 'line', line: 'engineer' },
  { k: 'lineDone', line: 'engineer' },
  { k: 'line', line: 'umbrellas2' },
  { k: 'lineDone', line: 'umbrellas2' },
  // the Sky Anchor's bearings (Act IV research): the umbrellas' slot becomes a bearing press
  { k: 'stop', line: 'umbrellas' },
  { k: 'line', line: 'bearings' },
  { k: 'mark', name: 'act3end' },
];

/** After the plan, the District grows a copy at a time while the coin is there (a copy a few
 * minutes: what the floor's income buys), in this order round and round: each copy is placed
 * beside what it feeds and routed by the same rules. */
export const GROW: string[] = ['Servos II', 'Motors II', 'Sensors II', 'Gearboxes II', 'Processors II', 'Concrete II', 'Arms II', 'Rotors II', 'Circuits II', 'Rubber II', 'Gizmo works II', 'Gears II', 'Glass II', 'Sandwiches II', 'Coils II'];

const HOOK = 'act3:';

/** Minutes the plan waits on one step before chemistry before the District grows anyway (`growing`). */
export const GROW_WAIT = 20;

// ------------------------------------------------------------------ the bot

type GroupRun = { spec: GroupSpec; n: number; ids: string[]; ext: string[]; pushed: boolean; tries: number; placedAt: number; empty: number; phase: 'build' | 'warm' | 'audit' | 'clean'; since: number; born?: number; retryAt?: number };

export class Act3Bot {
  readonly g: Game;
  readonly b: Act2Bot;
  readonly plan: Step3[];
  step = 0;
  /** what the bot waits on, for the logs */
  waiting = '';
  /** the lab's parts (bot2's PHASE_Z or PHASE_M) */
  private lab: string[];
  /** Workshop line slots: the line in each, or null */
  private slots: (string | null)[] = SLOT_ROWS.map(() => null);
  private standing: string[] = [];
  /** copies of each design wanted on the District */
  want: Record<string, number> = {};
  /** the research this player takes, in order (bot4.ts adds Act IV's) */
  wish: ResearchId[] = WISH3;
  private pushed = new Set<string>();
  private group: GroupRun | null = null;
  private serial = 0;
  private lookAt = 0;
  private hAt = 0;
  private skiffAt: Partial<Record<HighFloorId, number>> = {};
  private routeAt: Partial<Record<HighFloorId, number>> = {};
  private odAt = 0;
  private odNext = 0;
  private stageSeen: Record<string, number> = {};
  /** design names whose placement failed (logged) */
  failed: string[] = [];

  constructor(g: Game, b: Act2Bot, plan: Step3[] = PLAN3) {
    this.g = g;
    this.b = b;
    this.plan = plan;
    // the Act II plan is done: its optional steps waiting beside it (chains for the annex) are not
    // retried any more, this bot owns the floor now
    b.later = [];
    this.lab = b.layout.includes('motorAsm') ? PHASE_M : PHASE_Z;
    b.mark('act3');
    this.grewAt = g.seconds;
    for (const id of ['city', 'transmuter'] as const) this.stageSeen[id] = g.s.megas?.[id]?.stage ?? 0;
  }

  get log() {
    return this.b.log;
  }

  /** Is everything planned done (the campaign resets on a stalled preview only then)? */
  done(): boolean {
    // (a standing line, the arms line feeding the Hopper, keeps its slot for good: it is not work
    // still to come; counting it held the full-floor reset off for 5 h in pace-act3's run 4, measured
    // in the third pass)
    // (nor is Relocation's chain past Batteries: its standing corner lines wait up to 150 minutes
    // each on sludge, produce and sandwiches, and a full District that waited on them held the
    // reset off 99 minutes in pace-act4's run 5, measured, the fourth pass; a floor still growing,
    // the World's, keeps the run going while the chain runs)
    const chain = this.plan.findIndex((q) => q.k === 'mark' && q.name === 'relocChain');
    // (and a plan that has waited an hour on one step is through for the reset's purposes: pace-act3's
    // run 4 waited on Floating City's servos (its Servos design folded without circuits) and a full
    // District idled 155 minutes to the run's cap, measured, the fourth pass)
    const stuck = this.step < this.plan.length && this.stepAt.step === this.step && this.g.seconds - this.stepAt.t > 3600;
    // (but Act III's Megaprojects are the act's end: while their steps are still ahead and the two
    // projects not built, a full District is not a reason to reset (the fifth pass: run 3 reset at
    // 18:47, its Transmuter research half paid); the stuck rule and the run's cap still bound it)
    const megas = megaComplete(this.g, 'city') && megaComplete(this.g, 'transmuter');
    const planDone = this.step >= this.plan.length || (chain >= 0 && this.step > chain && megas) || stuck;
    return planDone && this.b.step >= this.b.plan.length && !this.group && this.slots.every((q) => q === null || !!LINES[q]?.stand);
  }

  private act(c: Cmd, what?: string): boolean | null {
    const r = this.b.act(c);
    if (r && what) this.b.decide(what);
    if (r && (what === 'module:district' || what === 'module:world' || what === 'lot')) this.grewAt = this.g.seconds;
    return r;
  }

  /** when the District last grew (a copy placed, a lot bought), seconds */
  private grewAt = 0;
  /** the District Bay's count of Act III's projects, and when it last rose (observe) */
  private baySeen = 0;
  private bayRoseAt = -1e9;

  /** Seconds since the District last grew, once the plan is through and the floor is full (every
   * tile taken, every lot bought) or the coin piles up past 10M with nothing bought (0 otherwise):
   * the campaign's reset moment (src/sim/campaign.ts). A District short of coin is not full. */
  grownAgo(): number {
    const g = this.g;
    if (!this.done() || !g.s.district) return 0;
    let free = false;
    for (let y = 0; y < HIGH.district.h && !free; y++) for (let x = 0; x < highW(g, 'district'); x++) if (!hentAt(g, 'district', x, y)) { free = true; break; }
    const full = (!free || this.routesFull()) && !lotPrice(g, 'district');
    // (a District still delivering a Megaproject's goods to its Bay is building the act's end: the
    // player lets the stage stand before resetting; the run's cap still bounds it)
    // (while its Bay counts something every 10 minutes)
    if (bayWants(g, 'district').size && g.seconds - this.bayRoseAt < 600) return 0;
    return full || g.s.coin.gte(10_000_000) ? g.seconds - this.grewAt : 0;
  }

  update() {
    this.b.update();
    this.observe();
    this.overdrive();
    if (!this.b.handReady) return;
    this.research();
    if (!this.b.handReady) return;
    if (this.g.s.tick < this.lookAt) return;
    this.lookAt = this.g.s.tick + TICK_RATE / 2;
    if (this.district()) return;
    if (this.districtFold()) return;
    if (!this.b.handReady) return;
    if (this.groupWork()) return;
    this.grow();
    this.drain();
    this.feedShort();
    this.freeSlots();
    if (this.modes()) return;
    if (this.unjam()) return;
    this.runPlan();
  }

  private unjamAt = 0;
  /** Sludge left on the belts once Hydroponics has its 300 jams the corridor: the Hopper takes
   * sludge only while research wants it (the slag rule), and the loop and the corridor are the
   * lab's too (measured, the fourth pass: every lab machine stood blocked from 12:58, and the
   * Produce line never ran). The player picks up each belt holding sludge (its sludge is lost) and
   * the layout puts the belt back: a command every 2 s while one is left. */
  private unjam(): boolean {
    const g = this.g;
    if (g.s.tick < this.unjamAt || !g.done('hydroponics') || hopperWantsWaste(g, 'sludge')) return false;
    this.unjamAt = g.s.tick + 2 * TICK_RATE;
    const e = g.s.ents.find((q) => q.kind === 'belt' && this.b.mine.has(q.id) && (q.item === 'sludge' || q.item2 === 'sludge'));
    if (!e) return false;
    return !!this.act({ k: 'remove', x: e.x, y: e.y });
  }

  /** The corner's solvent vat in Byproduct mode once Recycling is known, while a line that wants its
   * sludge stands there (sludge, produce, sandwiches): one command, or false. */
  private modes(): boolean {
    const g = this.g;
    if (!g.done('recycling') || !this.corner || !['sludge', 'produce', 'sandwich', 'sandwichF', 'engineer'].includes(this.corner)) return false;
    const e = g.entAt(21, 7);
    if (!e || e.kind !== 'chemVat' || e.recipe !== 'mixSolvent' || e.mode === 'byproduct') return false;
    return !!this.act({ k: 'mode', x: 21, y: 7, mode: 'byproduct' }, 'mode');
  }

  /** the bench is saving for a group's claims (groupWork): the District stamps nothing new */
  private saving = false;
  private growAt = 0;
  private growNext = 0;
  private drainAt = 0;
  private drainItem: ItemId | null = null;
  private drainOn = true;

  /** The research drain (researchDrain): once a minute, the first item the selected research still
   * wants that the Chute holds 5 of and no line or corner running draws; relaid when it changes. */
  private drain() {
    const g = this.g;
    if (g.s.tick < this.drainAt || !this.standing.includes(HOOK + 'plasticDrain')) return;
    this.drainAt = g.s.tick + 60 * TICK_RATE;
    const sel = g.s.research.selected;
    const drawn = new Set<string>();
    for (const q of [...this.slots, this.corner]) if (q) for (const p of this.b.found[HOOK + q] ?? []) if (p.kind === 'chuteMouth' && p.recipe) drawn.add(p.recipe);
    // the plastic drain stands down while a running line draws the Chute's plastic
    // (but not for the Sandwiches and Engineers lines: they draw a plastic every few seconds, the
    // stock stood full, the Plastic feeders stopped and with them the oil their solvent vat runs on;
    // nor all the time, or the drain takes the plastic the umbrellas and the batteries want (the
    // stock stood at 0-1, measured, the fourth pass): it runs while the stock is over 35, until
    // under 15, as the player reads the Chute's stock each minute)
    const ownOil = this.corner === 'sandwich' || this.corner === 'engineer';
    const plast = (g.s.chute ?? {}).plastic ?? 0;
    this.drainOn = plast >= 35 ? true : plast < 15 ? false : this.drainOn;
    // (the Sandwiches line keeps it on: with the stock-reading drain Sandwich Engineering came an
    // hour later, 16:23 against 15:23, its vat short of the feeders' oil)
    const pd = !drawn.has('plastic') || this.corner === 'sandwich' || (ownOil && this.drainOn) ? PLASTIC_DRAIN : NO_PARTS;
    const pdChanged = this.b.found[HOOK + 'plasticDrain'] !== pd;
    this.b.found[HOOK + 'plasticDrain'] = pd;
    const chute = g.s.chute ?? {};
    const item = sel ? ((Object.keys(RESEARCH[sel as ResearchId].cost) as ItemId[]).find((i) => i !== 'plastic' && !drawn.has(i) && (chute[i] ?? 0) >= 5 && this.researchNeed(i) > 0) ?? null) : null;
    if (item === this.drainItem) {
      if (pdChanged) this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
      return;
    }
    this.drainItem = item;
    if (!this.standing.includes(HOOK + 'researchDrain')) this.standing.push(HOOK + 'researchDrain');
    this.b.found[HOOK + 'researchDrain'] = item ? researchDrain(item) : [];
    this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
  }

  private shortAt = 0;
  private shortSeen: Partial<Record<ItemId, number>> = {};
  private extraFeeders = 0;

  /** A running line (a slot's or the corner's) whose Chute input has stood empty 10 minutes gets one
   * more Chute feeder of the design that makes it, if the Chute floor has a slot (measured, the third
   * pass: the Processors line drew the Chute's circuits faster than the one Circuits II feeder sent
   * them, stood at 6 processors and was given up after 90 minutes, and Robotics waited the run out
   * on processors). Four at most a run. */
  private feedShort() {
    const g = this.g;
    if (g.s.tick < this.shortAt || !g.s.factory.ents.some((e) => e.kind === 'fchute')) return;
    this.shortAt = g.s.tick + 60 * TICK_RATE;
    if (this.extraFeeders >= 4 || this.feeders.length >= FEED_SLOTS.length || this.b.step < this.b.plan.length) return;
    const drawn = new Set<ItemId>();
    for (const q of [...this.slots, this.corner]) if (q) for (const p of this.b.found[HOOK + q] ?? []) if (p.kind === 'chuteMouth' && p.recipe) drawn.add(p.recipe as ItemId);
    const chute = g.s.chute ?? {};
    for (const item of drawn) {
      if ((chute[item] ?? 0) >= 1) { delete this.shortSeen[item]; continue; }
      this.shortSeen[item] ??= g.seconds;
      if (g.seconds - this.shortSeen[item]! < 600) continue;
      const design = CHUTE_FEEDER[item];
      if (!design || !this.b.designNamed(design)) continue;
      delete this.shortSeen[item];
      this.extraFeeders++;
      this.feeders.push(design);
      this.layChute('chute:short:' + this.extraFeeders);
      this.b.decide('feeder:' + design);
      return;
    }
  }

  /** One more copy wanted on the District, every 3 min once the plan is through, while every copy
   * wanted stands and the coin covers twice the stamp. */
  private grow() {
    const g = this.g;
    if (!this.growing || g.s.tick < this.growAt || !g.s.district || this.saving || this.feedSaving) return;
    this.growAt = g.s.tick + 180 * TICK_RATE;
    if (Object.entries(this.want).some(([n, k]) => this.placed(n) < k && this.b.designNamed(n))) return;
    // a copy the floor could not route is not placed (every lot bought and the routes at the cap)
    if (this.routesFull() && !lotPrice(g, 'district')) return;
    for (let i = 0; i < GROW.length; i++) {
      const name = GROW[(this.growNext + i) % GROW.length];
      const d = this.b.designNamed(name);
      if (!d || g.s.coin.lt(stampCost(g, d).mul(2)) || !this.taken(d)) continue;
      this.growNext = (this.growNext + i + 1) % GROW.length;
      this.want[name] = Math.max(this.want[name] ?? 0, this.placed(name)) + 1;
      return;
    }
  }

  /** Does anything take this design's product now (a module, research, the Bay, an order, a Dock
   * sale)? A Rotors copy once the City has its rotors makes parts nobody takes: not grown. */
  private taken(d: ModuleDesign): boolean {
    const item = mainItem(d);
    if (!item) return true;
    if (ITEMS[item].value > 0 && !ITEMS[item].refused) return true;
    if (this.researchNeed(item) > 0 || bayWants(this.g, 'district').has(item)) return true;
    const act = this.g.s.orders.active;
    if (act && (ORDER[act].wants[item] ?? 0) > 0) return true;
    return (this.g.s.district?.ents ?? []).some((c) => c.kind === 'module' && (this.g.design(c.design)?.ins[item] ?? 0) > 0);
  }

  /** A line folded leaves its slot at once: its Chute Mouths and output belt are lifted (a line
   * left running would crowd the shared output column and the corridor). */
  private freeSlots() {
    if (this.patch && this.b.designNamed(PATCH[this.patch].name)) {
      this.pushed.add('free:' + this.patch);
      this.patch = null;
      this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
      return;
    }
    if (this.corner && this.b.designNamed(CORNER[this.corner].name)) {
      this.pushed.add('free:' + this.corner);
      this.corner = null;
      this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
      return;
    }
    const i = this.slots.findIndex((q) => q !== null && !!this.b.designNamed(LINES[q].name));
    if (i < 0) return;
    const line = this.slots[i]!;
    this.slots[i] = null;
    this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
    this.pushed.add('free:' + line);
  }

  tick() {
    this.b.tick();
  }

  // ---------------------------------------------------------------- watching

  private observe() {
    const g = this.g;
    if (g.s.tick % TICK_RATE !== 0) return;
    if (g.s.district) this.b.mark('district');
    // the District Bay's count (the City's and the Transmuter's), read off the Bay as it rises
    let bay = 0;
    for (const id of ['city', 'transmuter'] as const) for (const v of Object.values(g.s.megas?.[id]?.progress ?? {})) bay += v?.toNumber() ?? 0;
    if (bay > this.baySeen + 1e-9) { this.baySeen = bay; this.bayRoseAt = g.seconds; }
    if (bay < this.baySeen) this.baySeen = bay;
    for (const id of ['city', 'transmuter'] as const) {
      const st = g.s.megas?.[id]?.stage ?? 0;
      if (st > (this.stageSeen[id] ?? 0)) {
        this.stageSeen[id] = st;
        this.b.mark(`${id}${st}`);
        this.b.decide(`stage:${id}${st}`);
      }
    }
  }

  // ---------------------------------------------------------------- research

  /** What research still wants of an item (selected or later on the Act III page), after the bank. */
  researchNeed(item: ItemId, of: ResearchId[] = this.wish): number {
    const r = this.g.s.research;
    let n = 0;
    for (const id of of) {
      if (this.g.done(id)) continue;
      const want = RESEARCH[id].cost[item];
      if (want) n += Math.max(0, want - (r.progress[id]?.[item]?.toNumber() ?? 0));
    }
    return n - (r.bank[item]?.toNumber() ?? 0);
  }

  private resWatch: { id: ResearchId | null; got: number; t: number } = { id: null, got: 0, t: 0 };
  private resSkip: Partial<Record<ResearchId, number>> = {};

  private research() {
    const g = this.g;
    const r = g.s.research;
    const open = this.wish.filter((id) => available(g, id));
    if (!open.length) return;
    const covered = open.find((id) => Object.entries(RESEARCH[id].cost).every(([it, n]) => (r.progress[id]?.[it as ItemId]?.toNumber() ?? 0) + (r.bank[it as ItemId]?.toNumber() ?? 0) >= (n as number)));
    // a node selected 10 minutes without a good coming in (nothing here makes its goods: the Sky
    // Anchor's 800 bearings, measured, the third pass, held Batteries off for good) is passed over
    // for 30 minutes, as a player picks what the floor can pay
    const sel = r.selected as ResearchId | null;
    if (sel) {
      const got = Object.values(r.progress[sel] ?? {}).reduce((a, v) => a + (v?.toNumber() ?? 0), 0);
      if (this.resWatch.id !== sel || got > this.resWatch.got) this.resWatch = { id: sel, got, t: g.seconds };
      else if (g.seconds - this.resWatch.t > 600 && open.length > 1) { this.resSkip[sel] = g.seconds + 1800; this.resWatch = { id: sel, got, t: g.seconds }; }
    }
    const pick = covered ?? open.find((id) => (this.resSkip[id] ?? 0) <= g.seconds) ?? open[0];
    if (r.selected !== pick) this.act({ k: 'research', id: pick });
  }

  // ---------------------------------------------------------------- the plan

  private runPlan() {
    const g = this.g;
    for (let guard = 0; guard < 20 && this.step < this.plan.length; guard++) {
      if (this.step !== this.stepAt.step) this.stepAt = { step: this.step, t: g.seconds };
      const res = this.tryStep(this.plan[this.step]);
      if (res !== 'done') {
        this.waiting = res;
        // chemistry is the plan's optional tail: a step it has waited on for an hour (research
        // short of goods no line here makes yet) ends it, logged, so the District's growth and the
        // full-floor reset are never held by it (the first measure held the District 7 h)
        // (a line's fold has its own give-up, its clock standing while the Chute is short: lineDone)
        if (this.step >= this.chemStart && this.plan[this.step].k !== 'lineDone' && g.seconds - this.stepAt.t > 3600) {
          this.failed.push('chem:' + res);
          this.step = this.plan.length;
          this.waiting = 'plan done (chemistry stopped: ' + res + ')';
        }
        return;
      }
      this.step++;
    }
    if (this.step >= this.plan.length) this.waiting = 'plan done';
  }

  private stepAt = { step: -1, t: 0 };

  /** Does the District grow (GROW) now? From the plan's first chemistry step on, and before it while
   * the plan has waited 20 minutes on one step (research short of goods, a line slow to fold): a
   * player builds the floor that pays while waiting, rather than idle (measured, the third pass:
   * pace-act3's run 3 waited 68.7 min at 11:07 on the Floating City's servos with the District's
   * growth held until chemistry; the copies grown are routed to what wants them most, the Hopper
   * among them). (7 minutes, was 20: the copy a growth round places comes up to 3 minutes later,
   * and pace-act3's two 19.9-minute waits, runs 4 and 5, were this 20-minute threshold with the
   * plan waiting on research: the fifth pass.) */
  get growing(): boolean {
    if (this.step >= this.chemStart) return true;
    return this.step < this.plan.length && this.stepAt.step === this.step && this.g.seconds - this.stepAt.t > GROW_WAIT * 60;
  }
  /** the plan's first chemistry step: the District grows from here on (GROW) */
  get chemStart(): number {
    const i = this.plan.findIndex((s) => s.k === 'chemLab');
    return i < 0 ? this.plan.length : i;
  }

  /** Push bot2 steps once under `key`; 'done' once bot2 has worked through its plan. */
  private viaB2(key: string, steps: Step2[]): 'done' | string {
    if (!this.pushed.has(key)) {
      this.pushed.add(key);
      this.b.plan.push(...steps);
      return 'handing to the builder';
    }
    if (this.b.step < this.b.plan.length) return `builder: ${this.b.log.waiting}`;
    return 'done';
  }

  private relayout(key: string): string {
    return this.viaB2(key, [{ k: 'parts', parts: this.layoutNow() }]);
  }

  private tryStep(s: Step3): string {
    const g = this.g;
    switch (s.k) {
      case 'mark':
        this.b.mark(s.name);
        return 'done';
      case 'stop': {
        const i = this.slots.indexOf(s.line);
        if (i >= 0) {
          this.slots[i] = null;
          this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
        }
        return 'done';
      }
      case 'need':
        if (g.done(s.r)) return 'done';
        this.retryLine(s.r);
        return `research ${s.r}`;
      case 'zone':
        if (g.done('zoning')) return 'done';
        return this.viaB2('zone', [{ k: 'fplan', name: 'a3zone', items: ZONE_PLAN, opt: true }]);
      case 'lab': {
        const want = s.phase === 'M' ? PHASE_M : PHASE_Z;
        if (this.lab !== want) this.lab = want;
        return this.relayout('lab' + s.phase);
      }
      case 'gizmos': {
        // the Gizmo works II copies leave the annex for the District, routed to its Dock
        const e = g.s.factory.ents.find((q) => q.kind === 'module' && g.design(q.design)?.name === 'Gizmo works II');
        if (e) {
          this.act({ k: 'fremove', x: e.x, y: e.y }, 'clear');
          return 'lifting Gizmo works II';
        }
        const d = this.b.designNamed('Gizmo works II');
        if (d) this.want[d.name] = Math.max(this.want[d.name] ?? 0, d.spare + this.placed(d.name));
        return 'done';
      }
      case 'chuteFloor':
        return this.chuteFloorStep(s.feeders);
      case 'feeder': {
        const d = this.b.designNamed(s.design);
        // (a group the bench gave up on feeds nothing)
        if (!d) return this.abandoned(s.design) ? 'done' : `no design ${s.design}`;
        const key = 'chute:' + this.step;
        if (!this.pushed.has(key)) {
          // (into the first slot no trunk or module of a search-placed feed has taken: the slots are
          // the floor's in order, and a taken one is skipped, measured, the fourth pass)
          while (s.free && this.feeders.length < FEED_SLOTS.length && g.fentAt(FEED_SLOTS[this.feeders.length][0], FEED_SLOTS[this.feeders.length][1])) this.feeders.push('');
          this.feeders.push(s.design);
          this.feederAt[key] = g.seconds;
        }
        const r = this.layChute(key);
        if (r !== 'done') return r;
        // a feeder short of a claim (the District's copies hold them all) is saved for, as a feed's
        // copies are (feedStep), for 50 minutes at most: the fplan left it out (measured, the fourth
        // pass: the Processors II feeder for the Engineer waited on a coal claim for good)
        const i = this.feeders.lastIndexOf(s.design);
        const at = i >= 0 ? FEED_SLOTS[i] : undefined;
        const e = at ? g.fentAt(at[0], at[1]) : undefined;
        if (!s.free || !at || (e && e.kind === 'module' && g.design(e.design)?.name === s.design) || g.seconds - (this.feederAt[key] ?? g.seconds) > 50 * 60 || !this.claimShort(s.design)) {
          this.feedSaving = false;
          return 'done';
        }
        if (this.buyClaims(d, false, 1)) return `claims for the ${s.design} feeder`;
        this.feedSaving = true;
        if (g.seconds - (this.feedRetry[key] ?? 0) > 60) {
          this.feedRetry[key] = g.seconds;
          this.b.plan.push({ k: 'fplan', name: key + ':' + Math.floor(g.seconds), items: chuteFloor(this.feeders), opt: true, keep: true });
        }
        return `saving for the ${s.design} feeder`;
      }
      case 'kits':
        if (!this.standing.includes(HOOK + 'kits')) {
          this.standing.push(HOOK + 'kits');
          this.b.found[HOOK + 'kits'] = KIT_LINE;
        }
        return this.relayout('kits');
      case 'line':
        return this.startLine(s.line);
      case 'lineDone': {
        // (its slot is freed as soon as the fold is: freeSlots)
        const spec = LINES[s.line] ?? CORNER[s.line] ?? PATCH[s.line];
        if (this.b.designNamed(spec.name) || this.abandoned(spec.name)) return 'done';
        // a standing corner line is done once its research has what it makes: the corner freed
        const st = CORNER[s.line]?.stand;
        if (st && this.lineAt[s.line] !== undefined && (this.researchNeed(CORNER[s.line].product, st) <= 0 || st.every((r) => g.done(r)))) {
          if (this.corner === s.line) {
            this.corner = null;
            this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
          }
          return 'done';
        }
        // a line not started (its research never came) is left out
        if (this.lineAt[s.line] === undefined) return 'done';
        // the Solvent line folds once research has its solvent (Vulcanizing's and Processors'), or
        // after 75 minutes as it is
        if (s.line === 'solvent' && !this.pushed.has('fold:solvent') && (this.researchNeed('solvent', ['vulcanizing', 'processors']) <= 0 || g.seconds - this.lineAt.solvent > 75 * 60)) {
          this.pushed.add('fold:solvent');
          this.b.plan.push(this.cornerFold('solvent'));
        }
        // the clock stands while the Chute is out of one of a slot line's inputs (its feed still
        // being laid: the arms line gave up 20 min before the Servos II feed's servos came,
        // measured), for an hour at most
        if (LINES[s.line]) {
          const ls = LINES[s.line];
          const ins = [ls.w, ...ls.ms.flatMap((m) => [m.n, m.s])].filter((i): i is ItemId => !!i);
          const last = this.lineSeen[s.line] ?? g.seconds;
          this.lineSeen[s.line] = g.seconds;
          const stall = Math.min(g.seconds - last, 3600 - (this.lineStall[s.line] ?? 0));
          if (stall > 0 && ins.some((i) => (g.s.chute?.[i] ?? 0) < 1)) {
            this.lineAt[s.line] += stall;
            this.lineStall[s.line] = (this.lineStall[s.line] ?? 0) + stall;
          }
        }
        // a line that has not folded in 45 minutes (its Chute short of a feeder that never came) is
        // given up: its slot freed, what it would have fed left out
        if (g.seconds - (this.lineAt[s.line] ?? g.seconds) > (CORNER[s.line]?.stand ? 150 : CORNER[s.line] ? 90 : 45) * 60) {
          this.failed.push('line:' + spec.name);
          const i = this.slots.indexOf(s.line);
          if (i >= 0) this.slots[i] = null;
          if (this.corner === s.line) this.corner = null;
          if (this.patch === s.line) this.patch = null;
          this.b.bgFolds = this.b.bgFolds.filter((f) => f.name !== spec.name);
          this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
          return 'done';
        }
        return `folding ${spec.name}`;
      }
      case 'chemLab':
        // the Chute's oil now goes to the vats, not the Hopper (Chemistry is paid by then)
        // (the Chute's oil drain to the Hopper is lifted while the corner runs a line: layoutNow)
        this.lab = LAB_C;
        return this.relayout('chemLab');
      case 'feed':
        return this.feedStep(s.feed);
      case 'unfeed': {
        for (let i = 0; i < FEEDS[s.feed].length; i++) {
          const eid = this.b.mods[HOOK + `feed:${s.feed}:${i}`];
          const e = eid !== undefined ? g.s.factory.ents.find((q) => q.id === eid) : undefined;
          if (e) { this.act({ k: 'fremove', x: e.x, y: e.y }); return `lifting the ${s.feed} feed`; }
        }
        // (and its trunks left leading nowhere on the 12x8, as a group's clean-up lifts them: the
        // fifth pass lifts the servos feed so the bench reaches the Dock again)
        if (s.feed.startsWith('servos')) {
          const used = new Set<number>();
          for (const r of g.routes) if (r.to) for (const t of r.tiles) used.add(t.id);
          const stray = g.s.factory.ents.find((e) => e.kind === 'trunk' && e.x < FACTORY.w && !used.has(e.id));
          if (stray) { this.act({ k: 'fremove', x: stray.x, y: stray.y }); return `lifting the ${s.feed} feed's trunks`; }
        }
        return 'done';
      }
      case 'dfold':
        if (!g.done('districtFolds') || this.dfolds >= s.n || this.dfoldTries >= 20) return 'done';
        return `District fold ${this.dfolds + 1} of ${s.n}`;
      case 'group': {
        const spec = GROUPS[s.group];
        if (this.b.designNamed(spec.name)) return 'done';
        // a group the bench could not hold in three tries is left out (logged in `failed`), and so is
        // one whose member's line or group was given up
        if (!this.group && (this.tried(spec.name) >= 3 || [...spec.members, ...(spec.ext ?? [])].some((m) => !this.b.designNamed(m.design) && this.abandoned(m.design)))) return 'done';
        if (!this.group) this.group = { spec, n: this.serial++, ids: [], ext: [], pushed: false, tries: 0, placedAt: 0, empty: 0, phase: 'build', since: g.seconds };
        return `building ${spec.name} (${this.group.phase})`;
      }
      case 'order':
        return this.viaB2('order:' + s.id, [{ k: 'order', id: s.id }]);
      case 'district':
        this.want[s.design] = Math.max(this.want[s.design] ?? 0, s.n);
        return 'done';
    }
  }

  // ---------------------------------------------------------------- Workshop lines

  private retried = new Set<string>();

  /** The corner line's fold (beside the plan): a vat on the Chute's oil runs short (a Plastic copy's
   * oil feeds an eighth of one), so folded once it runs a third of the time, or after 30 minutes as
   * it is (bot2's fold step). */
  private cornerFold(line: string): Step2 {
    const cs = CORNER[line];
    return { k: 'fold', box: cs.box, name: cs.name, bg: true, nokeep: true, ready: (gg) => working(gg, cs.last.x, cs.last.y, 30, 0.3) };
  }

  /** Research that has waited 30 minutes on a good only a given-up line makes (no design of it): the
   * line is started again, once (measured, the third pass: the Gearboxes line gave up at 12:32 and
   * Servos research, 120 gearboxes, then waited the rest of the run). While it runs it feeds the
   * Hopper; it folds beside the plan, as any line. */
  private retryLine(r: ResearchId) {
    const g = this.g;
    if (this.stepAt.step !== this.step || g.seconds - this.stepAt.t < 30 * 60) return;
    for (const item of Object.keys(RESEARCH[r].cost) as ItemId[]) {
      const key = Object.keys(LINES).find((k) => LINES[k].product === item && !LINES[k].stand) ?? Object.keys(CORNER).find((k) => CORNER[k].product === item);
      if (!key || this.retried.has(key)) continue;
      const corner = !!CORNER[key];
      const name = corner ? CORNER[key].name : LINES[key].name;
      if (this.b.designNamed(name) || !this.failed.includes('line:' + name)) continue;
      if (corner ? !!this.corner : this.slots.includes(key) || !this.slots.includes(null)) continue;
      if (this.researchNeed(item) <= 0) continue;
      this.retried.add(key);
      this.failed = this.failed.filter((f) => f !== 'line:' + name);
      this.startLine(key);
      this.b.decide('retry:' + name);
      return;
    }
  }

  private startLine(line: string): string {
    const g = this.g;
    const ps = PATCH[line];
    if (ps) {
      if (this.b.designNamed(ps.name) || this.patch === line) return 'done';
      for (const r of ps.needs) if (!g.done(r)) return `research ${r} for ${ps.name}`;
      this.patch = line;
      this.b.found[HOOK + line] = ps.parts;
      this.b.plan.push(
        { k: 'parts', parts: this.layoutNow() },
        { k: 'fold', box: ps.box, name: ps.name, bg: true, nokeep: true, ready: (gg) => working(gg, ps.last.x, ps.last.y, 30, 0.5) },
      );
      this.lineAt[line] = g.seconds;
      this.b.decide('line:' + ps.name);
      return 'done';
    }
    const cs = CORNER[line];
    if (cs) {
      if (this.b.designNamed(cs.name) || this.corner === line) return 'done';
      for (const r of cs.needs) if (!g.done(r)) return `research ${r} for ${cs.name}`;
      if (this.corner) return `the chemistry corner is busy (${this.corner})`;
      this.corner = line;
      this.b.found[HOOK + line] = cs.parts;
      this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
      // (the Solvent line runs until research has its solvent: the corner is the only solvent there
      // is until Rubber and Processors fold their own vats; its fold is pushed once it has, by
      // lineDone, since bot2's fold step folds a line as it is after 30 minutes: measured, the third
      // pass, the Solvent line folded at 30 minutes 18 solvent short of Processors, which then waited
      // the hour out and ended the plan)
      if (line !== 'solvent' && !cs.stand) this.b.plan.push(this.cornerFold(line));
      this.lineAt[line] = g.seconds;
      this.b.decide('line:' + cs.name);
      return 'done';
    }
    const spec = LINES[line];
    if (this.b.designNamed(spec.name) || this.slots.includes(line)) return 'done';
    for (const r of spec.needs) if (!g.done(r)) return `research ${r} for ${spec.name}`;
    const i = this.slots.indexOf(null);
    if (i < 0) return `no free slot for ${spec.name}`;
    const lay = lineLayout(spec, SLOT_ROWS[i]);
    this.slots[i] = line;
    this.b.found[HOOK + line] = lay.parts;
    // what the line's own machines make on the way (plates, bearings, ...): an audit that saw any
    // come in measured a buffer of it drawing down (a line that stood blocked), and is taken again
    const pure = spec.ms.slice(0, -1).map((m) => RECIPE[m.recipe].outputs[0].item);
    this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
    // folded once its last machine runs: the Chute feeds it at speed (a standing line is not)
    if (!spec.stand) this.b.plan.push({ k: 'fold', box: lay.box, name: spec.name, bg: true, nokeep: true, pure, ready: (gg) => working(gg, lay.last.x, lay.last.y, 30, 0.5) && stocked(gg, lay.parts) });
    this.lineAt[line] = g.seconds;
    this.b.decide('line:' + spec.name);
    return 'done';
  }

  // ---------------------------------------------------------------- the Factory

  private fmod(id: string, design: string, to: Dest, zone: PlaceZone, by?: Dest, hub = false): Step2 {
    const d = this.b.designNamed(design);
    const hasBy = !!d && Object.keys(d.outs).some((i) => BYPRODUCTS.has(i));
    return { k: 'fmod', id: HOOK + id, design, to, by: by ?? (hasBy ? { k: 'dock' } : undefined), hub, opt: true, zone };
  }

  /** Chute feeders so far (the hand-laid floor grows one slot at a time). */
  private feeders: string[] = [];

  private layChute(key: string): string {
    return this.viaB2(key, [{ k: 'fplan', name: key, items: chuteFloor(this.feeders), opt: true, keep: true }]);
  }

  private chuteFloorStep(feeders: string[]): string {
    const g = this.g;
    if (g.fw < FACTORY.w + 4) return 'waiting for annex room for the Chute';
    if (!g.s.factory.ents.some((e) => e.kind === 'fchute')) {
      // the annex is cleared (its Gizmo chains to the inventory), the 12x8's old Bay floor too
      const mods = g.s.factory.ents.filter((e) => e.kind === 'module' && e.x >= FACTORY.w);
      const trunks = g.s.factory.ents.filter((e) => e.kind === 'trunk' && e.x >= FACTORY.w);
      const e = mods[0] ?? trunks[0];
      if (e) {
        this.act({ k: 'fremove', x: e.x, y: e.y }, e.kind === 'module' ? 'clear' : undefined);
        return 'clearing the annex';
      }
      if (g.fentAt(CHUTE.x, CHUTE.y)) return 'chute tile taken';
      this.act({ k: 'fchute', x: CHUTE.x, y: CHUTE.y }, 'chute');
      return 'placing the Chute';
    }
    if (!this.standing.includes(HOOK + 'drains')) {
      this.standing.push(HOOK + 'drains');
      this.b.found[HOOK + 'drains'] = DRAINS;
    }
    if (!this.feeders.length) this.feeders = [...feeders];
    return this.viaB2('chuteFloor', [
      { k: 'fplan', name: 'a3clear', items: [], opt: true },
      { k: 'parts', parts: this.layoutNow() },
      { k: 'fplan', name: 'chute0', items: chuteFloor(this.feeders), opt: true, keep: true },
    ]);
  }

  private layoutNow(): string[] {
    // the Chute's oil goes to the corner's vats while it runs a line, else to the Hopper: a full oil
    // stock stops every Chute feeder whose waste is oil (Motors II, Circuits II), measured
    if (this.standing.includes(HOOK + 'drains')) this.b.found[HOOK + 'drains'] = this.corner ? DRAINS_C : DRAINS;
    // (the coils line takes (19,6): the lab's oil splitter is a plain belt west while it runs)
    let lab = this.lab;
    if (this.corner === 'coils' && lab.includes('oilSplitM')) {
      this.b.found[HOOK + 'oilW'] = OIL_W;
      lab = lab.map((p) => (p === 'oilSplitM' ? HOOK + 'oilW' : p));
    }
    return [...lab,...this.standing, ...this.slots.filter((q): q is string => !!q).map((q) => HOOK + q), ...(this.corner ? [HOOK + this.corner] : []), ...(this.patch ? [HOOK + this.patch] : [])];
  }

  /** the chemistry corner's line, or null */
  private corner: string | null = null;
  /** the ore-patch line under way (PATCH), or null */
  private patch: string | null = null;

  /** Factory modules placed by search to feed the Chute (FEEDS), once each design exists. */
  private feedStep(name: string): string {
    const g = this.g;
    const feed = FEEDS[name];
    for (const f of feed) if (!this.b.designNamed(f.design)) return this.abandoned(f.design) ? 'done' : `no design ${f.design} for the ${name} feed`;
    const id = (i: number) => `feed:${name}:${i}`;
    const dest = (t: 'chute' | 'dock' | 'hopper' | number): Dest => (typeof t === 'number' ? { k: 'mod', id: HOOK + id(t) } : { k: t });
    // (a member another feeds is a hub its feeders' trunks come round to)
    if (name === 'rubber' && !this.standing.includes(HOOK + 'plasticDrain')) {
      this.standing.push(HOOK + 'plasticDrain');
      this.b.found[HOOK + 'plasticDrain'] = PLASTIC_DRAIN;
      this.b.plan.push({ k: 'parts', parts: this.layoutNow() });
    }
    // once the plan's last group is nested the bench stands empty: a feed may use it too (measured,
    // the fourth pass: the chem and battery feeds' copies were left out for "no room" east of it)
    // (and before a group still to come when the plan lifts this feed first: the fifth pass's
    // Megaproject groups come after the feeds on the bench are lifted; a feed lifted only later
    // would stand in the next group's way, measured: Sandwiches II "no room" behind oil2)
    const rest = this.plan.slice(this.step);
    const nextGroup = rest.findIndex((q) => q.k === 'group'), nextUnfeed = rest.findIndex((q) => q.k === 'unfeed' && q.feed === name);
    const bench = !this.group && (nextGroup < 0 || (nextUnfeed >= 0 && nextUnfeed < nextGroup));
    const steps = feed.map((f, i) => this.fmod(id(i), f.design, dest(f.to), feedZone(g, bench), f.by === undefined ? undefined : dest(f.by), feed.some((q) => q.to === i || q.by === i)));
    const r = this.viaB2('feed:' + name, steps);
    if (r !== 'done') return r;
    // every member placed, or the player saves for the ones short of claims, as for a group
    // (groupWork): the District stamps nothing new, a block is bought when the coin covers it once,
    // and the missing copies are tried again each minute, for 50 minutes at most (measured, the
    // third pass: the oil feeds' Plastic copies were dropped and the Factory's Solvent and Batteries
    // copies starved for oil; every coal block bought went to the District's growth)
    const placed = (i: number) => { const eid = this.b.mods[HOOK + id(i)]; return eid !== undefined && g.s.factory.ents.some((e) => e.id === eid); };
    // (a copy left out for room or a destination is not waited for: only one short of claims)
    const missing = feed.map((_, i) => i).filter((i) => !placed(i) && this.claimShort(feed[i].design));
    this.feedBorn[name] ??= g.seconds;
    if (!missing.length || g.seconds - this.feedBorn[name] > 50 * 60) {
      if (missing.length) this.failed.push(`feed:${name}: not laid (${missing.map((i) => feed[i].design).join(', ')})`);
      this.feedSaving = false;
      return 'done';
    }
    for (const i of missing) {
      const d = this.b.designNamed(feed[i].design);
      if (d && this.buyClaims(d, d.spare >= 1, 1)) return `claims for the ${name} feed`;
    }
    this.feedSaving = true;
    if (g.seconds - (this.feedRetry[name] ?? 0) > 60) {
      this.feedRetry[name] = g.seconds;
      this.b.plan.push(...missing.map((i) => steps[i]));
    }
    return `saving for the ${name} feed (${missing.map((i) => feed[i].design).join(', ')})`;
  }
  /** Is a copy of the design short of claims (to stamp one, or to place a spare)? */
  private claimShort(design: string): boolean {
    const g = this.g;
    const d = this.b.designNamed(design);
    if (!d) return false;
    if (d.spare < 1) return !!stampRefusal(g, d) && Object.keys(claimLoad(g, d)).length > 0 && (Object.entries(claimLoad(g, d)) as [ItemId, number][]).some(([ore, n]) => { let used = 0; for (const q of g.s.designs) used += (claimLoad(g, q)[ore] ?? 0) * this.copies(q); return used + n > claimsHeld(g, ore) + 1e-9; });
    return (Object.entries(claimLoad(g, d)) as [ItemId, number][]).some(([ore, n]) => placedClaims(g, ore) + n > claimsHeld(g, ore) + 1e-9);
  }
  private feedBorn: Record<string, number> = {};
  private feederAt: Record<string, number> = {};
  private feedRetry: Record<string, number> = {};
  /** a feed is saving for its claims (feedStep): the District stamps nothing new */
  private feedSaving = false;

  // ---------------------------------------------------------------- District folds

  /** District folds made, and audits given up */
  dfolds = 0;
  private dfoldTries = 0;
  private dfoldAt = 0;
  private dfoldName = '';

  /** A District fold (DESIGN.md §21 District folds): the box round a module and the modules feeding
   * it by routes, when that box holds only them and they are one group (the floor's own refusal
   * says), a hub whose design has no fold yet first; audited, folded, and the new depth-3 copy put
   * back on the District where the group stood. One command, or false. */
  private districtFold(): boolean {
    const g = this.g;
    const st = g.s.district;
    if (!st || !g.done('districtFolds')) return false;
    const a = g.s.haudit;
    if (a && a.floor === 'district') {
      if (!a.result) return false;
      if (!Object.keys(a.result.outs).length) {
        this.dfoldTries++;
        this.act({ k: 'hauditCancel' });
        return true;
      }
      const r = this.act({ k: 'hfold', name: this.dfoldName }, 'fold');
      if (r) {
        this.dfolds++;
        this.b.mark('dfold:' + this.dfoldName);
        this.want[this.dfoldName] = this.placed(this.dfoldName) + 1;
      }
      return true;
    }
    if (a) return false;
    if (g.s.tick < this.dfoldAt) return false;
    this.dfoldAt = g.s.tick + 60 * TICK_RATE;
    // once two are made, another every 10 minutes while a hub has none
    if (this.dfolds >= 2) this.dfoldAt = g.s.tick + 600 * TICK_RATE;
    const folded = new Set(g.s.designs.filter((d) => (d.depth ?? 1) === 3).map((d) => d.name));
    let best: { box: Box; n: number; name: string } | null = null;
    for (const hub of st.ents) {
      if (hub.kind !== 'module') continue;
      const hd = g.design(hub.design);
      if (!hd || (hd.depth ?? 1) !== 2) continue;
      const name = hd.name.replace(/ II$/, '') + ' III';
      if (folded.has(name)) continue;
      const feeders = st.routes.filter((r) => r.to === hub.id && !BYPRODUCTS.has(r.item)).map((r) => hent(g, 'district', r.from)).filter((e): e is FEnt => !!e && e.kind === 'module');
      if (!feeders.length) continue;
      // every feeder, else each one alone with the hub
      for (const set of [feeders, ...feeders.map((f) => [f])]) {
        const es = [hub, ...set];
        const x0 = Math.min(...es.map((e) => e.x)), y0 = Math.min(...es.map((e) => e.y));
        const box = { x: x0, y: y0, w: Math.max(...es.map((e) => e.x)) - x0 + 1, h: Math.max(...es.map((e) => e.y)) - y0 + 1 };
        if (hfoldRefusal(g, 'district', box)) continue;
        if (!best || es.length > best.n) best = { box, n: es.length, name };
        break;
      }
    }
    if (!best) { this.dfoldTries++; return false; }
    this.dfoldName = best.name;
    this.act({ k: 'haudit', floor: 'district', ...best.box }, 'audit');
    return true;
  }

  /** The bench's group under way: build it (bot2 places each module by search), let it run a
   * minute, audit and fold it, then lift what is left (its outside feeders, dangling trunks). */
  private groupWork(): boolean {
    const gr = this.group;
    if (!gr) { this.saving = false; return false; }
    const g = this.g;
    const b = this.b;
    const placed = (id: string) => {
      const eid = b.mods[HOOK + id];
      return eid !== undefined && g.s.factory.ents.some((e) => e.id === eid);
    };
    const memberDesign = (id: string) => {
      const k = [...gr.ids, ...gr.ext].indexOf(id);
      return b.designNamed(k < gr.ids.length ? gr.spec.members[k].design : (gr.spec.ext ?? [])[k - gr.ids.length].design);
    };
    if (gr.phase !== 'build') this.saving = false;
    if (gr.phase === 'build') {
      if (!gr.pushed) {
        // every design it takes must exist first
        for (const m of [...gr.spec.members, ...(gr.spec.ext ?? [])]) if (!b.designNamed(m.design)) { this.waiting = `no design ${m.design} for ${gr.spec.name}`; return false; }
        gr.pushed = true;
        gr.ids = gr.spec.members.map((_, i) => `g${gr.n}:${i}`);
        gr.ext = (gr.spec.ext ?? []).map((_, i) => `g${gr.n}:x${i}`);
        b.plan.push(...this.groupSteps(gr));
        return false;
      }
      if (b.step < b.plan.length) return false;
      const missing = [...gr.ids, ...gr.ext].filter((id) => !placed(id));
      // a member short of a claim (the District's copies hold the ore's claims): a block for it,
      // when the coin covers it
      for (const id of missing) {
        const d = memberDesign(id);
        if (d && d.spare < 1 && this.buyClaims(d, false, 1)) return true;
      }
      // every member missing only for want of a stamp (claims or coin): the player saves for it, up
      // to an hour, the District stamping nothing new meanwhile (measured: the District's growth
      // took every coal block bought, and Sensors II waited on a Rubber II copy for good)
      const stampShort = missing.every((id) => { const d = memberDesign(id); return !!d && d.spare < 1 && !!stampRefusal(g, d); });
      gr.born ??= g.seconds;
      if (missing.length && stampShort && g.seconds - gr.born < 60 * 60) {
        this.saving = true;
        if (g.seconds - (gr.retryAt ?? 0) > 60) {
          gr.retryAt = g.seconds;
          b.plan.push(...this.groupSteps(gr).filter((s) => s.k === 'fmod' && !placed(s.id.slice(HOOK.length))));
        }
        return false;
      }
      this.saving = false;
      if (missing.length && gr.tries < 4 && g.seconds - gr.since < 10 * 60) {
        // a copy waiting on kits or claims: try again in a minute
        if (g.seconds - gr.since > 60 * (gr.tries + 1)) {
          gr.tries++;
          b.plan.push(...this.groupSteps(gr).filter((s) => s.k === 'fmod' && !placed(s.id.slice(HOOK.length))));
        }
        return false;
      }
      if (missing.length) {
        // the bench can't hold it as drawn: give it up, lift what was placed (tried again in the
        // other order)
        this.failed.push(`${gr.spec.name}: not laid (${missing.map((id) => { const k = [...gr.ids, ...gr.ext].indexOf(id); return k < gr.ids.length ? gr.spec.members[k].design : (gr.spec.ext ?? [])[k - gr.ids.length].design; }).join(', ')})`);
        gr.phase = 'clean';
        return false;
      }
      gr.phase = 'warm';
      gr.since = g.seconds;
      return false;
    }
    if (gr.phase === 'warm') {
      if (g.seconds - gr.since < 60) return false;
      if (g.s.faudit) {
        if (g.s.faudit.result) this.act({ k: 'fauditCancel' });
        return true;
      }
      const box = this.groupBox(gr);
      const why = box ? ffoldRefusal(g, box) : 'no box';
      if (why || !box) {
        this.failed.push(`${gr.spec.name}: ${why}`);
        gr.phase = 'clean';
        return false;
      }
      if (this.act({ k: 'faudit', ...box }, 'audit')) { gr.phase = 'audit'; gr.since = g.seconds; }
      return true;
    }
    if (gr.phase === 'audit') {
      const a = g.s.faudit;
      if (!a) { gr.phase = 'warm'; gr.since = g.seconds - 50; return false; }
      if (!a.result) return false;
      if (!Object.keys(a.result.outs).length) {
        // made nothing: again after a minute, given up after three
        this.act({ k: 'fauditCancel' });
        if (++gr.empty >= 3) { this.failed.push(`${gr.spec.name}: audits made nothing`); gr.phase = 'clean'; return true; }
        gr.phase = 'warm';
        gr.since = g.seconds;
        return true;
      }
      const r = this.act({ k: 'ffold', name: gr.spec.name });
      if (r) {
        b.decide('fold:' + a.result.grade.letter);
        b.mark('ffold:' + gr.spec.name);
        gr.phase = 'clean';
      }
      return true;
    }
    // clean: the group's outside feeders back to the inventory, then trunks left leading nowhere
    for (const id of [...gr.ext, ...gr.ids]) {
      const eid = b.mods[HOOK + id];
      const e = eid !== undefined ? g.s.factory.ents.find((q) => q.id === eid) : undefined;
      if (e) { this.act({ k: 'fremove', x: e.x, y: e.y }); return true; }
    }
    const used = new Set<number>();
    for (const r of g.routes) if (r.to) for (const t of r.tiles) used.add(t.id);
    const stray = g.s.factory.ents.find((e) => e.kind === 'trunk' && e.x < FACTORY.w && !used.has(e.id));
    if (stray) { this.act({ k: 'fremove', x: stray.x, y: stray.y }); return true; }
    this.group = null;
    return false;
  }

  private groupSteps(gr: GroupRun): Step2[] {
    const hubId = HOOK + gr.ids[0];
    const sink = (t: number | 'dock' | 'hopper' | 'bay'): Dest => (typeof t === 'number' ? { k: 'mod', id: HOOK + gr.ids[t] } : { k: t });
    const ms = gr.spec.members;
    // a member that two or more routes feed keeps the tiles round its back open, like the hub
    const fed = (i: number) => ms.filter((m) => m.to === i || m.by === i).length + (i === 0 ? (gr.spec.ext ?? []).length : 0);
    const out: Step2[] = ms.map((m, i) => {
      const by = m.by === undefined ? undefined : sink(m.by);
      return this.fmod(gr.ids[i], m.design, sink(m.to), benchZone(), by, i === 0 || fed(i) >= 2);
    });
    const ext = (gr.spec.ext ?? []).map((x, i) => this.fmod(gr.ext[i], x.design, { k: 'mod', id: x.to === undefined ? hubId : HOOK + gr.ext[x.to] }, extZone(), x.by ? { k: x.by } : undefined));
    // the outside feeders after the members (their trunks come round to the hub's back), or, on a
    // second try, right after the hub, before the members crowd it
    return this.tried(gr.spec.name) % 2 === 0 ? [...out, ...ext] : [out[0], ...ext, ...out.slice(1)];
  }

  /** line start times, for giving a line up (moved on while the Chute is out of an input) */
  private lineAt: Record<string, number> = {};
  private lineSeen: Record<string, number> = {};
  private lineStall: Record<string, number> = {};

  /** A design this player gave up making (a line that never folded, a group the bench never held). */
  private abandoned(name: string, depth = 0): boolean {
    if (this.tried(name) >= 3 || this.failed.includes('line:' + name)) return true;
    // a group one of whose designs was given up (measured: the Gears line never folded in a later
    // run, and the plan waited 9 h on "no design Gears II")
    const gr = depth < 3 ? Object.values(GROUPS).find((q) => q.name === name) : undefined;
    return !!gr && [...gr.members, ...(gr.ext ?? [])].some((m) => !this.b.designNamed(m.design) && this.abandoned(m.design, depth + 1));
  }

  private tried(name: string): number {
    return this.failed.filter((f) => f === name || f.startsWith(name + ':')).length;
  }

  /** The box of a group's members on the bench (their tiles' bounds). */
  private groupBox(gr: GroupRun): Box | null {
    const g = this.g;
    const es = gr.ids.map((id) => g.s.factory.ents.find((e) => e.id === this.b.mods[HOOK + id])).filter((e): e is FEnt => !!e);
    if (es.length < 2) return null;
    const x0 = Math.min(...es.map((e) => e.x)), y0 = Math.min(...es.map((e) => e.y));
    const x1 = Math.max(...es.map((e) => e.x)), y1 = Math.max(...es.map((e) => e.y));
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // ---------------------------------------------------------------- the District

  placed(name: string, id: HighFloorId = 'district'): number {
    const st = hfloor(this.g, id);
    if (!st) return 0;
    return st.ents.filter((e) => e.kind === 'module' && this.g.design(e.design)?.name === name).length;
  }

  floorEnt(kind: 'fdock' | 'fhopper' | 'fbay', id: HighFloorId = 'district'): FEnt | undefined {
    return hfloor(this.g, id)?.ents.find((e) => e.kind === kind);
  }

  /** One District command (a copy stamped or placed, a route, a skiff, a lot), or false. */
  private district(): boolean {
    return this.floorWork('district', this.want);
  }

  /** A District copy of the most numerous design whose goods only sell (Gizmo works II, Gears II),
   * four copies or more, to lift for a copy the Bay wants; its want drops by one. */
  private sellOnly(id: HighFloorId): FEnt | null {
    const st = hfloor(this.g, id);
    if (!st) return null;
    let best: { name: string; n: number } | null = null;
    for (const name of ['Gizmo works II', 'Gears II']) {
      const n = this.placed(name, id);
      if (n >= 4 && (!best || n > best.n)) best = { name, n };
    }
    if (!best) return null;
    const e = [...st.ents].reverse().find((q) => q.kind === 'module' && this.g.design(q.design)?.name === best!.name) ?? null;
    if (e) this.want[best.name] = Math.min(this.want[best.name] ?? 0, best.n - 1);
    return e;
  }

  /** One command on a high floor (the District here, the World for bot4.ts): copies wanted stamped
   * and placed beside what they feed, a lot as the routes or tiles run out, routes, skiffs (barges
   * on the World). */
  floorWork(id: HighFloorId, want: Record<string, number>): boolean {
    const g = this.g;
    const st = hfloor(g, id);
    if (!st) return false;
    // copies wanted: stamped when none is spare, placed beside what they will feed
    for (const [name, n] of Object.entries(want)) {
      if (this.placed(name, id) >= n) continue;
      const d = this.b.designNamed(name);
      if (!d) continue;
      if (d.spare < 1) {
        // (while the bench saves for a group's claims the floor stamps nothing new)
        if (this.saving || this.feedSaving) continue;
        if (this.buyClaims(d, false)) return true;
        // once the plan is through, a copy that can't be stamped now (claims or coin short) is no
        // longer wanted: the growth round comes back to it (a want left standing held every later
        // copy, the floor idle on 18M coin at 17 h)
        if (stampRefusal(g, d)) { this.giveUp(name, id, want); continue; }
        this.act({ k: 'stamp', id: d.id }, 'stamp');
        return true;
      }
      if (this.buyClaims(d, true)) return true;
      // a copy the Bay wants on a full floor (every tile or every route taken, every lot bought):
      // a copy of a design that only sells is lifted to make room (the fifth pass: the District
      // stood full at 15 h, before the City's glass and sandwiches and the Transmuter's coils came)
      if (id === 'district' && Object.keys(d.outs).some((i) => bayWants(g, id).has(i as ItemId)) && !lotPrice(g, id) && (this.routesFull(id) || !this.tileFor(d, id))) {
        const v = this.sellOnly(id);
        if (v) { this.act({ k: 'hremove', floor: id, x: v.x, y: v.y }, 'clear'); return true; }
      }
      const t = this.tileFor(d, id);
      if (!t) {
        // the floor is full: the next lot
        if (this.buyLot(id)) return true;
        this.giveUp(name, id, want);
        continue;
      }
      if (hplaceRefusal(g, id, d.id, t.x, t.y)) { this.giveUp(name, id, want); continue; }
      this.act({ k: 'hplace', floor: id, design: d.id, x: t.x, y: t.y }, 'module:' + id);
      return true;
    }
    // the route cap binding (120, and 20 a lot): the next lot, while one is for sale
    if (st.routes.length >= maxRoutes(g, id) - 1 && this.buyLot(id)) return true;
    // routes, looked at every 5 s
    if (g.s.tick >= (this.routeAt[id] ?? 0)) {
      this.routeAt[id] = g.s.tick + 5 * TICK_RATE;
      if (this.routes(id)) { this.routeAt[id] = 0; return true; }
    }
    // skiffs, every 5 s: one more on the route furthest under 90% of its want
    if (g.s.tick >= (this.skiffAt[id] ?? 0)) {
      this.skiffAt[id] = g.s.tick + 5 * TICK_RATE;
      let best: { id: number; share: number } | null = null;
      for (const r of st.routes) {
        if (r.skiffs >= HIGH[id].maxSkiffs) continue;
        const w = routeWant(g, id, r);
        if (w <= 1e-6) continue;
        const share = routeCap(g, id, r) / w;
        if (share < 0.9 && (!best || share < best.share)) best = { id: r.id, share };
      }
      if (best && !g.s.coin.lt(HIGH[id].skiffCost * 3)) {
        this.act({ k: 'skiff', floor: id, id: best.id, n: 1 }, 'skiff');
        this.skiffAt[id] = g.s.tick + TICK_RATE;
        return true;
      }
    }
    return false;
  }

  /** Once the plan is through, a copy that can't be had now is no longer wanted (a want left
   * standing held every later copy: the floor idled on 18M coin at 17 h); the growth round comes
   * back to it. */
  private giveUp(name: string, id: HighFloorId = 'district', want: Record<string, number> = this.want) {
    if (this.growing) want[name] = this.placed(name, id);
  }

  /** A floor's routes at the most it holds now (120, and 20 a lot). */
  routesFull(id: HighFloorId = 'district'): boolean {
    const st = hfloor(this.g, id);
    return !!st && st.routes.length >= maxRoutes(this.g, id);
  }

  /** A floor's next lot, when the coin covers it with a fifth to spare. */
  buyLot(id: HighFloorId = 'district'): boolean {
    const p = lotPrice(this.g, id);
    if (!p || this.g.s.coin.lt(p.mul(1.2))) return false;
    this.act({ k: 'hlot', floor: id }, 'lot');
    return true;
  }

  /** Claims for a copy of `d` (stamping it, or placing it), a block bought when it costs at most
   * half the coin on hand (`spare` 2), or at most all of it for a group the bench is waiting on
   * (`spare` 1: the player saves for the claim the next group needs). True when a command went. */
  private buyClaims(d: ModuleDesign, place: boolean, spare = 2): boolean {
    const g = this.g;
    for (const [ore, n] of Object.entries(claimLoad(g, d)) as [ItemId, number][]) {
      let used = 0;
      if (place) used = placedClaims(g, ore);
      else for (const q of g.s.designs) { const l = claimLoad(g, q)[ore] ?? 0; if (l) used += l * this.copies(q); }
      if (used + n <= claimsHeld(g, ore) + 1e-9) continue;
      const price = claimPrice(g, ore);
      if (!g.done('surveying') || !price || g.s.coin.lt(price.mul(spare))) return false;
      this.act({ k: 'claim', item: ore }, 'claim:' + ore);
      return true;
    }
    return false;
  }

  private copies(d: ModuleDesign): number {
    let n = d.spare;
    for (const e of this.g.s.factory.ents) if (e.kind === 'module' && e.design === d.id) n++;
    for (const id of HIGH_IDS) for (const e of hfloor(this.g, id)?.ents ?? []) if (e.kind === 'module' && e.design === d.id) n++;
    return n;
  }

  /** Where a copy of `d` goes: the free tile nearest what its product will feed. */
  private tileFor(d: ModuleDesign, id: HighFloorId = 'district'): { x: number; y: number } | null {
    const g = this.g;
    const item = mainItem(d);
    const dest = item ? this.destFor(item, null, id) : this.floorEnt('fdock', id);
    const w = highW(g, id), h = HIGH[id].h;
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (hentAt(g, id, x, y)) continue;
        const dd = dest ? Math.hypot(x + 0.5 - (dest.x + dest.w / 2), y + 0.5 - (dest.y + dest.h / 2)) : 0;
        if (!best || dd < best.d - 1e-9) best = { x, y, d: dd };
      }
    return best;
  }

  /** What takes this item from a module now, in this player's order: a District module still short
   * of it, research wanting it, a Megaproject wanting it, an order wanting it, the Dock if it sells,
   * else the Hopper (banked). */
  private destFor(item: ItemId, from: FEnt | null, id: HighFloorId = 'district'): FEnt | undefined {
    const g = this.g;
    const st = hfloor(g, id)!;
    if (BYPRODUCTS.has(item)) return this.floorEnt('fdock', id);
    let best: FEnt | undefined, gap = 0.02;
    for (const c of st.ents) {
      if (c.kind !== 'module' || c === from) continue;
      const need = g.design(c.design)?.ins[item] ?? 0;
      if (!need) continue;
      let got = 0;
      for (const r of st.routes) if (r.to === c.id && r.item === item && r.from !== from?.id) got += Math.min(routeCap(g, id, r), routeWant(g, id, r));
      if (need - got > gap) { gap = need - got; best = c; }
    }
    if (best) return best;
    if (this.researchNeed(item) > 0) return this.floorEnt('fhopper', id);
    if (bayWants(g, id).has(item) && this.floorEnt('fbay', id)) return this.floorEnt('fbay', id);
    const act = g.s.orders.active;
    if (act && (ORDER[act].wants[item] ?? 0) > 0) return this.floorEnt('fdock', id);
    if (ITEMS[item].value > 0 && !ITEMS[item].refused) return this.floorEnt('fdock', id);
    return this.floorEnt('fhopper', id);
  }

  /** Keep every District module's routes: its main product to what wants it most now, its other
   * products that sell to the Dock (its waste goes down the chute on its own). One command, or
   * false. */
  private routes(id: HighFloorId = 'district'): boolean {
    const g = this.g;
    const st = hfloor(g, id)!;
    for (const m of st.ents) {
      if (m.kind !== 'module') continue;
      const d = g.design(m.design);
      if (!d) continue;
      for (const item of Object.keys(d.outs) as ItemId[]) {
        const mine = st.routes.filter((r) => r.from === m.id && r.item === item);
        // a byproduct with no route goes down the waste chute to the Dock on its own (DESIGN.md §21,
        // the second gate): no route spent on it; a waste route left from before is lifted
        if (BYPRODUCTS.has(item)) {
          if (mine[0]) { this.act({ k: 'unroute', floor: id, id: mine[0].id }); return true; }
          continue;
        }
        // every other output where it is wanted most (a second product, the Concrete group's
        // concrete, to the Bay as much as its first)
        const dest = this.destFor(item, m, id);
        if (!dest) continue;
        if (mine.some((r) => r.to === dest!.id)) {
          // a second route of the same item, left from an earlier job: lifted
          const old = mine.find((r) => r.to !== dest!.id);
          if (old) { this.act({ k: 'unroute', floor: id, id: old.id }); return true; }
          continue;
        }
        // the main product's job changed only when the old destination no longer wants it
        const keep = mine.find((r) => {
          const to = hent(g, id, r.to);
          if (!to) return false;
          if (to.kind === 'module') return true;
          if (to.kind === 'fhopper') return this.researchNeed(item) > 0;
          if (to.kind === 'fbay') return bayWants(g, id).has(item);
          return dest!.kind === 'fdock';
        });
        if (keep && !(dest.kind === 'module' && hent(g, id, keep.to)?.kind !== 'module')) continue;
        if (keep) { this.act({ k: 'unroute', floor: id, id: keep.id }); return true; }
        // (a route the floor refuses now, the cap reached or the coin short, is left for later: a
        // refused command would hold the hands every beat)
        if (routeRefusal(g, id, m.x, m.y, dest.x, dest.y, item)) continue;
        const r = this.act({ k: 'route', floor: id, fx: m.x, fy: m.y, tx: dest.x, ty: dest.y, item }, 'route');
        if (r !== null) return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- clicking

  /** Overdrive on the District (DESIGN.md §18): a click on a module runs its route group 3x for
   * 10 s; the groups are taken round robin as they cool, at most two clicks a second. */
  private overdrive() {
    const g = this.g;
    const st = g.s.district;
    if (!st || !g.done('overdrive') || g.s.tick < this.odAt) return;
    const mods = st.ents.filter((e) => e.kind === 'module');
    const ready = mods.filter((m) => m.state === 'work' && !(m.od ?? 0) && !(m.cool ?? 0)).sort((a, b) => a.id - b.id);
    if (!ready.length) return;
    const m = ready.find((q) => q.id >= this.odNext) ?? ready[0];
    const r = this.act({ k: 'hclick', floor: 'district', x: m.x, y: m.y });
    if (r === null) return;
    this.odNext = m.id + 1;
    this.odAt = g.s.tick + TICK_RATE / 2;
    if (r) this.b.log.overdrives.push(g.s.tick);
  }
}
