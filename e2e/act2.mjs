// Act II (Milestone 4) presentation shots on the Workshop: the store tabs, a powered line with
// Poles, wires and the reach overlay, a brownout, an unpowered machine and its report, a Mk2 ghost
// and a placed Mk2 in Overdrive with its mode buttons, the cooling arc, the Pole ghost, and the
// toasts in the left column. Each state is built through the debug handle (window.__app).
// Needs the dev server. Usage: node e2e/act2.mjs [w] [h]   -> e2e/out/act2/*.png
import fs from 'node:fs';
import { launch, openGame, frames, hoverTile } from './launch.mjs';

const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const OUT = 'e2e/out/act2';
fs.mkdirSync(OUT, { recursive: true });
const { browser } = await launch();
const { page, errors } = await openGame(browser, { w, h });

async function shot(name) {
  await frames(page, 6);
  await page.screenshot({ path: `${OUT}/${name}-${w}x${h}.png` });
  console.log(name);
}

/** A game with Act II's land and research, a power plant on chunk E and machines on it. */
await page.evaluate(() => {
  const a = window.__app;
  a.newGame(1);
  a.freeze();
  const g = a.game;
  a.grant(1e7);
  g.s.land = ['A', 'B', 'C', 'D', 'E', 'F'];
  g.s.upgrades.push('bellows');
  g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding', 'coalSeams', 'steelmaking', 'overdrive', 'steamPower', 'glassworks', 'crushing', 'concrete'];
  a.renderer.ground = null;
  g.rebuild();
  a.toasts = [];
});

// 1. the store with its new tabs: Power and Heavy unlocked and not yet opened (they blink)
await page.mouse.move(Math.floor(w / 2), Math.floor(h / 2));
await shot('01-store-tabs');
await page.evaluate(() => { window.__app.hud.buildTab = 'power'; });
await shot('02-store-power');

// 2. a powered line: a boiler steaming an engine, two linked Poles, five kilns and a mixer
await page.evaluate(() => {
  const a = window.__app;
  const g = a.game;
  const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
  act({ k: 'place', kind: 'boiler', x: 16, y: 4, rot: 0 });
  act({ k: 'place', kind: 'steamEngine', x: 17, y: 4, rot: 0 });
  act({ k: 'place', kind: 'pole', x: 18, y: 3, rot: 0 });
  act({ k: 'place', kind: 'pole', x: 22, y: 3, rot: 0 });
  for (const x of [19, 20, 21, 22, 23]) act({ k: 'place', kind: 'kiln', x, y: 1, rot: 3 });
  act({ k: 'place', kind: 'generator', x: 16, y: 6, rot: 0 });
  const boiler = g.entAt(16, 4);
  boiler.inBuf.coal = 8;
  for (const x of [19, 20, 21, 22, 23]) { act({ k: 'recipe', x, y: 1, recipe: 'fireGlass' }); g.entAt(x, 1).inBuf.sand = 4; }
  a.step(20 * 3);
  a.renderer.cam.zoom = 3;
  a.lookAt(20, 4);
});
await hoverTile(page, 18, 3);
await shot('03-power-line-pole-hover');

// 3. a brownout: a mixer joins the grid (380 kW wanted, 300 made); its kiln's report pinned
await page.evaluate(() => {
  const a = window.__app;
  const g = a.game;
  a.act({ k: 'place', kind: 'mixer', x: 23, y: 4, rot: 0 });
  a.act({ k: 'recipe', x: 23, y: 4, recipe: 'mixConcrete' });
  const m = g.entAt(23, 4);
  m.inBuf.gravel = 4; m.inBuf.sand = 2;
  for (const x of [19, 20, 21, 22, 23]) g.entAt(x, 1).inBuf.sand = 4;
  g.entAt(16, 4).inBuf.coal = 8;
  a.step(10);
  a.selected = g.entAt(21, 1).id;
});
await page.mouse.move(Math.floor(w / 2), h - 60);
await shot('04-brownout-report');

// 4. an unpowered machine: a kiln on chunk F with no Pole near, hovered
await page.evaluate(() => {
  const a = window.__app;
  const g = a.game;
  a.selected = null;
  a.act({ k: 'place', kind: 'kiln', x: 22, y: 12, rot: 0 });
  a.act({ k: 'recipe', x: 22, y: 12, recipe: 'fireGlass' });
  g.entAt(22, 12).inBuf.sand = 4;
  a.step(4);
  a.lookAt(20, 10);
});
await hoverTile(page, 22, 12);
await shot('05-unpowered-hover');

// 5. a Mk2 ghost (2x2) where it fits, and where it does not
await page.evaluate(() => {
  const a = window.__app;
  a.game.s.research.done.push('refining', 'machineKits', 'circuits', 'heavyMachines');
  a.setMode({ k: 'build', kind: 'smelterMk2' });
  a.rot = 1;
});
await hoverTile(page, 18, 10);
await shot('06-mk2-ghost-ok');
await hoverTile(page, 21, 11);
await shot('07-mk2-ghost-blocked');

// 6. the Pole ghost: its reach, and the Poles it would link to
await page.evaluate(() => { window.__app.setMode({ k: 'build', kind: 'pole' }); });
await hoverTile(page, 20, 8);
await shot('08-pole-ghost');

