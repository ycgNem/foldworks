// Bramble's Town: the swamp town that grows in the water around the floors as orders are filled
// (the Milestone 4 review: the screen was a quarter floor and three quarters empty water). It
// starts as two houses on stilts; The Boardwalk lays a boardwalk along the floor's top edge, Lamp
// Posts stands lamps on it, the Gizmo Festival adds stalls, bunting and frogs walking, Unit 7's
// and Dame Voltaire's first orders add their buildings, and every filled order (a reputation
// level) adds a house. Placement is fixed (the same state always draws the same town), always off
// the floor and drawn behind it. Pieces whose sprite is not drawn yet are skipped. The sky island
// (docs/sky-island.md): the town stands on the island's north rim (the Factory's north deck); the
// lily pads went with the swamp, the island's own trees and bushes keep out of townZones().
// Presentation only: reads the Game, never writes it.
import { C, rgba } from '../data/palette';
import { ORDER, CUSTOMERS, type CustomerId } from '../data/orders';
import type { Game } from '../sim/Game';
import { TILE } from './ground';
import { sheet, hasArt, frameNamed, type SpriteSheet } from './sprites';

/** One piece of the town: a sprite standing with its bottom on tile row `row` (its bottom edge at
 *  (row + 1) * TILE), centred on `w` tiles from tile column `x`. */
export interface TownPiece {
  key: string;
  /** what made it (a news line and a burst play the first time a group appears) */
  group: string;
  sprite: string;
  /** a frame name from the sidecar, or an index */
  frame: string | number;
  x: number;
  row: number;
  w: number;
  /** draw order: lower first */
  z: number;
  label: string;
  anim?: boolean;
  /** a walking frog: its index (position comes from the time) */
  walker?: number;
}

/** The town's rows above the floor: the far row (houses behind the stalls), the back row (houses
 *  and the customers' buildings) and the boardwalk row along the floor's top edge. */
const FAR = -3, BACK = -2, WALK = -1;
/** how many water rows above the floor the town needs on screen (Unit 7's tower is 3 tiles tall) */
export const TOWN_ROWS = 4;

const HOUSE_VARIANTS = ['gable', 'lily', 'tall', 'brick', 'hut', 'gable', 'lily', 'tall', 'brick'];
/** where reputation houses go, in the order they are built */
const HOUSE_SLOTS: { x: number; row: number }[] = [
  { x: 8, row: BACK }, { x: 21, row: BACK }, { x: 5, row: FAR }, { x: 10, row: FAR }, { x: 18, row: FAR },
  { x: -3, row: BACK }, { x: 24, row: BACK }, { x: 2, row: 99 }, { x: 6, row: 99 }, { x: 10, row: 99 },
];
const LAMPS = [2, 7, 12, 15, 20, 23];

/** Where the town may ever stand around a floor fw x fh (tile rects, x0 y0 inclusive, x1 y1
 *  exclusive), sprites' height included: the island keeps its trees and bushes out of them (the
 *  sky island, docs/sky-island.md). The rows above the floor from x -3 to fw + 3, and the row-99
 *  slots under it. */
export function townZones(fw: number, fh: number): { x0: number; y0: number; x1: number; y1: number }[] {
  const xs = HOUSE_SLOTS.filter((s) => s.row === 99).map((s) => s.x);
  return [
    { x0: -3, y0: FAR - 2, x1: Math.min(fw, 24) + 3, y1: 0 },
    { x0: Math.min(...xs), y0: fh, x1: Math.max(...xs) + 2, y1: fh + 2 },
  ];
}
const STALLS = [5, 10, 18];

const fmtTime = (tick: number) => {
  const s = Math.floor(tick / 20);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};

export class Town {
  /** the tick each order was filled on, as seen by this session (labels say when) */
  times: Record<string, number> = {};
  /** news for the HUD to print in the Gazette and play a sound for, drained each frame */
  news: { text: string; x: number; y: number }[] = [];
  private known = new Set<string>();
  private game: Game | null = null;
  private cache: { v: string; fw: number; fh: number; pieces: TownPiece[] } | null = null;
  /** the last pieces drawn and where (world px), for hover */
  private drawn: { p: TownPiece; x: number; y: number; w: number; h: number }[] = [];

  label(id: string, what: string): string {
    const t = this.times[id];
    return t !== undefined ? `${what}: filled at ${fmtTime(t)}` : `${what}: filled`;
  }

