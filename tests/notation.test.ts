// Notation settings and the number-readability helper (DESIGN.md §20; ROADMAP.md Milestone 6):
// standard, scientific, engineering and letters, each at its boundaries, the display setting, and
// the one helper every rate, kW, share and duration goes through.
import { afterEach, describe, expect, it } from 'vitest';
import { N, Num, letterSuffix, setNotation, getNotation, NOTATIONS } from '../src/engine/num';
import { amount, plain, perMin, kw, pct, mult, duration, clock } from '../src/engine/fmt';

afterEach(() => setNotation('standard'));

const f = (x: number | string, notation: (typeof NOTATIONS)[number]) => (typeof x === 'number' ? N(x) : Num.parse(x)).format({ notation });

describe('notations', () => {
  it('all write the same plain whole numbers below 10,000', () => {
    for (const n of NOTATIONS) {
      expect(f(0, n)).toBe('0');
      expect(f(999, n)).toBe('999');
      expect(f(9999, n)).toBe('9,999');
      expect(f(9999.9, n)).toBe('9,999');
    }
  });

  it('standard: suffixes from 10,000, scientific past 1e36', () => {
    expect(f(10000, 'standard')).toBe('10.0K');
    expect(f(999999, 'standard')).toBe('999K');
    expect(f(1e6, 'standard')).toBe('1.00M');
    expect(f('9.99e35', 'standard')).toBe('999Dc');
    expect(f('1e36', 'standard')).toBe('1.00e36');
  });

  it('scientific: a mantissa and an exponent from 10,000', () => {
    expect(f(10000, 'scientific')).toBe('1.00e4');
    expect(f(123456, 'scientific')).toBe('1.23e5');
    expect(f('4.567e123', 'scientific')).toBe('4.56e123');
    expect(f('1e1000000', 'scientific')).toBe('1.00e1000000');
  });

  it('engineering: the exponent a multiple of 3', () => {
    expect(f(10000, 'engineering')).toBe('10.0e3');
    expect(f(123456, 'engineering')).toBe('123e3');
    expect(f(1e6, 'engineering')).toBe('1.00e6');
    expect(f('4.567e124', 'engineering')).toBe('45.6e123');
    expect(f('9.999e35', 'engineering')).toBe('999e33');
  });

  it('letters: the named suffixes, then aa, ab ... zz, aaa past 1e36', () => {
    expect(f(12345, 'letters')).toBe('12.3K');
    expect(f('9.99e35', 'letters')).toBe('999Dc');
    expect(f('1e36', 'letters')).toBe('1.00aa');
    expect(f('2.5e39', 'letters')).toBe('2.50ab');
    expect(f('1e114', 'letters')).toBe('1.00ba');
    // tier 12 + 675 = zz, then aaa
    expect(f(`1e${(12 + 675) * 3}`, 'letters')).toBe('1.00zz');
    expect(f(`1e${(12 + 676) * 3}`, 'letters')).toBe('1.00aaa');
    expect(letterSuffix(0)).toBe('aa');
    expect(letterSuffix(25)).toBe('az');
    expect(letterSuffix(26)).toBe('ba');
    expect(letterSuffix(675)).toBe('zz');
    expect(letterSuffix(676)).toBe('aaa');
    expect(letterSuffix(676 + 26 * 26 * 26 - 1)).toBe('zzz');
    expect(letterSuffix(676 + 26 * 26 * 26)).toBe('aaaa');
  });

  it('floors in every notation (the display never shows more than you have)', () => {
    expect(f(19999, 'standard')).toBe('19.9K');
    expect(f(19999, 'scientific')).toBe('1.99e4');
    expect(f(19999, 'engineering')).toBe('19.9e3');
    expect(f('1.9999e37', 'letters')).toBe('19.9aa');
  });

  it('negative numbers keep their sign', () => {
    for (const n of NOTATIONS) expect(f(-12345, n).startsWith('-')).toBe(true);
  });

  it('the display setting is what format() uses when the caller names none', () => {
    expect(getNotation()).toBe('standard');
    expect(N(123456).format()).toBe('123K');
    setNotation('scientific');
    expect(N(123456).format()).toBe('1.23e5');
    setNotation('engineering');
    expect(N(123456).format()).toBe('123e3');
    setNotation('letters');
    expect(Num.parse('3e36').format()).toBe('3.00aa');
    // an explicit notation still wins
    expect(N(123456).format({ notation: 'standard' })).toBe('123K');
    setNotation('nonsense' as never);
    expect(getNotation()).toBe('letters');
  });
});

describe('one helper for every figure (the readability pass)', () => {
  it('amounts follow the notation', () => {
    expect(amount(1234)).toBe('1,234');
    expect(amount(N(4.56e6))).toBe('4.56M');
    setNotation('scientific');
    expect(amount(4.56e6)).toBe('4.56e6');
  });
  it('small numbers drop trailing zeros; big ones go through the notation', () => {
    expect(plain(2.5)).toBe('2.5');
    expect(plain(2)).toBe('2');
    expect(plain(0.75, 2)).toBe('0.75');
    expect(plain(1.0, 2)).toBe('1');
    expect(plain(100, 2)).toBe('100');
    expect(plain(123456)).toBe('123K');
  });
  it('rates per minute from per second', () => {
    expect(perMin(8)).toBe('480');
    expect(perMin(0.625)).toBe('37.5');
    expect(perMin(0.0125)).toBe('0.75');
    expect(perMin(0.5)).toBe('30');
    expect(perMin(1000)).toBe('60.0K');
  });
  it('power in kW, then MW', () => {
    expect(kw(60)).toBe('60 kW');
    expect(kw(1200)).toBe('1,200 kW');
    expect(kw(12500)).toBe('12.5 MW');
    expect(kw(7.5)).toBe('7.5 kW');
  });
  it('shares, multipliers and durations', () => {
    expect(pct(0.414)).toBe('41%');
    expect(mult(1.25)).toBe('x1.25');
    expect(mult(1.1)).toBe('x1.1');
    expect(mult(3)).toBe('x3');
    expect(duration(45)).toBe('45s');
    expect(duration(250)).toBe('4m 10s');
    expect(duration(2 * 3600 + 5 * 60)).toBe('2h 05m');
    expect(duration(3 * 86400 + 4 * 3600)).toBe('3d 4h');
    expect(clock(47 * 60)).toBe('0:47');
    expect(clock(26 * 3600 + 5 * 60)).toBe('26:05');
  });
});
