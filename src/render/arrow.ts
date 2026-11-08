// The facing arrow on a building's ghost (the playability pass: a 3x3 dot on the front face left
// rotating to trial and error, R pressed two to four times each time). Drawn in world px.
import { C } from '../data/palette';
import { DX, DY, type Dir } from '../sim/world';

/** A bold arrow from (cx, cy) out through a face `half` px away: a 3 px shaft from a quarter of the
 *  way out, and a head 11 px across and 6 deep just past the face, outlined in ink, gold where the
 *  building can go and red where it cannot, nudging a pixel along its way twice a second. */
export function faceArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rot: Dir, half: number, ok: boolean, time: number) {
  const dx = DX[rot], dy = DY[rot], px = -dy, py = dx;
  const bob = Math.floor(time * 4) % 2;
  const pts: [number, number][] = [];
  for (let u = Math.round(half * 0.25); u < half + 1; u++) for (let v = -1; v <= 1; v++) pts.push([u, v]);
  for (let i = 0; i < 6; i++) for (let v = -(5 - i); v <= 5 - i; v++) pts.push([half + 1 + i, v]);
  const at = (u: number, v: number) => [Math.round(cx + dx * (u + bob) + px * v), Math.round(cy + dy * (u + bob) + py * v)] as const;
  ctx.fillStyle = C.ink;
  for (const [u, v] of pts) {
    const [X, Y] = at(u, v);
    ctx.fillRect(X - 1, Y - 1, 3, 3);
  }
  ctx.fillStyle = ok ? C.lamp2 : C.pipRed;
  for (const [u, v] of pts) {
    const [X, Y] = at(u, v);
    ctx.fillRect(X, Y, 1, 1);
  }
}
