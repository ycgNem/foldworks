// The next goal (DESIGN.md §16 rule 1: the cheapest meaningful goal is always in reach, and the
// player is told what it is). A speech bubble from a speaker in the corner, picked from the game's
// state, with where to look. Act II (§18) has its own chain: Coal Seams, chunk E, steel, Steam
// Power, a boiler and engine lit by a pole, glass, circuits, Mk2, Nested Folds and the Great Drill,
// with interrupts for a heap filling up, a stamp refused for claims and the Bay's corner blocked.
// Presentation only: it reads the Game.
//
// The 180 (docs/hud-180.md): every goal is one line in a character's mouth, rich-text markup, at
// most ~14 words, one idea, one keycap, one price. Numbers live in `chips` and `bar`, not in the
// sentence. Match these voices when adding a line:
//
//   Mayor Bramble (default; frog, mayor, first customer): warm, eager, exclamatory. "she" = furnace.
//     "Click the rocks! Ore, please! {k:LMB}"
//     "Smells like money. Get the Bellows! {coin:25}"
//     "She's choking on slag! {k:LMB} shovel, or a {i:slag} Heap."
//     "Ooh, {research:Pressing} next! Pick it, then feed the Hopper. {k:T}"
//     "Gizmos for the Festival! The town is losing its mind!"
//   Unit 7 (collector robot; the Codex and its orders): ALL CAPS, clipped, counts things, pleased.
//     "UNIT 7 HAS A REQUEST. {k:O}"
//     "NEW SPECIMEN: GLASS. COLLECTION 14%. PLEASING."
//     "CALIBRATION WEIGHTS IN PROGRESS. UNIT 7 IS COUNTING."
//     "THE COLLECTION HAS GAPS. GAPS ARE INTOLERABLE."
//     "SPECIMEN LOGGED. GRATITUDE SUBROUTINE ENGAGED."
//   Dame Voltaire (inventor; power, her orders, Mk2, modes): grand, exacting, a little vain.
//     "A Boiler, darling, with a Steam Engine at its front."
//     "Now light it, darling. Poles, coal, and something hungry for current."
//     "Think bigger, darling. A Mk2 machine, from the Heavy petal."
//     "Study {research:Tuning}, darling. I have plans for it. {k:T}"
//     "Streetlamps, darling. I am waiting, beautifully."
//   The Committee (three raccoons in a coat; Patents, Reorganize, the Drill's later stages):
//   three quoted voices in one bubble, lowercase, conspiratorial.
//     "psst." "a job." "for you." {k:O}
//     "the drill." "feed it." "it's hungry. like us."
//     "the pile?" "not yet?" "we'll wait. in the coat."
//     "psst." "we know a guy." "he files patents."
//     "pleasure doing business." "we were never here." "any of us. him."
//   The Inspector (frog in a bowler; audits, grades, folding): officious, dry, secretly impressed.
//     "Folding is ready. Box a line that runs well. {k:F}"
//     "Clipboard out. Do carry on."
//     "An {big:S}. I shall tell no one. Fine, everyone."
//     "Auditing your group. Watch the projected grade."
//     "Fold me a Gizmo line. Assembler, belts, the lot. {k:F}"
import type { Game } from '../sim/Game';
import { Num } from '../engine/num';
import { BUILD, UPGRADES } from '../data/machines';
import { RESEARCH, type ResearchId } from '../data/research';
import { CHUNKS, FACTORY } from '../data/land';
import { RULES } from '../data/rules';
import { RECIPE } from '../data/recipes';
import { prules } from '../sim/patents'; // Milestone 5: the Patent rules (More Auditors, Quick Audits)
import { ITEMS, type ItemId } from '../data/items';
import { megaStage } from '../data/megaprojects';
import { availableNodes, researchFrac, available } from '../sim/systems/research';
import { offeredOrders } from '../sim/systems/orders';
import { auditTicks, gradedAudit } from '../sim/systems/audits';
import { feedsDock, stampCost, mainItem } from '../sim/systems/modules';
import { ORDER, type CustomerId, type OrderDef } from '../data/orders';
import type { FEnt } from '../sim/world';
import { claimRefusal, claimLoad, claimsHeld, claimsUsed } from '../sim/systems/claims';
import { DX, DY } from '../sim/world';

