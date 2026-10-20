// The build bar (docs/ui-redesign.md): centred at the bottom, a row of square slots under category
// tabs (Timberborn's bottom bar, shapez's numbered hotbar, Mindustry's compact grid: genre
// conventions, DECISIONS.md). The tabs are the store's: Build, Power and Heavy as they unlock, and
// Upgrades (the Bellows and land); on the Factory floor, Modules (the trunk belt and the module
// designs). A slot shows the sprite at 1x, its hotkey and its price; one you can afford has a gold
// edge, a new one a dot, a locked one a dark silhouette and a padlock. The detail lives in a rich
// hover card above the slot. Left of it, the tools: Rotate, Remove, Fold (with its audit count)
// and Flow.
import { C, rgba } from '../data/palette';
import { BUILD, UPGRADES, STORE_TABS, type BuildKind } from '../data/machines';
import { RESEARCH } from '../data/research';
import { CHUNKS, PATCHES, FACTORY, type ChunkDef } from '../data/land';
import { ITEMS, type ItemId } from '../data/items';
import { RULES } from '../data/rules';
import { Num } from '../engine/num';
import { ICON, textWidth, wrapText, smallWidth } from '../ui/font';
import { sheet, itemIcon, spriteName } from '../render/sprites';
import { mainOutput } from '../render/factory';
import { poleReach } from '../sim/systems/power';
import { stampCost, stampRefusal, productCopies } from '../sim/systems/modules';
import { plate, plateRaw, button, badge, dot, keycap, label, coinIcon, uiIcon } from './chrome';
import { tab, perMin, type IconName } from './widgets';
import { GRADE_COL } from './fold';
import type { Layout } from './layout';
import type { App } from './app';

export const SLOT_W = 24;
export const SLOT_H = 25;
const SLOT_GAP = 2;
const SLOTS = 9;
const TAB_H = 11;

/** What a hover card shows. */
interface CardSpec {
  title: string;
  key?: string;
  draw: (x: number, y: number) => void;
  price?: { text: string; ok: boolean };
  rate?: string;
  lines: { text: string; color?: string }[];
}

/** One slot's look and behaviour. */
interface Slot {
  id: string;
  key: string;
  draw: (x: number, y: number, hov: boolean) => void;
  price: string;
  priceOk: boolean;
  afford: boolean;
  locked: boolean;
  active: boolean;
  fresh: boolean;
  goal: boolean;
  card: CardSpec;
  onClick: (shift: boolean) => void;
}

const SHORT = (n: number) => Num.of(n).format();

/** the per-minute figure a store slot's card shows */
function rowRate(kind: BuildKind): string {
  switch (kind) {
    case 'belt': return '120 items/min';
    case 'miner': return '30 ore/min';
    case 'smelter': return '30 ingots/min';
    case 'press': return '40 plates/min';
    case 'assembler': return '30 gears/min';
    case 'heap': return 'holds 400 slag';
    case 'crate': return 'holds 50';
    case 'boiler': return '1 coal per 4 s';
    case 'steamEngine': return '300 kW';
    case 'generator': return '200 kW';
    case 'pole': return 'reach 2 tiles';
    case 'kiln': case 'mixer': case 'refinery': case 'smelterMk2': case 'pressMk2': case 'assemblerMk2': return `draws ${BUILD[kind].kw} kW`;
    default: return '';
  }
}

