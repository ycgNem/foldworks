// The 180's paper kit, drawn straight to a canvas context (docs/hud-180.md, "The kit"): paper with
// a deckled edge and a soft shadow, tags with a brass grommet and a string, speech bubbles,
// ribbons, the Purse's plank, the ledger book, keycaps and mouse glyphs, the coin, chips, the
// meter with its target notch and the red-ink stamp. No UI bookkeeping here (src/ui/ui.ts and
// src/app/chrome.ts add the overlap audit's records and the click blocking); every shape is
// code-drawn on whole pixels and swapped for the art director's `h180_*` sheets when they exist.
import { C, rgba } from '../data/palette';
import { T, roleInk, roleFill, type Role } from './theme';
import { sheet, hasArt, type SpriteSheet } from '../render/sprites';
import { drawSmall, smallWidth, SMALL_H, drawBig, bigWidth, BIG_H, drawText } from './font';

type Ctx = CanvasRenderingContext2D;

const fill = (ctx: Ctx, c: string, x: number, y: number, w = 1, h = 1) => {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** A stable 0..1 hash of two integers (deckle notches, paper fibres, stamp wear). */
export function hash2(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- 9-slices

/** Draw a 9-slice sheet's frame tiled to w x h (edges and centre repeat, never stretch). */
export function nineRaw(ctx: Ctx, s: SpriteSheet, f: number, x: number, y: number, w: number, h: number) {
  const img = s.frames[Math.min(f, s.frames.length - 1)];
  if (!img) return;
  const [l, t, r, b] = s.slice ?? [4, 4, 4, 4];
  const cw = s.w - l - r, ch = s.h - t - b;
  const iw = w - l - r, ih = h - t - b;
  const part = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
    if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
    for (let yy = 0; yy < dh; yy += sh)
      for (let xx = 0; xx < dw; xx += sw) {
        const pw = Math.min(sw, dw - xx), ph = Math.min(sh, dh - yy);
        ctx.drawImage(img, sx, sy, pw, ph, dx + xx, dy + yy, pw, ph);
      }
  };
  part(0, 0, l, t, x, y, l, t);
  part(l, 0, cw, t, x + l, y, iw, t);
  part(s.w - r, 0, r, t, x + w - r, y, r, t);
  part(0, t, l, ch, x, y + t, l, ih);
  part(l, t, cw, ch, x + l, y + t, iw, ih);
  part(s.w - r, t, r, ch, x + w - r, y + t, r, ih);
  part(0, s.h - b, l, b, x, y + h - b, l, b);
  part(l, s.h - b, cw, b, x + l, y + h - b, iw, b);
  part(s.w - r, s.h - b, r, b, x + w - r, y + h - b, r, b);
}

/** The art director's sheet for a kit piece, when it has loaded. */
export function art(name: string): SpriteSheet | null {
  return hasArt(name) ? sheet(name) : null;
}

// ---------------------------------------------------------------- paper

/** Which side of a piece of paper carries the hole (its corners there are cut). */
export type HoleSide = 'left' | 'right' | 'top' | 'none';

export interface PaperOpts {
  /** the lit face (hovered, or a bubble) */
  hi?: boolean;
  /** the soft ink shadow down-right (default on) */
  shadow?: boolean;
  /** 1 px nicks along the free edges (default on) */
  deckle?: boolean;
  /** corners cut on this side (a tag's head) */
  cut?: HoleSide;
  /** the fill (default T.paper) */
  fill?: string;
  /** the line round it (default T.paperEdge) */
  edge?: string;
  /** a few fibres in the paper (default on for pieces bigger than a chip) */
  fibres?: boolean;
}

/** Row spans of a w x h sheet of paper with the corners on `cut` clipped at 45 degrees. */
function spans(w: number, h: number, cut: HoleSide): [number, number][] {
  const c = cut === 'none' ? 0 : Math.max(0, Math.min(4, Math.floor(Math.min(w, h) / 3)));
  const out: [number, number][] = [];
  for (let j = 0; j < h; j++) {
    let l = 0, r = 0;
    const top = c - j, bot = j - (h - 1 - c);
    const k = Math.max(0, top, bot);
    if (cut === 'left') l = k;
    else if (cut === 'right') r = k;
    else if (cut === 'top' && top > 0) { l = top; r = top; }
    out.push([l, w - r]);
  }
  return out;
}

/** A sheet of paper: shadow, fill, a lit top-left edge, a shaded bottom-right edge, a warm brown
 * line round it with 1 px nicks on its free edges, and a few fibres. */
export function paperRaw(ctx: Ctx, x: number, y: number, w: number, h: number, o: PaperOpts = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w < 3 || h < 3) return;
  const cut = o.cut ?? 'none';
  const S = spans(w, h, cut);
  const edge = o.edge ?? T.paperEdge;
  const face = o.fill ?? (o.hi ? T.paperHi : T.paper);
  const deckle = o.deckle ?? true;
  // nicks: never on the cut side, never within 3 px of a corner
  const nickB = (i: number) => deckle && i > 4 && i < w - 5 && hash2(i, h * 7 + w) < 0.06;
  const nickR = (j: number) => deckle && cut !== 'right' && j > 4 && j < h - 5 && hash2(w * 13 + j, h) < 0.03;
  if (o.shadow ?? true) {
    ctx.fillStyle = rgba(T.shadow, 0.3);
    for (let j = 0; j < h; j++) ctx.fillRect(x + S[j][0] + 2, y + j + 2, S[j][1] - S[j][0], 1);
  }
  // the face
  for (let j = 1; j < h - 1; j++) {
    const [l, r] = S[j];
    fill(ctx, face, x + l + 1, y + j, r - l - 2, 1);
  }
  // shading inside the edge: lit top and left, shaded bottom and right
  if (!o.fill) {
    for (let j = 1; j < h - 1; j++) {
      const [l, r] = S[j];
      if (j === 1) fill(ctx, T.paperHi, x + l + 1, y + j, r - l - 2, 1);
      else fill(ctx, T.paperHi, x + l + 1, y + j, 1, 1);
      if (j === h - 2) fill(ctx, T.paperLo, x + l + 2, y + j, r - l - 3, 1);
      else if (j > 1) fill(ctx, T.paperLo, x + r - 2, y + j, 1, 1);
    }
  }
  // fibres: a few short warm strokes, stable relative to the sheet
  if ((o.fibres ?? true) && w > 24 && h > 14) {
    ctx.fillStyle = rgba(T.paperLo, 0.55);
    const n = Math.floor((w * h) / 260);
    for (let i = 0; i < n; i++) {
      const fx = 3 + Math.floor(hash2(i, w * 31 + h) * (w - 7));
      const fy = 3 + Math.floor(hash2(i + 91, h * 17 + w) * (h - 6));
      const [l, r] = S[fy];
      if (fx <= l + 2 || fx >= r - 3) continue;
      ctx.fillRect(x + fx, y + fy, hash2(i, 5) < 0.5 ? 2 : 1, 1);
    }
  }
  // the line round it
  for (let j = 0; j < h; j++) {
    const [l, r] = S[j];
    if (j === 0) { fill(ctx, edge, x + l, y, r - l, 1); continue; }
    if (j === h - 1) {
      // the bottom edge, nicked: a nick steps the line up one pixel
      let i = l;
      while (i < r) {
        if (nickB(i)) { fill(ctx, edge, x + i, y + j - 1, 1, 1); i++; continue; }
        let k = i;
        while (k < r && !nickB(k)) k++;
        fill(ctx, edge, x + i, y + j, k - i, 1);
        i = k;
      }
      continue;
    }
    fill(ctx, edge, x + l, y + j, 1, 1);
    if (nickR(j)) {
      fill(ctx, edge, x + r - 2, y + j, 1, 1);
    } else fill(ctx, edge, x + r - 1, y + j, 1, 1);
  }
}

