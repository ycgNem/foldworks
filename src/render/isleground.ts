// The islands' rules on the ground (DESIGN.md §22, Act IV; the art: docs/endgame.md "Act IV art as
// built"): what the Workshop of each island draws over its baked ground and on its machines, so a
// rule is seen before it is read.
// - Pebble Isle: the land is the rows of its land chunks (C, D and F are sky): `workshopLand`.
// - Cinder Isle: its vents (`vent`, animated), and over the four tiles beside each a faint heat
//   shimmer, so a vent's reach (the tiles where a machine runs without power and no belt stands)
//   shows on the floor.
// - the Old Works: its rubble (`rubble`, a variant by a hash of the tile, the same every run) and
//   its ruined machines (`ruin_overlay` cracks and moss composited source-atop over the machine's
//   own frame on a scratch canvas, as its sidecar says; s0-s3 for a 1x1, b0-b1 for a 2x2).
// - Rime: a powered machine running cold (the sim's `cold`, set when it is not warm) wears
//   `frost_overlay` the same way; a power plant building placed, hovered or pinned shows the reach
//   of its warmth (`drawHeatReach`).
// Presentation only: reads the Game, never writes it.
import { CHUNKS, patchOpen } from '../data/land';
import { C, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import type { Ent } from '../sim/world';
import { islandDef, isSky, ventAt } from '../sim/systems/islands';
import { TILE, hash2 } from './ground';
import { sheet, hasArt, drawRot, type SpriteSheet } from './sprites';
import type { IsleOpts } from './island';

/** The Workshop's land on this island for the island's bake: each row's plot (west, east
 *  exclusive) down to its last row of land, and the ores its veins show. */
export function workshopLand(g: Game): { h: number; opts: IsleOpts } {
  const d = islandDef(g);
  const land = CHUNKS.filter((c) => !isSky(g, c.id));
  const stage = g.s.mega?.stage ?? 0;
  const ores = [...new Set(g.patches.filter((p) => patchOpen(p, stage)).map((p) => p.item as string))];
  if (land.length === CHUNKS.length) return { h: g.H, opts: { world: d.id, ores } };
  let h = 0;
  for (const c of land) h = Math.max(h, c.y + c.h);
  const rows: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    let a = Infinity, b = -Infinity;
    for (const c of land) if (y >= c.y && y < c.y + c.h) { a = Math.min(a, c.x); b = Math.max(b, c.x + c.w); }
    // a row with no land of its own (none on these islands) takes the row above's
    rows.push(a < b ? [a, b] : rows[rows.length - 1] ?? [0, g.W]);
  }
  return { h, opts: { world: d.id, rows, ores } };
}

/** Vents and rubble, over the ground and under everything that stands (world transform set). */
export function drawIsleGround(ctx: CanvasRenderingContext2D, g: Game, time: number) {
  const d = islandDef(g);
  if (d.vents?.length) drawVents(ctx, g, time, d.vents);
  const rub = g.s.rubble;
  if (rub?.length) {
    const s = sheet('rubble');
    for (const i of rub) {
      const x = i % g.W, y = Math.floor(i / g.W);
      const f = Math.floor(hash2(x, y, 611) * s.frames.length) % s.frames.length;
      if (hasArt('rubble')) ctx.drawImage(s.frames[f], x * TILE, y * TILE);
      else rubbleStandIn(ctx, x * TILE, y * TILE, f);
    }
  }
}

/** The four tiles beside a vent that are themselves not a vent (its reach). */
function besideTiles(g: Game, vents: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<number>();
  for (const [vx, vy] of vents)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = vx + dx, y = vy + dy;
      if (!g.inb(x, y) || ventAt(g, x, y) || seen.has(y * g.W + x)) continue;
      seen.add(y * g.W + x);
      out.push([x, y]);
    }
  return out;
}

const reachCache = new WeakMap<Game, { v: number; tiles: [number, number][] }>();

function drawVents(ctx: CanvasRenderingContext2D, g: Game, time: number, vents: [number, number][]) {
  const s = sheet('vent');
  for (const [x, y] of vents) {
    const f = Math.floor(time * (s.fps || 6) + hash2(x, y, 620) * 4) % s.frames.length;
    if (hasArt('vent')) ctx.drawImage(s.frames[f], x * TILE, y * TILE);
    else ventStandIn(ctx, x * TILE, y * TILE, f);
  }
  // the heat over the tiles beside each: a warm wash and a few pixels of air rising and wavering,
  // faint enough to read through, on every tile a machine could stand vented on
  let rc = reachCache.get(g);
  if (!rc || rc.v !== g.version) { rc = { v: g.version, tiles: besideTiles(g, vents) }; reachCache.set(g, rc); }
  const breathe = 0.12 + 0.03 * Math.sin(time * 2.2);
  for (const [x, y] of rc.tiles) {
    // a warm wash, brightest along the side that touches the vent
    ctx.fillStyle = rgba(C.lamp1, breathe);
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    // nothing standing there hides the air rising (a machine there shows its own state)
    if (g.entAt(x, y)) continue;
    for (let k = 0; k < 4; k++) {
      const ph = hash2(x, y, 630 + k);
      const u = (time * 0.55 + ph) % 1;
      const px = x * TILE + 2 + Math.floor(ph * 12) + Math.round(Math.sin((time + ph * 7) * 5) * 1.2);
      const py = y * TILE + 14 - Math.floor(u * 13);
      ctx.fillStyle = rgba(k & 1 ? C.lamp2 : C.lamp3, 0.55 * Math.sin(u * Math.PI));
      ctx.fillRect(px, py, 1, 2);
    }
  }
}

