// The Factory floor's drawing (DESIGN.md §11, §18): a 12x8 hall of steel plates, trunk belts with
// items streaming along them at their measured flow (byproducts on their side routes too),
// modules (the module case with its main output in the well, a glow while it runs, the status
// pip; depth-2 modules in a doubled frame), the Factory Dock and Hopper, the Megaproject Bay
// growing its drill stage by stage, and the nested-fold boxes (dragged, and audited with a
// countdown). Reads the Game; never writes it. World pixels; the Renderer sets the camera.
import { C, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import { DX, DY, ccw, cw, opposite, type Dir, type FEnt } from '../sim/world';
import { ANNEX, FACTORY } from '../data/land';
import { annexPrice } from '../sim/systems/annex'; // the review round: the Factory annex
import { RULES } from '../data/rules';
import { prules } from '../sim/patents'; // Milestone 5: the Patent rules (More Auditors, Quick Audits)
import { megaStage } from '../data/megaprojects';
import { ITEMS, type ItemId } from '../data/items';
import { BYPRODUCTS } from '../sim/systems/modules';
import { drawText, textWidth } from '../ui/font';
import { TICK_RATE } from '../engine/time';
import { sheet, drawRot, frameAt, itemIcon, hasArt } from './sprites';
import { TILE } from './ground';

const PIP: Record<string, string> = { work: C.pipGreen, starved: C.pipYellow, blocked: C.pipRed, idle: C.pipGrey };

export interface FactoryOverlay {
  hover: { x: number; y: number } | null;
  /** placing: a trunk, or a module design */
  place: { kind: 'trunk' } | { kind: 'module'; design: number } | null;
  rot: Dir;
  drag: { x: number; y: number; rot: Dir }[] | null;
  remove: boolean;
  selected: number | null;
  /** a nested-fold box being dragged (tile rect, inclusive corners) */
  box: { x0: number; y0: number; x1: number; y1: number; ok: boolean } | null;
}

/** The main output of a design: the item drawn in a module's well. */
export function mainOutput(g: Game, design: number): ItemId | null {
  const d = g.design(design);
  if (!d) return null;
  let best: ItemId | null = null, bv = -1;
  for (const [k, r] of Object.entries(d.outs) as [ItemId, number][]) {
    const v = r * Math.max(0.01, ITEMS[k].value);
    if (!BYPRODUCTS.has(k) && v > bv) { bv = v; best = k; }
  }
  return best ?? ((Object.keys(d.outs)[0] as ItemId) || null);
}

/** How far the Megaproject's current stage has got (0..1; 1 once every stage so far is done). */
export function megaFrac(g: Game): number {
  const st = megaStage(g.s.mega.stage);
  if (!st) return g.s.mega.stage > 0 ? 1 : 0;
  let have = 0, need = 0;
  for (const [k, n] of Object.entries(st.wants) as [ItemId, number][]) {
    need += n;
    have += Math.min(n, g.s.mega.progress[k]?.toNumber() ?? 0);
  }
  return need ? have / need : 0;
}

/** The mega_bay frame to show: empty, then stage1-3 by progress; once stage 1 is done the drill
 * runs (run1/run2 in turn). Frame names: empty, stage1, stage2, stage3, run1, run2. */
export function bayFrame(g: Game, time: number): number {
  if (g.s.mega.stage >= 1) return 4 + (Math.floor(time * 6) % 2);
  const f = megaFrac(g);
  return f <= 0 ? 0 : f < 1 / 3 ? 1 : f < 2 / 3 ? 2 : 3;
}

/** For each trunk fed from a side (a turn), which side: -1 left, 1 right. */
function turnOf(g: Game, t: FEnt): -1 | 1 | 0 {
  const back = opposite(t.rot);
  const behind = g.fentAt(t.x + DX[back], t.y + DY[back]);
  if (behind && feedsInto(behind, t)) return 0;
  for (const side of [-1, 1] as const) {
    const d = ((t.rot + (side === -1 ? 3 : 1)) % 4) as Dir;
    const n = g.fentAt(t.x + DX[d], t.y + DY[d]);
    if (n && feedsInto(n, t)) return side;
  }
  return 0;
}

function feedsInto(a: FEnt, b: FEnt): boolean {
  if (a.kind !== 'trunk' && a.kind !== 'module') return false;
  return a.x + DX[a.rot] === b.x && a.y + DY[a.rot] === b.y;
}

/** `viewRight`: the view's right edge in world px, so the annex block's label slides into view
 * while its outline is cut by the screen edge (the Milestone 5-6 final round, 1024x640). */
export function drawFactory(ctx: CanvasRenderingContext2D, g: Game, time: number, ov: FactoryOverlay, viewRight = Infinity) {
  // the annex (DESIGN.md §19, the Milestone 5-6 review round): the hall grows east by the blocks bought
  const W = g.fw, H = g.fh;
  // the hall: a shadow, a riveted wall, then the floor plates
  ctx.fillStyle = rgba(C.ink, 0.6);
  ctx.fillRect(4, 4, W * TILE, H * TILE);
  ctx.fillStyle = C.hull0;
  ctx.fillRect(-3, -3, W * TILE + 6, H * TILE + 6);
  ctx.fillStyle = C.brass0;
  ctx.fillRect(-2, -2, W * TILE + 4, 1);
  for (let x = 0; x < W * TILE; x += 16) ctx.fillRect(x + 7, -3, 2, 2);
  const floor = sheet('tile_factory');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!floor.placeholder) ctx.drawImage(floor.frames[(x + y) % floor.frames.length], x * TILE, y * TILE);
      else {
        ctx.fillStyle = (x + y) % 2 ? C.hull1 : C.hull0;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  // the annex: a brass seam where the bought blocks meet the 12x8, and the next block for sale
  // outlined beyond the wall with its price (Upgrades sells it)
  if (W > FACTORY.w) {
    ctx.fillStyle = rgba(C.brass0, 0.5);
    for (let y = 0; y < H * TILE; y += 4) ctx.fillRect(FACTORY.w * TILE, y, 1, 2);
  }
  const next = annexPrice(g);
  if (next && g.done(ANNEX.requires)) {
    const ax = W * TILE + 4, aw = ANNEX.cols * TILE;
    antsBox(ctx, W + 4 / TILE, 0, ANNEX.cols, H, rgba(C.bone, 0.45), rgba(C.bone, 0.04), time);
    const lw = Math.max(textWidth('annex'), textWidth(next.format())) + 6;
    const cx = viewRight > ax + 4 ? Math.max(ax + 4 - lw / 2, Math.min(ax + aw / 2, viewRight - lw / 2 - 2)) : ax + aw / 2;
    label(ctx, 'annex', cx, H * TILE / 2 - 12, C.bone);
    label(ctx, next.format(), cx, H * TILE / 2 + 2, C.brass0);
  }
  // the Bay's corner, marked on the floor until the Bay stands there
  if (g.done('greatDrill') && !g.s.factory.ents.some((e) => e.kind === 'fbay')) bayMarks(ctx, time);
  const ents = g.s.factory.ents;
  // trunks, flat on the floor, then the items they carry
  for (const t of ents) {
    if (t.kind !== 'trunk') continue;
    const turn = turnOf(g, t);
    const running = t.flow > 0.05;
    if (turn) {
      const s = sheet('trunk_turn');
      drawRot(ctx, s, running ? frameAt(s, time) : 0, t.x * TILE, t.y * TILE, t.rot, turn === 1);
    } else {
      const s = sheet('trunk');
      drawRot(ctx, s, running ? frameAt(s, time) : 0, t.x * TILE, t.y * TILE, t.rot);
    }
  }
  for (const t of ents) if (t.kind === 'trunk' && t.flow > 0.05) trunkItems(ctx, g, t, time);
  // modules and the fixed buildings
  for (const e of ents) {
    const x = e.x * TILE, y = e.y * TILE;
    if (e.kind === 'fdock' || e.kind === 'fhopper') {
      const s = sheet(e.kind === 'fdock' ? 'factory_dock' : 'factory_hopper');
      const ss = s.placeholder ? sheet(e.kind === 'fdock' ? 'dock' : 'hopper') : s;
      ctx.drawImage(ss.frames[frameAt(ss, time)], x, y);
      continue;
    }
    if (e.kind === 'fbay') {
      drawBay(ctx, g, e, time);
      continue;
    }
    if (e.kind !== 'module') continue;
    const d = g.design(e.design);
    const deep = d?.depth === 2;
    if (deep) doubleFrame(ctx, x, y, time, e.state === 'work');
    const s = sheet('module');
    drawRot(ctx, s, 0, x, y, 0);
    const out = mainOutput(g, e.design);
    // the well shows what it makes; it bobs a pixel while running
    if (out) ctx.drawImage(itemIcon(out), x + 4, y + 4 - (e.state === 'work' && Math.floor(time * 4 + e.id) % 2 ? 1 : 0));
    if ((e.state === 'work' || deep) && hasArt('module_glow')) {
      const gl = sheet('module_glow');
      if (deep && e.state !== 'work') ctx.globalAlpha = 0.5;
      ctx.drawImage(gl.frames[frameAt(gl, time + e.id * 0.3)], x, y);
      ctx.globalAlpha = 1;
    }
    // its front: a brass chevron on the output side; its back: teal
    const cx = x + 8 + DX[e.rot] * 7, cy = y + 8 + DY[e.rot] * 7;
    ctx.fillStyle = C.gold;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
    const bx = x + 8 - DX[e.rot] * 7, by = y + 8 - DY[e.rot] * 7;
    ctx.fillStyle = rgba(C.teal1, 0.8);
    ctx.fillRect(bx - 1, by - 1, 2, 2);
    // a byproduct side route: a violet mark where slag or oil leaves
    for (const side of [ccw(e.rot), cw(e.rot)]) {
      const t = g.fentAt(e.x + DX[side], e.y + DY[side]);
      if (t && t.kind === 'trunk' && t.rot === side) {
        ctx.fillStyle = C.violet;
        ctx.fillRect(x + 8 + DX[side] * 7 - 1, y + 8 + DY[side] * 7 - 1, 2, 2);
      }
    }
    // depth 2: two gold dots in the bottom-left corner
    if (deep) {
      ctx.fillStyle = C.gold;
      ctx.fillRect(x + 2, y + 12, 1, 2);
      ctx.fillRect(x + 4, y + 12, 1, 2);
    }
    // Overdrive (DESIGN.md §18): running hot, then a cooling arc
    if ((e.od ?? 0) > 0) moduleHot(ctx, e, time);
    else if ((e.cool ?? 0) > 0) coolArc(ctx, x, y, e.cool ?? 0);
    pip(ctx, x, y, PIP[e.state], e.state === 'blocked', time);
  }
  fauditBox(ctx, g, time);
  overlays(ctx, g, ov, time);
}

/** A module running at 3x: a hot pulse over the case, the art director's 'module_od' overlay
 *  (or a marching hot-and-gold rim drawn here), embers rising off it; it blinks in its last 2 s. */
function moduleHot(ctx: CanvasRenderingContext2D, e: FEnt, time: number) {
  const x = e.x * TILE, y = e.y * TILE;
  const od = e.od ?? 0;
  if (od < 2 * TICK_RATE && Math.floor(time * 8) % 2) return;
  ctx.fillStyle = rgba(C.glow, 0.16 + 0.12 * Math.sin(time * 12 + e.id));
  ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
  if (hasArt('module_od')) {
    const s = sheet('module_od');
    ctx.drawImage(s.frames[(Math.floor(time * (s.fps || 8)) + e.id) % s.frames.length], x, y);
  } else {
    // a rim one pixel outside the case: hot and gold dashes marching round it
    const P = 4 * (TILE + 1);
    const off = Math.floor(time * 16);
    for (let i = 0; i < P; i++) {
      let px: number, py: number;
      if (i < TILE + 1) { px = x - 1 + i; py = y - 1; }
      else if (i < 2 * (TILE + 1)) { px = x + TILE; py = y - 1 + (i - TILE - 1); }
      else if (i < 3 * (TILE + 1)) { px = x + TILE - (i - 2 * (TILE + 1)); py = y + TILE; }
      else { px = x - 1; py = y + TILE - (i - 3 * (TILE + 1)); }
      const k = (i + off) % 6;
      ctx.fillStyle = k < 2 ? C.hot : k < 4 ? C.gold : C.copper2;
      ctx.fillRect(px, py, 1, 1);
    }
  }
  // embers rising off the top, each on its own clock
  for (let i = 0; i < 3; i++) {
    const t = (time * 1.4 + i / 3 + e.id * 0.17) % 1;
    ctx.fillStyle = rgba(i % 2 ? C.hot : C.glow, 1 - t);
    ctx.fillRect(x + 3 + ((i * 5 + e.id) % 10), Math.round(y - 1 - t * 9), 1, 1);
  }
}

/** A module cooling after Overdrive: a dim arc round its edge that shrinks as it cools. */
function coolArc(ctx: CanvasRenderingContext2D, x: number, y: number, cool: number) {
  const total = RULES.overdriveCool.value * TICK_RATE;
  const frac = Math.min(1, cool / total);
  const W = TILE, H = TILE;
  const P = 2 * (W + H) - 4;
  const n = Math.round(P * frac);
  ctx.fillStyle = rgba(C.iron2, 0.9);
  // clockwise from the top-left corner
  for (let i = 0; i < n; i++) {
    let px: number, py: number;
    if (i < W) { px = i; py = 0; }
    else if (i < W + H - 1) { px = W - 1; py = i - W + 1; }
    else if (i < 2 * W + H - 2) { px = W - 1 - (i - (W + H - 2)); py = H - 1; }
    else { px = 0; py = H - 1 - (i - (2 * W + H - 3)); }
    ctx.fillRect(x + px, y + py, 1, 1);
  }
}

/** A depth-2 module's doubled frame: a teal ring outside the case with brass corners, breathing
 * while it runs. */
function doubleFrame(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, on: boolean) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - 2, y - 2, TILE + 4, TILE + 4);
  ctx.fillStyle = on && Math.floor(time * 3) % 2 ? C.teal1 : C.teal0;
  ctx.fillRect(x - 1, y - 1, TILE + 2, 1);
  ctx.fillRect(x - 1, y + TILE, TILE + 2, 1);
  ctx.fillRect(x - 1, y - 1, 1, TILE + 2);
  ctx.fillRect(x + TILE, y - 1, 1, TILE + 2);
  ctx.fillStyle = C.gold;
  for (const [a, b] of [[-1, -1], [TILE, -1], [-1, TILE], [TILE, TILE]]) ctx.fillRect(x + a, y + b, 1, 1);
}

