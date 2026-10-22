// Scenarios (DESIGN.md §21 Scenarios): a board set up on a fresh game, its twist read by the
// systems through these helpers, and its score (the best fold of its product this game). The
// efficiency boards (each board's bests per tile, per kW and waste, DESIGN.md §24) are kept in
// `meta.boards`, by the Scenario game itself and, handed over, by the town (src/sim/longtail.ts).
import type { Game } from './Game';
import { Num } from '../engine/num';
import { BUILD } from '../data/machines';
import { RESEARCH, RESEARCH_IDS } from '../data/research';
import { SCENARIOS, type ScenarioDef, type ScenarioId } from '../data/scenarios';
import type { ModuleDesign } from './world';

export const scenarioOf = (g: Game): ScenarioDef | null => (g.s.scenario ? SCENARIOS[g.s.scenario as ScenarioId] ?? null : null);

/** Lay a board out on a game just made (the Game constructor calls it). */
export function setupScenario(g: Game, id: ScenarioId) {
  const d = SCENARIOS[id];
  const s = g.s;
  s.scenario = id;
  s.land = [...d.land];
  const acts = d.research === 'act1' ? [1] : [1, 2];
  s.research.done = RESEARCH_IDS.filter((r) => acts.includes(RESEARCH[r].act ?? 1) && r !== 'greatDrill');
  s.coin = Num.of(d.coin);
  s.granted = Num.of(d.coin);
  s.upgrades.push('bellows');
  g.layoutDirty = true;
}

/** Miners' speed on this board (Rich Ore: 2x). */
export const scenarioMiners = (g: Game) => scenarioOf(g)?.miners ?? 1;
/** Power producers' factor on this board (Little Power: 0.5x). */
export const scenarioPower = (g: Game) => scenarioOf(g)?.power ?? 1;

/** Belt tiles left on this board (Scarce Belts), or Infinity. */
export function beltsLeft(g: Game): number {
  const d = scenarioOf(g);
  if (!d?.belts) return Infinity;
  return d.belts - g.s.ents.filter((e) => e.kind === 'belt').length;
}

/** A design's score on this board: its product per minute, per tile of its box for Tiny Island. */
export function designScore(d: ModuleDesign, def: ScenarioDef): number {
  if ((d.depth ?? 1) !== 1) return 0;
  const perMin = (d.outs[def.product] ?? 0) * 60;
  if (def.measure === 'perKw') {
    // per kW its machines draw in Normal mode (DESIGN.md §24): an unpowered fold scores nothing here
    const kw = designKwOf(d);
    return kw > 0 ? perMin / kw : 0;
  }
  return def.measure === 'perTile' ? perMin / (d.box.w * d.box.h) : perMin;
}

/** kW a Workshop design's machines draw at full speed in Normal mode (src/sim/longtail.ts reads it
 * for the efficiency boards). */
export function designKwOf(d: ModuleDesign): number {
  let kw = 0;
  for (const p of d.parts) kw += BUILD[p.kind]?.kw ?? 0;
  return kw;
}

/** The board's best fold so far: its score, grade and design, or null before the first. */
export function scenarioBest(g: Game): { score: number; grade: string; design: number } | null {
  const def = scenarioOf(g);
  if (!def) return null;
  let best: { score: number; grade: string; design: number } | null = null;
  for (const d of g.s.designs) {
    const score = designScore(d, def);
    if (score > 0 && (!best || score > best.score)) best = { score, grade: d.grade.letter, design: d.id };
  }
  return best;
}