// ---------------------------------------------------------------- grommets, strings, pins

/** A brass grommet (7x7) round a punched hole, centred on (cx, cy). */
export function grommetRaw(ctx: Ctx, cx: number, cy: number) {
  const a = art('h180_hole');
  if (a) { ctx.drawImage(a.frames[0], Math.round(cx - a.w / 2), Math.round(cy - a.h / 2)); return; }
  const x = Math.round(cx) - 3, y = Math.round(cy) - 3;
  const P = ['..ddd..', '.dhhgd.', 'dhkkkld', 'dhkkkld', 'dgkkkld', '.dllld.', '..ddd..'];
  const col: Record<string, string> = { d: T.brassDeep, h: T.brassHi, g: T.brass, l: T.brassLo, k: C.ink1 };
  P.forEach((row, j) => { for (let i = 0; i < 7; i++) if (col[row[i]]) fill(ctx, col[row[i]], x + i, y + j); });
}

/** A twine string from (x0, y0) to (x1, y1), sagging under its own weight, 1 px with an ink
 * underside so it reads over the deck and the water alike. */
export function stringRaw(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const sag = Math.min(10, len * 0.12);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag;
  const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy) + sag) * 1.2);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([Math.round(u * u * x0 + 2 * u * t * mx + t * t * x1), Math.round(u * u * y0 + 2 * u * t * my + t * t * y1)]);
  }
  ctx.fillStyle = rgba(C.ink, 0.7);
  for (const [px, py] of pts) ctx.fillRect(px, py + 1, 1, 1);
  ctx.fillStyle = T.woodHi;
  for (const [px, py] of pts) ctx.fillRect(px, py, 1, 1);
}

/** A red pushpin stuck in at (cx, cy): a pinned report. */
export function pushpinRaw(ctx: Ctx, cx: number, cy: number) {
  const a = art('h180_pushpin');
  if (a) { ctx.drawImage(a.frames[0], Math.round(cx - a.ax), Math.round(cy - a.ay)); return; }
  const x = Math.round(cx) - 3, y = Math.round(cy) - 5;
  const P = ['..kkk..', '.krrhk.', 'krrrrrk', 'kRrrrRk', '.kRRRk.', '..kkk..', '...s...', '...s...'];
  const col: Record<string, string> = { k: C.ink, r: C.red, h: C.copper3, R: C.copper0, s: C.steel3 };
  ctx.fillStyle = rgba(C.ink, 0.3);
  ctx.fillRect(x + 3, y + 7, 3, 2);
  P.forEach((row, j) => { for (let i = 0; i < 7; i++) if (col[row[i]]) fill(ctx, col[row[i]], x + i, y + j); });
}

// ---------------------------------------------------------------- tags

export interface TagRawOpts {
  hole?: HoleSide;
  /** where its string runs to (a world point, a HUD object); none: no string */
  anchor?: { x: number; y: number } | null;
  /** pinned: a pushpin through the hole, no string */
  pin?: boolean;
  hover?: boolean;
  shadow?: boolean;
}

/** Room a tag's head takes on its hole side (content starts this far in). */
export const TAG_HEAD = 9;

/** Where a tag's hole sits. */
export function tagHole(x: number, y: number, w: number, h: number, hole: HoleSide): { x: number; y: number } | null {
  if (hole === 'left') return { x: x + 5, y: y + Math.min(Math.floor(h / 2), 9) };
  if (hole === 'right') return { x: x + w - 6, y: y + Math.min(Math.floor(h / 2), 9) };
  if (hole === 'top') return { x: x + Math.floor(w / 2), y: y + 5 };
  return null;
}

