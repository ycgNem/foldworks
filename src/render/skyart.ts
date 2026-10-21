// The sky island's art by contract name (docs/sky-island.md, Art contract): the art director's
// strip from src/art/ when it is there (hasArt), else a code-drawn fallback in the palette, cut
// into the same frame sizes and frame orders, so the drawing code never cares which it got.
// Fallbacks are pixel art: whole pixels, hard edges, palette colours only, no blur or smoothing.
// Each is made once and cached. Frame orders (the contract):
//   tile_pave 4+ variants · tile_pave_seam N E S W · tile_grass 4+ · tile_grass_deco 8+
//   tile_pave_edge N E S W (grass in the grout where paving meets land you don't own) ·
//   tile_plot NW N NE W (none) E SW S SE · isle_edge / fplat_edge by mask N=1 E=2 S=4 W=8 (land
//   there), a whole tile that replaces the grass (or deck) on the rim's boundary tiles, clear
//   where the sky shows · isle_cliff top x4, mid x4, low x4 (one 64 px strip: variant = world
//   tile x mod 4) · isle_vein names iron0..3 copper0..3 coal0..3 sand0..3 · isle_under fill x4,
//   bottom x4, left slope x4, right slope x4 (variant x mod 4) · isle_under_deco 8 overlays on
//   its fill · isle_tip 48x32 (anchor at its top centre) · isle_fall_top 16x16 x4 (the spring on
//   the lip tile) · isle_fall_head 16x16 x4 (the bow over the lip) · isle_fall 16x32 x4
//   (tiles vertically) · isle_fall_foam 32x16 x4 · sky_cloud 64x32 big x2, medium x2, small x2 ·
//   sky_islet 64x48 x4 · sky_bird 8x8 x4 · prop_tree 32x32 x4 (anchor at the trunk foot) ·
//   prop_bush 16x16 x4 · prop_fence h, v, post, gate · fplat_under face left, face, face right,
//   truss left, truss, truss right · fplat_rotor 48x24 x4.
import { C } from '../data/palette';
import { hasArt, sheet } from './sprites';

export interface Art {
  frames: HTMLCanvasElement[];
  w: number;
  h: number;
  /** the pixel of a frame that sits on its world point */
  ax: number;
  ay: number;
  fps: number;
  /** frame names (isle_vein), when the sheet has them */
  names?: string[];
  /** imported art, not the fallback */
  real: boolean;
}

const cache = new Map<string, Art>();

/** The frames for a contract name: imported art, else the fallback (both cached). */
export function art(name: string): Art {
  const real = hasArt(name);
  const got = cache.get(name);
  if (got && got.real === real) return got;
  let a: Art;
  if (real) {
    const s = sheet(name);
    a = { frames: s.frames, w: s.w, h: s.h, ax: s.ax, ay: s.ay, fps: s.fps, names: s.order, real: true };
  } else {
    const f = FALLBACK[name];
    a = f ? f() : { frames: [canvas(16, 16)], w: 16, h: 16, ax: 0, ay: 0, fps: 0, real: false };
  }
  cache.set(name, a);
  return a;
}

/** A frame by its sidecar name (isle_vein: 'iron2'), or null when the sheet has no such frame. */
export function named(a: Art, n: string): HTMLCanvasElement | null {
  const i = a.names ? a.names.indexOf(n) : -1;
  return i >= 0 ? a.frames[i] ?? null : null;
}

/** A bit mask of which contract names have imported art: the bakes key on it, so art that loads
 *  later (or is dropped in while the dev server runs) rebakes them. */
export function artSig(names: readonly string[]): number {
  let m = 0;
  for (let i = 0; i < names.length; i++) if (hasArt(names[i])) m |= 1 << i;
  return m;
}

// ---------------------------------------------------------------- helpers

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** deterministic hash in [0, 1) */
export function hh(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

type Px = (col: string, x: number, y: number, w?: number, h?: number) => void;
interface Pen { p: Px; clear: (x: number, y: number, w?: number, h?: number) => void; ctx: CanvasRenderingContext2D }

function pen(c: HTMLCanvasElement): Pen {
  const ctx = c.getContext('2d')!;
  return {
    ctx,
    p: (col, x, y, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); },
    clear: (x, y, w = 1, h = 1) => ctx.clearRect(x, y, w, h),
  };
}

function frames(w: number, h: number, n: number, draw: (q: Pen, f: number) => void): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < n; f++) {
    const c = canvas(w, h);
    draw(pen(c), f);
    out.push(c);
  }
  return out;
}

const mk = (fr: HTMLCanvasElement[], w: number, h: number, ax = 0, ay = 0, fps = 0, names?: string[]): Art => ({ frames: fr, w, h, ax, ay, fps, names, real: false });

/** A 0/1 wobble along a 16 px edge, 0 at both ends so neighbouring tiles join. */
function wobble(seed: number): number[] {
  const out: number[] = [];
  let on = 0;
  for (let i = 0; i < 16; i++) {
    if (i === 0 || i === 15) { out.push(0); on = 0; continue; }
    if (hh(seed, i, 3) < 0.3) on = 1 - on;
    out.push(i >= 14 ? 0 : on);
  }
  return out;
}

