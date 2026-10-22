// The District's drawing (DESIGN.md §21, docs/endgame.md Milestone 7): a third sky platform,
// higher and brighter than the Factory's, built the Factory's way (src/render/factory.ts Platform):
// a pale steel deck baked per width (the plaza of 32 px plates to the north, a tread walk round
// the build floor, brass kerbs on every edge into the sky, the girder face and a truss under the
// south edge with rotor pods, outriggers on the side faces), the build floor's own plates
// (dist_deck floor0/floor1) where the modules stand. On it: skiff routes as dotted flight lines
// marching from source to destination (a route whose skiffs carry under 90% of what it is wanted
// in the warning colour: the bottleneck legible at 1x, pillar 3), the modules (dist_module with
// the main output in the window, lit while they run, the status pip), the Dock, the Hopper and
// the Megaproject Bay, the skiffs flying their routes back and forth (a crate of the item on the
// outbound leg while the route carries), the District fold's audit box, and the tools' overlays.
// Everything is derived from the sim's state each frame; nothing here writes to it. World pixels;
// the Renderer sets the camera.
import { C, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import type { Box, FEnt, SkiffRoute } from '../sim/world';
import { HIGH, type HighFloorId } from '../data/floors';
import { MEGAS } from '../data/megaprojects';
import type { ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { TICK_RATE } from '../engine/time';
import { prules } from '../sim/patents';
import { highW, hent, routeDist, skiffStats, routeCap, routeWant, lotPrice, bayProjects, megaStageOf, hplaceRefusal, hfoldRefusal, hentAt, takes } from '../sim/systems/high';
import { drawText, textWidth } from '../ui/font';
import { paperRaw } from '../ui/paper';
import { onPaper } from '../ui/theme';
import { sheet, itemIcon, hasArt, drawSprite } from './sprites';
import { mainOutput } from './factory';
import { TILE } from './ground';
import { drawPip, type PipShape } from './pips'; // Milestone 13: pips with shapes
import { art, artSig, canvas, hh, named } from './skyart';

const PIP: Record<string, string> = { work: C.pipGreen, starved: C.pipYellow, blocked: C.pipRed, idle: C.pipGrey };

export interface DistrictOverlay {
  /** the tile under the mouse (null over the HUD) */
  hover: { x: number; y: number } | null;
  /** a design in hand to place */
  place: number | null;
  remove: boolean;
  /** the Route tool is out; `from` once its source module is picked */
  route: boolean;
  from: { x: number; y: number } | null;
  /** the thing whose report is pinned, the route whose card is open, the route under the mouse */
  selected: number | null;
  selRoute: number | null;
  hoverRoute: number | null;
  /** a District fold box being dragged (tile rect, inclusive corners) */
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  /** which high floor is drawn (the World reuses the District's drawing, DESIGN.md §22) */
  floor?: HighFloorId;
}

/** A high floor's sheet: the World's `world_*` art is frame-compatible with the District's `dist_*`
 *  (docs/endgame.md, Act IV art as built), so the World draws with its own where it has it. */
export function hart(f: HighFloorId, name: string): string {
  const w = 'world_' + name;
  return f === 'world' && hasArt(w) ? w : 'dist_' + name;
}

/** What flies a high floor's routes: skiffs on the District, barges on the World (DESIGN.md §22). */
export const carrier = (f: HighFloorId) => (f === 'world' ? 'barge' : 'skiff');

/** The deck round the build floor, in tiles: the plaza north (two rows of 32 px plates), a walk
 *  `w` west, `e` east (the next lot for sale stands there), `s` south; the plaza a `wing` wider. */
export const DPLAT = { n: 4, s: 2, w: 2, e: 3, wing: 1 };
const PLATE_KINDS = ['plain', 'plain', 'skylight', 'plain', 'vent', 'plain', 'plain'];

function pick(a: ReturnType<typeof art>, name: string, i: number): HTMLCanvasElement | null {
  return named(a, name) ?? (a.names ? null : a.frames[i] ?? null);
}

/** The District's sky platform, baked per floor width (a lot bought bolts on east, a splice where
 *  it meets what was there), its rotors spinning live. */
export class DistrictPlatform {
  private c: HTMLCanvasElement | null = null;
  private key = '';
  private ox = 0;
  private oy = 0;
  private rotors: { x: number; y: number }[] = [];
  private sides: { x: number; y: number; east: boolean }[] = [];
  private b = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** world px under the floor's south edge the camera may show */
  readonly below = (DPLAT.s + 4) * TILE;

  /** the District's platform, or the World's (its art is frame-compatible: `world_*`) */
  constructor(readonly floor: HighFloorId = 'district') {}

  bounds() {
    return this.b;
  }

  draw(ctx: CanvasRenderingContext2D, fw: number, fh: number, time: number) {
    const key = `${fw}x${fh}:${artSig(['edge', 'under', 'deck'].map((n) => hart(this.floor, n)))}`;
    if (!this.c || key !== this.key) {
      this.bake(fw, fh);
      this.key = key;
    }
    ctx.drawImage(this.c!, this.ox, this.oy);
    const r = art(hasArt(hart(this.floor, 'rotor')) ? hart(this.floor, 'rotor') : 'fplat_rotor');
    const tick = Math.floor(time * (r.fps || 12));
    for (let i = 0; i < this.rotors.length; i++) {
      const p = this.rotors[i];
      ctx.drawImage(r.frames[(tick + i) % r.frames.length], p.x - r.ax, p.y - r.ay);
    }
    const s = art(hasArt(hart(this.floor, 'rotor_side')) ? hart(this.floor, 'rotor_side') : 'fplat_rotor_side');
    const n = Math.max(1, Math.floor(s.frames.length / 2));
    for (let i = 0; i < this.sides.length; i++) {
      const p = this.sides[i];
      const f = s.frames[(p.east ? n : 0) + ((tick + i * 3) % n)];
      if (f) ctx.drawImage(f, p.x - (p.east ? s.w - 1 - s.ax : s.ax), p.y - s.ay);
    }
  }

  private bake(fw: number, fh: number) {
    const P = DPLAT;
    const NX0 = -P.w - P.wing, NX1 = fw + P.e + P.wing, BX0 = -P.w, BX1 = fw + P.e, Y0 = -P.n, Y1 = fh + P.s;
    const on = (x: number, y: number) => {
      if (y < Y0 || y >= Y1) return false;
      return y < 0 ? x >= NX0 && x < NX1 : x >= BX0 && x < BX1;
    };
    const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < fw && y < fh;
    const X0 = NX0, X1 = NX1;
    const c = canvas((X1 - X0) * TILE, (Y1 - Y0 + 2) * TILE);
    const ctx = c.getContext('2d')!;
    this.ox = X0 * TILE;
    this.oy = Y0 * TILE;
    const put = (img: CanvasImageSource | null, x: number, y: number) => { if (img) ctx.drawImage(img, x * TILE - this.ox, y * TILE - this.oy); };
    const F = this.floor;
    const edge = art(hart(F, 'edge')), under = art(hart(F, 'under')), deck = art(hart(F, 'deck'));
    const seams = new Set<number>();
    for (let x = HIGH[F].w; x < fw; x += HIGH[F].lotCols) seams.add(x);
    const bottom = (x: number) => { let b = Y1 - 1; while (b >= Y0 && !on(x, b)) b--; return b; };
    for (let x = X0; x < X1; x++) {
      const b = bottom(x);
      if (b < Y0) continue;
      const l = !on(x - 1, b) || bottom(x - 1) < b, r = !on(x + 1, b) || bottom(x + 1) < b;
      const f = l && r ? pick(under, 'face_lr', 1) : l ? pick(under, 'face_l', 0) : r ? pick(under, 'face_r', 2)
        : seams.has(x) ? pick(under, 'face_splice', 1) : x % 2 ? pick(under, 'face2', 1) ?? pick(under, 'face', 1) : pick(under, 'face', 1);
      put(f, x, b + 1);
      if (x > BX0 && x < BX1 - 1) put(x === BX0 + 1 ? pick(under, 'truss_l', 3) : x === BX1 - 2 ? pick(under, 'truss_r', 5) : pick(under, 'truss', 4), x, Y1 + 1);
    }
    const mod2 = (v: number) => ((v % 2) + 2) % 2;
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!on(x, y)) continue;
        if (floor(x, y)) {
          // the build floor: plain plates, now and then one with a lit inspection hatch
          put(pick(deck, hh(x, y, 11) < 0.12 ? 'floor1' : 'floor0', 14), x, y);
        } else if (y < 0) {
          const px = x - mod2(x), py = y - mod2(y);
          const whole = on(px, py) && on(px + 1, py) && on(px, py + 1) && on(px + 1, py + 1) && py + 1 < 0;
          const kind = whole ? PLATE_KINDS[Math.floor(hh(px, py, 7) * PLATE_KINDS.length)] : 'plain';
          put(pick(deck, `${kind}_${mod2(y) ? 's' : 'n'}${mod2(x) ? 'e' : 'w'}`, 0), x, y);
        } else put(pick(deck, hh(x, y, 3) < 0.2 ? 'tread1' : 'tread0', 12), x, y);
      }
    const CORNERS: [string, number, number, number][] = [['nw', -1, -1, 9], ['ne', 1, -1, 3], ['sw', -1, 1, 12], ['se', 1, 1, 6]];
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!on(x, y) || floor(x, y)) continue;
        const m = (on(x, y - 1) ? 1 : 0) | (on(x + 1, y) ? 2 : 0) | (on(x, y + 1) ? 4 : 0) | (on(x - 1, y) ? 8 : 0);
        for (const [k, , , bits] of CORNERS) {
          if (m & bits) continue;
          const cut = named(edge, 'cut_' + k);
          if (!cut) continue;
          ctx.globalCompositeOperation = 'destination-out';
          put(cut, x, y);
          ctx.globalCompositeOperation = 'source-over';
        }
        if (m !== 15) put(pick(edge, 'm' + m, m), x, y);
        for (const [k, dx, dy, bits] of CORNERS) if ((m & bits) === bits && !on(x + dx, y + dy)) put(named(edge, 'in_' + k), x, y);
        if (seams.has(x) && on(x - 1, y)) put(named(edge, !on(x, y - 1) ? 'seam_n' : !on(x, y + 1) ? 'seam_s' : y < 0 ? 'seam_deck' : 'seam_tread'), x, y);
      }
    // the build floor's rim: a brass line where the floor meets the walk, so its edge reads
    ctx.fillStyle = rgba(C.brass1, 0.7);
    ctx.fillRect(-this.ox - 1, -this.oy - 1, fw * TILE + 2, 1);
    ctx.fillRect(-this.ox - 1, -this.oy + fh * TILE, fw * TILE + 2, 1);
    ctx.fillRect(-this.ox - 1, -this.oy - 1, 1, fh * TILE + 2);
    ctx.fillRect(-this.ox + fw * TILE, -this.oy - 1, 1, fh * TILE + 2);
    this.c = c;
    const span = BX1 - BX0 - 2;
    // the World's rotors are broader (64 px): one about every six tiles
    const n = Math.max(2, Math.round(span / (F === 'world' ? 6 : 5)));
    this.rotors = [];
    for (let i = 0; i < n; i++) this.rotors.push({ x: Math.round((BX0 + 1 + ((i + 0.5) * span) / n) * TILE), y: (Y1 + 2) * TILE - 3 });
    const rows = fh >= 6 ? [2, fh - 2] : [Math.floor(fh / 2)];
    this.sides = [];
    for (const r of rows) {
      this.sides.push({ x: BX0 * TILE, y: r * TILE + 8, east: false });
      this.sides.push({ x: BX1 * TILE, y: r * TILE + 8, east: true });
    }
    this.b = { x0: X0 * TILE - TILE, y0: Y0 * TILE, x1: X1 * TILE + TILE, y1: (Y1 + 2) * TILE + 24 };
  }
}

