// Automation (DESIGN.md §19, pillar 2): the chores of the first layer, handed to machines by the
// Patent tree, and the Committee's Night Crew. Runs first in the tick, right after the input
// commands, since each of these is an action a player would otherwise take:
//  - the Draughtsman unfolds the Patent Drawer's queued designs as land, research and coin allow
//    (src/sim/drawer.ts);
//  - the Shovel Frog clears one machine jammed on its byproduct every second;
//  - the Lab Assistant picks research when none is selected;
//  - the Order Clerk accepts the first offered order when none is active;
//  - the Stamp Press keeps one spare copy of each design marked for it, the cheapest first;
//  - the Night Crew (the Committee's reputation 2) takes a slag off every heap every 10 s, only
//    while the player is away (the tab hidden, or the game closed: the offline run hides it), so
//    Act I's slag lesson stands while anyone plays.
// None of it goes through the command log: it is the sim's own rule, replayed the same way.
import type { Game, ActResult } from '../Game';
import { OK, no } from '../Game';
import { TICK_RATE } from '../../engine/time';
import { RULES } from '../../data/rules';
import { RESEARCH, type ResearchId } from '../../data/research';
import type { ItemId } from '../../data/items';
import { prules } from '../patents';
import { runDraughtsman } from '../drawer';
import { shovel } from './machines';
import { availableNodes, selectResearch } from './research';
import { offeredOrders } from './orders';
import { foldAudited, mainItem, stamp, stampCost, stampRefusal } from './modules';
import { buyPatent, openPatents, patentRefusal } from '../patents';
import { lrules } from '../legacy';
import { unfoldKept, unfoldKeptRefusal } from '../drawer';
import { cancelAudit, startAudit } from './audits';
import { addRoute, hentAt, hplace, hplaceRefusal, routeRefusal, setSkiffs } from './high';
import { previewPatents, reorganize, reorganizeRefusal } from '../reorganize';

export function runAutomation(g: Game) {
  const r = prules(g);
  runDraughtsman(g);
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
  if (r.nightCrew && !g.s.visible && t % (RULES.nightCrewSeconds.value * TICK_RATE) === 0) for (const h of g.logistics) if (h.kind === 'heap' && h.count > 0) h.count--;
  runLegacyAutomation(g);
}

// ------------------------------------------------------------------ the Legacy tree's (DESIGN.md §22)

/** The Legacy tree's automation of layer 1 (pillar 2): the Patent Clerk, the Regrader and the Town
 * Plan every 5 s, the Standing Committee every 10 s. None of it is a logged command. */
export function runLegacyAutomation(g: Game) {
  const L = lrules(g);
  const t = g.s.tick;
  if (g.s.scenario) return;
  const every = RULES.legacyEvery.value * TICK_RATE;
  if (L.clerk && t % every === 0) patentClerk(g);
  if (L.regrader && t % every === 0) regrade(g);
  if (L.regrader) foldRegraded(g);
  if (L.plans && t % every === 0) townPlan(g);
  if (L.standing && t % (RULES.standingEvery.value * TICK_RATE) === 0) standingCommittee(g);
}

/** The Patent Clerk: open nodes in the tree's order, as Patents allow; it saves for the first open
 * node it can't yet afford (a node refused for another reason, the offline ceiling, is passed). */
function patentClerk(g: Game) {
  for (let n = 0; n < 50; n++) {
    let bought = false;
    for (const id of openPatents(g)) {
      const why = patentRefusal(g, id);
      if (!why) { bought = buyPatent(g, id).ok; break; }
      if (why.startsWith('Costs')) return;
    }
    if (!bought) return;
  }
}

/** The Regrader: the first kept design not unfolded this run that can be is unfolded and audited
 * (a refold check when it still suits the island, else a full audit at its new grade). */