/** Who says a goal: the corner shows their portrait and the bubble's tail points at them. */
export type Speaker = 'bramble' | 'unit7' | 'voltaire' | 'committee' | 'inspector';

export interface Goal {
  /** the speaker (docs/hud-180.md voice guide); Mayor Bramble unless the subject is someone else's */
  who: Speaker;
  /** the bubble's line: rich-text markup, one idea, at most ~14 words, one keycap, one price */
  text: string;
  /** progress 0..1, drawn as a bar under the line instead of a "33%" in it */
  bar?: number;
  /** rich-text chips under the line: what the Hopper wants, a price, a rate, a recipe */
  chips?: string[];
  /** a second, lower-ranked line under the goal (a heap filling, a stamp refused for claims) */
  note?: string;
  /** a tile to point at, if any */
  tile?: { x: number; y: number };
  /** a HUD element to point at: 'bellows', 'research', 'orders', 'build:<kind>', 'land' */
  ui?: string;
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const big = (n: number) => Num.of(n).format();
const frac = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(1, a / b)) : 1);
const delivered = (g: Game, it: ItemId) => g.s.delivered[it]?.toNumber() ?? 0;
const say = (who: Speaker, text: string, o: Omit<Goal, 'who' | 'text'> = {}): Goal => ({ who, text, ...o });

/** What a research node costs, as chips: `{i:ironIngot} 12/30` once picked, `{i:ironIngot} 30` before. */
function costChips(g: Game, id: ResearchId, picked: boolean): string[] {
  const p = g.s.research.progress[id] ?? {};
  return (Object.entries(RESEARCH[id].cost) as [ItemId, number][]).map(([k, n]) =>
    picked ? `{i:${k}} ${fmt(Math.min(n, p[k]?.toNumber() ?? 0))}/${fmt(n)}` : `{i:${k}} ${fmt(n)}`);
}

/** Who talks about a research node: its subject's owner, Bramble otherwise. */
const RESEARCH_WHO: Partial<Record<ResearchId, Speaker>> = {
  folding: 'inspector', nestedFolds: 'inspector', steamPower: 'voltaire', heavyMachines: 'voltaire', tuning: 'voltaire',
};

/** "Pick this node next", per speaker; `via` is the node it leads to, when it is a step on the way. */
const PICK: Record<Speaker, (n: string, via: string | null) => string> = {
  bramble: (n, via) => (via ? `${n} next, on the road to ${via}! {k:T}` : `Ooh, ${n} next! Pick it, then feed the Hopper. {k:T}`),
  unit7: (n, via) => (via ? `RESEARCH ${n.toUpperCase()}. THEN ${via.toUpperCase()}. {k:T}` : `RESEARCH ${n.toUpperCase()}. UNIT 7 WILL CATALOGUE IT. {k:T}`),
  voltaire: (n, via) => (via ? `Study ${n} first, darling. ${via} awaits. {k:T}` : `Study ${n}, darling. I have plans for it. {k:T}`),
  committee: (n) => `"psst." "${n}." "you didn't hear it from us." {k:T}`,
  inspector: (n, via) => (via ? `${n} first, then ${via}. Procedure. {k:T}` : `${n}, if you please. My clipboard is ready. {k:T}`),
};

/** "The Hopper is filling this node", per speaker. */
const FEEDING: Record<Speaker, (n: string, via: string | null) => string> = {
  bramble: (n, via) => (via ? `Feeding ${n}, then on to ${via}!` : `The Hopper is munching away at ${n}! Keep it coming!`),
  unit7: (n) => `${n.toUpperCase()} IN PROGRESS. UNIT 7 IS COUNTING.`,
  voltaire: (n) => `${n} is coming along, darling. Do hurry.`,
  committee: (n) => `"${n}." "nearly." "we're timing you. all three of us."`,
  inspector: (n) => `${n} in progress. I am timing you.`,
};

/** A customer telling you they have an order. */
const HELLO: Record<CustomerId, string> = {
  bramble: 'An order, an order! Come and see! {k:O}',
  unit7: 'UNIT 7 HAS A REQUEST. {k:O}',
  voltaire: 'I have a little job for you, darling. {k:O}',
  committee: '"psst." "a job." "for you." {k:O}',
};

