// Reports as tags on strings (docs/hud-180.md "Reports"). The hover report and the pinned report
// are the same tag: hovered, it hangs on a string from what it reports on and shows the few rows
// that matter (the status chip and its cause, the recipe and its rate, Overdrive, the verbs);
// clicked, it is pinned (a pushpin) and shows every row: who feeds it and how much, where its
// byproduct goes, its front, power, mode and Overdrive, and the line around it. Rows are built
// from game state here, never parsed from src/sim/analysis.ts's sentences (those stay for the
// tests and the offline history). Pillar 3: every fact the pre-180 report gave is a row here.
import { C } from '../data/palette';
import { BUILD, isMachine, isPower } from '../data/machines';
import { RECIPE, type RecipeDef } from '../data/recipes';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { RESEARCH } from '../data/research';
import { RULES } from '../data/rules';
import { FACTORY } from '../data/land';
import { megaStage } from '../data/megaprojects';
import { TICK_RATE } from '../engine/time';
import { plain, pct, duration } from '../engine/fmt';
import { bigWidth, hasBigGlyph, BIG_LINE_H, LINE_H } from '../ui/font';
import { layoutRich, drawLayout, richWidth, CHIP_H } from '../ui/rich';
import { T, type Role } from '../ui/theme';
import { itemIcon } from '../render/sprites';
import { nominal, feeders, entName, endsAtSink, outLinks, lineOf } from '../sim/analysis';
import { shares } from '../sim/systems/stats';
import { powerFactor, poleReach, drawKw } from '../sim/systems/power';
import { modeSpeed, baseSpeed, veinBoost } from '../sim/systems/machines';
import { fname, feedsDock, mainItem } from '../sim/systems/modules';
import { megaFrac } from '../render/factory';
import { gridIndex, capacity, powered, burnerOf, fuelCount, engineOf, producerKw, kw } from '../render/powerview';
import { DX, DY, MODES, opposite, type Ent, type FEnt, type Mode } from '../sim/world';
import { tag, tagSize, rule, meter, button, uiIcon, type UIconName } from './chrome';
import type { Rect, TipPlace } from '../ui/ui';
import type { Layout } from './layout';
import type { App } from './app';

// ------------------------------------------------------------------ rows

/** One row of a report: rich text (it may wrap), a bar against a target, a ruled gap. `opt` rows
 * are the first to go when a pinned tag would be too tall (the line around it). */
export type Row =
  | { t: 'rich'; s: string; opt?: boolean }
  | { t: 'bar'; frac: number; target?: number | null; role: Role; note?: string; opt?: boolean }
  | { t: 'rule'; opt?: boolean };

export interface Report {
  title: string;
  /** an 8x8 item icon (or a UI icon) at the title's right */
  item?: string | null;
  uicon?: UIconName;
  /** the rows a hover shows (all of them when pinned) */
  rows: Row[];
  /** rows only the pinned tag shows */
  more?: Row[];
  /** the keycap verbs along the foot */
  verbs?: string;
  /** a powered Workshop machine with Tuning: the four mode buttons under the rows (pinned) */
  modes?: Ent;
}

const rich = (s: string, opt = false): Row => ({ t: 'rich', s, opt });

/** Text for the display face: characters Bullfrog lacks become their nearest ('·' a dash) or go. */
export const bigSafe = (s: string) => [...s].map((c) => (c === ' ' || hasBigGlyph(c) ? c : c === '·' ? '-' : c === '…' ? '...' : '')).join('').replace(/ {2,}/g, ' ');
const RULE: Row = { t: 'rule' };

/** per minute, the one number helper */
const pm = (n: number) => plain(n, n < 10 ? 1 : 0);
const lc = (id: string | null | undefined) => (id ? itemName(id).toLowerCase() : 'input');
const icon = (id: string | null | undefined) => (id && id in ITEMS ? `{i:${id}}` : '');

export const MODE_NAME: Record<Mode, string> = { normal: 'Normal', efficient: 'Efficient', overclock: 'Overclocked', precision: 'Precision' };
const MODE_SHORT: Record<Mode, string> = { normal: 'Norm', efficient: 'Eff', overclock: 'Over', precision: 'Prec' };

// ------------------------------------------------------------------ the Workshop's machines

/** How long a working machine runs on what it holds (no input arriving and/or nothing taking its
 * output): the crafts its buffer allows at its speed now. The same arithmetic as the report's. */
function runLeft(app: App, m: Ent, r: RecipeDef, inputs: boolean, output: boolean): { sec: number; why: 'in' | 'out'; item: ItemId } | null {
  const g = app.game;
  const sp = baseSpeed(g, m) * veinBoost(g, m) * Math.min(1, powerFactor(g, m));
  if (sp <= 0) return null;
  const craft = (r.time * TICK_RATE) / sp;
  let inN = Infinity, inItem: ItemId | null = null;
  if (inputs)
    for (const s of r.inputs) {
      const c = (m.active ? 1 : 0) + Math.floor((m.inBuf[s.item] ?? 0) / s.n);
      if (c < inN) { inN = c; inItem = s.item; }
    }
  const o = r.outputs[0];
  const outN = output ? Math.max(0, Math.floor((RULES.outputCap.value - m.out) / o.n)) : Infinity;
  const n = Math.min(inN, outN);
  if (!isFinite(n)) return null;
  const first = m.active ? Math.max(0, r.time * TICK_RATE - m.prog) / sp : craft;
  const ticks = n <= 0 ? 0 : first + (n - 1) * craft;
  return inN <= outN && inItem ? { sec: ticks / TICK_RATE, why: 'in', item: inItem } : { sec: ticks / TICK_RATE, why: 'out', item: o.item };
}

