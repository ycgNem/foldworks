// Num: the one big-number type for every amount of coin and items (CLAUDE.md, DESIGN.md §1).
// Our own, not a wrap of break_infinity.js (DECISIONS.md, Milestone 0): a hybrid that keeps small
// values as plain doubles, so whole coin and item counts below 1e15 are exact (21 + 3 is 24, not
// 23.999999999999996, and "can I afford 24?" never lies), and switches to mantissa x 10^exponent
// above that, with an integer exponent that reaches far past 1e308.
//
// Invariant: |value| < 1e15 → e === 0 and m is the plain value (any double).
//            otherwise       → 1 <= |m| < 10 and e >= 15.
// Immutable: every operation returns a new Num. Pure (no DOM), so the sim uses it freely.

const SMALL = 1e15;
const BIG_E = 15;

/** exact powers of ten up to 1e22, computed ones beyond */
const P10: number[] = [];
for (let i = 0; i <= 330; i++) P10.push(i <= 22 ? Number('1e' + i) : Math.pow(10, i));
function pow10(k: number): number {
  if (k >= 0) return k <= 330 ? P10[k] : Infinity;
  return -k <= 330 ? 1 / P10[-k] : 0;
}

export type NumLike = Num | number;

/** How big numbers are written (DESIGN.md §20 Notation, a player setting kept outside the sim):
 * - standard: 12.3K, 4.56M ... 999Dc, then scientific past 1e36;
 * - scientific: 1.23e4;
 * - engineering: the exponent a multiple of 3, 12.3e3;
 * - letters: the named suffixes to Dc, then aa, ab ... zz, aaa ... (one per thousand) past 1e36. */
export type Notation = 'standard' | 'scientific' | 'engineering' | 'letters';
export const NOTATIONS: readonly Notation[] = ['standard', 'scientific', 'engineering', 'letters'];

/** Short suffixes, one per thousand, up to decillion; past 1e36 the format is scientific. */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** The notation `format()` uses when the caller names none: a display setting, set by the app from
 * the player's options (localStorage). It never changes the state, only how numbers are written,
 * so the sim stays deterministic whatever it is. */
let displayNotation: Notation = 'standard';
export function setNotation(n: Notation) {
  if (NOTATIONS.includes(n)) displayNotation = n;
}
export function getNotation(): Notation {
  return displayNotation;
}

/** Letters for tier k past the named suffixes: 0 -> aa, 1 -> ab ... 675 -> zz, 676 -> aaa ... */
export function letterSuffix(k: number): string {
  let len = 2, base = 26 * 26;
  while (k >= base) {
    k -= base;
    len++;
    base *= 26;
  }
  let s = '';
  for (let i = 0; i < len; i++) {
    s = String.fromCharCode(97 + (k % 26)) + s;
    k = Math.floor(k / 26);
  }
  return s;
}

export class Num {
  readonly m: number;
  readonly e: number;

  private constructor(m: number, e: number) {
    this.m = m;
    this.e = e;
  }

  static readonly ZERO = new Num(0, 0);
  static readonly ONE = new Num(1, 0);

  /** From a JS number. NaN becomes 0 and is reported (an amount must never be NaN). */
  static of(x: number): Num {
    if (x !== x) {
      // keep the game alive; tests check nothing produces this
      return Num.ZERO;
    }
    if (x === Infinity) return new Num(1, 308);
    if (x === -Infinity) return new Num(-1, 308);
    if (Math.abs(x) < SMALL) return x === 0 ? Num.ZERO : new Num(x, 0);
    return Num.norm(x, 0);
  }

  static from(x: NumLike): Num {
    return typeof x === 'number' ? Num.of(x) : x;
  }

  /** Normalize m * 10^e into the invariant. */
  static norm(m: number, e: number): Num {
    if (m === 0 || m !== m) return Num.ZERO;
    if (!isFinite(m)) return new Num(m > 0 ? 1 : -1, e + 308);
    const am = Math.abs(m);
    let k = Math.floor(Math.log10(am));
    let mm = k >= 0 ? m / pow10(k) : m * pow10(-k);
    // log10 can be off by one at the boundaries
    if (Math.abs(mm) >= 10) { mm /= 10; k++; }
    else if (Math.abs(mm) < 1) { mm *= 10; k--; }
    const ee = e + k;
    if (ee < BIG_E) return new Num(mm * pow10(ee), 0);
    return new Num(mm, ee);
  }

