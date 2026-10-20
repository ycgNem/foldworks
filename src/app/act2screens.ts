// Act II's screens (DESIGN.md §18): Unit 7's Codex (every item with its story; a first delivery
// pays 100x its value once Unit 7 likes you), the Survey Office (deposit claims by ore, what holds
// them, and blocks of 4 to buy) and the Megaproject (the Great Drill's Bay drawn large, what its
// stage still wants, and a celebration when a stage is done). Reads the Game; acts through App.act.
import { C } from '../data/palette';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { CHUNKS, FACTORY, PATCHES, WORKSHOP } from '../data/land';
import { RULES } from '../data/rules';
import { MEGA, megaStage } from '../data/megaprojects';
import { RECIPE } from '../data/recipes';
import { RESEARCH } from '../data/research';
import { ICON, textWidth, wrapText, ellipsize } from '../ui/font';
import { itemIcon, sheet, hasArt } from '../render/sprites';
import { bayFrame, megaFrac, mainOutput } from '../render/factory';
import { claimsHeld, claimsUsed, claimPrice, copiesOf, oresOf } from '../sim/systems/claims';
import { Num } from '../engine/num';
import { frame, card, button, bar } from './chrome';
import { screenHeader, icon, fmt, perMin, slamScale, rays, cells } from './widgets';
import { customerPortrait } from './orders';
import { confetti } from './fold';
import type { App } from './app';
import type { Rect } from '../ui/ui';

// ------------------------------------------------------------------ the Codex

/** Items the Codex can log: the ones the Dock pays for (slag, kits and drill bits never sell). */
export const CODEX_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].value > 0);

export function codexScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const logged = g.s.codex;
  const open = g.s.orders.rep.unit7 >= 1;
  screenHeader(app, r, `The Codex: ${logged.length} of ${CODEX_ITEMS.length}`, C.teal1, 'codex');
  const mult = RULES.codexMult.value;
  const paid = logged.reduce((s, id) => s + ITEMS[id].value * mult, 0);
  const left = CODEX_ITEMS.filter((id) => !logged.includes(id)).reduce((s, id) => s + ITEMS[id].value * mult, 0);
  // ---- the summary strip: Unit 7, coin paid and still to find, the progress bar
  const y0 = r.y + 22;
  frame(ui, r.x + 8, y0, r.w - 16, 30, 'inset');
  customerPortrait(app, 'unit7', r.x + 12, y0 + 3, 24, open && logged.length > 0 && Math.floor(ui.time / 3) % 4 === 0);
  const sx = r.x + 42;
  if (open) {
    ui.text('Paid so far', sx, y0 + 4, C.hull2);
    ui.text(`${ICON.coin} ${Num.of(paid).format()}`, sx + textWidth('Paid so far') + 5, y0 + 4, C.gold, { shadow: C.ink });
    const s2 = `Still to find: ${ICON.coin} ${Num.of(left).format()}`;
    ui.text(s2, r.x + r.w - 14, y0 + 4, C.bone, { align: 'right' });
  } else ui.text('UNIT 7 OPENS THE CODEX AT REPUTATION 1: FILL ONE OF ITS ORDERS.', sx, y0 + 4, C.teal1);
  const f = logged.length / CODEX_ITEMS.length;
  bar(ui, sx, y0 + 16, r.w - 16 - (sx - r.x) - 36, 8, f, C.teal1);
  ui.text(`${Math.round(f * 100)}%`, r.x + r.w - 14, y0 + 16, C.teal1, { align: 'right' });
  // ---- the cards
  const gy = y0 + 34, gw = r.w - 16, gh = r.y + r.h - 6 - gy;
  const n = ITEM_IDS.length;
  let cols = Math.max(2, Math.floor((gw + 4) / 118));
  let rows = Math.ceil(n / cols);
  while (rows > 1 && Math.floor((gh + 3) / rows) - 3 < 34 && cols < 8) { cols++; rows = Math.ceil(n / cols); }
  const cw = Math.floor((gw + 4) / cols) - 4;
  const ch = Math.min(64, Math.floor((gh + 3) / rows) - 3);
  const newest = logged[logged.length - 1];
  ITEM_IDS.forEach((id, i) => {
    const x = r.x + 8 + (i % cols) * (cw + 4), y = gy + Math.floor(i / cols) * (ch + 3);
    codexCard(app, id, x, y, cw, ch, id === newest);
  });
  // the last row's spare cells: Unit 7's notes on what is worth chasing
  const spare = cols - (n % cols || cols);
  if (spare >= 2) {
    const x = r.x + 8 + (n % cols) * (cw + 4), y = gy + (rows - 1) * (ch + 3);
    const w = spare * (cw + 4) - 4;
    const inner = card(ui, x, y, w, ch, 'Unit 7 notes', C.teal1, 'codex');
    const chase = CODEX_ITEMS.filter((id) => !logged.includes(id)).sort((p, q) => ITEMS[q].value - ITEMS[p].value);
    let yy = inner.y;
    if (!chase.length) ui.para('THE COLLECTION IS COMPLETE. UNIT 7 IS... MOVED.', inner.x, yy, inner.w, C.gold);
    else if (!open) ui.para('FILL ONE ORDER FOR UNIT 7 AND EVERY FIRST DELIVERY PAYS 100X.', inner.x, yy, inner.w, C.teal1);
    else {
      ui.text('Worth chasing:', inner.x, yy, C.hull2);
      let xx = inner.x + textWidth('Worth chasing:') + 6;
      for (const id of chase) {
        const s2 = Num.of(ITEMS[id].value * mult).format();
        if (xx + 12 + textWidth(s2) > inner.x + inner.w) {
          yy += 11;
          xx = inner.x;
          if (yy + 9 > inner.y + inner.h) break;
        }
        ui.ctx.drawImage(itemIcon(id), xx, yy);
        xx += 14 + ui.text(s2, xx + 10, yy, C.gold);
      }
    }
  }
}