const secs = (s: number) => (s >= 1 ? duration(s).replace(/ /g, '') : 'now');

/** Where a machine's byproduct leaves: the first thing at a side that takes it, or null. */
function byproductTo(app: App, m: Ent): string | null {
  const g = app.game;
  for (const l of outLinks(m)) {
    if (l.d === m.rot) continue;
    const n = g.entAt(l.x, l.y);
    if (!n || n === m || n.kind === 'miner') continue;
    if (n.kind === 'belt' && n.rot !== l.d) continue;
    if (isMachine(n.kind) && opposite(l.d) === n.rot) continue;
    return isMachine(n.kind) || isPower(n.kind) ? entName(g, n) : BUILD[n.kind].name;
  }
  return null;
}

/** The power rows of a powered machine (its grid, what it draws), and whether it has none. */
function powerRows(app: App, e: Ent): { rows: Row[]; none: 'pole' | 'fuel' | null; sat: number } {
  const g = app.game;
  const out: Row[] = [];
  if (!powered(e.kind)) return { rows: out, none: null, sat: 1 };
  const gi = gridIndex(g, e);
  const draw = Math.round(drawKw(e));
  if (gi < 0) {
    out.push(rich(`{u:power} {power:no Pole} within ${poleReach(g)} · {soft:draws} ${draw} kW`));
    return { rows: out, none: 'pole', sat: 0 };
  }
  const gr = g.grids[gi];
  const cap = capacity(g, gr);
  if (cap <= 0) {
    out.push(rich(`{u:power} grid ${gi + 1} {bad:no fuel} · {soft:draws} ${draw} kW`));
    return { rows: out, none: 'fuel', sat: 0 };
  }
  const p = Math.round(gr.sat * 100);
  out.push(rich(`{u:power} grid ${gi + 1} ${gr.sat < 1 ? `{warn:${p}%}` : `{good:${p}%}`} · {soft:draws} ${draw} kW`));
  out.push(rich(`{soft:grid} ${kw(cap)} for ${kw(gr.demand)}`));
  return { rows: out, none: null, sat: gr.sat };
}

