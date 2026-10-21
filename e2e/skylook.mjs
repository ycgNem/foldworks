// Art check shots for the sky island (the art director's): the whole island at 1x, the south
// face, falls and underside at 2x and 3x, owned paving beside meadow, at the game's own render.
// Usage: node e2e/skylook.mjs  (needs the dev server; BASE as for e2e/screens.mjs).
// Output: e2e/out/skylook/.
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';
import { act2Setup } from './screens.mjs';

const out = 'e2e/out/skylook';
fs.mkdirSync(out, { recursive: true });
const { browser } = await launch({ gpu: process.env.GPU ?? 'hw' });
const { page } = await openGame(browser, { w: 1280, h: 720 });

/** Runs in the page: a fresh game with land A to C owned (D to F for sale), the starting line. */
async function threeLots() {
  const a = window.__app;
  a.newGame(5);
  a.freeze();
  const g = a.game;
  g.s.land = ['A', 'B', 'C'];
  g.s.flags.push('ordersSeen');
  g.rebuild();
  a.renderer.ground = null;
  a.step(20 * 5);
  a.game.events.drain();
  return [];
}

const SHOTS = [
  // [name, setup, its arg, camera tile x, y, zoom]
  ['island-1x', act2Setup, 'townAct2', 12, 12, 1],
  ['lots-1x', threeLots, null, 12, 12, 1],
  ['south-2x', act2Setup, 'townAct2', 12, 22, 2],
  ['falls-3x', act2Setup, 'townAct2', 6, 20, 3],
  ['lots-2x', threeLots, null, 8, 7, 2],
  ['northwest-3x', act2Setup, 'townAct2', 0, -2, 3],
];
for (const [name, setup, arg, x, y, z] of SHOTS) {
  const fails = await page.evaluate(setup, arg);
  if (Array.isArray(fails) && fails.length) console.log('  not placed:', fails.join('; '));
  await page.evaluate(([x, y, z]) => {
    const a = window.__app;
    a.panel = null;
    a.selected = null;
    a.setMode({ k: 'idle' });
    a.toasts = [];
    a.trophyPops = [];
    a.refusal = null;
    a.renderer.cam.zoom = z;
    a.lookAt(x, y);
    a.hud.goalKey = null;
  }, [x, y, z]);
  await page.mouse.move(2, 360);
  await frames(page, 6);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name);
}
await browser.close();
