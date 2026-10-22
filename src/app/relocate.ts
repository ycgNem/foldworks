// The Relocate card (DESIGN.md §22, reset layer 2; the Reorganize card's model, docs/hud-180.md
// "Full-screen menus"): Mayor Bramble packs the lily pads. The left page is the contract: the islands
// to fly to as labelled keys, then what the move banks (Legacy, term by term: each floor's best this
// world, the Megaproject stages, a new island) with what would raise it, what is kept (ticked) and
// what is lost (struck through in red ink). The right page is the island picked: its ground and its
// exotic, its rule, its tier 4 goods, whether the town has been there, its Megaproject stages and its
// records. A gold "Fly to ..." takes two clicks; then the travel moment (the town on its rotor raft
// flying from one island to the other, `audio.resetSound(2)`) and the Legacy tree opens to spend
// what was banked. Pillar 4: the move is always the player's, and the card says what it costs.
// Presentation only: the move itself is the `relocate` command (src/sim/relocate.ts).
//
// Entry: a labelled slip under the Purse (the Reorganize slip's place) once a Relocate is possible
// or close (Relocation researched or open, the World floor standing in this world), the Relocate
// key on the Patent Office and the Legacy tree, and the World's coach.
import { C, rgba } from '../data/palette';
import { ITEMS, type ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { WORLDS, type WorldId } from '../data/worlds';
import { isleName, destinations, relocateNow, relocateClose } from './moves';
import { MEGAS } from '../data/megaprojects';
import { ICON, bigWidth, BIG_H, textWidth } from '../ui/font';
import { layoutRich, drawLayout, richWidth, drawRich } from '../ui/rich';
import { T } from '../ui/theme';
import { sheet, hasArt, itemIcon } from '../render/sprites';
import { previewLegacy, relocateRefusal, RELOCATE_KEPT, RELOCATE_LOST, LEGACY_FLOORS, type LegacyPreview } from '../sim/relocate';
import { lrules } from '../sim/legacy';
import { worldOf } from '../sim/systems/islands';
import { TICK_RATE } from '../engine/time';
import type { LegacyFloor } from '../sim/world';
import { button, rule, chip, chipWidth, slip, stamp, type UIconName } from './chrome';
import { menuTemplate, rays, type IconName } from './widgets';
import { bookArea, speak, heading, struck, ROW_H } from './ledger';
import { registerCounter } from './topbar';
import { registerScreen } from './screens';
import type { App } from './app';
import type { Rect } from '../ui/ui';

/** the island picked on the card, the confirm's arming, the travel moment under way */
const st = {
  target: null as WorldId | null,
  armedUntil: -1,
  travel: null as null | { from: WorldId; to: WorldId; legacy: number; t0: number; shook: boolean },
};

/** Pick an island on the card (the e2e states). */
export function pickIsland(w: WorldId | null) { st.target = w; st.armedUntil = -1; }
/** Start the travel moment without a move (the e2e states). */
export function travelDebug(app: App, from: WorldId, to: WorldId, legacy: number, age = 1.4) {
  st.travel = { from, to, legacy, t0: app.ui.time - age, shook: true };
  app.panel = 'relocate';
}

const SHORT: Record<WorldId, string> = { home: 'Home', pebble: 'Pebble Isle', cinder: 'Cinder Isle', rime: 'Rime', oldworks: 'Old Works' };
const FLOOR_ICON: Record<LegacyFloor, UIconName> = { workshop: 'workshop', factory: 'factory', district: 'district', world: 'world' };
const FLOOR_NAME: Record<LegacyFloor, string> = { workshop: 'Workshop', factory: 'Factory', district: 'District', world: 'World' };
const p1 = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));
const hm = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;


/** The island the card shows: the one picked, else the first not visited, else the first. */
function targetOf(app: App): WorldId {
  const ds = destinations(app);
  if (st.target && ds.includes(st.target)) return st.target;
  const visited = app.game.s.meta.visited ?? ['home'];
  return ds.find((w) => !visited.includes(w)) ?? ds[0];
}


// ------------------------------------------------------------------ the card