/** A Workshop machine's report. */
function machineReport(app: App, e: Ent): Report {
  const g = app.game;
  const r = e.recipe ? RECIPE[e.recipe] : null;
  const rows: Row[] = [];
  const more: Row[] = [];
  const sh = shares(e);
  const firstMin = e.kind === 'furnace' && !g.has('bellows');
  const nom = nominal(e);
  const main = nom.outs[0]?.item ?? null;
  const rep: Report = { title: entName(g, e), item: main, rows, more };
  if (firstMin) {
    const cranks = r ? Math.ceil(r.time / RULES.crankSeconds.value) : 8;
    rows.push(rich('{k:LMB} the ore patch → feeds her'));
    rows.push(rich(`{k:LMB} her ×${cranks} → {i:ironIngot}`));
  }
  if (!r) {
    rows.push(rich('{chip:warn:NO RECIPE} it takes its first input'));
    rep.verbs = '{k:R} turn  {k:X} remove';
    return rep;
  }
  const f = nom.ins.length ? feeders(g, e) : null;
  const unfed = !!f && !f.from.length && !f.stores.length && e.kind !== 'furnace';
  const frontless = e.kind !== 'miner' && !g.entAt(e.x + DX[e.rot], e.y + DY[e.rot]);
  const left = e.state === 'work' && (unfed || frontless) ? runLeft(app, e, r, unfed, frontless) : null;
  const share = (v: number) => (sh.n && Math.round(v * 100) > 0 ? ` · ${pct(v)}` : '');
  const pw = powerRows(app, e);
  // ---- the status chip and its cause
  if (e.paused) rows.push(rich('{chip:soft:STOPPED} by you · makes nothing'));
  else if (e.state === 'work' && left) {
    if (left.why === 'in') rows.push(rich(`{chip:warn:ON BUFFER} ${icon(left.item)} runs out in ${secs(left.sec)}`));
    else rows.push(rich(`{chip:warn:FILLING} ${icon(left.item)} full in ${secs(left.sec)}, then it blocks`));
  } else if (e.state === 'work') rows.push(rich(`{chip:good:WORKING}${sh.n ? ` busy ${pct(sh.work)}` : ''}`));
  else if (e.state === 'starved') {
    if (e.why === 'crank') rows.push(rich('{chip:warn:WAITING} {k:LMB} crank her'));
    else if (e.why === 'power') rows.push(rich(pw.none === 'pole' ? '{chip:power:NO POWER} no Pole reaches it' : '{chip:power:NO POWER} its grid has no fuel'));
    else rows.push(rich(`{chip:warn:STARVED} ${icon(e.why)} short${share(sh.starved)}`));
  } else if (e.state === 'blocked') {
    if (e.why && e.why === e.byItem) rows.push(rich(`{chip:bad:CHOKED} ${icon(e.why)} has no way out${share(sh.byBlocked)}`));
    else rows.push(rich(`{chip:bad:${frontless ? 'BLOCKED' : 'FULL'}} ${icon(e.why ?? main)} ${frontless ? 'front leads nowhere' : 'front takes no more'}${share(sh.blocked)}`));
  } else rows.push(rich('{chip:soft:IDLE}'));
  const pf = Math.min(1, powerFactor(g, e));
  if (pf < 0.999 && e.why !== 'power') rows.push(rich(`{chip:warn:BROWNOUT ${Math.round(pf * 100)}%} its speed`));
  // ---- Overdrive
  const odOn = g.done('overdrive') && !firstMin;
  const od = e.od ?? 0, cool = e.cool ?? 0;
  if (odOn && od > 0) rows.push(rich(`{chip:warn:OVERDRIVE ${RULES.overdriveMult.value}x ${Math.ceil(od / TICK_RATE)}s}`));
  else if (odOn && cool > 0) rows.push(rich(`{chip:soft:COOLING ${Math.ceil(cool / TICK_RATE)}s}`));
  // ---- the recipe, the rate now, a bar against its rate when busy
  if (nom.outs.length) {
    const busy = nom.outs[0].perMin;
    const now = busy * sh.work * pf;
    const ins = nom.ins.map((i) => icon(i.item)).join(' ');
    const outs = nom.outs.map((o) => icon(o.item)).join(' ');
    rows.push(rich(`${ins ? ins + ' → ' : ''}${outs}  ${pm(now)}/min`));
    rows.push({ t: 'bar', frac: busy > 0 ? now / busy : 0, role: now >= busy * 0.9 ? 'good' : 'warn', note: `of ${pm(busy)}/min` });
    if (nom.outs.length > 1) more.push(rich(`out ${nom.outs.map((o) => `${icon(o.item)} ${pm(o.perMin)}/min`).join('  ')}`));
  }
  // ---- feeders
  if (f) {
    more.push(rich(`in ${nom.ins.map((i) => `${icon(i.item)} ${pm(i.perMin)}/min`).join(' + ')}`));
    if (f.from.length) {
      for (const s of f.from.slice(0, 4)) {
        const sn = nominal(s);
        more.push(rich(`← ${entName(g, s)} ${sn.outs.map((o) => `${icon(o.item)} ${pm(o.perMin)}/min`).join(' ')}`));
      }
      if (f.from.length > 4) more.push(rich(`{soft:← +${f.from.length - 4} more}`));
    } else if (f.stores.length) more.push(rich(`← {u:orders} ${f.stores.length > 1 ? `${f.stores.length} crates` : 'a crate'} · ${f.stores.reduce((n, c) => n + c.store.length, 0)} held`));
    else if (e.kind === 'furnace') more.push(rich('← {soft:by hand} the ore patch'));
    // nothing feeds it: the cause worth fixing, so the hover shows it too
    else if (e.state === 'work') rows.push(rich('← {warn:nothing} · it runs dry soon'));
    else rows.push(rich('← {bad:nothing} · point a belt in'));
    if (f.shared.length) more.push(rich(`{warn:shared} with ${f.shared.map((s) => entName(g, s)).join(', ')}`));
  }
  // ---- the byproduct's route
  if (r.byproduct) {
    const full = e.by >= RULES.outputCap.value;
    const to = byproductTo(app, e);
    const route = `side ${icon(r.byproduct.item)} 1 per ${r.byproduct.every} → ${full ? '{bad:nowhere}' : to ? to : '{warn:nowhere yet}'}`;
    if (full || (e.state === 'blocked' && e.why === e.byItem)) rows.push(rich(route));
    else more.push(rich(route));
  }
  // ---- the front
  if (frontless) {
    const cap = RULES.outputCap.value;
    const s = e.state === 'blocked' ? 'front → {bad:nothing} · it has stopped' : e.out > 0 ? `front → {warn:nothing} · ${e.out}/${cap} waiting inside` : 'front → {soft:nothing yet}';
    if (e.state === 'blocked' && !(e.why && e.why === e.byItem)) rows.push(rich(s));
    else more.push(rich(s));
  } else if (e.kind !== 'miner' && endsAtSink(g, e)) more.push(rich('front → {good:Dock or Hopper}'));
  // ---- power and mode
  if (pw.rows.length) {
    if (pw.none) rows.push(...pw.rows);
    else more.push(...pw.rows);
    if (g.done('tuning')) {
      const m = e.mode ?? 'normal';
      more.push(rich(`mode ${m === 'normal' ? '{soft:Normal}' : MODE_NAME[m]} · ${modeSpeed(e)}x speed`));
      rep.modes = e;
    }
  }
  // ---- the line around it (the first rows to go when the tag is too tall)
  more.push(...lineRows(app, e));
  // ---- verbs
  const odReady = odOn && !od && !cool && e.by < RULES.outputCap.value;
  const lmb = e.state === 'starved' && e.why === 'crank' ? 'crank' : e.by >= RULES.outputCap.value ? 'shovel' : odReady ? `overdrive ${RULES.overdriveMult.value}x ${RULES.overdriveSeconds.value}s` : 'pin';
  rep.verbs = `{k:LMB} ${lmb}  {k:R} turn  {k:X} remove`;
  return rep;
}

/** The line around a machine, as rows: what it makes and where it ends, its worst ratio and the
 * fix, slag that is stuck (the line report's facts). */
