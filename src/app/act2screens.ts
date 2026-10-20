// Act II's screens (DESIGN.md §18): Unit 7's Codex (every item with its story; a first delivery
// pays 30x its value once Unit 7 likes you), the Survey Office (deposit claims by ore, what holds
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
import { megaOpen } from '../sim/systems/modules';
import { Num } from '../engine/num';
import { frame, card, button, bar, section, label } from './chrome';
import { screenHeader, icon, fmt, perMin, slamScale, rays, cells } from './widgets';
import { customerPortrait, openOrders } from './orders';
import { ORDERS, CUSTOMERS } from '../data/orders';
import { offeredOrders, orderFrac } from '../sim/systems/orders';
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
  section(ui, x, y, w, h);
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
  // the art director's 48x48 stage art (mega_stage1) at a whole scale, else the 32x32 Bay frame;
  // room is kept under it for the stage track and the Factory floor map
  const big = hasArt('mega_stage1');
  const S0 = big ? 48 : 32;
  const k = Math.max(big ? 1 : 2, Math.min(6, Math.floor((Math.min(artH - 34 - (big ? 50 : 0), r.w * 0.42) - 8) / S0)));
  const P = S0 * k;
  const aw = P + 16;
  frame(ui, r.x + 8, y0, aw, artH, 'inset');
  const ctx = ui.ctx;
  const ax = r.x + 16, ay = y0 + 8;
  // a night sky over the pad; rays once the drill runs
  ui.clip(r.x + 9, y0 + 1, aw - 2, artH - 2);
  ui.fill(r.x + 9, y0 + 1, aw - 2, P + 8, C.shadow);
  for (let i = 0; i < 24; i++) {
    const sx = r.x + 10 + ((i * 53) % (aw - 4)), sy = y0 + 3 + ((i * 29) % Math.max(1, P / 2));
    if (Math.sin(ui.time * 2 + i) > 0.3) ui.fill(sx, sy, 1, 1, i % 3 ? C.hull2 : C.hot);
  }
  if (g.s.mega.stage >= 1) rays(app, ax + P / 2, ay + P / 2, P, C.gold, 14);
  ui.unclip();
  if (big) {
    const st = sheet('mega_stage1');
    const flip = Math.floor(ui.time * (st.fps || 4)) % 2;
    const fi = g.s.mega.stage >= 1 ? 8 + flip : 2 * Math.min(3, Math.floor(megaFrac(g) * 4)) + flip;
    ctx.drawImage(st.frames[fi], ax, ay, P, P);
  } else {
    const bay = sheet('mega_bay');
    ctx.drawImage(bay.frames[bayFrame(g, ui.time)], ax, ay, P, P);
  }
  let ty = ay + P + 8;
  const sw = Math.floor((aw - 16 - 8) / 3);
  for (let s = 1; s <= 3; s++) {
    const sx = ax + (s - 1) * (sw + 4);
    const done = g.s.mega.stage >= s, cur = g.s.mega.stage + 1 === s && !!megaStage(g.s.mega.stage);
    ui.fill(sx, ty, sw, 14, C.ink);
    ui.fill(sx + 1, ty + 1, sw - 2, 12, done ? C.brass1 : cur ? C.ground1 : C.shadow);
    const shut = cur && !megaOpen(g, megaStage(g.s.mega.stage));
    const curLabel = textWidth(`${ICON.lock} Stage ${s}`) + 4 <= sw ? `${ICON.lock} Stage ${s}` : `${ICON.lock} ${s}`;
    ui.text(done ? `${ICON.check} ${s}` : cur ? (shut ? curLabel : `Stage ${s}`) : `${ICON.lock} ${s}`, sx + sw / 2, ty + 4, done ? C.ink : cur ? (shut ? C.violet : C.gold) : C.hull1, { align: 'center' });
    ui.hint(sx, ty, sw, 14, MEGA[s - 1]?.reward ?? '', 160); // Milestone 5: stages 2 and 3
  }
  ty += 18;
  if (ty + 9 < bottom) ty += ui.para(g.s.mega.stage >= 1 ? 'The drill runs. Its progress survives every reset.' : 'Progress here survives every reset.', ax, ty, aw - 16, C.hull2) + 6;
  // the Factory floor in miniature, the Bay lit in its corner
  if (bottom - 6 - ty >= 12 + FACTORY.h * 3) bayMap(app, ax, ty, aw - 16, bottom - 6 - ty);
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
  // the Milestone 5-6 final round: a stage behind the Committee's reputation is the Committee's
  // to open, so the panel's call to action is their orders, not the trunks
  if (stage.rep && !megaOpen(g, stage)) {
    lockedStage(app, stage, card(ui, x, y, w, h, `Stage ${stage.stage} opens with the Committee`, C.violet, 'orders'));
    return;
  }
  const inner = card(ui, x, y, w, h, 'Wanted, by trunk into the Bay', C.gold, 'mega');
  const bay = g.s.factory.ents.find((e) => e.kind === 'fbay');
  const feeds = bayFeeds(app);
  const end = inner.y + inner.h - 17;
  let yy = inner.y + 2;
  const ents = Object.entries(stage.wants) as [ItemId, number][];
  const rowH = Math.max(24, Math.min(30, Math.floor((inner.h - 150) / ents.length)));
  let slowest = 0;
  for (const [it, want] of ents) {
    const have = Math.min(want, Math.floor(g.s.mega.progress[it]?.toNumber() ?? 0));
    const f = have / want;
    ui.fill(inner.x, yy, 20, 20, C.ink);
    ui.fill(inner.x + 1, yy + 1, 18, 18, f >= 1 ? C.moss : C.shadow);
    ui.ctx.drawImage(itemIcon(it), inner.x + 2, yy + 2, 16, 16);
    ui.text(ITEMS[it].name, inner.x + 25, yy, f >= 1 ? C.leaf : C.bone);
    const rate = feeds[it];
    if (rate) ui.text(`+${perMin(rate)}/min`, inner.x + 25 + textWidth(ITEMS[it].name) + 6, yy, C.leaf);
    else if (f < 1) ui.text('not arriving', inner.x + 25 + textWidth(ITEMS[it].name) + 6, yy, C.pipYellow);
    ui.text(`${fmt(have)} / ${fmt(want)}`, inner.x + inner.w, yy, f >= 1 ? C.leaf : C.gold, { align: 'right' });
    bar(ui, inner.x + 25, yy + 10, inner.w - 25 - 28, 8, f, f >= 1 ? C.leaf : C.gold);
    ui.text(f >= 1 ? ICON.check : `${Math.floor(f * 100)}%`, inner.x + inner.w, yy + 10, f >= 1 ? C.leaf : C.hull3, { align: 'right' });
    if (f < 1) slowest = Math.max(slowest, rate ? (want - have) / rate : Infinity);
    ui.hint(inner.x, yy, inner.w, rowH, rate && f < 1 ? `${perMin(rate)} a minute arriving: about ${eta((want - have) / rate)} to go.` : f >= 1 ? 'Enough of this one.' : `Nothing brings ${ITEMS[it].name.toLowerCase()} to the Bay yet: trunk a module making it into the Bay.`, 170);
    yy += rowH;
  }
  // the whole stage: a big meter with quarter ticks
  const tf = megaFrac(g);
  ui.text(`Stage ${stage.stage} in all`, inner.x, yy + 4, C.hull2);
  ui.text(`${Math.floor(tf * 100)}%`, inner.x + inner.w, yy, C.gold, { align: 'right', scale: 2, shadow: C.brass0 });
  yy += 19;
  bar(ui, inner.x, yy, inner.w, 12, tf, C.hot);
  for (const q of [0.25, 0.5, 0.75]) ui.fill(inner.x + Math.round(inner.w * q), yy + 1, 1, 10, tf >= q ? C.gold : C.hull0);
  // a glint running along the filled part
  const gl = (ui.time * 0.7) % 1.5;
  if (gl < 1 && tf > 0.02) ui.fill(inner.x + 1 + Math.floor(gl * Math.max(1, inner.w * tf - 3)), yy + 1, 2, 10, C.bone, 0.5);
  yy += 15;
  if (yy + 10 <= end) {
    ui.text(slowest === 0 ? 'Everything is in: the drill is about to wake.' : isFinite(slowest) ? `At these rates, done in about ${eta(slowest)}.` : 'Not everything is arriving: trunk the missing items in.', inner.x, yy, isFinite(slowest) ? C.leaf : C.pipYellow);
    yy += 12;
  }
  // the reward: what it pays, with what you have that it would boost
  const miners = g.miners.length;
  const srcMods = g.s.factory.ents.filter((e) => e.kind === 'module' && Object.keys(oresOf(g, g.design(e.design)!)).length).length;
  const rh = 36;
  if (stage.stage > 1 && yy + 10 <= end) yy += ui.para(`Reward: ${stage.reward}`, inner.x, yy, inner.w, C.gold) + 4; // Milestone 5
  if (stage.stage === 1 && yy + rh <= end) {
    frame(ui, inner.x, yy, inner.w, rh, 'paper');
    ui.text('Reward: +50% to miners', inner.x + 6, yy + 4, C.brass0);
    ui.text('and modules with miners inside', inner.x + 6, yy + 13, C.brass0);
    const minerS = sheet('miner'), modS = sheet('module');
    const half = Math.floor(inner.w / 2);
    const rx = inner.x + 6, ry = yy + 23;
    ui.ctx.drawImage(minerS.frames[Math.floor(ui.time * 6) % minerS.frames.length], rx, ry - 2, 10, 10);
    ui.text(`${miners} Miner${miners === 1 ? '' : 's'}`, rx + 13, ry, C.ink);
    ui.ctx.drawImage(modS.frames[0], rx + half - 6, ry - 2, 10, 10);
    ui.clip(rx + half + 7, yy, inner.w - half - 14, rh);
    ui.text(`${srcMods} source module${srcMods === 1 ? '' : 's'}`, rx + half + 7, ry, C.ink);
    ui.unclip();
    // a big +50% stamp on the right while there is room
    const st = '+50%';
    if (inner.w >= 230) {
      const sx = inner.x + inner.w - textWidth(st) * 2 - 12;
      ui.text(st, sx, yy + 5, Math.floor(ui.time * 2) % 2 ? C.copper1 : C.pipRed, { scale: 2 });
    }
    ui.hint(inner.x, yy, inner.w, rh, `${stage.reward}. Right now that is ${miners} Miner${miners === 1 ? '' : 's'} on the Workshop and ${srcMods} module${srcMods === 1 ? '' : 's'} on the Factory floor with miners folded inside.`, 190);
    yy += rh + 4;
  }
  // how a Drill Bit is made, and what is flowing in right now
  const bit = RECIPE.forgeDrillBit;
  if (bit && yy + 10 <= end) {
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
  // the Milestone 5-6 review round: the drill-bit modules' rate and what holds them back
  const bitMods = g.s.factory.ents.filter((e) => e.kind === 'module' && mainOutput(g, e.design) === 'drillBit');
  if (bitMods.length && yy + 10 <= end) {
    const rate = bitMods.reduce((t, e) => t + (g.design(e.design)?.outs.drillBit ?? 0) * e.fAvg, 0);
    const slow = bitMods.find((e) => e.state !== 'work' && e.why);
    const lim = slow ? `${slow.state === 'blocked' ? 'blocked by' : 'short of'} ${ITEMS[slow.why as ItemId]?.name.toLowerCase() ?? slow.why}` : 'running flat out';
    ui.text(`Drill bits: ${perMin(rate)}/min, ${lim}`, inner.x, yy, slow ? C.pipYellow : C.leaf);
    ui.hint(inner.x, yy, inner.w, 10, `${bitMods.length} drill-bit module${bitMods.length === 1 ? '' : 's'} on the floor, at their recent run fraction. ${slow ? `The slowest is ${lim}: feed it more of that.` : 'Nothing holds them back.'}`, 180);
    yy += 11;
  }
  const flowing = Object.entries(feeds) as [ItemId, number][];
  if (yy + 10 <= end) {
    ui.text(flowing.length ? 'Arriving:' : 'Nothing is trunked into the Bay yet.', inner.x, yy, flowing.length ? C.hull2 : C.pipYellow);
    let xx = inner.x + textWidth('Arriving:') + 5;
    for (const [it, r2] of flowing) {
      const s2 = `${perMin(r2)}/min`;
      ui.ctx.drawImage(itemIcon(it), xx, yy);
      xx += 14 + ui.text(s2, xx + 10, yy, C.leaf);
    }
  }
  yy += 14;
  // the modules feeding it, each with its product and rate
  const feeders = g.routes.filter((rt) => rt.to?.kind === 'fbay' && !rt.by);
  if (feeders.length && yy + 22 <= end) {
    ui.text('Feeding the Bay', inner.x, yy, C.gold);
    yy += 11;
    for (const rt of feeders) {
      if (yy + 11 > end) break;
      const d = g.design(rt.from.design);
      const it = mainOutput(g, rt.from.design);
      const last = rt.tiles[rt.tiles.length - 1];
      ui.ctx.drawImage(sheet('module').frames[0], inner.x, yy - 3, 12, 12);
      if (it) ui.ctx.drawImage(itemIcon(it), inner.x + 15, yy);
      ui.clip(inner.x + 26, yy, inner.w - 90, 10);
      ui.text(d?.name ?? 'module', inner.x + 26, yy, C.bone);
      ui.unclip();
      const st = rt.from.state;
      ui.text(last ? `${perMin(last.flow)}/min` : '-', inner.x + inner.w, yy, st === 'work' ? C.leaf : C.pipYellow, { align: 'right' });
      yy += 12;
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

/** A stage shut behind the Committee's reputation (the Milestone 5-6 review round's gate, shown
 * as what to do about it in the final round): the Committee, its reputation now and needed, the
 * orders it has on offer with their progress, and a key to its tab on the Orders screen; what the
 * stage will want once open, quietly, under it. The Bay counts nothing meanwhile, so there is no
 * "not arriving" or ETA to show. */
function lockedStage(app: App, stage: NonNullable<ReturnType<typeof megaStage>>, inner: Rect) {
  const ui = app.ui;
  const g = app.game;
  const need = stage.rep ?? 0;
  const rep = g.s.orders.rep.committee ?? 0;
  const end = inner.y + inner.h - 19;
  let yy = inner.y + 2;
  // the Committee and its reputation: a pip for each level the stage needs
  customerPortrait(app, 'committee', inner.x + 2, yy + 2, 24);
  const nx = inner.x + 34;
  ui.text(CUSTOMERS.committee.name, nx, yy + 2, C.violet, { shadow: C.ink });
  ui.text(`Reputation ${rep} of ${need}`, nx, yy + 14, C.bone);
  const px0 = nx + textWidth(`Reputation ${rep} of ${need}`) + 6;
  for (let i = 0; i < need; i++) {
    ui.fill(px0 + i * 10, yy + 14, 8, 7, C.ink);
    ui.fill(px0 + i * 10 + 1, yy + 15, 6, 5, i < rep ? C.violet : C.shadow);
  }
  yy += 32;
  const more = Math.max(0, need - rep);
  yy += ui.para(`Fill ${more === 1 ? "one more of their orders" : `${more} more of their orders`} to open stage ${stage.stage}: each is +1 reputation, kept through every reset. Until then the Bay counts nothing for it: steel goes on to the Dock and sells, drill bits are scrapped.`, inner.x, yy, inner.w, C.hull3) + 6;
  // their orders on offer, the one under way first
  const offered = offeredOrders(g).filter((o) => o.customer === 'committee').sort((a, b) => (b.id === g.s.orders.active ? 1 : 0) - (a.id === g.s.orders.active ? 1 : 0));
  if (yy + 10 <= end) { label(ui, offered.length ? 'their orders on offer' : 'no orders on offer yet', inner.x, yy, C.violet); yy += 10; }
  if (!offered.length && yy + 10 <= end) {
    const next = ORDERS.find((o) => o.customer === 'committee' && !g.s.orders.done.includes(o.id));
    if (next) yy += ui.para(`Next: ${next.name}, after ${next.requires.filter((r) => !g.done(r)).map((r) => RESEARCH[r].name).join(' and ') || 'the Committee turns up'}.`, inner.x, yy, inner.w, C.hull2) + 2;
  }
  for (const o of offered) {
    if (yy + 22 > end) break;
    const active = o.id === g.s.orders.active;
    const f = orderFrac(g, o.id);
    ui.fill(inner.x, yy, inner.w, 21, C.ink, 0.5);
    ui.text(o.name, inner.x + 3, yy + 2, active ? C.gold : C.bone);
    const tag = active ? 'under way' : `+${o.rep} rep, ${fmt(o.pays)} coin`;
    ui.text(tag, inner.x + inner.w - 3, yy + 2, active ? C.leaf : C.hull2, { align: 'right' });
    let ix = inner.x + 3;
    for (const [it, n] of Object.entries(o.wants) as [ItemId, number][]) {
      const have = Math.min(n, Math.floor(g.s.orders.progress[o.id]?.[it]?.toNumber() ?? 0));
      ui.ctx.drawImage(itemIcon(it), ix, yy + 11);
      ix += 11 + ui.small(`${fmt(have)}/${fmt(n)}`, ix + 10, yy + 13, C.hull3) + 6;
    }
    bar(ui, Math.max(ix, inner.x + inner.w - 60), yy + 12, Math.min(57, inner.x + inner.w - 3 - ix), 6, f, active ? C.gold : C.violet);
    ui.hint(inner.x, yy, inner.w, 21, `${o.pitch}${active ? '' : ' Pick it on the Orders screen, then send it to any Dock.'}`, 190);
    yy += 24;
  }
  // what the stage wants once open, and what it pays
  if (yy + 22 <= end) {
    label(ui, `stage ${stage.stage}, once open`, inner.x, yy, C.hull2);
    yy += 10;
    let ix = inner.x;
    for (const [it, n] of Object.entries(stage.wants) as [ItemId, number][]) {
      ui.ctx.drawImage(itemIcon(it), ix, yy);
      ix += 12 + ui.text(`${fmt(n)} ${ITEMS[it].name.toLowerCase()}`, ix + 11, yy, C.hull3) + 8;
    }
    yy += 12;
  }
  // the reward whole or not at all (it must not run under the Committee's key)
  const reward = `Reward: ${stage.reward}`;
  if (yy + wrapText(reward, inner.w).length * 10 <= end) ui.para(reward, inner.x, yy, inner.w, C.gold);
  if (button(ui, 'megaCommittee', inner.x, inner.y + inner.h - 15, inner.w, 15, "The Committee's orders", { gold: true, icon: 'orders', tip: 'The Orders screen, on the Committee\'s tab' })) openOrders(app, 'committee');
}

function eta(secs: number): string {
  if (!isFinite(secs)) return 'forever';
  return secs >= 3600 ? `${(secs / 3600).toFixed(1)} h` : `${Math.max(1, Math.ceil(secs / 60))} min`;
}

/** The Factory floor in miniature with the Bay lit: where it stands, and the trunks into it. */
function bayMap(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  const t = Math.max(2, Math.min(8, Math.floor(Math.min((w - 4) / FACTORY.w, (h - 14) / FACTORY.h))));
  const mw = FACTORY.w * t, mh = FACTORY.h * t;
  const mx = x + Math.floor((w - mw) / 2), my = y + 12;
  ui.text('Where the Bay stands', x, y, C.hull2);
  ui.fill(mx - 2, my - 2, mw + 4, mh + 4, C.ink);
  ui.fill(mx - 1, my - 1, mw + 2, mh + 2, C.brass0);
  for (let ty = 0; ty < FACTORY.h; ty++) for (let tx = 0; tx < FACTORY.w; tx++) ui.fill(mx + tx * t, my + ty * t, t, t, (tx + ty) % 2 ? C.hull1 : C.hull0);
  const flowsIn = new Set<number>();
  for (const r of g.routes) if (r.to?.kind === 'fbay') for (const q of r.tiles) flowsIn.add(q.id);
  for (const e of g.s.factory.ents) {
    const ex = mx + e.x * t, ey = my + e.y * t;
    if (e.kind === 'trunk') {
      const lit = flowsIn.has(e.id);
      ui.fill(ex + Math.floor(t / 2) - 1, ey + Math.floor(t / 2) - 1, 2, 2, lit ? (Math.floor(ui.time * 4 + e.x) % 2 ? C.gold : C.hot) : C.shadow);
    } else if (e.kind === 'module') {
      ui.fill(ex, ey, t, t, C.ink);
      ui.fill(ex + 1, ey + 1, t - 2, t - 2, C.brass1);
    } else if (e.kind === 'fdock' || e.kind === 'fhopper') {
      ui.fill(ex, ey, e.w * t, e.h * t, C.ink);
      ui.fill(ex + 1, ey + 1, e.w * t - 2, e.h * t - 2, e.kind === 'fdock' ? C.leaf : C.teal0);
    }
  }
  // the Bay: lit gold and breathing, or hazard corners where it will land
  const b = FACTORY.bay;
  const bx = mx + b.x * t, by = my + b.y * t;
  const on = Math.floor(ui.time * 3) % 2 === 0;
  ui.fill(bx - 1, by - 1, 2 * t + 2, 2 * t + 2, on ? C.gold : C.hot);
  ui.fill(bx + 1, by + 1, 2 * t - 2, 2 * t - 2, C.iron0);
  ui.fill(bx + 2, by + 2, 2 * t - 4, 2 * t - 4, C.iron1);
  ui.hint(mx, my, mw, mh, `The Megaproject Bay: the Factory floor's bottom-left corner, tiles ${b.x}-${b.x + 1}, ${b.y}-${b.y + 1}. Lit dots are trunks carrying into it.`, 180);
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
  const nx = MEGA.find((m) => m.stage === g.s.mega.stage + 1);
  if (nx && yy + 20 <= inner.y + inner.h - 16) ui.para(`Stage ${nx.stage} opens at the Committee's reputation ${nx.rep ?? 0} (now ${g.s.orders.rep.committee ?? 0}).`, inner.x + 6, yy + 2, inner.w - 12, C.teal1);
  if (button(ui, 'megaOk', inner.x + Math.floor(inner.w / 2) - 55, inner.y + inner.h - 15, 110, 14, 'Magnificent', { gold: true, pulse: celebrate })) app.panel = null;
}
