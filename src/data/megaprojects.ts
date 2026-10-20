// Megaprojects (DESIGN.md §18, §19): enormous builds on the Factory floor's Megaproject Bay, fed by
// trunk. Their progress survives every reset (Reorganize keeps `mega`). Stage 1 of the Great Drill
// is Act II's last goal; stages 2 and 3 (Milestone 5) are built across the next runs, and each one
// changes a rule for good. Stages 2 and 3 open at a reputation with the Committee (kept through
// every reset): until then the Bay takes nothing for them, and the Drill screen says what opens it.
import type { ItemId } from './items';

export interface MegaStage {
  stage: number;
  name: string;
  /** what it wants delivered to the Bay */
  wants: Partial<Record<ItemId, number>>;
  /** the Committee's reputation the stage opens at (the Bay takes nothing for it before) */
  rep?: number;
  /** what it gives, in words */
  reward: string;
  /** Patents the whole stage is worth at Reorganize, earned in proportion as it is delivered (§19) */
  patents: number;
  derivation: string;
}

export const MEGA: MegaStage[] = [
  {
    stage: 1,
    name: 'The Great Drill, stage 1',
    wants: { drillBit: 450, steel: 2000 },
    reward: 'Every Miner and every module with miners inside runs +50%, for good',
    patents: 5,
    derivation: '§18 Megaproject #1: from the slag the Act II bot Bay floor turns into bits (a bit is 2 concrete, 8 slag; about 35 slag/min, 5-6 bits/min while the Bay Steel runs, 2.5 after): 450 bits and 2,000 steel take it about 1.4 h, stage 1 at S+3:20, inside the S+4 h target; concrete is in the bits; §19 worth 5 Patents, a third of the first reset',
  },
  {
    stage: 2,
    name: 'The Great Drill, stage 2: the Bore',
    wants: { drillBit: 250, steel: 1000 },
    rep: 2,
    reward: 'Miners also dig from beside an ore patch (any tile touching it), for good: a patch feeds three times the miners',
    patents: 6,
    derivation: '§19 Great Drill stage 2: 250 bits and 1,000 steel (4 steel a bit, under the 4.4 of stage 1, so the steel is in before the bits and the Bay floor never jams on slag once its bits are full) are about 50 min of the stage-1 Bay floor (5 bits/min), inside a second run; it opens at the Committee\'s reputation 2, two of its orders (one or two a run); worth 6 Patents',
  },
  {
    stage: 3,
    name: 'The Great Drill, stage 3: Breakthrough',
    wants: { drillBit: 400, steel: 1600 },
    rep: 4,
    reward: 'The Drill breaks into the deep seams: chunk D gains an iron and a copper deposit, for good',
    patents: 8,
    derivation: '§19 Great Drill stage 3: 400 bits and 1,600 steel (4 steel a bit, as stage 2), about 80 min of the Bay floor; it opens at the Committee\'s reputation 4 (two more orders, the second run\'s or the third\'s), so it lands in the third run; worth 8 Patents',
  },
];

/** The stage the Bay is building now, or null when every stage so far is done. */
export function megaStage(done: number): MegaStage | null {
  return MEGA.find((m) => m.stage === done + 1) ?? null;
}
