// Immediate-mode UI kit drawn on the canvas in "UI pixels" (screen / scale). From the Sprocket &
// Sprout engine layer by way of Trotline, recoloured for Foldworks. With `audit` on it records
// every text, panel, button and opaque fill a frame draws, for the overlap audit
// (src/ui/audit.ts, npm run screens).
import { C, rgba } from '../data/palette';
import type { Input } from '../engine/input';
import { drawText, drawSmall, textWidth, smallWidth, wrapText, LINE_H, FONT_H, SMALL_H } from './font';
import type { AuditRec, AuditKind } from './audit';

export interface Rect { x: number; y: number; w: number; h: number }
export interface TipLine { text: string; color?: string }

/** A tooltip placed around things it must not cover: `avoid` (the hovered tile and its
 * neighbours, the tile the goal points at), staying inside `bounds` where it can. */
export interface TipPlace { avoid: Rect[]; bounds?: Rect }

export type PanelStyle = 'dark' | 'raised' | 'inset' | 'paper';

export class UI {
  ctx!: CanvasRenderingContext2D;
  input!: Input;
  scale = 2;
  w = 0;
  h = 0;
  mx = 0;
  my = 0;
  /** the mouse is over UI drawn last frame (so world drags and clicks don't fall through) */
  captured = false;
  private blocks: Rect[] = [];
  /** every button drawn last frame, by id (the e2e scripts click them by name) */
  ids = new Map<string, Rect>();
  private nextIds = new Map<string, Rect>();
  private prevBlocks: Rect[] = [];
  tooltip: TipLine[] | null = null;
  /** paints a tooltip's box when set (the app hands over its 9-slice art); else the kit's own */
  tipSkin: ((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void) | null = null;
  tipWidth = 180;
  /** where this frame's tooltip may not sit, and the room it should stay in (a world tooltip:
   * clear of the hovered tile, its neighbours and the goal's tile; see `tip`) */
  private tipPlace: TipPlace | null = null;
  time = 0;
  clicked = false;
  rclicked = false;
  dt = 1 / 60;
  hoverId: string | null = null;
  sfx: (id: string) => void = () => {};
  /** debug: record what each frame draws for the overlap audit */
  audit = false;
  /** the last complete frame's records, while audit is on */
  lastAudit: AuditRec[] = [];
  private auditLog: AuditRec[] = [];
  private auditLayer: AuditRec['layer'] = 'ui';
  private clips: Rect[] = [];

  private rec(kind: AuditKind, x: number, y: number, w: number, h: number, s?: string) {
    this.auditLog.push({ kind, x, y, w, h, s, clip: this.clips[this.clips.length - 1], layer: this.auditLayer, seq: this.auditLog.length });
  }

  /** Start a UI frame. With `clear` false the UI draws over what is already on the canvas. */
  begin(ctx: CanvasRenderingContext2D, input: Input, scale: number, dt: number, clear = true) {
    this.ctx = ctx;
    this.input = input;
    this.scale = scale;
    this.w = Math.floor(ctx.canvas.width / scale);
    this.h = Math.floor(ctx.canvas.height / scale);
    const k = ctx.canvas.width / (ctx.canvas.clientWidth || ctx.canvas.width);
    this.mx = Math.floor((input.mouse.x * k) / scale);
    this.my = Math.floor((input.mouse.y * k) / scale);
    this.time += dt;
    this.dt = dt;
    this.tooltip = null;
    this.tipPlace = null;
    this.prevBlocks = this.blocks;
    this.ids = this.nextIds;
    this.nextIds = new Map();
    this.blocks = [];
    this.captured = this.prevBlocks.some((b) => this.inside(b));
    this.clicked = input.mouse.pressed[0];
    this.rclicked = input.mouse.pressed[2];
    this.hoverId = null;
    if (this.audit) {
      this.lastAudit = this.auditLog;
      this.auditLog = [];
      this.clips = [];
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (clear) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  /** Is this UI-pixel point under something the last finished frame drew? (Call before begin.) */
  blockedAt(x: number, y: number) {
    return this.blocks.some((b) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h);
  }

  /** mouse captured by UI drawn this frame (call after drawing) */
  get overUI() {
    return this.blocks.some((b) => this.inside(b)) || this.captured;
  }

  inside(r: Rect) {
    return this.mx >= r.x && this.my >= r.y && this.mx < r.x + r.w && this.my < r.y + r.h;
  }

  hover(x: number, y: number, w: number, h: number) {
    return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h;
  }

  block(x: number, y: number, w: number, h: number) {
    this.blocks.push({ x, y, w, h });
  }

  /** consume the left click (so it doesn't fall through) */
  eat() {
    this.clicked = false;
    this.input.consumeMouse(0);
  }

  fill(x: number, y: number, w: number, h: number, color: string, a = 1) {
    if (this.audit && a >= 0.85 && w > 2 && h > 2) this.rec('fill', x, y, w, h);
    this.ctx.fillStyle = a >= 1 ? color : rgba(color, a);
    this.ctx.fillRect(x, y, w, h);
  }

  panel(x: number, y: number, w: number, h: number, style: PanelStyle = 'dark', blocking = true) {
    x = Math.round(x);
    y = Math.round(y);
    if (blocking) this.block(x, y, w, h);
    if (this.audit) this.rec('panel', x, y, w, h);
    switch (style) {
      case 'dark':
        this.fill(x, y, w, h, C.night, 0.92);
        this.fill(x, y, w, 1, C.iron);
        this.fill(x, y + h - 1, w, 1, C.ink);
        this.fill(x, y, 1, h, C.iron);
        this.fill(x + w - 1, y, 1, h, C.ink);
        break;
      case 'raised':
        this.fill(x, y, w, h, C.ink);
        this.fill(x + 1, y + 1, w - 2, h - 2, C.slate);
        this.fill(x + 1, y + 1, w - 2, 1, C.steel);
        this.fill(x + 1, y + h - 2, w - 2, 1, C.night);
        break;
      case 'inset':
        this.fill(x, y, w, h, C.ink, 0.9);
        this.fill(x, y, w, 1, C.night);
        this.fill(x, y, 1, h, C.night);
        break;
      case 'paper':
        this.fill(x, y, w, h, C.ink);
        this.fill(x + 1, y + 1, w - 2, h - 2, C.cream);
        this.fill(x + 1, y + 1, w - 2, 1, C.bone);
        this.fill(x + 1, y + h - 2, w - 2, 1, C.tan);
        break;
    }
  }

  text(s: string, x: number, y: number, c: string = C.bone, opts: { scale?: number; shadow?: string; align?: 'left' | 'center' | 'right'; small?: boolean } = {}) {
    if (opts.small) return this.small(s, x, y, c, opts);
    const sc = opts.scale ?? 1;
    let tx = x;
    if (opts.align === 'center') tx = x - Math.floor((textWidth(s) * sc) / 2);
    else if (opts.align === 'right') tx = x - textWidth(s) * sc;
    if (this.audit && s.trim()) this.rec('text', Math.round(tx), Math.round(y), textWidth(s) * sc, FONT_H * sc, s);
    return drawText(this.ctx, s, Math.round(tx), Math.round(y), c, sc, opts.shadow ?? null);
  }

  /** Small-font text (5 px capitals: labels, keys, prices). Returns the width drawn. */
  small(s: string, x: number, y: number, c: string = C.hull2, opts: { shadow?: string; align?: 'left' | 'center' | 'right' } = {}) {
    const w = smallWidth(s);
    const tx = opts.align === 'center' ? x - Math.floor(w / 2) : opts.align === 'right' ? x - w : x;
    if (this.audit && s.trim()) this.rec('text', Math.round(tx), Math.round(y), w, SMALL_H, s);
    return drawSmall(this.ctx, s, Math.round(tx), Math.round(y), c, opts.shadow ?? null);
  }

  /** wrapped paragraph; returns height used */
  para(s: string, x: number, y: number, w: number, c: string = C.bone, lineH = LINE_H): number {
    const lines = wrapText(s, w);
    lines.forEach((l, i) => this.text(l, x, y + i * lineH, c));
    return lines.length * lineH;
  }

  button(id: string, x: number, y: number, w: number, h: number, label: string, opts: { disabled?: boolean; active?: boolean; tip?: TipLine[] | string; accent?: string; color?: string } = {}): boolean {
    const hov = this.hover(x, y, w, h) && !opts.disabled;
    const down = hov && this.input.mouse.down[0];
    if (this.audit) this.rec('button', x, y, w, h);
    const base = opts.disabled ? C.night : opts.active ? (opts.accent ?? C.clay) : C.iron;
    const hi = opts.disabled ? C.slate : opts.active ? C.copper : C.steel;
    this.fill(x, y, w, h, C.ink);
    this.fill(x + 1, y + 1, w - 2, h - 2, hov ? hi : base);
    if (!down) {
      this.fill(x + 1, y + 1, w - 2, 1, hov ? C.fog : hi);
      this.fill(x + 1, y + h - 2, w - 2, 1, C.night);
    }
    if (label) {
      const col = opts.disabled ? C.fog : (opts.color ?? C.bone);
      this.text(label, x + w / 2, y + Math.floor((h - 7) / 2) + (down ? 1 : 0), col, { align: 'center', shadow: opts.disabled ? undefined : C.ink });
    }
    if (hov) {
      this.hoverId = id;
      if (opts.tip) this.tip(typeof opts.tip === 'string' ? [{ text: opts.tip }] : opts.tip);
    }
    if (hov && this.clicked) {
      this.eat();
      this.sfx('click');
      return true;
    }
    return false;
  }

  /** Claim a region drawn by custom code: it blocks world clicks and is recorded for the audit as a
   * panel (or a button) so text inside it is checked for overflow. */
  region(x: number, y: number, w: number, h: number, kind: 'panel' | 'button' = 'panel', blocking = true) {
    if (blocking) this.block(x, y, w, h);
    if (this.audit) this.rec(kind, x, y, w, h);
  }

  /** remember where a button with this id was drawn (for e2e) */
  mark(id: string, x: number, y: number, w: number, h: number) {
    this.nextIds.set(id, { x, y, w, h });
  }

  /** a tooltip shown while the mouse is over a rect (no click behaviour) */
  hint(x: number, y: number, w: number, h: number, lines: TipLine[] | string, width = 180) {
    if (this.hover(x, y, w, h)) this.tip(typeof lines === 'string' ? [{ text: lines }] : lines, width);
  }

  tip(lines: TipLine[], width = 180, place: TipPlace | null = null) {
    this.tooltip = lines;
    this.tipWidth = width;
    this.tipPlace = place;
  }

  bar(x: number, y: number, w: number, h: number, frac: number, col: string, bg: string = C.ink) {
    this.fill(x, y, w, h, bg);
    this.fill(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, frac))), h - 2, col);
  }

