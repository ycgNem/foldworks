// Megaprojects (DESIGN.md §18, §19): enormous builds on the Factory floor's Megaproject Bay, fed by
// trunk. Their progress survives every reset (Reorganize keeps `mega`). Stage 1 of the Great Drill
// is Act II's last goal; stages 2 and 3 (Milestone 5) are built across the next runs, and each one
// changes a rule for good. Stages 2 and 3 open at a reputation with the Committee (kept through
// every reset): until then the Bay counts nothing for them (it never jams: what it can't count goes
// on to the Dock), and the Drill screen says what opens it.
import type { ItemId } from './items';
import type { WorldId } from './worlds';

export interface MegaStage {
  stage: number;
  name: string;
  /** what it wants delivered to the Bay */
  wants: Partial<Record<ItemId, number>>;
  /** the Committee's reputation the stage opens at (the Bay counts nothing for it before) */
  rep?: number;
  /** what it gives, as a row of rich-text markup (docs/hud-180.md) */
  reward: string;
  /** Patents the whole stage is worth at Reorganize, earned in proportion as it is delivered (§19) */
  patents: number;
  /** the island the stage is built on (Megaprojects #4 and #5, DESIGN.md §22): it wants that
   * island's product, so only there can it be built */
  world?: WorldId;
  derivation: string;
}

export const MEGA: MegaStage[] = [
  {
    stage: 1,
    name: 'The Great Drill, stage 1',
    wants: { drillBit: 650, steel: 2800 },
    reward: 'every Miner and every module with miners inside {good:+50%} · for good',
    patents: 5,
    derivation: '§18 Megaproject #1: from the slag the Act II bot Bay floor turns into bits (a bit is 2 concrete, 8 slag; about 35 slag/min, 5-6 bits/min while the Bay Steel runs, 2.5 after): 650 bits and 2,800 steel (4.3 a bit) take it about 1.9 h from the Bay floor (S+1:46-1:48), stage 1 at S+3:42-3:44, inside the S+4 h target, so the first Reorganize comes after 4 h (the final round: the bot draining its slag reached the Bay 20 min sooner, and 450 bits and 2,000 steel put the first reset at 3:37-3:41, under the 4-6 h of §19); concrete is in the bits; §19 worth 5 Patents, a third of the first reset',
  },
  {
    stage: 2,
    name: 'The Great Drill, stage 2: the Bore',
    wants: { drillBit: 250, steel: 1000 },
    rep: 3,
    reward: 'Miners dig from any tile touching a patch · 3× the miners a patch · for good',
    patents: 6,
    derivation: '§19 Great Drill stage 2: 250 bits and 1,000 steel (4 steel a bit, under the 4.4 of stage 1) are about 50 min of the stage-1 Bay floor (5 bits/min), inside a second run; it opens at the Committee\'s reputation 3: two orders a run (The Pile and Shiny Things), so never in the first run, early in the second (the first reset comes after stage 1: the review round); worth 6 Patents',
  },
  {
    stage: 3,
    name: 'The Great Drill, stage 3: Breakthrough',
    wants: { drillBit: 300, steel: 1200 },
    rep: 5,
    reward: 'deep seams under Chunk D · {i:ironOre} and {i:copperOre} deposits · for good',
    patents: 8,
    derivation: '§19 Great Drill stage 3: 300 bits and 1,200 steel (4 steel a bit, as stage 2), about 60 min of the Bay floor, so the third run finishes it with time to spare (400 bits ran past the bot\'s 4 h on seed 8919: the review round); it opens at the Committee\'s reputation 5 (the third run\'s first order), so it lands in the third run and the Drill is done by its end; worth 8 Patents',
  },
];

/** The stage the Bay is building now, or null when every stage so far is done. */
export function megaStage(done: number): MegaStage | null {
  return MEGA.find((m) => m.stage === done + 1) ?? null;
}

// ---- Megaprojects #2-#5 (DESIGN.md §21, §22): each its own project with stages, kept through every
// reset like the Great Drill (`s.megas[id]`), built at the Bay of a higher floor. One Bay may hold
// several projects: what it is given goes to the first open project that still wants it.

