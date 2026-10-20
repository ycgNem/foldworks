// Art check shots (the art director's): Bramble's Town and a busy Workshop line close up, at 1x
// and 3x zoom, so the Lantern Bayou sprites can be judged where the HUD doesn't cover them.
// Usage: node e2e/artlook.mjs  (needs the dev server; BASE as for e2e/screens.mjs).
// Output: e2e/out/artlook/.
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';
import { act2Setup, workshopSetup } from './screens.mjs';

const out = 'e2e/out/artlook';
fs.mkdirSync(out, { recursive: true });
const { browser } = await launch({ gpu: process.env.GPU ?? 'hw' });
const { page } = await openGame(browser, { w: 1280, h: 720 });
/** Runs in the page: every machine in all four facings (one row per kind, east, south, west,
 * north left to right) on chunks D and F, beside the Workshop's first line running. */
async function gallery() {
  const a = window.__app;
  const { RESEARCH_IDS } = await import('/src/data/research.ts');
  a.newGame(5);
  a.freeze();
  a.grant(1e9);
  const g = a.game;
  g.s.land = ['A', 'B', 'C', 'D', 'E', 'F'];
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  g.s.flags.push('ordersSeen', 'sliceEnd');
  g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
  g.rebuild();
  a.renderer.ground = null;
  const fails = [];
  const act = (c) => { const r = a.act(c); if (!r.ok) fails.push(`${c.kind}@${c.x},${c.y}: ${r.why}`); };
  act({ k: 'place', kind: 'miner', x: 2, y: 11, rot: 0 });
  act({ k: 'place', kind: 'smelter', x: 3, y: 11, rot: 0 });
  act({ k: 'place', kind: 'belt', x: 3, y: 12, rot: 1 });
  act({ k: 'place', kind: 'heap', x: 3, y: 13, rot: 1 });
  act({ k: 'place', kind: 'press', x: 4, y: 11, rot: 0 });
  act({ k: 'place', kind: 'belt', x: 5, y: 11, rot: 0 });
  for (let y = 11; y > 6; y--) act({ k: 'place', kind: 'belt', x: 6, y, rot: 3 });
  // miners in all four facings on the iron patch of chunk C
  for (let rot = 0; rot < 4; rot++) act({ k: 'place', kind: 'miner', x: 2 + rot, y: 9 + (rot & 1), rot });
  const ONE = ['miner', 'smelter', 'press', 'assembler', 'furnace', 'heap', 'crate', 'splitter', 'merger',
    'boiler', 'steamEngine', 'generator', 'pole', 'kiln', 'mixer', 'refinery'];
  ONE.forEach((kind, i) => {
    for (let rot = 0; rot < 4; rot++) act({ k: 'place', kind, x: 8 + (i >> 3) * 8 + rot * 2, y: 8 + (i & 7), rot });
  });
  ['smelterMk2', 'pressMk2', 'assemblerMk2'].forEach((kind, i) => {
    for (let rot = 0; rot < 4; rot++) act({ k: 'place', kind, x: 16 + rot * 2, y: 0 + i * 2 + (i ? 0 : 0), rot });
  });
  a.step(20 * 30);
  a.game.events.drain();
  a.toasts = [];
  a.trophyPops = [];
  return fails;
}

const SHOTS = [
  // [name, setup, its arg, camera tile x, y, zoom]
  ['town-1x', act2Setup, 'townAct2', 8, 1, 1],
  ['town-3x', act2Setup, 'townAct2', 8, -1, 3],
  ['townStart-3x', act2Setup, 'townStart', 8, -1, 3],
  ['line-3x', gallery, null, 5, 9, 3],
  ['facings-3x', gallery, null, 12, 12, 3],
  ['facings2-3x', gallery, null, 20, 12, 3],
  ['mk2-3x', gallery, null, 20, 3, 3],
  ['gallery-1x', gallery, null, 12, 8, 1],
  ['gallery-2x', gallery, null, 12, 8, 2],
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
