// The next goal (DESIGN.md §16 rule 1: the cheapest meaningful goal is always in reach, and the
// player is told what it is). One line at the bottom of the screen, picked from the game's state,
// with where to look. Act II (§18) has its own chain: Coal Seams, chunk E, steel, Steam Power, a
// boiler and engine lit by a pole, glass, circuits, Mk2, Nested Folds and the Great Drill, with
// interrupts for a heap filling up, a stamp refused for claims and the Bay's corner blocked.
// Presentation only: it reads the Game.
import type { Game } from '../sim/Game';
import { BUILD } from '../data/machines';
import { RESEARCH, type ResearchId } from '../data/research';
import { CHUNKS, FACTORY } from '../data/land';
import { RULES } from '../data/rules';
import { ITEMS, type ItemId } from '../data/items';
import { megaStage } from '../data/megaprojects';
import { availableNodes, researchFrac, available } from '../sim/systems/research';
import { offeredOrders } from '../sim/systems/orders';
import { auditTicks, gradedAudit } from '../sim/systems/audits';
import { feedsDock, stampCost, mainItem } from '../sim/systems/modules';
import { ORDER } from '../data/orders';
import type { FEnt } from '../sim/world';
import { claimRefusal } from '../sim/systems/claims';
import { DX, DY } from '../sim/world';