export function buildBar(app: App, L: Layout) {
  const ui = app.ui;
  const g = app.game;
  const hs = app.hud;
  const B = L.band;
  const fac = app.floor === 'factory';

  // ---- the categories
  type Cat = { id: string; name: string; icon: IconName; fresh: boolean; goal: boolean; open: () => void; active: boolean };
  const cats: Cat[] = [];
  const goalUi = hs.goalUi ?? '';
  if (fac) cats.push({ id: 'tab_factory', name: 'Modules', icon: 'fold', fresh: false, goal: false, open: () => {}, active: true });
  else {
    const tabs = STORE_TABS.filter((t) => t.id === 'build' || t.kinds.some((k) => g.unlocked(k)));
    if (!tabs.some((t) => t.id === hs.buildTab)) hs.buildTab = 'build';
    // a tab opened: what it holds has been seen
    if (hs.storeTab === 'build') for (const k of STORE_TABS.find((t) => t.id === hs.buildTab)!.kinds) if (g.unlocked(k)) hs.tabSeen.add(k);
    for (const t of tabs) {
      const fresh = t.id !== 'build' && t.kinds.some((k) => g.unlocked(k) && !hs.tabSeen.has(k));
      const ring = t.id + t.kinds.filter((k) => g.unlocked(k)).length;
      if (fresh && !hs.tabRung.has(ring)) { hs.tabRung.add(ring); app.audio.sfx('tab'); }
      cats.push({ id: 'tab_' + t.id, name: t.name, icon: t.id === 'build' ? 'build' : t.id === 'power' ? 'power' : 'heavy', fresh, goal: goalUi.startsWith('build:') && t.kinds.includes(goalUi.slice(6) as BuildKind) && !(hs.storeTab === 'build' && hs.buildTab === t.id), open: () => { hs.storeTab = 'build'; hs.buildTab = t.id; }, active: hs.storeTab === 'build' && hs.buildTab === t.id });
    }
    const landReady = CHUNKS.some((c) => c.cost && !g.s.land.includes(c.id) && (!c.requires || g.done(c.requires)) && g.s.coin.gte(c.cost));
    cats.push({ id: 'tabUpgrades', name: 'Upgrades', icon: 'star', fresh: landReady && hs.storeTab !== 'upgrades', goal: goalUi === 'land' && hs.storeTab !== 'upgrades', open: () => { hs.storeTab = 'upgrades'; }, active: hs.storeTab === 'upgrades' });
  }

  // ---- the slots of the open category
  const slots = fac ? factorySlots(app) : hs.storeTab === 'upgrades' ? upgradeSlots(app) : storeSlots(app);

  // ---- geometry: the tools plate and the build plate, centred together
  const plateY = B.y + TAB_H + 2, plateH = SLOT_H + 6;
  const toolW = 4 * 24 - 2 + 8;
  const n = Math.max(SLOTS, slots.length);
  const buildW = n * (SLOT_W + SLOT_GAP) - SLOT_GAP + 8;
  const total = toolW + 6 + buildW;
  const x0 = Math.max(2, Math.floor(ui.w / 2 - total / 2));
  const bx = x0 + toolW + 6;
  tools(app, x0, plateY, toolW, plateH);

  // the category tabs sit on the build plate's top edge
  let tx = bx;
  for (const c of cats) {
    const w = 15 + textWidth(c.name) + 6;
    if (tab(app, c.id, tx, B.y + 2, w, TAB_H + 1, c.name, { icon: c.icon, active: c.active, tip: c.id === 'tabUpgrades' ? [{ text: 'Upgrades', color: C.gold }, { text: 'The Bellows and land.' }] : [{ text: c.name, color: C.gold }, { text: fac ? 'The trunk belt (1) and your module designs (2-9). Shift-click a design to stamp a copy.' : 'Keys 1-9 pick from the open tab.' }] })) {
      c.open();
    }
    if (c.fresh || c.goal) {
      if (Math.floor(ui.time * 3) % 2 === 0 || c.goal) dot(ui, tx + w - 4, B.y + 3, c.goal ? C.gold : C.pipRed);
    }
    tx += w + 2;
  }
  plate(ui, bx, plateY, buildW, plateH);
  let hovered: { slot: Slot; x: number } | null = null;
  slots.forEach((s, i) => {
    const sx = bx + 4 + i * (SLOT_W + SLOT_GAP), sy = plateY + 3;
    if (drawSlot(app, s, sx, sy)) hovered = { slot: s, x: sx };
  });
  if (!slots.length) ui.text('Nothing here yet', bx + buildW / 2, plateY + 11, C.hull1, { align: 'center' });
  const hv = hovered as { slot: Slot; x: number } | null;
  if (hv) hoverCard(app, hv.slot.card, hv.x + SLOT_W / 2, B.y);
}