function relocateCard(app: App, r0: Rect) {
  if (st.travel) return travelScene(app, r0);
  const ui = app.ui;
  const g = app.game;
  const r = bookArea(r0);
  const to = targetOf(app);
  const p = previewLegacy(g, to);
  const why = relocateRefusal(g, to);
  const armed = ui.time < st.armedUntil && !why;
  const { body, detail } = menuTemplate(app, r, { title: 'Relocate', accent: C.violet, icon: 'relocate' as IconName, detail: Math.max(150, Math.min(196, Math.floor(r.w * 0.36))) });
  // ---- Bramble, packing the lily pads
  const legacyChip = `{chip:coin:+${p.now} Legacy}`;
  const line = why ? `Not yet! ${shortWhy(why)}` : armed ? 'Sure? The lily pads are packed! Click again!' : `Pack the lily pads! To ${isleName(to)}! ${legacyChip}`;
  let y = body.y;
  y += speak(app, 'bramble', line, body.x, y, Math.min(body.w, 320), { size: 24 }) + 5;
  // ---- the islands to choose from, as labelled keys
  y = islandKeys(app, body.x, y, body.w, to) + 4;
  // ---- the contract: what it banks, keeps and loses
  const foot = 24;
  const sheetR = { x: body.x + 2, y, w: body.w - 4, h: body.y + body.h - foot - y };
  ui.panel(sheetR.x, sheetR.y, sheetR.w, sheetR.h, 'paper', true);
  const ix = sheetR.x + 6, iy = sheetR.y + 5, iw = sheetR.w - 12, ih = sheetR.h - 9;
  const gw = Math.floor((iw - 8) * 0.54);
  bankColumn(app, p, to, { x: ix, y: iy, w: gw, h: ih });
  const kx = ix + gw + 8;
  ui.ctx.fillStyle = T.paperEdge;
  ui.ctx.fillRect(kx - 4, iy, 1, ih);
  keepLoseColumn(app, { x: kx, y: iy, w: iw - gw - 8, h: ih });
  // ---- this world so far, and the signature
  const fy = body.y + body.h - foot + 6;
  const m = g.s.meta;
  const label = why ? 'Not yet' : armed ? 'Sure? Fly' : `Fly to ${SHORT[to]}`;
  const bw = Math.max(110, bigWidth(label) + 34);
  const bx = body.x + body.w - bw - 2;
  const since = Math.max(0, (g.s.tick - (m.here?.start ?? 0)) / TICK_RATE);
  const moves = `${m.relocations ?? 0} {soft:${(m.relocations ?? 0) === 1 ? 'move' : 'moves'}}`;
  // the longest wording that fits left of the Fly button (the Act IV screens' review: at 1024 the
  // whole row was hidden behind it)
  const isle = isleName(worldOf(g), true);
  const runRows = [
    `{big:${isle}} {u:clock} ${hm(since)} {soft:this world} · ${moves}`,
    `{big:${SHORT[worldOf(g)]}} {u:clock} ${hm(since)} · ${moves}`,
    `{u:clock} ${hm(since)} {soft:this world} · ${moves}`,
    `{u:clock} ${hm(since)} · ${moves}`,
  ];
  const RL = runRows.map((q) => layoutRich(q)).find((q) => body.x + 2 + q.w < bx - 8);
  if (RL) {
    drawLayout(ui, RL, body.x + 2, fy - 2, T.ink);
    ui.hint(body.x + 2, fy - 3, RL.w, 12, [{ text: `{big:${isle}}` }, { text: `${hm(since)} this world · ${m.relocations ?? 0} ${(m.relocations ?? 0) === 1 ? 'move' : 'moves'} so far` }], 200);
  }
  const tip = why ? [{ text: `{bad:${why}}` }] : armed ? [{ text: '{u:relocate} click again · the town flies' }] : [{ text: '{u:relocate} two clicks · the first arms it' }, { text: `{coin:+${p.now} Legacy} banked · Patents and the tree reset` }];
  if (button(ui, 'relocateGo', bx, fy - 6, bw, 20, label, { icon: 'relocate', disabled: !!why, gold: !why, big: true, pulse: armed, tip })) {
    if (!armed) st.armedUntil = ui.time + 4;
    else {
      st.armedUntil = -1;
      const from = worldOf(g);
      if (app.act({ k: 'relocate', world: to }).ok) afterRelocate(app, from, to, p.now);
    }
  }
  // ---- the island, on the right page
  if (detail) islandPage(app, to, detail);
}

/** A refusal in Bramble's words (the sim's sentence, shortened to its first clause). */
function shortWhy(why: string): string {
  if (/Research Relocation/.test(why)) return 'Research {research:Relocation} first.';
  if (/World floor/.test(why)) return 'The {u:world} World floor must stand here first.';
  if (/audit/.test(why)) return 'Fold or cancel that audit first.';
  if (/Nothing to bank/.test(why)) return 'Fold on more floors first.';
  return why.split(':')[0] + '.';
}

