// Sparks (DESIGN.md §6): random events on the map, re-derived from the factory (DECISIONS.md:
// the Inspector grades a real line, the Lucky Vein lands on a patch with a working miner). Click
// one for a bonus; miss it and nothing happens.

export type SparkKind = 'vein' | 'inspector';

export interface SparkDef {
  kind: SparkKind;
  name: string;
  /** what the tooltip says */
  blurb: string;
  /** relative chance among the Sparks that can appear right now */
  weight: number;
  derivation: string;
}

export const SPARKS: Record<SparkKind, SparkDef> = {
  vein: { kind: 'vein', name: 'Lucky Vein', blurb: "Click: this patch's miners run 3x for 60 s.", weight: 1, derivation: '§6 Lucky Vein: 3x for 60 s on a patch with a working miner' },
  inspector: { kind: 'inspector', name: 'Inspector', blurb: 'Click: they grade this line and pay 60 s of its output value x the grade.', weight: 1, derivation: '§6 Inspector: 60 s of measured output x grade multiplier' },
};
