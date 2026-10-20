// Smoke test: the game boots, the title's Start button starts a run, the first clicks mine ore,
// a Miner can be bought and placed with the keyboard and mouse, the game saves, reloads and
// continues, and an export string imports. Exits 1 on any failure or console error.
// Needs the dev server. Usage: npm run smoke
import { launch, openGame, frames, hoverTile } from './launch.mjs';

const { browser } = await launch();
const { page, errors } = await openGame(browser, { w: 1280, h: 720 });
const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const st = () => page.evaluate(() => window.__app.stats());

// the title: click Start where the UI draws it
await frames(page, 4);
check((await st()).screen === 'title', 'boots to the title');
// the button by its id (the title scene places it on the water, not at a fixed spot)
const start = await page.evaluate(() => {
  const a = window.__app;
  const r = a.ui.ids.get('new');
  return a.uiToCss(r.x + r.w / 2, r.y + r.h / 2);
});
await page.mouse.click(start.x, start.y);
await frames(page, 4);
check((await st()).screen === 'play', 'Start starts a run');

// hand-mine: click the iron ore tile beside the furnace a few times
for (let i = 0; i < 6; i++) {
  await hoverTile(page, 2, 3);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
}
const clicks = await page.evaluate(() => window.__app.game.s.counters.clicks ?? 0);
check(clicks >= 3, `clicks reach the game (${clicks})`);

// let it run, then buy a Miner with the keyboard and place it
await page.evaluate(() => { window.__app.grant(100); });
await page.keyboard.press('Digit2');
await frames(page, 2);
await hoverTile(page, 1, 2);
await page.mouse.down();
await page.mouse.up();
await frames(page, 2);
const miners = await page.evaluate(() => window.__app.game.s.ents.filter((e) => e.kind === 'miner').length);
check(miners === 1, `a Miner placed with 2 + click (${miners})`);
await page.keyboard.press('Escape');
await frames(page, 2);

// open and close every screen
for (const key of ['KeyT', 'KeyO', 'Slash']) {
  await page.keyboard.press(key);
  await frames(page, 2);
  const p = (await st()).panel;
  check(!!p, `${key} opens a screen (${p})`);
  await page.keyboard.press('Escape');
  await frames(page, 2);
}

// run a minute at speed, then save, reload and continue
// (frozen, so no tick runs between the reading and the save on unload)
await page.evaluate(() => { window.__app.freeze(); window.__app.step(20 * 60); });
const before = await page.evaluate(() => ({ tick: window.__app.game.s.tick, coin: window.__app.game.s.coin.toString(), ents: window.__app.game.s.ents.length }));
check(await page.evaluate(() => window.__app.save()), 'saves to localStorage');
const exported = await page.evaluate(() => window.__app.exportSave());
check(exported.startsWith('FW1.'), 'export string looks right');
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.ready);
await frames(page, 4);
check(await page.evaluate(() => window.__app.titleInfo.hasSave), 'the title offers Continue');
const after = await page.evaluate(() => { window.__app.continueGame(); return { tick: window.__app.game.s.tick, coin: window.__app.game.s.coin.toString(), ents: window.__app.game.s.ents.length }; });
check(after.tick === before.tick && after.ents === before.ents && after.coin === before.coin, `continue restores the run (tick ${after.tick} of ${before.tick}, ${after.ents} of ${before.ents} ents, coin ${after.coin} of ${before.coin})`);
const imp = await page.evaluate((s) => { window.__app.newGame(5); const r = window.__app.importSave(s); return { ...r, tick: window.__app.game.s.tick }; }, exported);
check(imp.ok && imp.tick === before.tick, `the export string imports (tick ${imp.tick} of ${before.tick})`);
await frames(page, 6);

// the fold, through the real UI: F, drag a box over a line, wait, Fold it!, Tab, place, lay a trunk
await page.evaluate(() => {
  const a = window.__app;
  a.newGame(7);
  const g = a.game;
  a.grant(1e6);
  g.s.land = ['A', 'B', 'C', 'D'];
  g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
  g.s.upgrades.push('bellows');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
  act({ k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
  act({ k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
  act({ k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 });
  act({ k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 });
  act({ k: 'place', kind: 'belt', x: 4, y: 11, rot: 0 });
  for (let y = 11; y > 2; y--) act({ k: 'place', kind: 'belt', x: 5, y, rot: 3 });
  act({ k: 'place', kind: 'belt', x: 5, y: 2, rot: 0 });
  a.step(20 * 30);
  a.lookAt(3, 11);
});
await frames(page, 3);
await page.keyboard.press('KeyF');
await frames(page, 2);
check((await st()).mode === 'fold', 'F picks the Fold tool');
const p0 = await page.evaluate(() => window.__app.tileToCss(2, 11));
const p1 = await page.evaluate(() => window.__app.tileToCss(3, 12));
await page.mouse.move(p0.x, p0.y);
await page.mouse.down();
await frames(page, 2);
await page.mouse.move(p1.x, p1.y, { steps: 4 });
await frames(page, 2);
await page.mouse.up();
await frames(page, 2);
const box = await page.evaluate(() => window.__app.game.s.audits[0]?.box ?? null);
check(!!box && box.w === 2 && box.h === 2, `dragging a box starts an audit (${JSON.stringify(box)})`);
await page.evaluate(() => window.__app.step(20 * 71));
await frames(page, 4);
check((await st()).panel === 'grade', 'the grade card opens when the audit ends');
await page.waitForTimeout(400);
await frames(page, 2);
const foldBtn = await page.evaluate(() => {
  const a = window.__app;
  const r = a.ui.ids.get('doFold');
  return r ? a.uiToCss(r.x + r.w / 2, r.y + r.h / 2) : null;
});
if (foldBtn) await page.mouse.click(foldBtn.x, foldBtn.y);
await frames(page, 3);
const designs = await page.evaluate(() => window.__app.game.s.designs.length);
check(designs === 1, `Fold it! makes a module (${foldBtn ? 'button found' : 'button not found'})`);
await page.keyboard.press('Tab');
await frames(page, 3);
check(await page.evaluate(() => window.__app.floor === 'factory'), 'Tab goes to the Factory floor');
await page.keyboard.press('Digit2');
await frames(page, 2);
const m = await page.evaluate(() => window.__app.tileToCss(2, 2));
await page.mouse.click(m.x, m.y);
await frames(page, 2);
await page.keyboard.press('Digit1');
await frames(page, 2);
const t0 = await page.evaluate(() => window.__app.tileToCss(3, 2));
const t1 = await page.evaluate(() => window.__app.tileToCss(9, 2));
await page.mouse.move(t0.x, t0.y);
await page.mouse.down();
await page.mouse.move(t1.x, t1.y, { steps: 6 });
await frames(page, 2);
await page.mouse.up();
await frames(page, 2);
const fl = await page.evaluate(() => {
  const g = window.__app.game;
  return { modules: g.s.factory.ents.filter((e) => e.kind === 'module').length, trunks: g.s.factory.ents.filter((e) => e.kind === 'trunk').length, to: g.routes[0]?.to?.kind ?? null };
});
check(fl.modules === 1 && fl.trunks === 7 && fl.to === 'fdock', `a module and a dragged trunk reach the Factory Dock (${JSON.stringify(fl)})`);
await page.evaluate(() => window.__app.step(20 * 20));
await frames(page, 4);
await page.screenshot({ path: 'e2e/out/smoke-factory.png' });

check(errors.length === 0, `no console errors${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
await browser.close();
console.log(fails.length ? `\n${fails.length} failure(s)` : '\nsmoke: all green');
process.exit(fails.length ? 1 : 0);