/** Shapes made of circles (clouds, puffs, canopies): is (x, y) inside any? */
function inCircles(cs: number[][], x: number, y: number, bottom = Infinity): boolean {
  if (y > bottom) return false;
  for (const [cx, cy, r] of cs) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

// ---------------------------------------------------------------- ground

/** The meadow: bright grass with a few blades, calm enough to tile big. */
function grassTile(q: Pen, v: number) {
  const { p } = q;
  p(C.grass2, 0, 0, 16, 16);
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(hh(v, i, 11) * 16), y = 1 + Math.floor(hh(v, i, 12) * 14);
    p(C.grass1, x, y, 1, 1);
    if (hh(v, i, 13) < 0.6) p(C.grass3, x, y - 1, 1, 1);
  }
  for (let i = 0; i < 3; i++) p(C.grass3, Math.floor(hh(v, i, 14) * 16), Math.floor(hh(v, i, 15) * 16), 1, 1);
  // a two-blade tuft
  const tx = 2 + Math.floor(hh(v, 1, 16) * 11), ty = 3 + Math.floor(hh(v, 1, 17) * 10);
  p(C.grass1, tx, ty + 1, 3, 1);
  p(C.grass3, tx, ty, 1, 1);
  p(C.grass3, tx + 2, ty - 1, 1, 2);
}

/** Warm paving slabs with grout lines: one slab, two halves either way, or four setts. */
function paveTile(q: Pen, v: number) {
  const { p } = q;
  // mostly whole slabs: a split one (in the lighter grout) one time in four
  p(C.pave2, 0, 0, 16, 16);
  p(C.pave0, 0, 0, 16, 1);
  p(C.pave0, 0, 0, 1, 16);
  const slabs: number[][] = v % 4 === 3 ? [[1, 1, 7, 15], [9, 1, 7, 15]] : [[1, 1, 15, 15]];
  if (v % 4 === 3) p(C.pave1, 8, 1, 1, 15);
  for (const [x, y, w, h] of slabs) {
    p(C.pave3, x, y, w, 1);
    p(C.pave1, x, y + h - 1, w, 1);
  }
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(hh(v, i, 21) * 12), y = 3 + Math.floor(hh(v, i, 22) * 10);
    p(i % 2 ? C.pave1 : C.pave3, x, y, 1, 1);
  }
  if (v % 4 === 1) {
    // a worn chip by the grout (no line: a line would read as a belt arrow)
    p(C.pave1, 2, 12, 2, 1); p(C.pave1, 2, 11, 1, 1);
  }
}

