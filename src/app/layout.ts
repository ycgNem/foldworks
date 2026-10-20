// Where the HUD's regions sit, in UI pixels (the owner's full-screen layout, DECISIONS.md
// 2026-10-20): the Swamp Gazette ticker across the top, the counter and cards on the left, the
// store on the right, tools and menus along the bottom, and the floor in the frame between.
import type { Rect } from '../ui/ui';

export interface Layout {
  ticker: Rect;
  left: Rect;
  right: Rect;
  bottom: Rect;
  /** the floor view between the columns */
  center: Rect;
  /** full-screen overlays (research tree, orders...) cover everything but the ticker and bottom */
  overlay: Rect;
  wide: boolean;
}

export const TICKER_H = 16;
export const BOTTOM_H = 26;

export function layout(w: number, h: number): Layout {
  const wide = w >= 600;
  const L = wide ? 140 : 124;
  const R = wide ? 160 : 138;
  const top = TICKER_H, bot = h - BOTTOM_H;
  return {
    ticker: { x: 0, y: 0, w, h: TICKER_H },
    left: { x: 0, y: top, w: L, h: bot - top },
    right: { x: w - R, y: top, w: R, h: bot - top },
    bottom: { x: 0, y: bot, w, h: BOTTOM_H },
    center: { x: L, y: top, w: w - L - R, h: bot - top },
    overlay: { x: 0, y: top, w, h: bot - top },
    wide,
  };
}
