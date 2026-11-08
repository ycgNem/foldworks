// The playability review (2026-11-08): the bugs it found, each pinned by a test.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/Game';
import { BUILD, type BuildKind } from '../src/data/machines';
import { RECIPE } from '../src/data/recipes';
import { decodeDesign, encodeDesign, KINDS, RECIPES_BY_CODE } from '../src/sim/drawer';

describe('design share strings (FWD1) carry every building and recipe', () => {
  it('every buildable kind has a code, and the codes fit beside the turn bits', () => {
    const buildable = (Object.keys(BUILD) as (keyof typeof BUILD)[]).filter((k) => !['furnace', 'dock', 'hopper', 'seed'].includes(k)) as BuildKind[];
    for (const k of buildable) expect(KINDS, k).toContain(k);
    // a cell is kind + 1 + 32 x turn, and 127 marks a covered tile: kind + 1 must stay under 31
    expect(KINDS.length).toBeLessThan(31);
  });

  it('every crafting recipe has a code', () => {
    for (const id of Object.keys(RECIPE)) if (!id.startsWith('mine')) expect(RECIPES_BY_CODE, id).toContain(id);
    expect(new Set(RECIPES_BY_CODE).size).toBe(RECIPES_BY_CODE.length);
    expect(RECIPES_BY_CODE.length).toBeLessThan(255);
  });

  it('an Act III line (Chem Vat, Greenhouse, Assembler Mk2) round-trips', () => {
    const k = {
      name: 'Sandwich line', x: 2, y: 3, w: 6, h: 4,
      parts: [
        { kind: 'chemVat' as BuildKind, dx: 0, dy: 0, rot: 0 as const, recipe: 'mixSolvent' as const },
        { kind: 'greenhouse' as BuildKind, dx: 2, dy: 0, rot: 1 as const, recipe: 'growProduce' as const },
        { kind: 'assemblerMk2' as BuildKind, dx: 4, dy: 2, rot: 2 as const, recipe: 'makeSandwich' as const },
        { kind: 'belt' as BuildKind, dx: 0, dy: 3, rot: 0 as const },
      ],
    };
    const d = decodeDesign(encodeDesign(k as never));
    expect(d.w).toBe(6);
    expect(d.parts.map((p) => [p.kind, p.dx, p.dy, p.rot, p.recipe ?? null])).toEqual(k.parts.map((p) => [p.kind, p.dx, p.dy, p.rot, p.recipe ?? null]));
  });
});

describe('a free crate refunds nothing', () => {
  it('placing and lifting a reputation crate gives no coin', () => {
    const g = new Game(7);
    (g.s.research.done as string[]).push('buffers');
    g.s.freeCrates = 2;
    // a tile the starting Workshop leaves empty and owned
    let spot: { x: number; y: number } | null = null;
    for (let y = 0; y < g.H && !spot; y++) for (let x = 0; x < g.W && !spot; x++) if (g.owned(x, y) && !g.entAt(x, y) && g.act({ k: 'place', kind: 'crate', x, y, rot: 0 }).ok) spot = { x, y };
    expect(spot).not.toBeNull();
    const before = g.s.coin.toNumber();
    expect(g.act({ k: 'remove', x: spot!.x, y: spot!.y }).ok).toBe(true);
    expect(g.s.coin.toNumber()).toBe(before);
  });
});
