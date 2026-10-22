// Miners (DESIGN.md §4): 1 ore per 2.0 s from the patch under them, out of their front. A Lucky
// Vein on their patch runs them at 3x (§6). Progress is counted in ticks, so 2.0 s is exactly 40.
import type { Game } from '../Game';
import { DX, DY } from '../world';
import { RECIPE } from '../../data/recipes';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { offer } from '../transfer';
import { note } from './stats';
import { odBoost, overdriveTick, veinBoost } from './machines';
import { isAudited } from './audits';
import { prules } from '../patents';
import { scenarioMiners } from '../scenario';

export function runMiners(g: Game) {
  const cap = RULES.outputCap.value;
  for (const m of g.miners) {
    // stopped by the player (DESIGN.md §20): digs nothing
    if (m.paused) {
      m.state = 'idle';
      m.why = 'paused';
      overdriveTick(m);
      note(m);
      continue;
    }
    const r = RECIPE[m.recipe ?? 'mineIron'];
    const out = r.outputs[0].item;
    const pi = g.patchOf[m.y * g.W + m.x];
    // a Lucky Vein, Overdrive and the Great Drill's stage 1 (§18) multiply
    // a Lucky Vein and Overdrive boost its line (never while audited, or they would be folded in)
    const speed = veinBoost(g, m)
      * odBoost(g, m)
      // Rich Ore (a Scenario's twist, DESIGN.md §21)
      * scenarioMiners(g)
      // the Great Drill never reaches a miner being audited (a folded rate would count it twice)
      * (g.s.mega.stage >= 1 && !isAudited(g, m.id) ? 1 + RULES.drillBoost.value : 1);
    if (m.out < cap) {
      m.prog += speed;
      m.wkAcc = (m.wkAcc ?? 0) + 1;
      const need = r.time * TICK_RATE;
      while (m.prog >= need - 1e-9 && m.out < cap) {
        m.prog -= need;
        m.out++;
        m.outItem = out;
        m.crafts++;
      }
      m.state = 'work';
      m.why = null;
    } else {
      m.state = 'blocked';
      m.why = out;
    }
    if (m.out > 0 && offer(g, m.x + DX[m.rot], m.y + DY[m.rot], m.rot, m.outItem!)) m.out--;
    overdriveTick(m, prules(g).overdriveCool);
    note(m);
  }
}
