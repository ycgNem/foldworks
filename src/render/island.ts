// The island body (docs/sky-island.md, Layers 2): the Workshop floats on it. Baked once per floor
// size (and whenever imported art for its names appears) into one canvas in world space: the grass
// rim round the plot (organic, hash-varied, wide enough on the north for every town slot), its
// edge into the sky by neighbour mask, the south cliff face in 3/4 view (a grass lip, earth strata,
// the floor's ores as veins), the underside tapering in tiers to a rocky point, a cushion of cloud
// under it with the island's shadow on it, and rim props (trees, bushes, fences, flowers) placed by
// hash, never on the plot or where the town stands. Waterfalls pour from notches in the south lip;
// they and their foam animate live on top of the bake. Presentation only.
//
// The rim, in tiles beyond the plot (RIM): north 6 (5 to 7 with the wobble; the town's footing
// rows -3..-1 are always land, its sprites reach up to row -5 and stand in front of the sky), west
// and east 4 (3 to 5; town slots run from x -3 to fw + 2), south 3 (2 to 4; the row-99 houses
// stand on rows fh and fh + 1). Then CLIFF tiles of south face and up to UNDER of underside.
import { PATCHES } from '../data/land';
import { C } from '../data/palette';
import { TILE } from './ground';
import { art, named, artSig, canvas, hh } from './skyart';
import { townZones } from './town';

export const RIM = { n: 6, s: 3, w: 4, e: 4 };
/** tiles of cliff face under the south lip */
export const CLIFF = 5;
/** the underside's depth under the centre, in tiles */
const UNDER = 8;

const ART = ['tile_grass', 'tile_grass_deco', 'isle_edge', 'isle_cliff', 'isle_vein', 'isle_under', 'isle_tip', 'prop_tree', 'prop_bush', 'prop_fence'] as const;
const VEIN: Record<string, string> = { ironOre: 'iron', copperOre: 'copper', coal: 'coal', sand: 'sand' };

interface Fall { x: number; y0: number; y1: number; seed: number }
interface Prop { kind: 'tree' | 'bush' | 'fence'; x: number; y: number; f: number }

export class Island {
  private c: HTMLCanvasElement | null = null;
  private key = '';
  /** world px of the bake's top-left */
  private ox = 0;
  private oy = 0;
  private falls: Fall[] = [];
  private b = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** world px under the floor's south edge the camera may show: the south rim and the cliff */
  readonly below = (RIM.s + CLIFF) * TILE;

  /** the island's extent in world px (rim, cliff, underside and its cloud) */
  bounds() {
    return this.b;
  }

  /** Draw the island under a floor fw x fh (world transform set), its waterfalls live. */
  draw(ctx: CanvasRenderingContext2D, fw: number, fh: number, time: number) {
    const key = `${fw}x${fh}:${artSig(ART)}`;
    if (!this.c || key !== this.key) {
      this.bake(fw, fh);
      this.key = key;
    }
    ctx.drawImage(this.c!, this.ox, this.oy);
    const fall = art('isle_fall'), foam = art('isle_fall_foam');
    // every segment shows the same frame: the strip tiles vertically, its frames scroll it
    const fr = fall.frames[Math.floor(time * (fall.fps || 8)) % fall.frames.length];
    for (const f of this.falls) {
      for (let y = f.y0; y < f.y1; y += fall.h) {
        const h = Math.min(fall.h, f.y1 - y);
        ctx.drawImage(fr, 0, 0, fall.w, h, f.x + (TILE - fall.w) / 2, y, fall.w, h);
      }
      const ff = foam.frames[(Math.floor(time * (foam.fps || 8)) + f.seed) % foam.frames.length];
      ctx.drawImage(ff, Math.round(f.x + TILE / 2 - foam.w / 2), Math.round(f.y1 - foam.h / 2));
    }
  }