function codexCard(app: App, id: ItemId, x: number, y: number, w: number, h: number, isNew: boolean) {
  const ui = app.ui;
  const g = app.game;
  const it = ITEMS[id];
  const logged = g.s.codex.includes(id);
  const payable = it.value > 0;
  const pays = it.value * RULES.codexMult.value;
  frame(ui, x, y, w, h, logged ? 'paper' : 'inset');
  const ctx = ui.ctx;
  ui.fill(x + 3, y + 3, 20, 20, logged ? C.brass0 : C.ink);
  ctx.globalAlpha = logged ? 1 : payable ? 0.45 : 0.25;
  ctx.drawImage(itemIcon(id), x + 5, y + 5, 16, 16);
  ctx.globalAlpha = 1;
  const tx = x + 26, tw = x + w - 4 - tx;
  ui.clip(tx, y, tw, h);
  ui.text(it.name, tx, y + 4, logged ? C.ink : payable ? C.bone : C.hull2);
  const ps = Num.of(pays).format();
  if (logged) ui.text(`${ICON.check} +${ps}`, tx, y + 14, C.moss);
  else if (payable) ui.text(textWidth(`First pays ${ps}`) <= tw ? `First pays ${ps}` : `Pays ${ps}`, tx, y + 14, C.brass1);
  else ui.text('Not for sale', tx, y + 14, C.hull1);
  ui.unclip();
  if (isNew && logged) {
    ui.fill(x + w - 22, y + 2, 20, 9, C.ink);
    ui.fill(x + w - 21, y + 3, 18, 7, C.pipRed);
    ui.text('NEW', x + w - 20, y + 3, C.bone);
    const gl = (ui.time * 0.8) % 2;
    if (gl < 1) ui.fill(x + 3 + Math.floor(gl * (w - 8)), y + 3, 2, h - 6, C.bone, 0.3);
  }
  // the flavour text: as many whole lines as fit, the last one cut with an ellipsis
  const fy = y + 25;
  const nl = Math.floor((h - (fy - y) - 2) / 10);
  if (nl > 0) {
    const lines = wrapText(it.flavor, w - 8);
    lines.slice(0, nl).forEach((l, k) => {
      const cut = k === nl - 1 && lines.length > nl;
      ui.text(cut ? ellipsize(l + ' ...', w - 8) : l, x + 4, fy + k * 10, logged ? C.shadow : C.hull1);
    });
  }
  const got = g.s.delivered[id];
  ui.hint(x, y, w, h, [
    { text: it.name, color: logged ? C.gold : C.bone },
    { text: it.flavor },
    { text: payable ? `Worth ${fmt(it.value)} at the Dock. ${logged ? `Catalogued: Unit 7 paid ${Num.of(pays).format()}.` : `First Dock delivery pays ${Num.of(pays).format()} once Unit 7 likes you.`}` : 'The Dock refuses it, so the Codex never pays for it.', color: logged ? C.leaf : C.hull2 },
    { text: got ? `Delivered so far: ${got.format()}` : 'Never delivered.', color: C.hull2 },
  ], 180);
}