const FALLBACK: Record<string, () => Art> = {
  tile_grass: () => mk(frames(16, 16, 4, grassTile), 16, 16),
  tile_pave: () => mk(frames(16, 16, 4, paveTile), 16, 16),
  // the bolted strip on an owned chunk's edge: frames N, E, S, W
  tile_pave_seam: () => mk(frames(16, 16, 4, ({ p }, f) => {
    for (let i = 0; i < 16; i++) {
      const at = (k: number, col: string) => {
        if (f === 0) p(col, i, k); else if (f === 2) p(col, i, 15 - k); else if (f === 1) p(col, 15 - k, i); else p(col, k, i);
      };
      at(0, C.steel2);
      at(1, i % 8 === 3 ? C.steel4 : C.steel3);
      at(2, C.pave1);
    }
  }), 16, 16),
  tile_grass_deco: () => mk(frames(16, 16, 8, ({ p }, f) => {
    const flower = (x: number, y: number, petal: string, mid: string) => {
      p(C.grass1, x, y + 2, 1, 1);
      p(petal, x - 1, y, 1, 1); p(petal, x + 1, y, 1, 1); p(petal, x, y - 1, 1, 1); p(petal, x, y + 1, 1, 1);
      p(mid, x, y, 1, 1);
    };
    const spot = (i: number) => [3 + Math.floor(hh(f, i, 31) * 10), 3 + Math.floor(hh(f, i, 32) * 9)];
    if (f <= 2) {
      const cols = f === 0 ? [C.bone, C.lamp2] : f === 1 ? [C.lamp2, C.lamp1] : [C.red, C.lamp2];
      for (let i = 0; i < 3; i++) { const [x, y] = spot(i); flower(x, y, i === 2 && f === 2 ? C.violet : cols[0], cols[1]); }
    } else if (f === 3 || f === 4) {
      const [x, y] = spot(0);
      p(C.grass1, x - 1, y + 3, 6, 1);
      for (let i = 0; i < (f === 3 ? 4 : 3); i++) { p(C.grass1, x + i, y + 1 + (i % 2), 1, 2); p(C.grass3, x + i, y - (i % 2), 1, 2); }
    } else if (f === 5) {
      for (let i = 0; i < 2; i++) {
        const [x, y] = spot(i);
        p(C.grass1, x, y + 2, 4, 1);
        p(C.steel2, x, y + 1, 3, 1); p(C.steel3, x, y, 3, 1); p(C.steel4, x, y, 1, 1);
      }
    } else if (f === 6) {
      for (let i = 0; i < 3; i++) { const [x, y] = spot(i); p(C.grass1, x, y + 1, 3, 1); p(C.grass3, x, y, 1, 1); p(C.grass3, x + 2, y, 1, 1); p(C.grass3, x + 1, y - 1, 1, 1); }
    } else {
      const [x, y] = spot(0);
      p(C.grass1, x - 1, y + 3, 5, 1);
      p(C.bone, x + 1, y + 1, 1, 2);
      p(C.red, x, y, 3, 1); p(C.red, x + 1, y - 1, 1, 1); p(C.bone, x, y, 1, 1);
    }
  }), 16, 16),
  // the plot marked out on land for sale: corner stakes and a dashed line, NW N NE W - E SW S SE
  tile_plot: () => mk(frames(16, 16, 9, ({ p }, f) => {
    const r = Math.floor(f / 3), c = f % 3;
    const n = r === 0, s = r === 2, w = c === 0, e = c === 2;
    const dash = (x: number, y: number, k: number, horiz: boolean) => {
      if (k % 4 >= 2) return;
      p(C.bone, x, y, 1, 1);
      if (horiz) p(C.grass1, x, y + 1, 1, 1); else p(C.grass1, x + 1, y, 1, 1);
    };
    for (let i = 0; i < 16; i++) {
      if (n) dash(i, 2, i, true);
      if (s) dash(i, 13, i, true);
      if (w) dash(2, i, i, false);
      if (e) dash(13, i, i, false);
    }
    const stake = (x: number, gy: number) => {
      // a peg standing on ground point (x, gy): 5 px tall, a red tie
      p(C.grass0, x + 1, gy + 1, 3, 1);
      p(C.wood1, x - 1, gy - 5, 4, 6);
      p(C.wood3, x, gy - 4, 2, 5);
      p(C.wood4, x, gy - 4, 1, 5);
      p(C.wood5, x, gy - 5, 2, 1);
      p(C.red, x, gy - 3, 2, 1);
    };
    if (n && w) stake(2, 6);
    if (n && e) stake(12, 6);
    if (s && w) stake(2, 14);
    if (s && e) stake(12, 14);
  }), 16, 16),
  // ---------------------------------------------------------------- the island body
  // the rim's boundary tiles by land mask (N=1 E=2 S=4 W=8); frames 16..31 are a second wobble
  isle_edge: () => mk(frames(16, 16, 32, (q, f) => edgeTile(q, f & 15, f >> 4, false)), 16, 16),
  fplat_edge: () => mk(frames(16, 16, 16, (q, f) => edgeTile(q, f, 0, true)), 16, 16),
  isle_cliff: () => mk(frames(16, 16, 12, (q, f) => cliffTile(q, Math.floor(f / 4), f % 4)), 16, 16),
  isle_vein: () => {
    const ores: [string, string[]][] = [
      ['iron', [C.iron0, C.iron1, C.iron2]], ['copper', [C.copper0, C.copper1, C.copper2]],
      ['coal', [C.ink, C.ink2, C.steel2]], ['sand', [C.wood3, C.wood5, C.bone]],
    ];
    const names: string[] = [];
    const fr: HTMLCanvasElement[] = [];
    ores.forEach(([n, cols], oi) => {
      for (let v = 0; v < 4; v++) {
        names.push(n + v);
        fr.push(frames(16, 16, 1, ({ p }) => {
          let x = 2 + Math.floor(hh(oi, v, 41) * 5), y = 3 + Math.floor(hh(oi, v, 42) * 6);
          const dy = hh(oi, v, 43) < 0.5 ? 1 : -1;
          for (let k = 0; k < 4; k++) {
            p(C.earth0, x, y + 2, 3, 1);
            p(cols[0], x, y, 3, 2);
            p(cols[1], x, y, 2, 1);
            p(cols[2], x, y, 1, 1);
            x += 2 + (k % 2);
            y += k % 2 ? dy : 0;
            if (y < 1 || y > 12) break;
          }
          if (v % 2 === 0) { const gx = 3 + Math.floor(hh(oi, v, 44) * 9), gy = 2 + Math.floor(hh(oi, v, 45) * 10); p(C.cloud3, gx, gy, 1, 1); p(cols[2], gx - 1, gy, 1, 1); p(cols[2], gx + 1, gy, 1, 1); p(cols[2], gx, gy - 1, 1, 1); p(cols[2], gx, gy + 1, 1, 1); }
        })[0]);
      }
    });
    return mk(fr, 16, 16, 0, 0, 0, names);
  },
  isle_under: () => mk(frames(16, 16, 16, (q, f) => underTile(q, Math.floor(f / 4), f % 4)), 16, 16),
  // overlays for the underside's fill (the art's crystals and roots); the code draws none
  isle_under_deco: () => mk(frames(16, 16, 8, () => {}), 16, 16),
  // grass in the grout where paving meets land you don't own: frames N, E, S, W
  tile_pave_edge: () => mk(frames(16, 16, 4, ({ p }, f) => {
    const at = (a: number, k: number, col: string) => {
      if (f === 0) p(col, a, k); else if (f === 2) p(col, 15 - a, 15 - k); else if (f === 1) p(col, 15 - k, a); else p(col, k, 15 - a);
    };
    for (const [a, k, col] of [[2, 1, C.grass1], [3, 1, C.grass1], [4, 1, C.grass1], [2, 0, C.grass2], [4, 0, C.grass2], [1, 0, C.grass3], [10, 0, C.grass1], [11, 1, C.grass1], [11, 0, C.grass3]] as [number, number, string][]) at(a, k, col);
  }), 16, 16),
  // the spring and its channel on a south lip tile (grass round it), and the bow over the lip
  isle_fall_top: () => mk(frames(16, 16, 4, (q, f) => {
    grassTile(q, 1);
    const { p } = q;
    p(C.grass0, 4, 2, 8, 14); p(C.sky1, 5, 3, 6, 13); p(C.sky2, 6, 4, 3, 2);
    p(C.sky3, 6, (f * 3) % 12 + 4, 2, 1); p(C.cloud3, 5, 15, 6, 1);
  }), 16, 16, 0, 0, 8),
  isle_fall_head: () => {
    const fall = FALLBACK.isle_fall();
    return mk(fall.frames.map((fr) => { const c = canvas(16, 16); const x = c.getContext('2d')!; x.drawImage(fr, 0, 0); x.fillStyle = C.cloud3; x.fillRect(3, 0, 10, 1); return c; }), 16, 16, 0, 0, 8);
  },
  isle_tip: () => mk(frames(48, 32, 1, ({ p }) => {
    for (let y = 0; y < 32; y++) {
      const hw = Math.max(0, Math.round(23 * (1 - y / 31) ** 0.9 + (hh(y, 0, 51) < 0.35 ? -1 : 0)));
      for (let x = 24 - hw; x < 24 + hw; x++) {
        const edgeL = x === 24 - hw, edgeR = x === 24 + hw - 1;
        let col: string = C.earth1;
        if (x < 24 - hw / 3) col = C.earth2;
        if (x > 24 + hw / 3) col = C.earth0;
        if ((y + Math.floor(x / 5)) % 7 === 0) col = C.ink2;
        if (edgeL) col = C.earth3;
        if (edgeR) col = C.ink2;
        p(col, x, y, 1, 1);
      }
    }
    p(C.ink2, 23, 31, 2, 1);
    // a crystal catching the light, and a root
    p(C.iron0, 18, 12, 3, 4); p(C.iron1, 18, 12, 2, 3); p(C.iron2, 18, 12, 1, 2); p(C.cloud3, 19, 13, 1, 1);
    p(C.wood1, 33, 6, 1, 5); p(C.wood1, 34, 11, 1, 3);
  }), 48, 32),
  isle_fall: () => mk(frames(16, 32, 4, ({ p }, f) => {
    for (let y = 0; y < 32; y++) {
      const yy = (y - f * 8 + 64) % 32;
      const l = 3 + (Math.sin((yy / 32) * Math.PI * 2) > 0.6 ? 1 : 0);
      const r = 12 - (Math.sin((yy / 32) * Math.PI * 2 + 2) > 0.6 ? 1 : 0);
      for (let x = l; x <= r; x++) {
        let col: string = C.sky3;
        if (x === l) col = C.cloud2;
        else if (x === r) col = C.sky2;
        else if (x === r - 1 || x === l + 4) col = C.sky2;
        const ph = Math.floor(hh(x, 0, 61) * 32), len = 3 + Math.floor(hh(x, 0, 62) * 7);
        if ((yy - ph + 64) % 32 < len) col = x % 3 === 0 ? C.cloud3 : C.cloud2;
        p(col, x, y, 1, 1);
      }
    }
  }), 16, 32, 0, 0, 8),
  isle_fall_foam: () => mk(frames(32, 16, 4, ({ p }, f) => {
    const cs: number[][] = [];
    for (let i = 0; i < 6; i++) cs.push([5 + i * 4.4 + (hh(i, f, 71) - 0.5) * 2, 10 - (i % 2) * 2 - hh(i, f, 72) * 2, 3 + hh(i, f, 73) * 2.5]);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 32; x++) {
        if (!inCircles(cs, x, y, 14)) continue;
        p(!inCircles(cs, x, y - 2) ? C.cloud3 : y > 11 ? C.cloud1 : C.cloud2, x, y, 1, 1);
      }
    for (let i = 0; i < 4; i++) p(C.cloud3, 4 + Math.floor(hh(i, f, 74) * 24), Math.floor(hh(i, f, 75) * 5), 1, 1);
  }), 32, 16, 0, 0, 8),
  // ---------------------------------------------------------------- the sky
  sky_cloud: () => mk(frames(64, 32, 6, (q, f) => cloudPuff(q, f, [C.cloud0, C.cloud1, C.cloud2, C.cloud3])), 64, 32),
  sky_islet: () => mk(frames(64, 48, 4, (q, f) => islet(q, f)), 64, 48),
  sky_bird: () => mk(frames(8, 8, 4, ({ p }, f) => {
    const wing = [0, 1, 2, 1][f];
    const col = C.steel1;
    p(col, 3, 4, 2, 1);
    // wings: up (0), level (1), down (2)
    if (wing === 0) { p(col, 1, 3, 2, 1); p(col, 0, 2, 1, 1); p(col, 5, 3, 2, 1); p(col, 7, 2, 1, 1); }
    else if (wing === 1) { p(col, 0, 4, 3, 1); p(col, 5, 4, 3, 1); }
    else { p(col, 1, 5, 2, 1); p(col, 0, 6, 1, 1); p(col, 5, 5, 2, 1); p(col, 7, 6, 1, 1); }
  }), 8, 8, 4, 4, 8),
  // ---------------------------------------------------------------- props on the rim
  prop_tree: () => mk(frames(32, 32, 4, (q, f) => tree(q, f)), 32, 32, 16, 30),
  prop_bush: () => mk(frames(16, 16, 4, ({ p }, f) => {
    if (f === 1) {
      // a rock
      p(C.grass1, 3, 13, 11, 1);
      p(C.steel1, 3, 8, 10, 5); p(C.steel2, 4, 7, 8, 5); p(C.steel3, 5, 7, 5, 2); p(C.steel4, 5, 7, 2, 1);
      p(C.steel1, 9, 10, 1, 2);
      return;
    }
    if (f === 3) {
      // a flower bed in a wooden edge
      p(C.wood1, 2, 9, 12, 5); p(C.wood3, 2, 9, 12, 1); p(C.earth1, 3, 10, 10, 3);
      for (let i = 0; i < 4; i++) { const x = 4 + i * 2 + (i % 2); p(C.grass1, x, 9, 1, 2); p(i % 2 ? C.red : C.lamp2, x, 7 + (i % 2), 1, 2); p(C.bone, x, 7 + (i % 2), 1, 1); }
      return;
    }
    const cs = f === 0 ? [[5, 10, 4], [10, 9, 4.5], [8, 7, 4]] : [[6, 11, 3.5], [10, 11, 3], [8, 9, 3]];
    p(C.grass1, 2, 13, 12, 2);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        if (!inCircles(cs, x, y, 13)) continue;
        let col: string = C.grass1;
        if (!inCircles(cs, x - 1, y - 2)) col = C.grass3;
        else if (!inCircles(cs, x + 1, y + 2)) col = C.grass0;
        p(col, x, y, 1, 1);
      }
    if (f === 2) for (const [x, y] of [[6, 10], [9, 8], [11, 11]]) { p(C.red, x, y, 1, 1); p(C.copper3, x, y - 1, 1, 1); }
  }), 16, 16),
  prop_fence: () => mk(frames(16, 16, 4, ({ p }, f) => {
    const post = (x: number, y0: number) => { p(C.wood1, x - 1, y0 - 1, 4, 8); p(C.wood3, x, y0, 2, 6); p(C.wood5, x, y0, 2, 1); p(C.grass0, x, y0 + 6, 3, 1); };
    if (f === 0) {
      p(C.wood1, 0, 8, 16, 2); p(C.wood4, 0, 8, 16, 1);
      p(C.wood1, 0, 11, 16, 2); p(C.wood4, 0, 11, 16, 1);
      post(2, 6); post(11, 6);
    } else if (f === 1) {
      p(C.wood1, 7, 0, 2, 16); p(C.wood4, 7, 0, 1, 16);
      post(7, 1); post(7, 9);
    } else if (f === 2) post(7, 6);
    else {
      p(C.wood1, 2, 8, 12, 5); p(C.wood4, 3, 8, 10, 1); p(C.wood4, 3, 11, 10, 1); p(C.wood3, 7, 8, 2, 5);
      post(1, 5); post(13, 5);
    }
  }), 16, 16),
  // ---------------------------------------------------------------- the Factory's sky platform
  fplat_under: () => mk(frames(16, 16, 6, ({ p }, f) => {
    if (f < 3) {
      // the girder face: an I-beam with rivets, the platform's thickness
      const l = f === 0 ? 2 : 0, r = f === 2 ? 13 : 15;
      p(C.steel0, l, 0, r - l + 1, 12);
      p(C.steel1, l, 1, r - l + 1, 9);
      p(C.steel3, l, 1, r - l + 1, 1);
      p(C.brass1, l, 4, r - l + 1, 1);
      for (let x = l + 2; x <= r - 1; x += 5) { p(C.steel4, x, 6, 1, 1); p(C.steel0, x, 7, 1, 1); }
      p(C.ink2, l, 11, r - l + 1, 1);
      if (f === 0) p(C.steel2, l, 1, 1, 9);
      return;
    }
    // the truss below: a lattice of X braces between two chords
    const l = f === 3 ? 4 : 0, r = f === 5 ? 11 : 15;
    p(C.steel0, l, 0, r - l + 1, 2); p(C.steel2, l, 0, r - l + 1, 1);
    p(C.steel0, l, 12, r - l + 1, 2); p(C.steel2, l, 12, r - l + 1, 1);
    for (let y = 2; y < 12; y++) {
      const a = Math.round((y - 2) * 0.8), b = 15 - a;
      for (const x of [a, b]) if (x >= l && x <= r) { p(C.steel1, x, y, 1, 1); p(C.steel0, x, y + 1, 1, 1); }
    }
    if (f === 3) p(C.steel1, l, 0, 2, 14);
    if (f === 5) p(C.steel1, r - 1, 0, 2, 14);
  }), 16, 16),
  fplat_rotor: () => mk(frames(48, 24, 4, ({ p }, f) => {
    // the strut and the brass pod: a rounded drum with a band of rivets and a glowing port
    p(C.steel0, 22, 0, 4, 3);
    p(C.ink, 13, 3, 22, 12); p(C.ink, 15, 2, 18, 14);
    p(C.brass1, 14, 4, 20, 10); p(C.brass1, 16, 3, 16, 12);
    p(C.brass2, 16, 3, 16, 3); p(C.brass2, 14, 5, 20, 2); p(C.brass3, 17, 4, 7, 1);
    p(C.brass0, 14, 12, 20, 2); p(C.brass0, 16, 14, 16, 1);
    for (let x = 16; x < 33; x += 4) p(C.brass3, x, 8, 1, 1);
    p(C.ink, 22, 7, 4, 4); p(C.lamp2, 23, 8, 2, 2); p(C.lamp3, 23, 8, 1, 1);
    // the hub under it, and the blades, foreshortened, turning a quarter in four frames
    p(C.ink, 21, 15, 6, 4); p(C.steel3, 22, 15, 4, 2);
    const a = (f / 4) * Math.PI;
    for (const s of [1, -1]) {
      for (let k = 3; k <= 23; k++) {
        const x = Math.round(24 + s * Math.cos(a) * k), y = Math.round(18 + s * Math.sin(a) * k * 0.2);
        p(C.steel0, x, y + 2, 1, 1);
        p(k > 19 ? C.brass2 : C.steel4, x, y, 1, 1);
        p(k > 19 ? C.brass1 : C.steel3, x, y + 1, 1, 1);
      }
    }
    // the blur ring
    for (let i = 0; i < 28; i++) {
      if ((i + f) % 3) continue;
      const t = (i / 28) * Math.PI * 2;
      p(C.cloud3, Math.round(24 + Math.cos(t) * 23), Math.round(18 + Math.sin(t) * 4.5), 1, 1);
    }
  }), 48, 24, 24, 0, 12),
};

