// Ghosts on the Workshop floor (DESIGN.md §19): buildings planned from a blueprint, drawn as a
// faded sprite in a dashed violet outline, so they never read as built (the readability list in
// §17: a ghost is not a machine). A ghost that can be built now gets a steady outline; one that
// waits (coin, research, land) blinks slowly. While a blueprint is being placed, its parts follow
// the mouse in green (free), grey (already built there) or red (in the way). Drawn in world pixels
// inside the renderer's world pass; reads the Game, never writes it.
import { C, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import type { BlueprintPart } from '../sim/world';
import { BUILD } from '../data/machines';
import { ghostRefusal, partState } from '../sim/blueprints';
import { TILE } from './ground';
import { sheet, drawRot, spriteName } from './sprites';

/** A blueprint following the mouse: its parts with the top-left tile. */
export interface BlueprintPreview { parts: BlueprintPart[]; x: number; y: number }

/** Dashed outline of a w x h tile rect, world px. */
function dashed(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  const X = x * TILE, Y = y * TILE, W = w * TILE, H = h * TILE;
  for (let i = 0; i < W; i += 4) { ctx.fillRect(X + i, Y, 2, 1); ctx.fillRect(X + i, Y + H - 1, 2, 1); }
  for (let i = 0; i < H; i += 4) { ctx.fillRect(X, Y + i, 1, 2); ctx.fillRect(X + W - 1, Y + i, 1, 2); }
}

export function drawGhosts(ctx: CanvasRenderingContext2D, g: Game, time: number, bp: BlueprintPreview | null | undefined) {
  for (const q of g.s.ghosts) {
    const d = BUILD[q.kind];
    const ready = !ghostRefusal(g, q);
    ctx.globalAlpha = 0.35;
    drawRot(ctx, sheet(spriteName(q.kind)), 0, q.x * TILE, q.y * TILE, q.rot);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(C.violet, 0.18);
    ctx.fillRect(q.x * TILE, q.y * TILE, d.w * TILE, d.h * TILE);
    const blink = ready || Math.floor(time * 1.5) % 2 === 0;
    dashed(ctx, q.x, q.y, d.w, d.h, ready ? C.teal1 : blink ? C.violet : rgba(C.violet, 0.4));
  }
  if (!bp) return;
  for (const p of bp.parts) {
    const d = BUILD[p.kind];
    const x = bp.x + p.dx, y = bp.y + p.dy;
    const st = partState(g, p, x, y);
    const col = st === 'built' ? C.fog : st === 'free' ? C.pipGreen : C.pipRed;
    ctx.globalAlpha = st === 'built' ? 0.2 : 0.5;
    drawRot(ctx, sheet(spriteName(p.kind)), 0, x * TILE, y * TILE, p.rot);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(col, 0.2);
    ctx.fillRect(x * TILE, y * TILE, d.w * TILE, d.h * TILE);
    dashed(ctx, x, y, d.w, d.h, col);
  }
}
