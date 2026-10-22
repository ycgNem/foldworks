// Megaprojects (DESIGN.md §18, §19): enormous builds on the Factory floor's Megaproject Bay, fed by
// trunk. Their progress survives every reset (Reorganize keeps `mega`). Stage 1 of the Great Drill
// is Act II's last goal; stages 2 and 3 (Milestone 5) are built across the next runs, and each one
// changes a rule for good. Stages 2 and 3 open at a reputation with the Committee (kept through
// every reset): until then the Bay counts nothing for them (it never jams: what it can't count goes
// on to the Dock), and the Drill screen says what opens it.
import type { ItemId } from './items';

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

export type MegaId = 'city' | 'transmuter';

export interface MegaProjectDef {
  id: MegaId;
  name: string;
  /** the floor whose Bay builds it */
  floor: 'district' | 'world';
  /** the research that opens it */
  opens: string;
  stages: MegaStage[];
  derivation: string;
}

export const MEGAS: Record<MegaId, MegaProjectDef> = {
  city: {
    id: 'city', name: 'The Floating City', floor: 'district', opens: 'floatingCity',
    stages: [
      {
        stage: 1, name: 'The Floating City, stage 1: the Platform', wants: { liftRotor: 120, concrete: 4000 },
        reward: 'the Factory floor gains its ninth row · for good', patents: 6,
        derivation: '§21 Megaprojects: 120 lift rotors and 4,000 concrete, about an hour of one Lift Rotor group and a Concrete group at the District Bay; the Factory\'s ninth row (FACTORY_MAX_H) for good; worth 6 Patents',
      },
      {
        stage: 2, name: 'The Floating City, stage 2: the Spires', wants: { liftRotor: 200, sandwich: 1000, glass: 6000 },
        reward: 'the District gains a fourth lot · for good', patents: 8,
        derivation: '§21 Megaprojects: 200 rotors, 1,000 sandwiches (the citizens), 6,000 glass, about 1.5 h of the Bay floor in a later run; a fourth District lot (18x10) for good; worth 8 Patents',
      },
    ],
    derivation: '§21 Megaproject #2 (PLAN.md): the Floating City, +1 Factory floor row (§15)',
  },
  transmuter: {
    id: 'transmuter', name: 'The Scrap Transmuter', floor: 'district', opens: 'scrapTransmuter',
    stages: [
      {
        stage: 1, name: 'The Scrap Transmuter, stage 1', wants: { transmuterCoil: 100, steel: 8000 },
        reward: 'every Dock buys {i:slag} {i:oil} {i:sludge} at {coinc:25%} of what made them · for good', patents: 8,
        derivation: '§21 Megaprojects: 100 coils and 8,000 steel, about an hour of a Coil group and two Steel copies; byproducts sell at 25% of their recipe\'s main output (§15: the Scrap Transmuter); worth 8 Patents',
      },
      {
        stage: 2, name: 'The Scrap Transmuter, stage 2', wants: { transmuterCoil: 200, processor: 300 },
        reward: 'a module whose byproduct has nowhere to go sells it at that price instead of stopping · for good', patents: 10,
        derivation: '§21 Megaprojects: 200 coils and 300 processors, about 1.5 h; the byproduct lesson is finished, so waste never stops a module again; worth 10 Patents',
      },
    ],
    derivation: '§21 Megaproject #3 (PLAN.md): the Scrap Transmuter, byproducts sell at 25% of the item that made them (§15)',
  },
};

export const MEGA_IDS = Object.keys(MEGAS) as MegaId[];