export type MegaId = 'city' | 'transmuter' | 'lighthouse' | 'anchor';

export interface MegaProjectDef {
  id: MegaId;
  name: string;
  /** the floor whose Bay builds it */
  floor: 'district' | 'world';
  /** the research that opens it */
  opens: string;
  stages: MegaStage[];
  /** its stages are built in any order, each on its own island (`world`): the stage open is the one
   * of the island the town stands on (Megaprojects #4 and #5, DESIGN.md §22) */
  anyOrder?: boolean;
  derivation: string;
}

/** A stage of Megaprojects #4 and #5 (DESIGN.md §22): the island's product and the project's part. */
const isle = (stage: number, world: WorldId, name: string, wants: Partial<Record<ItemId, number>>, reward: string, derivation: string): MegaStage =>
  ({ stage, world, name, wants, reward, patents: 10, derivation: derivation + '; worth 10 Patents (§19, as the Transmuter\'s last stage) and 3 Legacy (§22)' });

export const MEGAS: Record<MegaId, MegaProjectDef> = {
  city: {
    id: 'city', name: 'The Floating City', floor: 'district', opens: 'floatingCity',
    stages: [
      {
        stage: 1, name: 'The Floating City, stage 1: the Platform', wants: { liftRotor: 120, concrete: 1500 },
        reward: 'the Factory floor gains its ninth row · for good', patents: 6,
        derivation: '§21 Megaprojects (the second gate): 120 lift rotors and 1,500 concrete, about an hour of one Lift Rotor group and two Concrete groups (0.3-0.4 a second each; 4,000 was 2.6-3.7 h of one) at the District Bay; the Factory\'s ninth row (FACTORY_MAX_H) for good; worth 6 Patents',
      },
      {
        stage: 2, name: 'The Floating City, stage 2: the Spires', wants: { liftRotor: 150, sandwich: 300, glass: 2500 },
        reward: 'the District gains a fourth lot · for good', patents: 8,
        derivation: '§21 Megaprojects (the second gate): 150 rotors, 300 sandwiches (the citizens), 2,500 glass, about 1.5 h of the Bay floor in a later run (6,000 glass and 1,000 sandwiches were 4-9 h); a fourth District lot (20x10 at most) for good; worth 8 Patents',
      },
    ],
    derivation: '§21 Megaproject #2 (PLAN.md): the Floating City, +1 Factory floor row (§15)',
  },
  transmuter: {
    id: 'transmuter', name: 'The Scrap Transmuter', floor: 'district', opens: 'scrapTransmuter',
    stages: [
      {
        stage: 1, name: 'The Scrap Transmuter, stage 1', wants: { transmuterCoil: 80, steel: 3000 },
        reward: 'every Dock buys {i:slag} {i:oil} {i:sludge} at {coinc:25%} of what made them · for good', patents: 8,
        derivation: '§21 Megaprojects (the second gate): 80 coils and 3,000 steel, about an hour of a Coil group and two Steel copies (0.73-0.84 a second; 8,000 was 2.6-3 h); byproducts sell at 25% of their recipe\'s main output (§15: the Scrap Transmuter); worth 8 Patents',
      },
      {
        stage: 2, name: 'The Scrap Transmuter, stage 2', wants: { transmuterCoil: 150, processor: 120 },
        reward: 'a module whose byproduct has nowhere to go sells it at that price instead of stopping · for good', patents: 10,
        derivation: '§21 Megaprojects (the second gate): 150 coils and 120 processors, about 1.5 h (300 processors were 900 circuits, 3 h); the byproduct lesson is finished, so waste never stops a module again; worth 10 Patents',
      },
    ],
    derivation: '§21 Megaproject #3 (PLAN.md): the Scrap Transmuter, byproducts sell at 25% of the item that made them (§15)',
  },
  // Act IV (DESIGN.md §22): built at the World's Bay, one stage on each island, in any order; every
  // stage wants the project's part (made of what every island makes) and one island's product, so
  // the two projects are finished only by visiting all four islands (§16: four by 60 h). Their
  // rewards are rules about distance (the Lighthouse) and room kept through resets (the Anchor)
  lighthouse: {
    id: 'lighthouse', name: 'The Lighthouse at the Edge', floor: 'world', opens: 'lighthouse', anyOrder: true,
    stages: [
      isle(1, 'pebble', 'The Lighthouse, the Lens Room (Pebble Isle)', { lighthouseLamp: 150, horizonLens: 200 },
        'barges fly {good:4} tiles/s, was 3 · for good',
        '§22 Megaprojects: 150 lamps (a Lamp group at 0.1-0.2 a second, 15-25 min) and 200 horizon lenses (a Horizon group at 0.05-0.1, 35-65 min) at the World Bay; barges a tile a second faster, as Long Skiffs on the District (§21)'),
      isle(2, 'cinder', 'The Lighthouse, the Beacon (Cinder Isle)', { lighthouseLamp: 150, sunsetDye: 800 },
        'every high floor\'s skiffs and barges spend {good:half} as long loading · for good',
        '§22 Megaprojects: 150 lamps and 800 sunset dye (a Dye group at 0.3 a second, about 45 min); the dwell halved: a route beside its consumer carries most of the gain (the Lighthouse rewards a tight layout)'),
      isle(3, 'rime', 'The Lighthouse, the Keeper\'s House (Rime)', { lighthouseLamp: 150, stormCell: 300 },
        'the World floor gains its first lot · for good',
        '§22 Megaprojects: 150 lamps and 300 storm cells (a Storm group at 0.1 a second, 50 min); a World lot kept for good, as the Floating City\'s District lot (§21)'),
      isle(4, 'oldworks', 'The Lighthouse, the Light (the Old Works)', { lighthouseLamp: 150, relicGear: 800 },
        'a route counts at most {good:6} tiles, however far it flies · for good',
        '§22 Megaprojects: 150 lamps and 800 relic gears (a Relic group at 0.3 a second, 45 min); the far routes capped at six tiles\' length: the last stage frees the layout, as the Transmuter\'s last stage ends the byproduct lesson (§21)'),
    ],
    derivation: '§22 Megaproject #4 (docs/endgame.md): the Lighthouse at the Edge, rules about distance on the high floors',
  },
  anchor: {
    id: 'anchor', name: 'The Sky Anchor', floor: 'world', opens: 'skyAnchor', anyOrder: true,
    stages: [
      isle(1, 'pebble', 'The Sky Anchor, the Mooring (Pebble Isle)', { anchorChain: 150, skyglassLens: 1200 },
        'the Factory annex is kept through every Reorganize · for good',
        '§22 Megaprojects: 150 chains (a Chain group at 0.1-0.2 a second) and 1,200 skyglass lenses (a Lens group at 0.5, 40 min); the annex kept: §19\'s open lever for rule 3 (room kept through a Reorganize)'),
      isle(2, 'cinder', 'The Sky Anchor, the Chain (Cinder Isle)', { anchorChain: 150, cinderAlloy: 1200 },
        'District lots bought are kept through every Reorganize · for good',
        '§22 Megaprojects: 150 chains and 1,200 cinder alloy (an Alloy group at 0.5 a second, 40 min); the District\'s lots kept'),
      isle(3, 'rime', 'The Sky Anchor, the Fluke (Rime)', { anchorChain: 150, frostAlloy: 800 },
        'World lots bought are kept through every Reorganize · for good',
        '§22 Megaprojects: 150 chains and 800 frost alloy (a Frost group at 0.3 a second, 45 min); the World\'s lots kept'),
      isle(4, 'oldworks', 'The Sky Anchor, the Anchor (the Old Works)', { anchorChain: 150, relicGear: 800 },
        'the annex and every lot kept are kept through a Relocate too · for good',
        '§22 Megaprojects: 150 chains and 800 relic gears (45 min); the room the Anchor holds stays with the town when it flies'),
    ],
    derivation: '§22 Megaproject #5 (docs/endgame.md): the Sky Anchor, room kept through resets',
  },
};

export const MEGA_IDS = Object.keys(MEGAS) as MegaId[];
