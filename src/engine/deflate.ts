// Raw DEFLATE (RFC 1951), synchronous and dependency-free, for the save layer (Milestone 14,
// DESIGN.md §20 "Save size"): a late save is 170-210 KB of JSON (the 40 h checkpoint, a full World
// and Beyond), stored three or four times over with its backups; deflated it is about a tenth.
// Saves are written on `beforeunload` and on a timer, so this cannot wait on CompressionStream.
//
// The encoder is LZ77 over a 32 KB window (hash chains, greedy matching) with the fixed Huffman
// codes in one block: a few percent bigger than zlib's best and simple enough to trust. The
// decoder reads any raw DEFLATE stream (stored, fixed and dynamic blocks), so what zlib, a browser's
// CompressionStream('deflate-raw') or Node's zlib.deflateRawSync wrote loads too (tests/deflate.test.ts
// checks both ways against Node's zlib).

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// ---------------------------------------------------------------- encoding

const reverse = (code: number, len: number) => {
  let r = 0;
  for (let i = 0; i < len; i++) { r = (r << 1) | (code & 1); code >>= 1; }
  return r;
};

/** The fixed literal/length codes (RFC 1951 3.2.6), bit-reversed for an LSB-first writer. */
const FIXED_CODE = new Uint16Array(288);
const FIXED_LEN = new Uint8Array(288);
for (let v = 0; v < 288; v++) {
  const [c, l] = v < 144 ? [0x30 + v, 8] : v < 256 ? [0x190 + v - 144, 9] : v < 280 ? [v - 256, 7] : [0xc0 + v - 280, 8];
  FIXED_CODE[v] = reverse(c, l);
  FIXED_LEN[v] = l;
}
const DIST_CODE = Uint8Array.from({ length: 30 }, (_, d) => reverse(d, 5));
/** length 3..258 -> its symbol index (0..28) */
const LEN_SYM = new Uint8Array(259);
for (let i = 0; i < 29; i++) for (let L = LEN_BASE[i]; L < (i < 28 ? LEN_BASE[i + 1] : 259); L++) LEN_SYM[L] = i;
LEN_SYM[258] = 28;
const distSym = (d: number) => {
  let lo = 0, hi = 29;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (DIST_BASE[m] <= d) lo = m; else hi = m - 1; }
  return lo;
};

class BitWriter {
  buf: Uint8Array;
  n = 0;
  private acc = 0;
  private bits = 0;
  constructor(size: number) { this.buf = new Uint8Array(Math.max(64, size)); }
  put(v: number, nbits: number) {
    this.acc |= v << this.bits;
    this.bits += nbits;
    while (this.bits >= 8) {
      if (this.n >= this.buf.length) { const b = new Uint8Array(this.buf.length * 2); b.set(this.buf); this.buf = b; }
      this.buf[this.n++] = this.acc & 255;
      this.acc >>>= 8;
      this.bits -= 8;
    }
  }
  flush(): Uint8Array {
    if (this.bits > 0) this.put(0, 8 - this.bits);
    return this.buf.subarray(0, this.n);
  }
}

const WSIZE = 32768, WMASK = WSIZE - 1, HBITS = 15, HMASK = (1 << HBITS) - 1;
const MIN_MATCH = 3, MAX_MATCH = 258, MAX_CHAIN = 96, GOOD = 64;

/** Compress bytes to a raw DEFLATE stream (one fixed-Huffman block). */
export function deflateRaw(a: Uint8Array): Uint8Array {
  const n = a.length;
  const w = new BitWriter((n >> 2) + 64);
  w.put(1, 1); // BFINAL
  w.put(1, 2); // BTYPE 01: fixed codes
  const head = new Int32Array(1 << HBITS).fill(-1);
  const prev = new Int32Array(WSIZE);
  const hash = (i: number) => ((a[i] << 10) ^ (a[i + 1] << 5) ^ a[i + 2]) & HMASK;
  const insert = (i: number) => { const h = hash(i); prev[i & WMASK] = head[h]; head[h] = i; };
  const lit = (v: number) => w.put(FIXED_CODE[v], FIXED_LEN[v]);
  let i = 0;
  while (i < n) {
    let best = 0, dist = 0;
    if (i + MIN_MATCH <= n) {
      const max = Math.min(MAX_MATCH, n - i);
      let j = head[hash(i)];
      let chain = MAX_CHAIN;
      while (j >= 0 && i - j <= WSIZE && chain-- > 0) {
        if (a[j + best] === a[i + best] && a[j] === a[i]) {
          let k = 0;
          while (k < max && a[j + k] === a[i + k]) k++;
          if (k > best) { best = k; dist = i - j; if (k >= max || k >= GOOD) break; }
        }
        const nj = prev[j & WMASK];
        if (nj >= j) break;
        j = nj;
      }
      insert(i);
    }
    if (best >= MIN_MATCH) {
      const ls = LEN_SYM[best];
      lit(257 + ls);
      if (LEN_EXTRA[ls]) w.put(best - LEN_BASE[ls], LEN_EXTRA[ls]);
      const ds = distSym(dist);
      w.put(DIST_CODE[ds], 5);
      if (DIST_EXTRA[ds]) w.put(dist - DIST_BASE[ds], DIST_EXTRA[ds]);
      for (let k = 1; k < best; k++) if (i + k + MIN_MATCH <= n) insert(i + k);
      i += best;
    } else {
      lit(a[i]);
      i++;
    }
  }
  lit(256);
  return w.flush();
}

