// Data validation (CLAUDE.md): every cross-reference in src/data resolves, every recipe is
// reachable from raw resources, and every numeric stat carries a derivation string naming a
// section of DESIGN.md that exists.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { ITEMS, ITEM_IDS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { BUILD, UPGRADES } from '../src/data/machines';
import { RESEARCH, RESEARCH_IDS } from '../src/data/research';
import { ORDERS, CUSTOMERS } from '../src/data/orders';
import { CHUNKS, PATCHES, WORKSHOP, FACTORY, CLAIM_PRICE } from '../src/data/land';
import { MEGA } from '../src/data/megaprojects';
import { RULES, GRADES, SCORE_WEIGHTS } from '../src/data/rules';
import { SPARKS } from '../src/data/sparks';
import { TROPHIES } from '../src/data/trophies';

const DESIGN = fs.readFileSync('DESIGN.md', 'utf8');
const SECTIONS = new Set([...DESIGN.matchAll(/^## (\d+)\./gm)].map((m) => m[1]));

/** every record with numbers, with a label for failures */
function records(): [string, { derivation?: string } & Record<string, unknown>][] {
  return [
    ...Object.values(ITEMS).map((d) => ['item ' + d.id, d] as [string, any]),
    ...RECIPES.map((d) => ['recipe ' + d.id, d] as [string, any]),
    ...Object.values(BUILD).map((d) => ['build ' + d.kind, d] as [string, any]),
    ...Object.values(UPGRADES).map((d) => ['upgrade ' + d.id, d] as [string, any]),
    ...Object.values(RESEARCH).map((d) => ['research ' + d.id, d] as [string, any]),
    ...ORDERS.map((d) => ['order ' + d.id, d] as [string, any]),
    ...Object.values(CUSTOMERS).map((d) => ['customer ' + d.id, d] as [string, any]),
    ...CHUNKS.map((d) => ['chunk ' + d.id, d] as [string, any]),
    ...PATCHES.map((d, i) => ['patch ' + i, d] as [string, any]),
    ['workshop', WORKSHOP as any],
    ['factory', FACTORY as any],
    ...Object.entries(RULES).map(([k, d]) => ['rule ' + k, d] as [string, any]),
    ...GRADES.map((d) => ['grade ' + d.letter, d] as [string, any]),
    ['score weights', SCORE_WEIGHTS as any],
    ...Object.values(SPARKS).map((d) => ['spark ' + d.kind, d] as [string, any]),
    ...TROPHIES.map((d) => ['trophy ' + d.id, d] as [string, any]),
    ...CLAIM_PRICE.map((d) => ['claim price ' + d.item, d] as [string, any]),
    ...MEGA.map((d) => ['megaproject stage ' + d.stage, d] as [string, any]),
  ];
}

describe('derivations', () => {
  it('DESIGN.md has its numbered sections', () => {
    expect(SECTIONS.size).toBeGreaterThanOrEqual(17);
  });
  for (const [name, d] of records()) {
    it(`${name} has a derivation naming a DESIGN.md section`, () => {
      expect(typeof d.derivation, name).toBe('string');
      const refs = [...(d.derivation as string).matchAll(/§(\d+)/g)].map((m) => m[1]);
      expect(refs.length, `${name}: "${d.derivation}" names no § section`).toBeGreaterThan(0);
      for (const r of refs) expect(SECTIONS.has(r), `${name}: §${r} is not a section of DESIGN.md`).toBe(true);
    });
  }
});

describe('cross-references', () => {
  const items = new Set<string>(ITEM_IDS);
  const research = new Set<string>(RESEARCH_IDS);
  it('recipes use real items and research', () => {
    for (const r of RECIPES) {
      for (const s of [...r.inputs, ...r.outputs]) expect(items.has(s.item), `${r.id}: ${s.item}`).toBe(true);
      if (r.byproduct) expect(items.has(r.byproduct.item)).toBe(true);
      if (r.unlock) expect(research.has(r.unlock), `${r.id}: ${r.unlock}`).toBe(true);
      expect(r.time).toBeGreaterThan(0);
    }
  });
  it('buildings, research, orders and land point at real things', () => {
    for (const b of Object.values(BUILD)) if (b.unlock) expect(research.has(b.unlock), b.kind).toBe(true);
    for (const d of Object.values(RESEARCH)) {
      for (const it of Object.keys(d.cost)) expect(items.has(it), `${d.id}: ${it}`).toBe(true);
      for (const q of d.requires) expect(research.has(q), `${d.id}: ${q}`).toBe(true);
    }
    for (const o of ORDERS) {
      for (const it of Object.keys(o.wants)) expect(items.has(it), `${o.id}: ${it}`).toBe(true);
      for (const q of o.requires) expect(research.has(q)).toBe(true);
      expect(CUSTOMERS[o.customer]).toBeTruthy();
    }
    for (const c of CHUNKS) if (c.requires) expect(research.has(c.requires)).toBe(true);
    for (const p of PATCHES) expect(items.has(p.item)).toBe(true);
    for (const c of CLAIM_PRICE) expect(PATCHES.some((p) => p.item === c.item), `claims for ${c.item} but no deposit`).toBe(true);
    for (const m of MEGA) for (const it of Object.keys(m.wants)) expect(items.has(it), `mega ${m.stage}: ${it}`).toBe(true);
  });
  it('the research tree has no cycles and every node can be reached', () => {
    const done = new Set<string>();
    for (let pass = 0; pass < 20; pass++)
      for (const d of Object.values(RESEARCH)) if (d.requires.every((r) => done.has(r))) done.add(d.id);
    expect([...done].sort()).toEqual([...research].sort());
  });
});

describe('reachability', () => {
  it('every recipe and item is reachable from raw resources', () => {
    // start from what the patches give, then craft anything whose inputs are all known
    const have = new Set<string>(PATCHES.map((p) => p.item));
    const crafted = new Set<string>();
    for (let pass = 0; pass < 20; pass++)
      for (const r of RECIPES) {
        if (!r.inputs.every((s) => have.has(s.item))) continue;
        if (r.machine === 'miner' && !PATCHES.some((p) => p.item === r.outputs[0].item)) continue;
        crafted.add(r.id);
        for (const s of r.outputs) have.add(s.item);
        if (r.byproduct) have.add(r.byproduct.item);
      }
    for (const r of RECIPES) expect(crafted.has(r.id), `recipe ${r.id} unreachable`).toBe(true);
    for (const i of ITEM_IDS) expect(have.has(i), `item ${i} unreachable`).toBe(true);
  });
  it('every item has a name and flavor text', () => {
    for (const d of Object.values(ITEMS)) {
      expect(d.name.length).toBeGreaterThan(1);
      expect(d.flavor.length).toBeGreaterThan(10);
    }
  });
});