  private bake(fw: number, fh: number) {
    const X0 = -RIM.w - 2, X1 = fw + RIM.e + 2, Y0 = -RIM.n - 2, Y1 = fh + RIM.s + 2;
    const cols = X1 - X0, rows = Y1 - Y0;
    const land = new Uint8Array(cols * rows);
    const forced = new Uint8Array(cols * rows);
    const idx = (x: number, y: number) => (y - Y0) * cols + (x - X0);
    const inG = (x: number, y: number) => x >= X0 && x < X1 && y >= Y0 && y < Y1;
    const L = (x: number, y: number) => inG(x, y) && land[idx(x, y)] === 1;
    const inPlot = (x: number, y: number) => x >= 0 && y >= 0 && x < fw && y < fh;
    // smooth 1-D value noise in [0, 1) at a period: the rim's margins wander in two octaves, from a
    // tile in to two out
    const sn = (i: number, seed: number, per: number) => {
      const k = Math.floor(i / per), t = (i - k * per) / per, u = t * t * (3 - 2 * t);
      const a = hh(k, seed, 301 + per), b = hh(k + 1, seed, 301 + per);
      return a + (b - a) * u;
    };
    const margin = (base: number, i: number, seed: number) => base - 1 + Math.round(sn(i + 60, seed, 5) * 3.2 - 0.1);
    // the sides wander further (two in to two out): nothing stands there but trees
    const sideMargin = (base: number, i: number, seed: number) => base - 2 + Math.round(sn(i + 60, seed, 4) * 4.4 - 0.2);
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        const ex = x < 0 ? -x : x >= fw ? x - fw + 1 : 0;
        const ey = y < 0 ? -y : y >= fh ? y - fh + 1 : 0;
        const mx = x < 0 ? sideMargin(RIM.w, y, 1) : sideMargin(RIM.e, y, 2);
        const my = y < 0 ? margin(RIM.n, x, 3) : margin(RIM.s, x, 4);
        let on: boolean;
        if (!ex && !ey) on = true;
        else if (!ex) on = ey <= my;
        else if (!ey) on = ex <= mx;
        else on = (ex / (mx + 0.5)) ** 2.2 + (ey / (my + 0.5)) ** 2.2 <= 1;
        if (on) land[idx(x, y)] = 1;
        if (inPlot(x, y)) forced[idx(x, y)] = 1;
      }
    // the town's footing rows are always land (its sprites may stand up into the sky)
    const zones = townZones(fw, fh);
    for (const z of zones)
      for (let y = Math.max(z.y0, z.y1 - 3); y < z.y1; y++)
        for (let x = z.x0; x < z.x1; x++) if (inG(x, y)) { land[idx(x, y)] = 1; forced[idx(x, y)] = 1; }
    // no one-tile spurs: land needs two land neighbours
    for (let pass = 0; pass < 2; pass++)
      for (let y = Y0; y < Y1; y++)
        for (let x = X0; x < X1; x++) {
          if (!L(x, y) || forced[idx(x, y)]) continue;
          const n = +L(x, y - 1) + +L(x + 1, y) + +L(x, y + 1) + +L(x - 1, y);
          if (n < 2) land[idx(x, y)] = 0;
        }
    const bottom = (x: number) => { for (let y = Y1 - 1; y >= Y0; y--) if (L(x, y)) return y; return -999; };
    const top = (x: number) => { for (let y = Y0; y < Y1; y++) if (L(x, y)) return y; return 999; };
    // waterfalls: notches in the south lip, away from the row-99 houses and from each other
    const reserved = (x: number, y: number) => zones.some((z) => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1);
    const fallX: number[] = [];
    const cand: number[] = [];
    for (let x = X0 + 1; x < X1 - 1; x++) cand.push(x);
    cand.sort((a, b) => hh(a, 7, 331) - hh(b, 7, 331));
    for (const x of cand) {
      if (fallX.length >= 2) break;
      const b = bottom(x);
      if (b < fh + 1 || bottom(x - 1) < b || bottom(x + 1) < b || reserved(x, b) || reserved(x, b - 1)) continue;
      if (fallX.some((o) => Math.abs(o - x) < 6)) continue;
      fallX.push(x);
      land[idx(x, b)] = 0;
    }
    // the columns, their cliffs and the underside's tiers
    let xl = X1, xr = X0;
    for (let x = X0; x < X1; x++) if (bottom(x) > -999) { xl = Math.min(xl, x); xr = Math.max(xr, x); }
    const cliffEnd = new Map<number, number>();
    let base = -999;
    for (let x = xl; x <= xr; x++) { const e = bottom(x) + 1 + CLIFF; cliffEnd.set(x, e); base = Math.max(base, e); }
    const cx = (xl + xr) / 2, half = (xr - xl) / 2 + 1;
    const ybot = new Map<number, number>();
    for (let x = xl; x <= xr; x++) {
      const u = Math.min(1, Math.abs(x - cx) / half);
      const q = UNDER * (1 - u ** 1.5);
      ybot.set(x, Math.max(cliffEnd.get(x)!, base + Math.max(0, Math.round(q) - (hh(x, 0, 313) < 0.3 ? 1 : 0))));
    }
    const yb = (x: number) => ybot.get(x) ?? -999;
    let deep = base, deepX = Math.round(cx);
    for (let x = xl; x <= xr; x++) if (yb(x) > deep || (yb(x) === deep && Math.abs(x - cx) < Math.abs(deepX - cx))) { deep = yb(x); deepX = x; }
    // the canvas: the grid, room under the tip for the cloud, and either side for its puffs
    const PADX = 3 * TILE;
    const bedY = (deep + 1) * TILE + 2;
    const W = cols * TILE + PADX * 2, H = (deep + 1 - Y0) * TILE + 56;
    const c = canvas(W, H);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    this.ox = X0 * TILE - PADX;
    this.oy = Y0 * TILE;
    const T = (x: number, y: number) => [x * TILE - this.ox, y * TILE - this.oy] as const;
    const put = (img: CanvasImageSource, x: number, y: number) => { const [px, py] = T(x, y); ctx.drawImage(img, px, py); };

