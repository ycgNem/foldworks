// The notebook's pages (docs/hud-180.md, "Full-screen menus: the ledger book"): the research tree
// drawn in pencil on paper, the Inspector's statistics ledger, Bramble's sticker page of trophies,
// the options and the drawn keyboard, each in the one menu template (widgets.ts menuTemplate: the
// ledger book, its bookmark tabs, a title in Bullfrog, an optional right page). Ink on paper:
// headings in Bullfrog, captions in Pip, rows of icons, chips and meters, lists ruled in faint
// pencil, the selected row underlined in pencil. Sentences only in a speaker's bubble.
// Also the page kit the Act II pages share (speaker, caption, discs, pencil lines and circles).
import { C, rgba } from '../data/palette';
import { RESEARCH, RESEARCH_LIST, type ResearchId } from '../data/research';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { TROPHIES, type TrophyDef } from '../data/trophies';
import { BUILD_BAR } from '../data/machines';
import { IDLE } from '../data/idle';
import { ICON, textWidth, smallWidth, bigWidth, ellipsize, hasSmallGlyph, LINE_H } from '../ui/font';
import { keyLabel } from '../engine/input';
import { itemIcon, sheet, hasArt } from '../render/sprites';
import { available, researchFrac } from '../sim/systems/research';
import { worldOf } from '../sim/systems/islands';
import { WORLDS, type WorldId } from '../data/worlds';
import { inspireUnlocked, inspiredFrac } from '../sim/systems/inspire';
import { megaComplete } from '../sim/systems/research';
import { hasKernel } from '../sim/kernels';
import { KERNELS } from '../data/kernels';
import { MEGAS } from '../data/megaprojects';
import { trophyValue } from '../sim/systems/stats';
import { Num } from '../engine/num';
import { button, meter, portrait, uiIcon, bubble, chip, chipWidth, rule, pencil, label, roleInk, T, type UIconName, type Role } from './chrome';
import { fmt, menuTemplate, type MenuTab, type IconName } from './widgets';
import type { Layout } from './layout';
import { modulesScreen, gradeCard, fgradeCard, sliceEndCard } from './fold';
import { ordersScreen } from './orders';
import { codexScreen, surveyScreen, megaScreen } from './act2screens';
import type { App } from './app';
import type { Rect, TipLine, UI } from '../ui/ui';
import { drawRich, richHeight, richWidth, CAP_H, BIG_CAP_H, CHIP_H } from '../ui/rich';
// ---- Milestone 6 (idle and offline): the offline report, the overnight forecast, notation
import { offlineReportCard } from './offlinereport';
import { overnightScreen } from './overnight';
import { cycleNotation, NOTATION_LABEL, cycleHoverTags, getHoverTags, HOVER_LABEL } from './settings';
import { setMute, setCalm, volumeRows } from './soundopts';
import { accessRows } from './access';
import { researchEta, itemEta } from './rates';
import { getNotation } from '../engine/num';
// Milestone 5: Reorganize, the Patent Office and the Patent Drawer
import { reorganizeCard } from './reorganize';
import { patentsScreen } from './patents';
import { drawerScreen } from './drawer';
import './m5bar'; // Patents and Reorganize on the top bar, the Drawer and the Office as menus
// Act III (DESIGN.md §21): the Scenario boards
import { scenariosScreen, scenariosOpen } from './scenarios';
// Milestone 11 (DESIGN.md §24): the Trophy Shelf in groups, its Bonuses and the Wardrobe
import { shelfPage } from './shelf';
import { codexBook } from './codexbook';

export type ScreenName = 'research' | 'orders' | 'stats' | 'trophies' | 'options' | 'modules' | 'grade' | 'offline' | 'sliceEnd'
  // Act II (Milestone 4): the Factory floor's grade card, the Codex, the Survey Office, the Megaproject
  | 'fgrade' | 'codex' | 'survey' | 'mega'
  // Milestone 6: "safe for overnight" (src/app/overnight.ts)
  | 'overnight'
  // Milestone 5: Reorganize, the Patent Office, the Patent Drawer
  | 'reorganize' | 'patents' | 'drawer'
  // the 180 (docs/hud-180.md): the Swamp Gazette's page and the drawn keyboard
  | 'gazette' | 'keys'
  // Act III (DESIGN.md §21): the Scenario boards (src/app/scenarios.ts)
  | 'scenarios'
  // Act IV (DESIGN.md §22): the Relocate card and the Legacy tree (src/app/relocate.ts, legacy.ts)
  | 'relocate' | 'legacy'
  // Act V (DESIGN.md §23): the Last Fold's card and sequence, the Kernel tree, the Endless Ledger
  // (src/app/lastfold.ts, kernels.ts, endless.ts)
  | 'lastfold' | 'kernels' | 'ledger'
  // Milestone 11 (DESIGN.md §24): the Challenges page, Unit 7's ending (src/app/challenges.ts, ending.ts)
  | 'challenges' | 'ending';

/** Screens added from other files (Milestones 5 and 6): drawn in the overlay rect like the rest. */
// (a `var` without an initializer: hoisted, so a page may register while this module is still loading,
// as a page imported by one of the imports below does; Milestone 11)
// eslint-disable-next-line no-var
var EXTRA: Map<string, (app: App, r: Rect, L: Layout) => void> | undefined;

/** Register a full-screen menu drawn by another file; open it with app.togglePanel(name).
 *    registerScreen('patents', (app, r) => { const { body } = menuTemplate(app, r, { ... }); ... });
 */
export function registerScreen(name: ScreenName, draw: (app: App, r: Rect, L: Layout) => void) {
  (EXTRA ??= new Map()).set(name, draw);
}

/** UI px kept free along the overlay's right edge: the notebook's section tabs hang there. */
export const SECTION_TABS_W = 14;

export function drawScreen(app: App, L: Layout) {
  const o = L.overlay;
  const r = { x: o.x, y: o.y, w: o.w - SECTION_TABS_W, h: o.h };
  const extra = app.panel ? EXTRA?.get(app.panel) : undefined;
  if (extra) return extra(app, r, L);
  switch (app.panel) {
    case 'research': return researchTree(app, r);
    case 'orders': return ordersScreen(app, r);
    case 'stats': return statsScreen(app, r);
    case 'trophies': return shelfPage(app, r); // Milestone 11: src/app/shelf.ts
    case 'options': return optionsScreen(app, r);
    case 'modules': return modulesScreen(app, r);
    case 'grade': return gradeCard(app, L);
    case 'offline': return offlineReportCard(app, L); // Milestone 6 (was fold.ts offlineCard)
    case 'sliceEnd': return sliceEndCard(app, L);
    case 'fgrade': return fgradeCard(app, L);
    case 'codex': return codexBook(app, r); // Milestone 11: src/app/codexbook.ts
    case 'survey': return surveyScreen(app, r);
    case 'mega': return megaScreen(app, r);
    case 'overnight': return overnightScreen(app, r);
    case 'reorganize': return reorganizeCard(app, r);
    case 'patents': return patentsScreen(app, r);
    case 'drawer': return drawerScreen(app, r);
    case 'scenarios': return scenariosScreen(app, r);
  }
}

// ================================================================== the page kit

/** A caption on a page: Pip small caps in soft ink. Returns the height it takes (with its gap). */
export function caption(ui: UI, s: string, x: number, y: number, col: string = T.inkSoft, align: 'left' | 'center' | 'right' = 'left'): number {
  label(ui, s, x, y, col, align);
  return 9;
}

/** A speaker's line at the top of a page: their 24 px portrait and a speech bubble whose tail
 * points at it. `line` is rich text in the speaker's voice. Returns the height used. */
export function speaker(app: App, who: string, line: string, x: number, y: number, w: number): number {
  const ui = app.ui;
  const bx = x + 31, bw = w - 31;
  const th = richHeight(line, bw - 12);
  const h = Math.max(26, th + 10);
  // the portrait sits on the bubble's middle, a little bob while it talks
  const bob = Math.floor(ui.time * 2) % 6 === 0 ? 1 : 0;
  portrait(ui, who, x, y + Math.floor((h - 24) / 2) + bob, 24);
  const c = bubble(ui, bx, y, bw, h, { side: 'left', at: Math.floor(h / 2) - 3 });
  drawRich(ui, line, c.x, c.y + Math.floor((c.h - th) / 2) + 1, c.w, T.ink);
  return h;
}

/** A pencil line from (x0, y0) to (x1, y1): graphite, its grain uneven; `dash` > 0 leaves gaps
 * (a faint, not-yet line), `phase` slides the dashes along it (a line that is flowing). */
export function pencilLine(ui: UI, x0: number, y0: number, x1: number, y1: number, col: string, a = 0.85, dash = 0, phase = 0) {
  const ctx = ui.ctx;
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    if (dash > 0 && Math.floor((i + phase) / dash) % 2 === 1) continue;
    const grain = ((Math.sin(i * 12.9898 + x0 * 78.233) * 43758.5453) % 1 + 1) % 1;
    ctx.fillStyle = rgba(col, a * (0.65 + 0.35 * grain));
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  }
}

export type DiscState = 'normal' | 'hover' | 'afford' | 'locked';
const discs = new Map<string, HTMLCanvasElement>();

