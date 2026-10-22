// The island body (docs/sky-island.md, Layers 2 and "Decided at the style test"): the Workshop
// floats on it. Baked once per floor size (and whenever imported art for its names appears) into
// one canvas in world space, put together exactly as pixel-art/sky/mock_island.py does:
// - the land: the plot, a grass rim round it wide enough on the north for every town slot, its
//   coasts MONOTONE (each steps only outward going south down to the widest rows, then only
//   inward), so a south face shows only round the island's lower half and never hangs like a
//   pillar beside the land; organic from the edge tiles' wobbly lip and rounded corners;
// - the rim's edge into the sky: isle_edge by 4-bit mask (N=1 E=2 S=4 W=8 = land there);
// - the south face, drawn per PIXEL column under the top surface's own silhouette: from every
//   land pixel with sky under it, the column of the 64 px cliff strip at world x mod 64 (top
//   row the lip, the mid row repeating, the low row ending it), CLIFF tiles long, or under the
//   column's lowest land down to where the underside starts; land further south covers the cliff
//   behind it (the top surface is drawn over the face). Veins of the floor's ores on the first
//   mid row, clipped to the rock;
// - the underside by tile column (fill, bottom, left slope, right slope; variant x mod 4), 1 tile
//   deep at the island's ends and DEPTH in the middle, never shallower than the column outward of
//   it; overlays (crystals, roots, a hollow) by hash on its fill; the rocky tip under the two
//   middle deepest columns; one ink outline round the whole body;
// - a cushion of cloud under the point with the island's shadow on it, rim props by hash (never on
//   the plot or where the town stands). Waterfalls pour from springs on the south lip; they animate
//   live on top of the bake (spring, the bow over the lip, the fall tiled down, foam on the cloud).
// Act IV (DESIGN.md §22): each island has its own look, `isle_<world>_*` sheet by sheet (Home's
// where an island has none; Cinder's and Rime's falls are their own: lava and meltwater), its veins
// include its exotic, and the plot need not be a rectangle: Pebble Isle's chunks C, D and F are
// sky, so the land is the rows of A, B and E (and F's when Sky Moorings moors it), each row's plot
// from its own west to east, the coasts drawn round that.
// Presentation only.
import { C } from '../data/palette';
import { TILE } from './ground';
import { art, named, artSig, canvas, hh, isle, type Art } from './skyart';
import { townZones } from './town';

/** What an island is baked from besides the floor's size: its look, the plot's extent on each row
 *  (west x inclusive, east x exclusive; a rectangle when left out) and the ores in its veins. */
export interface IsleOpts { world?: string; rows?: [number, number][]; ores?: string[] }

/** the rim in tiles beyond the plot, at its widest (north holds the town's rows) */
export const RIM = { n: 6, s: 3, w: 4, e: 4 };
/** tiles of south face under a lip (the underside starts this far under a column's lowest land) */
export const CLIFF = 4;
/** the underside's depth in the middle, in tiles (1 at the island's ends) */
const DEPTH = 9;

const ART = ['tile_grass', 'tile_grass_deco', 'isle_edge', 'isle_cliff', 'isle_vein', 'isle_under', 'isle_under_deco', 'isle_tip', 'prop_tree', 'prop_bush', 'prop_fence'] as const;
const VEIN: Record<string, string> = { ironOre: 'iron', copperOre: 'copper', coal: 'coal', sand: 'sand', skyglass: 'skyglass', cinderite: 'cinderite', rimeCrystal: 'rime', relic: 'relic' };
const FALLS = ['isle_fall', 'isle_fall_top', 'isle_fall_head', 'isle_fall_foam'] as const;
const UNDER = { fill: 0, bottom: 1, left: 2, right: 3 } as const;

interface Fall { x: number; y: number; y1: number; seed: number }
interface Prop { kind: 'tree' | 'bush' | 'fence'; x: number; y: number; f: number }

const mod = (a: number, n: number) => ((a % n) + n) % n;

