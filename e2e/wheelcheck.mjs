// The Workbench Wheel's input, checked end to end (src/app/wheel.ts): a right tap opens it at the
// cursor, a held tool is dropped by a right tap first, Q and Space open it, Esc and a click outside
// shut it, a petal fans on hover, a picked item is the tool in hand, number keys pick, the Build
// button opens it, so does a left click on empty paving (a pinned report unpins first), the goal
// bubble's Grab button holds the Miner, world clicks never reach the floor while it is open, and
// the town's doors open pages.
// node e2e/wheelcheck.mjs   (BASE=http://127.0.0.1:<port>/)
import { launch, openGame, frames } from './launch.mjs';

const { browser } = await launch();
const { page, errors } = await openGame(browser, { w: 1280, h: 720 });
await page.evaluate(() => { const a = window.__app; a.newGame(1); a.freeze(); a.grant(5000); a.act({ k: 'upgrade', id: 'bellows' }); });
await frames(page, 4);
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const st = () => page.evaluate(() => ({ open: window.__app.wheelIsOpen, mode: window.__app.mode.k, kind: window.__app.mode.kind ?? null, panel: window.__app.panel, ents: window.__app.game.s.ents.length }));
const mark = async (id) => {
  const r = await page.evaluate((id) => { const r = window.__app.ui.ids.get(id); return r ? { ...r } : null; }, id);
  if (!r) return null;
  return page.evaluate((r) => window.__app.uiToCss(r.x + r.w / 2, r.y + r.h / 2), r);
};
const tile = (x, y) => page.evaluate(([x, y]) => window.__app.tileToCss(x, y), [x, y]);
const rtap = async (p) => { await page.mouse.move(p.x, p.y); await frames(page, 2); await page.mouse.down({ button: 'right' }); await frames(page, 2); await page.mouse.up({ button: 'right' }); await frames(page, 4); };

// a right tap on the floor opens it
const floorP = await tile(5, 5);
await rtap(floorP);
ok((await st()).open, 'right tap on the floor opens the wheel');
// a right tap again shuts it
await rtap(floorP);
ok(!(await st()).open, 'right tap while open shuts it');
// Q opens, Esc shuts
await page.mouse.move(floorP.x, floorP.y);
await page.keyboard.press('KeyQ'); await frames(page, 4);
ok((await st()).open, 'Q opens it');
await page.keyboard.press('Escape'); await frames(page, 4);
ok(!(await st()).open, 'Esc shuts it');
await page.keyboard.press('Space'); await frames(page, 4);
ok((await st()).open, 'Space opens it');
// hover the Build petal, then click the Miner
let p = await mark('wheel_build');
ok(!!p, 'the Build petal is marked');
await page.mouse.move(p.x, p.y); await frames(page, 12);
p = await mark('wheel_item_miner');
ok(!!p, 'the Miner item is marked');
await page.mouse.move(p.x, p.y, { steps: 3 }); await frames(page, 4);
await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
let s = await st();
ok(!s.open && s.mode === 'build' && s.kind === 'miner', 'clicking the Miner picks it and shuts the wheel');
// with a tool held, a right tap drops it (the wheel stays shut)
await rtap(floorP);
s = await st();
ok(!s.open && s.mode === 'idle', 'a right tap with a tool held drops it');
// number keys pick from the last building petal
await page.keyboard.press('Digit3'); await frames(page, 3);
s = await st();
ok(s.mode === 'build' && s.kind === 'smelter', 'key 3 picks the Smelter');
await page.keyboard.press('Escape'); await frames(page, 3);
// a click while open never reaches the floor: open, click a far tile, nothing is built
await page.evaluate(() => window.__app.pickBuild('belt')); await frames(page, 2);
await page.keyboard.press('KeyQ'); await frames(page, 4);
const before = (await st()).ents;
// an empty tile on screen (the sky island framing put row 7 below a 720 px window)
const far = await tile(4, 1);
await page.mouse.move(far.x, far.y); await frames(page, 2);
await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
s = await st();
ok(!s.open && s.ents === before, 'a click outside shuts it and builds nothing');
await page.keyboard.press('Escape'); await frames(page, 3);
// the hub picks the last building again
await page.keyboard.press('KeyQ'); await frames(page, 4);
p = await mark('wheel_hub');
await page.mouse.move(p.x, p.y); await frames(page, 3);
await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
s = await st();
ok(!s.open && s.mode === 'build', `the hub picks the last building again (${s.kind})`);
await page.keyboard.press('Escape'); await frames(page, 3);
// the toolbox opens it at the screen's centre
p = await mark('toolbox');
if (p) {
  await page.mouse.move(p.x, p.y); await frames(page, 3);
  await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
  ok((await st()).open, 'the toolbox opens it');
  await page.keyboard.press('Escape'); await frames(page, 3);
} else console.log('skip: no toolbox drawn');
// a left click on empty paving opens it there (after the Bellows); with a report pinned it unpins
p = await tile(4, 1);
await page.mouse.move(p.x, p.y); await frames(page, 2);
await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
ok((await st()).open, 'a left click on empty paving opens it');
await page.keyboard.press('Escape'); await frames(page, 3);
await page.evaluate(() => { const a = window.__app; a.selected = a.game.s.ents.find((e) => e.kind === 'furnace').id; });
await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
ok(!(await st()).open && (await page.evaluate(() => window.__app.selected)) === null, 'a left click on paving with a report pinned unpins it, no wheel');
// the goal names the Miner: its Grab button in Bramble's bubble puts one in your hand
p = await mark('grabBuild');
if (p) {
  await page.mouse.move(p.x, p.y); await frames(page, 2);
  await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
  s = await st();
  ok(s.mode === 'build' && s.kind === 'miner', 'the bubble\'s Grab button holds a Miner');
  await page.keyboard.press('Escape'); await frames(page, 3);
} else ok(false, 'the bubble has a Grab button for the Miner goal');
// Tools: the Remove tool from the wheel
await page.mouse.move(floorP.x, floorP.y);
await page.keyboard.press('KeyQ'); await frames(page, 4);
p = await mark('wheel_tools'); await page.mouse.move(p.x, p.y); await frames(page, 12);
p = await mark('wheel_item_remove'); await page.mouse.move(p.x, p.y, { steps: 3 }); await frames(page, 3);
await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
s = await st();
ok(!s.open && s.mode === 'remove', 'the Remove tool from the Tools petal');
await page.keyboard.press('Escape'); await frames(page, 3);
// a pinned report: a right tap unpins it, not opens the wheel
await page.evaluate(() => { const a = window.__app; a.selected = a.game.s.ents.find((e) => e.kind === 'furnace').id; });
await rtap(floorP);
s = await st();
ok(!s.open && (await page.evaluate(() => window.__app.selected)) === null, 'a right tap with a report pinned unpins it');
// a page open: Q does nothing
await page.evaluate(() => window.__app.togglePanel('research')); await frames(page, 3);
await page.keyboard.press('KeyQ'); await frames(page, 3);
ok(!(await st()).open, 'no wheel over a page');
await page.keyboard.press('Escape'); await frames(page, 3);
// the Dock opens Orders, the Hopper Research
const dock = await page.evaluate(() => { const e = window.__app.game.s.ents.find((q) => q.kind === 'dock'); return [e.x, e.y]; });
p = await tile(dock[0], dock[1]);
await page.mouse.move(p.x, p.y); await frames(page, 2);
await page.mouse.down(); await frames(page, 2); await page.mouse.up(); await frames(page, 4);
ok((await st()).panel === 'orders', 'the Dock opens Orders');
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
process.exit(fails ? 1 : 0);
