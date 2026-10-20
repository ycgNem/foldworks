// Milestones 5 and 6 on the redesigned top bar (DESIGN.md §19, docs/ui-redesign.md): Patents beside the
// coin with the Reorganize button showing what a reset pays now, and the Blueprint Book and the
// Patent Office as menus; the overnight check. Imported for its side effects by screens.ts.
import { C } from '../data/palette';
import { ICON, textWidth } from '../ui/font';
import { previewPatents } from '../sim/reorganize';
import { button } from './chrome';
import { registerCounter, registerMenu } from './topbar';
import type { App } from './app';

/** Patents held, and a violet "Reorganize +N" key once a reset would pay. */
registerCounter({
  id: 'patents',
  show: (app) => app.game.s.meta.runs > 0 || app.game.s.designs.length > 0,
  draw: (app, x, y) => {
    const ui = app.ui;
    const g = app.game;
    let w = 0;
    if (g.s.meta.runs > 0 || g.s.meta.patents.gt(0)) {
      ui.text(ICON.star, x, y, C.violet, { shadow: C.ink });
      w += 8 + ui.text(g.s.meta.patents.format(), x + 8, y, C.bone);
      ui.hint(x - 2, 0, w + 4, 20, [{ text: 'Patents', color: C.violet }, { text: 'Kept through every Reorganize. Spend them in the Patent Office on head starts, rules and automation.' }], 190);
      w += 4;
    }
    const pv = previewPatents(g).now;
    if (pv >= 1) {
      const label = `Reorganize +${pv}`;
      const bw = textWidth(label) + 10;
      if (button(ui, 'reorganizeBar', x + w, y - 4, bw, 14, label, { active: app.panel === 'reorganize', tip: [{ text: 'Reorganize', color: C.violet }, { text: `Start a new run for ${pv} ${pv === 1 ? 'Patent' : 'Patents'}. A card says what it keeps and what it clears first.` }] })) app.togglePanel('reorganize');
      w += bw;
    }
    return w;
  },
});

registerMenu({
  id: 'blueprints', icon: 'blueprint', name: 'Blueprints', panel: 'blueprints', group: 'game',
  tip: 'The Blueprint Book: save a layout from a box, place it again as ghosts',
  show: (app) => app.game.done('folding') || app.game.s.meta.blueprints.length > 0,
  dot: (app) => !app.hud.opened.has('blueprints') && app.game.s.meta.runs > 0,
});

registerMenu({
  id: 'patents', icon: 'patents', name: 'Patents', panel: 'patents', group: 'game',
  tip: 'The Patent Office: head starts, rules, automation, offline',
  show: (app) => app.game.s.meta.runs > 0,
  dot: (app) => app.game.s.meta.patents.gte(1) && app.panel !== 'patents',
});


// Milestone 6: "safe for overnight" (src/app/overnight.ts), once a factory runs without you
registerMenu({
  id: 'overnight', icon: 'overnight', name: 'Overnight', panel: 'overnight', group: 'game',
  tip: 'Safe for overnight: see which lines would jam while you are away, and stop them first',
  show: (app) => app.game.flag('factoryOpen'),
});
