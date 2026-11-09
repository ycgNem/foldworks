// The playability pass (agent "ending", DESIGN.md §18 and §21): the Great Drill's stage 1 in three
// visible parts, the Floating City's Spires reachable from the act's main chains, and the World
// opening once the City stands (the Scrap Transmuter optional).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/Game';
import { N, Num } from '../src/engine/num';
import { MEGA, MEGAS, megaStage, partsReached } from '../src/data/megaprojects';
import { RESEARCH, RESEARCH_IDS } from '../src/data/research';
import { available } from '../src/sim/systems/research';
import { megaGive } from '../src/sim/systems/modules';
import type { FEnt } from '../src/sim/world';

describe('the Great Drill\'s parts (stage 1 in four goals)', () => {
  const st = MEGA[0];
  it('has three parts, rising, each under the whole stage', () => {
    expect(st.parts?.length).toBe(3);
    const at = st.parts!.map((p) => p.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(at.every((a) => a > 0 && a < 1)).toBe(true);
  });

  it('a part stands only when every item is in to its share', () => {
    const p = st.parts![0];
    const full = (f: number) => Object.fromEntries(Object.entries(st.wants).map(([k, w]) => [k, Num.of(Math.ceil(w! * f))]));
    expect(partsReached(st, {})).toBe(0);
    expect(partsReached(st, full(p.at))).toBe(1);
    // one item short of the share: not yet
    const short = full(p.at);
    short.drillBit = Num.of(short.drillBit.toNumber() - 1);
    expect(partsReached(st, short)).toBe(0);
    expect(partsReached(st, full(1))).toBe(3);
    expect(partsReached(megaStage(1), {})).toBe(0); // stages 2 and 3 have no parts
  });

  it('the Bay emits an event as each part stands, and pays nothing more for it', () => {
    const g = new Game(3);
    const bay = { x: 0, y: 6 } as FEnt;
    g.events.drain();
    const parts: number[] = [];
    const pat0 = g.s.megaPatents;
    // deliver in steps of 10 bits and 40 steel: three parts, then the stage
    for (let i = 0; i < 80 && g.s.mega.stage === 0; i++) {
      megaGive(g, bay, 'drillBit', 10);
      megaGive(g, bay, 'steel', 40);
      for (const e of g.events.drain()) if (e.type === 'megaPart') parts.push(e.value!);
    }
    expect(parts).toEqual([1, 2, 3]);
    expect(g.s.mega.stage).toBe(1);
    // the Patents are the stage's 5 in all, as before the parts
    expect(g.s.megaPatents - pat0).toBeCloseTo(st.patents, 6);
  });
});

describe('the core ending: the Floating City', () => {
  it('the Spires want the act\'s main chains (rotors, glass, steel), no sandwiches', () => {
    const sp = MEGAS.city.stages[1];
    expect(Object.keys(sp.wants).sort()).toEqual(['glass', 'liftRotor', 'steel']);
  });

  it('Charting opens once the City stands, the Transmuter optional', () => {
    expect(RESEARCH.charting.megas).toEqual(['city']);
    const g = new Game(5);
    g.s.coin = N(1e9);
    g.s.research.done = RESEARCH_IDS.filter((r) => RESEARCH[r].act !== 4 && RESEARCH[r].act !== 5);
    g.s.mega.stage = 3;
    g.s.megas = { city: { stage: 1, progress: {} } };
    expect(available(g, 'charting')).toBe(false);
    g.s.megas.city!.stage = 2;
    expect(available(g, 'charting')).toBe(true);
  });
});