/** The Megaproject Bay: its art by stage, a progress strip on the pad's front until the drill
 * runs, then glow pulses. */
function drawBay(ctx: CanvasRenderingContext2D, g: Game, e: FEnt, time: number) {
  const x = e.x * TILE, y = e.y * TILE;
  const s = sheet('mega_bay');
  if (hasArt('mega_bay')) ctx.drawImage(s.frames[bayFrame(g, time)], x, y);
  else {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = C.iron0;
    ctx.fillRect(x + 1, y + 1, 30, 30);
    ctx.fillStyle = C.hull2;
    ctx.fillRect(x + 4, y + 8, 24, 20);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? C.ink : C.pipYellow;
      ctx.fillRect(x + 4 + i * 3, y + 27, 3, 2);
    }
  }
  if (g.s.mega.stage >= 1) {
    // the drill runs: a hot glow breathing out of the pit
    const k = 0.2 + 0.15 * Math.sin(time * 5);
    ctx.fillStyle = rgba(C.hot, k);
    ctx.fillRect(x + 10, y + 18, 12, 8);
    return;
  }
  const f = megaFrac(g);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 3, y + 29, 26, 3);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x + 4, y + 30, Math.round(24 * f), 1);
  // something just arrived: a brief sparkle over the pad
  const fresh = Object.values(e.inBuf).some((v) => v > 0.01);
  if (fresh && Math.floor(time * 8) % 2) {
    ctx.fillStyle = C.bone;
    ctx.fillRect(x + 15, y + 14, 2, 2);
  }
}