  /** Parse "1234", "1.5e300", "-2e1000000". */
  static parse(s: string): Num {
    const t = s.trim();
    const i = t.search(/e/i);
    if (i < 0) return Num.of(Number(t));
    const m = Number(t.slice(0, i)), e = Number(t.slice(i + 1));
    if (!isFinite(m) || !Number.isInteger(e)) return Num.ZERO;
    return Num.norm(m, e);
  }

  get big(): boolean {
    return this.e !== 0;
  }

  /** mantissa and exponent with 1 <= |m| < 10 (0, 0 for zero), whatever the internal form */
  private me(): [number, number] {
    if (this.e !== 0) return [this.m, this.e];
    if (this.m === 0) return [0, 0];
    const k = Math.floor(Math.log10(Math.abs(this.m)));
    let mm = k >= 0 ? this.m / pow10(k) : this.m * pow10(-k);
    let kk = k;
    if (Math.abs(mm) >= 10) { mm /= 10; kk++; }
    else if (Math.abs(mm) < 1) { mm *= 10; kk--; }
    return [mm, kk];
  }

  add(b: NumLike): Num {
    const o = Num.from(b);
    if (this.e === 0 && o.e === 0) return Num.of(this.m + o.m);
    if (o.m === 0) return this;
    if (this.m === 0) return o;
    const [am, ae] = this.me(), [bm, be] = o.me();
    if (ae >= be) {
      const d = ae - be;
      if (d > 17) return this;
      return Num.norm(am + bm / pow10(d), ae);
    }
    const d = be - ae;
    if (d > 17) return o;
    return Num.norm(bm + am / pow10(d), be);
  }

  sub(b: NumLike): Num {
    return this.add(Num.from(b).neg());
  }

  neg(): Num {
    return this.m === 0 ? this : new Num(-this.m, this.e);
  }

  abs(): Num {
    return this.m < 0 ? new Num(-this.m, this.e) : this;
  }

  mul(b: NumLike): Num {
    const o = Num.from(b);
    if (this.e === 0 && o.e === 0) {
      const r = this.m * o.m;
      if (Math.abs(r) < SMALL) return Num.of(r);
    }
    if (this.m === 0 || o.m === 0) return Num.ZERO;
    const [am, ae] = this.me(), [bm, be] = o.me();
    return Num.norm(am * bm, ae + be);
  }

  div(b: NumLike): Num {
    const o = Num.from(b);
    if (o.m === 0) throw new Error('Num: division by zero');
    if (this.e === 0 && o.e === 0) return Num.of(this.m / o.m);
    if (this.m === 0) return Num.ZERO;
    const [am, ae] = this.me(), [bm, be] = o.me();
    return Num.norm(am / bm, ae - be);
  }

  /** this ^ p for a plain-number power (fractional allowed for positive values). */
  pow(p: number): Num {
    if (p === 0) return Num.ONE;
    if (this.m === 0) return Num.ZERO;
    if (this.e === 0) {
      const r = Math.pow(this.m, p);
      if (isFinite(r) && Math.abs(r) < SMALL) return Num.of(r);
    }
    if (this.m < 0 && !Number.isInteger(p)) throw new Error('Num: fractional power of a negative number');
    const sign = this.m < 0 && Math.abs(p) % 2 === 1 ? -1 : 1;
    const l = this.abs().log10() * p;
    const e = Math.floor(l);
    return Num.norm(sign * Math.pow(10, l - e), e);
  }

  /** log10 of |this| as a plain number (-Infinity for zero). */
  log10(): number {
    if (this.m === 0) return -Infinity;
    if (this.e === 0) return Math.log10(Math.abs(this.m));
    return Math.log10(Math.abs(this.m)) + this.e;
  }

  floor(): Num {
    // big values have no fractional part a double can hold
    return this.e === 0 ? Num.of(Math.floor(this.m)) : this;
  }

  ceil(): Num {
    return this.e === 0 ? Num.of(Math.ceil(this.m)) : this;
  }

  round(): Num {
    return this.e === 0 ? Num.of(Math.round(this.m)) : this;
  }

