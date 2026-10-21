// The Swamp Gazette (docs/hud-180.md "The newspaper"): flavour headlines (src/data/gazette.ts) mixed
// with headlines about the player's own factory, its jams, records, orders and research
// (DECISIONS.md: the paper reports the game, it is not only a joke reel). Folded on the floor at
// the bottom-right, today's headline on a slip beside it; it turns to the next one every ~15 s with
// a rustle; news about your factory gets a red EXTRA! corner. A click opens the Gazette's page: the
// recent headlines as a front page. Presentation only. This replaces the crawl.
import type { Game } from '../sim/Game';
import { C } from '../data/palette';
import { HEADLINES } from '../data/gazette';
import { RESEARCH } from '../data/research';
import { ORDER } from '../data/orders';
import { CHUNKS } from '../data/land';
import { itemName } from '../data/items';
import { entName } from '../sim/analysis';
import { researchFrac } from '../sim/systems/research';
import { orderFrac } from '../sim/systems/orders';
import { ellipsize, textWidth, bigWidth, smallWidth, LINE_H, BIG_LINE_H } from '../ui/font';
import { layoutRich, drawLayout } from '../ui/rich';
import { T } from '../ui/theme';
import { hasArt, sheet, frameNamed } from '../render/sprites';
import { slip, rule, ribbon, stamp } from './chrome';
import { menuTemplate } from './widgets';
import { registerScreen } from './screens';
import { bigSafe } from './tags';
import type { Layout } from './layout';
import type { App } from './app';

/** A printed headline: its words, whether it was about your factory (an EXTRA). */
export interface Headline { text: string; extra: boolean; tick: number }

/** Seconds a headline stays on the front before the paper turns. */
const TURN_S = 15;

export class Gazette {
  text = '';
  /** the headline on the front is news about the player's factory */
  extra = false;
  /** kept for old callers (the crawl's scroll offset) */
  x = 0;
  /** the front page's printed headlines, newest last */
  log: Headline[] = [];
  /** UI time the current headline went up */
  at = -100;
  private n = 0;
  private recent: string[] = [];
  /** breaking news (the town growing): printed next, ahead of everything else */
  private breaking: string[] = [];

  /** Print this headline next (it cuts in if the current one has barely started). */
  push(text: string) {
    if (!this.breaking.includes(text)) this.breaking.push(text);
    if (this.breaking.length > 4) this.breaking.shift();
  }

