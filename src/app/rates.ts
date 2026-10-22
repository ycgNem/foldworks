// Rates in tooltips (Milestone 13): what a building makes a minute at its recipe (for the build
// wheel's item cards), and how long a research node or an order would take at what reaches the Dock
// and the Hopper now (the Shipping rates the Purse samples: topbar.ts shipRates). Reads the game,
// never writes it.
import { BUILD, type BuildKind } from '../data/machines';
import { recipesFor } from '../data/recipes';
import { RESEARCH, type ResearchId } from '../data/research';
import { ORDER } from '../data/orders';
import type { ItemId } from '../data/items';
import { plain } from '../engine/fmt';
import { recipeKnown } from '../sim/transfer';
import type { Game } from '../sim/Game';
import { shipRates } from './topbar';
import type { App } from './app';

/** What a building makes a minute at its first recipe known now, at its own speed (a Mk2 makes
 * its speed times a Mk1's), or null for a building with no recipe. */
export function kindRate(g: Game, kind: BuildKind): { item: ItemId; perMin: number } | null {
  const d = BUILD[kind];
  if (!d.machine) return null;
  const speed = d.speed ?? 1;
  const r = recipesFor(d.machine).find((q) => recipeKnown(g, q) && (!q.mk2 || speed > 1)) ?? recipesFor(d.machine).find((q) => !q.mk2 || speed > 1);
  if (!r) return null;
  const o = r.outputs[0];
  return { item: o.item, perMin: (o.n * 60 * speed) / r.time };
}

/** "12 min", "2h 05m", "under a minute". */
export function minutes(min: number): string {
  if (min < 1) return 'under a minute';
  if (min < 90) return `${Math.ceil(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** How long `owed` items take at what reaches the Dock and the Hopper a minute now: the slowest
 * item sets it. Null when nothing is owed; 'never' when an owed item is not arriving at all. */
export function etaFor(app: App, owed: [ItemId, number][]): { min: number; slow: ItemId | null } | 'never' | null {
  const rates = shipRates(app);
  let worst = 0, slow: ItemId | null = null;
  for (const [item, n] of owed) {
    if (n <= 0) continue;
    const r = rates.get(item) ?? 0;
    if (r <= 0) return 'never';
    const m = n / r;
    if (m > worst) { worst = m; slow = item; }
  }
  return slow ? { min: worst, slow } : null;
}

/** A research node's time at the delivery rate now (what is still owed after the bank), as words
 * for a caption, or null when there is nothing to say. */
export function researchEta(app: App, id: ResearchId): string | null {
  const g = app.game;
  if (g.done(id)) return null;
  const prog = g.s.research.progress[id] ?? {};
  const bank = g.s.research.selected === id ? {} : g.s.research.bank;
  const owed = (Object.entries(RESEARCH[id].cost) as [ItemId, number][]).map(([item, n]) => [item, n - (prog[item]?.toNumber() ?? 0) - (bank[item]?.toNumber() ?? 0)] as [ItemId, number]);
  const e = etaFor(app, owed);
  if (!e) return null;
  return e === 'never' ? 'not arriving yet' : `about ${minutes(e.min)}`;
}

/** One item's line for a hover: N a minute arriving, and how long the rest takes. */
export function itemEta(app: App, item: ItemId, owed: number): string {
  const r = shipRates(app).get(item) ?? 0;
  if (owed <= 0) return '{good:all in}';
  if (r <= 0) return '{soft:none arriving now}';
  return `{soft:${plain(r, r < 10 ? 1 : 0)}/min arriving · ${minutes(owed / r)} left}`;
}

/** An order's time at the delivery rate now, as words, or null. */
export function orderEta(app: App, id: string): string | null {
  const g = app.game;
  const d = ORDER[id];
  if (!d) return null;
  const p = g.s.orders.progress[id] ?? {};
  const e = etaFor(app, (Object.entries(d.wants) as [ItemId, number][]).map(([item, n]) => [item, n - (p[item]?.toNumber() ?? 0)]));
  if (!e) return null;
  return e === 'never' ? 'not arriving yet' : `about ${minutes(e.min)}`;
}