/** Hazard corners where the Bay will stand, while something is in its way. */
function bayMarks(ctx: CanvasRenderingContext2D, time: number) {
  const b = FACTORY.bay;
  const x = b.x * TILE, y = b.y * TILE;
  const on = Math.floor(time * 2) % 2 === 0;
  ctx.fillStyle = rgba(on ? C.pipYellow : C.ink, 0.5);
  for (let i = 0; i < 32; i += 4) {
    ctx.fillRect(x + i, y, 2, 1);
    ctx.fillRect(x + i, y + 31, 2, 1);
    ctx.fillRect(x, y + i, 1, 2);
    ctx.fillRect(x + 31, y + i, 1, 2);
  }
}

/** The items a trunk tile carries: its routes' outputs (byproducts on side routes). */
function trunkCarries(g: Game, t: FEnt): ItemId[] {
  const out: ItemId[] = [];
  for (const r of g.routes) {
    if (!r.tiles.includes(t)) continue;
    const d = g.design(r.from.design);
    if (!d) continue;
    const side = g.routes.some((q) => q.from === r.from && q.by && q.to);
    for (const k of Object.keys(d.outs) as ItemId[]) {
      const by = BYPRODUCTS.has(k);
      if (r.by ? by : !by || !side) if (!out.includes(k)) out.push(k);
    }
  }
  return out;
}

