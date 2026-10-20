// Milestone 6's save robustness in the real page (DESIGN.md §20): a save written 2 h ago comes back
// with the offline report; a damaged main save falls back to its backup with a plain-words toast.
// node e2e/saves.mjs   (needs the dev server; BASE=...). Writes e2e/out/saves/*.png.
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';

const out = 'e2e/out/saves';
fs.mkdirSync(out, { recursive: true });
const { browser } = await launch();
const { page, errors } = await openGame(browser, { w: 1280, h: 720 });
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

// a little factory, saved twice 11 min apart (so a backup is taken), then dated 2 h back
await page.evaluate(() => {
  const a = window.__app;
  a.newGame(7);
  a.grant(500);
  a.act({ k: 'upgrade', id: 'bellows' });
  a.act({ k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
  a.step(20 * 60);
  a.save();
  const real = Date.now;
  Date.now = () => real() + 11 * 60000;
  a.step(20 * 60);
  a.save();
  Date.now = real;
  // back to the title, so leaving the page does not save over the dated saves
  a.toTitle();
  for (const k of ['foldworks_save_1', 'foldworks_save_1_bak1']) {
    const d = JSON.parse(localStorage.getItem(k));
    d.saved -= 2 * 3600 * 1000;
    localStorage.setItem(k, JSON.stringify(d));
  }
});
ok(await page.evaluate(() => !!localStorage.getItem('foldworks_save_1_bak1')), 'a backup was taken');
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.ready);
await page.evaluate(() => window.__app.continueGame());
await page.waitForFunction(() => !!window.__app.offline, null, { timeout: 60000 });
await frames(page, 4);
await page.screenshot({ path: `${out}/continue-offline.png` });
const rep = await page.evaluate(() => ({ away: window.__app.offline.away, coin: window.__app.offline.coin.toNumber(), panel: window.__app.panel }));
ok(rep.away > 6400 && rep.panel === 'offline' && rep.coin > 0, `2 h away (less the 11 min the second save was dated ahead) gives the offline report (${Math.round(rep.away)} s, +${rep.coin} coin)`);

// damage the main save: the backup loads, the player is told
await page.evaluate(() => {
  const raw = localStorage.getItem('foldworks_save_1');
  window.__app.toTitle();
  localStorage.setItem('foldworks_save_1', raw.slice(0, raw.length >> 1));
});
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.ready);
await page.evaluate(() => window.__app.continueGame());
await page.waitForFunction(() => !window.__app.offlineJob, null, { timeout: 60000 });
await page.evaluate(() => { window.__app.panel = null; window.__app.offline = null; });
await frames(page, 30);
const t = await page.evaluate(() => ({ toasts: window.__app.toasts.map((x) => x.text), bad: !!window.__app.damagedSave(), screen: window.__app.screen }));
ok(t.screen === 'play' && t.bad && t.toasts.some((x) => /could not be loaded/.test(x)), 'a damaged save falls back to the backup, keeps the bad one and says so');
console.log('  ' + t.toasts.find((x) => /could not/.test(x)));
await page.evaluate(() => { window.__app.panel = null; });
await frames(page, 30);
await page.screenshot({ path: `${out}/recovered.png` });
ok(!errors.length, 'no console errors');
if (errors.length) console.log(errors.join('\n'));
await browser.close();
