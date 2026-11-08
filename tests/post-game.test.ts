// The playability pass's second cuts (DECISIONS.md "Playability pass (2026-11-08): cuts, Inspiration,
// the Lucky Vein, the post-game"): a Spark is only ever the Inspector, and a v14 save holding
// Inspiration, a Lucky Vein and a Challenge begun before the ending loads (save v15): the vein and
// the Inspiration record go, what Inspiration delivered stays, the Challenge runs on.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/Game';
import { N } from '../src/engine/num';
import { TICK_RATE } from '../src/engine/time';
import { savePayload, checkSave } from '../src/sim/snapshot';
import { SAVE_VERSION, migrate } from '../src/engine/save';
import { lines } from '../src/sim/analysis';
import { isMachine } from '../src/data/machines';
import { challengeRefusal, postGame } from '../src/sim/systems/challenges';
import { endStory } from './story-helpers';

/** A Miner feeding the Hand Furnace (with the Bellows): a line of two machines at work. */
function minerLine(seed = 5) {
  const g = new Game(seed);
  g.s.upgrades.push('bellows');
  g.s.coin = N(100);
  const r = g.act({ k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
  if (!r.ok) throw new Error(r.why);
  return g;
}

describe('Sparks: the Inspector, the one kind (the Lucky Vein cut)', () => {
  it('every Spark stands beside a working line, off the ore, with that line to grade', () => {
    const g = minerLine();
    const seen: { x: number; y: number }[] = [];
    for (let i = 0; i < 12 * 60 * TICK_RATE; i++) {
      g.tick();
      for (const p of g.s.sparks) {
        if (seen.some((q) => q.x === p.x && q.y === p.y)) continue;
        seen.push({ x: p.x, y: p.y });
        expect(g.oreAt(p.x, p.y)).toBeFalsy();
        expect(g.entAt(p.x, p.y)).toBeFalsy();
        const line = p.line.map((id) => g.byId.get(id)!);
        expect(line.filter((e) => e && isMachine(e.kind)).length).toBeGreaterThanOrEqual(2);
      }
    }
    // one every 3-6 min while the line works (the first by 6 min)
    expect(seen.length).toBeGreaterThanOrEqual(1);
  });

  it('none appears while no line has two machines at work', () => {
    const g = new Game(5);
    g.step(20 * 60 * TICK_RATE);
    expect(g.s.sparks.length).toBe(0);
    expect(g.s.counters.sparks ?? 0).toBe(0);
  });
});

describe('the post-game waits for the story to end (the playability pass)', () => {
  it('Challenges open with the Floating City, not with a Reorganize; once open they stay open', () => {
    const g = new Game(2);
    g.s.meta.runs = 4;
    expect(postGame(g)).toBe(false);
    expect(challengeRefusal(g, 'noSplitters')).toMatch(/after the story/);
    endStory(g);
    expect(postGame(g)).toBe(true);
    expect(challengeRefusal(g, 'noSplitters')).toBeNull();
    // the Megaprojects survive every reset, so the post-game does too
    g.s.megaPatents = 3;
    expect(g.act({ k: 'reorganize' }).ok).toBe(true);
    expect(postGame(g)).toBe(true);
  });
});

describe('save v15: a v14 save with Inspiration, a Lucky Vein and an early Challenge', () => {
  it('loads: the vein and Inspiration\'s record go, its deliveries stay, the Challenge runs on', () => {
    const g = minerLine();
    g.step(30 * TICK_RATE);
    const p = savePayload(g, 0);
    const st = JSON.parse(p.snap);
    const t0 = p.snapTick;
    // what a v14 save held: Inspiration's record and its click counter, the node it credited
    st.research.selected = 'pressing';
    st.research.progress = { pressing: { ironIngot: 'N:3' } };
    st.inspire = { pressing: { ironIngot: 'N:3' } };
    st.counters.inspiration = 1200;
    // a Lucky Vein on the iron (its glow, every boosted machine) and an Inspector beside the line
    const ore = (() => { for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if (g.oreAt(x, y) && !g.entAt(x, y) && g.owned(x, y)) return { x, y }; throw new Error('no ore'); })();
    const line = lines(g).find((l) => l.filter((e) => isMachine(e.kind)).length >= 2)!;
    const spot = (() => { for (const e of line) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const x = e.x + dx, y = e.y + dy; if (g.owned(x, y) && !g.entAt(x, y) && !g.oreAt(x, y)) return { x, y }; } throw new Error('no spot'); })();
    st.veins = { [String(g.patchOf[ore.y * g.W + ore.x])]: 900 };
    for (const e of st.ents) if (line.some((q) => q.id === e.id)) e.boost = 900;
    st.sparks = [{ kind: 'vein', x: ore.x, y: ore.y, life: 300 }, { kind: 'inspector', x: spot.x, y: spot.y, life: 300, line: line.map((e) => e.id) }];
    // the two Inspiration trophies and the Tinfoil skin, owned and worn, beside ones that stay
    st.flags.push('trophy:inspired', 'trophy:theyKnow', 'trophy:lucky');
    st.meta.cosmetics = ['tinfoil', 'mortarboard'];
    st.meta.skins = { hopper: 'tinfoil', furnace: 'ember' };
    // a Challenge taken at a Reorganize, before the ending (v14 opened them after the first reset)
    st.meta.runs = 1;
    st.challenge = 'noSplitters';
    st.challengeBase = 0;
    // logged after the snapshot: a click on the vein (it would hand-mine the ore now) and one on
    // the Inspector
    const log = [{ t: t0 + 2, c: { k: 'click', x: ore.x, y: ore.y } }, { t: t0 + 4, c: { k: 'click', x: spot.x, y: spot.y } }];
    const d = migrate({ ...p, v: 14, snap: JSON.stringify(st), log, tick: t0 + 10 });
    expect(d.v).toBe(SAVE_VERSION);
    expect(d.v).toBe(15);
    expect(d.log).toEqual([log[1]]);
    const s2 = JSON.parse(d.snap as string);
    expect(s2.inspire).toBeUndefined();
    expect(s2.veins).toBeUndefined();
    expect(s2.counters.inspiration).toBeUndefined();
    expect(s2.ents.some((e: { boost?: number }) => 'boost' in e)).toBe(false);
    expect(s2.sparks).toEqual([{ x: spot.x, y: spot.y, life: 300, line: line.map((e) => e.id) }]);
    expect(s2.flags).not.toContain('trophy:inspired');
    expect(s2.flags).not.toContain('trophy:theyKnow');
    expect(s2.flags).toContain('trophy:lucky');
    expect(s2.meta.cosmetics).toEqual(['mortarboard']);
    expect(s2.meta.skins).toEqual({ furnace: 'ember' });
    // it loads, replays the Inspector's catch, and keeps what Inspiration delivered
    const back = checkSave(d as never);
    expect(back.s.tick).toBe(t0 + 10);
    expect(back.s.sparks).toEqual([]);
    expect(back.s.counters.sparks).toBe(1);
    expect(back.s.research.progress.pressing!.ironIngot!.toNumber()).toBeGreaterThanOrEqual(3);
    // the Challenge begun before the ending runs on (never strand a run); a new one waits
    expect(back.s.challenge).toBe('noSplitters');
    back.step(5 * TICK_RATE);
    expect(back.s.challenge).toBe('noSplitters');
    expect(challengeRefusal(back, 'handsOff')).toMatch(/after the story/);
  });
});