  /** Pick the next headline. Every third one is about the player's factory when there is news.
   *  Returns true for breaking news and the factory's own (printed as an EXTRA). */
  next(g: Game): boolean {
    this.n++;
    const b = this.breaking.shift();
    let extra = false;
    if (b) { this.text = b; extra = true; }
    else {
      const own = this.n % 3 === 0 ? this.factoryNews(g) : null;
      if (own) { this.text = own; extra = true; }
      else {
        const pool = HEADLINES.filter((h) => (!h.after || g.done(h.after)) && !this.recent.includes(h.text));
        const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)].text : HEADLINES[0].text;
        this.recent.push(pick);
        if (this.recent.length > 8) this.recent.shift();
        this.text = pick;
      }
    }
    this.extra = extra;
    this.log.push({ text: this.text, extra, tick: g.s.tick });
    if (this.log.length > 12) this.log.shift();
    return extra;
  }

  private factoryNews(g: Game): string | null {
    const s = g.s;
    const news: string[] = [];
    const jam = g.machines.find((m) => m.state === 'blocked');
    if (jam && jam.why) news.push(`TRAFFIC: ${entName(g, jam)} backed up with ${itemName(jam.why).toLowerCase()}. Commuters advised to build somewhere for it to go.`);
    const starved = g.machines.filter((m) => m.state === 'starved' && m.why && m.why !== 'crank');
    if (starved.length >= 2) news.push(`HUNGER: ${starved.length} machines report empty bellies. "${itemName(starved[0].why!)}, please," says ${entName(g, starved[0])}.`);
    const rate = g.incomePerMin();
    if (rate > 0) news.push(`MARKETS: the Workshop earns ${Math.round(rate).toLocaleString('en-US')} coin a minute. Bramble: "Ribbit."`);
    if (s.research.selected) news.push(`SCIENCE: the Hopper is ${Math.round(researchFrac(g, s.research.selected) * 100)}% of the way to ${RESEARCH[s.research.selected].name}.`);
    if (s.orders.active) news.push(`CIVIC: ${ORDER[s.orders.active].name} is ${Math.round(orderFrac(g, s.orders.active) * 100)}% done. Townsfrogs gather to watch.`);
    const forSale = CHUNKS.find((c) => !s.land.includes(c.id) && (!c.requires || g.done(c.requires)));
    if (forSale) news.push(`REAL ESTATE: ${forSale.name.replace(/\{[^}]*\}/g, '').trim()} still for sale, ${forSale.cost.toLocaleString('en-US')} coin. "A steal," says the seller, a heron.`);
    if (s.sparks.length) news.push(s.sparks[0].kind === 'inspector' ? 'ALERT: an Inspector is in the Workshop! Click them before they wander off.' : 'ALERT: a Lucky Vein glitters on an ore patch! Click it!');
    if (s.codex.length) news.push(`COLLECTING: Unit 7's Codex now holds ${s.codex.length} entries. "MORE," it says.`);
    if (s.mega.stage === 0 && s.factory.ents.some((e) => e.kind === 'fbay')) {
      const bits = Math.floor(s.mega.progress.drillBit?.toNumber() ?? 0);
      news.push(`MEGAPROJECT: ${bits} of 40 Drill Bits are at the Bay. The town packs a small bag, just in case.`);
    }
    if (s.mega.stage >= 1) news.push('THE GREAT DRILL RUNS. Every miner in the swamp digs half again as fast. The town has moved.');
    const deep = s.designs.filter((d) => d.depth === 2).length;
    if (deep) news.push(`FOLDING: ${deep} module${deep === 1 ? '' : 's'} of modules now in service. Nobody can find the inside of them.`);
    const brown = g.grids.find((gr) => gr.demand > 0 && gr.sat < 1);
    if (brown) news.push(`POWER: a grid runs at ${Math.round(brown.sat * 100)}% in a brownout. Dame Voltaire: "Build another engine, darling."`);
    const gizmos = s.delivered.gizmo?.toNumber() ?? 0;
    if (gizmos > 0) news.push(`GIZMO WATCH: ${Math.floor(gizmos).toLocaleString('en-US')} Gizmos delivered. Their purpose remains unknown.`);
    if (!news.length) return null;
    return news[this.n % news.length];
  }
}