/** A raised paper disc of radius R (h180_disc's look, drawn to the size a 16 px icon needs):
 * a wood rim, a lit bevel top-left and a shaded one bottom-right, a 1 px ink shadow under it.
 * 'afford' has a brass rim, 'locked' is dim paper. 2R x 2R+1. */
export function discCanvas(R: number, st: DiscState): HTMLCanvasElement {
  const key = `${R}:${st}`;
  const hit = discs.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 2 * R;
  cv.height = 2 * R + 2;
  const ctx = cv.getContext('2d')!;
  const P = {
    normal: { rim: C.wood2, lit: C.lamp3, shade: C.wood5, face: C.bone },
    hover: { rim: C.wood2, lit: C.lamp3, shade: C.wood5, face: C.lamp3 },
    afford: { rim: C.ink, lit: C.brass3, shade: C.brass1, face: C.bone },
    locked: { rim: C.wood3, lit: C.wood5, shade: C.wood4, face: C.wood5 },
  }[st];
  for (let j = 0; j < 2 * R + 2; j++)
    for (let i = 0; i < 2 * R; i++) {
      const dx = i + 0.5 - R, dy = j + 0.5 - R;
      const d = Math.hypot(dx, dy);
      let col: string | null = null;
      if (d <= R) {
        if (d > R - 1.1) col = P.rim;
        else if (d > R - (st === 'afford' ? 3.1 : 2.1)) col = dx + dy < 0 ? P.lit : P.shade;
        else col = P.face;
        if (st === 'afford' && d > R - 3.1 && d <= R - 2.1) col = C.brass2;
      } else if (Math.hypot(dx, dy - 1.5) <= R) col = C.shadow;
      if (col) { ctx.fillStyle = col; ctx.fillRect(i, j, 1, 1); }
    }
  discs.set(key, cv);
  return cv;
}

const circles = new Map<string, HTMLCanvasElement>();

/** A red-pencil ring of radius R round a centre (h180_circle's hand, drawn at the size needed): a
 * 1 px red line that wanders a little and overlaps itself at the top right where the pencil
 * started and stopped. `seed` changes the wander (the line "boils" when it changes). */
export function penCircle(ui: UI, cx: number, cy: number, R: number, seed = 0) {
  const key = `${R}:${seed}`;
  let cv = circles.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    const S = 2 * R + 6;
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d')!;
    const o = S / 2;
    const steps = Math.ceil(2 * Math.PI * R * 2);
    for (let k = 0; k <= steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const rr = R + 0.7 * Math.sin(3 * a + seed * 1.7) + 0.4 * Math.sin(5 * a + seed);
      ctx.fillStyle = C.red;
      ctx.fillRect(Math.round(o + Math.cos(a) * rr - 0.5), Math.round(o + Math.sin(a) * rr - 0.5), 1, 1);
    }
    // the overlap where the stroke began: a second pass a pixel inside, darker
    for (let a = -1.05; a < -0.35; a += 0.5 / R) {
      const rr = R - 1 + 0.7 * Math.sin(3 * a + seed * 1.7);
      ctx.fillStyle = C.copper0;
      ctx.fillRect(Math.round(o + Math.cos(a) * rr - 0.5), Math.round(o + Math.sin(a) * rr - 0.5), 1, 1);
    }
    circles.set(key, cv);
  }
  ui.ctx.drawImage(cv, Math.round(cx - cv.width / 2), Math.round(cy - cv.height / 2));
}

/** A dashed pencil ring of radius R: the place of a thing not drawn in yet. */
export function dashedRing(ui: UI, cx: number, cy: number, R: number, col: string = T.inkSoft, a = 0.55) {
  const ctx = ui.ctx;
  const steps = Math.ceil(2 * Math.PI * R);
  ctx.fillStyle = rgba(col, a);
  for (let k = 0; k < steps; k++) {
    if (k % 4 >= 2) continue;
    const ang = (k / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(ang) * R - 0.5), Math.round(cy + Math.sin(ang) * R - 0.5), 1, 1);
  }
}

const outlines = new Map<string, HTMLCanvasElement>();

/** An icon sketched in pencil: its pixels in `col`, darker where the drawing is darker, size x
 * size. For things not yet earned, collected or open. */
export function pencilIcon(ui: UI, key: string, src: CanvasImageSource, x: number, y: number, size: number, col: string = T.inkSoft) {
  const k = `${key}:${size}:${col}`;
  let cv = outlines.get(k);
  if (!cv) {
    const tmp = document.createElement('canvas');
    tmp.width = size + 2;
    tmp.height = size + 2;
    const tc = tmp.getContext('2d')!;
    tc.imageSmoothingEnabled = false;
    tc.drawImage(src, 1, 1, size, size);
    const S = size + 2;
    const d = tc.getImageData(0, 0, S, S).data;
    cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const oc = cv.getContext('2d')!;
    // each inked pixel becomes graphite, pressed harder where the drawing is darker, so the
    // shape and its lines stay readable while the colour is gone
    for (let j = 0; j < S; j++)
      for (let i = 0; i < S; i++) {
        const o = (j * S + i) * 4;
        if (d[o + 3] <= 40) continue;
        const lum = (0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2]) / 255;
        const a = Math.max(0.12, Math.min(0.9, 0.95 - lum * 0.95));
        oc.fillStyle = rgba(col, a);
        oc.fillRect(i, j, 1, 1);
      }
    outlines.set(k, cv);
  }
  ui.ctx.drawImage(cv, Math.round(x) - 1, Math.round(y) - 1);
}

/** The green-ink tick stamp (h180_tick, 12x12), or its code-drawn stand-in. */
export function tickStamp(ui: UI, x: number, y: number) {
  if (hasArt('h180_tick')) { ui.ctx.drawImage(sheet('h180_tick').frames[0], Math.round(x), Math.round(y)); return; }
  const ctx = ui.ctx;
  ctx.fillStyle = T.good;
  for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x) + 1 + i, Math.round(y) + 6 + i, 2, 2);
  for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(x) + 4 + i, Math.round(y) + 9 - i, 2, 2);
}

/** A ledger row: `k` in soft ink at the left, `v` (rich) right-aligned, a faint rule under it.
 * Returns the row's height. */
export function ledgerRow(ui: UI, k: string, v: string, x: number, y: number, w: number, vcol: string = T.ink): number {
  drawRich(ui, k, x, y + 1, Infinity, T.inkSoft);
  drawRich(ui, v, x + w, y + 1, Infinity, vcol, { align: 'right' });
  rule(ui, x, y + LINE_H, w);
  return LINE_H + 1;
}

/** Rich pieces laid in a row that wraps between pieces, never inside one (a piece's icon stays
 * with its words). Returns the height used. */
export function flowRow(ui: UI, parts: string[], x: number, y: number, w: number, end = Infinity, gap = 6): number {
  let xx = x, yy = y;
  for (const part of parts) {
    const pw = richWidth(part);
    if (xx > x && xx + pw > x + w) { xx = x; yy += LINE_H; }
    if (yy + LINE_H - 2 > end) break;
    drawRich(ui, part, xx, yy, Infinity, T.ink);
    xx += pw + gap;
  }
  return yy + LINE_H - y;
}

/** The tabs of the notebook's back pages: Stats, Trophies, Options and Keys. */
export function backTabs(app: App): MenuTab[] {
  const help = app.input.binds.help?.[0];
  const all: { id: 'stats' | 'trophies' | 'options' | 'keys'; label: string; icon?: IconName; tip: string }[] = [
    { id: 'stats', label: 'Stats', icon: 'stats', tip: '{u:stats} the books' },
    { id: 'trophies', label: 'Trophies', icon: 'trophies', tip: '{u:trophies} the shelf' },
    { id: 'options', label: 'Options', icon: 'options', tip: '{u:options} sound · numbers · saves' },
    { id: 'keys', label: 'Keys', tip: help ? `{k:=${keyLabel(help)}} every key` : 'every key' },
  ];
  return all.map((t) => ({ id: 'nav:' + t.id, label: t.label, icon: t.icon, tip: t.tip, active: app.panel === t.id, onClick: () => { if (app.panel !== t.id) { app.panel = t.id; app.audio.sfx('open'); } } }));
}

/** A chip beside the page's title (its count), when the header has room for it. */
export function titleChip(app: App, r: Rect, title: string, free: number, text: string, role: Role) {
  const w = chipWidth(text);
  if (free < w + 8) return;
  chip(app.ui, r.x + 29 + bigWidth(title) + 6, r.y + Math.floor((20 - CHIP_H) / 2) + 2, text, { role });
}

// ================================================================== the research tree

