// The sky (docs/sky-island.md, Layers 1): drawn in screen space before the world transform, at the
// camera's zoom so a sky pixel is a world pixel. A banded gradient from the zenith to a pale
// horizon with a stepped sun glow top-left (baked per size and floor), far islets on the horizon
// (parallax 0.1), the cloud sea and two layers of drifting puffs (parallax 0.15 and 0.35), and now
// and then a flock of birds. The Factory's sky is higher: a deeper zenith, the cloud sea close
// below, and the Workshop island small, far down through a gap. Everything is pixel art: whole
// pixels, hard edges, ordered dither between bands, palette colours. No allocation per frame.
import { C } from '../data/palette';
import type { Floor } from '../sim/world';
import { art, canvas, hh } from './skyart';

interface Cam { x: number; y: number; zoom: number }


/** where things sit, as fractions of the low-res sky's height */
const LOOK: Record<Floor, { bands: number[]; far: number; near: number; sun: [number, number]; refY: number }> = {
  workshop: { bands: [0.2, 0.37, 0.52, 0.63], far: 0.6, near: 0.8, sun: [0.15, 0.13], refY: 120 },
  factory: { bands: [0.36, 0.55, 0.68, 0.77], far: 0.74, near: 0.86, sun: [0.14, 0.1], refY: 60 },
};

let grad: { c: HTMLCanvasElement; w: number; h: number; floor: Floor } | null = null;
let banks: { far: HTMLCanvasElement; near: HTMLCanvasElement; below: HTMLCanvasElement } | null = null;