/** One slot; returns true while hovered. */
function drawSlot(app: App, s: Slot, x: number, y: number): boolean {
  const ui = app.ui;
  const ctx = ui.ctx;
  ui.mark(s.id, x, y, SLOT_W, SLOT_H);
  ui.region(x, y, SLOT_W, SLOT_H, 'button');
  const hov = ui.hover(x, y, SLOT_W, SLOT_H);
  const down = hov && ui.input.mouse.down[0] ? 1 : 0;
  // the edge says what you can do: gold you can buy it, teal it is in your hand
  const edge = s.active ? C.teal1 : s.locked ? C.ink : s.afford ? (hov ? C.gold : C.brass1) : hov ? C.hull1 : C.hull0;
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, SLOT_W, SLOT_H);
  ctx.fillStyle = s.active ? C.teal0 : s.locked ? C.ink : hov ? C.hull0 : C.shadow;
  ctx.fillRect(x + 1, y + 1, SLOT_W - 2, SLOT_H - 2);
  if (!s.locked) { ctx.fillStyle = rgba(C.bone, s.active ? 0.3 : 0.12); ctx.fillRect(x + 1, y + 1, SLOT_W - 2, 1); }
  s.draw(x + 4, y + 2 + down, hov);
  if (s.locked) ui.small(ICON.lock, x + SLOT_W / 2, y + 18, C.hull1, { align: 'center' });
  else ui.small(s.price, x + SLOT_W / 2 + 1, y + 18, s.priceOk ? C.gold : C.hull2, { align: 'center', shadow: C.ink });
  if (s.key) ui.small(s.key, x + 2, y + 2, C.hull2, { shadow: C.ink });
  if (s.fresh) dot(ui, x + SLOT_W - 4, y + 1, C.pipRed);
  if (s.goal) {
    const k = Math.floor(ui.time * 4) % 2;
    ctx.fillStyle = k ? C.gold : C.hot;
    ctx.fillRect(x - 2, y - 2, SLOT_W + 4, 1);
    ctx.fillRect(x - 2, y + SLOT_H + 1, SLOT_W + 4, 1);
    ctx.fillRect(x - 2, y - 2, 1, SLOT_H + 4);
    ctx.fillRect(x + SLOT_W + 1, y - 2, 1, SLOT_H + 4);
  }
  if (hov) {
    ui.hoverId = s.id;
    if (ui.clicked) {
      ui.eat();
      ui.sfx('click');
      s.onClick(app.input.shift);
    }
  }
  return hov;
}

/** The rich hover card above a slot: the sprite at 2x, the name and key, the price and rate, and
 *  the lines that say what it does. */
function hoverCard(app: App, c: CardSpec, cx: number, bandY: number) {
  const ui = app.ui;
  const w = 184;
  const lines: { text: string; color: string }[] = [];
  for (const l of c.lines) for (const t of wrapText(l.text, w - 12)) lines.push({ text: t, color: l.color ?? C.bone });
  const h = 44 + lines.length * 10;
  const x = Math.max(2, Math.min(ui.w - w - 2, Math.round(cx - w / 2)));
  const y = bandY - h - 1;
  ui.later(() => {
    plateRaw(ui.ctx, x, y, w, h, C.gold);
    ui.fill(x + 5, y + 5, 34, 34, C.ink);
    ui.fill(x + 6, y + 6, 32, 32, C.shadow);
    c.draw(x + 6, y + 6);
    const tx = x + 44;
    ui.text(c.title, tx, y + 6, C.gold, { shadow: C.ink });
    if (c.key) label(ui, c.key, x + w - 6, y + 7, C.hull2, 'right');
    if (c.price) {
      coinIcon(ui, tx, y + 17, false);
      ui.text(c.price.text, tx + 10, y + 17, c.price.ok ? C.gold : C.pipRed);
    }
    if (c.rate) ui.text(c.rate, tx, y + 28, C.leaf);
    lines.forEach((l, i) => ui.text(l.text, x + 6, y + 42 + i * 10, l.color));
  });
}

