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
  // coin and item stocks: fields named like an amount must not be typed as a plain number
  const AMOUNT = /\b(coin|earned|money|bank|banked|delivered|stock|stocks|amount)\s*[:?]\s*number\b/;
  for (const f of SIM) {
    it(`${slash(f)} keeps amounts in Num`, () => {
      const src = strip(fs.readFileSync(f, 'utf8'));
      expect(src).not.toMatch(AMOUNT);
    });
  }
});
