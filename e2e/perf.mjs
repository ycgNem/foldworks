// Performance: the planner bot builds a full Workshop (all four chunks dense), then the game runs
// at normal speed for a few seconds while the loop's own timers are read. The budget
// (ROADMAP.md, Milestone 2) is < 4 ms of sim per frame; the renderer is reported alongside.
// Modules join the measurement when the Factory floor exists. Needs the dev server.
// Usage: npm run perf [-- minutes=50]
import { launch, openGame } from './launch.mjs';

const [minutes = '50'] = process.argv.slice(2);
const { browser, gpu } = await launch();
const { page, errors } = await openGame(browser, { w: 1920, h: 1080 });
await page.evaluate((m) => {
  const a = window.__app;
  a.newGame(1);
  a.freeze();
  a.attachBot('planner');
  a.botTicks(m * 60 * 20);
  a.game.events.drain();
  a.attachBot(null);
  // then make it dense: own all four chunks and lay a serpentine belt over every free tile,
  // every belt carrying an item (the worst case for belts and for drawing items)
  const g = a.game;
  a.grant(1e9);
  for (const id of ['B', 'C', 'D']) { g.s.research.done.push('surveyEast', 'folding'); a.act({ k: 'land', id }); }
  for (let y = 0; y < g.H; y++)
    for (let x0 = 0; x0 < g.W; x0++) {
      const x = y % 2 ? g.W - 1 - x0 : x0;
      const last = x0 === g.W - 1;
      const rot = last ? 1 : y % 2 ? 2 : 0;
      if (!g.entAt(x, y)) a.act({ k: 'place', kind: 'belt', x, y, rot });
    }
  for (const e of g.belts) e.item = 'ironOre';
  a.unfreeze();
  a.zoom(-9);
  a.fitCamera(true);
}, +minutes);
await page.waitForTimeout(1500);
const samples = [];
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(300);
  samples.push(await page.evaluate(() => {
    const a = window.__app;
    const L = a.loop;
    // one tick timed directly, so a 60 Hz frame's share of the 20 Hz sim is not averaged away
    const t0 = performance.now();
    for (let k = 0; k < 20; k++) a.game.tick();
    const per = (performance.now() - t0) / 20;
    return { tickMs: L.tickMs, frameMs: L.frameMs, fps: L.fps, perTick: per };
  }));
}
const info = await page.evaluate(() => {
  const g = window.__app.game;
  return { ents: g.s.ents.length, belts: g.belts.length, machines: g.machines.length + g.miners.length, items: g.belts.filter((e) => e.item).length };
});
const avg = (k) => samples.reduce((s, x) => s + x[k], 0) / samples.length;
const worst = (k) => Math.max(...samples.map((x) => x[k]));
const tick = avg('perTick');
// at 60 fps a frame carries a third of a tick on average and one whole tick at worst
const report = [
  `Perf (${gpu}), ${minutes} min of planner play, then every free tile belted: ${info.ents} entities, ${info.belts} belts, ${info.machines} machines and miners, ${info.items} items on belts`,
  `sim: ${tick.toFixed(3)} ms per tick (worst sample ${worst('perTick').toFixed(3)}), so <= ${tick.toFixed(3)} ms of sim in any frame: budget 4 ms ${tick < 4 ? 'PASS' : 'FAIL'}`,
  `loop timers: tick ${avg('tickMs').toFixed(3)} ms, frame (render + HUD) ${avg('frameMs').toFixed(2)} ms, ${avg('fps').toFixed(0)} fps`,
];
console.log(report.join('\n'));
if (errors.length) console.log(errors.join('\n'));
await browser.close();
process.exit(tick < 4 ? 0 : 1);