// ------------------------------------------------------------------ the Survey Office

const ORES: ItemId[] = ['ironOre', 'copperOre', 'coal', 'sand'];
const ORE_TILE: Partial<Record<ItemId, string>> = { ironOre: 'tile_ore_iron', copperOre: 'tile_ore_copper', coal: 'tile_ore_coal', sand: 'tile_ore_sand' };
const ORE_COL: Partial<Record<ItemId, string>> = { ironOre: C.iron1, copperOre: C.copper1, coal: C.hull0, sand: C.brass1 };

export function surveyScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  screenHeader(app, r, 'The Survey Office', C.leaf, 'survey');
  const y0 = r.y + 22;
  const mapW = r.w >= 480 ? 132 : 0;
  const rw = r.w - 16 - (mapW ? mapW + 6 : 0);
  // the rule, in one sentence
  const rule = `Ore never runs out. Each copy of a module with miners inside holds one claim on every ore it digs: you start with ${RULES.claimsBase.value} per ore, +${RULES.claimsPerDeposit.value} per deposit you own, and the Office sells ${RULES.claimsPerBlock.value} more at a time.`;
  const sh = wrapText(rule, rw - 12).length * 10 + 7;
  frame(ui, r.x + 8, y0, rw, sh, 'paper');
  ui.para(rule, r.x + 14, y0 + 4, rw - 12, C.ink);
  const bottom = r.y + r.h - 6;
  const ores = ORES.filter((o) => PATCHES.some((p) => p.item === o));
  const ry = y0 + sh + 4;
  const rh = Math.min(56, Math.floor((bottom - ry + 3) / ores.length) - 3);
  ores.forEach((ore, i) => oreRow(app, ore, r.x + 8, ry + i * (rh + 3), rw, rh));
  if (mapW) depositMap(app, r.x + r.w - 8 - mapW, y0, mapW, bottom - y0);
}