/** The Workshop store's slots: the open tab's kinds. */
function storeSlots(app: App): Slot[] {
  const g = app.game;
  const hs = app.hud;
  const kinds = STORE_TABS.find((t) => t.id === hs.buildTab)!.kinds;
  const goalUi = hs.goalUi ?? '';
  return kinds.map((kind, i) => {
    const d = BUILD[kind];
    const unlocked = g.unlocked(kind);
    const free = kind === 'crate' && g.s.freeCrates > 0;
    const afford = free || g.s.coin.gte(d.cost);
    const owned = g.s.ents.filter((e) => e.kind === kind).length;
    if (unlocked && owned > 0) hs.seen.add(kind);
    const fresh = unlocked && !hs.seen.has(kind) && kind !== 'belt' && kind !== 'miner' && kind !== 'smelter' && kind !== 'heap';
    const s = sheet(spriteName(kind));
    const sprite = (x: number, y: number, size: number, anim: boolean) => {
      const working = g.s.ents.some((e) => e.kind === kind && e.state === 'work');
      const f = anim || working ? Math.floor(app.ui.time * (s.fps || 6)) % s.frames.length : 0;
      app.ui.ctx.drawImage(s.frames[f % s.frames.length], x, y, size, size);
    };
    const extra: { text: string; color?: string }[] = [];
    if (d.kw) extra.push({ text: `Draws ${d.kw} kW while it works. A Pole within ${poleReach(g)} tiles joins it to a grid.`, color: C.teal1 });
    if (d.w > 1) extra.push({ text: `${d.w}x${d.h} tiles: it goes down with its top-left corner on the tile you click.`, color: C.hull2 });
    return {
      id: 'store_' + kind,
      key: String(i + 1),
      draw: (x, y, hov) => {
        const ctx = app.ui.ctx;
        if (!unlocked) {
          ctx.globalAlpha = 0.35;
          ctx.filter = 'brightness(0)';
          sprite(x, y, 16, false);
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
          return;
        }
        ctx.globalAlpha = afford ? 1 : 0.55;
        sprite(x, y, 16, hov);
        ctx.globalAlpha = 1;
      },
      price: free ? 'free' : SHORT(d.cost),
      priceOk: afford,
      afford: unlocked && afford,
      locked: !unlocked,
      active: app.mode.k === 'build' && app.mode.kind === kind,
      fresh,
      goal: goalUi === 'build:' + kind,
      card: unlocked
        ? { title: d.name, key: `key ${i + 1}`, draw: (x, y) => sprite(x, y, 32, true), price: { text: free ? `free (${g.s.freeCrates} left)` : `${Num.of(d.cost).format()} coin`, ok: afford }, rate: rowRate(kind), lines: [{ text: d.blurb }, ...extra, { text: `You have ${owned}. The price is flat: the 10th costs the same as the 1st.`, color: C.hull2 }, { text: 'Click, then click the floor. R rotates; right-click stops.', color: C.hull1 }] }
        : { title: '???', draw: (x, y) => { app.ui.ctx.globalAlpha = 0.35; app.ui.ctx.filter = 'brightness(0)'; sprite(x, y, 32, false); app.ui.ctx.filter = 'none'; app.ui.ctx.globalAlpha = 1; }, lines: [{ text: `Research ${RESEARCH[d.unlock!].name} to unlock.`, color: C.teal1 }] },
      onClick: () => app.pickBuild(kind),
    };
  });
}

/** A land chunk drawn as a 16 px tile: ground, a grid, and the ore its deposits hold. */
function landTile(app: App, c: ChunkDef, x: number, y: number, size: number) {
  const ui = app.ui;
  const k = size / 16;
  ui.fill(x, y, size, size, C.ground1);
  ui.fill(x, y, size, k, C.ground2);
  for (let i = 4; i < 16; i += 4) { ui.fill(x + i * k, y, Math.max(1, k / 2), size, C.ground0); ui.fill(x, y + i * k, size, Math.max(1, k / 2), C.ground0); }
  const ores = [...new Set(PATCHES.filter((p) => p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h).map((p) => p.item))];
  ores.slice(0, 2).forEach((it, i) => ui.ctx.drawImage(itemIcon(it), x + (ores.length > 1 ? (2 + i * 6) * k : 4 * k), y + (ores.length > 1 ? (2 + i * 6) * k : 4 * k), 8 * k, 8 * k));
}