/** A rim tile with its edge into the sky on the sides that are not land (mask: N=1 E=2 S=4 W=8).
 *  The grass (or, on the Factory, a steel deck with a brass-trimmed girder) is cut along a wobble
 *  and outlined; corners with two open sides are cut on the diagonal. */
function edgeTile(q: Pen, mask: number, v: number, deck: boolean) {
  const { p, clear } = q;
  if (deck) deckTile(q);
  else grassTile(q, (mask + v) % 4);
  if (mask === 15) return;
  const open = (b: number) => !(mask & b);
  const wn = deck ? new Array(16).fill(0) : wobble(mask * 7 + v * 131 + 1);
  const ws = deck ? new Array(16).fill(0) : wobble(mask * 7 + v * 131 + 2);
  const ww = deck ? new Array(16).fill(0) : wobble(mask * 7 + v * 131 + 3);
  const we = deck ? new Array(16).fill(0) : wobble(mask * 7 + v * 131 + 4);
  const out = deck ? C.steel0 : C.grass0;
  for (let i = 0; i < 16; i++) {
    if (open(1)) {
      const j = wn[i];
      clear(i, 0, 1, j);
      p(out, i, j, 1, 1);
      p(deck ? C.brass2 : C.grass3, i, j + 1, 1, 1);
      if (deck) { p(C.steel1, i, j + 2, 1, 1); if (i % 5 === 2) p(C.brass3, i, j + 1, 1, 1); }
    }
    if (open(4)) {
      const j = ws[i];
      clear(i, 16 - j, 1, j);
      p(out, i, 15 - j, 1, 1);
      p(deck ? C.brass1 : C.grass1, i, 14 - j, 1, 1);
      if (deck) { p(C.steel1, i, 13 - j, 1, 1); if (i % 5 === 2) p(C.brass3, i, 14 - j, 1, 1); }
    }
    if (open(8)) {
      const j = ww[i];
      clear(0, i, j, 1);
      p(out, j, i, 1, 1);
      p(deck ? C.brass2 : C.grass3, j + 1, i, 1, 1);
      if (deck) { p(C.steel1, j + 2, i, 1, 1); if (i % 5 === 2) p(C.brass3, j + 1, i, 1, 1); }
    }
    if (open(2)) {
      const j = we[i];
      clear(16 - j, i, j, 1);
      p(out, 15 - j, i, 1, 1);
      p(deck ? C.brass1 : C.grass1, 14 - j, i, 1, 1);
      if (deck) { p(C.steel1, 13 - j, i, 1, 1); if (i % 5 === 2) p(C.brass3, 14 - j, i, 1, 1); }
    }
  }
  // corners: cut on the diagonal where two open sides meet
  const corner = (cx: number, cy: number, sx: number, sy: number) => {
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        const x = cx + sx * a, y = cy + sy * b;
        if (a + b < 3) clear(x, y, 1, 1);
        else if (a + b === 3) p(out, x, y, 1, 1);
      }
  };
  if (open(1) && open(8)) corner(0, 0, 1, 1);
  if (open(1) && open(2)) corner(15, 0, -1, 1);
  if (open(4) && open(8)) corner(0, 15, 1, -1);
  if (open(4) && open(2)) corner(15, 15, -1, -1);
}