  clip(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    if (this.audit) this.clips.push({ x, y, w, h });
  }
  unclip() {
    this.ctx.restore();
    if (this.audit) this.clips.pop();
  }

  /** Draw something that floats above the layout on purpose. 'tip' (a refusal under the cursor,
   * something sliding in): the overlap audit treats it like a tooltip and checks nothing. 'float'
   * (a toast at rest): it may lie over the floor, but the audit checks it stays on screen, fits its
   * own plate and covers no other HUD text (the UI legibility round). */
  floating(draw: () => void, layer: 'tip' | 'float' = 'tip') {
    const prev = this.auditLayer;
    this.auditLayer = layer;
    draw();
    this.auditLayer = prev;
  }

  /** Queue something to draw over everything at the end of the frame, on the tooltip layer (a
   * rich hover card, a drop-down): it floats, so the overlap audit treats it like a tooltip. A
   * floating card replaces the plain tooltip for that frame. */
  later(draw: () => void) {
    this.deferred.push(draw);
  }
  private deferred: (() => void)[] = [];

  end() {
    // the tooltip floats above the UI on purpose
    this.auditLayer = 'tip';
    const d = this.deferred;
    this.deferred = [];
    for (const f of d) f();
    if (!d.length && this.tooltip && this.tooltip.length) this.drawTip(this.tooltip);
    this.auditLayer = 'ui';
  }

