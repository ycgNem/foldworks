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
    wants: { drillBit: 40, concrete: 1500, steel: 600 },
    reward: 'Every Miner and every module with miners inside runs +50%, for good',
    derivation: '§18 Megaproject #1: 40 Drill Bits, 1,500 concrete and 600 steel, about the last hour of Act II',
  },
];

/** The stage the Bay is building now, or null when every stage so far is done. */
export function megaStage(done: number): MegaStage | null {
  return MEGA.find((m) => m.stage === done + 1) ?? null;
}