// ---------------------------------------------------------------- routes

/** A route whose skiffs can carry under 90% of what it is wanted: short of skiffs (the bottleneck;
 *  the Dispatcher's own test, DESIGN.md §21). */
export function routeShort(g: Game, r: SkiffRoute, f: HighFloorId = 'district'): boolean {
  const want = routeWant(g, f, r);
  return want > 1e-9 && routeCap(g, f, r) < want * 0.9;
}

/** Whether a route moved anything in the last second (its skiffs carry crates out). */
export function routeBusy(g: Game, r: SkiffRoute): boolean {
  return r.flow > 0.01 || (r.used !== undefined && g.s.tick - r.used < TICK_RATE);
}

/** A route's two ends, world px (the tile centres of its two things). */
export function routeEnds(g: Game, r: SkiffRoute, f: HighFloorId = 'district'): { a: FEnt; b: FEnt; ax: number; ay: number; bx: number; by: number } | null {
  const a = hent(g, f, r.from), b = hent(g, f, r.to);
  if (!a || !b) return null;
  return { a, b, ax: (a.x + a.w / 2) * TILE, ay: (a.y + a.h / 2) * TILE, bx: (b.x + b.w / 2) * TILE, by: (b.y + b.h / 2) * TILE };
}

/** The route whose flight line passes within `tol` world px of (wx, wy), away from its two ends'
 *  tiles (a click there is the thing's), nearest first. */