  /** A spot for a w x h tooltip that covers none of `avoid`: beside the avoided area on the
   * cursor's row (right, then left), then above it, then below; inside `bounds` first, then
   * anywhere on screen. Null when nothing fits (the default spot then). */
  private placeTip(w: number, h: number, p: TipPlace): { x: number; y: number } | null {
    const A = p.avoid;
    if (!A.length) return null;
    const near = A[0];
    const L = near.x - 4 - w, R = near.x + near.w + 4, U = near.y - 4 - h, D = near.y + near.h + 4;
    const cy = this.my - Math.floor(h / 2), cx = this.mx - Math.floor(w / 2);
    const cand = [
      { x: R, y: cy }, { x: L, y: cy }, { x: cx, y: U }, { x: cx, y: D },
      { x: R, y: U + h - 8 }, { x: L, y: U + h - 8 }, { x: R, y: near.y + 8 }, { x: L, y: near.y + 8 },
    ];
    const hits = (x: number, y: number) => A.some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
    const screen = { x: 2, y: 2, w: this.w - 4, h: this.h - 4 };
    for (const b of p.bounds ? [p.bounds, screen] : [screen])
      for (const c of cand) {
        // slide along the free axis to stay in bounds, then test
        const x = Math.max(b.x, Math.min(c.x, b.x + b.w - w));
        const y = Math.max(b.y, Math.min(c.y, b.y + b.h - h));
        if (w > b.w || h > b.h) continue;
        if (!hits(x, y)) return { x, y };
      }
    return null;
  }

  private drawTip(lines: TipLine[]) {
    const maxW = this.tipWidth;
    const wrapped: { text: string; color: string }[] = [];
    for (const l of lines) for (const t of wrapText(l.text, maxW)) wrapped.push({ text: t, color: l.color ?? C.bone });
    let w = 0;
    for (const l of wrapped) w = Math.max(w, textWidth(l.text));
    w += 10;
    const h = wrapped.length * LINE_H + 8;
    let x = this.mx + 12, y = this.my + 12;
    if (x + w > this.w) x = this.mx - w - 4;
    if (y + h > this.h) y = this.h - h - 2;
    x = Math.max(2, x);
    y = Math.max(2, y);
    const placed = this.tipPlace ? this.placeTip(w, h, this.tipPlace) : null;
    if (placed) ({ x, y } = placed);
    this.fill(x + 2, y + 2, w, h, C.ink, 0.4);
    if (this.tipSkin) this.tipSkin(this.ctx, x, y, w, h);
    else {
      this.fill(x, y, w, h, C.ink);
      this.fill(x + 1, y + 1, w - 2, h - 2, C.night);
      this.fill(x + 1, y + 1, w - 2, 1, C.amber);
    }
    wrapped.forEach((l, i) => this.text(l.text, x + 5, y + 5 + i * LINE_H, l.color));
  }
}