function lineRows(app: App, m: Ent): Row[] {
  const g = app.game;
  const out: Row[] = [];
  const line = lineOf(g, m);
  const ms = line.filter((e) => isMachine(e.kind) && e.recipe);
  if (ms.length < 2) return out;
  const made = new Map<ItemId, number>(), used = new Map<ItemId, number>();
  const makers = new Map<ItemId, Ent[]>(), users = new Map<ItemId, Ent[]>();
  for (const e of ms) {
    const n = nominal(e);
    for (const o of n.outs) { made.set(o.item, (made.get(o.item) ?? 0) + o.perMin); makers.set(o.item, [...(makers.get(o.item) ?? []), e]); }
    for (const i of n.ins) { used.set(i.item, (used.get(i.item) ?? 0) + i.perMin); users.set(i.item, [...(users.get(i.item) ?? []), e]); }
  }
  const products = [...made.keys()].filter((k) => !used.has(k));
  const sinks = ms.some((e) => endsAtSink(g, e));
  out.push({ t: 'rule', opt: true });
  out.push(rich(`line ${ms.length} machines → ${products.map((p) => `${icon(p)} ${pm(made.get(p)!)}/min`).join(' ') || '{soft:parts for each other}'}${sinks ? '' : ' · {warn:reaches no Dock}'}`, true));
  let worst: { item: ItemId; ratio: number } | null = null;
  for (const [item, want] of used) {
    const have = made.get(item) ?? 0;
    if (have === 0) continue;
    const ratio = have / want;
    if (!worst || Math.abs(Math.log(ratio)) > Math.abs(Math.log(worst.ratio))) worst = { item, ratio };
  }
  if (worst && Math.abs(worst.ratio - 1) > 0.12) {
    const have = made.get(worst.item)!, want = used.get(worst.item)!;
    if (worst.ratio < 1) {
      const maker = makers.get(worst.item)![0];
      const each = nominal(maker).outs.find((o) => o.item === worst!.item)!.perMin;
      const add = Math.ceil((want - have) / each);
      out.push(rich(`{warn:short} ${icon(worst.item)} makes ${pm(have)}, wants ${pm(want)}/min`, true));
      out.push(rich(`fix +${add} ${BUILD[maker.kind].name} · ${pm(each)}/min each`, true));
    } else {
      const user = users.get(worst.item)![0];
      const each = nominal(user).ins.find((i) => i.item === worst!.item)!.perMin;
      const add = Math.floor((have - want) / each);
      out.push(rich(`{warn:too much} ${icon(worst.item)} makes ${pm(have)}, uses ${pm(want)}/min`, true));
      if (add >= 1) out.push(rich(`fix +${add} ${BUILD[user.kind].name} would use it`, true));
    }
  } else if (worst) out.push(rich('{good:ratios balanced}', true));
  const jams = ms.filter((e) => e.state === 'blocked' && e.why && e.why === e.byItem);
  if (jams.length) out.push(rich(`{bad:slag stuck} at ${jams.map((e) => entName(g, e)).join(', ')}`, true));
  return out;
}

// ------------------------------------------------------------------ power buildings

function powerReport(app: App, e: Ent): Report {
  const g = app.game;
  const rows: Row[] = [];
  const more: Row[] = [];
  const reach = poleReach(g);
  const gi = gridIndex(g, e);
  const gr = gi >= 0 ? g.grids[gi] : null;
  const status = (p: Ent, made: string) => {
    if (p.state === 'work') rows.push(rich(made));
    else if (p.state === 'starved') rows.push(rich(`{chip:warn:NO FUEL} belt ${(BUILD[p.kind].fuel?.items ?? ['coal']).map((i) => `{i:${i}}`).join(' ')} into it`));
    else if (p.why === 'pole') rows.push(rich(`{chip:soft:UNLINKED} a Pole within ${reach}`));
    else if (p.why === 'engine') rows.push(rich('{chip:warn:NO ENGINE} turn it to face one {k:R}'));
    else rows.push(rich('{chip:soft:STANDBY} nothing on its grid wants power'));
  };
  const fuel = (b: Ent) => {
    const n = fuelCount(b);
    const def = BUILD[b.kind].fuel!;
    const burning = b.prog > 0 ? ` · ${(b.prog / TICK_RATE).toFixed(1)}s burning` : '';
    rows.push(rich(`fuel ${n > 0 || b.prog > 0 ? n : `{warn:${n}}`} waiting${burning}`));
    more.push(rich(`1 ${def.items.map((i) => `{i:${i}}`).join(' or ')} per ${def.seconds}s at full load`));
  };
  let sub = '';
  switch (e.kind) {
    case 'boiler': {
      const eng = engineOf(g, e);
      status(e, `{chip:good:BURNING} steams ${eng ? entName(g, eng) : 'its engine'}`);
      fuel(e);
      more.push(rich(`takes ${(BUILD.boiler.fuel?.items ?? []).map((i) => `{i:${i}}`).join(' ')} · any side but its front`));
      sub = 'fuel burner';
      break;
    }
    case 'steamEngine': {
      const b = burnerOf(g, e);
      status(e, `{chip:good:MAKING} {power:${kw(producerKw(g, e))}}`);
      if (b) rows.push(rich(`steam ← ${entName(g, b)}${fuelCount(b) + b.prog > 0 ? '' : ' · {warn:no fuel}'}`));
      else rows.push(rich('{bad:no Boiler} behind it, facing it'));
      if (!gr) rows.push(rich(`{warn:no Pole} within ${reach}`));
      break;
    }
    case 'generator': {
      status(e, `{chip:good:MAKING} {power:${kw(producerKw(g, e))}}`);
      fuel(e);
      if (!gr) rows.push(rich(`{warn:no Pole} within ${reach}`));
      break;
    }
    case 'pole': {
      if (!gr || gr.consumers.length + gr.producers.length === 0) rows.push(rich('{chip:soft:IDLE} powers nothing yet'));
      rows.push(rich(`reach ${reach} tiles · ${reach * 2 + 1}x${reach * 2 + 1} · links Poles within ${RULES.poleLink.value}`));
      sub = 'power grid';
      break;
    }
  }
  if (gr) {
    const cap = capacity(g, gr);
    const ink = gr.demand > 0 && cap <= 0 ? 'bad' : gr.sat < 1 ? 'warn' : 'power';
    rows.push(rich(`grid ${gi + 1} {${ink}:${kw(cap)}} for ${kw(gr.demand)}`));
    more.push(rich(`${gr.poles.length} Pole${gr.poles.length > 1 ? 's' : ''} · ${gr.producers.length} maker${gr.producers.length === 1 ? '' : 's'} · ${gr.consumers.length} machine${gr.consumers.length === 1 ? '' : 's'}`));
  }
  if (BUILD[e.kind].power) more.unshift(rich(`{soft:up to} {power:${BUILD[e.kind].power} kW}`));
  else if (sub) more.unshift(rich(`{soft:${sub}}`));
  return { title: entName(g, e), uicon: 'power', rows, more, verbs: '{k:LMB} pin  {k:R} turn  {k:X} remove' };
}