/** Items streaming along a trunk: spacing from the flow (8/s = packed), scrolling at trunk speed. */
function trunkItems(ctx: CanvasRenderingContext2D, g: Game, t: FEnt, time: number) {
  const items = trunkCarries(g, t);
  if (!items.length) return;
  const per = Math.max(1, Math.min(4, Math.round((t.flow / FACTORY.trunkSpeed) * 4)));
  const speed = FACTORY.trunkSpeed / 4; // tiles per second, drawn: slower than the rate reads better
  for (let i = 0; i < per; i++) {
    const raw = time * speed + i / per + (t.x + t.y) * 0.37;
    const p = ((raw % 1) + 1) % 1;
    // which of its items this one is: steps along with the scroll so they take turns
    const item = items[(Math.floor(raw) * per + i) % items.length];
    const fx = t.x * TILE + 8 + DX[t.rot] * (p - 0.5) * TILE, fy = t.y * TILE + 8 + DY[t.rot] * (p - 0.5) * TILE;
    ctx.drawImage(itemIcon(item), Math.round(fx - 4), Math.round(fy - 4));
  }
}

function pip(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, blink: boolean, time: number) {
  if (blink && Math.floor(time * 3) % 2) col = C.rust;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 11, y, 5, 5);
  ctx.fillStyle = col;
  ctx.fillRect(x + 12, y + 1, 3, 3);
  ctx.fillStyle = rgba(C.bone, 0.6);
  ctx.fillRect(x + 12, y + 1, 1, 1);
}

