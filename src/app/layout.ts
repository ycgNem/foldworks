// Where the HUD's pieces sit, in UI pixels (the 180, docs/hud-180.md "The screen"). No strips, no
// columns: the floor runs edge to edge and the camera frames all of it (`center`). Things hang on
// the corners of it: the Purse top-left (with the rate tag, the trouble bell and the Committee's
// contract slip under it), the lift top-right (slips under it), the speaker's corner bottom-left
// (the portrait on its lily pad, the bubble), the notebook and the Swamp Gazette bottom-right.
// Full-screen menus are the ledger book (`overlay`), which leaves a margin on its right for the
// notebook's section tabs.
import type { Rect } from '../ui/ui';

export interface Layout {
  /** the floor view the camera frames: the whole screen */
  center: Rect;
  /** full-screen menus (the ledger book): nearly the whole screen, the section tabs on its right */
  overlay: Rect;
  /** the section tabs' strip down the book's right edge (bookmark ribbons) */
  tabs: Rect;
  /** the Purse: the sign on its ropes (the rate tag hangs under it) */
  purse: Rect;
  /** where the trouble bell hangs, under the Purse's rate tag */
  bell: Rect;
  /** the lift (the floor dial), top-right */
  lift: Rect;
  /** the slips (toasts) and a pinned report, stacking down under the lift */
  slips: Rect;
  /** the speaker's corner: the portrait on its pad and the bubble beside it, bottom-left */
  corner: Rect;
  /** the portrait's top-left (48x48) */
  portrait: { x: number; y: number };
  /** the notebook (24x24) and the folded Gazette (36x26), bottom-right */
  notebook: Rect;
  newspaper: Rect;
  wide: boolean;
  // ---- the pre-180 names, kept so every file compiles; each now names the piece that took its job
  /** no top bar: a zero-height strip along the top edge */
  top: Rect;
  /** the cards' rail: the speaker's corner */
  rail: Rect;
  /** no build band: a zero-height strip along the bottom edge (the wheel opens at the cursor) */
  band: Rect;
  /** no crawl: the Gazette */
  crawl: Rect;
  /** the toasts' column: the slips */
  side: Rect;
  ticker: Rect;
  left: Rect;
  right: Rect;
  bottom: Rect;
}

export const GAP = 4;
/** the margin on the book's right for the section tabs */
export const TABS_W = 16;
/** kept for old callers: no top bar, no crawl, no band */
export const TOP_H = 0;
export const CRAWL_H = 0;
export const BAND_H = 0;

export function layout(w: number, h: number): Layout {
  const wide = w >= 600;
  const center = { x: 0, y: 0, w, h };
  const overlay = { x: 3, y: 3, w: w - 6 - TABS_W, h: h - 6 };
  const tabs = { x: overlay.x + overlay.w - 2, y: overlay.y + 24, w: TABS_W + 3, h: overlay.h - 30 };
  const purse = { x: 6, y: 7, w: 96, h: 30 };
  const bell = { x: 8, y: purse.y + purse.h + 22, w: 40, h: 22 };
  const lift = { x: w - 6 - 44, y: 6, w: 44, h: 26 };
  const slipW = wide ? 168 : 150;
  const slips = { x: w - 6 - slipW, y: lift.y + lift.h + 6, w: slipW, h: Math.max(40, h - (lift.y + lift.h + 6) - 80) };
  const portrait = { x: 8, y: h - 60 };
  const corner = { x: 4, y: h - 92, w: Math.min(312, Math.floor(w * 0.52)), h: 88 };
  const newspaper = { x: w - 6 - 36, y: h - 6 - 26, w: 36, h: 26 };
  const notebook = { x: newspaper.x + 6, y: newspaper.y - 6 - 24, w: 24, h: 24 };
  const top = { x: 0, y: 0, w, h: 0 };
  const band = { x: 0, y: h, w, h: 0 };
  return {
    center, overlay, tabs, purse, bell, lift, slips, corner, portrait, notebook, newspaper, wide,
    top, rail: corner, band, crawl: newspaper, side: slips, ticker: newspaper, left: corner, right: slips, bottom: band,
  };
}
