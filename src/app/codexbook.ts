// The Codex (DESIGN.md §24, Milestone 11's screens): Unit 7's collection by tier, and its lore
// pages. The left page has an index down its edge (Tiers I-V with their counts, then the Lore); a
// tier shows its specimens pinned to the page (act2screens.ts `specimen`), the Lore its pages in
// four groups, open ones readable and shut ones with the hint that opens them. The right page:
// Unit 7, the completion overall and tier by tier, and the specimen in hand; on the Lore, the page
// being read in Unit 7's capitals. Unit 7's ending (opened by the first Last Fold) is read from
// here too, and has its own moment (src/app/ending.ts).
import { C, rgba } from '../data/palette';
import { ITEMS, type ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { CODEX_ITEMS, CODEX_PAGES, TIERS, type Tier, type CodexPage, type PageGroup } from '../data/codex';
import { codexCompletion, pageOpen } from '../sim/longtail';
import { ICON, bigWidth, ellipsize, wrapText, smallWidth, LINE_H } from '../ui/font';
import { drawRich, richHeight } from '../ui/rich';
import { T } from '../ui/theme';
import { itemIcon } from '../render/sprites';
import { Num } from '../engine/num';
import { button, meter, rule, pushpin } from './chrome';
import { menuTemplate, fmt } from './widgets';
import { speaker, caption, ledgerRow, titleChip } from './screens';
import { specimen } from './act2screens';
import { indexRow } from './shelf';
import { openEnding } from './endingstate';
import type { App } from './app';
import type { Rect } from '../ui/ui';

export type CodexTab = Tier | 'lore';

const st = { tab: null as CodexTab | null, page: null as string | null };

/** Open the Codex at a tab (and a lore page): e2e and the ending's "Read it in the Codex". */
export function codexTab(tab: CodexTab, page: string | null = null) {
  st.tab = tab;
  if (page) st.page = page;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const GROUP_NAME: Record<PageGroup, string> = { tier: 'specimens', floor: 'floors', island: 'islands', ending: 'the ending' };

/** Unit 7's line on its Codex (ALL CAPS, clipped, counting). */
function unit7Line(app: App, open: boolean, tab: CodexTab): string {
  const g = app.game;
  const c = codexCompletion(g);
  const mult = RULES.codexMult.value;
  if (tab === 'lore') return c.have >= c.total ? 'EVERY PAGE IS UNIT 7\'S. UNIT 7 WROTE THEM. READ SLOWLY.' : 'UNIT 7 KEEPS NOTES. SOME PAGES ARE STILL SHUT.';
  if (!open) return `FILL ONE ORDER FOR UNIT 7. THEN FIRSTS PAY ${mult}X.`;
  if (c.have >= c.total) return 'COLLECTION COMPLETE. UNIT 7 IS... MOVED.';
  const newest = g.s.codex[g.s.codex.length - 1];
  if (!newest) return 'COLLECTION EMPTY. BRING UNIT 7 A FIRST.';
  return `NEW SPECIMEN: ${ITEMS[newest as ItemId].name.toUpperCase()}. COLLECTION ${Math.round(c.frac * 100)}%. PLEASING.`;
}

export function codexBook(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const open = g.s.orders.rep.unit7 >= 1;
  const comp = codexCompletion(g);
  const title = 'The Codex';
  const side = r.w >= 600 ? 200 : 156;
  const { body, detail, free } = menuTemplate(app, r, { title, accent: T.research, icon: 'codex', detail: side });
  titleChip(app, r, title, free, `${comp.have} of ${comp.total}`, 'research');
  // the first opening: the newest specimen's tier (or tier I)
  if (st.tab === null) {
    const newest = g.s.codex[g.s.codex.length - 1] as ItemId | undefined;
    st.tab = (newest && TIERS.find((t) => CODEX_ITEMS[t].includes(newest))) || 1;
  }
  // ---- the index
  const IW = body.w >= 360 ? 70 : 60;
  const rh = 15;
  let iy = body.y;
  for (const t of TIERS) {
    const n = comp.tiers[t];
    if (indexRow(app, 'codexTab:' + t, body.x, iy, IW, rh - 1, `Tier ${ROMAN[t]}`, `${n.have}/${n.total}`, st.tab === t, n.have === n.total, `${n.total} items · ${n.have} logged`)) st.tab = t;
    iy += rh;
  }
  iy += 3;
  rule(ui, body.x + 2, iy - 2, IW - 4, true);
  iy += 2;
  const pages = CODEX_PAGES.filter((p) => pageOpen(g, p)).length;
  if (indexRow(app, 'codexTab:lore', body.x, iy, IW, rh - 1, 'Lore', `${pages}/${CODEX_PAGES.length}`, st.tab === 'lore', pages === CODEX_PAGES.length, "Unit 7's pages: open ones readable")) st.tab = 'lore';
  const page: Rect = { x: body.x + IW + 7, y: body.y, w: body.w - IW - 7, h: body.h };
  ui.ctx.fillStyle = rgba(T.paperEdge, 0.5);
  ui.ctx.fillRect(page.x - 4, page.y, 1, page.h);
  const dp = detail!;
  if (st.tab === 'lore') { loreList(app, page); loreSide(app, dp); return; }
  const hovered = tierPage(app, st.tab, page);
  tierSide(app, dp, st.tab, hovered, open);
}

// ------------------------------------------------------------------ a tier's specimens

function tierPage(app: App, tier: Tier, page: Rect): ItemId | null {
  const g = app.game;
  const items = CODEX_ITEMS[tier];
  const mult = RULES.codexMult.value;
  const n = items.length;
  let cols = Math.max(2, Math.floor((page.w + 4) / 100));
  let rows = Math.ceil(n / cols);
  while (rows > 1 && Math.floor((page.h + 3) / rows) - 3 < 30 && cols < 6) { cols++; rows = Math.ceil(n / cols); }
  const cw = Math.floor((page.w + 4) / cols) - 4;
  const ch = Math.max(24, Math.min(50, Math.floor((page.h + 3) / rows) - 3));
  const newest = g.s.codex[g.s.codex.length - 1];
  let hovered: ItemId | null = null;
  items.forEach((id, i) => {
    const x = page.x + (i % cols) * (cw + 4), y = page.y + Math.floor(i / cols) * (ch + 3);
    if (y + ch > page.y + page.h) return;
    if (specimen(app, id, x, y, cw, ch, id === newest, mult)) hovered = id;
  });
  return hovered;
}

function tierSide(app: App, dp: Rect, tier: Tier, hovered: ItemId | null, open: boolean) {
  const ui = app.ui;
  const g = app.game;
  const comp = codexCompletion(g);
  const mult = RULES.codexMult.value;
  const x = dp.x + 4, w = dp.w - 8;
  let y = dp.y + 2;
  const end = dp.y + dp.h;
  y += speaker(app, 'unit7', unit7Line(app, open, tier), x, y, w) + 6;
  caption(ui, 'the collection', x, y);
  ui.big(`${Math.round(comp.frac * 100)}%`, x + w, y - 2, T.research, { align: 'right' });
  y += 11;
  meter(ui, x, y, w, 6, comp.frac, { role: 'research' });
  y += 10;
  // tier by tier: a small meter each
  for (const t of TIERS) {
    const n = comp.tiers[t];
    const s = `${n.have}/${n.total}`;
    const lw = smallWidth('TIER III') + 5;
    ui.small(`TIER ${ROMAN[t]}`, x, y + 1, t === tier ? T.research : T.inkSoft);
    meter(ui, x + lw, y + 1, w - lw - 26, 4, n.total ? n.have / n.total : 0, { role: n.have === n.total ? 'good' : 'research', glint: false });
    ui.small(s, x + w, y + 1, n.have === n.total ? T.good : T.inkSoft, { align: 'right' });
    y += 8;
  }
  y += 5;
  const logged = g.s.codex;
  const tierNewest = [...logged].reverse().find((id) => CODEX_ITEMS[tier].includes(id as ItemId)) as ItemId | undefined;
  const focus: ItemId | null = hovered ?? tierNewest ?? CODEX_ITEMS[tier][0] ?? null;
  if (focus && y + 44 <= end) {
    const it = ITEMS[focus];
    const isLogged = logged.includes(focus);
    const pays = it.value * mult;
    ui.fill(x, y, 36, 36, T.ink);
    ui.fill(x + 1, y + 1, 34, 34, T.paperHi);
    ui.ctx.drawImage(itemIcon(focus), x + 2, y + 2, 32, 32);
    if (isLogged) pushpin(ui, x + 18, y + 1);
    const nx = x + 42, nw = w - 42;
    if (bigWidth(it.name) <= nw) ui.big(it.name, nx, y + 2, T.ink);
    else ui.text(ellipsize(it.name, nw), nx, y + 3, T.ink);
    drawRich(ui, isLogged ? '{chip:good:CATALOGUED}' : `{chip:coin:FIRST PAYS ${mult}×}`, nx, y + 17, nw, T.ink);
    y += 40;
    const fh = richHeight(it.flavor, w);
    if (y + fh <= end - 24) y += ui.para(it.flavor, x, y, w, T.ink) + 4;
    const rowsF: [string, string][] = [
      [`{i:${focus}} {soft:at the Dock}`, `{coin:${fmt(it.value)}}`],
      ['{soft:first delivery}', isLogged ? `{good:${ICON.check}} {coin:${Num.of(pays).format()}}` : `{coin:${Num.of(pays).format()}}`],
    ];
    for (const [k, v] of rowsF) {
      if (y + LINE_H > end) break;
      y += ledgerRow(ui, k, v, x, y, w);
    }
  }
}

// ------------------------------------------------------------------ the lore

/** The lore pages in their four groups: open ones in ink, shut ones pencilled with a lock. */
function loreList(app: App, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const x = page.x + 2, w = page.w - 4;
  let y = page.y + 1;
  if (!st.page || !CODEX_PAGES.some((p) => p.id === st.page)) st.page = CODEX_PAGES.find((p) => pageOpen(g, p))?.id ?? CODEX_PAGES[0].id;
  const groups: PageGroup[] = ['tier', 'floor', 'island', 'ending'];
  const rows = CODEX_PAGES.length + groups.length;
  const rh = Math.max(11, Math.min(13, Math.floor((page.h - groups.length * 2) / rows)));
  for (const gr of groups) {
    const list = CODEX_PAGES.filter((p) => p.group === gr);
    if (!list.length) continue;
    if (y + rh > page.y + page.h) break;
    caption(ui, GROUP_NAME[gr], x, y + 2, gr === 'ending' ? T.coin : T.inkSoft);
    y += rh;
    for (const p of list) {
      if (y + rh > page.y + page.h) break;
      const o = pageOpen(g, p);
      const on = st.page === p.id;
      const hov = ui.hover(x, y, w, rh);
      ui.mark('lore:' + p.id, x, y, w, rh);
      ui.region(x, y, w, rh, 'button', false);
      if (on || hov) {
        ui.fill(x, y, w, rh, on ? T.paperHi : rgba(T.paperLo, 0.6));
        if (on) ui.fill(x, y, 2, rh, p.group === 'ending' ? T.coin : T.research);
      }
      const s = o ? `{u:codex} ${p.title}` : `{u:lock} {soft:${p.title}}`;
      ui.clip(x + 4, y, w - 6, rh);
      drawRich(ui, s, x + 4, y + Math.floor((rh - 9) / 2), Infinity, T.ink);
      ui.unclip();
      if (hov) {
        ui.tip([{ text: `{big:${p.title}}` }, { text: o ? '{k:LMB} read it' : p.hint }], 190);
        if (ui.clicked) { ui.eat(); ui.sfx('click'); st.page = p.id; }
      }
      y += rh;
    }
    y += 2;
  }
}

/** The page being read: its title, then Unit 7's lines (or, shut, the hint that opens it). */
function loreSide(app: App, dp: Rect) {
  const ui = app.ui;
  const g = app.game;
  const p: CodexPage = CODEX_PAGES.find((q) => q.id === st.page) ?? CODEX_PAGES[0];
  const o = pageOpen(g, p);
  const x = dp.x + 4, w = dp.w - 8;
  let y = dp.y + 2;
  const end = dp.y + dp.h;
  // the title, wrapped in the display face when it fits, else in the body face
  const bl = wrapBig(p.title, w);
  if (bl.length <= 2 && bl.every((l) => bigWidth(l) <= w)) {
    for (const l of bl) { ui.big(l, x, y, o ? T.ink : T.inkSoft); y += 13; }
  } else for (const l of wrapText(p.title, w)) { ui.text(l, x, y, o ? T.ink : T.inkSoft); y += LINE_H; }
  rule(ui, x, y + 1, w, true);
  y += 6;
  if (!o) {
    drawRich(ui, '{chip:soft:SHUT}', x, y, w, T.ink);
    y += 16;
    caption(ui, 'opens when you', x, y);
    y += 10;
    drawRich(ui, p.hint, x, y, w, T.ink);
    return;
  }
  // Unit 7's lines, a gap between them; the ending keeps a key for its moment at the foot
  const foot = p.id === 'ending' ? 22 : 0;
  for (const line of p.lines) {
    const h = richHeight(line, w);
    if (y + h > end - foot) { ui.small('...', x, y, T.inkSoft); break; }
    ui.para(line, x, y, w, T.ink);
    y += h + 4;
  }
  if (p.id === 'ending' && button(ui, 'readEnding', x, end - 18, w, 17, 'The ending, again', { gold: true, icon: 'star', tip: [{ text: "{big:Unit 7's ending}" }, { text: 'its moment, on the night sky' }] })) openEnding(app, true);
  void C;
}

/** Split a title into lines of the display face no wider than w (two at most). */
function wrapBig(s: string, w: number): string[] {
  const words = s.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const word of words) {
    const t = cur ? cur + ' ' + word : word;
    if (bigWidth(t) <= w || !cur) cur = t;
    else { out.push(cur); cur = word; }
  }
  if (cur) out.push(cur);
  return out;
}