/** where each node sits: column, row, and 1 when its label goes under it (so neighbours' labels never meet) */
const TREE: Record<ResearchId, [number, number, number?]> = {
  pressing: [0, 1.5],
  surveyEast: [1, 0], gearcutting: [1, 2], slagBricks: [1, 3.2],
  copperSmelting: [2, 0, 1], splitters: [2.4, 2.2, 1], buffers: [2, 3.2, 1],
  wireDrawing: [3, 0.4],
  gizmoTheory: [4, 1.4],
  folding: [5, 1.4, 1],
  // Act II's page (columns 0-6)
  coalSeams: [0, 1.6],
  steelmaking: [1, 1.0], surveying: [1, 2.6, 1],
  overdrive: [2, 0], steamPower: [2, 1.4], crushing: [2, 2.8, 1],
  glassworks: [3, 0.5], refining: [3, 1.6, 1], machineKits: [3, 2.9, 1],
  circuits: [4, 1.0], concrete: [4, 2.6, 1],
  heavyMachines: [5, 0.2], motors: [5, 1.3, 1], nestedFolds: [5, 2.6],
  tuning: [6, 0.2, 1], greatDrill: [6, 1.9],
  // Act III's page (columns 0-6, each node a column after what it needs, rows ordered so the
  // pencil lines cross as little as they can)
  zoning: [0, 1.6],
  chutes: [1, 1.6, 1],
  chemistry: [2, 0.8], bearings: [2, 2.6, 1],
  vulcanizing: [3, 0], processors: [3, 0.8, 1], batteries: [3, 1.6, 1], hydroponics: [3, 2.4, 1], servos: [3, 3.2, 1],
  sensors: [4, 0], recycling: [4, 0.8, 1], sandwiches: [4, 2.4, 1], floatingCity: [4, 3.2, 1],
  robotics: [5, 0.8, 1], scrapTransmuter: [5, 2.4, 1],
  districtFolds: [6, 0.2, 1], sandwichEngineering: [6, 1.8, 1],
  // Act IV's page (DESIGN.md §22): Charting and what it opens down the left (the World floor, the
  // Lighthouse, the Sky Anchor, Relocation); each island's chain a row on the right, in the order
  // the islands are named, its caption above it (ISLE_ROWS); every island name under its node
  charting: [0, 1.7], lighthouse: [1.1, 0.55], skyAnchor: [1.1, 1.7, 1], relocation: [1.1, 2.85, 1],
  skyglassCutting: [2.55, 0.2, 1], horizonOptics: [3.65, 0.2, 1],
  cinderSmelting: [2.55, 1.2, 1], sunsetDyes: [3.65, 1.2, 1], sunsetEngineering: [4.75, 1.2, 1],
  thermals: [2.55, 2.2, 1], frostWorks: [3.65, 2.2, 1], stormCells: [4.75, 2.2, 1], pocketWeathers: [5.85, 2.2, 1],
  relicStudy: [2.55, 3.2, 1],
  // Act V's page (DESIGN.md §23): The Last Fold on the left, the Kernel node Beyond as a gate in the
  // middle (drawn by the page, not a research node: KERNEL_GATE), each island's tier 5 node a row on
  // the right in the islands' order, captioned above it as Act IV's are (ISLE_ROWS)
  lastFold: [0.5, 1.7], cartography: [4.4, 0.2, 1], starForging: [4.4, 1.2, 1], weatherBottling: [4.4, 2.2, 1], relicEngines: [4.4, 3.2, 1],
};

/** Act V's page: where the Kernel node Beyond stands between The Last Fold and the islands' nodes
 *  (column, row), a gate every tier 5 node needs. */
const KERNEL_GATE: [number, number] = [2.45, 1.7];

/** Act IV's island rows: the island and its row (TREE's), captioned above its first node. */
const ISLE_ROWS: [WorldId, number][] = [['pebble', 0.2], ['cinder', 1.2], ['rime', 2.2], ['oldworks', 3.2]];

const NODE_ICON: Record<ResearchId, ItemId | UIconName> = {
  pressing: 'ironPlate', surveyEast: 'workshop', copperSmelting: 'copperIngot', wireDrawing: 'copperWire', gearcutting: 'gear',
  splitters: 'flow', buffers: 'orders', gizmoTheory: 'gizmo', slagBricks: 'slagBrick', folding: 'fold',
  coalSeams: 'coal', steelmaking: 'steel', overdrive: 'overdrive', steamPower: 'power', surveying: 'survey', glassworks: 'glass',
  crushing: 'gravel', concrete: 'concrete', refining: 'plastic', machineKits: 'machineKit', circuits: 'circuit',
  heavyMachines: 'heavy', tuning: 'mode', motors: 'motor', nestedFolds: 'fold', greatDrill: 'mega',
  zoning: 'district', chutes: 'chute', chemistry: 'solvent', bearings: 'bearing', vulcanizing: 'rubber', batteries: 'battery',
  servos: 'servo', sensors: 'sensor', processors: 'processor', recycling: 'mode', hydroponics: 'produce', sandwiches: 'sandwich',
  robotics: 'robotArm', floatingCity: 'mega', scrapTransmuter: 'mega', sandwichEngineering: 'sandwichEngineer', districtFolds: 'fold',
  // Act IV (placeholders until the art director draws the islands' icons)
  charting: 'world', thermals: 'power', skyglassCutting: 'skyglassLens', horizonOptics: 'horizonLens',
  cinderSmelting: 'cinderAlloy', sunsetDyes: 'sunsetDye', sunsetEngineering: 'sunsetGenerator',
  frostWorks: 'frostAlloy', stormCells: 'stormCell', pocketWeathers: 'pocketWeather', relicStudy: 'relicGear',
  lighthouse: 'lighthouseLamp', skyAnchor: 'anchorChain', relocation: 'relocate',
  // Act V: the Last Fold's own icon, each island's node its first impossible invention
  lastFold: 'lastFold', cartography: 'mapOfEverywhere', starForging: 'verySmallSun', weatherBottling: 'bottledTuesday', relicEngines: 'quietEngine',
};

/** nodes with their own drawing in ui_research (the art director's), by frame */
const NODE_ART: Partial<Record<ResearchId, number>> = { surveyEast: 0, splitters: 1, buffers: 2, nestedFolds: 3 };

/** A research node's icon at 16 px (or 8 px when small). */
export function nodeIcon(ui: App['ui'], id: ResearchId, x: number, y: number, small = false) {
  const art = NODE_ART[id];
  const sz = small ? 8 : 16;
  if (art !== undefined && hasArt('ui_research')) { ui.ctx.drawImage(sheet('ui_research').frames[art], x, y, sz, sz); return; }
  const ic = NODE_ICON[id];
  if (ic in ITEMS) ui.ctx.drawImage(itemIcon(ic), x, y, sz, sz);
  else uiIcon(ui, ic as UIconName, x, y, small ? 1 : 0);
}

/** The node's icon as a 16 px source for tracing in pencil. */
function nodeSource(id: ResearchId): CanvasImageSource | null {
  const art = NODE_ART[id];
  if (art !== undefined && hasArt('ui_research')) return sheet('ui_research').frames[art];
  const ic = NODE_ICON[id];
  if (ic in ITEMS) return itemIcon(ic);
  return null;
}

/** A node's unlocks, one markup row each (the data separates them with " · "). */
export const unlockRows = (id: ResearchId) => RESEARCH[id].unlocks.split(' · ');

const NODE_R = 13;

/** Act III's, Act IV's or Act V's page is open (HudState.treePage holds the first two pages'
 *  choice); `drawn` the UI clock at the tree's last frame (a gap is a fresh opening); `pinned` a page
 *  set from outside. */
const tree = { three: false, four: false, five: false, drawn: -1, pinned: false };
/** Open the research tree at a page (the e2e states; a goal that names Act III's research). */
export function setTreePage(app: App, n: 1 | 2 | 3 | 4 | 5) {
  tree.three = n === 3;
  tree.four = n === 4;
  tree.five = n === 5;
  tree.pinned = true;
  if (n < 3) app.hud.treePage = n as 1 | 2;
}

/** Act V's page shows once The Last Fold is open to research (or done), or any of its nodes is. */
function act5Shown(g: App['game']): boolean {
  return RESEARCH_LIST.some((d) => d.act === 5 && (g.done(d.id) || available(g, d.id))) || (g.s.meta.lastFolds ?? 0) > 0;
}

/** Act IV's page shows once Act III's does, or as soon as one of its nodes is open or done (Thermals
 *  opens on Rime with Act II's power, DESIGN.md §22). Under way once District Folds is done or a
 *  node of it other than Thermals is. */
function act4Shown(g: App['game'], act3: boolean): boolean {
  return RESEARCH_LIST.some((d) => d.act === 4 && (g.done(d.id) || available(g, d.id))) || (act3 && g.done('districtFolds'));
}
function act4UnderWay(g: App['game']): boolean {
  return g.done('districtFolds') || RESEARCH_LIST.some((d) => d.act === 4 && d.id !== 'thermals' && g.done(d.id));
}

/** Each time the tree opens it opens on the newest act under way (the second gate: Act II's page
 *  during Act III): Act III's once its nodes are open (the Drill's stage 3) or one is done, else Act
 *  II's once Folding is done. The tabs pick another page while it stays open. */
function freshTreePage(app: App, act2: boolean, act3: boolean, act4: boolean) {
  const ui = app.ui;
  const fresh = Math.abs(ui.time - ui.dt - tree.drawn) > 1e-6 && tree.drawn !== ui.time;
  tree.drawn = ui.time;
  if (!fresh) return;
  if (tree.pinned) { tree.pinned = false; return; }
  const g = app.game;
  tree.five = act5Shown(g) && (g.done('lastFold') || available(g, 'lastFold'));
  tree.four = !tree.five && act4 && act4UnderWay(g);
  const three = !tree.five && !tree.four && act3 && ((g.s.mega.stage ?? 0) >= 3 || RESEARCH_LIST.some((d) => d.act === 3 && g.done(d.id)));
  tree.three = three;
  if (!three && !tree.four && !tree.five && act2) app.hud.treePage = 2;
}

