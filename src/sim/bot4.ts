// The Act IV bot (ROADMAP.md Milestone 9, DESIGN.md §22): the campaign past Act III. It plays the
// Act III policy (bot3.ts, with the Act II bot as its builder) and adds what Act IV asks of a player:
//  - research page 4 in a sensible order (Charting, then the Lighthouse and the Sky Anchor, then
//    Relocation, and the island's own chain on each island), paid by the District and the World;
//  - the World floor: depth-3 copies (the District's folds) placed beside what they feed and flown by
//    barges, a lot as the tiles or the routes run out, by the same rules as the District's skiffs
//    (bot3.ts `floorWork`), a copy more every 3 minutes while the coin covers it;
//  - Relocate when it pays (`relocateTo`, read by src/sim/campaign.ts like the Reorganize rule): the
//    move is allowed, the Legacy preview is worth a third of the tree's next node or more, and the
//    World has not grown for 10 minutes; the town flies to the next island it has not seen;
//  - Legacy nodes in a sensible priority (`LEGACY_PRIORITY`, bought by the campaign at a run's
//    start, one command a hand-beat), Old Habits keeping the Act III head starts;
//  - each island's rule, played as a player would: on the Old Works the rubble nearest the town is
//    cleared as the coin allows (a tile every 2 s at most); Rime, Cinder and Pebble need no chore
//    of their own (their rules act on the lines as laid; the bot's layouts are Home's, which is
//    what the pace test measures; ruins in a layout's way are not handled yet: PROGRESS.md).
// Honest like the others: every action is a command through g.act at the shared hand pace, and it
// reads only what the screen shows (the preview card, the floor, the research page).
import type { Game } from './Game';
import type { Act2Bot } from './bot2';
import { Act3Bot, WISH3 } from './bot3';
import type { ResearchId } from '../data/research';
import type { LegacyId } from '../data/legacy';
import { WORLDS, type WorldId, rubblePrice } from '../data/worlds';
import { TICK_RATE } from '../engine/time';
import { previewLegacy, relocateRefusal } from './relocate';
import { legacyRefusal, hasLegacy, lrules } from './legacy';
import { worldOf, rubbleAt } from './systems/islands';
import { stampCost } from './systems/modules';
import { HIGH } from '../data/floors';
import { hentAt, highW, lotPrice } from './systems/high';
import type { PatentId } from '../data/patents';

/** Act IV research, after Act III's (the island's own chain is added on its island). */
export const WISH4: ResearchId[] = ['charting', 'lighthouse', 'skyAnchor', 'relocation'];
export const ISLAND_WISH: Record<WorldId, ResearchId[]> = {
  home: [],
  pebble: ['skyglassCutting', 'horizonOptics'],
  cinder: ['cinderSmelting', 'sunsetDyes', 'sunsetEngineering'],
  rime: ['thermals', 'frostWorks', 'stormCells', 'pocketWeathers'],
  oldworks: ['relicStudy'],
};

/** The islands in the order this player visits them: the Old Works first (its ruins fold lines the
 * first hour has not reached, and its rule is a cost, not a new layout), then Rime (Home's dense
 * lines warm each other), Cinder (vents: compact clusters) and Pebble last (half the land). */
export const ISLAND_ORDER: WorldId[] = ['oldworks', 'rime', 'cinder', 'pebble'];

/** The Legacy tree in the order this player buys it: the head starts that skip Act I and the
 * Patents' chores first (the Purse, the Archive, the Clerk), the free skiff, the habits that keep
 * the Act III head starts, the Regrader, then the rest; the island softeners last, each before its
 * island when the Legacy is there (`softenerFor`). */
export const LEGACY_PRIORITY: LegacyId[] = [
  'patentPurse', 'townArchive', 'patentClerk', 'skiffGuild', 'oldHabits', 'regrader', 'standingCharts',
  'contractRunners', 'longerDrawer', 'townPlan', 'secondNature', 'standingCommittee', 'groupDrawer',
  'salvageCrews', 'warmHands', 'heatShields', 'skyMoorings',
];

