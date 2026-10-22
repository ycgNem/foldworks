// The sim is pure (CLAUDE.md): nothing under src/sim/, and nothing it imports, may touch the DOM,
// canvas, timers, audio or the clock. The test follows every relative import from src/sim/ and
// checks each file it reaches, so a pure-looking import of a browser module is caught too (from
// Trotline's test setup). It also checks the Num rule: no raw `number` holding coin or an item
// stock anywhere in src/sim/.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
}

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** every file reachable from `start` through relative imports (type-only imports included) */
function reach(start: string[]): string[] {
  const seen = new Set<string>();
  const todo = [...start];
  while (todo.length) {
    const f = path.normalize(todo.pop()!);
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of strip(fs.readFileSync(f, 'utf8')).matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const base = path.join(path.dirname(f), m[1]);
      const hit = [base + '.ts', path.join(base, 'index.ts'), base].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (hit) todo.push(hit);
    }
  }
  return [...seen].sort();
}

const SIM = files('src/sim');
const REACHED = reach(SIM);
const slash = (f: string) => f.split(path.sep).join('/');

describe('sim purity', () => {
  it('finds the sim files and what they import', () => {
    expect(SIM.length).toBeGreaterThanOrEqual(5);
    expect(REACHED.length).toBeGreaterThan(SIM.length);
  });
  for (const f of REACHED) {
    it(`${slash(f)} uses no browser APIs, clock or Math.random`, () => {
      // words inside string literals ('a 60 s window') are text, not API use
      const src = strip(fs.readFileSync(f, 'utf8')).replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
      expect(src).not.toMatch(/\b(window|document|requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|AudioContext|localStorage|performance|HTMLCanvasElement|CanvasRenderingContext2D|Image|Date)\b/);
      expect(src).not.toMatch(/Math\.random/);
      expect(slash(f)).not.toMatch(/src\/(render|app|ui)\//);
    });
  }
});

describe('every amount is a Num (CLAUDE.md)', () => {
  // coin and item stocks: fields named like an amount must not be typed as a plain number (or a
  // record of plain numbers); the names the review round added: count, bearings, progress, inBuf,
  // outBuf
  const NAMES = 'coin|earned|money|bank|banked|delivered|stock|stocks|amount|count|bearings|progress|inBuf|outBuf|chute';
  const AMOUNT = new RegExp(`\\b(${NAMES})\\s*\\??\\s*:\\s*(number\\b|(Partial<)?Record<[^>]*,\\s*number>)`, 'g');
  /** Fields that match a name but are not an amount that grows: each one bounded, read every tick
   * (DECISIONS.md, the Milestone 5-6 review round: Num is for amounts that grow without bound). */
  const BOUNDED: Record<string, string[]> = {
    // a machine's input buffer (2 crafts' worth, §4), a module's in and out buffers (2-6 s of its
    // rates, §11, fractional), a heap's slag (its capacity, 400) or a crate's count
    // ... and the Chute's stock (at most 20 an item, 60 with Unit 7's rep 4: DESIGN.md §21 The Chute)
    'src/sim/world.ts': ['inBuf', 'inBuf', 'outBuf', 'count', 'chute'],
    // how many machines a stopped line stopped (a tally of buildings, not of items)
    'src/sim/offline.ts': ['count', 'count'],
  };
  for (const f of SIM) {
    it(`${slash(f)} keeps amounts in Num`, () => {
      const src = strip(fs.readFileSync(f, 'utf8'));
      const found = [...src.matchAll(AMOUNT)].map((m) => m[1]).sort();
      expect(found).toEqual([...(BOUNDED[slash(f)] ?? [])].sort());
    });
  }
});