function researchTree(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  // the pages: the Workshop's tree, Act II's once Folding is done, Act III's once the Great Drill
  // is researched (DESIGN.md §21: every Act III node waits for the Drill's stage 3, and the page
  // says so while it does)
  const act2 = g.done('folding');
  const act3 = act2 && (g.done('greatDrill') || RESEARCH_LIST.some((d) => d.act === 3 && g.done(d.id)));
  const act4 = act2 && act4Shown(g, act3);
  const act5 = act4 && act5Shown(g);
  freshTreePage(app, act2, act3, act4);
  const page: 1 | 2 | 3 | 4 | 5 = !act2 ? 1 : act5 && tree.five ? 5 : act4 && tree.four ? 4 : act3 && tree.three ? 3 : app.hud.treePage;
  const ready = (n: number) => page !== n && RESEARCH_LIST.some((d) => (d.act ?? 1) === n && available(g, d.id)) ? '!' : undefined;
  const tabs: MenuTab[] = act2 ? [
    { id: 'tree1', label: 'Workshop', icon: 'workshop', tip: '{u:workshop} the first tree', active: page === 1, onClick: () => { app.hud.treePage = 1; tree.three = false; tree.four = false; tree.five = false; } },
    { id: 'tree2', label: 'Act II', icon: 'mega', tip: '{u:factory} the second tree', active: page === 2, onClick: () => { app.hud.treePage = 2; tree.three = false; tree.four = false; tree.five = false; }, badge: ready(2) },
    ...(act3 ? [{ id: 'tree3', label: 'Act III', icon: 'star' as const, tip: '{u:district} the third tree · the District', active: page === 3, onClick: () => { tree.three = true; tree.four = false; tree.five = false; } }] : []),
    ...(act4 ? [{ id: 'tree4', label: 'Act IV', icon: 'world' as const, tip: '{u:world} the fourth tree · the World and the islands', active: page === 4, onClick: () => { tree.four = true; tree.three = false; tree.five = false; }, badge: ready(4) }] : []),
    ...(act5 ? [{ id: 'tree5', label: 'Act V', icon: 'lastFold' as const, tip: '{u:lastFold} the fifth tree · the Last Fold and Beyond', active: page === 5, onClick: () => { tree.five = true; tree.four = false; tree.three = false; }, badge: ready(5) }] : []),
  ] : [];
  const info = Math.min(196, Math.floor(r.w * 0.34));
  const { body, detail } = menuTemplate(app, r, { title: 'Research', accent: T.research, icon: 'research', tabs, detail: info });
  const ctx = ui.ctx;
  const nodes = RESEARCH_LIST.filter((d) => (d.act ?? 1) === page);
  const cols = page >= 2 ? 6 : 5;
  const mx = body.w >= 400 ? 30 : 24;
  const area = { x: body.x + mx, y: body.y + 26, w: body.w - mx * 2, h: body.h - 72 };
  const pos = (id: ResearchId) => {
    const [c, row] = TREE[id];
    return { x: Math.round(area.x + (c / cols) * area.w), y: Math.round(area.y + (row / 3.2) * area.h) };
  };
  // the pencil links: dashed and faint while locked, flowing toward a node that can be picked
  const gateAt = { x: Math.round(area.x + (KERNEL_GATE[0] / cols) * area.w), y: Math.round(area.y + (KERNEL_GATE[1] / 3.2) * area.h) };
  for (const d of nodes)
    for (const q of d.requires.filter((q2) => (RESEARCH[q2].act ?? 1) === page)) {
      // Act V: through the gate (drawn after the loop)
      if (page === 5 && d.kernel) continue;
      const a = pos(q), b = pos(d.id);
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
      const x0 = a.x + ux * (NODE_R + 2), y0 = a.y + uy * (NODE_R + 2), x1 = b.x - ux * (NODE_R + 3), y1 = b.y - uy * (NODE_R + 3);
      const done = g.done(d.id), open = g.done(q);
      if (done) pencilLine(ui, x0, y0, x1, y1, T.ink, 0.75);
      else if (open) {
        pencilLine(ui, x0, y0, x1, y1, T.inkSoft, 0.8);
        // the lead flowing toward the node: a few research-ink dashes running along the line
        const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        const run = (ui.time * 18) % 9;
        for (let i = 0; i <= n; i++) if ((i - run + 90) % 9 < 2) { ctx.fillStyle = T.research; ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1); }
      } else pencilLine(ui, x0, y0, x1, y1, T.inkSoft, 0.45, 2);
    }
  if (page === 5) kernelGateLinks(app, nodes, pos, gateAt);
  // Act IV (and V): each island's row captioned above its first node (offered only on it: the others
  // say "on Cinder Isle", the island the town is on "here")
  const here = worldOf(g);
  const isleCaps = page !== 4 && page !== 5 ? [] : ISLE_ROWS.map(([w, row]) => {
    const first = nodes.filter((d) => d.world === w).sort((a, b) => TREE[a.id][0] - TREE[b.id][0])[0];
    const p = first ? pos(first.id) : { x: area.x, y: Math.round(area.y + (row / 3.2) * area.h) };
    const s = w === here ? `HERE ON ${WORLDS[w].name.toUpperCase()}` : `ON ${WORLDS[w].name.toUpperCase()}`;
    const r0 = { x: p.x - NODE_R, y: p.y - NODE_R - 9, w: smallWidth(s), h: 7 };
    return { w, s, r: r0 };
  });
  // where each name goes: above or below its node (TREE's flag first), else beside it, whichever
  // runs into no node and no other name and stays on the page; a long name loses its "The" when
  // nothing else fits, and when nothing fits at all the spot that overlaps least wins
  type Spot = { lines: string[]; lx: number; ly: number; lw: number; lh: number; center: boolean };
  const spots = new Map<ResearchId, Spot>();
  {
    const placed: Rect[] = isleCaps.map((c) => ({ x: c.r.x - 1, y: c.r.y - 1, w: c.r.w + 2, h: c.r.h + 2 }));
    // Act V: the gate's disc and its label keep the names off
    if (page === 5) placed.push({ x: gateAt.x - NODE_R - 2, y: gateAt.y - NODE_R - 2, w: NODE_R * 2 + 4, h: NODE_R * 2 + 16 });
    const R2 = NODE_R + 2;
    const over = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    for (const d of nodes) {
      const p = pos(d.id);
      const bar = !g.done(d.id) && researchFrac(g, d.id) > 0;
      // every node's disc, its own too (a name pushed back onto the page must not cover it)
      const boxes = nodes.map((q) => { const o = pos(q.id); const rr = q.id === d.id ? NODE_R + 1 : R2; return { x: o.x - rr, y: o.y - rr, w: rr * 2, h: rr * 2 }; });
      const pref = !!TREE[d.id][2];
      const short = d.name.replace(/^The /, '');
      // the name on one line, or broken at its middle space onto two
      const words = short.split(' ');
      const two = words.length > 1 ? (() => { let best: string[] = [short]; let bw = Infinity; for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '); const w = Math.max(textWidth(a), textWidth(b)); if (w < bw) { bw = w; best = [a, b]; } } return best; })() : null;
      const cands: Spot[] = [];
      const add = (lines: string[], where: 'above' | 'below' | 'right' | 'left') => {
        const lw = Math.max(...lines.map((l) => textWidth(l)));
        const lh = 9 + (lines.length - 1) * 10;
        let lx = where === 'right' ? p.x + NODE_R + 4 : where === 'left' ? p.x - NODE_R - 4 - lw : p.x - lw / 2;
        lx = Math.round(Math.max(body.x + 2, Math.min(lx, body.x + body.w - 2 - lw)));
        const ly = where === 'below' ? p.y + NODE_R + (bar ? 8 : 3) : where === 'above' ? p.y - NODE_R - 2 - lh : p.y - Math.floor(lh / 2);
        cands.push({ lines, lx, ly, lw, lh, center: where === 'above' || where === 'below' });
      };
      const vert = (lines: string[]) => { add(lines, pref ? 'below' : 'above'); add(lines, pref ? 'above' : 'below'); };
      // an island's rows stand close together: their names go on two lines first
      if ((page === 4 || page === 5) && d.world && two) vert(two);
      vert([d.name]);
      if (short !== d.name) vert([short]);
      add([d.name], 'right'); add([d.name], 'left');
      if (two) { vert(two); add(two, 'right'); add(two, 'left'); }
      const cost = (c: Spot) => {
        const r0 = { x: c.lx - 1, y: c.ly - 1, w: c.lw + 2, h: c.lh + 2 };
        let n = 0;
        for (const b of boxes) n += over(r0, b);
        for (const q of placed) n += over(r0, q) * 2;
        if (r0.y < body.y + 1 || r0.y + r0.h > body.y + body.h - 14) n += 400;
        return n;
      };
      let best = cands[0], bestN = Infinity;
      for (const c of cands) {
        const n = cost(c);
        if (n === 0) { best = c; bestN = 0; break; }
        if (n < bestN) { best = c; bestN = n; }
      }
      spots.set(d.id, best);
      placed.push({ x: best.lx - 1, y: best.ly - 1, w: best.lw + 2, h: best.lh + 2 });
    }
  }
  for (const c of isleCaps) {
    ui.small(c.s, c.r.x, c.r.y, c.w === here ? T.research : T.inkSoft);
    ui.hint(c.r.x, c.r.y - 1, c.r.w, 9, [{ text: `{big:${WORLDS[c.w].name.replace(/^the /, 'The ')}}` }, { text: c.w === here ? '{good:the town is here} · its research is offered' : `{soft:its research is offered only there} · {u:relocate} Relocate` }, { text: WORLDS[c.w].rule }], 200);
  }
  // Act V: the Kernel node Beyond, a gate between The Last Fold and the islands
  if (page === 5) kernelGate(app, gateAt);
  // the nodes
  let hovered: ResearchId | null = null;
  const sel = g.s.research.selected;
  for (const d of nodes) {
    const p = pos(d.id);
    const done = g.done(d.id), can = available(g, d.id), isSel = sel === d.id;
    const x = p.x - NODE_R, y = p.y - NODE_R;
    const hov = ui.hover(x - 1, y - 1, NODE_R * 2 + 2, NODE_R * 2 + 2);
    if (hov) hovered = d.id;
    ui.mark('node:' + d.id, x, y, NODE_R * 2, NODE_R * 2);
    ui.region(x, y, NODE_R * 2, NODE_R * 2, 'button');
    // available nodes breathe: a research-tinted halo pulsing behind the disc
    if (can && !isSel && !done) {
      const k = 0.12 + 0.1 * Math.sin(ui.time * 4 + d.num);
      ctx.fillStyle = rgba(T.researchFill, k);
      ctx.beginPath();
      ctx.arc(p.x, p.y, NODE_R + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const st: DiscState = !done && !can ? 'locked' : hov ? 'hover' : can && !isSel && !done ? 'afford' : 'normal';
    if (st === 'locked') dashedRing(ui, p.x, p.y, NODE_R - 1, T.inkSoft, 0.6);
    else ctx.drawImage(discCanvas(NODE_R, st), x, y - (hov ? 1 : 0));
    const iy = y + NODE_R - 8 - (hov && st !== 'locked' ? 1 : 0);
    if (st === 'locked') {
      // a node not yet open: its icon traced in faint pencil
      const src = nodeSource(d.id);
      if (src) pencilIcon(ui, 'node:' + d.id, src, x + NODE_R - 8, iy, 16, T.inkSoft);
      else { ctx.globalAlpha = 0.35; nodeIcon(ui, d.id, x + NODE_R - 8, iy); ctx.globalAlpha = 1; }
    } else nodeIcon(ui, d.id, x + NODE_R - 8, iy);
    if (done) tickStamp(ui, x + NODE_R * 2 - 9, y + NODE_R * 2 - 11);
    if (isSel) penCircle(ui, p.x, p.y, NODE_R + 3, Math.floor(ui.time * 2.5) % 3);
    const f = researchFrac(g, d.id);
    if (!done && f > 0) meter(ui, p.x - 12, y + NODE_R * 2 + 2, 24, 4, f, { role: 'research', glint: false });
    const spot = spots.get(d.id)!;
    // the name is written over the pencil lines: the paper under it rubbed clean first
    const lcol = done ? T.good : can || isSel ? T.ink : T.inkSoft;
    spot.lines.forEach((l, k) => {
      const lw = textWidth(l);
      const lx = spot.center ? spot.lx + Math.floor((spot.lw - lw) / 2) : spot.lx;
      ctx.fillStyle = T.paper;
      ctx.fillRect(lx - 1, spot.ly + k * 10 - 1, lw + 2, 10);
      ui.text(l, lx, spot.ly + k * 10, lcol);
    });
    if (isSel) pencil(ui, spot.lx, spot.ly + spot.lh, spot.lw, T.bad);
    if (hov && ui.clicked && (can || isSel)) {
      ui.eat();
      app.act({ k: 'research', id: isSel ? null : d.id });
    }
  }
  // the key to the marks, along the page's foot
  const ky = body.y + body.h - 12;
  let kx = body.x + 2;
  ctx.drawImage(discCanvas(5, 'afford'), kx, ky);
  kx += 13 + ui.text('ready', kx + 13, ky + 1, T.inkSoft) + 10;
  penCircle(ui, kx + 5, ky + 5, 5, 0);
  kx += 14 + ui.text('selected', kx + 14, ky + 1, T.inkSoft) + 10;
  tickStamp(ui, kx, ky - 1);
  kx += 15 + ui.text('done', kx + 15, ky + 1, T.inkSoft) + 10;
  if (kx + 60 < body.x + body.w) {
    dashedRing(ui, kx + 5, ky + 5, 5, T.inkSoft, 0.7);
    ui.text('locked', kx + 13, ky + 1, T.inkSoft);
  }
  // the right page: the hovered (or selected) node
  const show = hovered ?? sel ?? nodes.find((d) => available(g, d.id))?.id ?? nodes.find((d) => !g.done(d.id))?.id ?? null;
  nodePage(app, detail!, show, page >= 3 && (g.s.mega.stage ?? 0) < 3 && !!show && (RESEARCH[show].drill ?? 0) > (g.s.mega.stage ?? 0));
}

/** Act V's links: The Last Fold to the Kernel gate, the gate to each island's node (pencil, as the
 * other links: inked when done, flowing toward a node that can be picked, dashed while locked). */
function kernelGateLinks(app: App, nodes: typeof RESEARCH_LIST, pos: (id: ResearchId) => { x: number; y: number }, gate: { x: number; y: number }) {
  const ui = app.ui;
  const g = app.game;
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, done: boolean, open: boolean) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const x0 = a.x + ux * (NODE_R + 2), y0 = a.y + uy * (NODE_R + 2), x1 = b.x - ux * (NODE_R + 3), y1 = b.y - uy * (NODE_R + 3);
    if (done) pencilLine(ui, x0, y0, x1, y1, T.ink, 0.75);
    else if (open) pencilLine(ui, x0, y0, x1, y1, T.inkSoft, 0.8);
    else pencilLine(ui, x0, y0, x1, y1, T.inkSoft, 0.45, 2);
  };
  const beyond = hasKernel(g, 'beyond');
  line(pos('lastFold'), gate, g.done('lastFold') && beyond, g.done('lastFold'));
  for (const d of nodes) if (d.kernel) line(gate, pos(d.id), g.done(d.id), beyond && g.done('lastFold'));
}

/** Act V's gate: the Kernel node Beyond as a disc with its icon and name, ticked once owned; its tip
 * says what it is; a click opens the Kernel tree. */
function kernelGate(app: App, at: { x: number; y: number }) {
  const ui = app.ui;
  const g = app.game;
  const own = hasKernel(g, 'beyond');
  const x = at.x - NODE_R, y = at.y - NODE_R;
  const hov = ui.hover(x - 1, y - 1, NODE_R * 2 + 2, NODE_R * 2 + 2);
  ui.mark('gate:beyond', x, y, NODE_R * 2, NODE_R * 2);
  ui.region(x, y, NODE_R * 2, NODE_R * 2, 'button');
  ui.ctx.drawImage(discCanvas(NODE_R, hov ? 'hover' : own ? 'normal' : 'locked'), x, y - (hov ? 1 : 0));
  uiIcon(ui, 'beyond', x + NODE_R - 8, y + NODE_R - 8 - (hov ? 1 : 0));
  if (own) tickStamp(ui, x + NODE_R * 2 - 9, y + NODE_R * 2 - 11);
  const lab = 'Beyond';
  const lw = textWidth(lab);
  ui.ctx.fillStyle = T.paper;
  ui.ctx.fillRect(at.x - Math.floor(lw / 2) - 1, y + NODE_R * 2 + 2, lw + 2, 10);
  ui.text(lab, at.x - Math.floor(lw / 2), y + NODE_R * 2 + 3, own ? T.good : T.inkSoft);
  ui.small('KERNEL NODE', at.x, y - 9, T.inkSoft, { align: 'center' });
  if (hov) {
    ui.hoverId = 'gate:beyond';
    ui.tip([{ text: '{u:kernel} {big:Beyond}' }, { text: 'a Kernel node, not research: the fifth floor and these four nodes' }, { text: own ? '{good:yours}' : `{soft:${KERNELS.beyond.cost} Kernels · from the Last Fold}` }, { text: '{k:LMB} the Kernel tree' }], 220);
    if (ui.clicked) { ui.eat(); ui.sfx('click'); app.panel = 'kernels'; }
  }
}

/** The right page of the tree: a node's name, state and progress, what it unlocks, what it costs
 * in items delivered to the Hopper, Inspiration, what it needs and leads to, the select button,
 * the nodes ready now, the lab at work and the bank. */
function nodePage(app: App, page: Rect, show: ResearchId | null, drillGate = false) {
  const ui = app.ui;
  const g = app.game;
  const ctx = ui.ctx;
  const x = page.x + 4, w = page.w - 8;
  const banked = (Object.entries(g.s.research.bank) as [ItemId, Num][]).filter(([, v]) => v.gt(0));
  const end = page.y + page.h - (banked.length ? 22 : 0);
  let y = page.y + 2;
  // Act III's page before the Great Drill's stage 3 (DESIGN.md §21): what opens every node on it
  if (drillGate) {
    const s = `{u:mega} {bad:${ICON.lock} the Great Drill's stage 3} {soft:opens this page · now stage ${g.s.mega.stage ?? 0}}`;
    y += drawRich(ui, s, x, y, w, T.ink) + 3;
    rule(ui, x, y, w, true);
    y += 5;
  }
  /** what is still owed on a node, in items */
  const owed = (id: ResearchId) => {
    const prog = g.s.research.progress[id] ?? {};
    let n = 0;
    for (const [item, c] of Object.entries(RESEARCH[id].cost) as [ItemId, number][]) n += Math.max(0, c - (prog[item]?.toNumber() ?? 0));
    return n;
  };
  if (!show) {
    ui.big('Research', x, y, T.ink);
    y += 16;
    ui.para('{soft:every node researched}', x, y, w, T.inkSoft);
  } else {
    const d = RESEARCH[show];
    const done = g.done(show), can = available(g, show), sel = g.s.research.selected === show;
    // the name, in the display face beside the node's icon
    nodeIcon(ui, show, x, y);
    if (bigWidth(d.name) <= w - 20) ui.big(d.name, x + 20, y + 3, T.ink);
    else ui.text(ellipsize(d.name, w - 20), x + 20, y + 4, T.ink);
    y += 20;
    // the state, and the whole node's progress big
    const f = done ? 1 : researchFrac(g, show);
    const [chipText, role]: [string, Role] = done ? ['DONE', 'good'] : sel ? ['SELECTED', 'research'] : can ? ['READY', 'coin'] : ['LOCKED', 'soft'];
    chip(ui, x, y, chipText, { role, solid: done || sel });
    const pct = `${Math.floor(f * 100)}%`;
    ui.big(pct, x + w, y + 1, done ? T.good : T.research, { align: 'right' });
    y += CHIP_H + 3;
    meter(ui, x, y, w, 6, f, { role: done ? 'good' : 'research' });
    y += 10;
    // an island's own node (DESIGN.md §22): offered only on its island
    if (d.world && !done) {
      const isle = WORLDS[d.world].name;
      const s = d.world === worldOf(g) ? `{good:${ICON.check} here} · ${isle}` : `{bad:${ICON.lock} on ${isle}} {soft:offered only there}`;
      y += drawRich(ui, s, x, y, w, T.ink) + 3;
    }
    // what it unlocks: the data's rows
    y += caption(ui, 'unlocks', x, y);
    for (const row of unlockRows(show)) {
      if (y + LINE_H > end) break;
      ctx.fillStyle = T.inkSoft;
      ctx.fillRect(x + 1, y + 4, 3, 1);
      y += drawRich(ui, row, x + 7, y, w - 7, T.ink) + 1;
    }
    y += 3;
    // its cost, in items delivered to the Hopper
    if (y + 20 <= end) {
      y += caption(ui, 'to the hopper', x, y);
      const prog = g.s.research.progress[show] ?? {};
      for (const [item, n] of Object.entries(d.cost) as [ItemId, number][]) {
        if (y + 10 > end) break;
        const have = done ? n : Math.min(n, Math.floor(prog[item]?.toNumber() ?? 0));
        const s = `${fmt(have)}/${fmt(n)}`;
        const sw = textWidth(s);
        ctx.drawImage(itemIcon(item), x, y + 1);
        meter(ui, x + 11, y + 2, w - 11 - sw - 6, 6, have / n, { role: have >= n ? 'good' : 'research', glint: false });
        ui.text(s, x + w, y, have >= n ? T.good : T.ink, { align: 'right' });
        ui.hint(x, y, w, 10, [{ text: `{i:${item}} {big:${ITEMS[item].name}}` }, { text: `${fmt(have)} of ${fmt(n)} {soft:delivered to the Hopper}` }, ...(done ? [] : [{ text: itemEta(app, item, n - have) }])], 170);
        y += 11;
      }
      // Milestone 13: how long the rest takes at what arrives now (src/app/rates.ts)
      const eta = researchEta(app, show);
      if (eta && y + 10 <= end) y += drawRich(ui, `{u:clock} {soft:${eta} at what is delivered now}`, x, y, w, T.inkSoft) + 1;
    }
    // Inspiration: clicks on the Hopper give the selected node a share, up to its cap
    if (!done && inspireUnlocked(g) && y + 12 <= end) {
      const cap = IDLE.inspireCap.value;
      const inf = inspiredFrac(g, show);
      const lead = '{k:LMB} {soft:Hopper}';
      const lw = richWidth(lead);
      drawRich(ui, lead, x, y, Infinity, T.ink);
      const s = `${Math.round(inf * 100)}/${Math.round(cap * 100)}%`;
      meter(ui, x + lw + 4, y + 2, w - lw - 4 - textWidth(s) - 6, 6, inf / cap, { role: 'coin', glint: false });
      ui.text(s, x + w, y, T.coin, { align: 'right' });
      ui.hint(x, y, w, 10, [{ text: '{big:Inspiration}' }, { text: `{k:LMB} the Hopper · the selected node · up to ${Math.round(cap * 100)}% of each item` }], 190);
      y += 12;
    }
    // what it needs first (an Act III node also the Great Drill's stage 3, DESIGN.md §21)
    const drillShort = (d.drill ?? 0) > (g.s.mega.stage ?? 0);
    // Act V (DESIGN.md §23): The Last Fold waits on the Lighthouse and the Sky Anchor, tier 5 on the
    // Kernel node Beyond
    const megaShort = (d.megas ?? []).filter((m) => !megaComplete(g, m));
    const kernelShort = !!d.kernel && !hasKernel(g, d.kernel);
    if ((d.requires.length || drillShort || d.megas?.length || d.kernel) && !done && y + 12 <= end) {
      const gate = d.drill ? [(g.s.mega.stage ?? 0) >= d.drill ? `{good:${ICON.check} the Great Drill's stage ${d.drill}}` : `{bad:the Great Drill's stage ${d.drill}}`] : [];
      for (const m of d.megas ?? []) gate.push(megaComplete(g, m) ? `{good:${ICON.check} ${MEGAS[m].name}}` : `{bad:${MEGAS[m].name}}`);
      if (d.kernel) gate.push(hasKernel(g, d.kernel) ? `{good:${ICON.check} the Kernel node ${KERNELS[d.kernel].name}}` : `{bad:the Kernel node ${KERNELS[d.kernel].name}}`);
      y += flowRow(ui, ['{soft:needs}', ...gate, ...d.requires.map((q) => (g.done(q) ? `{good:${ICON.check} ${RESEARCH[q].name}}` : `{bad:${RESEARCH[q].name}}`))], x, y, w, end) + 3;
    }
    // the button
    if (done) {
      if (y + 14 <= end) { drawRich(ui, `{good:${ICON.check} researched}`, x, y + 2, w, T.good); y += 15; }
    } else if (can) {
      if (y + 18 <= end) {
        if (button(ui, 'selectNode', x, y, w, 17, sel ? 'Selected' : 'Research this', { gold: !sel, active: sel, tip: sel ? '{k:LMB} clear' : '{k:LMB} feed this one' })) app.act({ k: 'research', id: sel ? null : show });
        y += 21;
      }
    } else if (y + 14 <= end) {
      const elsewhere = !!d.world && d.world !== worldOf(g);
      const why = drillShort ? `{soft:${ICON.lock} needs the Great Drill's stage ${d.drill}}`
        : megaShort.length ? `{u:mega} {soft:${megaShort.map((m) => MEGAS[m].name).join(' and ')} must stand first}`
        : kernelShort ? `{u:kernel} {soft:needs the Kernel node ${KERNELS[d.kernel!].name}: bought with Kernels}`
        : elsewhere ? `{u:relocate} {soft:Relocate to ${WORLDS[d.world!].name} to research it}` : `{soft:${ICON.lock} locked}`;
      y += drawRich(ui, why, x, y + 2, w, T.inkSoft) + 4;
    }
    // what it leads to
    const next = RESEARCH_LIST.filter((q) => q.requires.includes(show));
    if (next.length && y + 20 <= end) {
      y += caption(ui, 'leads to', x, y);
      for (const q of next) {
        if (y + 10 > end) break;
        nodeIcon(ui, q.id, x, y, true);
        ui.clip(x + 11, y, w - 11, 10);
        ui.text(`${g.done(q.id) ? ICON.check + ' ' : ''}${q.name}`, x + 11, y, g.done(q.id) ? T.good : T.ink);
        ui.unclip();
        y += 10;
      }
      y += 3;
    }
    // ready now: every node that can be picked, the closest to done marked with a star
    const ready = RESEARCH_LIST.filter((q) => !g.done(q.id) && available(g, q.id) && q.id !== show).sort((p, q) => owed(p.id) - owed(q.id));
    if (ready.length && y + 22 <= end) {
      y += caption(ui, 'ready now', x, y, T.research);
      ready.forEach((q, i) => {
        if (y + 12 > end) return;
        const best = i === 0;
        const hv = ui.hover(x, y - 1, w, 12);
        ui.region(x, y - 1, w, 12, 'button');
        ui.mark('ready:' + q.id, x, y - 1, w, 12);
        nodeIcon(ui, q.id, x + 1, y, true);
        const n = best ? `${ICON.star} ${fmt(owed(q.id))}` : fmt(owed(q.id));
        const nw = textWidth(n);
        ui.clip(x + 12, y, w - 16 - nw, 10);
        ui.text(q.name, x + 12, y, T.ink);
        ui.unclip();
        ui.text(n, x + w - 1, y, best ? T.coin : T.inkSoft, { align: 'right' });
        // the closest one is underlined in pencil; the hovered one too
        if (best || hv) pencil(ui, x + 12, y + 9, Math.min(w - 16 - nw, textWidth(q.name)), best ? T.coin : T.inkSoft);
        if (hv) {
          ui.tip([{ text: `{big:${q.name}}` }, ...unlockRows(q.id).map((s) => ({ text: s })), { text: `${fmt(owed(q.id))} {soft:items still owed}${best ? `  {coinc:${ICON.star} closest}` : ''}` }, { text: '{k:LMB} research it' }], 190);
          if (ui.clicked) { ui.eat(); ui.sfx('click'); app.act({ k: 'research', id: q.id }); }
        }
        y += 12;
      });
    }
    // the lab at work in whatever room is left (the art director's scene), pasted in like a photo
    if (hasArt('research_lab')) {
      const lab = sheet('research_lab');
      const room = end - 6 - y;
      const k = room >= lab.h * 2 + 8 && w >= lab.w * 2 + 4 ? 2 : 1;
      if (room >= lab.h + 8 && w >= lab.w + 4) {
        const lx = x + Math.floor((w - lab.w * k) / 2), ly = end - 4 - lab.h * k;
        ctx.fillStyle = rgba(T.shadow, 0.35);
        ctx.fillRect(lx - 1, ly - 1, lab.w * k + 5, lab.h * k + 5);
        ui.fill(lx - 3, ly - 3, lab.w * k + 6, lab.h * k + 6, T.paperHi);
        ui.fill(lx - 1, ly - 1, lab.w * k + 2, lab.h * k + 2, T.ink);
        ctx.drawImage(lab.frames[Math.floor(ui.time * lab.fps) % lab.frames.length], lx, ly, lab.w * k, lab.h * k);
        // two strips of tape hold it to the page
        ctx.fillStyle = rgba(C.lamp3, 0.7);
        ctx.fillRect(lx - 6, ly - 5, 12, 4);
        ctx.fillRect(lx + lab.w * k - 6, ly - 5, 12, 4);
      }
    }
  }
  // the bank: items that arrived with nothing selected
  if (banked.length) {
    const by = page.y + page.h - 11;
    rule(ui, x, by - 11, w);
    let bx = x + caption(ui, 'banked', x, by - 9) * 0;
    bx = x;
    label(ui, 'banked', x, by - 9);
    for (const [item, v] of banked.slice(0, 6)) {
      const s = v.format();
      if (bx + 12 + textWidth(s) > x + w) break;
      ctx.drawImage(itemIcon(item), bx, by);
      bx += 13 + ui.text(s, bx + 10, by, T.ink);
    }
  }
}

// ================================================================== statistics

/** The Inspector's line on the books, by how the last minute went. */
function inspectorLine(app: App): string {
  const s = app.game.s;
  const inc = s.income.slice(-20);
  const now = inc.slice(-10).reduce((a, b) => a + b, 0), before = inc.slice(0, 10).reduce((a, b) => a + b, 0);
  if (!s.earned.gt(0)) return 'Empty books. I shall wait. Patiently.';
  if (!inc.some((v) => v > 0)) return 'Nothing sold this minute. I am writing that down.';
  if (before > 0 && now > before * 1.15) return 'Up and to the right. Noted, with approval.';
  if (s.research.done.length >= RESEARCH_LIST.length) return 'Every node researched. I am almost impressed.';
  return 'The figures are in order. Do carry on.';
}

function statsScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const s = g.s;
  const side = Math.min(190, Math.floor(r.w * 0.34));
  const { body, detail } = menuTemplate(app, r, { title: 'Statistics', accent: T.coin, icon: 'stats', tabs: backTabs(app), detail: side });
  const x = body.x + 2, w = body.w - 4;
  let y = body.y + 2;
  y += speaker(app, 'inspector', inspectorLine(app), x, y, w) + 5;
  const secs = Math.floor(g.seconds);
  const rows: [string, string, string?][] = [
    ['{u:clock} time played', `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m ${secs % 60}s`],
    ['{coin} coin now', `{coinc:${s.coin.format()}}`],
    ['{coin} coin earned', `{coinc:${s.earned.format()}}`],
    ['{coin} coin a minute', `{coinc:${Math.round(g.incomePerMin()).toLocaleString('en-US')}}`],
    ['{u:research} research done', `${s.research.done.length} of ${RESEARCH_LIST.length}`],
    ['{u:orders} orders filled', String(s.orders.done.length)],
    ['{u:workshop} land owned', `${s.land.length} chunk${s.land.length === 1 ? '' : 's'}`],
    ['{k:LMB} clicks', (s.counters.clicks ?? 0).toLocaleString('en-US')],
    ['{u:rotate} cranks', (s.counters.cranks ?? 0).toLocaleString('en-US')],
    ['{i:slag} slag shovelled', (s.counters.shovels ?? 0).toLocaleString('en-US')],
    ['{u:star} sparks caught', String(s.counters.sparks ?? 0)],
    ['{u:trophies} trophies', `${TROPHIES.filter((t) => g.flag('trophy:' + t.id)).length} of ${TROPHIES.length}`],
  ];
  // the ledger in two columns when the page is wide, else one
  const two = w >= 290;
  const cw = two ? Math.floor((w - 12) / 2) : w;
  const per = two ? Math.ceil(rows.length / 2) : rows.length;
  const room = Math.floor((body.y + body.h - 52 - y) / (LINE_H + 1));
  rows.forEach(([k, v], i) => {
    const col = two ? Math.floor(i / per) : 0, row = two ? i % per : i;
    if (row >= Math.max(room, two ? per : 6)) return;
    ledgerRow(ui, k, v, x + col * (cw + 12), y + row * (LINE_H + 1), cw);
  });
  y += Math.min(per, Math.max(room, two ? per : 6)) * (LINE_H + 1) + 6;
  // the machines on the floor (laid out first, so the chart leaves them room)
  const kinds = BUILD_BAR.map((kind) => ({ kind, n: s.ents.filter((e) => e.kind === kind).length })).filter((k) => k.n > 0);
  let mRows = kinds.length ? 1 : 0;
  { let mx2 = x; for (const k of kinds) { const kw = 19 + textWidth(`×${k.n}`) + 8; if (mx2 + kw > x + w) { mRows++; mx2 = x; } mx2 += kw; } }
  // the last minute's income, one pencil stroke a second
  const ch = Math.min(56, body.y + body.h - y - 18 - mRows * 18);
  if (ch >= 14) {
    const inc = s.income.slice(-60);
    const mx = Math.max(1, ...inc);
    caption(ui, 'coin a second over the last minute', x, y);
    drawRich(ui, `{soft:peak} {coinc:${Math.round(mx)}/s}`, x + w, y - 2, Infinity, T.ink, { align: 'right' });
    y += 10;
    const ctx = ui.ctx;
    ctx.fillStyle = rgba(T.paperLo, 0.45);
    ctx.fillRect(x, y, w, ch);
    rule(ui, x, y + ch, w, true);
    const bw = Math.max(2, Math.floor(w / 60));
    inc.forEach((v, i) => {
      const hh = Math.round((v / mx) * (ch - 2));
      const bx = x + w - (inc.length - i) * bw;
      if (bx < x || hh <= 0) return;
      const last = i === inc.length - 1;
      // a hatched pencil column, its top pressed harder
      for (let j = 0; j < hh; j += 2) {
        ctx.fillStyle = rgba(last ? T.coin : T.inkSoft, last ? 0.9 : 0.45);
        ctx.fillRect(bx, y + ch - 1 - j, Math.max(1, bw - 1), 1);
      }
      ctx.fillStyle = last ? T.coin : T.ink;
      ctx.fillRect(bx, y + ch - 1 - hh, Math.max(1, bw - 1), 1);
    });
    y += ch + 6;
  }
  // the machines on the floor, each sprite with its count
  let bx = x;
  for (const { kind, n } of kinds) {
    const cs = `×${n}`;
    const bw2 = 19 + textWidth(cs) + 8;
    if (bx + bw2 > x + w) { bx = x; y += 18; }
    if (y + 16 > body.y + body.h) break;
    ui.ctx.drawImage(sheet(kind).frames[0], bx, y);
    ui.text(cs, bx + 18, y + 5, T.ink);
    bx += bw2;
  }
  // the right page: what has been delivered to the Dock and the Hopper
  const dp = detail!;
  const dx = dp.x + 4, dw = dp.w - 8;
  let dy = dp.y + 2;
  ui.big('Delivered', dx, dy, T.ink);
  dy += 14;
  dy += caption(ui, 'dock and hopper', dx, dy);
  const rowH = Math.max(9, Math.min(LINE_H + 1, Math.floor((dp.y + dp.h - dy) / ITEM_IDS.length)));
  for (const id of ITEM_IDS) {
    if (dy + 9 > dp.y + dp.h) break;
    const v = s.delivered[id];
    if (v) ui.ctx.drawImage(itemIcon(id), dx, dy);
    else pencilIcon(ui, 'item:' + id, itemIcon(id), dx, dy, 8, T.paperEdge);
    const val = v ? v.format() : '-';
    ui.clip(dx + 11, dy, dw - 15 - textWidth(val), 10);
    ui.text(ITEMS[id].name, dx + 11, dy, v ? T.ink : T.inkSoft);
    ui.unclip();
    ui.text(val, dx + dw, dy, v ? T.coin : T.inkSoft, { align: 'right' });
    if (rowH >= LINE_H) rule(ui, dx, dy + 10, dw);
    dy += rowH;
  }
}