function oreRow(app: App, ore: ItemId, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  frame(ui, x, y, w, h);
  const ctx = ui.ctx;
  // the ore's deposit tile, large
  ui.fill(x + 5, y + 5, 36, 36, C.ink);
  const ts = ORE_TILE[ore];
  if (ts && hasArt(ts)) ctx.drawImage(sheet(ts).frames[0], x + 7, y + 7, 32, 32);
  else ui.fill(x + 7, y + 7, 32, 32, ORE_COL[ore] ?? C.hull1);
  ctx.drawImage(itemIcon(ore), x + 27, y + 27);
  const held = claimsHeld(g, ore), used = claimsUsed(g, ore);
  const deps = PATCHES.filter((p) => p.item === ore && g.owned(p.x, p.y)).length;
  const blocks = g.s.claimBlocks[ore] ?? 0;
  // the claims: name, used of held, a meter of every claim
  const cx = x + 47;
  const right = x + w - 6;
  const buyW = 92;
  const midR = right - buyW - 6;
  ui.text(ITEMS[ore].name, cx, y + 5, C.bone, { shadow: C.ink });
  const free = held - used;
  const tag = free > 0 ? `${free} free` : free === 0 ? 'all in use' : `${-free} over`;
  ui.text(`${used}/${held} claims`, midR, y + 5, free > 0 ? C.leaf : free === 0 ? C.pipYellow : C.pipRed, { align: 'right' });
  cells(app, cx, y + 15, midR - cx, 6, used, held, free >= 0 ? C.leaf : C.pipRed);
  ui.clip(cx, y + 23, midR - cx, 10);
  ui.text(`${RULES.claimsBase.value} start + ${deps} deposit${deps === 1 ? '' : 's'} x${RULES.claimsPerDeposit.value} + ${blocks} block${blocks === 1 ? '' : 's'} x${RULES.claimsPerBlock.value}  (${tag})`, cx, y + 24, C.hull2);
  ui.unclip();
  // the next block and Buy 4
  const price = claimPrice(g, ore);
  const bx = right - buyW;
  if (price) {
    ui.text('Next block', bx, y + 5, C.hull2);
    ui.text(price.format(), right, y + 5, g.s.coin.gte(price) ? C.gold : C.pipRed, { align: 'right' });
    const why = !g.done('surveying') ? 'Research Surveying first' : g.s.coin.lt(price) ? `Needs ${price.format()} coin` : null;
    if (button(ui, 'claim:' + ore, bx, y + 15, buyW, 14, `Buy ${RULES.claimsPerBlock.value} claims`, { gold: !why, disabled: !!why, tip: why ?? `${RULES.claimsPerBlock.value} more ${ITEMS[ore].name.toLowerCase()} claims for ${price.format()} coin. Each later block costs +50% of the first, linear (the stamp rule).` })) app.act({ k: 'claim', item: ore });
    if (why) {
      ui.clip(bx, y + 30, buyW, 10);
      ui.text(why, bx + buyW / 2, y + 31, C.hull1, { align: 'center' });
      ui.unclip();
    }
  }
  // which designs hold them
  const holders = g.s.designs.filter((d) => (oresOf(g, d)[ore] ?? 0) > 0 && copiesOf(g, d) > 0);
  const hy = y + h - 13;
  if (hy < y + 34) return;
  let hx = cx;
  ui.text('Held by', hx, hy + 1, C.hull2);
  hx += textWidth('Held by') + 5;
  if (!holders.length) ui.text('nothing yet: no module digs it', hx, hy + 1, C.hull1);
  for (const d of holders) {
    const label = `${d.name} x${copiesOf(g, d) * (oresOf(g, d)[ore] ?? 1)}`;
    const lw = 11 + textWidth(label) + 8;
    if (hx + lw > right) { ui.text('...', hx, hy + 1, C.hull2); break; }
    ctx.drawImage(sheet('module').frames[0], hx, hy, 9, 9);
    const out = mainOutput(g, d.id);
    if (out) ctx.drawImage(itemIcon(out), hx + 1, hy + 1, 7, 7);
    ui.text(label, hx + 11, hy + 1, C.bone);
    ui.hint(hx, hy, lw - 4, 10, `${d.name}: ${copiesOf(g, d)} cop${copiesOf(g, d) === 1 ? 'y' : 'ies'} (spare and placed) dig ${ITEMS[ore].name.toLowerCase()}`, 170);
    hx += lw;
  }
}