/** The Factory platform's deck: light tread plate with seams and corner rivets. */
function deckTile({ p }: Pen) {
  // a pale steel plate (lighter than the hall's floor, so the hall stands out on it), a sparse
  // tread, seams and corner rivets
  p(C.steel3, 0, 0, 16, 16);
  for (let y = 3; y < 14; y += 5)
    for (let x = 3 + ((y / 5) % 2) * 2; x < 14; x += 5) { p(C.steel4, x, y, 2, 1); p(C.steel2, x + 1, y + 1, 1, 1); }
  p(C.steel2, 0, 15, 16, 1);
  p(C.steel2, 15, 0, 1, 16);
  p(C.steel4, 0, 0, 15, 1);
  for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) { p(C.steel4, x, y, 1, 1); p(C.steel1, x + 1, y + 1, 1, 1); }
}

/** The south face, 3/4 view: a grass overhang at the lip (row 0), earth strata (row 1), the dark
 *  low rock (row 2). The strata bands sit on the same rows in every variant, so they run on
 *  across columns. */
function cliffTile(q: Pen, row: number, v: number) {
  const { p, clear } = q;
  const band = (y: number) => {
    if (y <= 3) return C.earth2;
    if (y === 4) return C.earth1;
    if (y <= 9) return C.wood3;
    if (y === 10) return C.earth1;
    if (y === 11) return C.earth3;
    return C.earth2;
  };
  if (row < 2) {
    for (let y = 0; y < 16; y++) p(band(y), 0, y, 16, 1);
    for (let i = 0; i < 5; i++) p(C.wood4, Math.floor(hh(v, i, 81) * 16), 5 + Math.floor(hh(v, i, 82) * 5), 1, 1);
    // pebbles in the earth, and a crack
    for (let i = 0; i < 2; i++) {
      const x = 1 + Math.floor(hh(v, i, 83) * 12), y = i ? 12 + Math.floor(hh(v, i, 84) * 2) : Math.floor(hh(v, i, 84) * 2);
      p(C.earth0, x, y + 2, 3, 1); p(C.steel2, x, y, 3, 2); p(C.steel3, x, y, 2, 1);
    }
    const cx = 2 + Math.floor(hh(v, 3, 85) * 12);
    p(C.earth0, cx, 6, 1, 2); p(C.earth0, cx + 1, 8, 1, 2);
  }
  if (row === 0) {
    // the grass lip hangs over the face, with drips and a root
    p(C.grass1, 0, 0, 16, 2);
    p(C.grass2, 0, 0, 16, 1);
    for (let x = 0; x < 16; x++) {
      const d = Math.floor(hh(x, v, 86) * 3.4);
      p(C.grass0, x, 2, 1, 1 + d);
    }
    const rx = 3 + Math.floor(hh(v, 0, 87) * 10);
    p(C.wood1, rx, 4, 1, 4); p(C.wood1, rx + 1, 8, 1, 2);
  }
  if (row === 2) {
    p(C.earth1, 0, 0, 16, 16);
    p(C.earth2, 0, 0, 16, 2);
    p(C.earth0, 0, 7, 16, 1);
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hh(v, i, 88) * 13), y = 2 + Math.floor(hh(v, i, 89) * 9);
      p(C.ink2, x, y + 2, 4, 1); p(C.earth0, x, y, 4, 2); p(C.earth2, x, y, 2, 1);
    }
    // a ragged bottom edge where the underside takes over
    for (let x = 0; x < 16; x++) { const d = Math.floor(hh(x, v, 90) * 3); p(C.earth0, x, 13, 1, 3); if (d) clear(x, 16 - d, 1, d); }
  }
}