// ================================================================== trophies

/** A trophy's sticker centred on (cx, cy): earned, a gold-rimmed paper sticker with its icon and a
 * glint; not yet, its place pencilled in, the icon traced. */
export function sticker(app: App, t: TrophyDef, cx: number, cy: number, have: boolean, i: number, R = 13) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const src = t.icon ? itemIcon(t.icon) : null;
  if (have) {
    // stuck down by hand: a pixel off true, by the trophy
    const ox = (i * 7) % 3 - 1, oy = (i * 5) % 2;
    ctx.drawImage(discCanvas(R, 'afford'), cx - R + ox, cy - R + oy);
    const hs = R >= 20 ? 16 : R >= 12 ? 8 : 4;
    if (src) ctx.drawImage(src, cx - hs + ox, cy - hs + oy, hs * 2, hs * 2);
    else if (R >= 20 && hasArt('ui_icons')) ctx.drawImage(sheet('ui_icons').frames[4], cx - hs + ox, cy - hs + oy, 32, 32);
    else uiIcon(ui, 'trophies', cx - hs + ox, cy - hs + oy, R >= 12 ? 0 : 1);
    const gl = (ui.time * 0.6 + i * 0.13) % 3;
    if (gl < 1) {
      ui.clip(cx - R + 3 + ox, cy - R + 3 + oy, 2 * R - 6, 2 * R - 6);
      ctx.fillStyle = rgba(C.bone, 0.5);
      ctx.fillRect(Math.round(cx - R + gl * 2 * R) + ox, cy - R + oy, 2, 2 * R);
      ui.unclip();
    }
  } else {
    // the sticker's place, pencilled: a dashed ring
    dashedRing(ui, cx, cy, R - 1, T.inkSoft, 0.55);
    const hs = R >= 20 ? 16 : 8;
    if (src) pencilIcon(ui, 'item:' + t.icon, src, cx - hs, cy - hs, hs * 2, T.inkSoft);
    else if (hasArt('ui_icons')) pencilIcon(ui, 'ui:trophies', sheet('ui_icons').frames[4], cx - hs, cy - hs, hs * 2, T.inkSoft);
    else ui.text('?', cx - 2, cy - 4, T.inkSoft);
  }
}