// ------------------------------------------------------------------ the Factory floor

const gradeRole = (l: string): Role => (l === 'S+' || l === 'S' ? 'coin' : l === 'A' ? 'good' : l === 'B' ? 'research' : l === 'C' ? 'warn' : 'bad');

/** Why a module's output backs up, as rows: where its front leads and what that takes. */
function blockedRows(app: App, e: FEnt, item: ItemId): Row[] {
  const g = app.game;
  const d = g.design(e.design)!;
  const r = g.routes.find((q) => q.from === e && !q.by);
  const to = r?.to ?? null;
  if (!to) return [rich('front → {bad:nowhere} · trunk it to the Factory Dock')];
  const offered = d.outs[item] ?? 0;
  if (to.kind === 'module') {
    const td = g.design(to.design);
    const name = fname(g, to);
    const takes = td?.ins[item] ?? 0;
    if (!td || takes <= 0) {
      const wants = td ? (Object.keys(td.ins) as ItemId[]).map((k) => icon(k)).join(' ') : '';
      return [rich(`→ ${name} {bad:takes no} ${icon(item)}`), rich(wants ? `it wants ${wants} · turn this trunk` : 'a source · takes nothing')];
    }
    if (to.state === 'blocked') return [rich(`→ ${name} takes ${pm(takes)}/min · {bad:blocked itself}`)];
    if (takes < offered * 0.98) return [rich(`→ ${name} takes ${pm(takes)} of ${pm(offered)}/min`), rich(`{soft:one trunk feeds one module}`)];
    return [rich(`→ ${name} takes ${pm(takes)}/min · {warn:its store is full}`)];
  }
  if (to.kind === 'fbay') return [rich('→ the Bay takes only {i:steel} {i:drillBit}')];
  return [rich(`trunk {bad:full} · ${FACTORY.trunkSpeed * 60}/min at most`), rich('{soft:give the module its own trunk}')];
}

function factoryReport(app: App, e: FEnt): Report {
  const g = app.game;
  const rows: Row[] = [];
  const more: Row[] = [];
  const rep: Report = { title: fname(g, e), rows, more };
  if (e.kind === 'trunk') {
    const r = g.routes.find((q) => q.tiles.includes(e));
    const cap = FACTORY.trunkSpeed * 60;
    const fl = Math.round(e.flow * 60);
    rows.push(rich(`carrying ${fl}/min`));
    rows.push({ t: 'bar', frac: fl / cap, role: e.flow > FACTORY.trunkSpeed * 0.97 ? 'warn' : 'good', note: `of ${cap}/min` });
    if (r?.by) rows.push(rich('{reset:side route} · byproducts {i:slag} {i:oil}'));
    rep.verbs = '{k:R} turn  {k:X} remove';
    return rep;
  }
  if (e.kind === 'fdock') {
    rep.uicon = 'orders';
    rows.push(rich('{coin} buys what reaches it'), rich('fills the active order first'), rich('{i:slag} scrapped for nothing'));
    rep.verbs = '{k:LMB} orders';
    return rep;
  }
  if (e.kind === 'fhopper') {
    rep.uicon = 'research';
    const sel = g.s.research.selected;
    rows.push(rich(sel ? `{u:research} counts toward ${RESEARCH[sel].name}` : '{u:research} counts toward research'), rich('{i:machineKit} → the kits bank'));
    rep.verbs = '{k:LMB} inspire';
    return rep;
  }
  if (e.kind === 'fbay') {
    rep.uicon = 'mega';
    const st = megaStage(g.s.mega.stage);
    if (!st) { rows.push(rich('{good:the Great Drill runs} · Miners and sources +50%')); rep.verbs = '{k:LMB} open'; return rep; }
    rows.push(rich(`${st.name} {research:${Math.floor(megaFrac(g) * 100)}%}`));
    for (const [k, n] of Object.entries(st.wants) as [ItemId, number][]) {
      const have = Math.min(n, g.s.mega.progress[k]?.toNumber() ?? 0);
      rows.push(rich(`${icon(k)} ${pm(have)} / ${pm(n)}`));
      rows.push({ t: 'bar', frac: n > 0 ? have / n : 0, role: 'research' });
    }
    rep.verbs = '{k:LMB} the Megaproject';
    return rep;
  }
  const d = g.design(e.design);
  if (!d) return rep;
  rep.item = mainItem(d);
  rep.title = `${fname(g, e)}`;
  rows.push(rich(`{chip:${gradeRole(d.grade.letter)}:${d.grade.letter}} rates ×${d.grade.mult.toFixed(2)}${d.depth === 2 ? ` · {research:depth 2}` : ''}`));
  const p = Math.round(e.fAvg * 100);
  if (e.state === 'work') rows.push(rich(`{chip:good:WORKING} ${p}% of full speed`));
  else if (e.state === 'starved') rows.push(rich(`{chip:warn:STARVED} ${icon(e.why)} feed its back · ${p}%`));
  else if (e.state === 'blocked') {
    rows.push(rich(`{chip:bad:BLOCKED} ${icon(e.why)} backs up`));
    rows.push(...blockedRows(app, e, e.why as ItemId));
  } else rows.push(rich('{chip:soft:IDLE}'));
  if (e.spill) rows.push(rich(`{chip:warn:SPILLING} ${icon(e.spill)} its front takes not all`));
  const odOn = g.done('overdrive');
  const od = e.od ?? 0, cool = e.cool ?? 0;
  if (odOn && od > 0) rows.push(rich(`{chip:warn:OVERDRIVE ${RULES.overdriveMult.value}x ${Math.ceil(od / TICK_RATE)}s} with its feeders`));
  else if (odOn && cool > 0) rows.push(rich(`{chip:soft:COOLING ${Math.ceil(cool / TICK_RATE)}s}`));
  const outs = Object.entries(d.outs) as [ItemId, number][];
  rows.push(rich(`out ${outs.map(([k, v]) => `${icon(k)} ${pm((v ?? 0) * 60)}/min`).join('  ')}`));
  const ins = Object.entries(d.ins) as [ItemId, number][];
  if (ins.length) more.push(rich(`in ${ins.map(([k, v]) => `${icon(k)} ${pm((v ?? 0) * 60)}/min`).join('  ')} {soft:at its back}`));
  if (g.routes.some((q) => q.from === e && q.by && q.to)) more.push(rich('{reset:byproducts} → its side trunk'));
  more.push(rich(feedsDock(g, e) ? 'reaches the {good:Factory Dock}' : '{warn:does not reach the Factory Dock}'));
  if (d.depth === 2) more.push(rich(`{research:depth 2} · folded from ${(d.fparts ?? []).filter((q) => q.kind === 'module').length} modules`));
  const odReady = odOn && !od && !cool;
  rep.verbs = `{k:LMB} ${odReady ? `overdrive ${RULES.overdriveMult.value}x ${RULES.overdriveSeconds.value}s` : 'pin'}  {k:R} turn  {k:X} remove`;
  return rep;
}