/** The side of a w x h tag at (x, y) that faces `anchor`. */
export function holeToward(x: number, y: number, w: number, h: number, anchor: { x: number; y: number }): HoleSide {
  if (anchor.y < y && anchor.x >= x && anchor.x < x + w) return 'top';
  return anchor.x < x + w / 2 ? 'left' : 'right';
}

/** A paper tag: cut corners and a grommet on its head, its string to the anchor (or a pushpin),
 * nicks on its free edges, a soft shadow. */
export function tagRaw(ctx: Ctx, x: number, y: number, w: number, h: number, o: TagRawOpts = {}) {
  x = Math.round(x); y = Math.round(y);
  const hole = o.hole ?? (o.anchor ? holeToward(x, y, w, h, o.anchor) : 'left');
  const hp = tagHole(x, y, w, h, hole);
  if (hp && o.anchor && !o.pin) stringRaw(ctx, hp.x, hp.y, Math.round(o.anchor.x), Math.round(o.anchor.y));
  const a = art('h180_tag');
  if (a) {
    if (o.shadow ?? true) { ctx.fillStyle = rgba(T.shadow, 0.3); ctx.fillRect(x + 2, y + 2, w, h); }
    nineRaw(ctx, a, o.hover ? 1 : 0, x, y, w, h);
  } else paperRaw(ctx, x, y, w, h, { cut: hole, hi: o.hover, shadow: o.shadow });
  if (hp) {
    if (o.pin) pushpinRaw(ctx, hp.x, hp.y);
    else grommetRaw(ctx, hp.x, hp.y);
    // the string passes through the hole: one pixel of it shows on the front
    if (o.anchor && !o.pin) fill(ctx, T.woodHi, hp.x, hp.y, 1, 1);
  }
}

// ---------------------------------------------------------------- speech bubbles

export type TailSide = 'bottom' | 'top' | 'left' | 'right';

/** A speech bubble: cream, an ink line, 2 px rounded corners, a tail toward the speaker on `side`
 * at `at` px along it (from the left or top edge). The tail sticks 6 px out. */
export function bubbleRaw(ctx: Ctx, x: number, y: number, w: number, h: number, side: TailSide = 'bottom', at = 12, shadow = true) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const a = art('h180_bubble');
  const tailArt = art('h180_bubble_tail');
  if (a) {
    if (shadow) { ctx.fillStyle = rgba(T.shadow, 0.3); ctx.fillRect(x + 2, y + 2, w, h); }
    nineRaw(ctx, a, 0, x, y, w, h);
    if (tailArt) {
      const f = side === 'bottom' ? (at < w / 2 ? 0 : 1) : side === 'left' ? 2 : side === 'right' ? 3 : 0;
      const img = tailArt.frames[Math.min(f, tailArt.frames.length - 1)];
      const tw = tailArt.w, th = tailArt.h;
      if (side === 'bottom') ctx.drawImage(img, x + at - Math.floor(tw / 2), y + h - 1);
      else if (side === 'left') ctx.drawImage(img, x - tw + 1, y + at - Math.floor(th / 2));
      else if (side === 'right') ctx.drawImage(img, x + w - 1, y + at - Math.floor(th / 2));
      else {
        ctx.save(); ctx.translate(x + at, y + 1); ctx.scale(1, -1);
        ctx.drawImage(img, -Math.floor(tw / 2), 0); ctx.restore();
      }
      return;
    }
  }
  const face = T.paper;
  const rowSpan = (j: number): [number, number] => (j === 0 || j === h - 1 ? [2, w - 2] : j === 1 || j === h - 2 ? [1, w - 1] : [0, w]);
  // the tail's pixels, as rows (or columns) of [from, to) measured from the edge outward
  const TL = 5;
  const tail: { d: number; a: number; b: number }[] = [];
  // down-left (and left, right): the tail's near edge straight, its far edge slanting to the tip
  const lean = (side === 'bottom' || side === 'top') && at >= w / 2 ? 1 : -1;
  for (let d = 1; d <= TL; d++) tail.push(lean < 0 ? { d, a: at - 3, b: at + 3 - d } : { d, a: at - 3 + d, b: at + 3 });
  // shadow
  if (shadow) {
    ctx.fillStyle = rgba(T.shadow, 0.3);
    for (let j = 0; j < h; j++) { const [l, r] = rowSpan(j); ctx.fillRect(x + l + 2, y + j + 2, r - l, 1); }
    for (const t of tail) {
      if (side === 'bottom') ctx.fillRect(x + t.a + 2, y + h - 1 + t.d + 2, t.b - t.a, 1);
      else if (side === 'top') ctx.fillRect(x + t.a + 2, y - t.d + 2, t.b - t.a, 1);
      else if (side === 'left') ctx.fillRect(x - t.d + 2, y + t.a + 2, 1, t.b - t.a);
      else ctx.fillRect(x + w - 1 + t.d + 2, y + t.a + 2, 1, t.b - t.a);
    }
  }
  // body
  for (let j = 0; j < h; j++) {
    const [l, r] = rowSpan(j);
    if (j === 0 || j === h - 1) { fill(ctx, T.ink, x + l, y + j, r - l, 1); continue; }
    fill(ctx, face, x + l + 1, y + j, r - l - 2, 1);
    fill(ctx, T.ink, x + l, y + j, 1, 1);
    fill(ctx, T.ink, x + r - 1, y + j, 1, 1);
  }
  // a lit inner edge along the top
  fill(ctx, T.paperHi, x + 2, y + 1, w - 4, 1);
  // tail: open the body's line where it joins, then the tail's own lines
  for (const t of tail) {
    const len = t.b - t.a;
    if (side === 'bottom' || side === 'top') {
      const yy = side === 'bottom' ? y + h - 1 + t.d : y - t.d;
      if (t.d === TL || len <= 2) { fill(ctx, T.ink, x + t.a, yy, len, 1); continue; }
      fill(ctx, face, x + t.a + 1, yy, len - 2, 1);
      fill(ctx, T.ink, x + t.a, yy, 1, 1);
      fill(ctx, T.ink, x + t.b - 1, yy, 1, 1);
    } else {
      const xx = side === 'left' ? x - t.d : x + w - 1 + t.d;
      if (t.d === TL || len <= 2) { fill(ctx, T.ink, xx, y + t.a, 1, len); continue; }
      fill(ctx, face, xx, y + t.a + 1, 1, len - 2);
      fill(ctx, T.ink, xx, y + t.a, 1, 1);
      fill(ctx, T.ink, xx, y + t.b - 1, 1, 1);
    }
  }
  const t0 = tail[0];
  if (side === 'bottom') fill(ctx, face, x + t0.a + 1, y + h - 1, t0.b - t0.a - 2, 1);
  else if (side === 'top') fill(ctx, face, x + t0.a + 1, y, t0.b - t0.a - 2, 1);
  else if (side === 'left') fill(ctx, face, x, y + t0.a + 1, 1, t0.b - t0.a - 2);
  else fill(ctx, face, x + w - 1, y + t0.a + 1, 1, t0.b - t0.a - 2);
}