/** A customer waiting on their active order. */
const WAITING: Record<CustomerId, (name: string, factory: boolean) => string> = {
  bramble: (n, f) => (f ? `${n}! Into the Factory Dock, please!` : `${n}! Keep it coming, keep it coming!`),
  unit7: (n) => `${n.toUpperCase()} IN PROGRESS. UNIT 7 IS COUNTING.`,
  voltaire: (n) => `${n}, darling. I am waiting, beautifully.`,
  committee: (n) => `"${n.toLowerCase()}?" "not yet?" "we'll wait. in the coat."`,
};

/** An order's wants as chips, with what is in so far when it is active. */
function orderChips(g: Game, d: OrderDef, active: boolean): { chips: string[]; bar?: number } {
  let have = 0, need = 0;
  const chips = (Object.entries(d.wants) as [ItemId, number][]).map(([k, n]) => {
    const got = Math.min(n, Math.floor(g.s.orders.progress[d.id]?.[k]?.toNumber() ?? 0));
    have += got;
    need += n;
    return active ? `{i:${k}} ${fmt(got)}/${fmt(n)}` : `{i:${k}} ${fmt(n)}`;
  });
  chips.push(`{coin:${big(d.pays)}}`);
  return active ? { chips, bar: frac(have, need) } : { chips };
}

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
  return researchLine(g, id, id === target ? null : target);
}

/** Bubble for one research node: pick it, or watch the Hopper fill it. */
function researchLine(g: Game, id: ResearchId, target: ResearchId | null): Goal {
  const d = RESEARCH[id];
  const who = RESEARCH_WHO[id] ?? 'bramble';
  const n = `{research:${d.name}}`;
  const via = target ? `{research:${RESEARCH[target].name}}` : null;
  if (g.s.research.selected === id) return say(who, FEEDING[who](n, via), { bar: researchFrac(g, id), chips: costChips(g, id, true) });
  return say(who, PICK[who](n, via), { chips: [...costChips(g, id, false), `→ ${d.unlocks}`], ui: 'research' });
}