/** The underside: shadowed rock. type 0 fill, 1 bottom (open below: a ragged foot with the cloud
 *  sea's bounce light on it), 2 left slope (open left and below: a 45 degree edge from the top-left
 *  corner), 3 right slope. */
function underTile(q: Pen, type: number, v: number) {
  const { p, clear } = q;
  p(C.earth1, 0, 0, 16, 16);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(hh(v, i, 91) * 14), y = Math.floor(hh(v, i, 92) * 14);
    p(C.earth0, x, y, 2 + (i % 2), 2);
  }
  for (let i = 0; i < 2; i++) { const x = 2 + Math.floor(hh(v, i, 93) * 12), y = 2 + Math.floor(hh(v, i, 94) * 10); p(C.ink2, x, y, 1, 3); p(C.ink2, x + 1, y + 3, 1, 2); }
  for (let i = 0; i < 3; i++) p(C.earth2, Math.floor(hh(v, i, 95) * 16), Math.floor(hh(v, i, 96) * 16), 1, 1);
  if (type === 0) return;
  for (let x = 0; x < 16; x++) {
    // the rock's foot in this column
    const foot = type === 1 ? 11 + Math.floor(hh(x >> 2, v, 97) * 3) : type === 2 ? Math.min(15, x + 1) : Math.min(15, 16 - x);
    clear(x, foot + 1, 1, 15 - foot);
    p(C.steel2, x, foot, 1, 1);
    if (foot > 0) p(C.steel1, x, foot - 1, 1, 1);
  }
}

