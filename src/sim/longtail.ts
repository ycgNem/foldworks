// The long tail (DESIGN.md §24, Milestone 11): the Trophy Shelf's bonuses, the Codex's completion
// and lore pages, cosmetics (owned, granted, the skin chosen per kind) and the efficiency boards
// (each Scenario board's personal bests). Pure: everything is read from the state, and the few
// things written (a cosmetic granted, a board's best noted, a skin chosen) are written by systems
// once a second or by commands, so a replay of the command log reaches the same state.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import type { State, BoardRecord, ModuleDesign } from './world';
import type { ItemId } from '../data/items';
import type { BuildKind } from '../data/machines';
import { BUILD } from '../data/machines';
import { TROPHIES, TROPHY_CAPS, type TrophyDef, type TrophyBonus } from '../data/trophies';
import { LEDGER_REWARDS } from '../data/kernels';
import { CODEX_ITEMS, CODEX_PAGES, CODEX_TOTAL, TIERS, ITEM_TIER, inCodex, type CodexPage, type Tier } from '../data/codex';
import { COSMETICS, cosmeticDef, SKIN_SLOTS, type CosmeticDef, type SkinSlot } from '../data/cosmetics';
import { SCENARIOS, SCENARIO_IDS, type ScenarioDef, type ScenarioId } from '../data/scenarios';
import { CUSTOMERS, type CustomerId } from '../data/orders';
import { won } from './systems/challenges';
import { designKwOf } from './scenario';
import { CHALLENGES } from '../data/challenges';

// ================================================================== trophies

/** Has this trophy been earned (in any run: the flags are kept through every reset)? */
export const trophyEarned = (g: Game, t: TrophyDef | string) => g.s.flags.includes('trophy:' + (typeof t === 'string' ? t : t.id));

/** Every rule the shelf changes, summed over the trophies earned and capped (DESIGN.md §24). */
export interface TrophyRules {
  /** trophies earned (the cache key the other rule caches read) */
  n: number;
  /** each product's craft speed added */
  speed: Partial<Record<ItemId, number>>;
  /** Workshop buildings free, the first n on the map */
  free: Partial<Record<BuildKind, number>>;
  skiffs: number;
  routes: number;
  drawer: number;
  /** seconds */
  sparkLife: number;
  heap: number;
  startCoin: number;
  /** seconds Overdrive cools sooner */
  cool: number;
  /** a share off the Old Works' repair price */
  repair: number;
  chuteRoom: number;
  // ---- Acts IV-V's own kinds (the review of 2026-10-22), the shelf's and the Ledger's rules
  /** tiles a second the World's barges fly faster */
  barge: number;
  /** seconds Beyond's couriers load quicker at each end */
  courier: number;
  /** a share off the World's and Beyond's lots */
  lot: number;
  /** a share off what every Ledger order wants */
  ledger: number;
}

/** The capped kinds and the TrophyRules field each one sums into. */
const CAPPED: Partial<Record<TrophyBonus['k'], keyof typeof TROPHY_CAPS>> = {
  skiffs: 'skiffs', routes: 'routes', drawer: 'drawer', sparkLife: 'sparkLife', heap: 'heap', startCoin: 'startCoin',
  cool: 'cool', repair: 'repair', chute: 'chute', barge: 'barge', courier: 'courier', lot: 'lot', ledger: 'ledger',
};

/** A bonus's size, as summed against its cap (0 for the kinds without one). */
export function bonusSize(b: TrophyBonus): number {
  switch (b.k) {
    case 'speed': case 'skiffs': case 'routes': case 'drawer': case 'sparkLife': case 'heap': case 'startCoin': case 'chute': case 'barge': return b.add;
    case 'cool': case 'courier': return b.sub;
    case 'repair': case 'lot': case 'ledger': return b.off;
    case 'free': case 'cosmetic': return 0;
  }
}

