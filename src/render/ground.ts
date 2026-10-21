// The Workshop ground, baked once per land chunk into a canvas (the chunked-ground pattern from
// Trotline). Readability first (DESIGN.md §17): the sky island (docs/sky-island.md, Layers 3) makes
// land you own warm paving (tile_pave, a bolted strip, tile_pave_seam, round each chunk so lots
// read as lots) and land for sale a meadow (tile_grass with sparse tile_grass_deco) with its plot
// marked out by corner stakes and a dashed line (tile_plot): told apart at a glance by hue and
// lightness. Code draws each in the island's colours until the art lands (skyart.ts). Ore patches
// are outcrops standing up out of either: each ore's outcrop (tile_ore_<ore>, ores.py) is one
// 32x32 cut in quadrants; its spill sheet (tile_ore_<ore>_spill, the 4x4 tiles round the patch)
// puts a few pebbles, stains, cracks or drift on the tiles beside it (never on another patch). A
// chunk is baked both ways (paved and meadow) on demand, so buying it can pave it in a wave;
// re-baked when the Great Drill opens the deep deposits or new art appears.
import { PATCHES, patchOpen } from '../data/land';
import { C } from '../data/palette';
import { CHUNKS } from '../data/land';
import type { Game } from '../sim/Game';
import { sheet, hasArt } from './sprites';
import { art, artSig } from './skyart';

export const TILE = 16;

/** each ore's deposit art (a 2x2 deposit in four quadrants) */
const ORE_ART: Record<string, string> = { ironOre: 'tile_ore_iron', copperOre: 'tile_ore_copper', coal: 'tile_ore_coal', sand: 'tile_ore_sand' };
const ART = ['tile_pave', 'tile_pave_seam', 'tile_pave_edge', 'tile_grass', 'tile_grass_deco', 'tile_plot', 'tile_ore_iron', 'tile_ore_copper', 'tile_ore_coal', 'tile_ore_sand'] as const;