/** The islands as a row of labelled keys ("ISLANDS  [Pebble Isle] [Cinder Isle] ..."), a dot on
 * one not visited. Returns the y under them. */
function islandKeys(app: App, x: number, y: number, w: number, to: WorldId): number {
  const ui = app.ui;
  const g = app.game;
  const visited = g.s.meta.visited ?? ['home'];
  ui.small('FLY TO', x, y + 5, T.reset);
  const x0 = x + 30;
  let bx = x0, row = 0;
  for (const wid of destinations(app)) {
    const lab = SHORT[wid];
    const kw = textWidth(lab) + 14;
    if (bx + kw > x + w && bx > x0) { row++; bx = x0; }
    const by = y + row * 17;
    const fresh = !visited.includes(wid);
    const tip = [{ text: `{big:${isleName(wid, true)}}` }, { text: WORLDS[wid].rule }, { text: fresh ? `{good:not visited} · +${RULES.legacyNewIsland.value} Legacy` : '{soft:visited before}' }];
    if (button(ui, 'isle_' + wid, bx, by, kw, 15, lab, { active: wid === to, tip }) && wid !== to) { st.target = wid; st.armedUntil = -1; }
    if (fresh) { ui.fill(bx + kw - 4, by + 1, 3, 3, T.ink); ui.fill(bx + kw - 3, by + 2, 1, 1, C.gold); }
    bx += kw + 3;
  }
  return y + (row + 1) * 17;
}

/** The left column: the Legacy the move banks, term by term, and what would raise it. */
function bankColumn(app: App, p: LegacyPreview, to: WorldId, c: Rect) {
  const ui = app.ui;
  const bottom = c.y + c.h;
  let y = c.y;
  heading(ui, 'You bank', c.x, y, c.w, 'coin');
  ui.text('Legacy', c.x + c.w, y + 2, T.coin, { align: 'right' });
  ui.big(`+${p.now}`, c.x + c.w - textWidth('Legacy') - 4, y, T.coin, { align: 'right' });
  y += BIG_H + 5;
  const per = RULES.legacyPerValue.value;
  const row = (left: string, right: string, tip?: string, wrap = false): boolean => {
    const rw = richWidth(right);
    const L = layoutRich(left, wrap ? c.w - rw - 6 : Infinity);
    if (!wrap && L.w > c.w - rw - 6) return false;
    const h = L.lines.length > 1 ? L.h + 3 : ROW_H;
    if (y + h > bottom) return false;
    drawLayout(ui, L, c.x, y + 2, T.ink);
    drawLayout(ui, layoutRich(right), c.x + c.w, y + 2, T.ink, { align: 'right' });
    if (tip) ui.hint(c.x, y, c.w, h, tip, 210);
    y += h;
    return true;
  };
  // each floor's best this world: steps x grade x tier, a quarter of it Legacy
  for (const f of LEGACY_FLOORS) {
    const b = p.floors[f];
    const ic = `{u:${FLOOR_ICON[f]}}`;
    if (!b) { row(`${ic} ${FLOOR_NAME[f]} {soft:none yet}`, '{soft:0}', f === 'world' ? '{u:world} a District fold put to work up there: 60 s at half speed or better' : `{u:fold} a fold on the ${FLOOR_NAME[f]} this world`); continue; }
    const fact = `${b.steps}×${b.grade}${b.tier ? `×t${b.tier}` : ''}`;
    const tip = `{i:${b.item}} ${ITEMS[b.item]?.name ?? b.item} · ${b.steps} steps × grade ${b.grade}${b.tier ? ` × tier ${b.tier}` : ''} = ${p1(b.value)} · ÷${per}`;
    // narrower: the floor and its product (the sum in the tip), then the product and its sum
    const gain = `{coinc:+${p1(b.value / per)}}`;
    if (!row(`${ic} ${FLOOR_NAME[f]} {i:${b.item}} {soft:${fact}}`, gain, tip) && !row(`${ic} ${FLOOR_NAME[f]} {i:${b.item}}`, gain, tip)) row(`${ic} {i:${b.item}} {soft:${fact}}`, gain, tip);
  }
  row(`{u:mega} stages built ×${p.stages}`, p.stageTerm ? `{coinc:+${p1(p.stageTerm)}}` : '{soft:0}', `{u:mega} Megaproject stages finished this world · ${RULES.legacyPerStage.value} Legacy each`);
  row(`{u:relocate} ${p.newIsland ? 'a new island' : `{soft:${SHORT[to]} visited}`}`, p.newIsland ? `{coinc:+${p.newIsland}}` : '{soft:0}', p.newIsland ? `{u:relocate} ${isleName(to, true)} has not seen the town yet` : '{soft:an island visited before banks no bonus}');
  if (y + 3 + ROW_H <= bottom) {
    rule(ui, c.x, y + 1, c.w, true);
    y += 3;
    if (!row('{big:Total} {soft:rounded down}', `{coinc:${p1(p.total)}} → {big:${p.now}}`, `${p1(p.total)} rounded down`)) row('{big:Total}', `{coinc:${p1(p.total)}} → {big:${p.now}}`, `${p1(p.total)} rounded down`);
  }
  // what raises it
  if (p.goals.length && y + ROW_H + 2 <= bottom) {
    y += 2;
    const cw = chip(ui, c.x, y, 'raises it', { role: 'coin', solid: true });
    void cw;
    y += ROW_H;
  }
  for (const q of p.goals.slice(0, 4)) {
    if (!row(`{soft:${ICON.right}} ${shortGoal(q.text)}`, `{coinc:+${p1(q.gain)}}`, q.text, true)) break;
  }
}