    // the underside, then the rocky point
    const under = art('isle_under');
    const uf = (type: number, x: number, y: number) => under.frames[(type * 4 + Math.floor(hh(x, y, 314) * 4)) % under.frames.length];
    for (let x = xl; x <= xr; x++)
      for (let y = cliffEnd.get(x)!; y < yb(x); y++) {
        const lo = y >= yb(x - 1), ro = y >= yb(x + 1);
        const type = lo && !ro ? 0 : ro && !lo ? 2 : lo && ro ? (x <= cx ? 0 : 2) : 1;
        put(uf(type, x, y), x, y);
      }
    const tip = art('isle_tip');
    {
      const [px, py] = T(deepX, deep);
      ctx.drawImage(tip.frames[0], px + TILE / 2 - tip.w / 2, py - 6);
    }
    // the cliffs: a lip, strata and low rock, with veins of this floor's ores
    const cliff = art('isle_cliff'), vein = art('isle_vein');
    const ores = [...new Set(PATCHES.map((p) => VEIN[p.item]).filter(Boolean))];
    const cliffAt = (x: number, y: number) => { const b = bottom(x); return b > -999 && y > b && y <= b + CLIFF; };
    for (let x = xl; x <= xr; x++) {
      const b = bottom(x);
      // the fallback face is drawn as one column, so its strata run on unbroken (the art's tiles
      // keep their bands on the same rows instead)
      if (!cliff.real) { const [px, py] = T(x, b + 1); cliffColumn(ctx, px, py, x * TILE); }
      for (let k = 0; k < CLIFF; k++) {
        const y = b + 1 + k;
        const row = k === 0 ? 0 : k === CLIFF - 1 ? 2 : 1;
        const v = Math.floor(hh(x, y, 311) * 4);
        if (cliff.real) put(cliff.frames[(row * 4 + v) % cliff.frames.length], x, y);
        if (row === 1 && ores.length && hh(x, y, 312) < 0.28) {
          const ore = ores[Math.floor(hh(x, y, 315) * ores.length)];
          const img = named(vein, ore + Math.floor(hh(x, y, 316) * 4));
          if (img) put(img, x, y);
        }
        if (!cliff.real) {
          // the face's silhouette edge where nothing stands beside it
          const [px, py] = T(x, y);
          ctx.fillStyle = C.earth0;
          if (!L(x - 1, y) && !cliffAt(x - 1, y)) ctx.fillRect(px, py, 1, TILE);
          if (!L(x + 1, y) && !cliffAt(x + 1, y)) ctx.fillRect(px + TILE - 1, py, 1, TILE);
        }
      }
    }
    // the cloud cushion under the point, the island's shadow on it
    this.bed(ctx, (xl - 2) * TILE - this.ox, (xr + 3) * TILE - this.ox, bedY - this.oy, xl * TILE - this.ox, (xr + 1) * TILE - this.ox);
    // the rim: grass, its edge tiles by mask, and flowers
    const grass = art('tile_grass'), edge = art('isle_edge'), deco = art('tile_grass_deco');
    const maskAt = (x: number, y: number) => (L(x, y - 1) ? 1 : 0) | (L(x + 1, y) ? 2 : 0) | (L(x, y + 1) ? 4 : 0) | (L(x - 1, y) ? 8 : 0);
    const pools = new Set(fallX.map((x) => `${x},${bottom(x)}`));
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!L(x, y) || inPlot(x, y)) continue;
        const m = maskAt(x, y);
        if (m === 15) {
          put(grass.frames[Math.floor(hh(x, y, 317) * grass.frames.length)], x, y);
          if (!pools.has(`${x},${y}`) && hh(x, y, 318) < 0.13) put(deco.frames[Math.floor(hh(x, y, 319) * deco.frames.length)], x, y);
        } else put(edge.frames[edge.frames.length >= 32 ? m + (hh(x, y, 320) < 0.5 ? 0 : 16) : m], x, y);
      }
    // the springs that feed the falls
    for (const x of fallX) {
      const [px, py] = T(x, bottom(x));
      spring(ctx, px, py);
    }
    // props: trees off the plot's edge, bushes, fences along straight stretches of the south lip
    const props: Prop[] = [];
    const taken = new Set<string>();
    const nearPlot = (x: number, y: number) => x >= -1 && x <= fw && y >= -1 && y <= fh;
    const nearFall = (x: number, y: number) => fallX.some((f) => Math.abs(f - x) <= 1 && y >= bottom(f) - 1);
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!L(x, y) || nearPlot(x, y) || nearPlot(x, y - 1) || reserved(x, y) || reserved(x, y - 1) || nearFall(x, y)) continue;
        if (!L(x, y + 1) || !L(x - 1, y) || !L(x + 1, y)) continue;
        if (hh(x, y, 321) > 0.34) continue;
        let close = false;
        for (const p of props) if (p.kind === 'tree' && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1) close = true;
        if (close) continue;
        props.push({ kind: 'tree', x, y, f: Math.floor(hh(x, y, 322) * 4) });
        taken.add(`${x},${y}`);
        taken.add(`${x},${y - 1}`);
      }
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!L(x, y) || inPlot(x, y) || reserved(x, y) || nearFall(x, y) || taken.has(`${x},${y}`) || taken.has(`${x},${y + 1}`)) continue;
        const m = maskAt(x, y);
        if (m === (1 | 2 | 8) && hh(Math.floor((x + 100) / 4), 0, 323) < 0.55 && !nearPlot(x, y)) {
          props.push({ kind: 'fence', x, y, f: 0 });
          continue;
        }
        if (m === 15 && !nearPlot(x, y) && hh(x, y, 324) < 0.08) props.push({ kind: 'bush', x, y, f: Math.floor(hh(x, y, 325) * 4) });
      }
    const tree = art('prop_tree'), bush = art('prop_bush'), fence = art('prop_fence');
    props.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const p of props) {
      const [px, py] = T(p.x, p.y);
      if (p.kind === 'tree') ctx.drawImage(tree.frames[p.f % tree.frames.length], px + TILE / 2 - tree.ax, py + 14 - tree.ay);
      else {
        const a = p.kind === 'bush' ? bush : fence;
        ctx.drawImage(a.frames[p.f % a.frames.length], px, py);
      }
    }
    this.c = c;
    this.falls = fallX.map((x, i) => ({ x: x * TILE, y0: (bottom(x) + 1) * TILE - 5, y1: bedY + 10, seed: i * 3 }));
    let ty = 0;
    for (let x = xl; x <= xr; x++) ty = Math.min(ty, top(x));
    this.b = { x0: xl * TILE, y0: ty * TILE, x1: (xr + 1) * TILE, y1: bedY + 40 };
  }

  /** A cushion of cloud under the island (canvas px): puffs along a lens, lit on top, the island's
   *  shadow darkening it between sx0 and sx1. */
  private bed(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, sx0: number, sx1: number) {
    const cs: number[][] = [];
    const w = x1 - x0;
    for (let i = 0, x = x0 + 6; x < x1 - 6; i++) {
      const t = (x - x0) / w;
      const r = 6 + 9 * Math.sin(t * Math.PI) + hh(i, 0, 341) * 4;
      cs.push([x, y + 12 - r * 0.35 + hh(i, 1, 342) * 3, r]);
      x += r * 0.95;
    }
    const inside = (px: number, py: number) => {
      for (const [cx, cy, r] of cs) { const dx = px + 0.5 - cx, dy = py + 0.5 - cy; if (dx * dx + dy * dy <= r * r) return true; }
      return false;
    };
    const top = Math.floor(y - 12), bot = Math.ceil(y + 36);
    for (let py = top; py < bot; py++)
      for (let px = x0; px < x1; px++) {
        if (!inside(px, py)) continue;
        const shade = px >= sx0 && px < sx1 && py < y + 10;
        let col: string = shade ? C.cloud1 : C.cloud2;
        if (!inside(px, py - 2) || !inside(px + 1, py - 1)) col = shade ? C.cloud2 : C.cloud3;
        else if (!inside(px - 1, py + 3)) col = shade ? C.cloud0 : C.cloud1;
        ctx.fillStyle = col;
        ctx.fillRect(px, py, 1, 1);
      }
  }
}

