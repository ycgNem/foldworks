// The Workshop ground, baked once per land chunk into a canvas (the chunked-ground pattern from
// Trotline). Readability first (DESIGN.md §17): ore patches are outcrops standing up out of the
// deck, owned floor is warm and plain, land you don't own is dark, cool and hatched. Imported tile
// art (src/art/tile_*.png, a strip of variants) is used when present, else code draws it.
// Each ore's outcrop (tile_ore_<ore>, ores.py) is one 32x32 cut in quadrants and drawn over the
// deck; its spill sheet (tile_ore_<ore>_spill, the 4x4 tiles round the patch) puts a few pebbles,
// stains, cracks or drift on the deck tiles beside it (never on another patch). Re-baked when land
// is bought or the Great Drill opens the deep deposits.
import { PATCHES, patchOpen } from '../data/land';
import { C, rgba } from '../data/palette';
import { CHUNKS } from '../data/land';
import type { Game } from '../sim/Game';
import { sheet, hasArt } from './sprites';

export const TILE = 16;

/** each ore's deposit art (a 2x2 deposit in four quadrants) */
const ORE_ART: Record<string, string> = { ironOre: 'tile_ore_iron', copperOre: 'tile_ore_copper', coal: 'tile_ore_coal', sand: 'tile_ore_sand' };

/** Small deterministic hash in [0, 1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Ground {
  private chunks = new Map<string, { c: HTMLCanvasElement; owned: boolean; stage: number }>();
  constructor(public game: Game) {}

  invalidate() {
    this.chunks.clear();
  }

  /** The baked canvas for a land chunk (rebaked when its ownership changed). */
  chunk(id: string): HTMLCanvasElement {
    const ch = CHUNKS.find((c) => c.id === id)!;
    const owned = this.game.s.land.includes(id);
    const stage = this.game.s.mega?.stage ?? 0;
    let e = this.chunks.get(id);
    if (e && e.owned === owned && e.stage === stage) return e.c;
    const c = document.createElement('canvas');
    c.width = ch.w * TILE;
    c.height = ch.h * TILE;
    const ctx = c.getContext('2d')!;
    for (let ty = 0; ty < ch.h; ty++)
      for (let tx = 0; tx < ch.w; tx++) this.tile(ctx, ch.x + tx, ch.y + ty, tx * TILE, ty * TILE, owned);
    // the chunk's edge: a dark seam so chunks read as lots of land
    ctx.fillStyle = rgba(C.ink, owned ? 0.35 : 0.6);
    ctx.fillRect(0, 0, c.width, 1);
    ctx.fillRect(0, 0, 1, c.height);
    e = { c, owned, stage };
    this.chunks.set(id, e);
    return c;
  }

  private tile(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, py: number, owned: boolean) {
    const g = this.game;
    const f = (c: string, a: number, b: number, w: number, h: number) => { ctx.fillStyle = c; ctx.fillRect(px + a, py + b, w, h); };
    const specks = (c: string, n: number, s: number) => {
      for (let i = 0; i < n; i++) f(c, Math.floor(hash2(x, y, s + i * 2) * 16), Math.floor(hash2(x, y, s + i * 2 + 1) * 16), 1, 1);
    };
    const ore = g.oreAt(x, y);
    const art = ore ? ORE_ART[ore] ?? 'tile_ore_copper' : 'tile_floor';
    if (hasArt(art) && hasArt('tile_floor')) {
      const fl = sheet('tile_floor');
      ctx.drawImage(fl.frames[Math.floor(hash2(x, y, 91) * fl.frames.length) % fl.frames.length], px, py);
      if (ore) {
        // the outcrop is one 32x32 in four quadrants (TL, TR, BL, BR) after frame 0 (the whole
        // outcrop at 16x16, for the Survey Office): pick by place in the patch
        const p = PATCHES[g.patchOf[y * g.W + x]];
        const s = sheet(art);
        const fr = (p ? ((x - p.x) % 2) + 2 * ((y - p.y) % 2) : 0) + (s.frames.length >= 5 ? 1 : 0);
        ctx.drawImage(s.frames[fr % s.frames.length], px, py);
      } else {
        // scatter from any open patch whose 4x4 apron holds this tile
        const stage = g.s.mega?.stage ?? 0;
        for (const p of PATCHES) {
          const dx = x - p.x, dy = y - p.y;
          if (dx < -1 || dy < -1 || dx > 2 || dy > 2 || !patchOpen(p, stage)) continue;
          const sp = (ORE_ART[p.item] ?? 'tile_ore_copper') + '_spill';
          if (hasArt(sp)) ctx.drawImage(sheet(sp).frames[(dy + 1) * 4 + (dx + 1)], px, py);
        }
      }
    } else {
      // packed workshop floor: warm earth with flecks and a faint board line every other row
      f(C.umber, 0, 0, 16, 16);
      specks(C.clay, 7, 11);
      specks(C.bark, 5, 23);
      if (y % 2 === 0) f(rgba(C.bark, 0.5) as string, 0, 15, 16, 1);
      if (ore) {
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
      }
    }
    if (!owned) {
      // land you don't own: darkened, cooled and hatched
      ctx.fillStyle = rgba(C.night, 0.62);
      ctx.fillRect(px, py, 16, 16);
      ctx.fillStyle = rgba(C.slate, 0.55);
      for (let i = 0; i < 16; i++) {
        const k = (i + x * 16 + y * 16) % 6;
        if (k === 0) for (let j = 0; j < 16; j++) if ((i + j) % 16 < 1) ctx.fillRect(px + j, py + i, 1, 1);
      }
      for (let d = -16; d < 16; d += 6) for (let j = 0; j < 16; j++) { const xx = j, yy = j + d + ((x + y) % 2) * 3; if (yy >= 0 && yy < 16) ctx.fillRect(px + xx, py + yy, 1, 1); }
    }
  }
}