const SOFTENER: Partial<Record<WorldId, LegacyId>> = { pebble: 'skyMoorings', cinder: 'heatShields', rime: 'warmHands', oldworks: 'salvageCrews' };

/** The Patent nodes Old Habits keeps through a Relocate: the Act III head starts, which save the
 * most of a run (DESIGN.md §21 Patents). */
export const HABITS: PatentId[] = ['zoningCharter', 'bearingPatent', 'districtDeeds', 'surveyCharter', 'overdriveHabit', 'starterLine', 'notebooks', 'chemNotes', 'senseNotes', 'roboticsPatent', 'longSkiffs', 'dispatcher'];

/** Minutes the World stands without growing before a Relocate that is allowed and pays is taken. */
export const ACT4_FULL = 10;

/** The next Legacy node to buy (prerequisites and Legacy allowing), or null: the softener of the
 * island the town flies to next goes first when the town is about to go there. */
export function nextLegacy(g: Game, next?: WorldId): LegacyId | null {
  const soft = next ? SOFTENER[next] : undefined;
  const order = soft ? [soft, ...LEGACY_PRIORITY.filter((q) => q !== soft)] : LEGACY_PRIORITY;
  return order.find((id) => !legacyRefusal(g, id)) ?? null;
}

/** The island to fly to next: the first in ISLAND_ORDER not visited, else the one (not this one)
 * with a Megaproject stage still to build, else the first that is not this one. */
export function nextIsland(g: Game): WorldId {
  const here = worldOf(g);
  const seen = g.s.meta.visited ?? ['home'];
  const fresh = ISLAND_ORDER.find((w) => w !== here && !seen.includes(w));
  if (fresh) return fresh;
  return ISLAND_ORDER.find((w) => w !== here) ?? 'oldworks';
}

export class Act4Bot {
  readonly g: Game;
  readonly a3: Act3Bot;
  /** copies of each depth-3 design wanted on the World */
  worldWant: Record<string, number> = {};
  private lookAt = 0;
  private growAt = 0;
  private grewAt = 0;
  private opened = false;

  constructor(g: Game, b: Act2Bot) {
    this.g = g;
    this.a3 = new Act3Bot(g, b);
    this.a3.wish = [...WISH3, ...WISH4, ...ISLAND_WISH[worldOf(g)]];
    this.grewAt = g.seconds;
  }

  get b(): Act2Bot {
    return this.a3.b;
  }

  update() {
    const g = this.g;
    this.a3.update();
    if (!this.b.handReady || g.s.tick < this.lookAt) return;
    this.lookAt = g.s.tick + TICK_RATE / 2;
    if (!g.s.world) return;
    if (!this.opened) {
      // the World is open: the District's folds go up there from now on (copies standing on the
      // District stay where they are)
      this.opened = true;
      this.b.mark('world');
      this.b.decide('world');
    }
    for (const d of g.s.designs) if ((d.depth ?? 1) === 3) this.a3.want[d.name] = Math.min(this.a3.want[d.name] ?? 0, this.a3.placed(d.name));
    this.grow();
    if (this.a3.floorWork('world', this.worldWant)) {
      this.grewAt = g.seconds;
      return;
    }
  }

  tick() {
    this.a3.tick();
  }