// ---------------------------------------------------------------- ribbons

export type RibbonColor = 'moss' | 'red' | 'teal' | 'violet' | 'gold';
export const RIBBON_COLORS: RibbonColor[] = ['moss', 'red', 'teal', 'violet', 'gold'];

/** Each ribbon's four tones (lit fold, face, shade, line) and the text it carries. */
export const RIBBON: Record<RibbonColor, { hi: string; mid: string; lo: string; line: string; text: string }> = {
  moss: { hi: C.moss3, mid: C.moss2, lo: C.moss1, line: C.moss0, text: C.bone },
  red: { hi: C.copper2, mid: C.copper1, lo: C.copper0, line: C.wood0, text: C.bone },
  teal: { hi: C.water4, mid: C.water3, lo: C.water2, line: C.water1, text: C.bone },
  violet: { hi: C.violet, mid: C.slag1, lo: C.slag0, line: C.ink2, text: C.bone },
  gold: { hi: C.brass3, mid: C.brass2, lo: C.brass0, line: T.brassDeep, text: C.ink },
};

/** The ribbon for a role (a card's title, a tab, a celebration). */
export function ribbonFor(r: Role): RibbonColor {
  switch (r) {
    case 'bad': case 'warn': return 'red';
    case 'research': case 'power': return 'teal';
    case 'reset': return 'violet';
    case 'coin': return 'gold';
    default: return 'moss';
  }
}

/** The swallowtail cut at a ribbon's end: how far in the row `j` of `h` is cut. */
const fork = (j: number, h: number, depth: number) => Math.max(0, depth - Math.abs(j - (h - 1) / 2) * (depth / ((h - 1) / 2)));

/** A ribbon w x h at (x, y). tails 'out': folded tails 6 px past each end, 3 px lower (the
 * ribbon spans x-6 .. x+w+6); 'in': the forks cut into its own ends; 'none': square ends. */
export function ribbonRaw(ctx: Ctx, x: number, y: number, w: number, h: number, color: RibbonColor = 'moss', tails: 'out' | 'in' | 'none' = 'out') {
  x = Math.round(x); y = Math.round(y);
  const P = RIBBON[color];
  const a = art('h180_ribbon');
  if (a) {
    const ci = RIBBON_COLORS.indexOf(color) * 3;
    const L = a.frames[ci], M = a.frames[ci + 1], R = a.frames[ci + 2];
    if (L && M && R) {
      const lw = a.w;
      ctx.drawImage(L, x - (tails === 'out' ? lw : 0), y);
      for (let xx = x + (tails === 'out' ? 0 : lw); xx < x + w - (tails === 'out' ? 0 : lw); xx += a.w) {
        const pw = Math.min(a.w, x + w - (tails === 'out' ? 0 : lw) - xx);
        ctx.drawImage(M, 0, 0, pw, a.h, xx, y, pw, a.h);
      }
      ctx.drawImage(R, x + w - (tails === 'out' ? 0 : lw), y);
      return;
    }
  }
  const row = (xx: number, yy: number, ww: number, j: number, hh: number) => {
    const c = j === 0 || j === hh - 1 ? P.line : j === 1 ? P.hi : j === hh - 2 ? P.lo : P.mid;
    fill(ctx, c, xx, yy, ww, 1);
  };
  if (tails === 'out') {
    // the tails, behind: darker, lower, forked at their outer ends; a fold where they tuck under
    const tw = 7, drop = 3;
    ctx.fillStyle = rgba(T.shadow, 0.3);
    ctx.fillRect(x - tw + 2, y + drop + 2, tw, h);
    ctx.fillRect(x + w - 2 + 2, y + drop + 2, tw, h);
    for (let j = 0; j < h; j++) {
      const f = Math.round(fork(j, h, 3));
      const c = j === 0 || j === h - 1 ? P.line : P.lo;
      fill(ctx, c, x - tw + f, y + drop + j, tw - f + 2, 1);
      fill(ctx, c, x + w - 2, y + drop + j, tw - f + 2, 1);
      // the fork's own line
      if (j > 0 && j < h - 1) { fill(ctx, P.line, x - tw + f, y + drop + j, 1, 1); fill(ctx, P.line, x + w + tw - 1 - f, y + drop + j, 1, 1); }
    }
    // the folds: a dark triangle under each end of the face
    for (let k = 0; k < drop; k++) {
      fill(ctx, P.line, x, y + h + k, drop - k, 1);
      fill(ctx, P.line, x + w - drop + k, y + h + k, drop - k, 1);
    }
  }
  ctx.fillStyle = rgba(T.shadow, 0.3);
  ctx.fillRect(x + 2, y + h, w - 2, 2);
  for (let j = 0; j < h; j++) {
    const f = tails === 'in' ? Math.round(fork(j, h, 3)) : 0;
    row(x + f, y + j, w - 2 * f, j, h);
    if (f > 0 || tails !== 'out') {
      // the ends' own line
      if (j > 0 && j < h - 1) { fill(ctx, P.line, x + f, y + j, 1, 1); fill(ctx, P.line, x + w - 1 - f, y + j, 1, 1); }
    }
  }
}