/** A goal's line cut to its first clause (its whole sentence is its tip). */
function shortGoal(s: string): string {
  const i = s.indexOf(':');
  return i > 0 ? s.slice(0, i) : s;
}

/** Why each kept thing is kept, in short (the sim's rows are the tips). */
const KEPT_SHORT: Record<string, string> = {
  'Legacy and the Legacy tree': '{u:legacy} Legacy and its tree',
  'Every Megaproject': '{u:mega} every Megaproject',
  'Reputation': '{u:heart} reputation',
  'The Codex and the Patent Drawer': '{u:codex} the Codex and the Drawer',
  'Trophies, lifetime statistics, Challenges won': '{u:trophies} trophies and statistics',
  "The worlds' records": "{u:world} the islands' records",
};
const LOST_SHORT = ['every floor, coin, land, research', 'Patents and the Patent tree', 'the record on file', "the Anchor's kept room"];
/** the same, for a narrow page (each on one line) */
const KEPT_TINY: Record<string, string> = {
  'Legacy and the Legacy tree': '{u:legacy} Legacy, its tree',
  'Every Megaproject': '{u:mega} Megaprojects',
  'Reputation': '{u:heart} reputation',
  'The Codex and the Patent Drawer': '{u:codex} Codex, Drawer',
  'Trophies, lifetime statistics, Challenges won': '{u:trophies} trophies, stats',
  "The worlds' records": '{u:world} records',
};
const LOST_TINY = ['floors, coin, research', 'Patents, Patent tree', 'the record on file', "Anchor's kept room"];
/** The first of a row's wordings that fits on one line, else the last. */
const oneLine = (w: number, ...ss: string[]) => ss.find((s) => richWidth(s) <= w) ?? ss[ss.length - 1];

/** The right column: what the move keeps (ticked) and loses (struck in red ink); Old Habits' picks. */
function keepLoseColumn(app: App, c: Rect) {
  const ui = app.ui;
  const g = app.game;
  let y = c.y;
  const bottom = c.y + c.h;
  heading(ui, 'You keep', c.x, y, c.w, 'good');
  y += BIG_H + 4;
  for (const k of RELOCATE_KEPT) {
    const L = layoutRich(oneLine(c.w - 10, KEPT_SHORT[k.what] ?? k.what, KEPT_TINY[k.what] ?? k.what), c.w - 10);
    if (y + L.h > bottom) break;
    ui.text(ICON.check, c.x, y, T.good);
    drawLayout(ui, L, c.x + 9, y, T.ink);
    ui.hint(c.x, y - 1, c.w, L.h + 2, [{ text: `{good:${ICON.check}} {big:${k.what}}` }, { text: k.why, color: T.inkSoft }], 200);
    y += L.h + 1;
  }
  // Old Habits (a Legacy node): the Patent nodes chosen to keep
  const slots = lrules(g).habitSlots;
  if (slots && y + 11 <= bottom) {
    const n = (g.s.meta.habits ?? []).length;
    const s = `{good:${ICON.check}} {u:patents} ${n}/${slots} Patent nodes`;
    drawRich(ui, s, c.x, y, c.w, T.ink);
    ui.hint(c.x, y - 1, c.w, 11, [{ text: '{big:Old Habits}' }, { text: `${n} of ${slots} Patent nodes kept through the move` }, { text: '{k:LMB} choose them on the Legacy tree' }], 200);
    if (ui.hover(c.x, y - 1, c.w, 11) && ui.clicked) { ui.eat(); app.panel = 'legacy'; }
    y += 11;
  }
  y += 3;
  if (y + BIG_H + 8 > bottom) return;
  heading(ui, 'You lose', c.x, y, c.w, 'bad');
  y += BIG_H + 4;
  RELOCATE_LOST.forEach((full, i) => {
    const s = oneLine(c.w - 10, LOST_SHORT[i] ?? full, LOST_TINY[i] ?? full);
    const h = layoutRich(s, c.w - 10).h;
    if (y + h > bottom) return;
    ui.text(ICON.cross, c.x, y, T.bad);
    struck(ui, s, c.x + 9, y, c.w - 10);
    ui.hint(c.x, y - 1, c.w, h + 2, [{ text: `{bad:${ICON.cross}} {big:Lost}` }, { text: full, color: T.inkSoft }], 210);
    y += h + 1;
  });
}

