// Bot play inside the real game: a policy plays one seed headless in Chromium, the script logs
// when it reaches each milestone and saves a screenshot every few game minutes to
// e2e/out/bot/<policy>/. The pace tests run the same Bot in Vitest; this is the eyes-on version.
// Needs the dev server. Usage: npm run bot -- [policy=planner] [minutes=45] [seed=1]
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';

const [policy = 'planner', minutes = '45', seed = '1'] = process.argv.slice(2);
const OUT = `e2e/out/bot/${policy}`;
fs.mkdirSync(OUT, { recursive: true });
const { browser } = await launch();
const { page, errors } = await openGame(browser, { w: 1280, h: 720 });
await page.evaluate(([p, s]) => { const a = window.__app; a.newGame(+s); a.freeze(); a.attachBot(p); }, [policy, seed]);

const MILESTONES = {
  bellows: "g.s.upgrades.includes('bellows')",
  firstMiner: "g.s.ents.some((e) => e.kind === 'miner')",
  pressing: "g.done('pressing')",
  landB: "g.s.land.includes('B')",
  firstOrder: 'g.s.orders.done.length >= 1',
  copper: "g.done('copperSmelting')",
  gizmoTheory: "g.done('gizmoTheory')",
  firstGizmo: '(g.s.delivered.gizmo?.toNumber() ?? 0) >= 1',
  folding: "g.done('folding')",
};
const seen = {};
const shotEvery = 5 * 60 * 20;
const total = +minutes * 60 * 20;
let t = 0;
while (t < total) {
  const res = await page.evaluate(([n, ms]) => {
    const a = window.__app;
    const preds = Object.fromEntries(Object.entries(ms).map(([k, e]) => [k, new Function('g', 'return (' + e + ');')]));
    const hits = {};
    for (let i = 0; i < n; i += 20) {
      a.botTicks(20);
      for (const [k, f] of Object.entries(preds)) if (!hits[k] && f(a.game)) hits[k] = a.game.s.tick / 20;
    }
    a.game.events.drain();
    a.toasts = [];
    a.trophyPops = [];
    return { hits, tick: a.game.s.tick, coin: a.game.s.coin.format(), perMin: Math.round(a.game.incomePerMin()) };
  }, [Math.min(shotEvery, total - t), Object.fromEntries(Object.entries(MILESTONES).filter(([k]) => !(k in seen)))]);
  for (const [k, v] of Object.entries(res.hits)) seen[k] = v;
  t = res.tick;
  await frames(page, 6);
  const m = Math.round(t / 20 / 60);
  await page.screenshot({ path: `${OUT}/${String(m).padStart(3, '0')}min.png` });
  console.log(`${m} min: ${res.coin} coin, ${res.perMin}/min`);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const lines = Object.keys(MILESTONES).map((k) => `| ${k} | ${k in seen ? fmt(seen[k]) : 'not reached'} |`);
const md = `# Bot: ${policy}, seed ${seed}, ${minutes} min\n\n| milestone | time |\n|---|---|\n${lines.join('\n')}\n\n${errors.length ? '## Console\n\n' + errors.map((e) => '- ' + e).join('\n') : 'No console errors.'}\n`;
fs.writeFileSync(`${OUT}/bot.md`, md);
console.log(md);
await browser.close();