/** A bookmark ribbon w x h hanging from (x, y): forked at its foot. */
export function bookmarkRaw(ctx: Ctx, x: number, y: number, w: number, h: number, color: RibbonColor | 'paper', lit = false) {
  x = Math.round(x); y = Math.round(y);
  const a = art('h180_bookmark');
  if (a && color !== 'paper') { nineRaw(ctx, a, RIBBON_COLORS.indexOf(color), x, y, w, h); return; }
  const P = color === 'paper' ? { hi: T.paperHi, mid: lit ? T.paperHi : T.paperLo, lo: C.wood4, line: T.paperEdge } : RIBBON[color];
  // the swallowtail: a V cut up into the foot, its tip `depth` rows above the bottom
  const depth = Math.max(2, Math.min(4, Math.floor(w / 4)));
  const half = w / 2;
  const rowSpans = (j: number): [number, number][] => {
    const f = j - (h - depth);
    if (f < 0) return [[0, w]];
    const nw = Math.round(((f + 1) / depth) * (half - 2));
    return [[0, Math.floor(half) - nw], [Math.ceil(half) + nw, w]];
  };
  ctx.fillStyle = rgba(T.shadow, 0.3);
  for (let j = 0; j < h; j++) for (const [a0, b0] of rowSpans(j)) ctx.fillRect(x + a0 + 1, y + j + 1, b0 - a0, 1);
  for (let j = 0; j < h; j++) {
    const S = rowSpans(j);
    const foot = S.length > 1;
    for (const [a0, b0] of S) {
      if (j === h - 1) { fill(ctx, P.line, x + a0, y + j, b0 - a0, 1); continue; }
      fill(ctx, P.mid, x + a0 + 1, y + j, b0 - a0 - 2, 1);
      fill(ctx, P.line, x + a0, y + j, 1, 1);
      fill(ctx, P.line, x + b0 - 1, y + j, 1, 1);
    }
    if (!foot) {
      fill(ctx, lit && color !== 'paper' ? P.hi : P.hi, x + 1, y + j, 1, 1);
      fill(ctx, P.lo, x + w - 2, y + j, 1, 1);
    }
  }
  if (lit && color !== 'paper') { ctx.fillStyle = rgba(C.bone, 0.18); ctx.fillRect(x + 1, y, w - 2, h - depth); }
}

// ---------------------------------------------------------------- the sign (the Purse)

/** A wooden plank on two ropes. The ropes run up from its nails to `ropeTop`. */
export function signRaw(ctx: Ctx, x: number, y: number, w: number, h: number, ropeTop: number | null = null) {
  x = Math.round(x); y = Math.round(y);
  const ra = art('h180_rope');
  const ropeX = [x + 7, x + w - 9];
  if (ropeTop !== null && ropeTop < y + 3) {
    for (const rx of ropeX) {
      if (ra) { for (let yy = ropeTop; yy < y + 3; yy += ra.h) ctx.drawImage(ra.frames[0], 0, 0, ra.w, Math.min(ra.h, y + 3 - yy), rx, yy, ra.w, Math.min(ra.h, y + 3 - yy)); continue; }
      fill(ctx, rgba(C.ink, 0.6), rx - 1, ropeTop, 1, y + 3 - ropeTop);
      fill(ctx, rgba(C.ink, 0.6), rx + 2, ropeTop, 1, y + 3 - ropeTop);
      for (let yy = ropeTop; yy < y + 3; yy++) {
        const k = (yy - ropeTop) % 3;
        fill(ctx, k === 0 ? T.wood : T.woodHi, rx, yy, 1, 1);
        fill(ctx, k === 1 ? T.wood : C.wood3, rx + 1, yy, 1, 1);
      }
    }
  }
  const a = art('h180_sign');
  if (a) {
    ctx.fillStyle = rgba(T.shadow, 0.35); ctx.fillRect(x + 2, y + 2, w, h);
    nineRaw(ctx, a, 0, x, y, w, h);
  } else {
    ctx.fillStyle = rgba(T.shadow, 0.35);
    ctx.fillRect(x + 3, y + 3, w - 1, h - 1);
    // the plank: ink line, rounded 1 px corners, lit top, shaded bottom, grain
    fill(ctx, C.ink, x + 1, y, w - 2, h);
    fill(ctx, C.ink, x, y + 1, w, h - 2);
    fill(ctx, C.wood3, x + 1, y + 1, w - 2, h - 2);
    fill(ctx, T.woodHi, x + 1, y + 1, w - 2, 1);
    fill(ctx, T.woodHi, x + 1, y + 1, 1, h - 3);
    fill(ctx, T.wood, x + 1, y + h - 2, w - 2, 1);
    fill(ctx, T.wood, x + 2, y + h - 3, w - 3, 1);
    for (let j = 4; j < h - 4; j += 3) {
      const gx = Math.floor(hash2(j, w) * (w - 20)) + 4;
      fill(ctx, rgba(T.wood, 0.8), x + gx, y + j, 10 + Math.floor(hash2(j, h) * 14), 1);
      const gx2 = Math.floor(hash2(j + 5, w) * (w - 16)) + 3;
      fill(ctx, rgba(T.woodHi, 0.5), x + gx2, y + j + 1, 6 + Math.floor(hash2(j, 3) * 8), 1);
    }
    // a knot
    const kx = x + 4 + Math.floor(hash2(w, h) * (w - 12));
    fill(ctx, T.wood, kx, y + h - 6, 3, 2);
    fill(ctx, C.wood0, kx + 1, y + h - 6, 1, 1);
  }
  // nails
  for (const rx of ropeX) {
    fill(ctx, C.ink, rx - 1, y + 2, 4, 3);
    fill(ctx, T.brass, rx, y + 2, 2, 2);
    fill(ctx, T.brassHi, rx, y + 2, 1, 1);
  }
}