/** A design's rates are per second (d.outs): the module report shows them a minute. */

// ------------------------------------------------------------------ laying out and drawing

interface Laid { rep: Report; rows: { row: Row; h: number }[]; cw: number; w: number; h: number; verbsH: number; modesH: number; /** rows left out to fit (optional ones count half) */ cut: number }

const ROW_GAP = 1;
const BAR_H = 9;
const MODES_H = 15;
const MIN_CW = 116;

function rowH(r: Row, cw: number): number {
  if (r.t === 'rich') return Math.max(layoutRich(r.s, cw).h, r.s.includes('{chip:') ? CHIP_H : 0);
  if (r.t === 'bar') return BAR_H;
  return 5;
}

/** Lay out a report no wider than maxCw (content) and no taller than maxH (outer): optional rows
 * go first, then rows are cut with a count of how many more there are. */
function lay(rep: Report, full: boolean, maxCw: number, maxH: number, closeBtn: boolean): Laid {
  let rows: Row[] = full ? [...rep.rows, ...(rep.more ?? [])] : rep.rows;
  const titleW = bigWidth(bigSafe(rep.title)) + (rep.item || rep.uicon ? 12 : 0) + (closeBtn ? 16 : 0);
  const natural = Math.max(...rows.map((r) => (r.t === 'rich' ? richWidth(r.s) : r.t === 'bar' ? 150 : 0)), rep.verbs ? richWidth(rep.verbs) : 0);
  const cw = Math.min(maxCw, Math.max(MIN_CW, titleW, natural));
  const modesH = full && rep.modes ? MODES_H + ROW_GAP : 0;
  const verbsH = rep.verbs ? layoutRich(rep.verbs, cw).h + 4 : 0;
  const measure = (rs: Row[]) => {
    const hs = rs.map((row) => ({ row, h: rowH(row, cw) }));
    const ch = BIG_LINE_H + 3 + hs.reduce((s, r) => s + r.h + ROW_GAP, 0) + modesH + verbsH;
    return { hs, outer: tagSize(cw, ch, 'left').h };
  };
  let m = measure(rows);
  let cut = 0;
  if (m.outer > maxH) { const n = rows.length; rows = rows.filter((r) => !r.opt); cut += (n - rows.length) / 2; m = measure(rows); }
  if (m.outer > maxH) {
    let keep = rows.length;
    while (keep > 1 && measure([...rows.slice(0, keep), rich('x')]).outer > maxH) keep--;
    const more = rows.length - keep;
    cut += more;
    rows = [...rows.slice(0, keep), rich(`{soft:+${more} more ${more > 1 ? 'rows' : 'row'}}`)];
    m = measure(rows);
  }
  const sz = tagSize(cw, BIG_LINE_H + 3 + m.hs.reduce((s, r) => s + r.h + ROW_GAP, 0) + modesH + verbsH, 'left');
  return { rep, rows: m.hs, cw, w: sz.w, h: sz.h, verbsH, modesH, cut };
}