// ------------------------------------------------------------------ the island, on the right page

/** An island's ground in a framed swatch: its meadow tiles with its exotic deposit in the middle
 * (Home: the town's house). k: the scale. */
export function islandSwatch(app: App, w: WorldId, x: number, y: number, cols: number, k = 1) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const T16 = 16 * k;
  const gname = w !== 'home' && hasArt(`isle_${w}_tile_grass`) ? `isle_${w}_tile_grass` : 'tile_grass';
  ui.fill(x - 1, y - 1, cols * T16 + 2, 2 * T16 + 2, T.ink);
  if (hasArt(gname)) {
    const s = sheet(gname);
    for (let j = 0; j < 2; j++) for (let i = 0; i < cols; i++) ctx.drawImage(s.frames[(i * 3 + j) % s.frames.length], x + i * T16, y + j * T16, T16, T16);
  } else ui.fill(x, y, cols * T16, 2 * T16, C.grass0);
  const ex = WORLDS[w].exotic;
  const cx = x + Math.floor((cols * T16) / 2) - T16, cy = y;
  const ore = ex === 'skyglass' ? 'ore_skyglass' : ex === 'cinderite' ? 'ore_cinderite' : ex === 'rimeCrystal' ? 'ore_rime' : ex === 'relic' ? 'ore_relic' : null;
  if (ore && hasArt(ore)) {
    const s = sheet(ore);
    // the four quadrants on the island's meadow (frames 5-8: TL TR BL BR)
    const q = s.frames.length >= 9 ? [5, 6, 7, 8] : [0, 0, 0, 0];
    ctx.drawImage(s.frames[q[0]], cx, cy, T16, T16);
    ctx.drawImage(s.frames[q[1]], cx + T16, cy, T16, T16);
    ctx.drawImage(s.frames[q[2]], cx, cy + T16, T16, T16);
    ctx.drawImage(s.frames[q[3]], cx + T16, cy + T16, T16, T16);
  } else if (w === 'home' && hasArt('town_house')) ctx.drawImage(sheet('town_house').frames[5], cx, cy, 2 * T16, 2 * T16);
}

/** The island picked: its ground, name and line, whether the town has been, its rule, exotic and
 * tier 4 goods, its Megaproject stages and its records. */
