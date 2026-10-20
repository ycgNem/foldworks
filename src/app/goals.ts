// The next goal (DESIGN.md §16 rule 1: the cheapest meaningful goal is always in reach, and the
// player is told what it is). One line at the bottom of the screen, picked from the game's state,
// with where to look. Presentation only: it reads the Game.
import type { Game } from '../sim/Game';
import { BUILD } from '../data/machines';
import { RESEARCH } from '../data/research';
import { CHUNKS } from '../data/land';
import { RULES } from '../data/rules';
import { availableNodes, researchFrac } from '../sim/systems/research';
import { offeredOrders } from '../sim/systems/orders';

export interface Goal {
  text: string;
  /** a tile to point at, if any */
  tile?: { x: number; y: number };
  /** a HUD element to point at: 'bellows', 'research', 'orders', 'build:<kind>', 'land' */
  ui?: string;
}

export function nextGoal(g: Game): Goal | null {
  const s = g.s;
  const furnace = g.machines.find((m) => m.kind === 'furnace');
  const hasBellows = g.has('bellows');
  const count = (k: string) => s.ents.filter((e) => e.kind === k).length;
  if (furnace && furnace.by >= RULES.outputCap.value && count('heap') === 0)
    return { text: 'The furnace is choked with slag! Click it to shovel, or build a Slag Heap beside it (25).', tile: { x: furnace.x, y: furnace.y }, ui: 'build:heap' };
  if (!hasBellows) {
    if (furnace && !furnace.active && !(furnace.inBuf.ironOre ?? 0) && s.coin.lt(25))
      return { text: 'Click the iron ore to feed the Hand Furnace.', tile: { x: 2, y: 3 } };
    if (s.coin.lt(25)) return { text: 'Click the Hand Furnace to crank it: 8 cranks make an ingot. Ingots sell at the Dock.', tile: furnace ? { x: furnace.x, y: furnace.y } : undefined };
    return { text: 'Buy the Bellows (25): the furnace will run itself.', ui: 'bellows' };
  }
  if (count('miner') === 0) {
    if (s.coin.lt(BUILD.miner.cost)) return { text: `Keep feeding ore by hand. At ${BUILD.miner.cost} coin, build a Miner on the ore, facing the furnace.`, tile: { x: 2, y: 3 } };
    return { text: 'Build a Miner (2) on the ore tile beside the furnace, facing it (R rotates).', ui: 'build:miner', tile: { x: 2, y: 3 } };
  }
  if (count('heap') === 0 && furnace && furnace.by > 0)
    return { text: 'Slag piles up in the furnace. Build a Slag Heap (6) beside it before it chokes.', ui: 'build:heap', tile: furnace ? { x: furnace.x, y: furnace.y - 1 } : undefined };
  const sel = s.research.selected;
  if (!g.done('pressing')) {
    if (sel !== 'pressing') return { text: 'Open research (T) and pick Pressing. It costs 30 iron ingots delivered to the Hopper.', ui: 'research' };
    const hopperFed = g.belts.some((b) => b.x === 6 && b.y === 3 && b.rot === 1);
    if (!hopperFed && count('miner') < 2) return { text: 'Turn the last belt (R on it) to feed the Hopper below, or build a second line for it.', tile: { x: 6, y: 3 } };
    return { text: `Researching Pressing: ${Math.round(researchFrac(g, 'pressing') * 100)}%. More miners and smelters make it faster.` };
  }
  if (!sel) {
    const avail = availableNodes(g);
    if (avail.length) return { text: `Pick the next research (T): ${avail.map((r) => r.name).slice(0, 3).join(', ')}.`, ui: 'research' };
  }
  const offered = offeredOrders(g);
  if (!s.orders.active && offered.length && !s.flags.includes('ordersSeen')) return { text: `Mayor Bramble has an order for you (O): ${offered[0].name}.`, ui: 'orders' };
  const buyable = CHUNKS.find((c) => !s.land.includes(c.id) && (!c.requires || g.done(c.requires)));
  if (buyable && s.coin.gte(buyable.cost)) return { text: `Buy ${buyable.name} for ${buyable.cost.toLocaleString('en-US')}: click it on the map.`, tile: { x: buyable.x + 3, y: buyable.y + 3 }, ui: 'land' };
  if (sel) {
    const d = RESEARCH[sel];
    const need = Object.keys(d.cost).join(' and ').replace(/([A-Z])/g, ' $1').toLowerCase();
    return { text: `Researching ${d.name}: ${Math.round(researchFrac(g, sel) * 100)}%. The Hopper wants ${need}.` };
  }
  if (g.done('folding')) return { text: 'Folding is ready (F): box a line that runs well and fold it into a module.' };
  return null;
}