/** The Workshop's deposits on a little map: owned land lit, ore patches in their colours. */
function depositMap(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const inner = card(ui, x, y, w, h, 'Deposits', C.leaf, 'workshop');
  const k = Math.max(2, Math.floor(inner.w / WORKSHOP.w));
  const mw = WORKSHOP.w * k, mh = WORKSHOP.h * k;
  const mx = inner.x + Math.floor((inner.w - mw) / 2), my = inner.y + 1;
  ui.fill(mx - 1, my - 1, mw + 2, mh + 2, C.ink);
  for (const c of CHUNKS) {
    const own = g.s.land.includes(c.id);
    ui.fill(mx + c.x * k, my + c.y * k, c.w * k, c.h * k, own ? C.ground1 : C.shadow);
    ui.fill(mx + c.x * k, my + c.y * k, c.w * k, 1, C.ink);
    ui.fill(mx + c.x * k, my + c.y * k, 1, c.h * k, C.ink);
    if (!own) ui.text(c.id, mx + c.x * k + (c.w * k) / 2, my + c.y * k + (c.h * k) / 2 - 3, C.hull1, { align: 'center' });
  }
  for (const p of PATCHES) {
    const own = g.owned(p.x, p.y);
    const pulse = own && Math.floor(ui.time * 2 + p.x) % 4 === 0;
    ui.ctx.globalAlpha = own ? 1 : 0.45;
    ui.fill(mx + p.x * k, my + p.y * k, p.w * k, p.h * k, pulse ? C.bone : ORE_COL[p.item] ?? C.hull2);
    ui.ctx.globalAlpha = 1;
    ui.hint(mx + p.x * k, my + p.y * k, p.w * k, p.h * k, `${ITEMS[p.item].name} deposit${own ? `: yours, +${RULES.claimsPerDeposit.value} claims` : ': buy its land for +2 claims'}`, 150);
  }
  let ly = my + mh + 5;
  for (const ore of ORES) {
    if (ly + 9 > inner.y + inner.h) break;
    ui.fill(inner.x, ly + 1, 6, 6, ORE_COL[ore] ?? C.hull2);
    ui.text(ITEMS[ore].name, inner.x + 9, ly, C.bone);
    const own = PATCHES.filter((p) => p.item === ore && g.owned(p.x, p.y)).length;
    const all = PATCHES.filter((p) => p.item === ore).length;
    ui.text(`${own}/${all}`, inner.x + inner.w, ly, own ? C.leaf : C.hull1, { align: 'right' });
    ly += 10;
  }
  // the price list: blocks bought and the next block's price, by ore
  if (ly + 24 <= inner.y + inner.h) {
    ly += 4;
    ui.text('Claim blocks', inner.x, ly, C.leaf);
    ui.text('next', inner.x + inner.w, ly, C.hull2, { align: 'right' });
    ly += 10;
    for (const ore of ORES) {
      if (ly + 9 > inner.y + inner.h) break;
      const pr = claimPrice(g, ore);
      ui.ctx.drawImage(itemIcon(ore), inner.x, ly);
      ui.text(`${g.s.claimBlocks[ore] ?? 0} bought`, inner.x + 10, ly, C.bone);
      ui.text(pr ? pr.format() : '-', inner.x + inner.w, ly, pr && g.s.coin.gte(pr) ? C.gold : C.hull1, { align: 'right' });
      ly += 10;
    }
  }
  const forSale = CHUNKS.find((c) => !g.s.land.includes(c.id) && (!c.requires || g.done(c.requires)) && PATCHES.some((p) => p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h));
  if (forSale && ly + 20 <= inner.y + inner.h) {
    ly += 3;
    ui.para(`${forSale.name} is for sale: ${fmt(forSale.cost)} coin. Click it on the map.`, inner.x, ly, inner.w, C.gold);
  }
}

// ------------------------------------------------------------------ the Megaproject

let landedAt = -1;

