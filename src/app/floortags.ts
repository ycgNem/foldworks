// The floor's numbers (docs/hud-180.md "The floor's numbers"): small paper tags on strings, drawn
// in world space each frame and anchored to what they measure. The Dock (coin a minute, the active
// order's portrait and bars, and what the lines bring a minute), the Hopper (the research node and
// its %, and what the lines bring), each power grid (Act II), the
// Megaproject Bay (the Factory). Culled to the view, hung above their anchor so they never cover
// it, nudged apart, an icon and a number at zoom 1. They are floor, not HUD: drawn under every
// piece of the HUD, never blocking a click, outside the overlap audit.
import { ORDER } from '../data/orders';
import { RESEARCH, type ResearchId } from '../data/research';
import { megaStage } from '../data/megaprojects';
import { ITEMS, type ItemId } from '../data/items';
import { DX, DY, type Ent, type FEnt } from '../sim/world';
import { researchFrac, available } from '../sim/systems/research';
import { offeredOrders, orderFrac } from '../sim/systems/orders';
import { megaFrac } from '../render/factory';
import { districtMegaFrac } from '../render/district';
import { megaStageOf, highW } from '../sim/systems/high';
import { capacity, kw } from '../render/powerview';
import { LINE_H } from '../ui/font';
import { layoutRich, drawLayout, richWidth, CHIP_H } from '../ui/rich';
import { T } from '../ui/theme';
import { hasArt, sheet, itemIcon } from '../render/sprites';
import { tag, tagSize, meter, type Role } from './chrome';
import { nodeIcon } from './screens';
import { shipRates, fmtRate } from './topbar';
import { worldRect, zones } from './tags';
import type { Rect } from '../ui/ui';
import type { Layout } from './layout';
import type { App } from './app';

/** One floor tag: what it hangs from, its content size, and how to draw the content. */
interface FloorTag {
  id: string; near: Rect; cw: number; ch: number; draw: (x: number, y: number) => void; hover?: () => void;
  /** hang it under its anchor (a line whose sink is above it) */
  below?: boolean;
  /** hang it beside its anchor with its left edge at this screen x (the District's east margin, so
   *  the Dock's and the Hopper's tags keep off the modules round them: the second gate) */
  east?: number;
}

/** belts' last item, so a line's tag keeps its icon between items */
const lastItem = new Map<number, string>();

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** A text-only tag's content. */
function textTag(app: App, s: string, col: string = T.ink) {
  const L = layoutRich(s);
  return { cw: L.w, ch: L.h - 2, draw: (x: number, y: number) => drawLayout(app.ui, L, x, y, col) };
}

