// Megaprojects (DESIGN.md §18): enormous builds on the Factory floor's Megaproject Bay, fed by
// trunk. Their progress survives every reset. Stage 1 of the Great Drill is Act II's last goal.
import type { ItemId } from './items';

export interface MegaStage {
  stage: number;
  name: string;
  /** what it wants delivered to the Bay */
  wants: Partial<Record<ItemId, number>>;
  /** what it gives, in words */
  reward: string;
  derivation: string;
}

export const MEGA: MegaStage[] = [
  {
    stage: 1,
    name: 'The Great Drill, stage 1',
    wants: { drillBit: 450, steel: 2000 },
    reward: 'Every Miner and every module with miners inside runs +50%, for good',
    derivation: '§18 Megaproject #1: from the slag the Act II bot Bay floor turns into bits (a bit is 2 concrete, 8 slag; about 35 slag/min, 5-6 bits/min while the Bay Steel runs, 2.5 after): 450 bits and 2,000 steel take it about 1.4 h, stage 1 at S+3:20, inside the S+4 h target; concrete is in the bits',
  },
];

/** The stage the Bay is building now, or null when every stage so far is done. */
export function megaStage(done: number): MegaStage | null {
  return MEGA.find((m) => m.stage === done + 1) ?? null;
}