export function megaScreen(app: App, r: Rect) {
  const ui = app.ui;
  const g = app.game;
  const stage = megaStage(g.s.mega.stage);
  const doneStage = MEGA.find((m) => m.stage === g.s.mega.stage) ?? null;
  screenHeader(app, r, stage ? stage.name : doneStage ? `${doneStage.name}: complete` : 'The Megaproject', C.gold, 'mega');
  const y0 = r.y + 22, bottom = r.y + r.h - 6;
  const t = ui.time - app.gradeAt;
  const celebrate = g.s.mega.stage >= 1 && t < 12 && t >= 0;
  // ---- the Bay, large, on the left
  const artH = bottom - y0;
  const k = Math.max(2, Math.min(6, Math.floor((Math.min(artH - 34, r.w * 0.42) - 8) / 32)));
  const aw = 32 * k + 16;
  frame(ui, r.x + 8, y0, aw, artH, 'inset');
  const ctx = ui.ctx;
  const ax = r.x + 16, ay = y0 + 8;
  // a night sky over the pad; rays once the drill runs
  ui.clip(r.x + 9, y0 + 1, aw - 2, artH - 2);
  ui.fill(r.x + 9, y0 + 1, aw - 2, 32 * k + 8, C.shadow);
  for (let i = 0; i < 24; i++) {
    const sx = r.x + 10 + ((i * 53) % (aw - 4)), sy = y0 + 3 + ((i * 29) % (16 * k));
    if (Math.sin(ui.time * 2 + i) > 0.3) ui.fill(sx, sy, 1, 1, i % 3 ? C.hull2 : C.hot);
  }
  if (g.s.mega.stage >= 1) rays(app, ax + 16 * k, ay + 16 * k, 32 * k, C.gold, 14);
  ui.unclip();
  const bay = sheet('mega_bay');
  ctx.drawImage(bay.frames[bayFrame(g, ui.time)], ax, ay, 32 * k, 32 * k);
  // the stage track under the art
  let ty = ay + 32 * k + 8;
  const sw = Math.floor((aw - 16 - 8) / 3);
  for (let s = 1; s <= 3; s++) {
    const sx = ax + (s - 1) * (sw + 4);
    const done = g.s.mega.stage >= s, cur = g.s.mega.stage + 1 === s && !!megaStage(g.s.mega.stage);
    ui.fill(sx, ty, sw, 14, C.ink);
    ui.fill(sx + 1, ty + 1, sw - 2, 12, done ? C.brass1 : cur ? C.ground1 : C.shadow);
    ui.text(done ? `${ICON.check} ${s}` : cur ? `Stage ${s}` : `${ICON.lock} ${s}`, sx + sw / 2, ty + 4, done ? C.ink : cur ? C.gold : C.hull1, { align: 'center' });
    ui.hint(sx, ty, sw, 14, s === 1 ? (MEGA[0]?.reward ?? '') : `Stage ${s} arrives with a later floor.`, 160);
  }
  ty += 18;
  if (ty + 9 < bottom) ui.para(g.s.mega.stage >= 1 ? 'The drill runs. Its progress survives every reset.' : 'Progress here survives every reset.', ax, ty, aw - 16, C.hull2);
  // ---- what the stage wants, on the right
  const px = r.x + 8 + aw + 6, pw = r.x + r.w - 8 - px;
  if (stage) wants(app, stage, px, y0, pw, bottom - y0);
  else complete(app, px, y0, pw, bottom - y0, celebrate, t);
}

function bayFeeds(app: App): Partial<Record<ItemId, number>> {
  const g = app.game;
  const out: Partial<Record<ItemId, number>> = {};
  for (const rt of g.routes) {
    if (rt.to?.kind !== 'fbay' || rt.by) continue;
    const it = mainOutput(g, rt.from.design);
    const last = rt.tiles[rt.tiles.length - 1];
    if (it && last) out[it] = (out[it] ?? 0) + last.flow;
  }
  return out;
}