export function routeAtWorld(g: Game, wx: number, wy: number, tol = 3, f: HighFloorId = 'district'): SkiffRoute | null {
  const st = g.s[f];
  if (!st) return null;
  let best: SkiffRoute | null = null, bd = tol;
  for (const r of st.routes) {
    const e = routeEnds(g, r, f);
    if (!e) continue;
    const inside = (q: FEnt) => wx >= q.x * TILE && wy >= q.y * TILE && wx < (q.x + q.w) * TILE && wy < (q.y + q.h) * TILE;
    if (inside(e.a) || inside(e.b)) continue;
    const dx = e.bx - e.ax, dy = e.by - e.ay;
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((wx - e.ax) * dx + (wy - e.ay) * dy) / L2));
    const d = Math.hypot(e.ax + dx * t - wx, e.ay + dy * t - wy);
    if (d <= bd) { bd = d; best = r; }
  }
  return best;
}

/** A dashed flight line marching from (x0, y0) to (x1, y1). `bold`: 2 px dashes in `col` inside an
 *  ink rim (a route short of skiffs, the selected one, the one under the mouse); otherwise 1 px
 *  pencil dashes in `col` (ink on the pale deck). */
function flightLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, time: number, bold: boolean, alpha: number) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(len));
  const off = Math.floor(time * 10) % 6;
  ctx.globalAlpha = alpha;
  for (let pass = bold ? 0 : 1; pass < 2; pass++) {
    ctx.fillStyle = pass ? col : C.ink;
    for (let i = 0; i <= n; i++) {
      if ((i - off + 600) % 6 >= 4) continue;
      const px = Math.round(x0 + ((x1 - x0) * i) / n), py = Math.round(y0 + ((y1 - y0) * i) / n);
      if (!bold) ctx.fillRect(px, py, 1, 1);
      else if (pass) ctx.fillRect(px - 1, py - 1, 2, 2);
      else ctx.fillRect(px - 2, py - 2, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
}

/** An arrowhead at the destination's edge: which way the route flies. */
function arrowHead(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const back = Math.min(len / 2, 10);
  const tx = x1 - ux * back, ty = y1 - uy * back;
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? col : C.ink;
    for (let k = 0; k < 4; k++) {
      const cx = tx - ux * k, cy = ty - uy * k;
      for (let s = -k; s <= k; s++) {
        const px = Math.round(cx - uy * s * 0.8), py = Math.round(cy + ux * s * 0.8);
        if (pass) ctx.fillRect(px, py, 1, 1);
        else ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
  }
}

// ---------------------------------------------------------------- the floor

/** The Bay's frame: empty, stage1, stage2 by the open stage's progress; run1/run2 once every
 *  project here is done (or one stands done and nothing is open). */
function bayFrame(g: Game, time: number, fl: HighFloorId): number {
  const open = bayProjects(g, fl);
  const anyDone = (Object.values(MEGAS) as { id: keyof typeof MEGAS; floor: string }[]).some((m) => m.floor === fl && (g.s.megas?.[m.id]?.stage ?? 0) >= 1);
  if (!open.length) return anyDone ? 3 + (Math.floor(time * 6) % 2) : 0;
  const m = open[0];
  const st = megaStageOf(g, m)!;
  const p = g.s.megas?.[m]?.progress ?? {};
  let have = 0, need = 0;
  for (const [k, n] of Object.entries(st.wants) as [ItemId, number][]) { need += n; have += Math.min(n, p[k]?.toNumber() ?? 0); }
  const f = need ? have / need : 0;
  return f <= 0 ? 0 : f < 0.5 ? 1 : 2;
}

/** The District's open project's progress (0..1) at the Bay, or null when nothing is open. */
export function districtMegaFrac(g: Game, f: HighFloorId = 'district'): { id: keyof typeof MEGAS; frac: number } | null {
  const m = bayProjects(g, f)[0];
  if (!m) return null;
  const st = megaStageOf(g, m)!;
  const p = g.s.megas?.[m]?.progress ?? {};
  let have = 0, need = 0;
  for (const [k, n] of Object.entries(st.wants) as [ItemId, number][]) { need += n; have += Math.min(n, p[k]?.toNumber() ?? 0); }
  return { id: m, frac: need ? have / need : 0 };
}

/** `view`: the world rect on screen (sprites outside it are skipped). */
export function drawDistrict(ctx: CanvasRenderingContext2D, g: Game, time: number, ov: DistrictOverlay, view: { x0: number; y0: number; x1: number; y1: number }) {
  const F: HighFloorId = ov.floor ?? 'district';
  const st = g.s[F];
  if (!st) return;
  const fw = highW(g, F), fh = HIGH[F].h;
  const vis = (x: number, y: number, w: number, h: number) => x + w > view.x0 && y + h > view.y0 && x < view.x1 && y < view.y1;
  // the next lot for sale, outlined on the walk east of the floor (its button is the HUD's)
  if (lotPrice(g, F)) antsBox(ctx, fw + 2 / TILE, 0, HIGH[F].lotCols, fh, C.ink, rgba(C.steel0, 0.2), time);
  // the Bay's corner, marked until the Bay stands there
  const bayRes = (Object.values(MEGAS) as { floor: string; opens: string }[]).some((m) => m.floor === F && g.done(m.opens as never));
  if (bayRes && !st.ents.some((e) => e.kind === 'fbay')) bayMarks(ctx, time, F);
  // flight lines under everything that stands up
  for (const r of st.routes) {
    const e = routeEnds(g, r, F);
    if (!e) continue;
    if (!vis(Math.min(e.ax, e.bx), Math.min(e.ay, e.by), Math.abs(e.bx - e.ax) + 1, Math.abs(e.by - e.ay) + 1)) continue;
    const sel = r.id === ov.selRoute, hov = r.id === ov.hoverRoute;
    const short = routeShort(g, r, F);
    // short of skiffs: warning orange, bold (the bottleneck); selected gold; under the mouse bone;
    // the rest a quiet pencil line in ink
    const bold = sel || short || hov;
    const col = sel ? C.lamp2 : short ? C.lamp1 : hov ? C.bone : C.ink1;
    flightLine(ctx, e.ax, e.ay, e.bx, e.by, col, time, bold, bold ? 1 : 0.75);
    arrowHead(ctx, e.ax, e.ay, e.bx, e.by, bold ? col : C.steel4);
  }
  // the buildings
  for (const e of st.ents) {
    const x = e.x * TILE, y = e.y * TILE;
    if (!vis(x, y, e.w * TILE, e.h * TILE)) continue;
    if (e.kind === 'fdock' || e.kind === 'fhopper') {
      const name = hart(F, e.kind === 'fdock' ? 'dock' : 'hopper');
      const s = hasArt(name) ? sheet(name) : sheet(e.kind === 'fdock' ? 'factory_dock' : 'factory_hopper');
      ctx.drawImage(s.frames[Math.floor(time * (s.fps || 3)) % s.frames.length], x, y);
      continue;
    }
    if (e.kind === 'fbay') {
      const bn = hart(F, 'bay');
      const s = sheet(bn);
      if (hasArt(bn)) ctx.drawImage(s.frames[Math.min(s.frames.length - 1, bayFrame(g, time, F))], x, y);
      else { ctx.fillStyle = C.ink; ctx.fillRect(x, y, 32, 32); ctx.fillStyle = C.steel3; ctx.fillRect(x + 1, y + 1, 30, 30); }
      const fresh = Object.values(e.inBuf).some((v) => v > 0.01);
      if (fresh && Math.floor(time * 8) % 2) { ctx.fillStyle = C.bone; ctx.fillRect(x + 15, y + 14, 2, 2); }
      continue;
    }
    if (e.kind !== 'module') continue;
    drawModule(ctx, g, e, x, y, time, F);
    if ((e.od ?? 0) > 0) moduleHot(ctx, e, time);
    else if ((e.cool ?? 0) > 0) coolArc(ctx, x, y, e.cool ?? 0);
    // a module stopped by the player (the pause command, DESIGN.md §22): dimmed, the paused pip
    if (e.paused) { ctx.fillStyle = rgba(C.ink, 0.28); ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2); }
    pip(ctx, x, y, PIP[e.state], e.state === 'blocked' && !e.paused, time, e.paused ? 'paused' : undefined);
  }
  // the skiffs (barges on the World), over the modules (they fly)
  skiffs(ctx, g, time, vis, F);
  hauditBox(ctx, g, time, F);
  overlays(ctx, g, ov, time, F);
}

/** A District module: its building (lit and working while it runs), its main output in the window. */
function drawModule(ctx: CanvasRenderingContext2D, g: Game, e: FEnt, x: number, y: number, time: number, f: HighFloorId) {
  const out = mainOutput(g, e.design);
  const mn = hart(f, 'module');
  if (hasArt(mn)) {
    const s = sheet(mn);
    const f = e.state === 'work' ? 1 + ((Math.floor(time * (s.fps || 6)) + e.id) % Math.max(1, s.frames.length - 1)) : 0;
    ctx.drawImage(s.frames[f % s.frames.length], x, y);
    if (out) ctx.drawImage(itemIcon(out), x + 4, y + 6);
  } else {
    ctx.drawImage(sheet('module').frames[0], x, y);
    if (out) ctx.drawImage(itemIcon(out), x + 4, y + 4);
  }
}

/** Routes this short (tiles, centre to centre) show a pulse on the line, not skiff sprites. */
const SHORT_HOP = 2;

/** The skiffs: each route's skiffs spaced along its round trip (2 x distance / speed + dwell),
 *  half the dwell at each end; outbound with a crate of the item while the route carries; over a
 *  building at reduced alpha; on a short hop a pulse instead. */
function skiffs(ctx: CanvasRenderingContext2D, g: Game, time: number, vis: (x: number, y: number, w: number, h: number) => boolean, F: HighFloorId) {
  const st = g.s[F]!;
  const kind = carrier(F);
  const s = sheet(kind);
  const k = skiffStats(g, F);
  const dwell = k.dwell;
  for (const r of st.routes) {
    const e = routeEnds(g, r, F);
    if (!e) continue;
    const dist = routeDist(e.a, e.b);
    const travel = dist / k.speed;
    const T = 2 * travel + dwell;
    const busy = routeBusy(g, r);
    const n = Math.max(1, r.skiffs);
    // a short hop (2 tiles or less): no skiff sprites, which would sit on the two modules and hide
    // them (the second gate: ~100 routes into one Dock), but a pulse running down the line
    if (dist <= SHORT_HOP) {
      if (!busy) continue;
      for (let i = 0; i < Math.min(n, 3); i++) {
        const f = (((time / Math.max(0.5, travel) + i / Math.min(n, 3) + r.id * 0.37) % 1) + 1) % 1;
        const px = Math.round(e.ax + (e.bx - e.ax) * f), py = Math.round(e.ay + (e.by - e.ay) * f);
        if (!vis(px - 3, py - 3, 6, 6)) continue;
        ctx.fillStyle = C.ink;
        ctx.fillRect(px - 2, py - 2, 4, 4);
        ctx.fillStyle = C.lamp2;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
      continue;
    }
    for (let i = 0; i < n; i++) {
      const t = (((time + (i * T) / n + r.id * 0.37) % T) + T) % T;
      let f: number, out: boolean, moving = true;
      if (t < dwell / 2) { f = 0; out = true; moving = false; }
      else if (t < dwell / 2 + travel) { f = (t - dwell / 2) / travel; out = true; }
      else if (t < dwell + travel) { f = 1; out = false; moving = false; }
      else { f = 1 - (t - dwell - travel) / travel; out = false; }
      // they lift off and settle: lowest at the ends, a few px up in flight
      const lift = Math.round(Math.sin(Math.PI * f) * 4) + 3 + (moving ? Math.round(Math.sin(time * 6 + i) * 0.6) : 0);
      const px = Math.round(e.ax + (e.bx - e.ax) * f), py = Math.round(e.ay + (e.by - e.ay) * f) - lift;
      if (!vis(px - 8, py - 18, 16, 22)) continue;
      const left = out ? e.bx < e.ax : e.ax < e.bx;
      // over a building it goes see-through, so the module under it still reads
      const over = hentAt(g, F, Math.floor(px / TILE), Math.floor((py + lift) / TILE));
      ctx.globalAlpha = over ? 0.45 : 1;
      // its shadow on the deck
      ctx.fillStyle = rgba(C.ink, 0.25);
      ctx.fillRect(px - 4, py + lift + 1, 8, 1);
      const frame = Math.floor(time * (s.fps || 16)) + i;
      if (hasArt(kind)) drawSprite(ctx, s, frame, px, py, left);
      else { ctx.fillStyle = C.ink; ctx.fillRect(px - 6, py - 4, 12, 5); ctx.fillStyle = C.brass1; ctx.fillRect(px - 5, py - 3, 10, 3); }
      // loaded on the outbound leg (and loading at the source): the item rides on the deck (a
      // barge's hold sits a little higher: it is 12 px tall to the skiff's 10)
      if (out && busy) ctx.drawImage(itemIcon(r.item), px - 4, py - (kind === 'barge' ? 14 : 12));
      ctx.globalAlpha = 1;
    }
  }
}

/** Overdrive: a hot pulse over the case, a marching rim, embers; it blinks in its last 2 s. */
function moduleHot(ctx: CanvasRenderingContext2D, e: FEnt, time: number) {
  const x = e.x * TILE, y = e.y * TILE;
  const od = e.od ?? 0;
  if (od < 2 * TICK_RATE && Math.floor(time * 8) % 2) return;
  ctx.fillStyle = rgba(C.glow, 0.16 + 0.12 * Math.sin(time * 12 + e.id));
  ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
  if (hasArt('module_od')) {
    const s = sheet('module_od');
    ctx.drawImage(s.frames[(Math.floor(time * (s.fps || 8)) + e.id) % s.frames.length], x, y);
  }
  for (let i = 0; i < 3; i++) {
    const t = (time * 1.4 + i / 3 + e.id * 0.17) % 1;
    ctx.fillStyle = rgba(i % 2 ? C.hot : C.glow, 1 - t);
    ctx.fillRect(x + 3 + ((i * 5 + e.id) % 10), Math.round(y - 1 - t * 9), 1, 1);
  }
}

/** Cooling after Overdrive: a dim arc round the edge that shrinks as it cools. */
function coolArc(ctx: CanvasRenderingContext2D, x: number, y: number, cool: number) {
  const total = RULES.overdriveCool.value * TICK_RATE;
  const n = Math.round((2 * (TILE + TILE) - 4) * Math.min(1, cool / total));
  ctx.fillStyle = rgba(C.iron2, 0.9);
  for (let i = 0; i < n; i++) {
    let px: number, py: number;
    if (i < TILE) { px = i; py = 0; }
    else if (i < 2 * TILE - 1) { px = TILE - 1; py = i - TILE + 1; }
    else if (i < 3 * TILE - 2) { px = TILE - 1 - (i - (2 * TILE - 2)); py = TILE - 1; }
    else { px = 0; py = TILE - 1 - (i - (3 * TILE - 3)); }
    ctx.fillRect(x + px, y + py, 1, 1);
  }
}

function pip(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, blink: boolean, time: number, shape?: PipShape) {
  drawPip(ctx, x, y, col, blink, time, shape);
}

function outline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  const X = x * TILE, Y = y * TILE, Wd = w * TILE, Hd = h * TILE;
  ctx.fillRect(X - 1, Y - 1, Wd + 2, 1);
  ctx.fillRect(X - 1, Y + Hd, Wd + 2, 1);
  ctx.fillRect(X - 1, Y - 1, 1, Hd + 2);
  ctx.fillRect(X + Wd, Y - 1, 1, Hd + 2);
}

function antsBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, fill: string, time: number) {
  const X = x * TILE, Y = y * TILE, Wd = w * TILE, Hd = h * TILE;
  ctx.fillStyle = fill;
  ctx.fillRect(X, Y, Wd, Hd);
  const off = Math.floor(time * 12) % 4;
  ctx.fillStyle = col;
  for (let i = -off; i < Wd + 2; i += 4) {
    ctx.fillRect(X - 1 + Math.max(0, i), Y - 1, 2, 1);
    ctx.fillRect(X - 1 + Math.max(0, Wd + 1 - i - 1), Y + Hd, 2, 1);
  }
  for (let i = -off; i < Hd + 2; i += 4) {
    ctx.fillRect(X - 1, Y - 1 + Math.max(0, Hd + 1 - i - 1), 1, 2);
    ctx.fillRect(X + Wd, Y - 1 + Math.max(0, i), 1, 2);
  }
  ctx.fillStyle = C.brass1;
  for (const [cx, cy, sx, sy] of [[X - 2, Y - 2, 1, 1], [X + Wd + 1, Y - 2, -1, 1], [X - 2, Y + Hd + 1, 1, -1], [X + Wd + 1, Y + Hd + 1, -1, -1]]) {
    ctx.fillRect(Math.min(cx, cx + sx * 3), cy, 4, 1);
    ctx.fillRect(cx, Math.min(cy, cy + sy * 3), 1, 4);
  }
}

function bayMarks(ctx: CanvasRenderingContext2D, time: number, f: HighFloorId) {
  const b = HIGH[f].bay;
  const x = b.x * TILE, y = b.y * TILE;
  const on = Math.floor(time * 2) % 2 === 0;
  ctx.fillStyle = rgba(on ? C.lamp1 : C.ink, 0.6);
  for (let i = 0; i < 32; i += 4) {
    ctx.fillRect(x + i, y, 2, 1);
    ctx.fillRect(x + i, y + 31, 2, 1);
    ctx.fillRect(x, y + i, 1, 2);
    ctx.fillRect(x + 31, y + i, 1, 2);
  }
}

/** A slip of paper in world space with words in the ink their colour stands for. */
function label(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, col: string) {
  const w = textWidth(s) + 8;
  const x = Math.round(cx - w / 2);
  paperRaw(ctx, x, y - 1, w, 13, { deckle: false });
  drawText(ctx, s, x + 4, y + 1, onPaper(col));
}

/** The District fold's audit: the box with its countdown and the window's progress; each module's
 *  run share so far as a bar under it; gold once graded. */
function hauditBox(ctx: CanvasRenderingContext2D, g: Game, time: number, fl: HighFloorId) {
  const a = g.s.haudit;
  if (!a || a.floor !== fl) return;
  const b = a.box;
  const col = a.result ? C.gold : C.teal1;
  antsBox(ctx, b.x, b.y, b.w, b.h, col, rgba(col, 0.1), time);
  const warm = prules(g).auditWarmup * TICK_RATE;
  const total = warm + prules(g).auditWindow * TICK_RATE;
  const f = Math.min(1, a.t / total);
  ctx.fillStyle = C.ink;
  ctx.fillRect(b.x * TILE, b.y * TILE, b.w * TILE, 2);
  ctx.fillStyle = col;
  ctx.fillRect(b.x * TILE, b.y * TILE, Math.round(b.w * TILE * f), 2);
  const n = Math.max(1, a.t - warm);
  for (const id of a.ids) {
    const m = hent(g, fl, id);
    if (!m) continue;
    const run = a.t > warm ? Math.min(1, (a.run[id] ?? 0) / n) : 0;
    ctx.fillStyle = C.ink;
    ctx.fillRect(m.x * TILE + 2, m.y * TILE + 14, 12, 2);
    ctx.fillStyle = run >= 0.9 ? C.pipGreen : run >= 0.6 ? C.pipYellow : C.pipRed;
    if (a.t > warm) ctx.fillRect(m.x * TILE + 2, m.y * TILE + 14, Math.max(1, Math.round(12 * run)), 1);
  }
}

/** The drag box as x, y, w, h. */
export function boxOf(b: { x0: number; y0: number; x1: number; y1: number }): Box {
  return { x: Math.min(b.x0, b.x1), y: Math.min(b.y0, b.y1), w: Math.abs(b.x1 - b.x0) + 1, h: Math.abs(b.y1 - b.y0) + 1 };
}

/** The items a route from `a` to `b` could carry: what a makes that b takes. */
export function routeItems(g: Game, a: FEnt, b: FEnt, f: HighFloorId = 'district'): ItemId[] {
  const d = g.design(a.design);
  if (!d || a.kind !== 'module') return [];
  return (Object.keys(d.outs) as ItemId[]).filter((it) => takes(g, f, b, it));
}

function overlays(ctx: CanvasRenderingContext2D, g: Game, ov: DistrictOverlay, time: number, F: HighFloorId) {
  if (ov.selected) {
    const e = hent(g, F, ov.selected);
    if (e) outline(ctx, e.x, e.y, e.w, e.h, C.gold);
  }
  if (ov.box) {
    const b = boxOf(ov.box);
    const ok = !hfoldRefusal(g, F, b);
    const col = ok ? C.pipGreen : C.pipRed;
    antsBox(ctx, b.x, b.y, b.w, b.h, col, rgba(col, 0.14), time);
    label(ctx, `${b.w}x${b.h}`, (b.x + b.w / 2) * TILE, b.y > 0 ? b.y * TILE - 14 : (b.y + b.h) * TILE + 3, col);
    return;
  }
  const h = ov.hover;
  if (ov.route) {
    // the Route tool: its source in gold, a rubber band to the mouse, the destination green or red
    const src = ov.from ? hentAt(g, F, ov.from.x, ov.from.y) : null;
    if (src) {
      outline(ctx, src.x, src.y, src.w, src.h, C.lamp2);
      const sx = (src.x + src.w / 2) * TILE, sy = (src.y + src.h / 2) * TILE;
      const to = h ? hentAt(g, F, h.x, h.y) : null;
      if (to && to !== src) {
        const ok = routeItems(g, src, to, F).length > 0;
        const col = ok ? C.pipGreen : C.pipRed;
        outline(ctx, to.x, to.y, to.w, to.h, col);
        flightLine(ctx, sx, sy, (to.x + to.w / 2) * TILE, (to.y + to.h / 2) * TILE, col, time, true, 1);
      } else if (h) flightLine(ctx, sx, sy, (h.x + 0.5) * TILE, (h.y + 0.5) * TILE, C.bone, time, true, 0.8);
    } else if (h) {
      const e = hentAt(g, F, h.x, h.y);
      if (e) outline(ctx, e.x, e.y, e.w, e.h, e.kind === 'module' ? C.lamp2 : rgba(C.bone, 0.5));
    }
    return;
  }
  if (!h) return;
  if (ov.place !== null) {
    const why = hplaceRefusal(g, F, ov.place, h.x, h.y);
    const ok = !why;
    ctx.globalAlpha = 0.6;
    const mn = hart(F, 'module');
    const s = hasArt(mn) ? sheet(mn) : sheet('module');
    ctx.drawImage(s.frames[0], h.x * TILE, h.y * TILE);
    const out = mainOutput(g, ov.place);
    if (out) ctx.drawImage(itemIcon(out), h.x * TILE + 4, h.y * TILE + (hasArt(mn) ? 6 : 4));
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(ok ? C.pipGreen : C.pipRed, 0.25);
    ctx.fillRect(h.x * TILE, h.y * TILE, TILE, TILE);
    outline(ctx, h.x, h.y, 1, 1, ok ? C.pipGreen : C.pipRed);
    return;
  }
  const e = hentAt(g, F, h.x, h.y);
  if (ov.remove) {
    if (e) {
      const ok = e.kind === 'module';
      ctx.fillStyle = rgba(ok ? C.pipRed : C.fog, 0.35);
      ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
      outline(ctx, e.x, e.y, e.w, e.h, ok ? C.pipRed : C.fog);
    }
    return;
  }
  const odReady = e?.kind === 'module' && g.done('overdrive') && !(e.od ?? 0) && !(e.cool ?? 0);
  if (e && odReady) {
    outline(ctx, e.x, e.y, e.w, e.h, rgba(C.glow, 0.6 + 0.4 * Math.sin(time * 10)));
    label(ctx, '3x', (e.x + 0.5) * TILE, e.y * TILE - 13, C.hot);
  } else if (e) outline(ctx, e.x, e.y, e.w, e.h, rgba(C.bone, 0.7));
  else if (h.x >= 0 && h.y >= 0 && h.x < highW(g, F) && h.y < HIGH[F].h && ov.hoverRoute === null) {
    ctx.fillStyle = rgba(C.bone, 0.12);
    ctx.fillRect(h.x * TILE, h.y * TILE, TILE, TILE);
  }
}
