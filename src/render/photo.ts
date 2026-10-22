// Photo mode's picture (Milestone 11, DESIGN.md §24 cosmetics): the whole current floor rendered
// into an offscreen canvas at 1x or 2x, sky and all, with nothing of the HUD and no hover, ghost
// or selection. The Renderer draws it as it draws a frame: its context, size, view and camera are
// pointed at the offscreen canvas for one draw (no time passes) and put back. Nothing in the
// Renderer changes for it.
import type { Game } from '../sim/Game';
import type { Renderer, Overlay } from './renderer';
import type { Floor } from '../sim/world';
import { TOWN_ROWS } from './town';
import { TILE } from './ground';

/** The largest side a photo may have (a browser's canvas limit is far above; a PNG this big is
 * already tens of MB). */
const MAX_SIDE = 6000;

/** An overlay with nothing in hand, nothing hovered and nothing picked: the floor as it stands. */
export function bareOverlay(floor: Floor, high: Overlay['district']['floor']): Overlay {
  return {
    hover: null, build: null, rot: 0, drag: null, remove: false, selected: null, box: null, flow: false, floor,
    factory: { hover: null, place: null, rot: 0, drag: null, remove: false, selected: null, box: null },
    district: { floor: high, hover: null, place: null, remove: false, route: false, from: null, selected: null, selRoute: null, hoverRoute: null, box: null },
  };
}

/** The floor's extent in world px: its island or platform (rim, cliff, underside), and the town on
 * the north rim of the Workshop and the Factory. */
export function floorBounds(r: Renderer, floor: Floor): { x0: number; y0: number; x1: number; y1: number } {
  const hp = r.hplat(floor);
  const B = floor === 'factory' ? r.plat.bounds() : hp ? hp.bounds() : r.isle.bounds();
  const y0 = floor === 'workshop' || floor === 'factory' ? Math.min(B.y0, -(TOWN_ROWS + 1) * TILE) : B.y0;
  return { x0: B.x0, y0, x1: B.x1, y1: B.y1 };
}

/** Render the whole floor at `scale` (1 or 2) into a new canvas. */
export function floorPhoto(r: Renderer, g: Game, ov: Overlay, scale: number): HTMLCanvasElement {
  const b = floorBounds(r, ov.floor);
  let k = Math.max(1, Math.round(scale));
  const ww = Math.max(16, b.x1 - b.x0), hh = Math.max(16, b.y1 - b.y0);
  while (k > 1 && Math.max(ww, hh) * k > MAX_SIDE) k--;
  const W = Math.min(MAX_SIDE, Math.ceil(ww * k)), H = Math.min(MAX_SIDE, Math.ceil(hh * k));
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const cam = r.cam;
  const keep = { ctx: r.ctx, W: r.W, H: r.H, view: { ...r.view }, x: cam.x, y: cam.y, zoom: cam.zoom, shake: r.fx.shake, labels: r.labels.slice(), sounds: r.sounds.length };
  try {
    r.ctx = ctx;
    r.resize(W, H, { x: 0, y: 0, w: W, h: H });
    cam.zoom = k;
    cam.x = (b.x0 + b.x1) / 2;
    cam.y = (b.y0 + b.y1) / 2;
    r.fx.shake = 0;
    r.draw(g, 0, 1, ov);
  } finally {
    r.ctx = keep.ctx;
    r.resize(keep.W, keep.H, keep.view);
    cam.x = keep.x;
    cam.y = keep.y;
    cam.zoom = keep.zoom;
    r.fx.shake = keep.shake;
    r.labels = keep.labels;
    r.sounds.length = keep.sounds;
  }
  return cv;
}