// ---------------------------------------------------------------- the ledger book

/** The book: a leather cover with brass corners and stitching, two paper pages with a spine
 * shadow at `spine` (a screen x; null: no spine, one page across), the pages' thickness along the
 * foot. Returns the page rects. */
export function bookRaw(ctx: Ctx, x: number, y: number, w: number, h: number, spine: number | null) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  // the cover
  ctx.fillStyle = rgba(T.shadow, 0.4);
  ctx.fillRect(x + 3, y + 3, w, h);
  fill(ctx, C.ink, x + 1, y, w - 2, h);
  fill(ctx, C.ink, x, y + 1, w, h - 2);
  fill(ctx, T.leather, x + 1, y + 1, w - 2, h - 2);
  fill(ctx, T.wood, x + 1, y + 1, w - 2, 1);
  fill(ctx, T.woodLo, x + 1, y + h - 2, w - 2, 1);
  // stitching 2 px in from the edge
  ctx.fillStyle = rgba(C.wood3, 0.9);
  for (let i = x + 4; i < x + w - 4; i += 4) { ctx.fillRect(i, y + 2, 2, 1); ctx.fillRect(i, y + h - 3, 2, 1); }
  for (let j = y + 4; j < y + h - 4; j += 4) { ctx.fillRect(x + 2, j, 1, 2); ctx.fillRect(x + w - 3, j, 1, 2); }
  // brass corners
  for (const [cx, cy, sx, sy] of [[x + 1, y + 1, 1, 1], [x + w - 2, y + 1, -1, 1], [x + 1, y + h - 2, 1, -1], [x + w - 2, y + h - 2, -1, -1]] as const) {
    for (let k = 0; k < 5; k++)
      for (let i = 0; i < 5 - k; i++) fill(ctx, i === 4 - k ? C.ink : k === 0 || i === 0 ? T.brassHi : T.brass, cx + sx * i, cy + sy * k, 1, 1);
  }
  // the pages
  const px = x + 5, py = y + 4, pw = w - 10, ph = h - 10;
  // their thickness at the foot: stacked edges
  fill(ctx, T.paperEdge, px + 1, py + ph, pw - 2, 3);
  fill(ctx, T.paperLo, px + 1, py + ph, pw - 2, 1);
  fill(ctx, T.paper, px + 2, py + ph + 1, pw - 4, 1);
  const left = { x: px, y: py, w: (spine ?? px + pw) - px, h: ph };
  const right = spine !== null ? { x: spine, y: py, w: px + pw - spine, h: ph } : null;
  const pa = art('h180_book');
  if (pa) {
    nineRaw(ctx, pa, 0, left.x, left.y, left.w, left.h);
    if (right) nineRaw(ctx, pa, 1, right.x, right.y, right.w, right.h);
  } else {
    paperRaw(ctx, left.x, left.y, left.w + (right ? 1 : 0), left.h, { shadow: false, deckle: false });
    if (right) paperRaw(ctx, right.x, right.y, right.w, right.h, { shadow: false, deckle: false });
  }
  if (spine !== null) {
    // the gutter: the paper curving down into the spine
    const bands = [0.5, 0.32, 0.18, 0.08];
    bands.forEach((a, i) => {
      ctx.fillStyle = rgba(T.paperLo, a + 0.2);
      ctx.fillRect(spine - 1 - i, py + 1, 1, ph - 2);
      ctx.fillStyle = rgba(T.paperLo, a);
      ctx.fillRect(spine + 1 + i, py + 1, 1, ph - 2);
    });
    fill(ctx, T.paperEdge, spine, py, 1, ph + 2);
    ctx.fillStyle = rgba(C.ink, 0.35);
    ctx.fillRect(spine - 1, py + 1, 1, ph);
  }
  return { left, right };
}

// ---------------------------------------------------------------- keycaps, mouse, coin

/** A keycap's height (an inline key sits 1 px above the text's top and fits its line). */
export const KEY_H = SMALL_H + 5;

const MOUSE: Record<string, number> = { LMB: 0, RMB: 1, WHEEL: 2, MMB: 2 };

/** Is this key drawn as the mouse? */
export const isMouseKey = (k: string) => MOUSE[k.toUpperCase()] !== undefined;

/** A keycap's width for its label (the mouse glyph is 7). */
export function keycapWidth(k: string): number {
  if (isMouseKey(k)) return 7;
  return Math.max(SMALL_H + 3, smallWidth(k.toUpperCase()) + 4);
}