export interface Goal {
  text: string;
  /** a tile to point at, if any */
  tile?: { x: number; y: number };
  /** a HUD element to point at: 'bellows', 'research', 'orders', 'build:<kind>', 'land' */
  ui?: string;
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const delivered = (g: Game, it: ItemId) => g.s.delivered[it]?.toNumber() ?? 0;

/** The research step toward a node: the first one in its chain that can be picked now. */
function researchToward(g: Game, target: ResearchId): Goal | null {
  if (g.done(target)) return null;
  const seen = new Set<ResearchId>();
  const walk = (id: ResearchId): ResearchId | null => {
    if (g.done(id) || seen.has(id)) return null;
    seen.add(id);
    if (available(g, id)) return id;
    for (const q of RESEARCH[id].requires) {
      const r = walk(q);
      if (r) return r;
    }
    return null;
  };
  const id = walk(target);
  if (!id) return null;
  const d = RESEARCH[id];
  const why = id === target ? '' : ` (on the way to ${RESEARCH[target].name})`;
  if (g.s.research.selected === id) {
    const need = (Object.entries(d.cost) as [ItemId, number][]).map(([k, n]) => `${fmt(n)} ${ITEMS[k].name.toLowerCase()}`).join(' and ');
    return { text: `Researching ${d.name}${why}: ${Math.round(researchFrac(g, id) * 100)}%. The Hopper wants ${need}.` };
  }
  return { text: `Research ${d.name}${why} (T): it unlocks ${d.unlocks}.`, ui: 'research' };
}

/** The Act II chain (DESIGN.md §18), or null when the act is done. */
function act2Goal(g: Game): Goal | null {
  const s = g.s;
  const count = (k: string) => s.ents.filter((e) => e.kind === k).length;
  const chunkGoal = (id: string): Goal | null => {
    if (s.land.includes(id)) return null;
    const c = CHUNKS.find((q) => q.id === id);
    if (!c || (c.requires && !g.done(c.requires))) return null;
    if (s.coin.gte(c.cost)) return { text: `Buy ${c.name} for ${fmt(c.cost)}: click it on the map. Its deposits add ore claims too.`, tile: { x: c.x + 3, y: c.y + 3 }, ui: 'land' };
    return { text: `Save for ${c.name}: ${s.coin.format()} of ${fmt(c.cost)} coin.`, tile: { x: c.x + 3, y: c.y + 3 }, ui: 'land' };
  };
  const r1 = researchToward(g, 'coalSeams');
  if (r1) return r1;
  const e = chunkGoal('E');
  if (e) return e;
  const r2 = researchToward(g, 'steelmaking');
  if (r2) return r2;
  if (!delivered(g, 'steel')) return { text: 'Make steel: a Smelter fed iron ingots and coal (pick its recipe in its report). Steel pays 15, and slag comes twice as fast.' };
  const r3 = researchToward(g, 'steamPower');
  if (r3) return r3;
  const engines = s.ents.filter((q) => q.kind === 'steamEngine');
  if (!count('boiler') && !count('generator')) return { text: 'Build a Boiler (Power tab) with a Steam Engine at its front: 300 kW from a coal every 4 s.', ui: 'build:boiler' };
  const lit = g.grids.some((gr) => gr.supply > 0) || engines.some((q) => q.state === 'work');
  if (!lit) {
    const eng = engines[0];
    return { text: 'Light the engine: a Pole within 2 tiles of it, coal into the Boiler, and a powered machine on the grid to draw from it.', tile: eng ? { x: eng.x, y: eng.y } : undefined, ui: 'build:pole' };
  }
  const r4 = researchToward(g, 'glassworks');
  if (r4) return r4;
  if (!delivered(g, 'glass')) return { text: 'Make glass: a Kiln on a powered grid, fed 2 sand a pane. Chunk E has the sand.', ui: 'build:kiln' };
  const r5 = researchToward(g, 'circuits');
  if (r5) return r5;
  if (!delivered(g, 'circuit')) return { text: 'Make circuits: an Assembler with 3 wire, a plastic and a glass. They pay 110 each.' };
  const r6 = researchToward(g, 'heavyMachines');
  if (r6) return r6;
  if (!count('smelterMk2') && !count('pressMk2') && !count('assemblerMk2')) return { text: 'Build a Mk2 machine (Heavy tab): 2x2, powered, 3x the speed of its Mk1.', ui: 'build:smelterMk2' };
  const r7 = researchToward(g, 'nestedFolds');
  if (r7) return r7;
  if (!s.designs.some((d) => d.depth === 2)) {
    if (s.faudit && !s.faudit.result) return { text: `Auditing the module group: ${Math.ceil((auditTicks() - s.faudit.t) / 20)} s to go. Watch the projected grade.` };
    if (s.faudit?.result) return { text: `The group graded ${s.faudit.result.grade.letter}! Open its card and fold it into a depth-2 module.` };
    return { text: 'Nested fold: on the Factory floor press F and box two or more modules and their trunks (up to 6x6).', ui: 'fold' };
  }
  const r8 = researchToward(g, 'greatDrill');
  if (r8) return r8;
  const bay = s.factory.ents.find((q) => q.kind === 'fbay');
  if (!bay) return { text: `Clear the Bay's corner: tiles ${FACTORY.bay.x}-${FACTORY.bay.x + 1}, ${FACTORY.bay.y}-${FACTORY.bay.y + 1} on the Factory floor. The Megaproject Bay lands there.`, ui: 'factory' };
  const st = megaStage(s.mega.stage);
  if (st) {
    const want = (Object.entries(st.wants) as [ItemId, number][]).map(([k, n]) => `${fmt(Math.min(n, s.mega.progress[k]?.toNumber() ?? 0))}/${fmt(n)} ${ITEMS[k].name.toLowerCase()}`).join(', ');
    const fed = g.routes.some((r) => r.to === bay);
    return { text: fed ? `Feed the Great Drill: ${want}.` : `Trunk Drill Bits, concrete and steel into the Megaproject Bay: ${want}.`, ui: 'mega' };
  }
  return null;
}

/** Interrupts that beat the chain: a heap nearly full, a stamp refused for want of claims. */
function act2Alerts(g: Game): Goal | null {
  const s = g.s;
  const cap = BUILD.heap.capacity ?? 400;
  const heap = s.ents.filter((e) => e.kind === 'heap' && e.count >= cap * 0.75).sort((a, b) => b.count - a.count)[0];
  if (heap) {
    const pct = Math.round((heap.count / cap) * 100);
    const fix = g.done('slagBricks') ? (g.done('crushing') ? 'press it into bricks or gravel: a Press at its front' : 'press it into bricks: a Press at its front') : 'research Slag Bricks to press it into bricks';
    return { text: `A Slag Heap is ${pct}% full: ${fix}, or the smelters beside it will jam.`, tile: { x: heap.x + DX[heap.rot], y: heap.y + DY[heap.rot] } };
  }
  const claim = s.designs.find((d) => s.coin.gte(stampCost(g, d)) && claimRefusal(g, d));
  if (claim) return { text: `${claim.name}: ${claimRefusal(g, claim)}.`, ui: g.done('surveying') ? 'survey' : 'research' };
  return null;
}

/** The Gizmo Festival, step by step: accept it, fold the Gizmo line and what feeds it, place
 * them on the Factory floor, trunk them together and the Gizmos into the Factory Dock. */
function festivalGoal(g: Game, mods: FEnt[]): Goal | null {
  const s = g.s;
  const id = 'gizmoFestival';
  const d = ORDER[id];
  if (!d || s.orders.done.includes(id)) return null;
  const want = d.wants.gizmo ?? 400;
  const have = Math.min(want, Math.floor(s.orders.progress[id]?.gizmo?.toNumber() ?? 0));
  if (s.orders.active !== id) return { text: `Accept Bramble's Gizmo Festival (O): ${fmt(want)} Gizmos into the Factory Dock pay ${fmt(d.pays)}. Only the Factory Dock counts.`, ui: 'orders' };
  // which designs make what: a design counts for an item when its main product is that item
  const makes = (item: ItemId) => s.designs.filter((q) => mainItem(q) === item);
  const gizmoDesigns = makes('gizmo');
  if (!gizmoDesigns.length) return { text: `The Festival wants ${fmt(want)} Gizmos from the Factory floor. Fold a Gizmo line (F): an Assembler making Gizmos, boxed with its belts.`, ui: 'fold' };
  const gd = gizmoDesigns[0];
  const needs = (Object.keys(gd.ins) as ItemId[]).filter((it) => it !== 'slag');
  for (const it of needs) if (!makes(it).length) return { text: `The Gizmo module takes ${ITEMS[it].name.toLowerCase()} at its back. Fold a line that makes ${ITEMS[it].name.toLowerCase()} (F) to feed it.`, ui: 'fold' };
  const placed = (item: ItemId) => mods.filter((m) => { const q = g.design(m.design); return !!q && mainItem(q) === item; });
  const gm = placed('gizmo');
  if (!gm.length) return { text: 'Place the Gizmo module on the Factory floor (Tab), its gold front toward the Factory Dock.', ui: 'factory' };
  for (const it of needs) if (!placed(it).length) return { text: `Place a ${ITEMS[it].name.toLowerCase()} module on the Factory floor and trunk its front into the Gizmo module's back.`, ui: 'factory' };
  const feeding = gm.filter((m) => feedsDock(g, m));
  if (!feeding.length) return { text: 'Trunk the Gizmo module\'s front (gold mark) to the Factory Dock: only Factory Dock deliveries count for the Festival.', ui: 'factory' };
  const starved = feeding.find((m) => m.state === 'starved');
  if (starved && starved.why) return { text: `The Gizmo module is starved of ${ITEMS[starved.why as ItemId]?.name.toLowerCase() ?? 'input'}: trunk more of it into its back. Festival: ${fmt(have)}/${fmt(want)} Gizmos.`, ui: 'factory' };
  let rate = 0;
  for (const r of g.routes) {
    if (r.by || r.to?.kind !== 'fdock') continue;
    const q = g.design(r.from.design);
    const last = r.tiles[r.tiles.length - 1];
    if (q && mainItem(q) === 'gizmo' && last) rate += last.flow * 60;
  }
  const left = want - have;
  const eta = rate > 0 ? ` About ${Math.max(1, Math.ceil(left / rate))} min to go.` : '';
  return { text: `The Gizmo Festival: ${fmt(have)}/${fmt(want)} Gizmos delivered at the Factory Dock${rate > 0 ? `, ${Math.round(rate)} a minute` : ''}.${eta}` };
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
  // folding and the Factory floor (DESIGN.md §10-§11)
  if (g.done('folding')) {
    const graded = s.audits.filter((q) => q.result);
    const running = s.audits.filter((q) => !q.result);
    if (graded.length) {
      const a = gradedAudit(g)!;
      const more = graded.length > 1 ? ` (${graded.length} lines are graded)` : '';
      return { text: `Graded ${a.result!.grade.letter}${more}! Click its gold badge at the edge of the floor and fold the line into a module.` };
    }
    if (running.length) {
      const next = Math.min(...running.map((q) => Math.ceil((auditTicks() - q.t) / 20)));
      const room = RULES.maxAudits.value - s.audits.length;
      const a = running[0];
      return { text: `Auditing ${running.length > 1 ? `${running.length} boxes` : 'the box'}: the next grade in ${next} s.${room > 0 ? ` Box another line meanwhile (F): ${room} more can run.` : ' Keep playing.'}`, tile: { x: a.box.x + Math.floor(a.box.w / 2), y: a.box.y } };
    }
    if (!s.designs.length) return { text: 'Folding is ready: press F and drag a box over a line that runs well (up to 8x8).', ui: 'fold' };
    const mods = s.factory.ents.filter((e) => e.kind === 'module');
    if (!mods.length) return { text: 'Go to the Factory floor (Tab) and place your module, its gold front toward a trunk to the Factory Dock.', ui: 'factory' };
    const alert = act2Alerts(g);
    if (alert) return alert;
    const jam = mods.find((m) => m.state === 'blocked');
    if (jam && !s.flags.includes('sliceEnd')) return { text: 'A module is blocked: hover it on the Factory floor to see why.' };
    // the slice's end (DECISIONS.md, the gate's blocking findings): Bramble's Gizmo Festival,
    // filled only by the Factory Dock
    if (!s.flags.includes('sliceEnd')) {
      const fest = festivalGoal(g, mods);
      if (fest) return fest;
    }
    if (g.flag('sliceEnd') || g.done('coalSeams')) {
      const a2 = act2Goal(g);
      if (a2) return a2;
    }
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