function islandPage(app: App, w: WorldId, page: Rect) {
  const ui = app.ui;
  const g = app.game;
  const def = WORLDS[w];
  const x = page.x + 4, pw = page.w - 8;
  const end = page.y + page.h;
  let y = page.y + 2;
  const cols = Math.max(3, Math.min(6, Math.floor(pw / 16)));
  islandSwatch(app, w, x + Math.floor((pw - cols * 16) / 2), y + 1, cols);
  y += 36;
  ui.big(isleName(w, true), x, y, T.ink);
  const visited = (g.s.meta.visited ?? ['home']).includes(w);
  const cs = visited ? 'visited' : `new +${RULES.legacyNewIsland.value}`;
  const cwid = chipWidth(cs);
  if (bigWidth(isleName(w, true)) + cwid + 6 <= pw) chip(ui, x + pw - cwid, y, cs, { role: visited ? 'soft' : 'good', solid: !visited });
  y += BIG_H + 3;
  y += drawRich(ui, `{soft:${def.title}}`, x, y, pw, T.inkSoft) + 3;
  const cap = (s: string) => { ui.small(s.toUpperCase(), x, y, T.inkSoft); y += 8; };
  if (y + 18 <= end) {
    cap('the rule');
    y += drawRich(ui, def.rule, x, y, pw, T.ink) + 3;
  }
  if (def.exotic && y + 20 <= end) {
    cap('its goods');
    const ex = def.exotic;
    const goods = def.goods.map((it) => `{i:${it}}`).join(' ');
    y += drawRich(ui, `{i:${ex}} ${ITEMS[ex]?.name ?? ex} {soft:deposit} ${ICON.right} ${goods}`, x, y, pw, T.ink) + 3;
    ui.hint(x, y - 12, pw, 12, [{ text: `{big:${ITEMS[ex]?.name ?? ex}}` }, ...def.goods.map((it) => ({ text: `{i:${it}} ${ITEMS[it]?.name ?? it}` })), { text: '{soft:its research is offered only there}' }], 190);
  }
  // the Lighthouse's and the Sky Anchor's stage on this island
  const stages = (['lighthouse', 'anchor'] as const).map((mid) => ({ mid, stg: MEGAS[mid].stages.find((s2) => s2.world === w) })).filter((q) => q.stg);
  if (stages.length && y + 20 <= end) {
    cap('megaprojects here');
    for (const { mid, stg } of stages) {
      if (y + 10 > end || !stg) break;
      const ms = g.s.megas?.[mid];
      const done = !!ms?.done?.includes(stg.stage);
      const held = w === worldOf(g) ? ms?.progress : ms?.held?.[stg.stage];
      let have = 0, need = 0;
      for (const [it, n] of Object.entries(stg.wants) as [ItemId, number][]) { need += n; have += Math.min(n, held?.[it]?.toNumber() ?? 0); }
      const part = stg.name.split(', ')[1]?.replace(/ \(.*\)$/, '') ?? `stage ${stg.stage}`;
      const state = done ? `{good:${ICON.check} built}` : have > 0 ? `{coinc:${Math.floor((have / Math.max(1, need)) * 100)}% held}` : '{soft:to build}';
      ui.clip(x, y, pw, 10);
      drawRich(ui, `{u:mega} ${part} ${state}`, x, y, Infinity, T.ink);
      ui.unclip();
      ui.hint(x, y, pw, 10, [{ text: `{big:${stg.name}}` }, { text: stg.reward }, { text: done ? '{good:it stands for good}' : have > 0 ? '{soft:half built: it waits on the island for the town}' : `{soft:${MEGAS[mid].name}: one stage on each island}` }], 200);
      y += 10;
    }
    y += 3;
  }
  // its records: the best fold of each floor ever made there
  const rec = g.s.meta.worldRecords?.[w];
  if (y + 18 <= end) {
    cap('its records');
    const fl = LEGACY_FLOORS.filter((f) => rec?.[f]);
    if (!fl.length) { drawRich(ui, '{soft:none yet}', x, y, pw, T.inkSoft); y += 10; }
    for (const f of fl) {
      if (y + 10 > end) break;
      const b = rec![f]!;
      ui.clip(x, y, pw, 10);
      drawRich(ui, `{u:${FLOOR_ICON[f]}} {i:${b.item}} ${b.grade} {soft:${b.steps}×t${b.tier} ·} ${p1(b.value)}`, x, y, Infinity, T.ink);
      ui.unclip();
      y += 10;
    }
  }
}

// ------------------------------------------------------------------ the move, and the travel moment

/** The app's side of a Relocate: nothing of the old world stays selected or open, the new island's
 * first run is framed, the boom plays (`resetSound(2)`), and the travel moment runs on the card;
 * the Legacy tree opens after it. */
function afterRelocate(app: App, from: WorldId, to: WorldId, legacy: number) {
  app.selected = null;
  app.fselected = null;
  app.gradeId = null;
  app.mode = { k: 'idle' };
  app.renderer.ground = null;
  app.setFloor('workshop', true);
  app.fitCamera(true);
  st.travel = { from, to, legacy, t0: app.ui.time, shook: false };
  st.target = null;
  app.panel = 'relocate';
  app.audio.resetSound(2);
  app.save();
}

const TRAVEL_S = 3.8;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The town flying to its new island: the sky rushing past, the old island falling behind on the
 * left, the new one rising on the right, the town on a rotor raft between them along a dashed line;
 * on landing a stamp with the Legacy banked and confetti. A click (or Esc) skips it. */