/** The Upgrades tab: the Bellows until it is bought, and the land still for sale. */
function upgradeSlots(app: App): Slot[] {
  const g = app.game;
  const out: Slot[] = [];
  if (!g.has('bellows')) {
    const u = UPGRADES.bellows;
    const afford = g.s.coin.gte(u.cost);
    const s = sheet('furnace');
    const fur = (x: number, y: number, size: number) => app.ui.ctx.drawImage(s.frames[Math.floor(app.ui.time * (s.fps || 6)) % s.frames.length], x, y, size, size);
    out.push({
      id: 'store_bellows', key: '', draw: (x, y) => fur(x, y, 16), price: String(u.cost), priceOk: afford, afford, locked: false, active: false, fresh: false, goal: app.hud.goalUi === 'bellows',
      card: { title: 'The Bellows', draw: (x, y) => fur(x, y, 32), price: { text: `${u.cost} coin`, ok: afford }, rate: 'an ingot every 2 s', lines: [{ text: 'The Hand Furnace runs on its own while it has ore. No more cranking.' }, { text: 'Click to buy.', color: C.hull1 }] },
      onClick: () => app.act({ k: 'upgrade', id: 'bellows' }),
    });
  }
  for (const c of CHUNKS) {
    if (!c.cost || g.s.land.includes(c.id)) continue;
    const ready = !c.requires || g.done(c.requires);
    const afford = g.s.coin.gte(c.cost);
    out.push({
      id: 'land_' + c.id, key: '',
      draw: (x, y) => { app.ui.ctx.globalAlpha = ready ? 1 : 0.4; landTile(app, c, x, y, 16); app.ui.ctx.globalAlpha = 1; },
      price: SHORT(c.cost), priceOk: afford, afford: ready && afford, locked: !ready, active: false, fresh: false, goal: app.hud.goalUi === 'land' && ready,
      card: { title: c.name, draw: (x, y) => landTile(app, c, x, y, 32), price: { text: `${c.cost.toLocaleString('en-US')} coin`, ok: afford }, rate: `${c.w}x${c.h} tiles of land`, lines: ready ? [{ text: 'More floor to build on; its deposits add ore claims too.' }, { text: 'Click to buy (or click it on the map).', color: C.hull1 }] : [{ text: `Research ${RESEARCH[c.requires!].name} first.`, color: C.teal1 }] },
      onClick: () => { if (ready && app.act({ k: 'land', id: c.id }).ok) app.lookAt(c.x + c.w / 2, c.y + c.h / 2); else if (!ready) app.refuse(`Research ${RESEARCH[c.requires!].name} first`); },
    });
  }
  return out;
}

/** The Factory floor's slots: the trunk belt (1) and the module designs (2-9), and a door to the
 *  Modules screen when there are more. Shift-click stamps a copy of a design. */