/** The cap a bonus counts against (a product's own for a craft speed), or null (free buildings, skins). */
export function bonusCap(b: TrophyBonus): number | null {
  if (b.k === 'speed') return TROPHY_CAPS.speed;
  const f = CAPPED[b.k];
  return f ? (TROPHY_CAPS[f] as number) : null;
}

/** Do two bonuses sum into the same capped total (the same kind, and for a craft speed the same product)? */
const sameKind = (a: TrophyBonus, b: TrophyBonus) => a.k === b.k && (a.k !== 'speed' || (b.k === 'speed' && a.item === b.item));

/** The Ledger's rules paid so far (every twentieth order to the 120th, DESIGN.md §23). */
const ledgerRules = (g: Game): TrophyBonus[] => {
  const filled = g.s.meta.ledger?.n ?? 0;
  return LEDGER_REWARDS.filter((r) => r.rule && r.at <= filled).map((r) => r.rule!);
};

/** Is this bonus already at its cap without this trophy (DESIGN.md §24: "capped: the shelf already
 * gives the most")? The other trophies earned and the Ledger's rules paid count; free buildings and
 * skins are never capped. */
export function bonusCapped(g: Game, t: TrophyDef): boolean {
  const cap = bonusCap(t.bonus);
  if (cap === null) return false;
  const have = new Set(g.s.flags);
  let sum = 0;
  for (const o of TROPHIES) if (o !== t && have.has('trophy:' + o.id) && sameKind(o.bonus, t.bonus)) sum += bonusSize(o.bonus);
  for (const b of ledgerRules(g)) if (sameKind(b, t.bonus)) sum += bonusSize(b);
  return sum >= cap - 1e-9;
}

const cache = new WeakMap<State, { flags: string[]; len: number; ledger: number; r: TrophyRules }>();

export function trules(g: Game): TrophyRules {
  const s = g.s;
  const hit = cache.get(s);
  const filled = s.meta.ledger?.n ?? 0;
  if (hit && hit.flags === s.flags && hit.len === s.flags.length && hit.ledger === filled) return hit.r;
  const have = new Set(s.flags);
  const r: TrophyRules = { n: 0, speed: {}, free: {}, skiffs: 0, routes: 0, drawer: 0, sparkLife: 0, heap: 0, startCoin: 0, cool: 0, repair: 0, chuteRoom: 0, barge: 0, courier: 0, lot: 0, ledger: 0 };
  const add = (b: TrophyBonus) => {
    switch (b.k) {
      case 'speed': r.speed[b.item] = Math.min(TROPHY_CAPS.speed, (r.speed[b.item] ?? 0) + b.add); break;
      case 'free': r.free[b.kind] = (r.free[b.kind] ?? 0) + b.n; break;
      case 'skiffs': r.skiffs += b.add; break;
      case 'routes': r.routes += b.add; break;
      case 'drawer': r.drawer += b.add; break;
      case 'sparkLife': r.sparkLife += b.add; break;
      case 'heap': r.heap += b.add; break;
      case 'startCoin': r.startCoin += b.add; break;
      case 'cool': r.cool += b.sub; break;
      case 'repair': r.repair += b.off; break;
      case 'chute': r.chuteRoom += b.add; break;
      case 'barge': r.barge += b.add; break;
      case 'courier': r.courier += b.sub; break;
      case 'lot': r.lot += b.off; break;
      case 'ledger': r.ledger += b.off; break;
      case 'cosmetic': break;
    }
  };
  for (const t of TROPHIES) {
    if (!have.has('trophy:' + t.id)) continue;
    r.n++;
    add(t.bonus);
  }
  // the Ledger's rules (every twentieth order to the 120th) sum with the shelf's, under one cap
  for (const x of LEDGER_REWARDS) if (x.rule && x.at <= filled) add(x.rule);
  r.skiffs = Math.min(TROPHY_CAPS.skiffs, r.skiffs);
  r.routes = Math.min(TROPHY_CAPS.routes, r.routes);
  r.drawer = Math.min(TROPHY_CAPS.drawer, r.drawer);
  r.sparkLife = Math.min(TROPHY_CAPS.sparkLife, r.sparkLife);
  r.heap = Math.min(TROPHY_CAPS.heap, r.heap);
  r.cool = Math.min(TROPHY_CAPS.cool, r.cool);
  r.repair = Math.min(TROPHY_CAPS.repair, Math.round(r.repair * 1000) / 1000);
  r.chuteRoom = Math.min(TROPHY_CAPS.chute, r.chuteRoom);
  r.startCoin = Math.min(TROPHY_CAPS.startCoin, r.startCoin);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  r.barge = Math.min(TROPHY_CAPS.barge, round(r.barge));
  r.courier = Math.min(TROPHY_CAPS.courier, round(r.courier));
  r.lot = Math.min(TROPHY_CAPS.lot, round(r.lot));
  r.ledger = Math.min(TROPHY_CAPS.ledger, round(r.ledger));
  cache.set(s, { flags: s.flags, len: s.flags.length, ledger: filled, r });
  return r;
}