  /** Every piece the state calls for, around a floor fw x fh tiles. */
  pieces(g: Game, fw: number, fh: number): TownPiece[] {
    const o = g.s.orders;
    // fill times survive a reload or an offline run in the save (orders.doneAt)
    for (const [k, t] of Object.entries(o.doneAt ?? {})) this.times[k] ??= t;
    const v = `${o.done.join(',')}|${Object.keys(this.times).length}`;
    if (this.cache && this.cache.v === v && this.cache.fw === fw && this.cache.fh === fh) return this.cache.pieces;
    const out: TownPiece[] = [];
    const done = (id: string) => o.done.includes(id);
    const add = (p: TownPiece) => {
      // only on water: left of, right of, above or below the floor, never on it
      const r = p.row === 99 ? fh + 1 : p.row;
      const onFloor = r >= 0 && r < fh && p.x + p.w > 0 && p.x < fw;
      if (onFloor || p.x < -3 || p.x + p.w > fw + 3) return;
      out.push({ ...p, row: r });
    };
    // the town as the player finds it: Bramble's house and a neighbour's hut
    add({ key: 'hut0', group: 'start', sprite: 'town_house', frame: 'hut', x: 0, row: BACK, w: 2, z: 2, label: "A townsfrog's hut: the town was here first" });
    add({ key: 'bramble', group: 'start', sprite: 'town_house', frame: 'bramble', x: 3, row: BACK, w: 2, z: 2, label: "Mayor Bramble's house: the town was here first" });
    if (done('boardwalk')) {
      const lab = this.label('boardwalk', ORDER.boardwalk.name);
      const x1 = Math.min(fw, 24);
      for (let x = -1; x <= x1; x++) add({ key: 'bw' + x, group: 'boardwalk', sprite: 'town_boardwalk', frame: x === -1 ? 'end_w' : x === x1 ? 'end_e' : 'h', x, row: WALK, w: 1, z: 3, label: lab });
    }
    if (done('lampPosts')) {
      const lab = this.label('lampPosts', ORDER.lampPosts.name);
      for (const x of LAMPS) add({ key: 'lamp' + x, group: 'lamps', sprite: 'town_lamp', frame: 0, x, row: WALK, w: 1, z: 4, label: lab, anim: true });
    }
    if (done('gizmoFestival')) {
      const lab = this.label('gizmoFestival', ORDER.gizmoFestival.name);
      STALLS.forEach((x, i) => add({ key: 'stall' + x, group: 'festival', sprite: 'town_stall', frame: i, x, row: WALK, w: 2, z: 4, label: lab, anim: true }));
      for (let i = 0; i < 4; i++) add({ key: 'frog' + i, group: 'festival', sprite: 'town_frog', frame: 0, x: 0, row: WALK, w: 1, z: 6, label: `A townsfrog at the Festival (${ORDER.gizmoFestival.name}: ${this.times.gizmoFestival !== undefined ? 'filled at ' + fmtTime(this.times.gizmoFestival) : 'filled'})`, anim: true, walker: i });
    }
    // the customers' buildings arrive with their first filled order
    const first = (c: CustomerId) => o.done.find((id) => ORDER[id]?.customer === c);
    const u7 = first('unit7');
    if (u7) add({ key: 'unit7', group: 'unit7', sprite: 'town_unit7', frame: 0, x: 13, row: BACK, w: 2, z: 2, label: `Unit 7's observatory (${this.label(u7, ORDER[u7].name)})`, anim: true });
    const vt = first('voltaire');
    if (vt) add({ key: 'voltaire', group: 'voltaire', sprite: 'town_voltaire', frame: 0, x: 16, row: BACK, w: 2, z: 2, label: `Dame Voltaire's turbine pavilion (${this.label(vt, ORDER[vt].name)})`, anim: true });
    // a house for every reputation level, in the order the orders were filled
    const lvl: Partial<Record<CustomerId, number>> = {};
    o.done.forEach((id, i) => {
      const d = ORDER[id];
      if (!d || i >= HOUSE_SLOTS.length) return;
      const n = (lvl[d.customer] = (lvl[d.customer] ?? 0) + d.rep);
      const slot = HOUSE_SLOTS[i];
      const who = CUSTOMERS[d.customer].name;
      add({ key: 'rep' + i, group: 'rep:' + id, sprite: 'town_house', frame: HOUSE_VARIANTS[i % HOUSE_VARIANTS.length], x: slot.x, row: slot.row, w: 2, z: slot.row === FAR ? 1 : 2, label: `A new house: ${who}'s reputation ${n} (${this.label(id, d.name)})` });
    });
    out.sort((a, b) => a.row - b.row || a.z - b.z || a.x - b.x);
    this.cache = { v, fw, fh, pieces: out };
    return out;
  }

  /** Note new groups (after the first look at a game): a news line and a burst where they stand. */
  private watch(g: Game, pieces: TownPiece[]) {
    const groups = new Map<string, TownPiece>();
    for (const p of pieces) if (!groups.has(p.group)) groups.set(p.group, p);
    if (this.game !== g) {
      this.game = g;
      this.known = new Set(groups.keys());
      return;
    }
    for (const [k, p] of groups) {
      if (this.known.has(k)) continue;
      this.known.add(k);
      const text = NEWS[k] ?? (k.startsWith('rep:') ? `HOUSING: a new family moves onto the water, drawn by ${CUSTOMERS[ORDER[k.slice(4)]?.customer ?? 'bramble'].name}'s good word.` : null);
      if (text) this.news.push({ text, x: (p.x + p.w / 2) * TILE, y: (p.row + 0.5) * TILE });
    }
  }