export function floorTags(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  if (app.panel) return;
  const fac = app.floor === 'factory';
  // the District (DESIGN.md §21): its Dock, Hopper and Bay, what the skiffs bring them
  const dist = !!app.high;
  const HF = app.high ?? 'district';
  const tileUi = (16 * app.renderer.cam.zoom) / ui.scale;
  const compact = tileUi < 12;
  const tags: FloorTag[] = [];
  const onScreen = (r: Rect) => r.x + r.w > 0 && r.y + r.h > 0 && r.x < ui.w && r.y < ui.h;
  const near = (e: { x: number; y: number; w: number; h: number }) => worldRect(app, e.x, e.y, e.w, e.h);

  // ---- what the lines bring: each item a minute into the Dock and into the Hopper, one row on
  // that destination's own tag (a tag per belt crowded a busy Dock under eight labels)
  const inflow = { dock: new Map<string, number>(), hopper: new Map<string, number>() };
  if (dist && !compact) {
    for (const r of g.s[HF]?.routes ?? []) {
      const to = g.s[HF]!.ents.find((e) => e.id === r.to);
      if (!to || (to.kind !== 'fdock' && to.kind !== 'fhopper')) continue;
      const m = inflow[to.kind === 'fdock' ? 'dock' : 'hopper'];
      m.set(r.item, (m.get(r.item) ?? 0) + r.flow * 60);
    }
  } else if (!fac && !compact) {
    const rates = shipRates(app);
    const entries: { dest: 'dock' | 'hopper'; item: string }[] = [];
    for (const b of g.belts) {
      const to = g.entAt(b.x + DX[b.rot], b.y + DY[b.rot]);
      if (!to || (to.kind !== 'dock' && to.kind !== 'hopper')) continue;
      if (b.item) lastItem.set(b.id, b.item);
      const item = b.item ?? lastItem.get(b.id);
      if (item) entries.push({ dest: to.kind, item });
    }
    const per = new Map<string, number>();
    for (const e of entries) per.set(e.item, (per.get(e.item) ?? 0) + 1);
    for (const e of entries) {
      const m = inflow[e.dest];
      m.set(e.item, (m.get(e.item) ?? 0) + (rates.get(e.item as ItemId) ?? 0) / (per.get(e.item) ?? 1));
    }
  }
  /** an inflow row: up to `n` items, the busiest first, each its icon and how many a minute */
  const inflowRow = (m: Map<string, number>, n = 4) =>
    [...m.entries()].sort((p, q) => q[1] - p[1]).slice(0, n).map(([it, pm]) => `{i:${it}} ${pm > 0 ? fmtRate(pm) : '{warn:0}'}`).join('  ') + (m.size ? ' {soft:/min}' : '');
  // the District's east margin (the walk east of the floor, where the next lot stands): the Dock's
  // and the Hopper's tags hang there, beside their buildings, and their inflow rows keep to its room
  const eastX = dist ? worldRect(app, highW(g, HF), 0, 0, 0).x + 6 : 0;
  const pad = tagSize(0, 0, 'left').w;
  const eastRow = (m: Map<string, number>) => {
    let n = 4;
    while (n > 1 && dist && eastX + pad + richWidth(inflowRow(m, n)) > ui.w - 2) n--;
    return inflowRow(m, n);
  };

  // ---- the Dock: coin a minute; the active order's portrait and bars; orders waiting
  const dock: Ent | FEnt | undefined = dist ? g.s[HF]?.ents.find((e) => e.kind === 'fdock') : fac ? g.s.factory.ents.find((e) => e.kind === 'fdock') : g.s.ents.find((e) => e.kind === 'dock');
  const selling = g.incomePerMin() > 0 || !!g.s.orders.active || offeredOrders(g).length > 0;
  if (dock && selling) {
    const r = near(dock);
    if (onScreen(r)) {
      const rate = g.incomePerMin();
      const head = rate > 0 ? `{coin} {coinc:+${fmtRate(rate)}/min}` : '{coin} {soft:0/min}';
      const o = g.s.orders;
      const d = o.active ? ORDER[o.active] : null;
      const here = d && (dist ? !d.at || d.at === HF : fac || (d.at !== 'factory' && d.at !== 'district' && d.at !== 'world')) ? d : null;
      const offered = !o.active ? offeredOrders(g).length : 0;
      const hl = layoutRich(head);
      let cw = hl.w, ch = LINE_H - 2;
      const wants = here ? (Object.entries(here.wants) as [ItemId, number][]) : [];
      const pctS = here ? `{u:orders} ${Math.round(orderFrac(g, here.id) * 100)}%` : '';
      const portrait = !!here && !compact && hasArt(`portrait_${here.customer}_small`);
      if (here && compact) { cw = Math.max(cw, richWidth(pctS)); ch += LINE_H; }
      else if (here) { cw = Math.max(cw, (portrait ? 28 : 0) + 74); ch += 3 + Math.max(portrait ? 24 : 0, wants.length * 9); }
      const chipS = offered ? `{chip:good:${offered} offered}` : '';
      if (offered) { cw = Math.max(cw, richWidth(chipS)); ch += CHIP_H + 2; }
      const inS = inflow.dock.size ? eastRow(inflow.dock) : '';
      const il = inS ? layoutRich(inS) : null;
      if (il) { cw = Math.max(cw, il.w); ch += LINE_H; }
      tags.push({
        id: 'dock', near: r, cw, ch, east: dist ? eastX : undefined,
        draw: (x, y) => {
          drawLayout(ui, hl, x, y);
          let yy = y + LINE_H;
          if (il) { drawLayout(ui, il, x, yy, T.inkSoft); yy += LINE_H; }
          if (here && compact) { drawLayout(ui, layoutRich(pctS), x, yy); yy += LINE_H; }
          else if (here) {
            yy += 1;
            let bx = x;
            if (portrait) { ui.ctx.drawImage(sheet(`portrait_${here.customer}_small`).frames[0], x, yy); bx += 28; }
            wants.forEach(([item, n], i) => {
              const have = Math.min(n, Math.floor(o.progress[here.id]?.[item]?.toNumber() ?? 0));
              const iy = yy + i * 9;
              ui.ctx.drawImage(itemIconOf(item), bx, iy);
              const s = `${short(have)}/${short(n)}`;
              const sw = ui.small(s, x + cw, iy + 2, have >= n ? T.good : T.inkSoft, { align: 'right' });
              meter(ui, bx + 10, iy + 1, Math.max(12, x + cw - sw - 3 - (bx + 10)), 6, n > 0 ? have / n : 0, { role: 'good', glint: false });
            });
            yy += Math.max(portrait ? 24 : 0, wants.length * 9) + 2;
          }
          if (offered) drawLayout(ui, layoutRich(chipS), x, yy + 1);
        },
      });
    }
  }

  // ---- the Hopper: the research node, its name and %; a nudge to pick one
  const hop: Ent | FEnt | undefined = dist ? g.s[HF]?.ents.find((e) => e.kind === 'fhopper') : fac ? g.s.factory.ents.find((e) => e.kind === 'fhopper') : g.s.ents.find((e) => e.kind === 'hopper');
  const sel = g.s.research.selected;
  if (hop) {
    const r = near(hop);
    if (onScreen(r)) {
      if (sel) {
        const f = researchFrac(g, sel);
        const p = `{research:${Math.floor(f * 100)}%}`;
        let name = compact ? p : `${RESEARCH[sel].name} ${p}`;
        // in the District's margin a long node name gives way to its % (the node's icon stays)
        if (dist && eastX + pad + 10 + richWidth(name) > ui.w - 2) name = p;
        const nl = layoutRich(name);
        const il = inflow.hopper.size ? layoutRich(eastRow(inflow.hopper)) : null;
        const cw = Math.max(10 + nl.w, il?.w ?? 0), ch = (compact ? LINE_H - 2 : LINE_H + 6) + (il ? LINE_H : 0);
        tags.push({
          id: 'hopper', near: r, cw, ch, east: dist ? eastX : undefined,
          draw: (x, y) => {
            nodeIcon(ui, sel as ResearchId, x, y, true);
            drawLayout(ui, nl, x + 10, y);
            if (!compact) meter(ui, x, y + LINE_H, cw, 5, f, { role: 'research', glint: false });
            if (il) drawLayout(ui, il, x, y + LINE_H + 7, T.inkSoft);
          },
        });
      } else if (!fac && !dist && g.s.research.done.length < Object.keys(RESEARCH).length && g.has('bellows') && Object.keys(RESEARCH).some((id) => available(g, id as ResearchId))) {
        const t = textTag(app, compact ? '{chip:warn:pick} {k:T}' : '{u:research} {chip:warn:pick research} {k:T}');
        tags.push({ id: 'hopper', near: r, cw: t.cw, ch: CHIP_H, draw: t.draw });
      }
    }
  }

  // ---- power grids (Act II): over each grid's first producer, how much of what it wants it gets
  if (!fac && !dist)
    g.grids.forEach((gr, i) => {
      const at = gr.producers[0] ?? gr.poles[0];
      if (!at || (gr.demand <= 0 && !gr.producers.length)) return;
      const r = near(at);
      if (!onScreen(r)) return;
      const cap = capacity(g, gr);
      const role: Role = gr.demand > 0 && cap <= 0 ? 'bad' : gr.sat < 1 ? 'warn' : 'power';
      const s = `{u:power} {${role === 'bad' ? 'bad' : role === 'warn' ? 'warn' : 'power'}:${gr.demand > 0 && cap <= 0 ? 'no fuel' : Math.round(gr.sat * 100) + '%'}}`;
      const t = textTag(app, s);
      const tl: FloorTag = { id: 'grid' + i, near: r, cw: t.cw, ch: t.ch, draw: t.draw };
      // hovered: its supply and demand under the %
      const more = `{power:${kw(cap)}} for ${kw(gr.demand)}`;
      tl.hover = () => {
        const ml = layoutRich(more);
        tl.cw = Math.max(t.cw, ml.w);
        tl.ch = t.ch + LINE_H;
        tl.draw = (x, y) => { t.draw(x, y); drawLayout(ui, ml, x, y + LINE_H); };
      };
      tags.push(tl);
    });

  // ---- the Megaproject Bay (the Factory floor): the stage and its %
  if (fac) {
    const bay = g.s.factory.ents.find((e) => e.kind === 'fbay');
    const st = megaStage(g.s.mega.stage);
    if (bay && st) {
      const r = near(bay);
      if (onScreen(r)) {
        const f = megaFrac(g);
        const t = textTag(app, `{u:mega} ${compact ? '' : `stage ${st.stage} `}{research:${Math.floor(f * 100)}%}`);
        tags.push({ id: 'bay', near: r, cw: Math.max(t.cw, 40), ch: t.ch + (compact ? 0 : 8), draw: (x, y) => { t.draw(x, y); if (!compact) meter(ui, x, y + LINE_H, Math.max(t.cw, 40), 5, f, { role: 'research', glint: false }); } });
      }
    }
  }

  // ---- the District's Bay: the open project's stage and its %
  if (dist) {
    const bay = g.s[HF]?.ents.find((e) => e.kind === 'fbay');
    const mf = districtMegaFrac(g, HF);
    if (bay && mf) {
      const r = near(bay);
      if (onScreen(r)) {
        const st = megaStageOf(g, mf.id);
        const t = textTag(app, `{u:mega} ${compact ? '' : `stage ${st?.stage ?? 1} `}{research:${Math.floor(mf.frac * 100)}%}`);
        tags.push({ id: 'bay', near: r, cw: Math.max(t.cw, 40), ch: t.ch + (compact ? 0 : 8), draw: (x, y) => { t.draw(x, y); if (!compact) meter(ui, x, y + LINE_H, Math.max(t.cw, 40), 5, mf.frac, { role: 'research', glint: false }); } });
      }
    }
  }

  // ---- place them: above the anchor, nudged off each other and the HUD; draw
  // keep off the renderer's labels too (land for sale)
  const placed: Rect[] = app.renderer.labels.map((l) => {
    const w = l.sale ? 140 : 60, h = l.sale ? 34 : 14;
    return { x: l.x / ui.scale - w / 2, y: l.y / ui.scale - h / 2, w, h };
  });
  const prevAudit = ui.audit;
  ui.audit = false;
  try {
    for (const t of tags) {
      if (t.east !== undefined) {
        // beside its anchor in the margin: level with its top, else the nearest free height
        const sz = tagSize(t.cw, t.ch, 'left');
        const x = Math.max(2, Math.min(t.east, ui.w - sz.w - 2));
        const y0 = Math.max(2, Math.min(ui.h - sz.h - 2, t.near.y));
        const free = (y: number) => y >= 2 && y + sz.h <= ui.h - 2 && ![...placed, ...zones].some((p) => overlap({ x, y, w: sz.w, h: sz.h }, p));
        let y = y0;
        for (let d = 0; d <= ui.h; d += 2) {
          if (free(y0 + d)) { y = y0 + d; break; }
          if (free(y0 - d)) { y = y0 - d; break; }
        }
        const b = { x, y, w: sz.w, h: sz.h };
        placed.push(b);
        const anchor = { x: t.near.x + t.near.w - 2, y: Math.max(t.near.y + 2, Math.min(t.near.y + t.near.h - 2, y + 6)) };
        const r = tag(ui, b.x, b.y, b.w, b.h, { hole: 'left', anchor, blocking: false });
        t.draw(r.x, r.y);
        continue;
      }
      const sz0 = tagSize(t.cw, t.ch, 'left');
      let x = Math.round(t.near.x + t.near.w / 2 - 6);
      const top = (hh: number) => (t.below ? t.near.y + t.near.h + 5 : t.near.y - 5 - hh);
      let y = top(sz0.h);
      // hovered: grow to its detail
      if (t.hover && ui.hover(x, y, sz0.w, sz0.h)) t.hover();
      const sz = tagSize(t.cw, t.ch, 'left');
      y = top(sz.h);
      x = Math.max(2, Math.min(x, ui.w - sz.w - 2));
      const box = () => ({ x, y, w: sz.w, h: sz.h });
      for (let k = 0; k < 12 && [...placed, ...zones].some((p) => overlap(box(), p)); k++) {
        const hit = [...placed, ...zones].find((p) => overlap(box(), p))!;
        y = t.below ? hit.y + hit.h + 2 : hit.y - sz.h - 2;
      }
      if (y < 2) y = t.near.y + t.near.h + 5;
      const b = box();
      placed.push(b);
      const anchor = { x: Math.round(t.near.x + t.near.w / 2), y: b.y > t.near.y ? t.near.y + t.near.h - 2 : t.near.y + 1 };
      const r = tag(ui, b.x, b.y, b.w, b.h, { hole: 'left', anchor, blocking: false });
      t.draw(r.x, r.y);
    }
  } finally {
    ui.audit = prevAudit;
  }
  void L;
}

function short(n: number): string {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
}

const itemIconOf = (id: string) => itemIcon(id in ITEMS ? id : 'ironOre');
