// Milestone 6's save robustness in the real page (DESIGN.md §20): a save written 2 h ago comes back
// with the offline report; a damaged main save falls back to its backup with a plain-words toast.
// node e2e/saves.mjs   (needs the dev server; BASE=...). Writes e2e/out/saves/*.png.
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';
import { act5Setup } from './screens.mjs';

const out = 'e2e/out/saves';
fs.mkdirSync(out, { recursive: true });
const { browser } = await launch();
const { page, errors } = await openGame(browser, { w: 1280, h: 720 });
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

// a little factory, saved twice 11 min apart (so a backup is taken), then dated 2 h back
await page.evaluate(async () => {
  // slots are packed since Milestone 14 (FWZ1., src/engine/save.ts packSave)
  const S = await import('/src/engine/save.ts');
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
    const raw = localStorage.getItem(k);
    if (!raw.startsWith('FWZ1.')) throw new Error(`${k} is not packed`);
    const d = JSON.parse(S.unpackSave(raw));
    d.saved -= 2 * 3600 * 1000;
    localStorage.setItem(k, S.packSave(JSON.stringify(d)));
  }
});
ok(true, 'the slot and its backup are packed (FWZ1.)');
// an old slot (plain JSON, before Milestone 14) is read as it is: unpackSave passes it through
ok(await page.evaluate(async () => { const S = await import('/src/engine/save.ts'); const j = S.unpackSave(localStorage.getItem('foldworks_save_1')); return S.unpackSave(j) === j && JSON.parse(j).seed === 7; }), 'a plain JSON slot reads as it is');
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
// the toast (src/app/app.ts readSlot): "Save recovered", the problem, "the backup from 2 hours ago"
ok(t.screen === 'play' && t.bad && t.toasts.some((x) => /cut short or garbled.*backup from/.test(x)), 'a damaged save falls back to the backup, keeps the bad one and says so');
console.log('  ' + t.toasts.find((x) => /backup from/.test(x)));
await page.evaluate(() => { window.__app.panel = null; });
await frames(page, 30);
await page.screenshot({ path: `${out}/recovered.png` });

// Milestone 14: a slot written before saves were packed (plain JSON) continues as it did
await page.evaluate(async () => {
  const S = await import('/src/engine/save.ts');
  window.__app.save();
  window.__app.toTitle();
  localStorage.setItem('foldworks_save_1', S.unpackSave(localStorage.getItem('foldworks_save_1')));
});
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.ready);
await page.evaluate(() => window.__app.continueGame());
await page.waitForFunction(() => !window.__app.offlineJob, null, { timeout: 60000 });
const plain = await page.evaluate(() => ({ screen: window.__app.screen, seed: window.__app.game.s.seed, note: window.__app.loadNote }));
ok(plain.screen === 'play' && plain.seed === 7 && !plain.note, 'an old plain-JSON slot continues with no complaint');

// the size of a late save in the real page: a staged World and Beyond (e2e/screens.mjs act5Setup),
// saved; the slot against the 200 KB target (ROADMAP.md Milestone 14), and its JSON for comparison
await page.evaluate(act5Setup, 'beyond');
const size = await page.evaluate(async () => {
  const S = await import('/src/engine/save.ts');
  const { HIGH } = await import('/src/data/floors.ts');
  const a = window.__app, g = a.game;
  // then every lot and every free tile of the three high floors a module flying to the Dock or the Hopper
  for (const f of ['district', 'world', 'beyond']) {
    const st = g.s[f], H = HIGH[f];
    if (!st) continue;
    st.lots = H.lots;
    const ds = g.s.designs.filter((d) => (d.depth ?? 1) === H.depth && !Object.keys(d.ins).length);
    if (!ds.length) ds.push(...g.s.designs.filter((d) => (d.depth ?? 1) === 3).slice(0, 2).map((d) => { const c = { ...d, id: g.s.nextDesign++, depth: H.depth, ins: {}, hfloor: undefined }; g.s.designs.push(c); return c; }));
    for (const d of ds) d.spare = 999;
    for (let y = 0; y < H.h; y++) for (let x = 0; x < H.w + H.lotCols * H.lots; x++) {
      const d = ds[(x + y) % ds.length];
      if (!a.act({ k: 'hplace', floor: f, design: d.id, x, y }).ok) continue;
      const to = y < H.h / 2 ? H.dock : H.hopper;
      a.act({ k: 'route', floor: f, fx: x, fy: y, tx: to.x, ty: to.y, item: Object.keys(d.outs)[0] });
    }
  }
  a.step(20 * 60);
  a.save();
  const raw = localStorage.getItem('foldworks_save_1');
  const mods = ['district', 'world', 'beyond'].map((f) => g.s[f]?.ents.filter((e) => e.kind === 'module').length ?? 0).join(' / ');
  return { packed: raw.length, json: S.unpackSave(raw).length, exp: a.exportSave().length, mods };
});
console.log(`  staged World + Beyond, every high floor full (${size.mods} modules): slot ${(size.packed / 1024).toFixed(1)} KB packed (JSON ${(size.json / 1024).toFixed(1)} KB), export ${(size.exp / 1024).toFixed(1)} KB`);
ok(size.packed < 200 * 1024 && size.exp < 200 * 1024, 'a late save is under 200 KB');
ok(!errors.length, 'no console errors');
if (errors.length) console.log(errors.join('\n'));
await browser.close();