/** A Workshop machine's craft speed for its product: the shelf's delivery trophies, and Clean
 * Hands' gravel and concrete once won (DESIGN.md §24). */
export function craftSpeed(g: Game, item: string): number {
  let f = 1 + (trules(g).speed[item as ItemId] ?? 0);
  if ((item === 'gravel' || item === 'concrete') && won(g, 'cleanHands')) f += CHALLENGES.cleanHands.reward2 ?? 0.1;
  return f;
}

/** Is the next one of this Workshop building free (a trophy's "the first n free")? Counted by the
 * free ones standing, so lifting one frees its place again. Never in a Scenario (a board's coin
 * is its rule). */
export function freeBuild(g: Game, kind: BuildKind): boolean {
  if (g.s.scenario) return false;
  const n = trules(g).free[kind] ?? 0;
  if (n <= 0) return false;
  let used = 0;
  for (const e of g.s.ents) if (e.kind === kind && e.free) used++;
  return used < n;
}

// ================================================================== the Codex

export interface CodexCompletion {
  have: number;
  total: number;
  frac: number;
  tiers: Record<Tier, { have: number; total: number }>;
}

/** The Codex's completion: items first delivered (Unit 7's collection, `s.codex`) out of every item
 * it logs, by tier. */
export function codexCompletion(g: Game): CodexCompletion {
  const got = new Set(g.s.codex);
  const tiers = {} as Record<Tier, { have: number; total: number }>;
  let have = 0;
  for (const t of TIERS) {
    const items = CODEX_ITEMS[t];
    const h = items.filter((i) => got.has(i)).length;
    tiers[t] = { have: h, total: items.length };
    have += h;
  }
  return { have, total: CODEX_TOTAL, frac: CODEX_TOTAL ? have / CODEX_TOTAL : 0, tiers };
}

/** Items of a tier in the Codex. */
export function codexTierHave(g: Game, tier: Tier): number {
  let n = 0;
  for (const i of g.s.codex) if (ITEM_TIER[i] === tier && inCodex(i)) n++;
  return n;
}

/** An island visited in any universe: the `visit:<id>` counter (kept through every reset; the
 * islands visited are not kept through a Last Fold), or the list on a save from before it. */
const visitedIsland = (g: Game, id: string) => (g.s.counters['visit:' + id] ?? 0) > 0 || !!g.s.meta.visited?.includes(id as never);

/** Is this lore page open (DESIGN.md §24)? */
export function pageOpen(g: Game, p: CodexPage): boolean {
  const o = p.open;
  switch (o.k) {
    case 'tier': return codexTierHave(g, o.tier) > 0;
    case 'counter': return (g.s.counters[o.name] ?? 0) >= o.n;
    case 'trophy': return trophyEarned(g, o.id);
    case 'island': return visitedIsland(g, o.id);
    case 'relocated': return (g.s.meta.relocations ?? 0) > 0;
    case 'lastFold': return (g.s.meta.lastFolds ?? 0) > 0;
    case 'ledger': return (g.s.meta.ledger?.n ?? 0) >= o.n;
  }
}

