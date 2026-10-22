// Milestones 5 and 6 on the 180's screen (DESIGN.md §19, docs/hud-180.md): the Committee's contract
// slip under the Purse when a Reorganize would pay, and the Patent Drawer, the Patent Office and the
// overnight check as pages of the notebook. Imported for its side effects by screens.ts.
import { richWidth } from '../ui/rich';
import { T } from '../ui/theme';
import { previewPatents, runSeconds } from '../sim/reorganize';
import { unfoldKeptRefusal } from '../sim/drawer';
import { RULES } from '../data/rules';
import { TICK_RATE } from '../engine/time';
import { duration, plain } from '../engine/fmt';
import { slip } from './chrome';
import { customerPortrait } from './orders';
import { registerCounter, registerMenu } from './topbar';
import type { App } from './app';
import { perTick } from './pertick';

/** The first run's preview at which the Reorganize key appears: half the low end of a first reset
 * worth taking (DESIGN.md §16: 12-20 Patents at 4-6 h), so it shows up as the reset starts to
 * matter, not at the first fold's +1 (the UI legibility round, 2026-10-20). */
const FIRST_RUN_KEY = 6;

/** Is a reset worth a contract slip under the Purse? It must be possible (patentMin), and pay at least
 * half of what the last run banked (the first run: FIRST_RUN_KEY). The Patent Office's own
 * Reorganize... button is always there. */
function resetMeaningful(app: App, now: number): boolean {
  const m = app.game.s.meta;
  if (now < RULES.patentMin.value) return false;
  const last = m.history[m.history.length - 1];
  return now >= (last ? Math.ceil(last.patents / 2) : FIRST_RUN_KEY);
}

/** "19 in 4h 36m · 4.1 an hour" */
function perHour(patents: number, ticks: number): string {
  const sec = ticks / TICK_RATE;
  return `${patents} in ${duration(sec)}${sec >= 60 ? ` · ${plain((patents * 3600) / sec, 1)} an hour` : ''}`;
}

/** The Committee's contract slip under the Purse, once a Reorganize is worth taking: their 24x24
 * portrait and what it pays ("+19 {u:patents}"); a click opens the Reorganize page. The Patents held
 * live on the Patents page and the Reorganize page (the Purse carries coin only). */
registerCounter({
  id: 'patents',
  // asked every frame: once a tick (src/app/pertick.ts)
  show: (app) => resetMeaningful(app, perTick(app.game, 'previewPatents', () => previewPatents(app.game)).now),
  draw: (app, x, y) => {
    const ui = app.ui;
    const g = app.game;
    const pv = perTick(g, 'previewPatents', () => previewPatents(g)).now;
    const m = g.s.meta;
    const last = m.history[m.history.length - 1];
    const s = `{reset:+${pv}} {u:patents}`;
    const w = 24 + 6 + richWidth(s) + 14;
    const hov = ui.hover(x, y, w, 26);
    ui.mark('reorganizeBar', x, y, w, 26);
    const r = slip(ui, x, y, w, 26, { blocking: true });
    ui.region(x, y, w, 26, 'button');
    customerPortrait(app, 'committee', r.x - 2, y + 1, 24, hov);
    ui.rich(s, r.x + 26, y + 9, Infinity, T.ink);
    if (app.panel === 'reorganize' || hov) { ui.ctx.fillStyle = T.reset; ui.ctx.fillRect(r.x + 26, y + 20, w - 38, 1); }
    if (hov) {
      ui.hoverId = 'reorganizeBar';
      ui.tip([
        { text: '{big:Reorganize}' },
        { text: '"psst." "a fresh start." "for patents."' },
        { text: `this run {reset:${perHour(pv, runSeconds(g) * TICK_RATE)}}` },
        ...(last ? [{ text: `last run {soft:${perHour(last.patents, last.ticks)}}` }] : []),
        { text: '{k:LMB} read the contract' },
      ], 200);
      if (ui.clicked) {
        ui.eat();
        ui.sfx('click');
        app.togglePanel('reorganize');
      }
    }
    return w;
  },
});

registerMenu({
  id: 'drawer', icon: 'blueprint', name: 'Drawer', panel: 'drawer', group: 'game',
  tip: '{u:blueprint} designs kept through every Reorganize',
  show: (app) => app.game.s.designs.length > 0 || app.game.s.meta.drawer.length > 0,
  // a dot until first opened in a later run, and while a kept design is ready to unfold
  dot: (app) => (!app.hud.opened.has('drawer') && app.game.s.meta.runs > 0) || (app.panel !== 'drawer' && app.game.s.meta.runs > 0 && app.game.s.meta.drawer.some((k) => !(app.game.s.drafted ?? []).includes(k.id) && !unfoldKeptRefusal(app.game, k))),
});

registerMenu({
  id: 'patents', icon: 'patents', name: 'Patents', panel: 'patents', group: 'game',
  tip: '{u:patents} head starts · rules · automation · offline',
  show: (app) => app.game.s.meta.runs > 0,
  dot: (app) => app.game.s.meta.patents.gte(1) && app.panel !== 'patents',
});


// Milestone 6: "safe for overnight" (src/app/overnight.ts), once a factory runs without you
registerMenu({
  id: 'overnight', icon: 'overnight', name: 'Overnight', panel: 'overnight', group: 'game',
  tip: '{u:overnight} which lines would jam while you are away',
  show: (app) => app.game.flag('factoryOpen'),
});