function regrade(g: Game) {
  if (g.s.audits.length >= prules(g).maxAudits) return;
  const done = new Set(g.s.drafted ?? []);
  for (const k of g.s.meta.drawer) {
    if (done.has(k.id) || k.nested) continue;
    if (unfoldKeptRefusal(g, k) || !unfoldKept(g, k.id).ok) continue;
    g.bump('regraderUnfolds');
    // the unfolded parts must be on the grid before the box is read
    if (g.layoutDirty) g.rebuild();
    if (startAudit(g, { x: k.x, y: k.y, w: k.w, h: k.h }).ok) g.s.audits[g.s.audits.length - 1].auto = true;
    return;
  }
}

/** A Regrader's audit, graded, folds by itself (named as kept); one graded F is cancelled and its
 * layout left standing for the player. */
function foldRegraded(g: Game) {
  const a = g.s.audits.find((q) => q.auto && q.result);
  if (!a || !a.result) return;
  if (a.result.grade.mult <= 0) { cancelAudit(g, a.id); return; }
  const k = g.s.meta.drawer.find((q) => q.x === a.box.x && q.y === a.box.y && q.w === a.box.w && q.h === a.box.h);
  foldAudited(g, k?.name ?? null, a.id);
}

/** The Town Plan: each planned District tile empty is filled with a spare copy of the best graded
 * design of its product and depth; each planned route between two filled tiles is flown, its
 * skiffs bought up to the plan's. */
function townPlan(g: Game) {
  const st = g.s.district;
  if (!st) return;
  for (const p of g.s.meta.plans ?? []) {
    for (const tile of p.tiles) {
      if (hentAt(g, 'district', tile.x, tile.y)) continue;
      const cands = g.s.designs
        .filter((d) => d.spare >= 1 && (d.depth ?? 1) === tile.depth && mainItem(d) === tile.item)
        .sort((a, b) => b.grade.mult - a.grade.mult || a.id - b.id);
      for (const d of cands) if (!hplaceRefusal(g, 'district', d.id, tile.x, tile.y)) { if (hplace(g, 'district', d.id, tile.x, tile.y).ok) g.bump('planPlaced'); break; }
    }
    for (const r of p.routes) {
      const a = hentAt(g, 'district', r.fx, r.fy), b = hentAt(g, 'district', r.tx, r.ty);
      if (!a || !b || a.kind !== 'module') continue;
      let route = st.routes.find((q) => q.from === a.id && q.to === b.id && q.item === r.item);
      if (!route) {
        if (routeRefusal(g, 'district', r.fx, r.fy, r.tx, r.ty, r.item) || !addRoute(g, 'district', r.fx, r.fy, r.tx, r.ty, r.item).ok) continue;
        route = st.routes[st.routes.length - 1];
      }
      while (route.skiffs < r.skiffs && setSkiffs(g, 'district', route.id, 1).ok) { /* bought one */ }
    }
  }
}

/** The Standing Committee: Reorganize by itself once the preview reaches the player's number,
 * never during a Challenge, and only when a Reorganize would be allowed (no audit running).
 * **Never while away** (the tab hidden, or the game closed: the offline run hides it): a reset is
 * the player's to see happen, and an offline replay that reset the run paid the time away into a
 * run that no longer existed (the Acts IV-V review: runs 5 -> 6, the District emptied, the report
 * "coin -21.3M"). The offline report says when it would have (`standingDue`); back in the game, it
 * fires at its next check. */
function standingCommittee(g: Game) {
  if (!g.s.visible) return;
  if (standingDue(g) === null) return;
  if (reorganize(g).ok) g.bump('standingReorganizes');
}

/** The Patents the Standing Committee would Reorganize at now, or null when it would not (no
 * Committee, no number set, a Challenge, the preview short of the number, or a Reorganize refused).
 * Read whether or not the player is away: the offline report's "would have reorganized" row. */
export function standingDue(g: Game): number | null {
  const at = g.s.meta.standing;
  if (!lrules(g).standing || at === null || at === undefined || g.s.challenge || g.s.scenario) return null;
  const now = previewPatents(g).now;
  if (now < at || reorganizeRefusal(g)) return null;
  return now;
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