/** A cumulus puff: circles on a flat base, lit from the top left: f 0-1 big, 2-3 medium, 4-5 small. */
function cloudPuff({ p }: Pen, f: number, tones: string[]) {
  const size = f < 2 ? 1 : f < 4 ? 0.72 : 0.46;
  const w = 60 * size, x0 = 32 - w / 2, base = 29;
  const cs: number[][] = [];
  const n = 3 + Math.round(3 * size);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const r = (5 + 4 * Math.sin(t * Math.PI) + hh(f, i, 101) * 2.5) * (0.6 + size * 0.5);
    cs.push([x0 + r * 0.7 + t * (w - r * 1.4), base - r * 0.55, r]);
  }
  // one or two tall heads
  cs.push([32 + (hh(f, 9, 102) - 0.5) * w * 0.3, base - 13 * size - 4, (9 + hh(f, 9, 103) * 3) * size + 2]);
  if (size > 0.6) cs.push([32 - w * 0.2, base - 10 * size - 2, 7 * size + 2]);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) {
      if (!inCircles(cs, x, y, base)) continue;
      let col = tones[2];
      if (!inCircles(cs, x + 1, y - 2) || !inCircles(cs, x, y - 1)) col = tones[3];
      else if (y >= base - 1) col = tones[0];
      else if (y >= base - 3 || !inCircles(cs, x - 2, y + 2, base)) col = tones[1];
      p(col, x, y, 1, 1);
    }
}

