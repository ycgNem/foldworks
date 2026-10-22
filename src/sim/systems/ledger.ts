// The Endless Ledger (DESIGN.md §23, the Kernel node of that name): infinite orders. Order n (from
// 0) wants (n + 1) x the base amount of the turn's product for it, from any Dock, never timed; it
// pays twice its items' Dock value, and every tenth order pays a cosmetic (a machine skin id, then
// numbered ribbons), so there is always a next goal (§16 rule 1), and to the 120th a lore page or a
// small rule as well (src/data/kernels.ts LEDGER_REWARDS). Linear, not a curve (CLAUDE.md).
// The turn (the review of 2026-10-22): the eight Acts I-III products (LEDGER), then every tier 3-5
// good the Codex holds that the town can make where it is (LEDGER_LATE): a pure function of the
// Codex and the island, so it stays deterministic. The open order's product is fixed when it opens
// (`LedgerState.item`, written by the sim only), so a good logged mid-order never changes it; after
// a Relocate to where it can't be made, the order falls back to the eight's product for its number
// (the Ledger never waits on a Relocate). The Ledger's count and progress are kept through every
// reset, like a Megaproject's. Deliveries reach it through `fillOrder` (src/sim/systems/docks.ts),
// after the special orders and before the sale; it completes with the orders (`runOrders` calls
// `runLedger`), so offline progress fills it through the same code. Pure.
import type { Game } from '../Game';
import { Num } from '../../engine/num';
import { ITEMS, type ItemId } from '../../data/items';
import { LEDGER, LEDGER_COSMETICS, LEDGER_LATE, LEDGER_REWARDS, LEDGER_RULES, type LedgerProduct, type LedgerReward } from '../../data/kernels';
import { krules } from '../kernels';
import { trules } from '../longtail';
import { worldOf } from './islands';
import type { LedgerState } from '../world';
import type { WorldId } from '../../data/worlds';

export interface LedgerOrder {
  /** its number (0 = the first) */
  n: number;
  item: ItemId;
  /** its product's base (the order wants n + 1 of it, less the shelf's share) */
  base: number;
  want: number;
  /** coin it pays, and the cosmetic (every tenth) */
  pays: number;
  cosmetic: string | null;
  /** what else it pays (every tenth to the 120th): a lore page or a rule */
  reward: LedgerReward | null;
}

/** Is the Ledger open (its Kernel node owned; never in a Scenario)? */
export const ledgerOpen = (g: Game) => krules(g).ledger && !g.s.scenario;

/** The k-th cosmetic the Ledger pays (0 = the first): the skins in turn, then numbered ribbons. */
export const cosmeticAt = (k: number): string => (k < LEDGER_COSMETICS.length ? LEDGER_COSMETICS[k] : `ribbon${k + 1}`);

/** What the order numbered `at` (from 1) pays besides its coin and cosmetic, or null. */
export const rewardAt = (at: number): LedgerReward | null => LEDGER_REWARDS.find((r) => r.at === at) ?? null;

/** The rewards paid once `filled` orders are filled (pure: the rules and pages read it). */
export const rewardsPaid = (filled: number): LedgerReward[] => LEDGER_REWARDS.filter((r) => r.at <= filled);

const PRODUCT: Partial<Record<ItemId, LedgerProduct>> = Object.fromEntries([...LEDGER, ...LEDGER_LATE].map((p) => [p.item, p]));

/** Can a late good be made on this island (its island's research is offered only there)? */
const madeOn = (island: WorldId | 'any' | null, here: WorldId) => island === null || (island === 'any' ? here !== 'home' : island === here);

/** The Ledger's turn for a Codex on an island: the eight, then the late goods logged and makeable. */
export function ledgerTurn(codex: readonly ItemId[], here: WorldId): LedgerProduct[] {
  const got = new Set(codex);
  return [...LEDGER, ...LEDGER_LATE.filter((p) => got.has(p.item) && madeOn(p.island, here))];
}

/** The turn now. */
export const turnNow = (g: Game) => ledgerTurn(g.s.codex, worldOf(g));