// 7. a placed Mk2 smelter on the grid, overdriven, with Tuning's mode buttons; a cooling Mk1
await page.evaluate(() => {
  const a = window.__app;
  const g = a.game;
  a.setMode({ k: 'idle' });
  g.s.research.done.push('tuning');
  a.act({ k: 'place', kind: 'pole', x: 18, y: 8, rot: 0 });
  a.act({ k: 'place', kind: 'smelterMk2', x: 16, y: 9, rot: 0 });
  a.act({ k: 'recipe', x: 16, y: 9, recipe: 'smeltSteel' });
  const m = g.entAt(16, 9);
  m.inBuf.ironIngot = 4; m.inBuf.coal = 4;
  a.act({ k: 'place', kind: 'smelter', x: 19, y: 10, rot: 0 });
  const s = g.entAt(19, 10);
  s.inBuf.ironOre = 2;
  g.entAt(16, 4).inBuf.coal = 8;
  a.step(4);
  a.act({ k: 'click', x: 16, y: 9 });
  s.cool = 20 * 18;
  a.step(4);
  a.selected = m.id;
  a.lookAt(19, 8);
});
await page.mouse.move(Math.floor(w / 2), h - 60);
await shot('09-mk2-overdrive-modes');
// the mode tooltip
const b = await page.evaluate(() => { const r = window.__app.ui.ids.get('mode_overclock'); const k = window.__app.uiScale / (window.devicePixelRatio || 1); return r ? { x: (r.x + r.w / 2) * k, y: (r.y + r.h / 2) * k } : null; });
if (b) { await page.mouse.move(b.x, b.y); await shot('10-mode-tooltip'); }
// hover the cooling Mk1 smelter: the Overdrive line in its report
await page.evaluate(() => { window.__app.selected = null; });
await hoverTile(page, 19, 10);
await shot('11-cooling-hover');

// 8. the toasts, now in the left column (never over the floor)
await page.evaluate(() => {
  const a = window.__app;
  a.toast('Research complete: Steam Power', 'Unlocked Boilers, Steam Engines, Generators and Poles; land chunk F; Dame Voltaire.', '#96a9c6', 'flask');
  a.toast('Codex entry!', 'Unit 7 catalogues glass: 800 coin for the first one.', '#ffcc3d', 'codex');
  a.unfreeze();
});
await page.mouse.move(Math.floor(w / 2), Math.floor(h / 2));
await page.waitForTimeout(700);
await page.evaluate(() => window.__app.freeze());
await shot('12-toasts');

// 9. events: an Overdrive burst, a Codex fountain, a kit pop, the claim flag and the Megaproject
await page.evaluate(() => {
  const a = window.__app;
  const g = a.game;
  a.toasts = [];
  a.unfreeze();
  const s = g.entAt(19, 10);
  s.cool = 0; s.od = 0;
  a.act({ k: 'click', x: 19, y: 10 });
});
await page.waitForTimeout(120);
await shot('13-overdrive-burst');
await page.evaluate(() => {
  const a = window.__app;
  a.lookAt(7, 3);
  a.game.emit({ type: 'codex', x: 6.5, y: 1.5, id: 'glass', value: 800 });
  a.game.emit({ type: 'parts', x: 7, y: 5, id: 'machineKit', value: 1 });
});
await page.waitForTimeout(350);
await shot('14-codex-kit');
await page.evaluate(() => {
  const a = window.__app;
  a.game.emit({ type: 'claim', id: 'coal', value: 4 });
  a.game.emit({ type: 'megaDone', x: 1, y: 7, value: 1, floor: 'factory' });
});
await page.waitForTimeout(900);
await shot('15-mega-claim');

// 10. the fold animation: chunk C's iron line, audited, graded and folded on the map; then the
// first module placed on the Factory floor
await page.evaluate(() => {
  const a = window.__app;
  a.newGame(1);
  a.freeze();
  const g = a.game;
  a.grant(1e6);
  g.s.land = ['A', 'B', 'C', 'D'];
  g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
  g.s.upgrades.push('bellows');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  a.renderer.ground = null;
  const act = (c) => { const r = a.act(c); if (!r.ok) throw new Error(JSON.stringify(c) + ' ' + r.why); };
  act({ k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
  act({ k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
  act({ k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 });
  act({ k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 });
  act({ k: 'place', kind: 'belt', x: 4, y: 11, rot: 0 });
  for (let y = 11; y > 2; y--) act({ k: 'place', kind: 'belt', x: 5, y, rot: 3 });
  act({ k: 'place', kind: 'belt', x: 5, y: 2, rot: 0 });
  a.step(30 * 20);
  act({ k: 'audit', x: 2, y: 11, w: 2, h: 3 });
  a.step(20 * 75);
  a.panel = null;
  a.toasts = [];
  a.renderer.cam.zoom = 3;
  a.lookAt(4, 11);
});
await page.mouse.move(Math.floor(w / 2), h - 60);
await frames(page, 10);
await page.evaluate(() => { const a = window.__app; a.act({ k: 'fold', name: null }); a.panel = null; });
await page.waitForTimeout(250);
await shot('16-fold-anim-a');
await page.waitForTimeout(450);
await shot('17-fold-anim-b');
await page.waitForTimeout(250);
await shot('18-fold-anim-fly');
await page.evaluate(() => {
  const a = window.__app;
  a.toasts = [];
  a.setFloor('factory');
  const d = a.game.s.designs[0];
  a.act({ k: 'fplace', design: d.id, x: 3, y: 3, rot: 0 });
  a.panel = null;
});
await page.waitForTimeout(250);
await shot('19-first-module');

if (errors.length) console.log(errors.join('\n'));
await browser.close();