export class Island {
  private c: HTMLCanvasElement | null = null;
  private key = '';
  /** world px of the bake's top-left */
  private ox = 0;
  private oy = 0;
  private falls: Fall[] = [];
  /** the island whose look the bake used (its falls are drawn live in the same look) */
  private world = 'home';
  private b = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** world px under the floor's south edge the camera may show: the south rim and the cliff */
  readonly below = (RIM.s + CLIFF) * TILE;

  /** the island's extent in world px (rim, cliff, underside and its cloud) */
  bounds() {
    return this.b;
  }

  /** Draw the island under a floor fw x fh (world transform set), its waterfalls live. */
  draw(ctx: CanvasRenderingContext2D, fw: number, fh: number, time: number, o: IsleOpts = {}) {
    const w = o.world ?? 'home';
    const key = `${fw}x${fh}:${w}:${o.rows?.map((r) => r.join('-')).join(',') ?? ''}:${o.ores?.join(',') ?? ''}:${artSig(ART.map((n) => isle(n, w)))}:${artSig(FALLS.map((n) => isle(n, w)))}`;
    if (!this.c || key !== this.key) {
      this.world = w;
      this.bake(fw, fh, o);
      this.key = key;
    }
    ctx.drawImage(this.c!, this.ox, this.oy);
    const I = (n: string) => art(isle(n, this.world));
    const top = I('isle_fall_top'), head = I('isle_fall_head'), fall = I('isle_fall'), foam = I('isle_fall_foam');
    const at = (a: Art, seed: number) => a.frames[(Math.floor(time * (a.fps || 8)) + seed) % a.frames.length];
    for (const f of this.falls) {
      ctx.drawImage(at(top, f.seed), f.x, f.y);
      ctx.drawImage(at(head, f.seed), f.x, f.y + TILE);
      // every segment shows the same frame: the strip tiles down, its frames scroll it
      const fr = at(fall, f.seed);
      for (let y = f.y + 2 * TILE; y < f.y1; y += fall.h) {
        const h = Math.min(fall.h, f.y1 - y);
        ctx.drawImage(fr, 0, 0, fall.w, h, f.x + (TILE - fall.w) / 2, y, fall.w, h);
      }
      ctx.drawImage(at(foam, f.seed), Math.round(f.x + TILE / 2 - foam.w / 2), Math.round(f.y1 - foam.h / 2));
    }
  }