/** Draw a laid-out report as a tag at (x, y): on a string to `anchor`, or pinned. */
function drawLaid(app: App, L: Laid, x: number, y: number, o: { anchor?: { x: number; y: number } | null; pin?: boolean; close?: () => void; blocking?: boolean }) {
  const ui = app.ui;
  const rep = L.rep;
  const r = tag(ui, x, y, L.w, L.h, { hole: 'left', anchor: o.pin ? null : o.anchor ?? null, pin: o.pin, blocking: o.blocking ?? !!o.pin });
  ui.big(bigSafe(rep.title), r.x + (o.pin ? 2 : 0), r.y, T.ink);
  let ix = r.x + r.w - 8 - (o.close ? 16 : 0);
  if (rep.item && rep.item in ITEMS) ui.ctx.drawImage(itemIcon(rep.item), ix, r.y + 1);
  else if (rep.uicon) uiIcon(ui, rep.uicon, ix, r.y + 1, 1);
  if (o.close && button(ui, 'closeReport', r.x + r.w - 12, r.y - 1, 12, 12, '{u:remove}', { tip: 'close {k:Esc}' })) o.close();
  rule(ui, r.x, r.y + BIG_LINE_H, r.w, true);
  let yy = r.y + BIG_LINE_H + 3;
  for (const { row, h } of L.rows) {
    if (row.t === 'rich') {
      const lay2 = layoutRich(row.s, L.cw);
      // a row that starts with a chip sits 1 px lower so the chip's top clears the row above
      drawLayout(ui, lay2, r.x, yy + (row.s.startsWith('{chip:') ? 2 : 0), T.ink);
    } else if (row.t === 'bar') {
      const nw = row.note ? richWidth(row.note) + 5 : 0;
      meter(ui, r.x, yy + 2, Math.min(110, L.cw - nw), 6, row.frac, { role: row.role, target: row.target ?? null });
      if (row.note) ui.text(row.note, r.x + Math.min(110, L.cw - nw) + 5, yy, T.inkSoft);
    } else rule(ui, r.x, yy + 2, L.cw);
    yy += h + ROW_GAP;
  }
  if (L.modesH && rep.modes) {
    const e = rep.modes;
    const bw = Math.floor((L.cw - 9) / 4);
    const fullName = MODES.every((m) => richWidth(MODE_NAME[m]) + 8 <= bw);
    MODES.forEach((m, i) => {
      const cur = (e.mode ?? 'normal') === m;
      if (button(ui, 'mode_' + m, r.x + i * (bw + 3), yy, bw, MODES_H - 1, fullName ? MODE_NAME[m] : MODE_SHORT[m], { active: cur, tip: modeTip(m, BUILD[e.kind].kw ?? 0, cur) }) && !cur) app.act({ k: 'mode', x: e.x, y: e.y, mode: m });
    });
    yy += L.modesH;
  }
  if (rep.verbs) {
    rule(ui, r.x, yy, L.cw);
    drawLayout(ui, layoutRich(rep.verbs, L.cw), r.x, yy + 3, T.ink);
  }
  return r;
}

function modeTip(m: Mode, base: number, cur: boolean) {
  const sp = m === 'efficient' ? RULES.modeEfficientSpeed.value : m === 'overclock' ? RULES.modeOverclockSpeed.value : m === 'precision' ? RULES.modePrecisionSpeed.value : 1;
  const pw = m === 'efficient' ? RULES.modeEfficientPower.value : m === 'overclock' ? RULES.modeOverclockPower.value : 1;
  const extra = m === 'precision' ? ` · +${Math.round(RULES.modePrecisionYield.value * 100)}% main output` : '';
  return [{ text: `{big:${MODE_NAME[m]}}` }, { text: `${sp}x speed · ${pw}x power · {power:${Math.round(base * pw)} kW}${extra}` }, { text: cur ? '{soft:its mode now}' : '{k:LMB} switch' }];
}

// ------------------------------------------------------------------ placing

/** HUD rects a floor tag or a report should keep off (the hud fills it each frame). */
export const zones: Rect[] = [];

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** A world rect (tiles) on screen in UI px. */
export function worldRect(app: App, x: number, y: number, w: number, h: number): Rect {
  const r = app.renderer, k = app.ui.scale;
  const a = r.toScreen(x, y), b = r.toScreen(x + w, y + h);
  return { x: Math.floor(a.x / k), y: Math.floor(a.y / k), w: Math.ceil((b.x - a.x) / k), h: Math.ceil((b.y - a.y) / k) };
}

/** A spot for a w x h tag beside `near` (right, left, above, below), on screen, over as little of
 * `near`, the HUD zones and `also` as it can. */
export function place(app: App, near: Rect, w: number, h: number, also: Rect[] = []): { x: number; y: number } {
  const ui = app.ui;
  const cy = near.y + Math.floor(near.h / 2) - Math.floor(h / 2), cx = near.x + Math.floor(near.w / 2) - Math.floor(w / 2);
  const cand = [
    { x: near.x + near.w + 8, y: cy }, { x: near.x - 8 - w, y: cy }, { x: cx, y: near.y - 8 - h }, { x: cx, y: near.y + near.h + 8 },
    { x: near.x + near.w + 8, y: near.y - h + 8 }, { x: near.x - 8 - w, y: near.y - h + 8 },
  ];
  let best = { x: cand[0].x, y: cand[0].y }, bestScore = Infinity;
  for (const c of cand) {
    const x = Math.max(3, Math.min(c.x, ui.w - w - 3)), y = Math.max(3, Math.min(c.y, ui.h - h - 3));
    const r = { x, y, w, h };
    const s = overlap(r, near) * 4 + zones.reduce((n, z) => n + overlap(r, z), 0) * 2 + also.reduce((n, z) => n + overlap(r, z), 0);
    if (s < bestScore) { bestScore = s; best = { x, y }; }
    if (s === 0) break;
  }
  return best;
}