/** A far island, hazed toward the sky: a teal-grey top, a pale rock cone, one with a waterfall. */
function islet({ p }: Pen, f: number) {
  const w = [44, 30, 52, 24][f], cx = 32, top = [14, 22, 12, 26][f];
  const depth = [26, 18, 30, 14][f];
  for (let y = 0; y < depth; y++) {
    const hw = Math.round((w / 2) * (1 - (y / depth) ** 1.3) + (hh(f, y, 111) < 0.3 ? -1 : 0));
    for (let x = cx - hw; x < cx + hw; x++) p(x < cx - hw / 2 ? C.cloud1 : x > cx + hw / 3 ? C.sky2 : C.cloud0, x, top + 3 + y, 1, 1);
  }
  // the grass top, a flattened lens
  for (let y = 0; y < 5; y++) {
    const hw = Math.round((w / 2 + 1) * Math.sqrt(1 - ((y - 3) / 4) ** 2));
    p(y < 2 ? C.cloud2 : C.teal, cx - hw, top + y, hw * 2, 1);
  }
  p(C.cloud1, cx - w / 2 - 1, top + 4, w + 2, 1);
  // a tree or two
  if (f !== 3) for (let i = 0; i < 2; i++) { const x = cx - w / 4 + i * (w / 3); p(C.water4, x, top - 4, 4, 4); p(C.teal, x, top - 4, 2, 2); }
  if (f === 0) for (let y = top + 6; y < 48; y++) p(y % 3 ? C.cloud2 : C.cloud3, cx + 8, y, 1, 1);
}

/** A rim tree: f 0 round, 1 tall and dark, 2 fruit, 3 pale. Foot at (16, 30). */
function tree({ p }: Pen, f: number) {
  // the shadow on the grass, the trunk
  p(C.grass1, 9, 29, 15, 2); p(C.grass1, 11, 31, 11, 1);
  p(C.wood1, 14, 19, 5, 12); p(f === 3 ? C.bone : C.wood3, 15, 19, 3, 11); p(f === 3 ? C.steel4 : C.wood4, 15, 19, 1, 11);
  if (f === 3) { p(C.steel1, 16, 22, 2, 1); p(C.steel1, 15, 26, 2, 1); }
  const cs = f === 1 ? [[16, 17, 6], [16, 11, 5.5], [16, 6, 4]] : f === 3 ? [[12, 13, 6], [20, 12, 6.5], [16, 7, 6]] : [[10, 15, 7], [22, 14, 7.5], [16, 9, 8.5]];
  const [d, m, l]: string[] = f === 1 ? [C.moss1, C.grass0, C.grass1] : f === 3 ? [C.grass1, C.grass2, C.grass3] : [C.grass0, C.grass1, C.grass2];
  for (let y = 0; y < 26; y++)
    for (let x = 0; x < 32; x++) {
      if (!inCircles(cs, x, y, f === 1 ? 23 : 21)) continue;
      let col: string = m;
      if (!inCircles(cs, x + 2, y + 2, f === 1 ? 23 : 21)) col = d;
      else if (!inCircles(cs, x - 2, y - 2)) col = l;
      if (col === l && !inCircles(cs, x - 1, y - 1) && f !== 1) col = C.grass3;
      p(col, x, y, 1, 1);
    }
  if (f === 2) for (const [x, y] of [[10, 13], [19, 9], [23, 15], [14, 17]]) { p(C.red, x, y, 2, 2); p(C.copper3, x, y, 1, 1); }
}
