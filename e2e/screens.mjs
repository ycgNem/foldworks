// HUD overlap audit (from Trotline's harness): the game's key states at three window sizes. For
// each shot the UI's audit (src/ui/audit.ts) lists texts that clash, overflow their panel or get
// painted over; shots with issues also get a <name>.issues.png with the problems boxed. Output:
// e2e/out/screens/ (report.md and PNGs). Needs the dev server. Usage: npm run screens
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';

const SIZES = [[1280, 720], [1920, 1080], [1024, 640]];
// each state: a function run in the page that puts the app there (frozen); it may return
// { hover: [x, y] } to put the mouse over that tile instead of the board's top edge
const STATES = {
  title: () => { const a = window.__app; a.screen = 'title'; },
  start: () => { const a = window.__app; a.newGame(7); a.freeze(); a.toasts = []; },
  build: () => { const a = window.__app; a.setMode({ k: 'build', kind: 'miner' }); return { hover: [2, 3] }; },
  report: () => {
    const a = window.__app; a.setMode({ k: 'idle' });
    const f = a.game.machines.find((m) => m.kind === 'furnace'); a.selected = f.id;
  },
  hoverReport: () => { const a = window.__app; a.selected = null; return { hover: [3, 3] }; },
  research: () => {
    const a = window.__app; const g = a.game;
    g.s.research.done = ['pressing', 'surveyEast', 'gearcutting']; g.s.research.selected = 'copperSmelting';
    a.panel = 'research';
  },
  orders: () => { const a = window.__app; a.panel = 'orders'; a.game.s.orders.active = 'boardwalk'; },
  help: () => { const a = window.__app; a.panel = 'help'; },
  toasts: () => {
    const a = window.__app; a.panel = null;
    a.toast('Research complete: Pressing', 'Unlocked the Press and iron plates.', '#93b6c9');
    a.toast('The Boardwalk: filled!', '+3,000 coin, +1 reputation. "Ribbit! The swamp thanks you."', '#86a64a');
  },
  rich: () => {
    const a = window.__app; const g = a.game; a.toasts = [];
    g.s.coin = g.s.coin.add(123456789); g.s.land = ['A', 'B', 'C', 'D']; g.s.research.done = ['pressing', 'surveyEast', 'copperSmelting', 'wireDrawing', 'gearcutting', 'splitters', 'buffers', 'gizmoTheory', 'slagBricks', 'folding'];
    g.s.upgrades.push('bellows'); g.s.income = Array(60).fill(4321);
    a.renderer.ground = null; a.fitCamera(true);
  },
  huge: () => { const a = window.__app; const g = a.game; g.s.coin = g.s.coin.constructor.parse('4.56e123'); },
};
const out = 'e2e/out/screens';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const { browser } = await launch({ gpu: process.env.GPU ?? 'hw' });
const report = [];
for (const [w, h] of SIZES) {
  const { page, errors } = await openGame(browser, { w, h });
  await page.evaluate(async () => {
    window.__app.ui.audit = true;
    window.__audit = await import('/src/ui/audit.ts');
  });
  for (const [state, fn] of Object.entries(STATES)) {
    const name = `${w}x${h}-${state}`;
    const r = await page.evaluate(fn);
    if (r?.hover) { const p = await page.evaluate(([x, y]) => window.__app.tileToCss(x, y), r.hover); await page.mouse.move(p.x, p.y); }
    else await page.mouse.move(Math.floor(w / 2), Math.floor(h / 2) + 40);
    await frames(page, 4);
    await page.screenshot({ path: `${out}/${name}.png` });
    const { issues, k } = await page.evaluate(() => {
      const ui = window.__app.ui;
      return { issues: window.__audit.findIssues(ui.lastAudit, { w: ui.w, h: ui.h }), k: ui.scale / (window.devicePixelRatio || 1) };
    });
    report.push({ name, issues });
    if (issues.length) {
      await page.evaluate(({ issues, k }) => {
        const root = document.createElement('div');
        root.id = '__auditOverlay';
        root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99';
        const col = { clash: '#ff2d55', overflow: '#ff9500', covered: '#00c7ff' };
        for (const i of issues)
          for (const [r, dashed] of [[i.rect, false], [i.otherRect, true]]) {
            if (!r) continue;
            const b = document.createElement('div');
            b.style.cssText = `position:absolute;left:${r.x * k}px;top:${r.y * k}px;width:${r.w * k}px;height:${r.h * k}px;outline:2px ${dashed ? 'dashed' : 'solid'} ${col[i.type]}`;
            root.appendChild(b);
          }
        document.body.appendChild(root);
      }, { issues, k });
      await page.screenshot({ path: `${out}/${name}.issues.png` });
      await page.evaluate(() => document.getElementById('__auditOverlay')?.remove());
    }
    console.log(`${issues.length ? '!' : ' '} ${name}${issues.length ? `  (${issues.length}: ${issues.map((i) => i.type + ' "' + i.text + '"').join('; ')})` : ''}`);
  }
  if (errors.length) report.push({ name: `${w}x${h} console`, issues: errors.map((e) => ({ type: 'console', text: e })) });
  await page.close();
}
const md = ['# HUD overlap audit', '', ...report.map((r) => `- ${r.issues.length ? '**' + r.name + '**' : r.name}: ${r.issues.length ? r.issues.map((i) => `${i.type} "${i.text}"${i.other ? ' vs ' + i.other : ''}`).join('; ') : 'clean'}`)];
fs.writeFileSync(`${out}/report.md`, md.join('\n') + '\n');
const bad = report.filter((r) => r.issues.length).length;
console.log(`\n${bad ? bad + ' shot(s) with issues' : 'all clean'}; report: ${out}/report.md`);
if (bad) process.exitCode = 1;
await browser.close();
