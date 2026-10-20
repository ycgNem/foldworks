// The Swamp Gazette ticker: flavour headlines (src/data/gazette.ts) mixed with headlines about the
// player's own factory, its jams, records, orders and research (DECISIONS.md: the ticker reports
// the game, it is not only a joke reel). Presentation only.
import type { Game } from '../sim/Game';
import { HEADLINES } from '../data/gazette';
import { RESEARCH } from '../data/research';
import { ORDER } from '../data/orders';
import { CHUNKS } from '../data/land';
import { itemName } from '../data/items';
import { entName } from '../sim/analysis';
import { researchFrac } from '../sim/systems/research';
import { orderFrac } from '../sim/systems/orders';

export class Gazette {
  text = '';
  /** scroll offset in UI px */
  x = 0;
  private n = 0;
  private recent: string[] = [];
  /** breaking news (the town growing): printed next, ahead of everything else */
  private breaking: string[] = [];

  /** Print this headline next (it cuts in if the current one has barely started). */
  push(text: string) {
    if (!this.breaking.includes(text)) this.breaking.push(text);
    if (this.breaking.length > 4) this.breaking.shift();
  }

  /** Pick the next headline. Every third one is about the player's factory when there is news. */
  next(g: Game) {
    this.n++;
    const b = this.breaking.shift();
    if (b) {
      this.text = b;
      return;
    }
    const own = this.n % 3 === 0 ? this.factoryNews(g) : null;
    if (own) {
      this.text = own;
      return;
    }
    const pool = HEADLINES.filter((h) => (!h.after || g.done(h.after)) && !this.recent.includes(h.text));
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)].text : HEADLINES[0].text;
    this.recent.push(pick);
    if (this.recent.length > 8) this.recent.shift();
    this.text = pick;
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
    if (forSale) news.push(`REAL ESTATE: ${forSale.name} still for sale, ${forSale.cost.toLocaleString('en-US')} coin. "A steal," says the seller, a heron.`);
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