/** The lore pages open now, in the Codex's order. */
export function codexPages(g: Game): CodexPage[] {
  return CODEX_PAGES.filter((p) => pageOpen(g, p));
}

// ================================================================== cosmetics

/** Has the player earned this cosmetic by its source (the Ledger's are paid by the Ledger itself)? */
function sourceMet(g: Game, c: CosmeticDef): boolean {
  const src = c.source;
  switch (src.k) {
    case 'ledger': return !!g.s.meta.cosmetics?.includes(c.id);
    case 'rep': return (g.s.orders.rep[src.customer] ?? 0) >= src.level;
    case 'challenge': return won(g, src.id);
    case 'trophy': return trophyEarned(g, src.id);
  }
}

/** Put every cosmetic newly earned into meta.cosmetics (once a second, from runStats). Never in a
 * Scenario (its rep and trophies are the board's). */
export function grantCosmetics(g: Game) {
  if (g.s.scenario) return;
  const owned = (g.s.meta.cosmetics ??= []);
  for (const c of COSMETICS) {
    if (c.source.k === 'ledger' || owned.includes(c.id)) continue;
    if (!sourceMet(g, c)) continue;
    owned.push(c.id);
    g.emit({ type: 'cosmetic', id: c.id });
  }
}

/** The cosmetics owned, as definitions (the Ledger's ribbons included). */
export function ownedCosmetics(g: Game): CosmeticDef[] {
  return (g.s.meta.cosmetics ?? []).map((id) => cosmeticDef(id)).filter((c): c is CosmeticDef => !!c);
}

/** The skin chosen for a kind, or null (the plain sprite). */
export function skinFor(g: Game, slot: SkinSlot): string | null {
  return g.s.meta.skins?.[slot] ?? null;
}

/** Why this skin can't be worn on this kind, or null. */
export function skinRefusal(g: Game, slot: SkinSlot, id: string | null): string | null {
  if (!SKIN_SLOTS.includes(slot)) return 'Nothing of that kind wears a skin';
  if (id === null) return null;
  const c = cosmeticDef(id);
  if (!c) return 'No such skin';
  if (!g.s.meta.cosmetics?.includes(id)) return `${c.name} is not yours yet`;
  if (!c.slots.includes(slot)) return `${c.name} doesn't fit a ${BUILD[slot as BuildKind]?.name ?? slot}`;
  return null;
}

/** The `skin` command: wear a skin on every building of a kind (null: back to plain). Purely
 * cosmetic: no system reads it. */
export function setSkin(g: Game, slot: SkinSlot, id: string | null): ActResult {
  const why = skinRefusal(g, slot, id);
  if (why) return no(why);
  const m = (g.s.meta.skins ??= {});
  if ((m[slot] ?? null) === id) return OK;
  if (id === null) delete m[slot];
  else {
    m[slot] = id;
    g.bump('skinsWorn');
  }
  g.emit({ type: 'skin', id: id ?? '', value: 0 });
  return OK;
}

// ================================================================== the efficiency boards

/** kW the machines of a Workshop design draw at full speed in Normal mode (power producers make,
 * they don't draw). */
export const designKw = designKwOf;

/** A design's measures on a board: its product a minute (grade applied), per tile of its box, per kW
 * drawn (0 when unpowered), and its waste (the share of byproducts its audit found unhandled). */
export function designMeasures(d: ModuleDesign, def: ScenarioDef): { perMin: number; perTile: number; perKw: number; waste: number } | null {
  if ((d.depth ?? 1) !== 1) return null;
  const perMin = (d.outs[def.product] ?? 0) * 60;
  if (perMin <= 0) return null;
  const kw = designKw(d);
  return { perMin, perTile: perMin / (d.box.w * d.box.h), perKw: kw > 0 ? perMin / kw : 0, waste: Math.max(0, Math.min(1, 1 - (d.grade.w ?? 1))) };
}