function outline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  const X = x * TILE, Y = y * TILE, Wd = w * TILE, Hd = h * TILE;
  ctx.fillRect(X - 1, Y - 1, Wd + 2, 1);
  ctx.fillRect(X - 1, Y + Hd, Wd + 2, 1);
  ctx.fillRect(X - 1, Y - 1, 1, Hd + 2);
  ctx.fillRect(X + Wd, Y - 1, 1, Hd + 2);
}

/** A fold box: a tinted fill, marching ants and brass corner brackets (the Workshop's look). */
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

/** A pill of text in world space above a tile rect. */
function label(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, col: string) {
  const w = textWidth(s) + 6;
  const x = Math.round(cx - w / 2);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x, y, w, 11);
  ctx.fillStyle = C.shadow;
  ctx.fillRect(x + 1, y + 1, w - 2, 9);
  drawText(ctx, s, x + 3, y + 1, col);
}

/** The nested-fold audit under way: the box in teal with its countdown, and each module's run
 * share so far as a little bar under it; gold with the grade once it is done. */
function fauditBox(ctx: CanvasRenderingContext2D, g: Game, time: number) {
  const a = g.s.faudit;
  if (!a) return;
  const b = a.box;
  const col = a.result ? C.gold : C.teal1;
  antsBox(ctx, b.x, b.y, b.w, b.h, col, rgba(col, 0.1), time);
  const warm = prules(g).auditWarmup * TICK_RATE; // Quick Audits (§19)
  const total = warm + prules(g).auditWindow * TICK_RATE;
  const s = a.result ? `Graded ${a.result.grade.letter}` : a.t < warm ? `warming ${Math.ceil((total - a.t) / TICK_RATE)}s` : `${Math.ceil((total - a.t) / TICK_RATE)}s`;
  const ly = b.y > 0 ? b.y * TILE - 14 : (b.y + b.h) * TILE + 3;
  label(ctx, s, (b.x + b.w / 2) * TILE, ly, col);
  // the window's progress along the box's top edge
  const f = Math.min(1, a.t / total);
  ctx.fillStyle = C.ink;
  ctx.fillRect(b.x * TILE, b.y * TILE, b.w * TILE, 2);
  ctx.fillStyle = col;
  ctx.fillRect(b.x * TILE, b.y * TILE, Math.round(b.w * TILE * f), 2);
  const n = Math.max(1, a.t - warm);
  for (const id of a.ids) {
    const m = g.fById.get(id);
    if (!m) continue;
    const run = a.t > warm ? Math.min(1, (a.run[id] ?? 0) / n) : 0;
    ctx.fillStyle = C.ink;
    ctx.fillRect(m.x * TILE + 2, m.y * TILE + 14, 12, 2);
    ctx.fillStyle = run >= 0.9 ? C.pipGreen : run >= 0.6 ? C.pipYellow : C.pipRed;
    if (a.t > warm) ctx.fillRect(m.x * TILE + 2, m.y * TILE + 14, Math.max(1, Math.round(12 * run)), 1);
  }
}