/** A keycap: the key's name in Pip on a little paper key with an ink line and a lip; `down`
 * presses it 1 px. The mouse glyphs (LMB, RMB, WHEEL) draw the mouse with that part inked red.
 * Returns its width. */
export function keycapRaw(ctx: Ctx, k: string, x: number, y: number, down = false): number {
  x = Math.round(x); y = Math.round(y);
  const m = MOUSE[k.toUpperCase()];
  if (m !== undefined) return mouseRaw(ctx, m, x, y);
  const label = k.toUpperCase();
  const w = keycapWidth(k), h = KEY_H;
  const a = art('h180_keycap');
  if (a) {
    nineRaw(ctx, a, down ? 1 : 0, x, y, w, h);
  } else {
    const dy = down ? 1 : 0;
    fill(ctx, C.ink, x + 1, y + dy, w - 2, h - dy);
    fill(ctx, C.ink, x, y + 1 + dy, w, h - 2 - dy);
    fill(ctx, T.paperHi, x + 1, y + 1 + dy, w - 2, h - 4);
    if (!down) fill(ctx, T.paperLo, x + 1, y + h - 3, w - 2, 1);
    fill(ctx, C.wood4, x + 1, y + h - 2, w - 2, down ? 0 : 1);
  }
  const sw = smallWidth(label);
  drawSmall(ctx, label, x + Math.floor((w - sw) / 2), y + 2 + (down ? 1 : 0), T.ink);
  return w;
}

/** The mouse (7x10): 0 the left button inked, 1 the right, 2 the wheel. */
function mouseRaw(ctx: Ctx, which: number, x: number, y: number): number {
  const a = art('h180_mouse');
  if (a) { ctx.drawImage(a.frames[Math.min(which, a.frames.length - 1)], x, y); return a.w; }
  const P = ['..kkk..', '.kLkRk.', 'kLLkRRk', 'kLLkRRk', 'kkkkkkk', 'kbbbbbk', 'kbbbbbk', 'kbbbbbk', '.kbbbk.', '..kkk..'];
  const red = T.badFill;
  const col = (ch: string, i: number, j: number) => {
    if (ch === 'k') return which === 2 && i === 3 && j >= 1 && j <= 3 ? red : C.ink;
    if (ch === 'L') return which === 0 ? red : T.paperHi;
    if (ch === 'R') return which === 1 ? red : T.paperHi;
    if (ch === 'b') return j === 5 ? T.paperHi : j >= 7 ? T.paperLo : T.paper;
    return null;
  };
  P.forEach((row, j) => { for (let i = 0; i < 7; i++) { const c = col(row[i], i, j); if (c) fill(ctx, c, x + i, y + j); } });
  return 7;
}

/** The coin glyph (7x7), brass with a square hole; sits on the text's cap. */
export function coinRaw(ctx: Ctx, x: number, y: number) {
  x = Math.round(x); y = Math.round(y);
  const P = ['..ddd..', '.dhhgd.', 'dhgggld', 'dhgdgld', 'dgggggd', '.dglld.', '..ddd..'];
  const col: Record<string, string> = { d: T.brassDeep, h: T.brassHi, g: T.brass, l: T.brassLo };
  P.forEach((row, j) => { for (let i = 0; i < 7; i++) if (col[row[i]]) fill(ctx, col[row[i]], x + i, y + j); });
}
export const COIN_W = 7;

// ---------------------------------------------------------------- chips

/** A chip: a rounded pill w x h. Default: the lit paper with the role's ink line; `solid`: the
 * role's fill (its text is then light with an ink shadow, or ink on a light fill). */
export function chipRaw(ctx: Ctx, x: number, y: number, w: number, h: number, role: Role, solid = false) {
  x = Math.round(x); y = Math.round(y);
  const a = art('h180_chip');
  const line = solid ? C.ink : role === 'ink' ? T.inkSoft : roleInk(role);
  const face = solid ? roleFill(role) : T.paperHi;
  if (a && !solid) { nineRaw(ctx, a, 0, x, y, w, h); return; }
  for (let j = 0; j < h; j++) {
    const l = j === 0 || j === h - 1 ? 2 : j === 1 || j === h - 2 ? 1 : 0;
    if (j === 0 || j === h - 1) { fill(ctx, line, x + l, y + j, w - 2 * l, 1); continue; }
    fill(ctx, face, x + l + 1, y + j, w - 2 * l - 2, 1);
    fill(ctx, line, x + l, y + j, 1, 1);
    fill(ctx, line, x + w - 1 - l, y + j, 1, 1);
  }
  if (solid) fill(ctx, rgba(C.bone, 0.35), x + 2, y + 1, w - 4, 1);
}

/** The text colour on a chip of this role. */
export function chipText(role: Role, solid: boolean): string {
  if (!solid) return roleInk(role);
  return role === 'warn' || role === 'coin' || role === 'soft' ? C.ink : C.bone;
}

// ---------------------------------------------------------------- the meter (bar)

/** A meter: an ink-lined trough on paper, the fill with a lit top, an optional target notch
 * (`target` 0..1: an ink tick 2 px above the bar and a line through the trough). */
