// Miners (DESIGN.md §4): 1 ore per 2.0 s from the patch under them, out of their front. A Lucky
// Vein on their patch runs them at 3x (§6). Progress is counted in ticks, so 2.0 s is exactly 40.
import type { Game } from '../Game';
import { DX, DY } from '../world';
import { RECIPE } from '../../data/recipes';
import { RULES } from '../../data/rules';
import { TICK_RATE } from '../../engine/time';
import { offer } from '../transfer';
import { note } from './stats';
import { overdriveTick } from './machines';

export function runMiners(g: Game) {
  const cap = RULES.outputCap.value;
  for (const m of g.miners) {
    const r = RECIPE[m.recipe ?? 'mineIron'];
    const out = r.outputs[0].item;
    const pi = g.patchOf[m.y * g.W + m.x];
    // a Lucky Vein, Overdrive and the Great Drill's stage 1 (§18) multiply
    // (a miner being audited runs at its own speed: a boost would be folded in for good)
    const audited = !!g.s.audit && !g.s.audit.result && g.s.audit.ids.includes(m.id);
    const speed = ((g.s.veins[pi] ?? 0) > 0 && !audited ? RULES.veinMult.value : 1)
      * ((m.od ?? 0) > 0 ? RULES.overdriveMult.value : 1)
      * (g.s.mega.stage >= 1 ? 1 + RULES.drillBoost.value : 1);
    if (m.out < cap) {
      m.prog += speed;
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
    overdriveTick(m);
    note(m);
  }
}