// ------------------------------------------------------------------ the power plant's warmth

const PLANT = new Set(['boiler', 'steamEngine', 'generator']);

/** Rime: a power plant building's warmth while it is placed, hovered or pinned: its 5x5 (7x7 with
 * Thermals) in a warm tint, the powered machines in it framed (as a Pole's reach is shown,
 * renderer.ts). Nothing on an island that is not cold. */
export function drawHeatReach(ctx: CanvasRenderingContext2D, g: Game, time: number, ov: { hover: { x: number; y: number } | null; build: string | null; selected: number | null; remove: boolean }, reach: number) {
  if (!islandDef(g).cold) return;
  let at: { x: number; y: number } | null = null;
  if (ov.build && PLANT.has(ov.build) && ov.hover) at = ov.hover;
  else {
    const sel = ov.selected ? g.byId.get(ov.selected) : null;
    const hov = ov.hover && !ov.build && !ov.remove ? g.entAt(ov.hover.x, ov.hover.y) : null;
    for (const e of [hov, sel]) if (e && PLANT.has(e.kind)) { at = { x: e.x, y: e.y }; break; }
  }
  if (!at) return;
  const x0 = Math.max(0, at.x - reach), y0 = Math.max(0, at.y - reach), x1 = Math.min(g.W - 1, at.x + reach), y1 = Math.min(g.H - 1, at.y + reach);
  ctx.fillStyle = rgba(C.lamp1, 0.16);
  ctx.fillRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
  ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 5);
  ctx.strokeStyle = C.lamp2;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 * TILE + 0.5, y0 * TILE + 0.5, (x1 - x0 + 1) * TILE - 1, (y1 - y0 + 1) * TILE - 1);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba(C.lamp3, 0.85);
  for (const m of g.machines) {
    if (!(m.x + m.w - 1 >= x0 && m.x <= x1 && m.y + m.h - 1 >= y0 && m.y <= y1)) continue;
    ctx.strokeRect(m.x * TILE + 0.5, m.y * TILE + 0.5, m.w * TILE - 1, m.h * TILE - 1);
  }
}

// ------------------------------------------------------------------ overlays on machines

let scratch: HTMLCanvasElement | null = null;

/** Draw a machine's frame with an overlay composited source-atop over it (the overlay only where the
 * machine has pixels), at its tile pixel (x, y). `names` picks a variant by the machine's place. */
export function drawOverlaid(ctx: CanvasRenderingContext2D, s: SpriteSheet, f: number, e: Ent, x: number, y: number, overlay: 'ruin_overlay' | 'frost_overlay') {
  const big = e.w > 1 || e.h > 1;
  if (!hasArt(overlay)) {
    drawRot(ctx, s, f, x, y, e.rot);
    overlayStandIn(ctx, x, y, e.w * TILE, e.h * TILE, overlay);
    return;
  }
  const o = sheet(overlay);
  const pool = (o.order ?? []).map((n, i) => [n, i] as const).filter(([n]) => n.startsWith(big ? 'b' : 's')).map(([, i]) => i);
  const of = pool.length ? pool[Math.floor(hash2(e.x, e.y, overlay === 'ruin_overlay' ? 640 : 641) * pool.length) % pool.length] : 0;
  const w = Math.max(s.w, e.w * TILE), h = Math.max(s.h, e.h * TILE);
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < w || scratch.height < h) { scratch.width = Math.max(scratch.width, w); scratch.height = Math.max(scratch.height, h); }
  const sc = scratch.getContext('2d')!;
  sc.imageSmoothingEnabled = false;
  sc.globalCompositeOperation = 'source-over';
  sc.clearRect(0, 0, scratch.width, scratch.height);
  drawRot(sc, s, f, s.ax, s.ay, e.rot);
  sc.globalCompositeOperation = 'source-atop';
  // s* fill the cell's top-left 16x16 (a 1x1 machine), b* the whole 32x32
  sc.drawImage(o.frames[of], 0, 0, big ? o.w : TILE, big ? o.h : TILE, s.ax, s.ay, big ? o.w : TILE, big ? o.h : TILE);
  sc.globalCompositeOperation = 'source-over';
  ctx.drawImage(scratch, 0, 0, w, h, x - s.ax, y - s.ay, w, h);
}

// ------------------------------------------------------------------ code stand-ins (until art)

function ventStandIn(ctx: CanvasRenderingContext2D, x: number, y: number, f: number) {
  const p = (c: string, a: number, b: number, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  p(C.ink, 2, 3, 12, 11); p(C.earth0, 3, 4, 10, 9); p(C.ink, 5, 6, 6, 5);
  p([C.lamp0, C.lamp1, C.lamp2, C.lamp1][f % 4], 6, 7, 4, 3); p(C.lamp3, 7, 8, 2, 1);
}

function rubbleStandIn(ctx: CanvasRenderingContext2D, x: number, y: number, f: number) {
  const p = (c: string, a: number, b: number, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  p(C.ink, 2, 6 + (f % 2), 12, 8); p(C.steel1, 3, 7 + (f % 2), 10, 6); p(C.steel2, 4, 7 + (f % 2), 5, 2); p(C.earth1, 9, 10, 3, 2);
}

function overlayStandIn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, overlay: string) {
  ctx.fillStyle = overlay === 'ruin_overlay' ? rgba(C.moss1, 0.35) : rgba(C.cloud3, 0.35);
  ctx.fillRect(x + 1, y + 3, w - 6, h - 4);
}