// ------------------------------------------------------------------ the pinned and hover reports

/** The report for a Workshop entity (machines and power buildings), or null. */
export function entReport(app: App, e: Ent): Report | null {
  if (isPower(e.kind)) return powerReport(app, e);
  if (isMachine(e.kind)) return machineReport(app, e);
  return null;
}

/** The pinned report: a tag with a pushpin beside what it reports on, every row. */
export function pinnedReport(app: App, L: Layout) {
  pinTop = Infinity;
  pinRect = null;
  const g = app.game;
  const ui = app.ui;
  let rep: Report | null = null, near: Rect | null = null, close = () => {};
  if (app.floor === 'workshop' && app.selected) {
    const e = g.byId.get(app.selected);
    if (!e) { app.selected = null; return; }
    rep = entReport(app, e);
    if (!rep) { app.selected = null; return; }
    near = worldRect(app, e.x, e.y, e.w, e.h);
    close = () => { app.selected = null; };
  } else if (app.floor === 'factory' && app.fselected) {
    const e = g.fById.get(app.fselected);
    if (!e || e.kind === 'trunk') return;
    rep = factoryReport(app, e);
    near = worldRect(app, e.x, e.y, e.w, e.h);
    close = () => { app.fselected = null; };
  }
  if (!rep || !near) return;
  // docked on the right, from under the lift down to the notebook (the slips stop short of it),
  // or on the left between the Purse and the speaker's corner when it would sit on what it reports on
  const cw = L.wide ? 206 : 198;
  const rTop = L.slips.y + 18, rBot = L.notebook.y - 6;
  const lTop = app.hud.purseBottom + 6, lBot = (app.hud.cornerRect?.y ?? ui.h - 96) - 6;
  const rLaid = lay(rep, true, cw, rBot - rTop, true);
  const ry = Math.max(rTop, rBot - rLaid.h);
  const rx = ui.w - 6 - rLaid.w;
  const under = (x0: number, y0: number, w: number, h: number) => near!.x + near!.w > x0 - 8 && near!.x < x0 + w + 8 && near!.y + near!.h > y0 - 8 && near!.y < y0 + h + 8;
  let laid = rLaid, x = rx, y = ry;
  // the left when the right would sit on it, or would leave out more rows
  const lLaid = lay(rep, true, cw, lBot - lTop, true);
  const rBad = under(rx, ry, rLaid.w, rLaid.h), lBad = under(6, lTop, lLaid.w, lLaid.h);
  if ((rBad && !lBad && lLaid.cut <= rLaid.cut) || (!lBad && lLaid.cut < rLaid.cut)) { laid = lLaid; x = 6; y = lTop; }
  pinTop = x === rx ? y : Infinity;
  pinRect = { x, y, w: laid.w, h: laid.h };
  drawLaid(app, laid, x, y, { pin: true, close, blocking: true });
}

/** Where the pinned report's top is this frame (the slips stop above it), or Infinity. */
export let pinTop = Infinity;
/** The pinned report's rect this frame (a hover tag keeps off it). */
let pinRect: Rect | null = null;

/** A world tooltip's place: clear of the hovered tile and its neighbours (and the goal's tile). */
export function worldTip(app: App, x: number, y: number, w = 1, h = 1, goalTile?: { x: number; y: number } | null): TipPlace {
  const ui = app.ui;
  const avoid = [worldRect(app, x - 1, y - 1, w + 2, h + 2)];
  if (goalTile) avoid.push(worldRect(app, goalTile.x - 0.25, goalTile.y - 0.25, 1.5, 1.5));
  return { avoid, bounds: { x: 2, y: 2, w: ui.w - 4, h: ui.h - 4 } };
}

/** The hover report for a machine, power building or Factory module: a tag on a string from it,
 * the rows that matter. Drawn over everything (the tooltip layer); returns true if it drew. */
export function hoverEnt(app: App, e: Ent | null, fe: FEnt | null): boolean {
  const ui = app.ui;
  const rep = e ? entReport(app, e) : fe ? factoryReport(app, fe) : null;
  if (!rep) return false;
  const ent = (e ?? fe)!;
  const near = worldRect(app, ent.x, ent.y, ent.w, ent.h);
  const laid = lay(rep, false, 232, ui.h - 10, false);
  const p = place(app, { x: near.x - 6, y: near.y - 6, w: near.w + 12, h: near.h + 12 }, laid.w, laid.h, pinRect ? [pinRect] : []);
  const anchor = { x: near.x + Math.floor(near.w / 2), y: near.y + Math.floor(near.h / 2) };
  ui.later(() => drawLaid(app, laid, p.x, p.y, { anchor, blocking: false }));
  return true;
}

/** For other files: the report's rows as tooltip lines (rich markup), name first. */
export function reportLines(app: App, e: Ent): { text: string; color?: string }[] {
  const rep = entReport(app, e);
  if (!rep) return [];
  return [{ text: `{big:${bigSafe(rep.title)}}` }, ...[...rep.rows, ...(rep.more ?? [])].filter((r): r is Extract<Row, { t: 'rich' }> => r.t === 'rich').map((r) => ({ text: r.s }))];
}

void C; void LINE_H;