// ================================================================== options

function optionsScreen(app: App, r: Rect) {
  const ui = app.ui;
  const side = Math.min(200, Math.floor(r.w * 0.4));
  const { body, detail } = menuTemplate(app, r, { title: 'Options', accent: T.ink, icon: 'options', tabs: backTabs(app), detail: side });
  const x = body.x + 4, w = Math.min(body.w - 8, 300);
  let y = body.y + 4;
  y += caption(ui, 'the game', x, y) + 2;
  /** a setting's row: its icon and name, its control at the right, ruled under */
  const row = (ic: string, name: string, draw: (bx: number, by: number) => void, cw = 50) => {
    drawRich(ui, `${ic} ${name}`, x, y + 4, Infinity, T.ink);
    draw(x + w - cw, y);
    rule(ui, x, y + 20, w);
    y += 24;
  };
  const toggle = (id: string, on: boolean, click: () => void) => (bx: number, by: number) => {
    if (button(ui, id, bx, by, 50, 17, on ? 'on' : 'off', { active: on, tip: on ? '{k:LMB} off' : '{k:LMB} on' })) click();
  };
  const mute = app.input.binds.mute?.[0];
  row('{u:heart}', `Sound${mute ? `  {k:=${keyLabel(mute)}}` : ''}`, toggle('opt:Sound', !app.muted, () => setMute(app, !app.muted)));
  // Milestone 12: the four buses' volumes (src/app/soundopts.ts)
  y += volumeRows(app, x, y - 2, w) + 2;
  rule(ui, x, y - 4, w);
  // Milestone 6: the notation, a player setting (src/app/settings.ts), cycled by one button
  const notes = Object.values(NOTATION_LABEL) as string[];
  const nw = Math.max(80, ...notes.map((n) => textWidth(n) + 16));
  row('{u:stats}', 'Numbers', (bx, by) => {
    const cur = NOTATION_LABEL[getNotation()];
    if (button(ui, 'opt:notation', bx, by, nw, 17, cur, { tip: [{ text: '{big:Numbers}' }, { text: notes.map((n) => (n === cur ? `{ink:${n}}` : `{soft:${n}}`)).join(' · ') }, { text: '{k:LMB} next' }] })) cycleNotation();
  }, nw);
  row('{u:play}', 'Reduced motion', toggle('opt:Reduced motion', app.renderer.fx.calm, () => setCalm(app, !app.renderer.fx.calm)));
  // how much a hover over the floor shows (the owner, 2026-10-21: the tags took too much room)
  const hovers = Object.values(HOVER_LABEL) as string[];
  const hw = Math.max(80, ...hovers.map((n) => richWidth(n) + 16));
  row('{u:stats}', 'Hover tags', (bx, by) => {
    const cur = HOVER_LABEL[getHoverTags()];
    if (button(ui, 'opt:hover', bx, by, hw, 17, cur, { tip: [{ text: '{big:Hover tags}' }, { text: hovers.map((n) => (n === cur ? `{ink:${n}}` : `{soft:${n}}`)).join(' · ') }, { text: '{k:LMB} next · {k:LMB} a machine pins every row' }] })) cycleHoverTags();
  }, hw);
  y += accessRows(app, x, y, w); // Milestone 13: UI scale, lesson cards (src/app/access.ts)
  // the drawn keyboard lives on its own page
  y += 6;
  const help = app.input.binds.help?.[0];
  if (button(ui, 'openKeys', x, y, Math.min(w, 140), 17, `Keys${help ? `  {k:=${keyLabel(help)}}` : ''}`, { tip: '{k:LMB} the drawn keyboard' })) { app.panel = 'keys'; app.audio.sfx('open'); }
  // Act III: the Scenario boards, other games beside the town (after the first Reorganize)
  if (scenariosOpen(app) && y + 21 + 26 <= body.y + body.h) {
    y += 21;
    y += caption(ui, 'other games', x, y) + 2;
    if (button(ui, 'openScenarios', x, y, Math.min(w, 140), 17, '{u:trophies} Scenarios', { tip: [{ text: '{big:Scenarios}' }, { text: 'puzzle boards · a personal best each' }, { text: '{soft:your town waits while you play}' }] })) { app.panel = 'scenarios'; app.audio.sfx('open'); }
  }
  // the right page: saves, the overnight forecast, the title
  const dp = detail!;
  const dx = dp.x + 4, dw = dp.w - 8;
  let dy = dp.y + 4;
  dy += caption(ui, 'saves', dx, dy) + 2;
  const btn = (id: string, text: string, tip: TipLine[] | string, click: () => void) => {
    if (dy + 17 > dp.y + dp.h) return;
    if (button(ui, id, dx, dy, dw, 17, text, { tip })) click();
    dy += 21;
  };
  btn('save', '{u:clock} Save now', '{u:clock} autosave every 30 s · and on leaving', () => { app.save(); app.toast('Saved', '{u:clock} autosave every 30 s · and on leaving', C.leaf); });
  btn('export', 'Export save', '{k:LMB} copy the save string', () => app.copyExport());
  btn('import', 'Import save', '{k:LMB} paste a save string', () => app.promptImport());
  dy += 4;
  dy += caption(ui, 'before you go', dx, dy) + 2;
  // Milestone 6: the overnight forecast, and the damaged save kept aside by a failed load
  btn('overnight', '{u:overnight} Safe for overnight', [{ text: '{big:Safe for overnight}' }, { text: '{u:clock} look ahead · which lines jam · stop them' }], () => { app.panel = 'overnight'; });
  const bad = app.damagedSave();
  if (bad) btn('copyBad', 'Copy the damaged save', [{ text: '{bad:a save that would not load}' }, { text: '{k:LMB} copy it · send it in' }], () => { void navigator.clipboard?.writeText(bad); });
  dy += 4;
  btn('title', 'Back to the title', '{u:clock} saves first', () => { app.save(); app.toTitle(); });
}

void BIG_CAP_H; void CAP_H;