/** Order n of the Ledger, of a turn (the eight alone by default), with `off` the share it wants less
 * (the shelf's and the Ledger's own `ledger` rules), and its product when it is the open one. */
export function ledgerOrder(n: number, turn: readonly LedgerProduct[] = LEDGER, off = 0, item?: ItemId): LedgerOrder {
  const p = (item && PRODUCT[item]) || turn[n % turn.length];
  const want = Math.max(1, Math.ceil((n + 1) * p.base * (1 - off) - 1e-9));
  const every = LEDGER_RULES.every;
  const tenth = (n + 1) % every === 0;
  return { n, item: p.item, base: p.base, want, pays: want * ITEMS[p.item].value * LEDGER_RULES.pays, cosmetic: tenth ? cosmeticAt((n + 1) / every - 1) : null, reward: tenth ? rewardAt(n + 1) : null };
}

export function ledgerState(g: Game): LedgerState {
  return (g.s.meta.ledger ??= { n: 0, progress: {} });
}

/** The open order's product: the one fixed when it opened, while it can be made here; else the
 * turn's. */
function openItem(g: Game, L: LedgerState): ItemId {
  const fixed = L.item ? LEDGER_LATE.find((p) => p.item === L.item) : undefined;
  if (L.item && (PRODUCT[L.item] && (!fixed || madeOn(fixed.island, worldOf(g))))) return L.item;
  const turn = turnNow(g);
  // a fixed late good that can't be made here: the eight's product for this number
  return L.item ? LEDGER[L.n % LEDGER.length].item : turn[L.n % turn.length].item;
}

/** Order n as the game has it now (the turn, the shelf's share off; the open one's own product). */
export function orderNow(g: Game, n: number): LedgerOrder {
  const L = ledgerState(g);
  return ledgerOrder(n, turnNow(g), trules(g).ledger, n === L.n ? openItem(g, L) : undefined);
}

/** The open order now. */
export const currentLedger = (g: Game): LedgerOrder => orderNow(g, ledgerState(g).n);

/** How far the open order is, 0..1. */
export function ledgerFrac(g: Game): number {
  const o = currentLedger(g);
  return Math.min(1, (ledgerState(g).progress[o.item]?.toNumber() ?? 0) / o.want);
}

/** The next order that pays a cosmetic, and how many orders away it is (0: the open one). */
export function nextCosmetic(g: Game): { order: LedgerOrder; away: number } {
  const n = ledgerState(g).n;
  const every = LEDGER_RULES.every;
  const at = Math.ceil((n + 1) / every) * every - 1;
  return { order: orderNow(g, at), away: at - n };
}

/** A Dock delivery: the Ledger takes what its open order still wants; returns what is left to sell. */
export function ledgerTake(g: Game, item: ItemId, n: Num): Num {
  if (n.isZero() || !ledgerOpen(g)) return n;
  const L = ledgerState(g);
  const o = currentLedger(g);
  if (o.item !== item) return n;
  const have = L.progress[item] ?? Num.ZERO;
  if (have.gte(o.want)) return n;
  const take = Num.min(Num.of(o.want).sub(have), n);
  L.progress[item] = have.add(take);
  return n.sub(take);
}

/** Each tick: the open order's product is fixed (the sim's write, never the screen's), and it
 * completes when it has all it wants: it pays, and the next one opens with its product. */
export function runLedger(g: Game) {
  if (!ledgerOpen(g)) return;
  const L = ledgerState(g);
  const it = openItem(g, L);
  if (L.item !== it) L.item = it;
  const o = currentLedger(g);
  if (!(L.progress[o.item] ?? Num.ZERO).gte(o.want)) return;
  L.n++;
  L.progress = {};
  const turn = turnNow(g);
  L.item = turn[L.n % turn.length].item;
  g.earn(Num.of(o.pays), true);
  if (o.cosmetic) {
    const c = (g.s.meta.cosmetics ??= []);
    if (!c.includes(o.cosmetic)) c.push(o.cosmetic);
  }
  g.bump('ledgerOrders');
  g.emit({ type: 'ledger', id: o.cosmetic ?? o.item, value: o.pays, d: L.n });
}
