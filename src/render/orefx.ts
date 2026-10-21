// Ore glints: the living touch on the Workshop's deposits (the ore revamp, DECISIONS.md). The
// outcrops are baked into the ground (ground.ts); this draws, each frame, a few pixels over them
// in the dynamic layer, before belts and buildings so anything standing on a patch covers them:
// iron a silver glint on a cleavage face, copper a warm gleam on a nugget, coal its embers
// breathing in the cracks, sand a grain catching the light. The points come from the art
// (tile_ore_<ore>.json "glints" and "embers", pixel-art/revamp/ores.py). Stateless: what shows is
// a hash of the patch and the time slot. Tiny (1-3 px) and short, so a glint never reads as a
// Spark (those are lantern stars with motes); only deposits on land you own glint.
import { PATCHES, patchOpen } from '../data/land';
import { C } from '../data/palette';
import type { Game } from '../sim/Game';
import { hash2, TILE } from './ground';

interface OreMeta { glints?: [number, number][]; embers?: [number, number][] }
const META = import.meta.glob('../art/tile_ore_*.json', { eager: true, import: 'default' }) as Record<string, OreMeta>;
const FILE: Record<string, string> = { ironOre: 'iron', copperOre: 'copper', coal: 'coal', sand: 'sand' };

/** per ore: seconds a slot lasts, the chance a slot glints, and how much of the slot it shows */
const BEAT: Record<string, [number, number, number]> = {
  ironOre: [0.9, 0.45, 0.45],
  copperOre: [0.6, 0.6, 0.6],
  coal: [1.6, 0.3, 0.3],
  sand: [0.3, 0.45, 0.6],
};

/** Draw the glints of every open, owned deposit inside the world rect (vx, vy, vw, vh), in px. */
export function drawOreFx(ctx: CanvasRenderingContext2D, g: Game, t: number, vx: number, vy: number, vw: number, vh: number) {
  const stage = g.s.mega?.stage ?? 0;
  const px = (c: string, x: number, y: number) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  for (let i = 0; i < PATCHES.length; i++) {
    const p = PATCHES[i];
    const x0 = p.x * TILE, y0 = p.y * TILE;
    if (x0 + p.w * TILE < vx || y0 + p.h * TILE < vy || x0 > vx + vw || y0 > vy + vh) continue;
    if (!patchOpen(p, stage) || !g.owned(p.x, p.y)) continue;
    const m = META[`../art/tile_ore_${FILE[p.item]}.json`];
    const pts = m?.glints;
    if (pts?.length) {
      const [period, chance, show] = BEAT[p.item] ?? BEAT.ironOre;
      const u = t / period + hash2(i, 3, 5);
      const k = Math.floor(u), f = u - k;
      if (f < show && hash2(i, k, 7) < chance) {
        const [gx, gy] = pts[Math.floor(hash2(i, k, 8) * pts.length) % pts.length];
        const x = x0 + gx, y = y0 + gy, s = f / show;
        if (p.item === 'ironOre') {
          // a silver glint that opens into a small cross and closes
          if (s > 0.25 && s < 0.7) { px(C.steel4, x - 1, y); px(C.steel4, x + 1, y); px(C.steel4, x, y - 1); px(C.steel4, x, y + 1); px(C.bone, x, y); }
          else px(C.steel4, x, y);
        } else if (p.item === 'copperOre') {
          // a warm gleam: the nugget's top flares lantern-bright, a short diagonal flash
          if (s > 0.3 && s < 0.7) { px(C.copper3, x - 1, y + 1); px(C.copper3, x + 1, y - 1); px(C.lamp3, x, y); }
          else px(C.lamp2, x, y);
        } else if (p.item === 'coal') {
          // a cool sheen running along a facet
          px(s < 0.5 ? C.steel3 : C.steel2, x, y);
          if (s > 0.25 && s < 0.75) px(C.steel4, x + 1, y);
        } else {
          // a grain of quartz catching the light
          px(s > 0.3 && s < 0.7 ? C.bone : C.lamp3, x, y);
        }
      }
    }
    // coal's embers breathe slowly, each on its own phase
    const em = m?.embers;
    if (em) for (let j = 0; j < em.length; j++) {
      const b = Math.pow(0.5 + 0.5 * Math.sin(t * 1.1 + j * 2.3 + i), 3);
      if (b < 0.3) continue;
      px(b > 0.92 ? C.lamp2 : b > 0.65 ? C.lamp1 : C.lamp0, x0 + em[j][0], y0 + em[j][1]);
    }
  }
}