function wants(app: App, stage: NonNullable<ReturnType<typeof megaStage>>, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const inner = card(ui, x, y, w, h, 'Wanted, by trunk into the Bay', C.gold, 'mega');
  const bay = g.s.factory.ents.find((e) => e.kind === 'fbay');
  const feeds = bayFeeds(app);
  let yy = inner.y + 2;
  const ents = Object.entries(stage.wants) as [ItemId, number][];
  const rowH = Math.min(34, Math.floor((inner.h - 84) / ents.length));
  for (const [it, want] of ents) {
    const have = Math.min(want, Math.floor(g.s.mega.progress[it]?.toNumber() ?? 0));
    const f = have / want;
    ui.fill(inner.x, yy, 20, 20, C.ink);
    ui.ctx.drawImage(itemIcon(it), inner.x + 2, yy + 2, 16, 16);
    ui.text(ITEMS[it].name, inner.x + 25, yy, C.bone);
    const rate = feeds[it];
    if (rate) ui.text(`+${perMin(rate)}/min`, inner.x + 25 + textWidth(ITEMS[it].name) + 6, yy, C.leaf);
    ui.text(`${fmt(have)} / ${fmt(want)}`, inner.x + inner.w, yy, f >= 1 ? C.leaf : C.gold, { align: 'right' });
    bar(ui, inner.x + 25, yy + 10, inner.w - 25 - 28, 8, f, f >= 1 ? C.leaf : C.gold);
    ui.text(`${Math.floor(f * 100)}%`, inner.x + inner.w, yy + 10, C.hull3, { align: 'right' });
    if (rate && f < 1) {
      const secs = (want - have) / rate;
      ui.hint(inner.x, yy, inner.w, rowH, `${perMin(rate)} a minute arriving: about ${secs >= 3600 ? `${(secs / 3600).toFixed(1)} h` : `${Math.ceil(secs / 60)} min`} to go.`, 170);
    }
    yy += rowH;
  }
  // the whole stage
  const tf = megaFrac(g);
  yy += 2;
  ui.text('Stage 1 in all', inner.x, yy, C.hull2);
  ui.text(`${Math.floor(tf * 100)}%`, inner.x + inner.w, yy, C.gold, { align: 'right' });
  bar(ui, inner.x, yy + 10, inner.w, 10, tf, C.hot);
  yy += 26;
  // the reward
  const rlines = wrapText(stage.reward + '.', inner.w - 12).length;
  const rh = 16 + rlines * 10;
  if (yy + rh <= inner.y + inner.h - 16) {
    frame(ui, inner.x, yy, inner.w, rh, 'paper');
    ui.text('Reward', inner.x + 6, yy + 4, C.brass0);
    ui.para(stage.reward + '.', inner.x + 6, yy + 13, inner.w - 12, C.ink);
    yy += rh + 5;
  }
  // how a Drill Bit is made, and what is flowing in right now
  const bit = RECIPE.forgeDrillBit;
  if (bit && yy + 10 <= inner.y + inner.h - 18) {
    ui.text('Drill Bit:', inner.x, yy, C.hull2);
    let xx = inner.x + textWidth('Drill Bit:') + 5;
    for (const inp of bit.inputs) {
      const s2 = `${inp.n}`;
      ui.ctx.drawImage(itemIcon(inp.item), xx, yy);
      xx += 13 + ui.text(s2, xx + 10, yy, C.bone);
    }
    ui.text(`in an Assembler, ${bit.time} s`, xx + 2, yy, C.hull2);
    yy += 11;
  }
  const flowing = Object.entries(feeds) as [ItemId, number][];
  if (yy + 10 <= inner.y + inner.h - 18) {
    ui.text(flowing.length ? 'Arriving:' : 'Nothing is trunked into the Bay yet.', inner.x, yy, flowing.length ? C.hull2 : C.pipYellow);
    let xx = inner.x + textWidth('Arriving:') + 5;
    for (const [it, r2] of flowing) {
      const s2 = `${perMin(r2)}/min`;
      ui.ctx.drawImage(itemIcon(it), xx, yy);
      xx += 14 + ui.text(s2, xx + 10, yy, C.leaf);
    }
  }
  // where it is, or why it isn't there yet
  const by = inner.y + inner.h - 14;
  if (bay) {
    if (button(ui, 'gotoBay', inner.x, by, inner.w, 14, 'Go to the Bay', { tip: 'The Factory floor, bottom-left corner. Lay trunks into it from your modules.' })) {
      app.panel = null;
      app.setFloor('factory', true);
      app.lookAt(bay.x + 1, bay.y + 1);
    }
  } else if (g.done('greatDrill')) {
    ui.para(`Clear the Factory floor's corner (tiles ${FACTORY.bay.x}-${FACTORY.bay.x + 1}, ${FACTORY.bay.y}-${FACTORY.bay.y + 1}): the Bay lands there.`, inner.x, by - 8, inner.w, C.pipRed);
  } else ui.para(`Research ${RESEARCH.greatDrill.name} to bring the Bay.`, inner.x, by, inner.w, C.hull2);
}

