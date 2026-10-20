// Milestone 6 measurements in the real page (DESIGN.md §20): the background tab's cost, the catch-up
// on return (no stutter), an 8 h offline run spread over frames, and the overnight forecast.
// node e2e/idle.mjs <save-string-file> [seconds hidden]
// The save string is an export (FW1.) of a bot-played Act II factory. Headless Chrome never hides
// a tab, so the script stops the frame loop and fakes document.hidden + visibilitychange, which is
// what a hidden tab does to the app; the background pump then runs on its own 1 s timer.
// Writes e2e/out/idle/*.png and prints the numbers.
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';

const [file, hiddenS = '20'] = process.argv.slice(2);
const save = fs.readFileSync(file, 'utf8').trim();
const out = 'e2e/out/idle';
fs.mkdirSync(out, { recursive: true });
const { browser } = await launch();
const { page, errors } = await openGame(browser, { w: 1280, h: 720 });
const r = await page.evaluate((s) => window.__app.importSave(s), save);
if (!r.ok) throw new Error('import: ' + r.why);
await page.evaluate(() => { window.__app.panel = null; window.__app.toasts = []; });
await frames(page, 120);
const fg = await page.evaluate(() => ({ tickMs: window.__app.loop.tickMs, frameMs: window.__app.loop.frameMs, fps: window.__app.loop.fps }));
console.log(`foreground: ${fg.tickMs.toFixed(2)} ms of ticks a frame, ${fg.frameMs.toFixed(2)} ms drawing, ${fg.fps.toFixed(0)} fps`);

// ---- hidden
const tick0 = await page.evaluate(() => {
  const a = window.__app;
  a.loop.stop();
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  return a.game.s.tick;
});
await page.waitForTimeout(+hiddenS * 1000);
const hid = await page.evaluate(() => {
  const a = window.__app;
  const st = { ...a.bg.stats, tick: a.game.s.tick, visible: a.game.s.visible, sparks: a.game.s.sparks.length };
  delete document.hidden;
  delete document.visibilityState;
  document.dispatchEvent(new Event('visibilitychange'));
  const owed = a.loop.catchUp;
  // frame gaps after the return
  window.__gaps = [];
  let last = performance.now();
  const f = (t) => { window.__gaps.push(t - last); last = t; if (window.__gaps.length < 90) requestAnimationFrame(f); };
  a.loop.start();
  requestAnimationFrame(f);
  return { ...st, owed };
});
const ran = hid.tick - tick0;
console.log(`hidden ${hiddenS} s: ${hid.pumps} pumps, ${ran} ticks run (${(ran / +hiddenS).toFixed(1)}/s; 20 wanted), ${hid.workMs.toFixed(1)} ms of work = ${(hid.workMs / (+hiddenS * 1000) * 100).toFixed(2)}% of the time, longest pump ${hid.maxPumpMs.toFixed(1)} ms; Sparks paused: visible=${hid.visible}; owed on return ${hid.owed} ticks`);
await frames(page, 95);
const gaps = await page.evaluate(() => window.__gaps.slice(1));
console.log(`after the return: 90 frames, longest ${Math.max(...gaps).toFixed(1)} ms, mean ${(gaps.reduce((s, x) => s + x, 0) / gaps.length).toFixed(1)} ms`);

// ---- an 8 h offline run, spread over frames
const t0 = Date.now();
await page.evaluate(() => {
  const a = window.__app;
  window.__gaps = [];
  let last = performance.now();
  const f = (t) => { window.__gaps.push(t - last); last = t; if (a.offlineJob) requestAnimationFrame(f); };
  a.startOffline(8 * 3600);
  requestAnimationFrame(f);
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/offline-running.png` });
await page.waitForFunction(() => !window.__app.offlineJob, null, { timeout: 120000 });
const offMs = Date.now() - t0;
const og = await page.evaluate(() => window.__gaps.slice(1));
await frames(page, 6);
await page.screenshot({ path: `${out}/offline-report.png` });
const rep = await page.evaluate(() => { const o = window.__app.offline; return { coin: o.coin.toNumber(), jams: o.jams, segs: o.segments, tl: o.timeline.length }; });
console.log(`8 h offline: ${(offMs / 1000).toFixed(1)} s with the page drawing (${og.length} frames, longest ${Math.max(...og).toFixed(1)} ms, mean ${(og.reduce((s, x) => s + x, 0) / og.length).toFixed(1)} ms); +${Math.round(rep.coin)} coin, ${rep.jams} jams, ${rep.segs} segments, ${rep.tl} timeline rows`);

// ---- the overnight forecast
const t1 = Date.now();
await page.evaluate(async () => {
  const a = window.__app;
  a.panel = 'overnight';
  const m = await import('/src/app/overnight.ts');
  window.__on = m;
  m.startForecast(a, 8);
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/overnight-running.png` });
await page.waitForFunction(() => !window.__on.overnightState().job, null, { timeout: 120000, polling: 200 });
console.log(`8 h forecast: ${((Date.now() - t1) / 1000).toFixed(1)} s with the live factory running`);
await frames(page, 6);
await page.screenshot({ path: `${out}/overnight.png` });
// stop the first line the forecast says will jam, and look again
await page.evaluate(() => {
  const a = window.__app;
  const j = window.__on.overnightState().result.timeline.find((e) => e.kind === 'jam');
  if (j) a.act({ k: 'pause', x: j.x, y: j.y, floor: j.floor === 'factory' ? 'factory' : undefined, line: true, on: true });
});
await frames(page, 6);
await page.screenshot({ path: `${out}/overnight-stopped.png` });
if (errors.length) console.log(errors.join('\n'));
await browser.close();
