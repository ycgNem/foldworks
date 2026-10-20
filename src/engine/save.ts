// Save slots in localStorage with versioned migrations, plus export/import strings (the shape of
// Sprocket & Sprout's save layer by way of Trotline, without their games). A save is a plain JSON
// object with a version `v`; MIGRATIONS[v] upgrades a v save to v + 1, in order, before the game
// reads it. The game decides what goes in the payload: Foldworks writes the seed, the last
// snapshot and the commands since it (src/sim/snapshot.ts).

/** Bump when the payload's shape changes, and add the migration from the old version. */
export const SAVE_VERSION = 4;
const PREFIX = 'foldworks_save_';
export const MAX_SLOTS = 3;

export interface SaveData {
  v: number;
  /** when it was written (ms since epoch, from the app layer: the sim never reads the clock) */
  saved: number;
  /** the run's seed */
  seed: number;
  [k: string]: unknown;
}

export type Migration = (d: any) => any;

/** Ordered migrations: MIGRATIONS[v] upgrades a v save to v + 1 and sets d.v. */
export const MIGRATIONS: Record<number, Migration> = {
  // v2 (Milestone 2): the state gains the fold audit, module designs and the Factory floor
  1: (d) => {
    const st = JSON.parse(d.snap);
    st.audit ??= null;
    st.designs ??= [];
    st.nextDesign ??= 1;
    st.factory ??= {
      ents: [
        { id: 1, kind: 'fdock', x: 10, y: 1, w: 2, h: 2, rot: 0, design: 0, inBuf: {}, outBuf: {}, f: 0, fAvg: 0, state: 'idle', why: null, rr: 0, flow: 0, hist: '', sec: [0, 0, 0, 0] },
        { id: 2, kind: 'fhopper', x: 10, y: 5, w: 2, h: 2, rot: 0, design: 0, inBuf: {}, outBuf: {}, f: 0, fAvg: 0, state: 'idle', why: null, rr: 0, flow: 0, hist: '', sec: [0, 0, 0, 0] },
      ],
      nextId: 3,
    };
    return { ...d, snap: JSON.stringify(st), v: 2 };
  },
  // v3 (Milestone 4, Act II): parts bank, deposit claims, the Codex, the Megaproject, the Factory
  // audit, and the two new customers' reputation
  2: (d) => {
    const st = JSON.parse(d.snap);
    st.parts ??= 'N:0';
    st.claimBlocks ??= {};
    st.codex ??= [];
    st.mega ??= { stage: 0, progress: {} };
    st.faudit ??= null;
    st.orders ??= {};
    st.orders.rep = { bramble: 0, unit7: 0, voltaire: 0, ...(st.orders.rep ?? {}) };
    return { ...d, snap: JSON.stringify(st), v: 3 };
  },
  // v4 (the Milestone 3 gate): several Workshop audits at once
  3: (d) => {
    const st = JSON.parse(d.snap);
    st.audits = st.audit ? [{ ...st.audit, id: 1 }] : (st.audits ?? []);
    st.nextAudit = st.audits.length + 1;
    delete st.audit;
    return { ...d, snap: JSON.stringify(st), v: 4 };
  },
};

/** Bring any older save up to SAVE_VERSION; throws on a gap in the chain or a newer save. */
export function migrate(d: any, migrations: Record<number, Migration> = MIGRATIONS, target = SAVE_VERSION): SaveData {
  let v = d.v ?? 1;
  while (v < target) {
    const f = migrations[v];
    if (!f) throw new Error('no migration from v' + v);
    d = f(d);
    if (d.v !== v + 1) throw new Error(`migration from v${v} did not set v${v + 1}`);
    v = d.v;
  }
  if (v > target) throw new Error('save is from a newer version');
  return d as SaveData;
}

/** localStorage when it is there and allowed (private windows and tests may have none). */
export function store(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function writeSave(slot: number, payload: { seed: number; saved: number; [k: string]: unknown }, s: Storage | null = store()): boolean {
  if (!s) return false;
  try {
    const d: SaveData = { ...payload, v: SAVE_VERSION };
    s.setItem(PREFIX + slot, JSON.stringify(d));
    return true;
  } catch (err) {
    console.error('save failed', err);
    return false;
  }
}

export function readSave(slot: number, s: Storage | null = store()): SaveData | null {
  const raw = s?.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch (err) {
    console.error('load failed', err);
    return null;
  }
}

export function deleteSave(slot: number, s: Storage | null = store()) {
  s?.removeItem(PREFIX + slot);
}

export function listSlots(s: Storage | null = store()): number[] {
  const out: number[] = [];
  for (let i = 1; i <= MAX_SLOTS; i++) if (s?.getItem(PREFIX + i)) out.push(i);
  return out;
}

// ---------------------------------------------------------------- export / import strings
// "FW1." + base64url(UTF-8 JSON) + "." + an 8-hex checksum, so a pasted string that lost a few
// characters is refused with a clear message instead of loading a broken game.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function b64encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const k = Math.min(3, bytes.length - i);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (k > 1 ? B64[(n >> 6) & 63] : '') + (k > 2 ? B64[n & 63] : '');
  }
  return out;
}

function b64decode(s: string): Uint8Array {
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('the save string has a character that is not part of a save');
    buf = ((buf << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

/** FNV-1a over the encoded body, as 8 hex digits. */
function checksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function exportString(payload: object): string {
  const body = b64encode(new TextEncoder().encode(JSON.stringify({ ...payload, v: SAVE_VERSION })));
  return `FW1.${body}.${checksum(body)}`;
}

/** Parse and migrate an export string; throws an Error with a player-readable message. */
export function importString(s: string): SaveData {
  const parts = s.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'FW1') throw new Error('that is not a Foldworks save string');
  if (checksum(parts[1]) !== parts[2]) throw new Error('the save string is damaged (its checksum does not match)');
  const json = new TextDecoder().decode(b64decode(parts[1]));
  return migrate(JSON.parse(json));
}