/** The Act II chain (DESIGN.md §18), or null when the act is done. */
function act2Goal(g: Game): Goal | null {
  const s = g.s;
  const count = (k: string) => s.ents.filter((e) => e.kind === k).length;
  const chunkGoal = (id: string): Goal | null => {
    if (s.land.includes(id)) return null;
    const c = CHUNKS.find((q) => q.id === id);
    if (!c || (c.requires && !g.done(c.requires))) return null;
    const at = { tile: { x: c.x + 3, y: c.y + 3 }, ui: 'land' };
    if (s.coin.gte(c.cost)) return say('bramble', `${c.name} is for sale! Click it on the map.`, { chips: [`{coin:${big(c.cost)}}`, '{u:claim} its deposits add ore claims'], ...at });
    return say('bramble', `Saving up for ${c.name}! Every coin counts.`, { bar: frac(s.coin.toNumber(), c.cost), chips: [`{coin:${s.coin.format()}}/${big(c.cost)}`], ...at });
  };
  const r1 = researchToward(g, 'coalSeams');
  if (r1) return r1;
  const e = chunkGoal('E');
  if (e) return e;
  const r2 = researchToward(g, 'steelmaking');
  if (r2) return r2;
  if (!delivered(g, 'steel')) return say('bramble', 'Steel! A Smelter fed ingots and coal. Pick steel in its report.', { chips: ['{i:ironIngot} + {i:coal} → {i:steel}', `{coin:${ITEMS.steel.value}} each`, '{i:slag} twice as fast'] });
  const r3 = researchToward(g, 'steamPower');
  if (r3) return r3;
  const engines = s.ents.filter((q) => q.kind === 'steamEngine');
  if (!count('boiler') && !count('generator'))
    return say('voltaire', 'A Boiler, darling, with a Steam Engine at its front.', { chips: [`{i:coal} 1 per ${BUILD.boiler.fuel?.seconds ?? 4} s → {power:${BUILD.steamEngine.power ?? 300} kW}`, '{u:power} Power'], ui: 'build:boiler' });
  const lit = g.grids.some((gr) => gr.supply > 0) || engines.some((q) => q.state === 'work');
  if (!lit) {
    const eng = engines[0];
    return say('voltaire', 'Now light it, darling. Poles, coal, and something hungry for current.', {
      chips: [`a Pole within ${RULES.poleReach.value} tiles`, '{i:coal} into the Boiler', 'a powered machine on the grid'],
      tile: eng ? { x: eng.x, y: eng.y } : undefined, ui: 'build:pole',
    });
  }
  const r4 = researchToward(g, 'glassworks');
  if (r4) return r4;
  if (!delivered(g, 'glass')) return say('bramble', 'Glass! A Kiln on a powered grid, fed sand from Chunk E.', { chips: ['2 {i:sand} → {i:glass}', `{power:${BUILD.kiln.kw ?? 60} kW}`], ui: 'build:kiln' });
  const r5 = researchToward(g, 'circuits');
  if (r5) return r5;
  if (!delivered(g, 'circuit')) return say('bramble', 'Circuits! The clever stuff. An Assembler can make them.', { chips: ['3 {i:copperWire} + {i:plastic} + {i:glass} → {i:circuit}', `{coin:${ITEMS.circuit.value}} each`] });
  const r6 = researchToward(g, 'heavyMachines');
  if (r6) return r6;
  if (!count('smelterMk2') && !count('pressMk2') && !count('assemblerMk2'))
    return say('voltaire', 'Think bigger, darling. A Mk2 machine, from the Heavy petal.', { chips: [`{u:heavy} 2×2 · ${BUILD.smelterMk2.speed ?? 4}× its Mk1 · {u:power}`], ui: 'build:smelterMk2' });
  const r7 = researchToward(g, 'nestedFolds');
  if (r7) return r7;
  if (!s.designs.some((d) => d.depth === 2)) {
    if (s.faudit && !s.faudit.result) return say('inspector', 'Auditing your group. Watch the projected grade.', { bar: frac(s.faudit.t, auditTicks()), chips: [`{u:clock} ${Math.ceil((auditTicks() - s.faudit.t) / 20)} s`] });
    if (s.faudit?.result) return say('inspector', `The group earns {big:${s.faudit.result.grade.letter}}. Open its card, fold it one deeper.`);
    const m = prules(g).nestedMax;
    return say('inspector', 'Box two or more modules and their trunks, on the Factory floor. {k:F}', { chips: [`{u:fold} up to ${m}×${m}`], ui: 'fold' });
  }
  const r8 = researchToward(g, 'greatDrill');
  if (r8) return r8;
  const bay = s.factory.ents.find((q) => q.kind === 'fbay');
  if (!bay) return say('bramble', "Clear the Bay's corner on the Factory floor! The Drill lands there.", { chips: [`{u:mega} tiles ${FACTORY.bay.x}-${FACTORY.bay.x + 1}, ${FACTORY.bay.y}-${FACTORY.bay.y + 1}`], ui: 'factory' });
  const st = megaStage(s.mega.stage);
  if (st) {
    let have = 0, need = 0;
    const chips = (Object.entries(st.wants) as [ItemId, number][]).map(([k, n]) => {
      const got = Math.min(n, s.mega.progress[k]?.toNumber() ?? 0);
      have += got;
      need += n;
      return `{i:${k}} ${fmt(got)}/${fmt(n)}`;
    });
    const fed = g.routes.some((r) => r.to === bay);
    const o = { bar: frac(have, need), chips, ui: 'mega' };
    if (st.stage > 1) return say('committee', fed ? '"the drill." "feed it." "it\'s hungry. like us."' : '"psst." "the bay." "trunk the bits in. quietly."', o);
    return say('bramble', fed ? 'Feed the Great Drill! Bits, steel, more bits!' : 'Trunk Drill Bits and steel into the Megaproject Bay!', o);
  }
  // the Drill runs: the act's last steps are the customers' orders
  if (!s.orders.active) {
    const o = offeredOrders(g)[0];
    if (o) return say(o.customer, `${o.pitch} {k:O}`, { ...orderChips(g, o, false), ui: 'orders' });
  } else {
    const d = ORDER[s.orders.active];
    return say(d.customer, WAITING[d.customer](d.name, d.at === 'factory'), { ...orderChips(g, d, true), ui: 'orders' });
  }
  return null;
}

/** How long a heap's alert stays up, in game seconds: it is said once per heap, then the status
 *  strip and the heap's own hover carry it (the Milestone 4 review: it held the Next card for
 *  minutes after the slice end). */
const HEAP_ALERT_S = 20;
/** heap id -> the tick its alert was first shown, for the game it was shown in */
let heapSeen = new Map<number, number>();
let heapGame: Game | null = null;