/** puffs: x in a wrap span (fraction), y (fraction of height), frame, layer (0 far, 1 near) */
const PUFFS: { x: number; y: number; f: number; l: number }[] = [];
for (let i = 0; i < 16; i++) {
  const l = i < 7 ? 0 : 1;
  PUFFS.push({ x: hh(i, 1, 201), y: l === 0 ? 0.42 + hh(i, 2, 202) * 0.16 : 0.14 + hh(i, 2, 203) * 0.5, f: l === 0 ? 2 + (i % 4) : i % 4, l });
}
const ISLETS = [{ x: 0.08, f: 0, dy: 0 }, { x: 0.38, f: 3, dy: 3 }, { x: 0.61, f: 1, dy: 1 }, { x: 0.86, f: 2, dy: -2 }];
const FLOCK = [[0, 0], [-7, -3], [-7, 4], [-14, -6], [-14, 8]];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 4x4 ordered dither threshold in [0, 1) */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** The gradient and the sun, baked at low res (one pixel per world pixel). */
function bakeGradient(w: number, h: number, floor: Floor): HTMLCanvasElement {
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const ramp = [C.sky0, C.sky1, C.sky2, C.sky3, C.sky4].map(rgb);
  const sun = rgb(C.sun), white = rgb(C.cloud3);
  const L = LOOK[floor];
  const sx = L.sun[0] * w, sy = L.sun[1] * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const th = BAYER[(y & 3) * 4 + (x & 3)];
      // the band, dithered over 6 px at each boundary
      let band = 0;
      for (const b of L.bands) {
        const d = (y - b * h) / 6 + 0.5;
        if (d >= 1 || (d > 0 && th < d)) band++;
      }
      // the sun's glow: rings that lift the band a step each, dithered at their edges
      const dist = Math.hypot(x - sx, (y - sy) * 1.15);
      let col: [number, number, number];
      if (dist < 9) col = white;
      else if (dist < 15 + (th < 0.5 ? 1 : 0)) col = sun;
      else {
        let lift = 0;
        for (const r of [26, 44, 70]) {
          const d = (r - dist) / 5 + 0.5;
          if (d >= 1 || (d > 0 && th < d)) lift++;
        }
        col = ramp[Math.min(4, band + lift)];
      }
      const k = (y * w + x) * 4;
      img.data[k] = col[0];
      img.data[k + 1] = col[1];
      img.data[k + 2] = col[2];
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** A tileable cloud bank (320 px), its top a row of puffs, its body solid to the strip's foot. */
function bakeBank(seed: number, tones: string[], hgt: number, rmin: number, rmax: number): HTMLCanvasElement {
  const W = 320;
  const c = canvas(W, hgt);
  const ctx = c.getContext('2d')!;
  const cs: number[][] = [];
  for (let x = 0, i = 0; x < W; i++) {
    const r = rmin + hh(seed, i, 211) * (rmax - rmin);
    cs.push([x, rmax + 2 + hh(seed, i, 212) * 4, r]);
    x += r * (0.9 + hh(seed, i, 213) * 0.5);
  }
  const inside = (x: number, y: number) => {
    if (y >= rmax + 4) return true;
    for (const [cx, cy, r] of cs)
      for (const o of [-W, 0, W]) {
        const dx = x + 0.5 - (cx + o), dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) return true;
      }
    return false;
  };
  for (let y = 0; y < hgt; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      let col = tones[2];
      if (!inside(x, y - 2) || !inside(x + 1, y - 1)) col = tones[3];
      else if (!inside(x - 2, y + 2) && y < rmax + 4) col = tones[1];
      else if (y > rmax + 8) col = tones[1];
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

/** The Workshop island seen from far above, through a gap in the cloud sea (Factory sky only). */
let below: HTMLCanvasElement | null = null;
function belowIsle(): HTMLCanvasElement {
  if (below) return below;
  const c = canvas(40, 26);
  const ctx = c.getContext('2d')!;
  const p = (col: string, x: number, y: number, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  for (let y = 0; y < 18; y++) {
    const hw = Math.round(17 * (1 - (y / 18) ** 1.4));
    p(y < 3 ? C.cloud1 : C.cloud0, 20 - hw, 7 + y, hw * 2, 1);
  }
  p(C.sky2, 22, 10, 10, 12);
  for (let y = 0; y < 8; y++) { const hw = Math.round(19 * Math.sqrt(1 - ((y - 4) / 4.5) ** 2)); p(C.teal, 20 - hw, 1 + y, hw * 2, 1); }
  p(C.pave2, 12, 3, 14, 5); p(C.pave3, 12, 3, 14, 1); p(C.wood4, 13, 1, 2, 2); p(C.wood4, 18, 1, 2, 2); p(C.wood4, 23, 1, 2, 2);
  p(C.cloud2, 30, 9, 1, 17);
  below = c;
  return c;
}

/** Draw the sky over the whole canvas (screen space, identity transform). */
export function drawSky(ctx: CanvasRenderingContext2D, W: number, H: number, cam: Cam, time: number, floor: Floor) {
  const s = Math.max(1, cam.zoom);
  const w = Math.ceil(W / s), h = Math.ceil(H / s);
  if (w <= 0 || h <= 0) return;
  if (!grad || grad.w !== w || grad.h !== h || grad.floor !== floor) grad = { c: bakeGradient(w, h, floor), w, h, floor };
  if (!banks)
    banks = {
      far: bakeBank(1, [C.cloud0, C.sky3, C.cloud1, C.sky4], 40, 6, 11),
      near: bakeBank(2, [C.cloud0, C.cloud1, C.cloud2, C.cloud3], 56, 9, 17),
      below: bakeBank(3, [C.cloud0, C.cloud0, C.cloud1, C.cloud2], 40, 7, 12),
    };
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(grad.c, 0, 0, w * s, h * s);
  const L = LOOK[floor];
  // camera parallax: a layer at p moves p as far as the world does
  const camX = cam.x, camY = cam.y - L.refY;
  const at = (img: CanvasImageSource, iw: number, ih: number, x: number, y: number) => ctx.drawImage(img, Math.round(x) * s, Math.round(y) * s, iw * s, ih * s);
  const wrapX = (x: number, span: number) => ((x % span) + span) % span;

  // far islets on the horizon (0.1)
  const isl = art('sky_islet');
  const spanI = w + isl.w * 2;
  for (const it of ISLETS) {
    const x = wrapX(it.x * spanI - camX * 0.1, spanI) - isl.w;
    const y = L.far * h - isl.h + 10 + it.dy - camY * 0.1;
    at(isl.frames[it.f % isl.frames.length], isl.w, isl.h, x, y);
  }
  // the far cloud bank on the horizon and the sea below it (0.15)
  const bank = (img: HTMLCanvasElement, y: number, px: number, drift: number) => {
    const bw = img.width;
    const x0 = -wrapX(camX * px + time * drift, bw);
    const yy = Math.round(y);
    for (let x = x0; x < w; x += bw) at(img, bw, img.height, x, yy);
    // the sea under the bank, solid to the foot of the screen
    const foot = yy + img.height;
    if (foot < h) {
      ctx.fillStyle = img === banks!.far ? C.cloud1 : img === banks!.below ? C.cloud1 : C.cloud2;
      ctx.fillRect(0, foot * s, w * s, (h - foot) * s);
    }
  };
  bank(banks.far, L.far * h - 14 - camY * 0.15, 0.15, 1.5);
  const cl = art('sky_cloud');
  const spanC = w + cl.w * 2;
  for (const p of PUFFS) {
    if (p.l !== 0) continue;
    const x = wrapX(p.x * spanC - camX * 0.15 - time * 1.5, spanC) - cl.w;
    const y = p.y * h - camY * 0.15;
    ctx.globalAlpha = 0.9;
    at(cl.frames[p.f % cl.frames.length], cl.w, cl.h, x, y);
    ctx.globalAlpha = 1;
  }
  if (floor === 'factory') {
    // the Workshop far below, in a gap between the banks
    const b = belowIsle();
    const bx = w * 0.7 - camX * 0.12, by = L.near * h - 18 - camY * 0.2;
    bank(banks.below, L.far * h + 4 - camY * 0.2, 0.2, 2.2);
    at(b, b.width, b.height, bx, by);
  }
  // the near bank and the high puffs (0.35)
  bank(banks.near, L.near * h - camY * 0.35, 0.35, 3);
  for (const p of PUFFS) {
    if (p.l !== 1) continue;
    const x = wrapX(p.x * spanC - camX * 0.35 - time * 3, spanC) - cl.w;
    const y = p.y * h - camY * 0.35;
    at(cl.frames[p.f % cl.frames.length], cl.w, cl.h, x, y);
  }
  // now and then a flock crosses: 16 s of every 41
  const cyc = Math.floor(time / 41), t = time - cyc * 41;
  if (t < 16) {
    const bd = art('sky_bird');
    const fx = -24 + (t / 16) * (w + 48), fy = h * (0.16 + hh(cyc, 0, 221) * 0.18) + Math.sin(t * 0.8) * 3;
    for (let i = 0; i < FLOCK.length; i++) {
      const [dx, dy] = FLOCK[i];
      at(bd.frames[(Math.floor(time * (bd.fps || 8)) + i) % bd.frames.length], bd.w, bd.h, fx + dx, fy + dy);
    }
  }
}