function travelScene(app: App, r: Rect) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const tr = st.travel!;
  const t = ui.time - tr.t0;
  const done = () => {
    st.travel = null;
    app.panel = 'legacy';
    app.toast('Relocated!', `{u:relocate} ${isleName(tr.to, true)} · {coin:+${tr.legacy} Legacy} banked · spend it on the tree`, C.gold, 'legacy');
  };
  if (t >= TRAVEL_S + 1.2) return done();
  ui.region(r.x, r.y, r.w, r.h, 'panel');
  ui.mark('travelScene', r.x, r.y, r.w, r.h);
  ui.clip(r.x, r.y, r.w, r.h);
  // the sky, in bands, deepening upward
  const bands = [C.sky0, C.sky1, C.sky2, C.sky3, C.sky4];
  for (let i = 0; i < bands.length; i++) ui.fill(r.x, r.y + Math.floor((r.h * i) / bands.length), r.w, Math.ceil(r.h / bands.length) + 1, bands[i]);
  // clouds rushing left (the faster the nearer)
  if (hasArt('sky_cloud')) {
    const cl = sheet('sky_cloud');
    for (let i = 0; i < 9; i++) {
      const sp = 40 + (i % 3) * 45;
      const yy = r.y + ((i * 47) % Math.max(1, r.h - 30));
      const xx = r.x + r.w + 70 - (((t * sp + i * 97) % (r.w + 140)));
      ctx.globalAlpha = 0.55 + (i % 3) * 0.15;
      ctx.drawImage(cl.frames[i % cl.frames.length], Math.round(xx), Math.round(yy));
      ctx.globalAlpha = 1;
    }
  }
  const k = Math.max(1, Math.min(3, Math.floor(Math.min(r.w / 260, r.h / 150))));
  const IW = 64 * k, IH = 48 * k;
  // the islands: the old one sinking away left, the new one rising in on the right
  const leave = ease(t / TRAVEL_S);
  const fromX = r.x + Math.round(r.w * 0.06 - leave * (r.w * 0.22)), fromY = r.y + Math.round(r.h * 0.45 + leave * 18);
  const arrive = ease((t - 0.3) / (TRAVEL_S - 0.6));
  const toX = r.x + Math.round(r.w * 0.94 - IW + (1 - arrive) * (r.w * 0.25)), toY = r.y + Math.round(r.h * 0.42 - (1 - arrive) * 10);
  islet(app, tr.from, fromX, fromY, k);
  islet(app, tr.to, toX, toY, k);
  // the flight: a dashed line from the old island's top to the new one's
  const ax = fromX + IW / 2, ay = fromY + 4 * k, bx = toX + IW / 2, by = toY + 4 * k;
  const fly = ease((t - 0.4) / (TRAVEL_S - 1.2));
  const px = ax + (bx - ax) * fly, py = ay + (by - ay) * fly - Math.sin(Math.PI * fly) * r.h * 0.22;
  ctx.fillStyle = rgba(C.bone, 0.85);
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    if (f > fly) break;
    if (Math.floor(i - t * 12) % 3 === 0) continue;
    const qx = ax + (bx - ax) * f, qy = ay + (by - ay) * f - Math.sin(Math.PI * f) * r.h * 0.22;
    ctx.fillRect(Math.round(qx), Math.round(qy), k, k);
  }
  raft(app, px, py, k, t);
  // the words: where to, then the Legacy banked
  const title = `To ${isleName(tr.to, true)}!`;
  ui.big(title, r.x + r.w / 2, r.y + 10, C.bone, { align: 'center', scale: 2, outline: C.ink });
  drawRich(ui, WORLDS[tr.to].rule, r.x + r.w / 2, r.y + 10 + 2 * BIG_H + 6, Math.min(r.w - 20, 360), C.bone, { align: 'center', shadow: C.ink });
  if (t >= TRAVEL_S - 0.4) {
    if (!tr.shook) { tr.shook = true; app.renderer.fx.kick(5); app.hud.confetti = 70; app.audio.sfx('fanfare', 0.7); }
    const lt = t - (TRAVEL_S - 0.4);
    const sc = lt < 0.25 ? 3 - lt * 8 : 1;
    rays(app, r.x + r.w / 2, r.y + r.h * 0.72, Math.min(r.w, 180), C.lamp2, 14);
    stamp(ui, `+${tr.legacy} LEGACY`, r.x + r.w / 2, r.y + Math.round(r.h * 0.72), { scale: Math.max(1, sc) * (k >= 2 ? 1.5 : 1), angle: -0.08, col: C.gold });
  }
  ui.unclip();
  if (button(ui, 'travelSkip', r.x + r.w - 52, r.y + r.h - 20, 46, 15, t >= TRAVEL_S ? 'Onward' : 'Skip', { tip: '{u:legacy} the Legacy tree' })) done();
}