/** Interrupts: a heap nearly full (once per heap, for HEAP_ALERT_S), a stamp refused for want of
 *  claims. Before the slice end they beat the chain; after it they sit under it as a note. */
function act2Alerts(g: Game): Goal | null {
  const s = g.s;
  if (heapGame !== g) { heapGame = g; heapSeen = new Map(); }
  const cap = BUILD.heap.capacity ?? 400;
  const live = (e: { id: number }) => {
    const at = heapSeen.get(e.id);
    if (at === undefined) return true;
    return s.tick >= at && s.tick - at < HEAP_ALERT_S * 20;
  };
  const heap = s.ents.filter((e) => e.kind === 'heap' && e.count >= cap * 0.75 && live(e)).sort((a, b) => b.count - a.count)[0];
  if (heap) {
    if (!heapSeen.has(heap.id)) heapSeen.set(heap.id, s.tick);
    const text = g.done('slagBricks')
      ? (g.done('crushing') ? 'That Slag Heap is nearly full! Press it into bricks or gravel.' : 'That Slag Heap is nearly full! A Press at its front makes bricks.')
      : 'That Slag Heap is nearly full! Learn {research:Slag Bricks} to use it.';
    const chips = [`{i:slag} ${fmt(heap.count)}/${fmt(cap)}`, '{warn:full → the smelters beside it jam}'];
    if (g.done('crushing')) chips.push('a Press at its front');
    return say('bramble', text, { bar: frac(heap.count, cap), chips, tile: { x: heap.x + DX[heap.rot], y: heap.y + DY[heap.rot] } });
  }
  const claim = s.designs.find((d) => s.coin.gte(stampCost(g, d)) && claimRefusal(g, d));
  if (claim) {
    // the ore it is short of, read the way claimRefusal reads it (the decision stays claimRefusal's)
    let chip = '{u:claim} out of claims';
    let ore: ItemId | null = null;
    for (const [k, n] of Object.entries(claimLoad(g, claim)) as [ItemId, number][]) {
      const held = claimsHeld(g, k), used = claimsUsed(g, k);
      if (used + n > held + 1e-9) { ore = k; chip = `{u:claim} {i:${k}} ${fmt(used)}/${fmt(held)} in use`; break; }
    }
    const what = ore ? `{i:${ore}}` : 'ore';
    const text = g.done('surveying') ? `${claim.name} needs more ${what} claims! The Survey Office sells them.` : `${claim.name} needs more ${what} claims! Learn {research:Surveying} first.`;
    return say('bramble', text, { chips: [chip], ui: g.done('surveying') ? 'survey' : 'research' });
  }
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
  const tally = `{i:gizmo} ${fmt(have)}/${fmt(want)}`;
  if (s.orders.active !== id) return say('bramble', 'A Gizmo Festival! Only Gizmos at the Factory Dock count! {k:O}', { chips: [`{i:gizmo} ${fmt(want)} → Factory Dock`, `{coin:${big(d.pays)}}`], ui: 'orders' });
  // which designs make what: a design counts for an item when its main product is that item
  const makes = (item: ItemId) => s.designs.filter((q) => mainItem(q) === item);
  const gizmoDesigns = makes('gizmo');
  if (!gizmoDesigns.length) return say('inspector', 'Fold me a Gizmo line. Assembler, belts, the lot. {k:F}', { chips: ['{i:gear} + 2 {i:copperWire} → {i:gizmo}', `{i:gizmo} ${fmt(want)} for the Festival`], ui: 'fold' });
  const gd = gizmoDesigns[0];
  const needs = (Object.keys(gd.ins) as ItemId[]).filter((it) => it !== 'slag');
  for (const it of needs) if (!makes(it).length) return say('inspector', `The Gizmo module wants {i:${it}} at its back. Fold that line too. {k:F}`, { ui: 'fold' });
  const placed = (item: ItemId) => mods.filter((m) => { const q = g.design(m.design); return !!q && mainItem(q) === item; });
  const gm = placed('gizmo');
  if (!gm.length) return say('bramble', 'Put the Gizmo module on the Factory floor, gold front to the Dock! {k:Tab}', { ui: 'factory' });
  for (const it of needs) if (!placed(it).length) return say('bramble', `Now a {i:${it}} module, trunked into the Gizmo module's back!`, { ui: 'factory' });
  const feeding = gm.filter((m) => feedsDock(g, m));
  if (!feeding.length) return say('bramble', "Trunk the Gizmo module's gold front to the Factory Dock! Only it counts.", { ui: 'factory' });
  const starved = feeding.find((m) => m.state === 'starved');
  if (starved && starved.why) {
    const what = starved.why in ITEMS ? `{i:${starved.why}}` : 'its input';
    return say('bramble', `The Gizmo module is hungry for ${what}! Trunk more into its back.`, { bar: frac(have, want), chips: [tally], ui: 'factory' });
  }
  let rate = 0;
  for (const r of g.routes) {
    if (r.by || r.to?.kind !== 'fdock') continue;
    const q = g.design(r.from.design);
    const last = r.tiles[r.tiles.length - 1];
    if (q && mainItem(q) === 'gizmo' && last) rate += last.flow * 60;
  }
  const left = want - have;
  const chips = [tally];
  if (rate > 0) chips.push(`${Math.round(rate)}/min`, `{u:clock} about ${Math.max(1, Math.ceil(left / rate))} min`);
  return say('bramble', 'Gizmos for the Festival! The town is losing its mind!', { bar: frac(have, want), chips });
}