/** The code-drawn south face under one column (canvas px of its lip; X its world px): a grass lip
 *  with drips, topsoil with roots, then strata that wave across columns (sand, earth, red earth),
 *  darker as they go down, a ragged foot where the underside takes over. Drawn in runs. */
function cliffColumn(ctx: CanvasRenderingContext2D, px: number, py: number, X: number) {
  const H = CLIFF * TILE;
  for (let i = 0; i < TILE; i++) {
    const x = X + i;
    const wv = Math.round(1.6 * Math.sin(x / 9 + 1) + Math.sin(x / 4.3));
    const drip = 3 + Math.floor(hh(x, 0, 351) * 4);
    const foot = H - 1 - Math.floor(hh(x, 0, 352) * 4);
    let run = '', start = 0;
    const colAt = (d: number): string => {
      if (d < 2) return C.grass1;
      if (d < drip) return C.grass0;
      const e = d + wv;
      if (e < 13) return hh(x, d, 353) < 0.05 ? C.wood1 : C.earth3;
      if (e < 15) return C.earth2;
      if (e < 27) return hh(x, d, 354) < 0.06 ? C.wood3 : C.wood4;
      if (e < 28) return C.earth1;
      if (e < 42) return C.earth2;
      if (e < 43) return C.earth0;
      if (e < 56) return C.wood2;
      if (e < 57) return C.earth0;
      return e < 70 ? C.earth1 : C.earth0;
    };
    for (let d = 0; d <= foot + 1; d++) {
      const col = d <= foot ? colAt(d) : '';
      if (col === run) continue;
      if (run) { ctx.fillStyle = run; ctx.fillRect(px + i, py + start, 1, d - start); }
      run = col;
      start = d;
    }
  }
  // a few stones in the earth and a root under the lip
  for (let k = 0; k < CLIFF; k++) {
    if (hh(X, k, 355) > 0.22) continue;
    const sx = px + 2 + Math.floor(hh(X, k, 356) * 10), sy = py + k * TILE + 4 + Math.floor(hh(X, k, 357) * 8);
    ctx.fillStyle = C.earth0; ctx.fillRect(sx, sy + 2, 4, 1);
    ctx.fillStyle = C.steel2; ctx.fillRect(sx, sy, 4, 2);
    ctx.fillStyle = C.steel3; ctx.fillRect(sx, sy, 2, 1);
  }
  if (hh(X, 9, 358) < 0.5) { const rx = px + 3 + Math.floor(hh(X, 9, 359) * 10); ctx.fillStyle = C.wood1; ctx.fillRect(rx, py + 3, 1, 6); ctx.fillRect(rx + 1, py + 9, 1, 3); }
}

/** A spring pool in the notch above a waterfall (canvas px of its tile), open to the south. */
function spring(ctx: CanvasRenderingContext2D, px: number, py: number) {
  const p = (col: string, x: number, y: number, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(px + x, py + y, w, h); };
  p(C.grass0, 3, 4, 10, 12);
  p(C.grass0, 2, 6, 12, 10);
  p(C.sky1, 4, 5, 8, 11);
  p(C.sky1, 3, 7, 10, 9);
  p(C.sky2, 4, 6, 7, 2);
  p(C.sky3, 5, 6, 3, 1);
  p(C.cloud3, 9, 9, 2, 1);
  p(C.sky3, 6, 12, 4, 1);
  p(C.cloud2, 5, 14, 6, 2);
}