function complete(app: App, x: number, y: number, w: number, h: number, celebrate: boolean, t: number) {
  const ui = app.ui;
  const g = app.game;
  const st = MEGA.find((m) => m.stage === g.s.mega.stage);
  const inner = card(ui, x, y, w, h, 'Stage complete', C.gold, 'star');
  const cx = inner.x + Math.floor(inner.w / 2);
  // the stamp slams down (2x at rest), then confetti
  const base = inner.w >= 200 ? 2 : 1;
  const sc = celebrate ? slamScale(t, base) : base;
  if (celebrate && t >= 0.28 && landedAt !== app.gradeAt) {
    landedAt = app.gradeAt;
    app.audio.sfx('gradeS');
    app.renderer.fx.kick(6);
    app.hud.confetti = 90;
  }
  const label = `STAGE ${g.s.mega.stage} DONE`;
  const tw = textWidth(label) * sc + 12 * sc;
  const th = 7 * sc + 10 * sc;
  const sy = inner.y + 8 + (celebrate && t < 0.28 ? 0 : 0);
  if (celebrate || g.s.mega.stage >= 1) {
    ui.clip(inner.x - 2, inner.y - 2, inner.w + 4, inner.h + 4);
    rays(app, cx, sy + th / 2, Math.min(inner.w, 160), celebrate ? C.hot : C.brass1, 16);
    ui.unclip();
  }
  ui.fill(cx - tw / 2, sy, tw, th, C.pipRed);
  ui.fill(cx - tw / 2 + sc, sy + sc, tw - 2 * sc, th - 2 * sc, C.bone);
  ui.fill(cx - tw / 2 + 2 * sc, sy + 2 * sc, tw - 4 * sc, th - 4 * sc, C.pipRed);
  ui.text(label, cx, sy + 5 * sc, C.bone, { align: 'center', scale: sc });
  confetti(app, cx, sy + th / 2);
  let yy = sy + 7 * 2 + 10 * 2 + 10;
  if (st) {
    ui.text(st.name, cx, yy, C.gold, { align: 'center', shadow: C.ink });
    yy += 12;
    yy += ui.para(st.reward + '.', inner.x + 6, yy, inner.w - 12, C.bone) + 6;
  }
  const miners = g.miners.length;
  const src = g.s.factory.ents.filter((e) => e.kind === 'module' && Object.keys(oresOf(g, g.design(e.design)!)).length).length;
  const rows: [string, string][] = [
    ['Miners running +50%', fmt(miners)],
    ['Source modules running +50%', fmt(src)],
    ['Coin earned this run', g.s.earned.format()],
  ];
  for (const [k2, v] of rows) {
    if (yy + 10 > inner.y + inner.h - 18) break;
    ui.text(k2, inner.x + 6, yy, C.hull2);
    ui.text(v, inner.x + inner.w - 6, yy, C.gold, { align: 'right' });
    yy += 11;
  }
  if (yy + 20 <= inner.y + inner.h - 16) ui.para('Stages 2 and 3 arrive with later floors.', inner.x + 6, yy + 2, inner.w - 12, C.teal1);
  if (button(ui, 'megaOk', inner.x + Math.floor(inner.w / 2) - 55, inner.y + inner.h - 15, 110, 14, 'Magnificent', { gold: true, pulse: celebrate })) app.panel = null;
}