  /** One more depth-3 copy wanted on the World every 3 minutes, while every copy wanted stands and
   * the coin covers twice its stamp, in turn over the depth-3 designs. */
  private growNext = 0;
  private grow() {
    const g = this.g;
    if (g.s.tick < this.growAt) return;
    this.growAt = g.s.tick + 180 * TICK_RATE;
    const ds = g.s.designs.filter((d) => (d.depth ?? 1) === 3);
    if (!ds.length) return;
    if (ds.some((d) => this.a3.placed(d.name, 'world') < (this.worldWant[d.name] ?? 0))) return;
    if (this.a3.routesFull('world') && !lotPrice(g, 'world')) return;
    for (let i = 0; i < ds.length; i++) {
      const d = ds[(this.growNext + i) % ds.length];
      if (d.spare < 1 && g.s.coin.lt(stampCost(g, d).mul(2))) continue;
      this.growNext = (this.growNext + i + 1) % ds.length;
      this.worldWant[d.name] = Math.max(this.worldWant[d.name] ?? 0, this.a3.placed(d.name, 'world')) + 1;
      return;
    }
  }

  /** Is the World full (every tile, or every route, and every lot bought) or the coin piling up
   * unspent? Seconds since it last grew then, else 0. */
  private fullAgo(): number {
    const g = this.g;
    if (!g.s.world) return 0;
    let free = false;
    for (let y = 0; y < HIGH.world.h && !free; y++) for (let x = 0; x < highW(g, 'world'); x++) if (!hentAt(g, 'world', x, y)) { free = true; break; }
    const full = (!free || this.a3.routesFull('world')) && !lotPrice(g, 'world');
    return full || g.s.coin.gte(1e9) ? g.seconds - this.grewAt : 0;
  }

  /** The island to Relocate to now, or null (read each minute by the campaign): allowed, the
   * preview worth a Legacy node (4 or more; 20 on the first move, when Home's seven stages stand),
   * and the World full for ACT4_FULL minutes, or two hours past Relocation with the preview there. */
  relocateTo(): WorldId | null {
    const g = this.g;
    if (!g.done('relocation')) return null;
    const to = nextIsland(g);
    if (relocateRefusal(g, to)) return null;
    const p = previewLegacy(g, to).now;
    const first = (g.s.meta.relocations ?? 0) === 0;
    if (p < (first ? 20 : 4)) return null;
    if (this.fullAgo() >= ACT4_FULL * 60) return to;
    this.relocAt ??= g.seconds;
    return g.seconds - this.relocAt >= 2 * 3600 ? to : null;
  }
  private relocAt: number | undefined;

  /** Old Habits: the Patent nodes to keep through the move, chosen just before it (one command a
   * node, as the habit screen takes them). */
  habits(): PatentId[] {
    const g = this.g;
    const slots = lrules(g).habitSlots;
    if (!slots) return [];
    const kept = g.s.meta.habits ?? [];
    return HABITS.filter((id) => g.s.meta.nodes.includes(id) && !kept.includes(id)).slice(0, Math.max(0, slots - kept.length));
  }
}

/** The island chores a player does from a run's first minute (src/sim/campaign.ts calls it each
 * tick on an island): on the Old Works, a rubble tile cleared every 2 s at most, the one nearest
 * the town's start first, while the coin covers four times its price; the rest of the islands' rules
 * act on the lines as they are laid. Returns true when it acted. */
export class IslandHand {
  readonly g: Game;
  private at = 0;
  cleared = 0;
  constructor(g: Game) {
    this.g = g;
  }

  update(): boolean {
    const g = this.g;
    if (worldOf(g) !== 'oldworks' || g.s.tick < this.at) return false;
    this.at = g.s.tick + 2 * TICK_RATE;
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y < g.H; y++)
      for (let x = 0; x < g.W; x++) {
        if (!rubbleAt(g, x, y) || !g.owned(x, y)) continue;
        const d = Math.hypot(x - 4, y - 4);
        if (!best || d < best.d) best = { x, y, d };
      }
    if (!best || g.s.coin.lt(rubblePrice(best.x, best.y) * 4 + 50)) return false;
    if (g.act({ k: 'clear', x: best.x, y: best.y }).ok) this.cleared++;
    return true;
  }
}

export const islandName = (w: WorldId) => WORLDS[w].name;
export { hasLegacy };