/** Small deterministic hash in [0, 1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Ground {
  private chunks = new Map<string, { c: HTMLCanvasElement; stage: number; sig: number }>();
  constructor(public game: Game) {}

  invalidate() {
    this.chunks.clear();
  }

  /** The baked canvas for a land chunk as it is now (paved if owned, meadow if for sale). */
  chunk(id: string): HTMLCanvasElement {
    return this.bake(id, this.game.s.land.includes(id));
  }

  /** Is (x, y) on a land chunk you own? */
  private ownedAt(x: number, y: number) {
    const ch = CHUNKS.find((c) => x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h);
    return !!ch && this.game.s.land.includes(ch.id);
  }

  /** A land chunk baked paved (owned) or as meadow (for sale), cached both ways (and by which of
   *  its neighbours are owned: a paved lot's edge is a bolted strip against owned land, grass in
   *  the grout against meadow or the rim). */
  bake(id: string, owned: boolean): HTMLCanvasElement {
    const ch = CHUNKS.find((c) => c.id === id)!;
    const stage = this.game.s.mega?.stage ?? 0;
    const sig = artSig(ART);
    // which sides border owned land, sampled at the side's middle (chunks line up edge to edge)
    const mx = ch.x + (ch.w >> 1), my = ch.y + (ch.h >> 1);
    const nb = (this.ownedAt(mx, ch.y - 1) ? 1 : 0) | (this.ownedAt(ch.x + ch.w, my) ? 2 : 0) | (this.ownedAt(mx, ch.y + ch.h) ? 4 : 0) | (this.ownedAt(ch.x - 1, my) ? 8 : 0);
    const key = owned ? `${id}+${nb}` : id + '-';
    let e = this.chunks.get(key);
    if (e && e.stage === stage && e.sig === sig) return e.c;
    const c = document.createElement('canvas');
    c.width = ch.w * TILE;
    c.height = ch.h * TILE;
    const ctx = c.getContext('2d')!;
    const seam = art('tile_pave_seam'), edge = art('tile_pave_edge'), plot = art('tile_plot');
    for (let ty = 0; ty < ch.h; ty++)
      for (let tx = 0; tx < ch.w; tx++) {
        const px = tx * TILE, py = ty * TILE;
        this.tile(ctx, ch.x + tx, ch.y + ty, px, py, owned);
        // the lot's border: a bolted strip on paving against owned land, grass in the grout
        // against land you don't own; the plot's stakes and dashes on meadow
        const n = ty === 0, s = ty === ch.h - 1, w = tx === 0, e2 = tx === ch.w - 1;
        if (owned) {
          // one strip per border between owned lots: this lot draws it on its east and south
          // sides, the owned neighbour on its own (so north and west against owned land: none)
          const side = (on: boolean, bit: number, f: number) => {
            if (!on) return;
            if (nb & bit && (bit === 1 || bit === 8)) return;
            const a = nb & bit ? seam : edge;
            ctx.drawImage(a.frames[f % a.frames.length], px, py);
          };
          side(n, 1, 0);
          side(e2, 2, 1);
          side(s, 4, 2);
          side(w, 8, 3);
        } else if (n || s || w || e2) {
          const f = (n ? 0 : s ? 6 : 3) + (w ? 0 : e2 ? 2 : 1);
          ctx.drawImage(plot.frames[f % plot.frames.length], px, py);
        }
      }
    e = { c, stage, sig };
    this.chunks.set(key, e);
    return c;
  }

  private tile(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, py: number, owned: boolean) {
    const g = this.game;
    const f = (c: string, a: number, b: number, w: number, h: number) => { ctx.fillStyle = c; ctx.fillRect(px + a, py + b, w, h); };
    const ore = g.oreAt(x, y);
    // the floor: paving you own, meadow for sale (a flower or a tuft now and then)
    const floor = art(owned ? 'tile_pave' : 'tile_grass');
    ctx.drawImage(floor.frames[Math.floor(hash2(x, y, 91) * floor.frames.length) % floor.frames.length], px, py);
    if (!owned && !ore && hash2(x, y, 93) < 0.09) {
      const deco = art('tile_grass_deco');
      ctx.drawImage(deco.frames[Math.floor(hash2(x, y, 94) * deco.frames.length) % deco.frames.length], px, py);
    }
    const oreArt = ore ? ORE_ART[ore] ?? 'tile_ore_copper' : null;
    if (ore && oreArt && hasArt(oreArt)) {
      // the outcrop is one 32x32 in four quadrants (TL, TR, BL, BR) after frame 0 (the whole
      // outcrop at 16x16, for the Survey Office): pick by place in the patch
      const p = PATCHES[g.patchOf[y * g.W + x]];
      const s = sheet(oreArt);
      // frames 1-4 sit the outcrop on paving, 5-8 (when the sheet has them) on the meadow
      const seat = !owned && s.frames.length >= 9 ? 4 : 0;
      const fr = (p ? ((x - p.x) % 2) + 2 * ((y - p.y) % 2) : 0) + (s.frames.length >= 5 ? 1 : 0) + seat;
      ctx.drawImage(s.frames[fr % s.frames.length], px, py);
    } else if (ore) {
      const [d, m, l, acc] = ore === 'ironOre' ? [C.deep, C.sky, C.ice, C.rust] : ore === 'coal' ? [C.ink, C.shadow, C.hull1, C.glow] : ore === 'sand' ? [C.ground1, C.copper2, C.hot, C.bone] : [C.rust, C.copper, C.tan, C.lime];
      // four or five lumps per tile, each with a highlight: reads as rock, not floor
      for (let i = 0; i < 5; i++) {
        const lx = 1 + Math.floor(hash2(x, y, 40 + i) * 11), ly = 1 + Math.floor(hash2(x, y, 50 + i) * 11);
        const s = 3 + Math.floor(hash2(x, y, 60 + i) * 2);
        f(C.ink, lx, ly + 1, s, s - 1);
        f(d, lx, ly, s, s - 1);
        f(m, lx, ly, s - 1, s - 2);
        f(l, lx, ly, 1, 1);
        if (hash2(x, y, 70 + i) < 0.4) f(acc, lx + s - 2, ly + s - 3, 1, 1);
      }
    } else {
      // scatter from any open patch whose 4x4 apron holds this tile
      const stage = g.s.mega?.stage ?? 0;
      for (const p of PATCHES) {
        const dx = x - p.x, dy = y - p.y;
        if (dx < -1 || dy < -1 || dx > 2 || dy > 2 || !patchOpen(p, stage)) continue;
        const sp = (ORE_ART[p.item] ?? 'tile_ore_copper') + '_spill';
        if (!hasArt(sp)) continue;
        const ss = sheet(sp);
        // frames 0-15 on paving, 16-31 (when the sheet has them) on the meadow
        ctx.drawImage(ss.frames[(dy + 1) * 4 + (dx + 1) + (!owned && ss.frames.length >= 32 ? 16 : 0)], px, py);
      }
    }
  }
}
