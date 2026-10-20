// Automation (DESIGN.md §19, pillar 2): the chores of the first layer, handed to machines by the
// Patent tree, and the Committee's Night Crew. Runs first in the tick, right after the input
// commands, since each of these is an action a player would otherwise take:
//  - the Builder Dragonflies build blueprint ghosts as coin allows (src/sim/blueprints.ts);
//  - the Shovel Frog clears one machine jammed on its byproduct every second;
//  - the Lab Assistant picks research when none is selected;
//  - the Order Clerk accepts the first offered order when none is active;
//  - the Stamp Press keeps one spare copy of each design marked for it, the cheapest first;
//  - the Night Crew (the Committee's reputation 2) takes a slag off every heap every 10 s.
// None of it goes through the command log: it is the sim's own rule, replayed the same way.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { TICK_RATE } from '../../engine/time';
import { RULES } from '../../data/rules';
import { RESEARCH, type ResearchId } from '../../data/research';
import type { ItemId } from '../../data/items';
import { prules } from '../patents';
import { runDrones } from '../blueprints';
import { shovel } from './machines';
import { availableNodes, selectResearch } from './research';
import { offeredOrders } from './orders';
import { stamp, stampCost, stampRefusal } from './modules';

export function runAutomation(g: Game) {
  const r = prules(g);
  runDrones(g);
  const t = g.s.tick;
  if (r.shovelEvery && t % (r.shovelEvery * TICK_RATE) === 0) {
    const m = g.machines.find((q) => q.state === 'blocked' && q.byItem && q.why === q.byItem && q.by >= RULES.outputCap.value);
    if (m) shovel(g, m);
  }
  if (t % TICK_RATE === 0) {
    if (r.lab && !g.s.research.selected) labPick(g);
    if (r.clerk && !g.s.orders.active) {
      const o = offeredOrders(g)[0];
      if (o) {
        g.s.orders.active = o.id;
        g.s.orders.progress[o.id] ??= {};
        g.emit({ type: 'orderAccept', id: o.id });
      }
    }
  }
  if (r.stampPressEvery && t % (r.stampPressEvery * TICK_RATE) === 0) {
    const want = g.s.designs.filter((d) => d.auto && d.spare < 1 && !stampRefusal(g, d));
    want.sort((a, b) => stampCost(g, a).cmp(stampCost(g, b)));
    if (want[0]) stamp(g, want[0].id);
  }
  if (r.nightCrew && t % (RULES.nightCrewSeconds.value * TICK_RATE) === 0) for (const h of g.logistics) if (h.kind === 'heap' && h.count > 0) h.count--;
}

/** The node the bank pays the largest share of (the cheapest, on a tie). */
function labPick(g: Game) {
  const r = g.s.research;
  let best: ResearchId | null = null, bf = -1, bc = Infinity;
  for (const d of availableNodes(g)) {
    let have = 0, need = 0;
    for (const [it, n] of Object.entries(d.cost) as [ItemId, number][]) {
      need += n;
      have += Math.min(n, (r.progress[d.id]?.[it]?.toNumber() ?? 0) + (r.bank[it]?.toNumber() ?? 0));
    }
    const f = need ? have / need : 1;
    if (f > bf + 1e-9 || (Math.abs(f - bf) < 1e-9 && need < bc)) { best = d.id; bf = f; bc = need; }
  }
  if (best) selectResearch(g, best);
}

/** Mark a design for the Stamp Press (or unmark it). */
export function autoStamp(g: Game, id: number): ActResult {
  if (!prules(g).stampPressEvery) return no('Buy the Stamp Press (a Patent) first');
  const d = g.s.designs.find((q) => q.id === id);
  if (!d) return no('No such module');
  d.auto = !d.auto;
  return OK;
}

export { RESEARCH };
