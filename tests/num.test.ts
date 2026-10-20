// Num, the big-number type (ROADMAP.md Milestone 0): exact small integers, arithmetic to 1e308
// and far beyond, the formatting boundaries, and the JSON round trip saves rely on.
import { describe, expect, it } from 'vitest';
import { Num, N, reviveNums } from '../src/engine/num';

describe('Num arithmetic', () => {
  it('keeps whole numbers exact below 1e15', () => {
    let a = N(0);
    for (let i = 0; i < 1000; i++) a = a.add(3);
    expect(a.toNumber()).toBe(3000);
    expect(N(21).add(3).eq(24)).toBe(true);
    expect(N(0.1).add(0.2).toNumber()).toBeCloseTo(0.3, 12);
    expect(N(1e14).add(1).toNumber()).toBe(1e14 + 1);
  });

  it('adds, subtracts, multiplies and divides across the 1e15 boundary', () => {
    const a = N(9e14).add(2e14);
    expect(a.big).toBe(true);
    expect(a.toNumber()).toBeCloseTo(1.1e15, 0);
    expect(a.sub(2e14).big).toBe(false);
    expect(a.sub(2e14).toNumber()).toBeCloseTo(9e14, -2);
    expect(N(1e10).mul(1e10).toNumber()).toBeCloseTo(1e20, -6);
    expect(N(1e20).div(1e10).toNumber()).toBeCloseTo(1e10, 0);
    expect(N(7).div(2).toNumber()).toBe(3.5);
  });

  it('goes past 1e308 without becoming Infinity', () => {
    const a = N(1e308).mul(1e10);
    expect(a.e).toBe(318);
    expect(a.log10()).toBeCloseTo(318, 9);
    const b = Num.parse('5e1000').mul(Num.parse('2e1000'));
    expect(b.e).toBe(2001);
    expect(b.m).toBeCloseTo(1, 12);
    expect(Num.parse('1e400').add(Num.parse('1e399')).toString()).toBe('1.1e400');
    expect(Num.parse('1e400').sub(Num.parse('1e400')).isZero()).toBe(true);
    expect(N(10).pow(1000).log10()).toBeCloseTo(1000, 9);
    expect(N(2).pow(10).toNumber()).toBe(1024);
    expect(Num.parse('1e1000').toNumber()).toBe(Infinity);
  });

  it('ignores an addend more than 17 orders smaller', () => {
    expect(Num.parse('1e300').add(1).eq(Num.parse('1e300'))).toBe(true);
  });

  it('compares any two values, signs included', () => {
    expect(N(3).lt(4)).toBe(true);
    expect(Num.parse('1e400').gt(Num.parse('9e399'))).toBe(true);
    expect(Num.parse('-1e400').lt(Num.parse('-1e399'))).toBe(true);
    expect(N(-5).lt(Num.parse('1e400'))).toBe(true);
    expect(Num.parse('2e20').cmp(N(2e20))).toBe(0);
    expect(Num.max(5, 7).toNumber()).toBe(7);
    expect(Num.min(Num.parse('1e50'), 7).toNumber()).toBe(7);
  });

  it('floors, and refuses nonsense', () => {
    expect(N(3.7).floor().toNumber()).toBe(3);
    expect(N(NaN).isZero()).toBe(true);
    expect(() => N(1).div(0)).toThrow(/division by zero/);
  });

  it('round-trips through JSON', () => {
    const o = { coin: N(1234), big: Num.parse('4.56e123'), list: [N(0.5)] };
    const back = JSON.parse(JSON.stringify(o), reviveNums);
    expect(back.coin).toBeInstanceOf(Num);
    expect(back.coin.eq(1234)).toBe(true);
    expect(back.big.eq(Num.parse('4.56e123'))).toBe(true);
    expect(back.list[0].toNumber()).toBe(0.5);
  });
});

describe('Num formatting', () => {
  const f = (s: string | number) => (typeof s === 'number' ? N(s) : Num.parse(s)).format();
  it('shows whole numbers with commas below 10,000', () => {
    expect(f(0)).toBe('0');
    expect(f(7)).toBe('7');
    expect(f(999)).toBe('999');
    expect(f(1234)).toBe('1,234');
    expect(f(9999)).toBe('9,999');
    expect(f(9999.9)).toBe('9,999');
  });
  it('uses three significant digits and a suffix from 10,000, floored', () => {
    expect(f(10000)).toBe('10.0K');
    expect(f(12345)).toBe('12.3K');
    expect(f(123456)).toBe('123K');
    expect(f(999999)).toBe('999K');
    expect(f(1e6)).toBe('1.00M');
    expect(f(4.56e6)).toBe('4.56M');
    expect(f(1e9)).toBe('1.00B');
    expect(f(1e12)).toBe('1.00T');
    expect(f(1.5e15)).toBe('1.50Qa');
    expect(f('1e33')).toBe('1.00Dc');
    expect(f('999.9e33')).toBe('999Dc');
  });
  it('switches to scientific past the suffixes', () => {
    expect(f('1e36')).toBe('1.00e36');
    expect(f('4.56e123')).toBe('4.56e123');
    expect(f('7.891e100000')).toBe('7.89e100000');
  });
  it('has a scientific setting and small decimals', () => {
    expect(N(12345).format({ notation: 'scientific' })).toBe('1.23e4');
    expect(N(1234).format({ notation: 'scientific' })).toBe('1,234');
    expect(N(2.5).format({ decimals: 1 })).toBe('2.5');
    expect(N(2).format({ decimals: 1 })).toBe('2');
    expect(N(-1500).format()).toBe('-1,500');
  });
});