  /** Draw the town around a floor fw x fh (world transform set, behind the floor). */
  draw(ctx: CanvasRenderingContext2D, g: Game, fw: number, fh: number, time: number) {
    const pieces = this.pieces(g, fw, fh);
    this.watch(g, pieces);
    this.drawn = [];
    const lampTops: { x: number; y: number }[] = [];
    for (const p of pieces) {
      if (!hasArt(p.sprite)) continue;
      const s = sheet(p.sprite);
      let f = typeof p.frame === 'string' ? frameNamed(s, p.frame) : p.frame % s.frames.length;
      if (p.anim && s.fps > 0) f = (f + Math.floor(time * s.fps + p.x * 0.37)) % s.frames.length;
      let x = p.x * TILE + Math.floor((p.w * TILE - s.w) / 2);
      // standing sprites end in a 2-row waterline, bottom-aligned to their row; a frog's feet go
      // on the boardwalk's deck (rows 5-10 of its tile), 6 px above the tile's top
      let y = (p.row + 1) * TILE - s.h;
      if (p.walker !== undefined) y = p.row * TILE - 6;
      let flip = false;
      if (p.walker !== undefined) {
        // frogs stroll the boardwalk, turning at its ends
        const span = Math.max(4, Math.min(fw, 24)) * TILE;
        const speed = 9 + p.walker * 3;
        const d = (time * speed + p.walker * 97) % (span * 2);
        flip = d >= span;
        x = -TILE + Math.round(flip ? span * 2 - d : d);
        f = Math.floor(time * (s.fps || 8) + p.walker) % s.frames.length;
      }
      draw(ctx, s, f, x, y, flip);
      this.drawn.push({ p, x, y, w: s.w, h: s.h });
      if (p.sprite === 'town_lamp') lampTops.push({ x: x + Math.floor(s.w / 2), y: y + 4 });
    }
    // bunting strung between the lamp posts once the Festival is on
    if (g.s.orders.done.includes('gizmoFestival') && lampTops.length > 1) bunting(ctx, lampTops, time);
  }

  /** The piece under a world pixel (frontmost first), if any. */
  at(wx: number, wy: number): TownPiece | null {
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      const d = this.drawn[i];
      if (d.p.group === 'swamp') continue;
      if (wx >= d.x && wy >= d.y && wx < d.x + d.w && wy < d.y + d.h) return d.p;
    }
    return null;
  }
}

const NEWS: Record<string, string> = {
  boardwalk: 'TOWN: The Boardwalk opens along the Workshop! Frogs stop sinking and start strolling.',
  lamps: 'TOWN: Lamp Posts lit along the Boardwalk. The swamp is less dark at night. Moths delighted.',
  festival: 'FESTIVAL: stalls, bunting and a crowd on the Boardwalk. Nobody knows what Gizmos do; everyone wants one.',
  unit7: 'TOWN: Unit 7 raises an observatory on the water. It watches the Factory. Constantly.',
  voltaire: "TOWN: Dame Voltaire's turbine pavilion rises on stilts. It hums in a superior key.",
};

function draw(ctx: CanvasRenderingContext2D, s: SpriteSheet, f: number, x: number, y: number, flip: boolean) {
  const img = s.frames[((f % s.frames.length) + s.frames.length) % s.frames.length];
  if (!flip) { ctx.drawImage(img, x, y); return; }
  ctx.save();
  ctx.translate(x + s.w, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Strings of little flags sagging between points (world px), stirring in the wind. */
function bunting(ctx: CanvasRenderingContext2D, tops: { x: number; y: number }[], time: number) {
  const cols = [C.pipRed, C.gold, C.teal1, C.leaf, C.hot];
  for (let i = 0; i + 1 < tops.length; i++) {
    const a = tops[i], b = tops[i + 1];
    if (b.x - a.x > 6 * TILE) continue;
    const n = Math.max(2, Math.floor((b.x - a.x) / 4));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 5);
      ctx.fillStyle = rgba(C.ink, 0.9);
      ctx.fillRect(x, y, 1, 1);
      if (k % 2 === 1 && k < n) {
        const sway = Math.sin(time * 4 + i + k) > 0.6 ? 1 : 0;
        ctx.fillStyle = cols[(i + k) % cols.length];
        ctx.fillRect(x - 1 + sway, y + 1, 3, 1);
        ctx.fillRect(x + sway, y + 2, 1, 1);
      }
    }
  }
}
