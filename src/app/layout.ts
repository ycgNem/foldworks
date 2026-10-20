// Where the HUD's regions sit, in UI pixels (the UI redesign, docs/ui-redesign.md and
// DECISIONS.md 2026-10-20): a thin top bar (the coin counter, line health, floor tabs, menus);
// floating cards in a rail on the left (goal, order, research, Megaproject); toasts and the pinned
// report on the right with no column behind them; the build bar centred in a band at the bottom;
// the Swamp Gazette as a crawl along the bottom edge. The floor is drawn behind all of it, and
// the camera frames `center`, the part no card sits on.
import type { Rect } from '../ui/ui';

export interface Layout {
  /** the top bar */
  top: Rect;
  /** the left rail the cards float in (nothing is drawn behind them) */
  rail: Rect;
  /** the bottom band the build bar is centred in (the floor shows on either side of it) */
  band: Rect;
  /** the Gazette's crawl along the bottom edge */
  crawl: Rect;
  /** the toasts and the pinned report, on the right */
  side: Rect;
  /** the floor view the camera frames: right of the rail, between the top bar and the band */
  center: Rect;
  /** full-screen menus: everything between the top bar and the crawl */
  overlay: Rect;
  wide: boolean;
  /** the old names, kept for screens written against them: the crawl, the rail, the side column,
   * the band */
  ticker: Rect;
  left: Rect;
  right: Rect;
  bottom: Rect;
}

export const TOP_H = 20;
export const CRAWL_H = 10;
/** the build bar's band: category tabs (11) over the slot plate (32), and a little air */
export const BAND_H = 46;
export const GAP = 4;

export function layout(w: number, h: number): Layout {
  const wide = w >= 600;
  const railW = wide ? 128 : 116;
  const sideW = wide ? 156 : 136;
  const crawl = { x: 0, y: h - CRAWL_H, w, h: CRAWL_H };
  const band = { x: 0, y: crawl.y - BAND_H, w, h: BAND_H };
  const rail = { x: GAP, y: TOP_H + GAP, w: railW, h: band.y - TOP_H - GAP * 2 };
  const side = { x: w - sideW - GAP, y: TOP_H + GAP, w: sideW, h: band.y - TOP_H - GAP * 2 };
  const cx = rail.x + rail.w + GAP;
  const center = { x: cx, y: TOP_H, w: w - cx, h: band.y - TOP_H };
  const overlay = { x: 2, y: TOP_H + 2, w: w - 4, h: crawl.y - TOP_H - 3 };
  return {
    top: { x: 0, y: 0, w, h: TOP_H }, rail, band, crawl, side, center, overlay, wide,
    ticker: crawl, left: rail, right: side, bottom: band,
  };
}