/** The board's score of a design, by its measure (§21, §24). */
export function measureScore(m: { perMin: number; perTile: number; perKw: number }, def: ScenarioDef): number {
  return def.measure === 'perTile' ? m.perTile : def.measure === 'perKw' ? m.perKw : m.perMin;
}

/** The bests of this Scenario game's folds so far, or null before the first (or outside one). */
export function boardRecord(g: Game): BoardRecord | null {
  const id = g.s.scenario as ScenarioId | undefined;
  const def = id ? SCENARIOS[id] : null;
  if (!def) return null;
  let rec: BoardRecord | null = null;
  for (const d of g.s.designs) {
    const m = designMeasures(d, def);
    if (!m) continue;
    const one: BoardRecord = { score: measureScore(m, def), grade: d.grade.letter, perTile: m.perTile, perKw: m.perKw, waste: m.waste };
    rec = rec ? mergeBoard(rec, one) : one;
  }
  return rec;
}

/** Two records' bests, field by field (the higher score keeps its grade; the lower waste). */
export function mergeBoard(a: BoardRecord | undefined, b: BoardRecord): BoardRecord {
  if (!a) return { ...b };
  const top = b.score > a.score + 1e-12 ? b : a;
  return { score: top.score, grade: top.grade, perTile: Math.max(a.perTile, b.perTile), perKw: Math.max(a.perKw, b.perKw), waste: Math.min(a.waste, b.waste) };
}

/** A Scenario game notes its own bests in its meta, once a second (from runStats). */
export function noteBoard(g: Game) {
  const id = g.s.scenario as ScenarioId | undefined;
  if (!id) return;
  const rec = boardRecord(g);
  if (!rec) return;
  const all = (g.s.meta.boards ??= {});
  const old = all[id];
  const next = mergeBoard(old, rec);
  if (old && next.score === old.score && next.perTile === old.perTile && next.perKw === old.perKw && next.waste === old.waste) return;
  all[id] = next;
  if (!old || next.score > old.score) g.emit({ type: 'boardBest', id, value: next.score });
}

const finite = (v: unknown, lo = 0, hi = Infinity) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** The `boards` command: the town takes a Scenario game's bests into its own meta (the app hands
 * them over when "Back to your town" is pressed). Each record is checked, and only a better value
 * is kept, field by field. */
export function takeBoards(g: Game, boards: Record<string, BoardRecord> | null | undefined): ActResult {
  if (!boards || typeof boards !== 'object') return no('No records');
  const all = (g.s.meta.boards ??= {});
  let n = 0;
  for (const [id, r] of Object.entries(boards)) {
    if (!SCENARIO_IDS.includes(id as ScenarioId) || !r) continue;
    if (!finite(r.score) || !finite(r.perTile) || !finite(r.perKw) || !finite(r.waste, 0, 1) || typeof r.grade !== 'string') continue;
    all[id] = mergeBoard(all[id], { score: r.score, grade: r.grade.slice(0, 2), perTile: r.perTile, perKw: r.perKw, waste: r.waste });
    n++;
  }
  return n ? OK : no('No records');
}

/** The boards with a best on file. */
export const boardsOnFile = (g: Game) => SCENARIO_IDS.filter((id) => !!g.s.meta.boards?.[id]);

// ================================================================== the shelf, for the screens

/** Trophies earned, and the lowest reputation of the four customers (trophy stats). */
export const trophiesEarned = (g: Game) => g.s.flags.reduce((n, f) => n + (f.startsWith('trophy:') ? 1 : 0), 0);
export const repMin = (g: Game) => Math.min(...(Object.keys(CUSTOMERS) as CustomerId[]).map((c) => g.s.orders.rep[c] ?? 0));