/** The Inspector's line for a graded box. */
function gradedLine(letter: string): string {
  if (letter.startsWith('S')) return `An {big:${letter}}. I shall tell no one. Fine, everyone.`;
  if (letter === 'A') return 'An {big:A}. Very nearly impressive. Fold it.';
  return `A {big:${letter}}. Fold it, or tidy up and box it again.`;
}

export function nextGoal(g: Game): Goal | null {
  const s = g.s;
  const furnace = g.machines.find((m) => m.kind === 'furnace');
  const hasBellows = g.has('bellows');
  const count = (k: string) => s.ents.filter((e) => e.kind === k).length;
  const atFurnace = furnace ? { x: furnace.x, y: furnace.y } : undefined;
  if (furnace && furnace.by >= RULES.outputCap.value && count('heap') === 0)
    return say('bramble', "She's choking on slag! {k:LMB} shovel, or a {i:slag} Heap.", { chips: [`Slag Heap {coin:${BUILD.heap.cost}}`], tile: atFurnace, ui: 'build:heap' });
  if (!hasBellows) {
    if (furnace && !furnace.active && !(furnace.inBuf.ironOre ?? 0) && s.coin.lt(UPGRADES.bellows.cost))
      return say('bramble', 'Click the rocks! Ore, please! {k:LMB}', { tile: { x: 2, y: 3 } });
    if (s.coin.lt(UPGRADES.bellows.cost)) {
      const cranks = Math.round(RECIPE.smeltIron.time / RULES.crankSeconds.value);
      return say('bramble', 'Now crank her! Ingots sell at the Dock. {k:LMB}', { chips: [`${cranks}× {k:LMB} → {i:ironIngot}`], tile: atFurnace });
    }
    return say('bramble', `Smells like money. Get the Bellows! {coin:${UPGRADES.bellows.cost}}`, { chips: ['{i:ironIngot} the furnace runs itself'], ui: 'bellows' });
  }
  // folding and the Factory floor (DESIGN.md §10-§11)
  if (g.done('folding')) {
    const graded = s.audits.filter((q) => q.result);
    const running = s.audits.filter((q) => !q.result);
    if (graded.length) {
      const a = gradedAudit(g)!;
      const chips = ['{u:fold} click my gold badge, fold the line'];
      if (graded.length > 1) chips.push(`${graded.length} lines graded`);
      return say('inspector', gradedLine(a.result!.grade.letter), { chips });
    }
    if (running.length) {
      const next = Math.min(...running.map((q) => Math.ceil((auditTicks() - q.t) / 20)));
      const room = prules(g).maxAudits - s.audits.length;
      const a = running[0];
      const lead = Math.max(...running.map((q) => q.t));
      const chips = [`{u:clock} ${next} s`];
      if (running.length > 1) chips.push(`${running.length} boxes`);
      if (room > 0) chips.push(`${room} more can run`);
      return say('inspector', room > 0 ? 'Clipboard out. Box another line while you wait. {k:F}' : 'Clipboard out. Do carry on.', {
        bar: frac(lead, auditTicks()), chips, tile: { x: a.box.x + Math.floor(a.box.w / 2), y: a.box.y },
      });
    }
    const box = prules(g).foldMax;
    if (!s.designs.length) return say('inspector', 'Folding is ready. Box a line that runs well. {k:F}', { chips: [`{u:fold} up to ${box}×${box}`], ui: 'fold' });
    const mods = s.factory.ents.filter((e) => e.kind === 'module');
    if (!mods.length) return say('bramble', 'Your first module! Put it on the Factory floor. {k:Tab}', { chips: ['gold front → a trunk to the Factory Dock'], ui: 'factory' });
    const alert = act2Alerts(g);
    const after = g.flag('sliceEnd');
    // before the slice end an alert beats the chain; after it, the Act II chain leads and the
    // alert rides under it as a note (the Milestone 4 review)
    if (alert && !after) return alert;
    const jam = mods.find((m) => m.state === 'blocked');
    if (jam && !s.flags.includes('sliceEnd')) return say('bramble', "A module's stuck! Hover it on the Factory floor to see why.");
    // the slice's end (DECISIONS.md, the gate's blocking findings): Bramble's Gizmo Festival,
    // filled only by the Factory Dock
    if (!s.flags.includes('sliceEnd')) {
      const fest = festivalGoal(g, mods);
      if (fest) return fest;
    }
    if (after || g.done('coalSeams')) {
      const a2 = act2Goal(g);
      if (a2) return alert ? { ...a2, note: alert.text, tile: a2.tile ?? alert.tile } : a2;
      if (alert) return alert;
    }
  }
  if (count('miner') === 0) {
    if (s.coin.lt(BUILD.miner.cost))
      return say('bramble', 'Keep clicking ore! A Miner is nearly in reach.', { bar: frac(s.coin.toNumber(), BUILD.miner.cost), chips: [`Miner {coin:${BUILD.miner.cost}}`, 'on the ore, facing the furnace'], tile: { x: 2, y: 3 } });
    return say('bramble', 'A Miner on the ore, facing her! {k:R} turns it.', { chips: [`{coin:${BUILD.miner.cost}}`, '{i:ironOre} 30/min'], ui: 'build:miner', tile: { x: 2, y: 3 } });
  }
  if (count('heap') === 0 && furnace && furnace.by > 0)
    return say('bramble', "Slag's piling up in her! A Slag Heap beside her, quick.", { chips: [`{coin:${BUILD.heap.cost}}`], ui: 'build:heap', tile: furnace ? { x: furnace.x, y: furnace.y - 1 } : undefined });
  const sel = s.research.selected;
  if (!g.done('pressing')) {
    if (sel !== 'pressing') return say('bramble', "Let's learn {research:Pressing}! Ingots in the Hopper pay for it. {k:T}", { chips: costChips(g, 'pressing', false), ui: 'research' });
    const hopperFed = g.belts.some((b) => b.x === 6 && b.y === 3 && b.rot === 1);
    if (!hopperFed && count('miner') < 2) return say('bramble', 'Turn the last belt down into the Hopper! {k:R}', { chips: ['or a second line for it'], tile: { x: 6, y: 3 } });
    return say('bramble', '{research:Pressing} is cooking! More miners and smelters, faster.', { bar: researchFrac(g, 'pressing'), chips: costChips(g, 'pressing', true) });
  }
  if (!sel) {
    const avail = availableNodes(g);
    if (avail.length) return say('bramble', 'What next? So many ideas! {k:T}', { chips: avail.slice(0, 3).map((r) => `{research:${r.name}}`), ui: 'research' });
  }
  const offered = offeredOrders(g);
  if (!s.orders.active && offered.length && !s.flags.includes('ordersSeen'))
    return say(offered[0].customer, HELLO[offered[0].customer], { chips: [offered[0].name], ui: 'orders' });
  const buyable = CHUNKS.find((c) => !s.land.includes(c.id) && (!c.requires || g.done(c.requires)));
  if (buyable && s.coin.gte(buyable.cost))
    return say('bramble', `${buyable.name} is for sale! Click it on the map.`, { chips: [`{coin:${big(buyable.cost)}}`], tile: { x: buyable.x + 3, y: buyable.y + 3 }, ui: 'land' });
  if (sel) return researchLine(g, sel, null);
  if (g.done('folding')) return say('inspector', 'Folding is ready. Box a line that runs well. {k:F}', { chips: [`{u:fold} up to ${prules(g).foldMax}×${prules(g).foldMax}`] });
  return null;
}