/** An island seen from the sky: the sky islet's rock under the island's own ground and exotic. */
function islet(app: App, w: WorldId, x: number, y: number, k: number) {
  const ui = app.ui;
  const ctx = ui.ctx;
  if (hasArt('sky_islet')) ctx.drawImage(sheet('sky_islet').frames[w === 'home' ? 0 : 1], x, y, 64 * k, 48 * k);
  // its own ground across the top, the exotic in the middle
  const gname = w !== 'home' && hasArt(`isle_${w}_tile_grass`) ? `isle_${w}_tile_grass` : null;
  if (gname) {
    const s = sheet(gname);
    for (let i = 0; i < 4; i++) ctx.drawImage(s.frames[i % s.frames.length], x + (8 + i * 12) * k, y + 14 * k, 12 * k, 5 * k);
  }
  const ex = WORLDS[w].exotic;
  if (ex) ctx.drawImage(itemIcon(ex), x + 28 * k, y + 6 * k, 8 * k, 8 * k);
}

/** The town on its rotor raft: three houses on a plank deck, a rotor spinning under it. */
function raft(app: App, cx: number, cy: number, k: number, t: number) {
  const ui = app.ui;
  const ctx = ui.ctx;
  const W = 52 * k;
  const x = Math.round(cx - W / 2), y = Math.round(cy);
  if (hasArt('dist_rotor')) {
    const rs = sheet('dist_rotor');
    ctx.drawImage(rs.frames[Math.floor(t * 16) % rs.frames.length], Math.round(cx - 24 * k), y + 5 * k, 48 * k, 24 * k);
  }
  ui.fill(x, y + 3 * k, W, 3 * k, T.ink);
  ui.fill(x + k, y + 3 * k, W - 2 * k, 2 * k, C.wood0 ?? T.wood);
  if (hasArt('town_house')) {
    const hs = sheet('town_house');
    const bob = Math.round(Math.sin(t * 5) * k * 0.5);
    for (const [i, f] of [[0, 0], [1, 5], [2, 1]] as [number, number][]) ctx.drawImage(hs.frames[f], x + (2 + i * 16) * k, y - 13 * k + bob, 16 * k, 16 * k);
  }
}

registerScreen('relocate', relocateCard);

// ------------------------------------------------------------------ the slip under the Purse

/** Bramble's slip under the Purse once a Relocate is possible or close: "+N {u:legacy}" when the
 * town may fly now, else what it waits on; a click opens the card. */
registerCounter({
  id: 'relocate',
  show: (app) => relocateClose(app),
  draw: (app, x, y) => {
    const ui = app.ui;
    const now = relocateNow(app);
    const s = now ? `{u:relocate} {coinc:+${now.p.now}} {u:legacy}` : '{u:relocate} {soft:Relocate soon}';
    const w = 24 + 6 + richWidth(s) + 14;
    const hov = ui.hover(x, y, w, 26);
    ui.mark('relocateBar', x, y, w, 26);
    const r = slip(ui, x, y, w, 26, { blocking: true });
    ui.region(x, y, w, 26, 'button');
    speakPortrait(app, r.x - 2, y + 1);
    ui.rich(s, r.x + 26, y + 9, Infinity, T.ink);
    if (app.panel === 'relocate' || hov) { ui.ctx.fillStyle = T.coin; ui.ctx.fillRect(r.x + 26, y + 20, w - 38, 1); }
    if (hov) {
      ui.hoverId = 'relocateBar';
      const why = now ? null : relocateRefusal(app.game, targetOf(app));
      ui.tip([
        { text: '{big:Relocate}' },
        { text: 'Pack the lily pads! A new island, a new rule.' },
        { text: now ? `{coin:+${now.p.now} Legacy} to ${isleName(now.to)}` : `{soft:${why ?? 'not yet'}}` },
        { text: '{k:LMB} read the card' },
      ], 210);
      if (ui.clicked) {
        ui.eat();
        ui.sfx('click');
        app.togglePanel('relocate');
      }
    }
    return w;
  },
});

/** Bramble's 24 px portrait on the slip. */
function speakPortrait(app: App, x: number, y: number) {
  if (hasArt('portrait_bramble_small')) app.ui.ctx.drawImage(sheet('portrait_bramble_small').frames[0], x, y);
  else app.ui.fill(x, y, 24, 24, T.paperLo);
}