function overlays(ctx: CanvasRenderingContext2D, g: Game, ov: FactoryOverlay, time: number) {
  if (ov.selected) {
    const e = g.fById.get(ov.selected);
    if (e) outline(ctx, e.x, e.y, e.w, e.h, C.gold);
  }
  // the nested-fold box being dragged: green when it can be audited, red when not
  if (ov.box) {
    const x0 = Math.min(ov.box.x0, ov.box.x1), y0 = Math.min(ov.box.y0, ov.box.y1);
    const w = Math.abs(ov.box.x1 - ov.box.x0) + 1, h = Math.abs(ov.box.y1 - ov.box.y0) + 1;
    const col = ov.box.ok ? C.pipGreen : C.pipRed;
    antsBox(ctx, x0, y0, w, h, col, rgba(col, 0.14), time);
    label(ctx, `${w}x${h}`, (x0 + w / 2) * TILE, y0 > 0 ? y0 * TILE - 14 : (y0 + h) * TILE + 3, col);
    return;
  }
  const ghost = (x: number, y: number, rot: Dir, kind: 'trunk' | 'module', design = 0) => {
    const e = g.fentAt(x, y);
    const ok = x >= 0 && y >= 0 && x < g.fw && y < g.fh && (!e || (kind === 'trunk' && e.kind === 'trunk'));
    ctx.globalAlpha = 0.6;
    if (kind === 'trunk') drawRot(ctx, sheet('trunk'), 0, x * TILE, y * TILE, rot);
    else {
      drawRot(ctx, sheet('module'), 0, x * TILE, y * TILE, 0);
      const out = mainOutput(g, design);
      if (out) ctx.drawImage(itemIcon(out), x * TILE + 4, y * TILE + 4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(ok ? C.pipGreen : C.pipRed, 0.25);
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    outline(ctx, x, y, 1, 1, ok ? C.pipGreen : C.pipRed);
    const cx = x * TILE + 8 + DX[rot] * 9, cy = y * TILE + 8 + DY[rot] * 9;
    ctx.fillStyle = ok ? C.bone : C.pipRed;
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
  };
  if (ov.drag) {
    for (const d of ov.drag) ghost(d.x, d.y, d.rot, 'trunk');
    return;
  }
  const h = ov.hover;
  if (!h) return;
  if (ov.place) ghost(h.x, h.y, ov.rot, ov.place.kind, ov.place.kind === 'module' ? ov.place.design : 0);
  else if (ov.remove) {
    const e = g.fentAt(h.x, h.y);
    if (e) {
      const ok = e.kind === 'module' || e.kind === 'trunk';
      ctx.fillStyle = rgba(ok ? C.pipRed : C.fog, 0.35);
      ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
      outline(ctx, e.x, e.y, e.w, e.h, ok ? C.pipRed : C.fog);
    }
  } else {
    const e = g.fentAt(h.x, h.y);
    // a module Overdrive can run hot: a pulsing hot frame says "click me"
    const odReady = e?.kind === 'module' && g.done('overdrive') && !(e.od ?? 0) && !(e.cool ?? 0);
    if (e && odReady) {
      outline(ctx, e.x, e.y, e.w, e.h, rgba(C.glow, 0.6 + 0.4 * Math.sin(time * 10)));
      label(ctx, '3x', (e.x + 0.5) * TILE, e.y * TILE - 13, C.hot);
    } else if (e) outline(ctx, e.x, e.y, e.w, e.h, rgba(C.bone, 0.7));
    else if (h.x >= 0 && h.y >= 0 && h.x < g.fw && h.y < g.fh) {
      ctx.fillStyle = rgba(C.bone, 0.12);
      ctx.fillRect(h.x * TILE, h.y * TILE, TILE, TILE);
    }
  }
}