// ---------------------------------------------------------------- decoding (after Mark Adler's puff)

interface Huff { count: Uint16Array; symbol: Uint16Array }

function huff(lengths: ArrayLike<number>, n: number): Huff {
  const count = new Uint16Array(16), symbol = new Uint16Array(n), offs = new Uint16Array(16);
  for (let s = 0; s < n; s++) count[lengths[s]]++;
  count[0] = 0;
  for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + count[l];
  for (let s = 0; s < n; s++) if (lengths[s]) symbol[offs[lengths[s]]++] = s;
  return { count, symbol };
}

let FIXED: { lit: Huff; dist: Huff } | null = null;
function fixedTables() {
  if (!FIXED) {
    const l = new Uint8Array(288);
    for (let s = 0; s < 288; s++) l[s] = s < 144 ? 8 : s < 256 ? 9 : s < 280 ? 7 : 8;
    FIXED = { lit: huff(l, 288), dist: huff(new Uint8Array(30).fill(5), 30) };
  }
  return FIXED;
}

/** Decompress a raw DEFLATE stream; throws on a stream that is cut short or malformed. */
export function inflateRaw(data: Uint8Array): Uint8Array {
  let pos = 0, buf = 0, cnt = 0;
  let out = new Uint8Array(Math.max(1024, data.length * 6));
  let o = 0;
  const need = (k: number) => {
    if (o + k <= out.length) return;
    let m = out.length * 2;
    while (m < o + k) m *= 2;
    const b = new Uint8Array(m);
    b.set(out.subarray(0, o));
    out = b;
  };
  const bits = (k: number) => {
    while (cnt < k) {
      if (pos >= data.length) throw new Error('deflate stream cut short');
      buf |= data[pos++] << cnt;
      cnt += 8;
    }
    const v = buf & ((1 << k) - 1);
    buf >>>= k;
    cnt -= k;
    return v;
  };
  const decode = (h: Huff) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.symbol[index + (code - first)];
      index += c;
      first = (first + c) << 1;
      code <<= 1;
    }
    throw new Error('deflate stream has a bad code');
  };
  let last = 0;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      buf = 0;
      cnt = 0;
      if (pos + 4 > data.length) throw new Error('deflate stream cut short');
      const len = data[pos] | (data[pos + 1] << 8), nlen = data[pos + 2] | (data[pos + 3] << 8);
      pos += 4;
      if (len !== (~nlen & 0xffff)) throw new Error('deflate stored block is damaged');
      if (pos + len > data.length) throw new Error('deflate stream cut short');
      need(len);
      out.set(data.subarray(pos, pos + len), o);
      o += len;
      pos += len;
      continue;
    }
    let lit: Huff, dist: Huff;
    if (type === 1) ({ lit, dist } = fixedTables());
    else if (type === 2) {
      const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) throw new Error('deflate stream has bad counts');
      const cl = new Uint8Array(19);
      for (let k = 0; k < ncode; k++) cl[CL_ORDER[k]] = bits(3);
      const clh = huff(cl, 19);
      const lens = new Uint8Array(nlen + ndist);
      for (let k = 0; k < nlen + ndist;) {
        const sym = decode(clh);
        if (sym < 16) { lens[k++] = sym; continue; }
        let rep = 0, len = 0;
        if (sym === 16) { if (!k) throw new Error('deflate stream repeats nothing'); len = lens[k - 1]; rep = 3 + bits(2); }
        else if (sym === 17) rep = 3 + bits(3);
        else rep = 11 + bits(7);
        if (k + rep > nlen + ndist) throw new Error('deflate stream has too many lengths');
        while (rep--) lens[k++] = len;
      }
      lit = huff(lens.subarray(0, nlen), nlen);
      dist = huff(lens.subarray(nlen), ndist);
    } else throw new Error('deflate stream has a bad block type');
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) { need(1); out[o++] = sym; continue; }
      if (sym === 256) break;
      const ls = sym - 257;
      if (ls >= 29) throw new Error('deflate stream has a bad length');
      const len = LEN_BASE[ls] + bits(LEN_EXTRA[ls]);
      const ds = decode(dist);
      if (ds >= 30) throw new Error('deflate stream has a bad distance');
      const d = DIST_BASE[ds] + bits(DIST_EXTRA[ds]);
      if (d > o) throw new Error('deflate stream reaches before its start');
      need(len);
      for (let k = 0; k < len; k++, o++) out[o] = out[o - d];
    }
  } while (!last);
  return out.slice(0, o);
}
