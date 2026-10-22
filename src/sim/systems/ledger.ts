// The Endless Ledger (DESIGN.md §23, the Kernel node of that name): infinite orders. Order n (from
// 0) wants (n + 1) x the base amount of the n-th product in turn (src/data/kernels.ts LEDGER), from
// any Dock, never timed; it pays twice its items' Dock value, and every tenth order pays a cosmetic
// (a machine skin id, then numbered ribbons), so there is always a next goal (§16 rule 1). Linear,
// not a curve (CLAUDE.md). The Ledger's count and progress are kept through every reset, like a
// Megaproject's. Deliveries reach it through `fillOrder` (src/sim/systems/docks.ts), after the
// special orders and before the sale; it completes with the orders (`runOrders` calls `runLedger`),
// so offline progress fills it through the same code. Pure.
import type { Game } from '../Game';
import { Num } from '../../engine/num';
import { ITEMS, type ItemId } from '../../data/items';
import { LEDGER, LEDGER_COSMETICS, LEDGER_RULES } from '../../data/kernels';
import { krules } from '../kernels';
import type { LedgerState } from '../world';

export interface LedgerOrder {
  /** its number (0 = the first) */
  n: number;
  item: ItemId;
  want: number;
  /** coin it pays, and the cosmetic (every tenth) */
  pays: number;
  cosmetic: string | null;
}

/** Is the Ledger open (its Kernel node owned; never in a Scenario)? */
export const ledgerOpen = (g: Game) => krules(g).ledger && !g.s.scenario;

/** The k-th cosmetic the Ledger pays (0 = the first): the skins in turn, then numbered ribbons. */
export const cosmeticAt = (k: number): string => (k < LEDGER_COSMETICS.length ? LEDGER_COSMETICS[k] : `ribbon${k + 1}`);

/** Order n of the Ledger. */
export function ledgerOrder(n: number): LedgerOrder {
  const p = LEDGER[n % LEDGER.length];
  const want = (n + 1) * p.base;
  const every = LEDGER_RULES.every;
  return { n, item: p.item, want, pays: want * ITEMS[p.item].value * LEDGER_RULES.pays, cosmetic: (n + 1) % every === 0 ? cosmeticAt((n + 1) / every - 1) : null };
}

export function ledgerState(g: Game): LedgerState {
  return (g.s.meta.ledger ??= { n: 0, progress: {} });
}

/** The open order now. */
export const currentLedger = (g: Game): LedgerOrder => ledgerOrder(ledgerState(g).n);

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
  return { order: ledgerOrder(at), away: at - n };
}

/** A Dock delivery: the Ledger takes what its open order still wants; returns what is left to sell. */
export function ledgerTake(g: Game, item: ItemId, n: Num): Num {
  if (n.isZero() || !ledgerOpen(g)) return n;
  const L = ledgerState(g);
  const o = ledgerOrder(L.n);
  if (o.item !== item) return n;
  const have = L.progress[item] ?? Num.ZERO;
  if (have.gte(o.want)) return n;
  const take = Num.min(Num.of(o.want).sub(have), n);
  L.progress[item] = have.add(take);
  return n.sub(take);
}

/** The open order completes when it has all it wants: it pays, and the next one opens. */
export function runLedger(g: Game) {
  if (!ledgerOpen(g)) return;
  const L = ledgerState(g);
  const o = ledgerOrder(L.n);
  if (!(L.progress[o.item] ?? Num.ZERO).gte(o.want)) return;
  L.n++;
  L.progress = {};
  g.earn(Num.of(o.pays), true);
  if (o.cosmetic) {
    const c = (g.s.meta.cosmetics ??= []);
    if (!c.includes(o.cosmetic)) c.push(o.cosmetic);
  }
  g.bump('ledgerOrders');
  g.emit({ type: 'ledger', id: o.cosmetic ?? o.item, value: o.pays, d: L.n });
}
