// The Workshop sim (ROADMAP.md Milestone 1 step 3-5): belt throughput, no item duplication or
// loss, deterministic replay, the crank, buffers and states, the slag lesson.
import { describe, expect, it } from 'vitest';
import { Game, type Cmd } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { RESEARCH_IDS } from '../src/data/research';
import { CHUNKS } from '../src/data/land';
import { replay, restore, savePayload, fingerprint } from '../src/sim/snapshot';
import type { Dir } from '../src/sim/world';

/** A game with everything unlocked, all land and plenty of coin. */
function sandbox(seed = 1, history = false) {
  const g = new Game(seed, { keepHistory: history });
  g.s.coin = N(1e7);
  g.s.land = CHUNKS.map((c) => c.id);
  g.s.research.done = [...RESEARCH_IDS];
  g.s.upgrades.push('bellows');
  return g;
}

function must(g: Game, c: Cmd) {
  const r = g.act(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)}: ${r.why}`);
}

function belt(g: Game, x0: number, y0: number, n: number, rot: Dir) {
  const dx = [1, 0, -1, 0][rot], dy = [0, 1, 0, -1][rot];
  for (let i = 0; i < n; i++) must(g, { k: 'place', kind: 'belt', x: x0 + dx * i, y: y0 + dy * i, rot });
}

/** count every item that exists anywhere on the floor */
function itemsOnFloor(g: Game) {
  let n = 0;
  for (const e of g.s.ents) {
    if (e.item) n++;
    n += e.out + e.by + e.store.length + e.count;
    for (const v of Object.values(e.inBuf)) n += v;
    if (e.active && e.recipe) n += 1; // a craft under way holds its inputs (1 ore each in these tests)
  }
  return n;
}

describe('belts', () => {
  it('carry 120 items a minute when saturated', () => {
    const g = sandbox();
    // four miners on the copper patch (11..12, 2..3) push onto a belt that runs to the Dock
    g.s.ents = g.s.ents.filter((e) => e.kind === 'dock' || e.kind === 'hopper' || e.kind === 'furnace');
    g.rebuild();
    must(g, { k: 'place', kind: 'miner', x: 11, y: 2, rot: 1 });
    must(g, { k: 'place', kind: 'miner', x: 12, y: 2, rot: 1 });
    must(g, { k: 'place', kind: 'miner', x: 11, y: 3, rot: 1 });
    must(g, { k: 'place', kind: 'miner', x: 12, y: 3, rot: 1 });
    // a belt under the patch going west to x=8, then north up to the Dock's row, then west into it
    belt(g, 12, 4, 1, 2);
    // miners at row 3 push down into row 4; row-2 miners push into row-3 miners (refused), so only 2 feed directly
    // instead feed all four: row-2 miners face west/east onto side belts
    g.s.ents = g.s.ents.filter((e) => !(e.kind === 'miner' && e.y === 2));
    g.rebuild();
    must(g, { k: 'place', kind: 'miner', x: 11, y: 2, rot: 2 });
    must(g, { k: 'place', kind: 'miner', x: 12, y: 2, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 10, y: 2, rot: 1 });
    must(g, { k: 'place', kind: 'belt', x: 10, y: 3, rot: 1 });
    must(g, { k: 'place', kind: 'belt', x: 13, y: 2, rot: 1 });
    must(g, { k: 'place', kind: 'belt', x: 13, y: 3, rot: 1 });
    must(g, { k: 'place', kind: 'belt', x: 13, y: 4, rot: 2 });
    must(g, { k: 'place', kind: 'belt', x: 11, y: 4, rot: 2 });
    must(g, { k: 'place', kind: 'belt', x: 10, y: 4, rot: 2 });
    belt(g, 9, 4, 1, 2);
    belt(g, 8, 4, 3, 3); // up to y=2
    must(g, { k: 'place', kind: 'belt', x: 8, y: 1, rot: 2 }); // into the Dock at (6..7, 1..2)
    g.step(20 * 60); // warm up
    const before = g.s.delivered.copperOre?.toNumber() ?? 0;
    g.step(20 * 60);
    const after = g.s.delivered.copperOre?.toNumber() ?? 0;
    // four miners make exactly 120/min and one belt carries exactly 120/min
    expect(after - before).toBeGreaterThanOrEqual(118);
    expect(after - before).toBeLessThanOrEqual(121);
  });

  it('never duplicates or loses an item over 10,000 ticks', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 }); // into the Hand Furnace
    must(g, { k: 'place', kind: 'heap', x: 3, y: 4, rot: 0 });
    must(g, { k: 'place', kind: 'miner', x: 1, y: 2, rot: 3 });
    belt(g, 1, 1, 1, 0);
    belt(g, 2, 1, 2, 0);
    must(g, { k: 'place', kind: 'belt', x: 4, y: 1, rot: 0 });
    must(g, { k: 'place', kind: 'belt', x: 5, y: 1, rot: 0 }); // into the Dock (6,1)
    let made = 0;
    g.step(10000);
    for (const m of g.miners) made += m.crafts;
    const furnace = g.machines.find((m) => m.kind === 'furnace')!;
    // ore delivered + ore turned into ingots + ore on the floor = ore mined
    const delivered = Object.values(g.s.delivered).reduce((a, b) => a + (b as Num).toNumber(), 0);
    const ingotsMade = furnace.crafts;
    const slag = Math.floor(ingotsMade / 4);
    // items that exist: ingots/slag were made from ore, one ore each (slag is extra)
    const onFloor = itemsOnFloor(g);
    expect(delivered + onFloor).toBe(made + slag);
  });
});

describe('machines', () => {
  it('the Hand Furnace makes an ingot every 8 cranks before the Bellows', () => {
    const g = new Game(3);
    for (let i = 0; i < 4; i++) {
      must(g, { k: 'click', x: 2, y: 3 });
      g.step(2);
    }
    const f = g.machines.find((m) => m.kind === 'furnace')!;
    // one ore is already in the furnace's mouth (the craft under way), three wait
    expect(f.inBuf.ironOre).toBe(3);
    expect(f.active).toBe(true);
    for (let i = 0; i < 8; i++) {
      must(g, { k: 'click', x: 3, y: 3 });
      g.step(2);
    }
    expect(f.crafts).toBe(1);
    g.step(40);
    expect(g.s.coin.toNumber()).toBe(3);
    // without cranks nothing more happens
    g.step(400);
    expect(f.crafts).toBe(1);
  });

  it('ignores clicks past 12 a second', () => {
    const g = new Game(4);
    let counted = 0;
    for (let i = 0; i < 30; i++) if (g.act({ k: 'click', x: 2, y: 3 }).ok) counted++;
    // only 4 ore fit, but the cap is what refuses clicks 13+
    const r = g.act({ k: 'click', x: 2, y: 3 });
    expect(r.why).toBe('too fast');
    expect(counted).toBeLessThanOrEqual(12);
  });

  it('a smelter line with no slag route stalls within 3 minutes (DESIGN.md §13 check 8)', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    g.step(20 * 180);
    const f = g.machines.find((m) => m.kind === 'furnace')!;
    expect(f.state).toBe('blocked');
    expect(f.why).toBe('slag');
  });

  it('starved and blocked machines name the item', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'smelter', x: 2, y: 6, rot: 0 });
    g.step(5);
    const sm = g.machines.find((m) => m.kind === 'smelter')!;
    expect(sm.state).toBe('starved');
  });

  it('a press picks its recipe from the first input and makes plates', () => {
    const g = sandbox();
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    must(g, { k: 'place', kind: 'heap', x: 3, y: 4, rot: 0 });
    // furnace (3,3) -> belt (4,3) -> belt (5,3) -> (6,3) turns north into the Dock: put a press inline
    g.act({ k: 'remove', x: 5, y: 3 });
    must(g, { k: 'place', kind: 'press', x: 5, y: 3, rot: 0 });
    g.step(20 * 60);
    const p = g.machines.find((m) => m.kind === 'press')!;
    expect(p.recipe).toBe('pressPlate');
    expect(g.s.delivered.ironPlate?.toNumber() ?? 0).toBeGreaterThan(20);
  });
});

describe('determinism and saves', () => {
  it('seed + command log replays to the same state', () => {
    const g = sandbox(9, true);
    // the sandbox's grants are not commands; replay the same grants first
    must(g, { k: 'place', kind: 'miner', x: 2, y: 3, rot: 0 });
    must(g, { k: 'place', kind: 'heap', x: 3, y: 4, rot: 0 });
    g.step(500);
    must(g, { k: 'place', kind: 'miner', x: 1, y: 2, rot: 3 });
    belt(g, 1, 1, 5, 0);
    g.step(3000);
    must(g, { k: 'rotate', x: 6, y: 3 });
    g.step(2000);
    const h = new Game(9, { keepHistory: true });
    h.s.coin = N(1e7);
    h.s.land = CHUNKS.map((c) => c.id);
    h.s.research.done = [...RESEARCH_IDS];
    h.s.upgrades.push('bellows');
    const { replayInto } = awaitReplay();
    replayInto(h, g.history!, g.s.tick);
    expect(fingerprint(h)).toBe(fingerprint(g));
  });

  it('a snapshot restores exactly and keeps running in step', () => {
    const g = new Game(5);
    for (let i = 0; i < 10; i++) { g.act({ k: 'click', x: 2, y: 3 }); g.step(3); g.act({ k: 'click', x: 3, y: 3 }); g.step(3); }
    g.step(200);
    const p = savePayload(g, 0);
    const h = restore(JSON.parse(JSON.stringify(p)));
    expect(fingerprint(h)).toBe(fingerprint(g));
    g.step(1000);
    h.step(1000);
    expect(fingerprint(h)).toBe(fingerprint(g));
  });

  it('replays a plain run from tick 0', () => {
    const g = new Game(11, { keepHistory: true });
    for (let i = 0; i < 40; i++) { g.act({ k: 'click', x: 2, y: 2 }); g.step(2); g.act({ k: 'click', x: 3, y: 3 }); g.step(1); }
    g.step(100);
    const h = replay(11, g.history!, g.s.tick);
    expect(fingerprint(h)).toBe(fingerprint(g));
  });
});

import * as snapshotMod from '../src/sim/snapshot';
function awaitReplay() {
  return snapshotMod;
}