/** A headline's kicker ("TRAFFIC" of "TRAFFIC: ..."), and the rest. */
function split(h: string): { kick: string; rest: string } {
  const m = /^([A-Z][A-Z !'.]{2,}?)[:!.]\s+(.*)$/.exec(h);
  return m ? { kick: m[1].trim(), rest: m[2] } : { kick: '', rest: h };
}

/** The folded Gazette at the bottom-right and today's headline on a slip beside it. `left` is how
 * far left the slip may reach (the speaker's corner ends there). */
export function newspaper(app: App, L: Layout, left: number) {
  const ui = app.ui;
  const g = app.game;
  const gz = app.gazette;
  const R = L.newspaper;
  if (!gz.text || ui.time - gz.at > TURN_S || (gz.at > ui.time)) {
    const had = !!gz.text;
    gz.next(g);
    gz.at = ui.time;
    if (had) app.audio.sfx('close', 0.35, 1.6);
  }
  const t = ui.time - gz.at;
  const hov = ui.hover(R.x, R.y, R.w, R.h);
  ui.mark('gazette', R.x, R.y, R.w, R.h);
  ui.region(R.x, R.y, R.w, R.h, 'button');
  // the slip with the headline, tucked under the paper
  const room = R.x + 4 - left;
  if (room > 70) {
    const sw = Math.min(room, L.wide ? 250 : 210);
    const sx = R.x + 4 - sw, sy = R.y + 7;
    const { kick, rest } = split(gz.text);
    const inner = sw - 14 - 4;
    const kw = kick ? textWidth(kick) + 5 : 0;
    const line = kick ? `{bad:${kick}} ${ellipsize(rest, inner - kw)}` : ellipsize(rest, inner);
    const k = Math.min(1, t / 0.25);
    const r = slip(ui, sx, sy + Math.round((1 - k) * 4), sw, 17, { blocking: true });
    ui.ctx.globalAlpha = k;
    drawLayout(ui, layoutRich(line), r.x, r.y);
    ui.ctx.globalAlpha = 1;
    if (ui.hover(sx, sy, sw, 17)) ui.tip([{ text: '{big:The Swamp Gazette}' }, { text: gz.text }, { text: '{k:LMB} the front page' }], 240);
    if (ui.hover(sx, sy, sw, 17) && ui.clicked) { ui.eat(); app.togglePanel('gazette'); }
  }
  // the paper: it lifts and turns as the headline changes
  if (hasArt('h180_newspaper')) {
    const s = sheet('h180_newspaper');
    const f = t < 0.12 ? frameNamed(s, 'turn') : t < 0.3 || hov ? frameNamed(s, 'lift') : frameNamed(s, 'folded');
    ui.ctx.drawImage(s.frames[f], R.x, R.y);
  } else {
    ui.ctx.fillStyle = C.ink; ui.ctx.fillRect(R.x, R.y, R.w, R.h);
    ui.ctx.fillStyle = T.paper; ui.ctx.fillRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2);
  }
  // the kicker in the headline band
  const { kick } = split(gz.text);
  if (kick && !/^EXTRA/.test(kick)) {
    const prev = ui.audit;
    ui.audit = false;
    const word = kick.split(' ')[0].slice(0, 6);
    ui.small(word, R.x + 3 + 15, R.y + 13, T.ink, { align: 'center' });
    ui.audit = prev;
  }
  if (gz.extra) {
    // EXTRA! on a red corner
    const prev = ui.audit;
    ui.audit = false;
    const ew = smallWidth('EXTRA!') + 4;
    ui.ctx.fillStyle = C.ink; ui.ctx.fillRect(R.x - 4, R.y - 3, ew + 2, 9);
    ui.ctx.fillStyle = C.red; ui.ctx.fillRect(R.x - 3, R.y - 2, ew, 7);
    ui.small('EXTRA!', R.x - 1, R.y - 1, C.bone);
    ui.audit = prev;
  }
  if (hov) {
    ui.hoverId = 'gazette';
    ui.tip([{ text: '{big:The Swamp Gazette}' }, { text: gz.text }, { text: '{k:LMB} the front page' }], 240);
    if (ui.clicked) { ui.eat(); app.togglePanel('gazette'); }
  }
}

/** The Gazette's page: the recent headlines as a front page, newest at the top. */
function gazettePage(app: App, r: { x: number; y: number; w: number; h: number }) {
  const ui = app.ui;
  const gz = app.gazette;
  const { body } = menuTemplate(app, r, { title: 'The Swamp Gazette', accent: C.copper2, icon: 'orders' });
  const items = gz.log.slice().reverse();
  if (!items.length) { ui.rich('{soft:the presses are warming up}', body.x, body.y); return; }
  // the lead story across the top, the rest in two columns
  const lead = items[0];
  const { kick, rest } = split(lead.text);
  let y = body.y;
  if (kick) { ribbon(ui, body.x, y, Math.min(body.w, bigWidth(kick) + 30), kick, { color: lead.extra ? 'red' : 'moss', tails: 'none' }); y += 19; }
  y += ui.rich(`{big:${bigSafe(rest.charAt(0).toUpperCase() + rest.slice(1))}}`, body.x, y, body.w) + 4;
  if (lead.extra) stamp(ui, 'EXTRA!', body.x + body.w - 34, body.y + 8, { angle: 0.12 });
  rule(ui, body.x, y, body.w, true);
  y += 6;
  const cols = body.w > 360 ? 2 : 1;
  const cw = Math.floor((body.w - (cols - 1) * 12) / cols);
  const top = y;
  const rest2 = items.slice(1);
  const per = Math.ceil(rest2.length / cols);
  rest2.forEach((h, i) => {
    const col = Math.floor(i / per);
    if (i % per === 0) y = top;
    const s = split(h.text);
    const body2 = s.rest.charAt(0).toUpperCase() + s.rest.slice(1);
    const line = s.kick ? `{${h.extra ? 'bad' : 'soft'}:${s.kick}} ${body2}` : body2;
    const L2 = layoutRich(line, cw);
    if (y + L2.h > body.y + body.h) return;
    const x = body.x + col * (cw + 12);
    drawLayout(ui, L2, x, y, T.ink);
    y += L2.h + 3;
    rule(ui, x, y - 2, cw);
    y += 2;
  });
  void LINE_H; void BIG_LINE_H;
}

registerScreen('gazette', (app, r) => gazettePage(app, r));