  private bake(fw: number, fh: number, o: IsleOpts) {
    const A = (n: string) => art(isle(n, this.world));
    // the plot's west and east (exclusive) on each of its rows: a rectangle unless the island says
    const plotRow = (y: number): [number, number] => o.rows?.[Math.max(0, Math.min(fh - 1, y))] ?? [0, fw];
    // ---- the land: one run per row from L to R, coasts monotone (rowsL holds how far west the
    // row's land runs, as -x, and rowsR its east x: bigger is wider either way)
    const Y0 = -RIM.n, Y1 = fh + RIM.s - 1;
    const zones = townZones(fw, fh);
    const sn = (i: number, seed: number) => hh(i, seed, 401);
    const rowsL = new Map<number, number>(), rowsR = new Map<number, number>();
    for (let y = Y0; y <= Y1; y++) {
      // target margins beyond the plot (tiles), with a little wander
      let mw: number, me: number;
      if (y < 0) {
        const d = -y;
        const base = d <= 3 ? 3 : d === 4 ? 2 : d === 5 ? 1 : -2;
        mw = base + (sn(y, 1) < 0.5 ? 0 : 1);
        me = base + (sn(y, 2) < 0.5 ? 0 : 1);
      } else if (y < fh) {
        // a bulge, widest a little above the middle, so the hull below steps the coast in and out
        const bulge = Math.sin(Math.PI * (y + 3) / (fh + 5));
        mw = 3 + Math.round(1.8 * bulge * bulge + sn(Math.floor(y / 2), 3) * 0.9 - 0.45);
        me = 3 + Math.round(1.8 * bulge * bulge + sn(Math.floor(y / 2), 4) * 0.9 - 0.45);
      } else {
        const d = y - fh + 1;
        mw = d === 1 ? 2 : d === 2 ? 1 : -2 - Math.floor(sn(d, 5) * 2);
        me = d === 1 ? 2 : d === 2 ? 1 : -2 - Math.floor(sn(d, 6) * 2);
      }
      const [pa, pb] = plotRow(y);
      rowsL.set(y, mw - pa);
      rowsR.set(y, pb - 1 + me);
    }
    // the town's rows are land (its footings), whatever the wander says
    for (const z of zones)
      for (let y = Math.max(z.y0, z.y1 - 3); y < z.y1; y++) {
        if (y < Y0 || y > Y1) continue;
        rowsL.set(y, Math.max(rowsL.get(y)!, -z.x0));
        rowsR.set(y, Math.max(rowsR.get(y)!, z.x1 - 1));
      }
    // monotone: prefix max down to the widest row, suffix max up from the bottom
    const hull = (m: Map<number, number>) => {
      let widest = Y0;
      for (let y = Y0; y <= Y1; y++) if (m.get(y)! > m.get(widest)! || (m.get(y)! === m.get(widest)! && Math.abs(y - fh / 2) < Math.abs(widest - fh / 2))) widest = y;
      for (let y = Y0 + 1; y <= widest; y++) m.set(y, Math.max(m.get(y)!, m.get(y - 1)!));
      for (let y = Y1 - 1; y >= widest; y--) m.set(y, Math.max(m.get(y)!, m.get(y + 1)!));
    };
    hull(rowsL);
    hull(rowsR);
    const X0 = -RIM.w - 2, X1 = fw + RIM.e + 2;
    const cols = X1 - X0, rows = Y1 - Y0 + 3;
    const land = new Uint8Array(cols * rows);
    const idx = (x: number, y: number) => (y - Y0) * cols + (x - X0);
    const inG = (x: number, y: number) => x >= X0 && x < X1 && y >= Y0 && y <= Y1;
    const L = (x: number, y: number) => inG(x, y) && land[idx(x, y)] === 1;
    const inPlot = (x: number, y: number) => { if (y < 0 || y >= fh) return false; const [pa, pb] = plotRow(y); return x >= pa && x < pb; };
    for (let y = Y0; y <= Y1; y++)
      for (let x = -rowsL.get(y)!; x <= rowsR.get(y)!; x++) if (inG(x, y)) land[idx(x, y)] = 1;
    // the last row: lobes, never a single tile (the falls start on them)
    for (let x = X0; x < X1; x++) if (L(x, Y1) && hh(Math.floor((x + 40) / 3), 0, 402) < 0.3) land[idx(x, Y1)] = 0;
    for (let x = X0; x < X1; x++) if (L(x, Y1) && !L(x - 1, Y1) && !L(x + 1, Y1)) land[idx(x, Y1)] = 0;
    for (let x = X0; x < X1; x++) if (L(x, Y1) && (!L(x - 1, Y1) || !L(x + 1, Y1)) && !(L(x - 2, Y1) || L(x + 2, Y1))) land[idx(x, Y1)] = 0;

    const bottom = (x: number) => { for (let y = Y1; y >= Y0; y--) if (L(x, y)) return y; return -999; };
    const top = (x: number) => { for (let y = Y0; y <= Y1; y++) if (L(x, y)) return y; return 999; };
    const maskAt = (x: number, y: number) => (L(x, y - 1) ? 1 : 0) | (L(x + 1, y) ? 2 : 0) | (L(x, y + 1) ? 4 : 0) | (L(x - 1, y) ? 8 : 0);
    let xl = X1, xr = X0;
    for (let x = X0; x < X1; x++) if (bottom(x) > -999) { xl = Math.min(xl, x); xr = Math.max(xr, x); }
    const reserved = (x: number, y: number) => zones.some((z) => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1);

    // ---- waterfalls: springs on south lip tiles with land either side, away from the town
    const fallX: number[] = [];
    const cand: number[] = [];
    for (let x = xl + 1; x < xr; x++) cand.push(x);
    cand.sort((a, b) => hh(a, 7, 331) - hh(b, 7, 331));
    for (const x of cand) {
      if (fallX.length >= 2) break;
      const b = bottom(x);
      if (b < fh || maskAt(x, b) !== (1 | 2 | 8) || reserved(x, b) || reserved(x, b - 1)) continue;
      if (fallX.some((o) => Math.abs(o - x) < 6)) continue;
      fallX.push(x);
    }

    // ---- the underside's rows by column
    const cx = (xl + xr + 1) / 2, hw = (xr - xl + 1) / 2;
    const ub = new Map<number, number>(), ubot = new Map<number, number>();
    const foot = (x: number) => bottom(x) + 1 + CLIFF;
    for (let x = xl; x <= xr; x++) {
      // where a lobe drops the lip a row, its neighbours' faces run on a row more, so the
      // underside starts level under both (no step in it); bigger steps stay steps
      let u = foot(x);
      for (let k = -2; k <= 2; k++) { const v = x + k >= xl && x + k <= xr ? foot(x + k) : -999; if (v - foot(x) === 1) u = Math.max(u, v); }
      const t = Math.max(0, 1 - Math.abs(x + 0.5 - cx) / hw);
      ub.set(x, u);
      ubot.set(x, u + 1 + Math.round((DEPTH - 1) * t ** 1.8));
    }
    for (let x = xl + 1; x + 0.5 <= cx; x++) ubot.set(x, Math.max(ubot.get(x)!, ubot.get(x - 1)!));
    for (let x = xr - 1; x + 0.5 > cx; x--) ubot.set(x, Math.max(ubot.get(x)!, ubot.get(x + 1)!));
    let deep = -999;
    for (let x = xl; x <= xr; x++) deep = Math.max(deep, ubot.get(x)!);
    const deepX = [] as number[];
    for (let x = xl; x <= xr; x++) if (ubot.get(x) === deep) deepX.push(x);
    const mid = (Math.min(...deepX) + Math.max(...deepX) + 1) / 2;
    const tipCols = new Set([Math.floor(mid) - 1, Math.floor(mid)]);

    // ---- the canvas: the grid, room under the tip for the cloud, either side for its puffs
    const PADX = 3 * TILE;
    const bedY = deep * TILE + 22;
    const W = cols * TILE + PADX * 2, H = (deep - Y0) * TILE + 32 + 56;
    this.ox = X0 * TILE - PADX;
    this.oy = Y0 * TILE;
    const ox = this.ox, oy = this.oy;
    const T = (x: number, y: number) => [x * TILE - ox, y * TILE - oy] as const;

    // ---- the top surface's silhouette (the plot is solid; edge tiles by their art's alpha)
    const edge = A('isle_edge'), grass = A('tile_grass'), deco = A('tile_grass_deco');
    const sil = canvas(W, H);
    const sctx = sil.getContext('2d')!;
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!L(x, y)) continue;
        const [px, py] = T(x, y);
        const m = maskAt(x, y);
        if (m === 15 || inPlot(x, y)) { sctx.fillStyle = '#000'; sctx.fillRect(px, py, TILE, TILE); }
        else sctx.drawImage(edge.frames[m % edge.frames.length], px, py);
      }
    const alpha = sctx.getImageData(0, 0, W, H).data;
    const solid = (px: number, py: number) => px >= 0 && py >= 0 && px < W && py < H && alpha[(py * W + px) * 4 + 3] > 0;

    // ---- the body: cliff, veins, underside, tip, then its outline
    const body = canvas(W, H);
    const bctx = body.getContext('2d')!;
    bctx.imageSmoothingEnabled = false;
    const cliff = A('isle_cliff');
    const strip = canvas(64, 48);
    {
      const s = strip.getContext('2d')!;
      for (let r = 0; r < 3; r++) for (let v = 0; v < 4; v++) s.drawImage(cliff.frames[(r * 4 + v) % cliff.frames.length], v * 16, r * 16);
    }
    for (let x = xl; x <= xr; x++) {
      const endLow = ub.get(x)! * TILE - oy;
      for (let i = 0; i < TILE; i++) {
        const px = x * TILE + i - ox;
        const sx = mod(x * TILE + i, 64);
        // the lowest exposure in this pixel column runs down to the underside; any above it (a
        // step in the coast) is CLIFF tiles long and mostly hidden by the land in front
        let lowestPy = -1;
        for (let py = H - 2; py >= 0; py--) if (solid(px, py) && !solid(px, py + 1)) { lowestPy = py; break; }
        for (let py = 0; py < H - 1; py++) {
          if (!solid(px, py) || solid(px, py + 1)) continue;
          const y0 = py + 1;
          const end = py === lowestPy ? Math.max(endLow, y0 + TILE) : y0 + CLIFF * TILE;
          const len = end - y0;
          if (len <= 0) continue;
          // the lip (top row), the mid row repeating, the low row ending on `end`
          const topLen = Math.min(16, len);
          bctx.drawImage(strip, sx, 0, 1, topLen, px, y0, 1, topLen);
          const rest = len - topLen;
          if (rest > 0) {
            const lowLen = Math.min(16, rest);
            let y = y0 + topLen;
            let midLen = rest - lowLen;
            while (midLen > 0) {
              const h = Math.min(16, midLen);
              bctx.drawImage(strip, sx, 16, 1, h, px, y, 1, h);
              y += h;
              midLen -= h;
            }
            bctx.drawImage(strip, sx, 32 + 16 - lowLen, 1, lowLen, px, y, 1, lowLen);
          }
        }
      }
    }
    // veins: the floor's ores on the first mid row of a column's face, only where there is rock
    const vein = A('isle_vein');
    const ores = [...new Set((o.ores ?? ['ironOre', 'copperOre', 'coal', 'sand']).map((it) => VEIN[it]).filter(Boolean))];
    if (ores.length) {
      bctx.globalCompositeOperation = 'source-atop';
      for (let x = xl; x <= xr; x++) {
        if (hh(x, 0, 312) >= 0.28) continue;
        const ore = ores[Math.floor(hh(x, 0, 315) * ores.length)];
        const img = named(vein, ore + Math.floor(hh(x, 0, 316) * 4));
        if (img) { const [px, py] = T(x, bottom(x) + 2); bctx.drawImage(img, px, py + 2); }
      }
      bctx.globalCompositeOperation = 'source-over';
    }
    // the underside
    const under = A('isle_under'), udeco = A('isle_under_deco');
    const cell = (x: number, r: number) => x >= xl && x <= xr && r >= ub.get(x)! && r < ubot.get(x)!;
    for (let x = xl; x <= xr; x++)
      for (let r = ub.get(x)!; r < ubot.get(x)!; r++) {
        let kind: number;
        if (cell(x, r + 1) || (r === deep - 1 && tipCols.has(x))) kind = UNDER.fill;
        else if (!cell(x - 1, r)) kind = UNDER.left;
        else if (!cell(x + 1, r)) kind = UNDER.right;
        else kind = UNDER.bottom;
        const [px, py] = T(x, r);
        bctx.drawImage(under.frames[(kind * 4 + mod(x, 4)) % under.frames.length], px, py);
        if (kind === UNDER.fill && udeco.real && hh(x, r, 330) < 0.3) bctx.drawImage(udeco.frames[Math.floor(hh(x, r, 331) * udeco.frames.length)], px, py);
      }
    const tip = A('isle_tip');
    bctx.drawImage(tip.frames[0], Math.round(mid * TILE - ox - (tip.real ? tip.ax : tip.w / 2)), deep * TILE - oy - (tip.real ? tip.ay : 6));
    outlineCanvas(body, C.ink);

    // ---- compose: the cloud under the point, the body, the rim
    const c = canvas(W, H);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const put = (img: CanvasImageSource, x: number, y: number) => { const [px, py] = T(x, y); ctx.drawImage(img, px, py); };
    this.bed(ctx, (xl - 2) * TILE - ox, (xr + 3) * TILE - ox, bedY - oy, xl * TILE - ox, (xr + 1) * TILE - ox);
    ctx.drawImage(body, 0, 0);
    const falls = new Set(fallX.map((x) => `${x},${bottom(x)}`));
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!L(x, y) || inPlot(x, y)) continue;
        const m = maskAt(x, y);
        if (m === 15) {
          put(grass.frames[Math.floor(hh(x, y, 317) * grass.frames.length)], x, y);
          if (hh(x, y, 318) < 0.13) put(deco.frames[Math.floor(hh(x, y, 319) * deco.frames.length)], x, y);
        } else if (!falls.has(`${x},${y}`) || !A('isle_fall_top').real) put(edge.frames[m % edge.frames.length], x, y);
      }
    // the code-drawn springs (the art's isle_fall_top is drawn live)
    if (!A('isle_fall_top').real) for (const x of fallX) { const [px, py] = T(x, bottom(x)); spring(ctx, px, py); }

    // ---- props: trees off the plot's edge, bushes, fences along straight stretches of the south lip
    const props: Prop[] = [];
    const taken = new Set<string>();
    const nearPlot = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inPlot(x + dx, y + dy)) return true; return false; };
    const nearFall = (x: number, y: number) => fallX.some((f) => Math.abs(f - x) <= 1 && y >= bottom(f) - 1);
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!L(x, y) || nearPlot(x, y) || nearPlot(x, y - 1) || reserved(x, y) || reserved(x, y - 1) || nearFall(x, y)) continue;
        if (!L(x, y + 1) || !L(x - 1, y) || !L(x + 1, y) || !L(x, y - 1)) continue;
        if (hh(x, y, 321) > 0.34) continue;
        let close = false;
        for (const p of props) if (p.kind === 'tree' && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1) close = true;
        if (close) continue;
        props.push({ kind: 'tree', x, y, f: Math.floor(hh(x, y, 322) * 4) });
        taken.add(`${x},${y}`);
        taken.add(`${x},${y - 1}`);
      }
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (!L(x, y) || inPlot(x, y) || reserved(x, y) || nearFall(x, y) || taken.has(`${x},${y}`) || taken.has(`${x},${y + 1}`)) continue;
        const m = maskAt(x, y);
        if (m === (1 | 2 | 8) && hh(Math.floor((x + 100) / 4), 0, 323) < 0.4 && !nearPlot(x, y)) {
          props.push({ kind: 'fence', x, y, f: 0 });
          continue;
        }
        if (m === 15 && !nearPlot(x, y) && hh(x, y, 324) < 0.08) props.push({ kind: 'bush', x, y, f: Math.floor(hh(x, y, 325) * 4) });
      }
    const tree = A('prop_tree'), bush = A('prop_bush'), fence = A('prop_fence');
    props.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const p of props) {
      const [px, py] = T(p.x, p.y);
      if (p.kind === 'tree') ctx.drawImage(tree.frames[p.f % tree.frames.length], px + TILE / 2 - tree.ax, py + 14 - tree.ay);
      else if (p.kind === 'fence') ctx.drawImage(fence.frames[0], px, py + 2);
      else ctx.drawImage(bush.frames[p.f % bush.frames.length], px, py);
    }
    this.c = c;
    this.falls = fallX.map((x, i) => ({ x: x * TILE, y: bottom(x) * TILE, y1: bedY + 6, seed: i * 3 }));
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

/** One pixel of `col` round everything opaque on the canvas (4-neighbour), outside it. */
function outlineCanvas(c: HTMLCanvasElement, col: string) {
  const ctx = c.getContext('2d')!;
  const W = c.width, H = c.height;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const n = parseInt(col.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const op = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) op[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (op[i]) continue;
      if ((x > 0 && op[i - 1]) || (x < W - 1 && op[i + 1]) || (y > 0 && op[i - W]) || (y < H - 1 && op[i + W])) {
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
  ctx.putImageData(img, 0, 0);
}

/** A spring pool in the notch above a waterfall (canvas px of its tile), open to the south: the
 *  code's stand-in until isle_fall_top is drawn. */
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
