// The Kernel tree's effects (DESIGN.md §23, reset layer 3): buying a node, the base rules the
// systems read through `krules` (as the Patent tree's through `prules` and the Legacy tree's through
// `lrules`), and Kept Legacy's choice of nodes. Every node is a rule the universe is built under:
// belts, ports, the fold box, the fifth floor, the recipe table, the night, what the Last Fold keeps.
import type { Game, ActResult } from './Game';
import { OK, no } from './Game';
import { Num } from '../engine/num';
import { RULES } from '../data/rules';
import { KERNELS, KERNEL_IDS, type KernelId } from '../data/kernels';
import { LEGACY, type LegacyId } from '../data/legacy';
import type { State } from './world';

export interface KernelRules {
  /** items a belt tile carries (1, or 2 with Wide Belts) */
  beltItems: number;
  everySide: boolean;
  /** the Workshop fold box with the Bigger Box (0: no change) */
  foldMax: number;
  cookbook: boolean;
  beyond: boolean;
  ledger: boolean;
  /** seconds between the Seed's digs on each side */
  seedSeconds: number;
  /** the offline ceiling, and what Long Nights adds toward it (0 without it) */
  offlineCeiling: number | null;
  offlineAdd: number;
  keptIslands: boolean;
  /** Legacy nodes Kept Legacy keeps through a Last Fold */
  legacySlots: number;
}

const cache = new WeakMap<State, { key: number; r: KernelRules }>();

/** Every rule a Kernel node changes, as it stands now. */
export function krules(g: Game): KernelRules {
  const s = g.s;
  const nodes = s.meta.kernelNodes ?? [];
  // nodes are only ever added (a Last Fold keeps the tree), so their count is the key: read every
  // tick by belts and docks, it must be cheap
  const key = nodes.length;
  const hit = cache.get(s);
  if (hit && hit.key === key) return hit.r;
  const r: KernelRules = {
    beltItems: 1, everySide: false, foldMax: 0, cookbook: false, beyond: false, ledger: false,
    seedSeconds: RULES.seedSeconds.value, offlineCeiling: null, offlineAdd: 0, keptIslands: false, legacySlots: 0,
  };
  for (const id of nodes) {
    const e = KERNELS[id]?.effect;
    if (!e) continue;
    switch (e.k) {
      case 'wideBelts': r.beltItems = Math.max(r.beltItems, e.per); break;
      case 'everySide': r.everySide = true; break;
      case 'foldMax': r.foldMax = Math.max(r.foldMax, e.value); break;
      case 'cookbook': r.cookbook = true; break;
      case 'beyond': r.beyond = true; break;
      case 'ledger': r.ledger = true; break;
      case 'seedling': r.seedSeconds = Math.min(r.seedSeconds, e.seconds); break;
      case 'longNights': r.offlineCeiling = Math.max(r.offlineCeiling ?? 0, e.ceiling); r.offlineAdd += e.add; break;
      case 'keptIslands': r.keptIslands = true; break;
      case 'keptLegacy': r.legacySlots = Math.max(r.legacySlots, e.slots); break;
    }
  }
  cache.set(s, { key, r });
  return r;
}

export const hasKernel = (g: Game, id: KernelId) => !!g.s.meta.kernelNodes?.includes(id);

/** Why a node can't be bought now, or null. */
export function kernelRefusal(g: Game, id: KernelId): string | null {
  const d = KERNELS[id];
  if (!d) return 'No such Kernel node';
  if (hasKernel(g, id)) return 'Already yours';
  const missing = d.requires.filter((q) => !hasKernel(g, q));
  if (missing.length) return `Needs ${missing.map((q) => KERNELS[q].name).join(' and ')} first`;
  const have = g.s.meta.kernels ?? Num.ZERO;
  if (have.lt(d.cost)) return `Costs ${d.cost} Kernel${d.cost > 1 ? 's' : ''}: you have ${have.format()}`;
  return null;
}

export function buyKernel(g: Game, id: KernelId): ActResult {
  const why = kernelRefusal(g, id);
  if (why) return no(why);
  const m = g.s.meta;
  m.kernels = (m.kernels ?? Num.ZERO).sub(KERNELS[id].cost);
  (m.kernelNodes ??= []).push(id);
  // belts, ports and the box change the layout's rules at once
  g.layoutDirty = true;
  g.factoryDirty = true;
  g.bump('kernelNodes');
  g.emit({ type: 'kernel', id, value: KERNELS[id].cost });
  return OK;
}

/** Nodes the player could buy now (prerequisites owned), affordable or not, in tree order. */
export function openKernels(g: Game): KernelId[] {
  return KERNEL_IDS.filter((id) => !hasKernel(g, id) && KERNELS[id].requires.every((q) => hasKernel(g, q)));
}

/** Kept Legacy: keep a Legacy node through the next Last Fold (again: no longer). */
export function setKeptLegacy(g: Game, id: LegacyId): ActResult {
  const slots = krules(g).legacySlots;
  if (!slots) return no('Buy Kept Legacy (a Kernel node) first');
  if (!LEGACY[id]) return no('No such Legacy node');
  if (!g.s.meta.legacyNodes?.includes(id)) return no('Keep a node you own');
  const k = (g.s.meta.keptLegacy ??= []);
  const i = k.indexOf(id);
  if (i >= 0) { k.splice(i, 1); return OK; }
  if (k.length >= slots) return no(`Kept Legacy keeps ${slots}: let one go first`);
  k.push(id);
  return OK;
}