  sign(): number {
    return this.m > 0 ? 1 : this.m < 0 ? -1 : 0;
  }

  isZero(): boolean {
    return this.m === 0;
  }

  cmp(b: NumLike): -1 | 0 | 1 {
    const o = Num.from(b);
    if (this.e === 0 && o.e === 0) return this.m < o.m ? -1 : this.m > o.m ? 1 : 0;
    const sa = this.sign(), sb = o.sign();
    if (sa !== sb) return sa < sb ? -1 : 1;
    if (sa === 0) return 0;
    const [am, ae] = this.me(), [bm, be] = o.me();
    if (ae !== be) return (ae > be) === (sa > 0) ? 1 : -1;
    return am < bm ? -1 : am > bm ? 1 : 0;
  }

  eq(b: NumLike) { return this.cmp(b) === 0; }
  lt(b: NumLike) { return this.cmp(b) < 0; }
  lte(b: NumLike) { return this.cmp(b) <= 0; }
  gt(b: NumLike) { return this.cmp(b) > 0; }
  gte(b: NumLike) { return this.cmp(b) >= 0; }

  static max(a: NumLike, b: NumLike): Num {
    const A = Num.from(a), B = Num.from(b);
    return A.gte(B) ? A : B;
  }

  static min(a: NumLike, b: NumLike): Num {
    const A = Num.from(a), B = Num.from(b);
    return A.lte(B) ? A : B;
  }

  /** As a plain number: Infinity past 1.8e308. For rates and UI fractions, never for stocks. */
  toNumber(): number {
    if (this.e === 0) return this.m;
    if (this.e > 308) return this.m > 0 ? Infinity : -Infinity;
    return this.m * pow10(this.e);
  }

  /** Serialized form, e.g. "24" or "1.5e300". */
  toString(): string {
    return this.e === 0 ? String(this.m) : `${this.m}e${this.e}`;
  }

  /** In JSON a Num is a string tagged "N:" (see reviveNums). */
  toJSON(): string {
    return 'N:' + this.toString();
  }

  /**
   * The player-facing form: whole numbers with commas below 10,000 ("1,234"), then three
   * significant digits with a suffix ("12.3K", "456M"), floored so the display never shows more
   * than you have, and scientific past 1e36 ("4.56e123"). `decimals` shows small fractional
   * amounts ("2.5") below 100.
   */
  format(opts: { notation?: Notation; decimals?: number } = {}): string {
    const notation = opts.notation ?? displayNotation;
    if (this.m < 0) return '-' + this.neg().format(opts);
    // every notation writes the same plain whole numbers below 10,000 (DESIGN.md §20)
    if (this.e === 0 && this.m < 1e4) {
      const d = opts.decimals ?? 0;
      if (d > 0 && this.m < 100 && !Number.isInteger(this.m)) {
        const f = Math.floor(this.m * pow10(d)) / pow10(d);
        return f.toFixed(d).replace(/\.?0+$/, '');
      }
      return commas(Math.floor(this.m));
    }
    const [mm, ee] = this.me();
    if (notation === 'scientific' || (notation === 'standard' && ee >= SUFFIX.length * 3)) {
      return `${trunc(mm, 2)}e${ee}`;
    }
    const tier = Math.floor(ee / 3);
    const shown = mm * pow10(ee - tier * 3); // 1 .. 999.99
    const digits = shown >= 100 ? 0 : shown >= 10 ? 1 : 2;
    if (notation === 'engineering') return `${trunc(shown, digits)}e${tier * 3}`;
    const suffix = tier < SUFFIX.length ? SUFFIX[tier] : letterSuffix(tier - SUFFIX.length);
    return trunc(shown, digits) + suffix;
  }
}

function commas(n: number): string {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

/** floor to `d` decimals and print exactly that many (with a guard against 1.2999999 artifacts) */
function trunc(x: number, d: number): string {
  const k = pow10(d);
  const f = Math.floor(x * k + 1e-9) / k;
  return f.toFixed(d);
}

/** JSON.parse reviver: turns "N:..." strings back into Nums. */
export function reviveNums(_k: string, v: unknown): unknown {
  return typeof v === 'string' && v.startsWith('N:') ? Num.parse(v.slice(2)) : v;
}

export const N = Num.of;