function factorySlots(app: App): Slot[] {
  const g = app.game;
  const out: Slot[] = [];
  const afford = g.s.coin.gte(FACTORY.trunkCost);
  const tr = sheet('trunk');
  out.push({
    id: 'fslot_trunk', key: '1', draw: (x, y) => app.ui.ctx.drawImage(tr.frames[Math.floor(app.ui.time * 6) % tr.frames.length], x, y), price: String(FACTORY.trunkCost), priceOk: afford, afford, locked: false, active: app.mode.k === 'ftrunk', fresh: false, goal: false,
    card: { title: 'Trunk belt', key: 'key 1', draw: (x, y) => app.ui.ctx.drawImage(tr.frames[Math.floor(app.ui.time * 6) % tr.frames.length], x, y, 32, 32), price: { text: `${FACTORY.trunkCost} coin a tile`, ok: afford }, rate: `${FACTORY.trunkSpeed * 60} items/min`, lines: [{ text: "From a module's front to the next module's back, the Factory Dock, the Hopper or the Megaproject Bay. A trunk leaving a module's side takes its slag or oil." }, { text: 'Click, then drag on the floor to lay a line.', color: C.hull1 }] },
    onClick: () => app.setMode(app.mode.k === 'ftrunk' ? { k: 'idle' } : { k: 'ftrunk' }),
  });
  const designs = g.s.designs;
  const room = designs.length > 8 ? 7 : 8;
  designs.slice(0, room).forEach((d, i) => {
    const out1 = mainOutput(g, d.id);
    const draw = (x: number, y: number, size: number) => {
      const ctx = app.ui.ctx;
      ctx.drawImage(sheet('module').frames[0], x, y, size, size);
      if (out1) ctx.drawImage(itemIcon(out1), x + size / 4, y + size / 4, size / 2, size / 2);
    };
    const cost = stampCost(g, d);
    const why = stampRefusal(g, d);
    out.push({
      id: 'fslot:' + d.id, key: String(i + 2),
      draw: (x, y) => {
        draw(x, y, 16);
        app.ui.small(d.grade.letter, x + 17, y + 1, GRADE_COL[d.grade.letter] ?? C.bone, { align: 'right', shadow: C.ink });
      },
      price: d.spare ? `${d.spare}` : '0', priceOk: d.spare > 0, afford: d.spare > 0, locked: false,
      active: app.mode.k === 'fmodule' && app.mode.design === d.id, fresh: false, goal: false,
      card: {
        title: d.name.length > 20 ? d.name.slice(0, 19) + '..' : d.name, key: `key ${i + 2}`, draw: (x, y) => draw(x, y, 32),
        price: { text: `${d.spare} spare  (stamp ${cost.format()})`, ok: d.spare > 0 },
        rate: `grade ${d.grade.letter}  x${d.grade.mult.toFixed(2)}`,
        lines: [
          { text: `Makes ${Object.entries(d.outs).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute.` },
          { text: Object.keys(d.ins).length ? `Takes ${Object.entries(d.ins).map(([k, v]) => `${perMin(v ?? 0)} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')} a minute at its back.` : 'A source: it takes nothing in.', color: C.hull2 },
          { text: why ? `Stamp: ${why}` : `Shift-click to stamp a copy: ${cost.format()} coin (bill x (1 + ${RULES.stampGrowth.value} x ${productCopies(g, d)} copies of this product)).`, color: why ? C.pipRed : C.gold },
          { text: d.spare ? 'Click, then click the floor. R rotates: the gold mark is its front.' : 'No spare copy: stamp one first.', color: C.hull1 },
        ],
      },
      onClick: (shift) => {
        if (shift) { app.act({ k: 'stamp', id: d.id }); return; }
        app.pickModule(d.id);
      },
    });
  });
  if (designs.length > room) {
    out.push({
      id: 'openModules', key: 'I', draw: (x, y) => uiIcon(app.ui, 'fold', x, y), price: `+${designs.length - room}`, priceOk: true, afford: false, locked: false, active: false, fresh: false, goal: false,
      card: { title: 'More modules', draw: (x, y) => uiIcon(app.ui, 'fold', x + 8, y + 8), lines: [{ text: `${designs.length - room} more designs in the Modules screen (I): place, stamp, unfold, rename.` }] },
      onClick: () => app.togglePanel('modules'),
    });
  }
  return out;
}

interface Tool { id: string; icon: 'rotate' | 'remove' | 'fold' | 'flow'; key: string; name: string; active: boolean; tip: string; click: () => void; disabled?: boolean; gold?: boolean }

/** The tools plate: Rotate, Remove, Fold and Flow as icon keys. */
function tools(app: App, x: number, y: number, w: number, h: number) {
  const ui = app.ui;
  const g = app.game;
  label(ui, 'tools', x + 4, y - 9, C.hull1);
  plate(ui, x, y, w, h);
  const foldNew = g.done('folding') && !g.s.designs.length && !g.s.audits.length;
  const list: Tool[] = [
    { id: 'rotate', icon: 'rotate', key: 'R', name: 'Rotate', active: false, tip: `Rotate what you place, or the machine under the mouse. Facing ${['east', 'south', 'west', 'north'][app.rot]}.`, click: () => { app.rot = ((app.rot + 1) % 4) as 0; app.audio.sfx('rotate'); } },
    { id: 'remove', icon: 'remove', key: 'X', name: 'Remove', active: app.mode.k === 'remove', tip: 'Remove a building: a full refund.', click: () => app.setMode(app.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' }) },
    { id: 'fold', icon: 'fold', key: 'F', name: 'Fold', active: app.mode.k === 'fold', tip: g.done('folding') ? 'Drag a box over a working line: it is audited for 70 s, graded, and folded into one tile.' : 'Locked: research Folding.', click: () => app.toggleFold(), disabled: !g.done('folding'), gold: foldNew && app.mode.k !== 'fold' || (app.hud.goalUi === 'fold' && app.mode.k !== 'fold') },
    { id: 'flow', icon: 'flow', key: 'L', name: 'Flow', active: app.flowOverlay, tip: 'Show belts by how full they are.', click: () => { app.flowOverlay = !app.flowOverlay; } },
  ];
  list.forEach((t, i) => {
    const bx = x + 4 + i * 24, by = y + 3;
    if (button(ui, t.id, bx, by, 22, h - 6, '', { icon: t.icon, active: t.active, disabled: t.disabled, gold: t.gold, pulse: t.gold, tip: [{ text: `${t.name}  (${t.key})`, color: C.gold }, { text: t.tip }] })) t.click();
    keycap(ui, t.key, bx + 22 - smallWidth(t.key) - 3, by + h - 6 - 8, t.disabled ? C.hull0 : C.hull2);
    // the Fold tool wears the audit count, gold when one is graded
    if (t.id === 'fold' && g.s.audits.length) {
      const graded = g.s.audits.some((a) => a.result);
      badge(ui, bx + 10, by - 5, `${g.s.audits.length}/${RULES.maxAudits.value}`, graded ? C.gold : C.teal0);
    }
  });
}