export function meterRaw(ctx: Ctx, x: number, y: number, w: number, h: number, frac: number, col: string, target: number | null = null, glint = -1) {
  x = Math.round(x); y = Math.round(y);
  frac = Math.max(0, Math.min(1, frac));
  fill(ctx, C.ink, x + 1, y, w - 2, h);
  fill(ctx, C.ink, x, y + 1, w, h - 2);
  fill(ctx, T.paperLo, x + 1, y + 1, w - 2, h - 2);
  if (h > 3) fill(ctx, C.wood4, x + 1, y + 1, w - 2, 1);
  const fw = Math.round((w - 2) * frac);
  if (fw > 0) {
    fill(ctx, col, x + 1, y + 1, fw, h - 2);
    if (h > 3) fill(ctx, rgba(C.bone, 0.45), x + 1, y + 1, fw, 1);
    if (h > 4) fill(ctx, rgba(C.ink, 0.22), x + 1, y + h - 2, fw, 1);
    if (glint > 0 && glint < fw - 2) fill(ctx, rgba(C.bone, 0.4), x + 1 + glint, y + 1, 2, h - 2);
  }
  if (target !== null && target >= 0 && target <= 1) {
    const tx = x + 1 + Math.round((w - 3) * target);
    fill(ctx, rgba(C.ink, 0.55), tx, y + 1, 1, h - 2);
    fill(ctx, C.ink, tx - 1, y - 2, 3, 1);
    fill(ctx, C.ink, tx, y - 1, 1, 1);
  }
}

// ---------------------------------------------------------------- the stamp

const stamps = new Map<string, HTMLCanvasElement>();

/** A rubber stamp's impression: a double ink border round the word in the display face, worn
 * in places (cached per text and colour). */
export function stampCanvas(text: string, col: string): HTMLCanvasElement {
  const key = text + '\u0000' + col;
  const hit = stamps.get(key);
  if (hit) return hit;
  const tw = bigWidth(text);
  const w = tw + 12, h = BIG_H + 9;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.fillStyle = col;
  c.fillRect(1, 0, w - 2, 2); c.fillRect(1, h - 2, w - 2, 2); c.fillRect(0, 1, 2, h - 2); c.fillRect(w - 2, 1, 2, h - 2);
  c.fillRect(3, 3, w - 6, 1); c.fillRect(3, h - 4, w - 6, 1); c.fillRect(3, 3, 1, h - 6); c.fillRect(w - 4, 3, 1, h - 6);
  drawBig(c, text, 6, 5, col);
  // wear: ink that didn't take
  c.globalCompositeOperation = 'destination-out';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (hash2(i * 3 + text.length, j * 5 + w) < 0.035) c.fillRect(i, j, 1, 1);
  c.globalCompositeOperation = 'source-over';
  stamps.set(key, cv);
  return cv;
}

/** Draw a stamp centred on (cx, cy) at an integer `scale`, turned `angle` radians. */
export function stampRaw(ctx: Ctx, text: string, cx: number, cy: number, col: string = T.badFill, scale = 1, angle = -0.08, alpha = 0.92) {
  const cv = stampCanvas(text, col);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(cx), Math.round(cy));
  if (angle) ctx.rotate(angle);
  ctx.drawImage(cv, -Math.floor((cv.width * scale) / 2), -Math.floor((cv.height * scale) / 2), cv.width * scale, cv.height * scale);
  ctx.restore();
}

/** Light text with an ink outline (over the floor): the outline in four directions, then the text. */
export function outlinedText(ctx: Ctx, s: string, x: number, y: number, col: string, outline: string = T.floorOutline, scale = 1, big = false) {
  const d = big ? drawBig : drawText;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] as const) d(ctx, s, x + ox * scale, y + oy * scale, outline, scale);
  return d(ctx, s, x, y, col, scale);
}

// ---------------------------------------------------------------- buttons

export type ButtonState = 'up' | 'hover' | 'down' | 'disabled';
export type ButtonKind = 'paper' | 'gold' | 'active';

const BTN: Record<ButtonKind, { face: string; hi: string; hov: string; hovHi: string; lip: string }> = {
  paper: { face: T.paper, hi: T.paperHi, hov: T.paperHi, hovHi: C.lamp3, lip: C.wood4 },
  gold: { face: T.brass, hi: T.brassHi, hov: T.brassHi, hovHi: C.lamp3, lip: C.brass0 },
  active: { face: C.lily, hi: C.moss5, hov: C.moss5, hovHi: C.lily, lip: C.moss3 },
};

/** A paper button: an ink line with 1 px rounded corners, a lit top, a lip under its face;
 * `down` drops the face 1 px onto where the lip was. Gold: brass. Returns the face's y offset. */
export function buttonRaw(ctx: Ctx, x: number, y: number, w: number, h: number, state: ButtonState, kind: ButtonKind = 'paper'): number {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const a = art(kind === 'gold' ? 'h180_button_gold' : 'h180_button');
  const f = state === 'up' ? 0 : state === 'hover' ? 1 : state === 'down' ? 2 : 3;
  if (a && kind !== 'active') { nineRaw(ctx, a, f, x, y, w, h); return state === 'down' ? 1 : 0; }
  const P = BTN[kind];
  const dis = state === 'disabled';
  const down = state === 'down';
  const top = down ? 1 : 0;
  const face = dis ? T.paperLo : state === 'hover' ? P.hov : P.face;
  const hi = dis ? T.paperLo : state === 'hover' ? P.hovHi : P.hi;
  // the line, rounded
  fill(ctx, dis ? T.paperEdge : C.ink, x + 1, y + top, w - 2, h - top);
  fill(ctx, dis ? T.paperEdge : C.ink, x, y + top + 1, w, h - top - 2);
  const fh = down ? h - 3 : h - 4;
  fill(ctx, face, x + 1, y + top + 1, w - 2, fh);
  fill(ctx, hi, x + 1, y + top + 1, w - 2, 1);
  if (!down) fill(ctx, dis ? C.wood4 : P.lip, x + 1, y + h - 3, w - 2, 2);
  if (!down && !dis) fill(ctx, rgba(C.ink, 0.25), x + 1, y + h - 2, w - 2, 1);
  return top;
}
