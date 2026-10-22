// How the e2e scripts launch a browser (from Trotline's harness). Playwright 1.48.2's bundled
// Chromium fails to start on this PC ("spawn UNKNOWN"), so every script uses the installed Chrome
// (channel 'chrome'). Canvas 2D needs no GPU flags; SwiftShader keeps pixels comparable across
// machines (GPU=hw uses the real GPU).
import { chromium } from 'playwright';

export const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5210/';

/** @param {{ gpu?: 'hw' | 'swiftshader' }} o */
export async function launch(o = {}) {
  const gpu = o.gpu ?? process.env.GPU ?? 'swiftshader';
  const args = ['--autoplay-policy=no-user-gesture-required'];
  if (gpu === 'swiftshader') args.push(...SWIFTSHADER);
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args });
  return { browser, gpu };
}

/** A page on the game at w x h, with console errors collected, waiting until the app is ready. */
export async function openGame(browser, { w = 1280, h = 720, query = '', fresh = true } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.stack ?? e.message}`));
  if (fresh) await page.addInitScript(() => { try { if (!sessionStorage.getItem('__kept')) { localStorage.clear(); sessionStorage.setItem('__kept', '1'); } } catch {} });
  await page.goto(BASE + (query ? '?' + query : ''));
  await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 30000 });
  return { page, errors };
}

/** Wait for n animation frames (so the paused loop has drawn the current state). */
export async function frames(page, n = 2) {
  await page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
}

/** Move the mouse to a tile's centre. */
export async function hoverTile(page, x, y) {
  const p = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), [x, y]);
  await page.mouse.move(p.x, p.y);
  // a floor tag comes after the mouse rests on its thing (src/app/hud.ts HOVER_DELAY) and fades in
  await page.waitForTimeout(HOVER_WAIT);
  return p;
}

/** ms to rest on a floor thing before its hover tag is up (HOVER_DELAY 0.45 s + the fade) */
export const HOVER_WAIT = 650;
