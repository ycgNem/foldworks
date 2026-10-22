// Save slots in localStorage with versioned migrations, plus export/import strings (the shape of
// Sprocket & Sprout's save layer by way of Trotline, without their games). A save is a plain JSON
// object with a version `v`; MIGRATIONS[v] upgrades a v save to v + 1, in order, before the game
// reads it. The game decides what goes in the payload: Foldworks writes the seed, the last
// snapshot and the commands since it (src/sim/snapshot.ts).

/** Bump when the payload's shape changes, and add the migration from the old version. */
export const SAVE_VERSION = 10;
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
  // v5 (Milestone 5, Reorganize): what survives a reset (`meta`: Patents, the tree, blueprints,
  // bearings, run history), blueprint ghosts, the run's Megaproject Patents and head-start coin, and
  // the Committee's reputation. An old save is a first run with nothing kept yet.
  4: (d) => {
    const st = JSON.parse(d.snap);
    st.meta ??= {
      runs: 0, runStart: 0, patents: 'N:0', patentsEarned: 'N:0', nodes: [], blueprints: [], nextBlueprint: 1,
      bearings: 'N:0', lifetime: { earned: 'N:0', delivered: {}, folds: 0 }, history: [], peakPerMin: 0, perMinRing: [],
    };
    st.ghosts ??= [];
    st.megaPatents ??= 0;
    st.granted ??= 'N:0';
    st.orders ??= {};
    st.orders.rep = { committee: 0, ...(st.orders.rep ?? {}) };
    return { ...d, snap: JSON.stringify(st), v: 5 };
  },
  // v6 (Milestone 6, idle and offline): Inspiration credited per research node. Paused machines
  // and modules (`paused`) and the Night Shift (in `upgrades`) need nothing: absent means none.
  5: (d) => {
    const st = JSON.parse(d.snap);
    st.inspire ??= {};
    return { ...d, snap: JSON.stringify(st), v: 6 };
  },
  // v7 (the Milestone 5-6 review round, DESIGN.md §19): Patents are filed (`meta.patented`), the
  // Patent Drawer replaces blueprints (`meta.drawer`, the Draughtsman's `queue`), the Raccoon
  // Bearings and ghosts are gone, the Factory annex starts at no blocks. Old blueprints had no place
  // on the map to unfold onto, so they become nothing; the record on file starts empty (the run
  // under way files what it folded at its next Reorganize). Removed commands leave the log.
  6: (d) => {
    const st = JSON.parse(d.snap);
    const m = st.meta ?? {};
    delete m.blueprints;
    delete m.nextBlueprint;
    delete m.bearings;
    m.patented ??= {};
    m.drawer ??= [];
    m.nextKept ??= 1;
    m.queue ??= [];
    st.meta = m;
    delete st.ghosts;
    if (st.mega) delete st.mega.bearings;
    st.annex ??= 0;
    const gone = new Set(['bpSave', 'bpDelete', 'bpRename', 'bpImport', 'bpPlace', 'ghostBuild', 'ghostBuildAll', 'ghostClear']);
    const log = Array.isArray(d.log) ? d.log.filter((l: { c?: { k?: string } }) => !gone.has(l?.c?.k ?? '')) : d.log;
    return { ...d, snap: JSON.stringify(st), log, v: 7 };
  },
  // v8 (Milestone 7, Act III, DESIGN.md §21): the District and World floors, their audit, the Chute
  // stock, Megaprojects #2 and on, a Challenge (and those won), a Scenario. Every one is absent
  // until it happens, so an old save needs nothing; the bump keeps an older build from loading a
  // save whose District it would silently drop.
  7: (d) => ({ ...d, v: 8 }),
  // v9 (Milestone 9, Act IV, DESIGN.md §22): Relocate. The town is on Home, no Legacy banked, no
  // Legacy node, Home the only island visited, no world's record yet; this world began with the
  // save's first run (its bests are noted from the running designs within 10 s of loading).
  8: (d) => {
    if (typeof d.snap !== 'string') return { ...d, v: 9 };
    const st = JSON.parse(d.snap);
    const m = (st.meta ??= {});
    m.world ??= 'home';
    m.legacy ??= 'N:0';
    m.legacyEarned ??= 'N:0';
    m.legacyNodes ??= [];
    m.visited ??= ['home'];
    m.worldRecords ??= {};
    m.here ??= { start: 0, best: {}, stages: 0, opened: !!st.world, runs: m.runs ?? 0 };
    m.relocations ??= 0;
    return { ...d, snap: JSON.stringify(st), v: 9 };
  },
  // v10 (Milestone 10, Act V, DESIGN.md §23): the Last Fold. No Kernel banked or node bought, no Last
  // Fold taken (so no Seed: the first universe), no Legacy node kept, the Endless Ledger at its first
  // order, no cosmetic; Beyond is absent until it opens. Belts' second items (Wide Belts) are absent.
  9: (d) => {
    if (typeof d.snap !== 'string') return { ...d, v: 10 };
    const st = JSON.parse(d.snap);
    const m = (st.meta ??= {});
    m.kernels ??= 'N:0';
    m.kernelsEarned ??= 'N:0';
    m.kernelNodes ??= [];
    m.lastFolds ??= 0;
    m.seeds ??= [];
    m.keptLegacy ??= [];
    m.ledger ??= { n: 0, progress: {} };
    m.cosmetics ??= [];
    return { ...d, snap: JSON.stringify(st), v: 10 };
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

// ---------------------------------------------------------------- robust saves (Milestone 6, DESIGN.md §20)
// The main slot, plus rolling backups (_bak1 newest .. _bakN oldest) taken from the save being
// replaced, at most one every `backupMs`, and only from a save that loads (a broken save never
// pushes a good backup out). On load the main save is validated (parsed, migrated, and checked by
// the game's own `validate`, which rebuilds the game from it); if it fails, the raw string is kept
// aside in _bad, and the newest backup that loads is used, with the reason in plain words.

export const bakKey = (slot: number, i: number) => `${PREFIX}${slot}_bak${i}`;
export const badKey = (slot: number) => `${PREFIX}${slot}_bad`;
const metaKey = (slot: number) => `${PREFIX}${slot}_meta`;

export interface SafeWriteOpts {
  /** ms since epoch now (the app's clock) */
  now: number;
  /** take a backup at most this often */
  backupMs: number;
  /** how many backups to keep */
  backups: number;
  /** throws when a save does not load (the game's own check) */
  validate?: (d: SaveData) => void;
}

/** Parse, migrate and check a raw save string; throws an Error whose message is plain words. */
export function parseSave(raw: string, validate?: (d: SaveData) => void): SaveData {
  let d: any;
  try {
    d = JSON.parse(raw);
  } catch {
    throw new Error('it was cut short or garbled');
  }
  if (!d || typeof d !== 'object') throw new Error('it holds no game');
  let m: SaveData;
  try {
    m = migrate(d);
  } catch (err) {
    const msg = (err as Error).message;
    throw new Error(/newer/.test(msg) ? 'it comes from a newer version of Foldworks' : 'it is from an old version with no way to update it');
  }
  if (validate) {
    try {
      validate(m);
    } catch {
      throw new Error('its factory could not be rebuilt from it');
    }
  }
  return m;
}

/** Write a save, first rotating the one it replaces into the backups when one is due. */
export function writeSaveSafe(slot: number, payload: { seed: number; saved: number }, o: SafeWriteOpts, s: Storage | null = store()): { ok: boolean; rotated: boolean; why?: string } {
  if (!s) return { ok: false, rotated: false, why: 'this browser keeps no saves (private window?)' };
  let rotated = false;
  try {
    const meta = readMeta(slot, s);
    const prev = s.getItem(PREFIX + slot);
    if (prev && o.now - meta.lastBackup >= o.backupMs) {
      let good = true;
      try { parseSave(prev, o.validate); } catch { good = false; }
      if (good) {
        for (let i = o.backups; i > 1; i--) {
          const v = s.getItem(bakKey(slot, i - 1));
          if (v !== null) s.setItem(bakKey(slot, i), v);
        }
        s.setItem(bakKey(slot, 1), prev);
        s.setItem(metaKey(slot), JSON.stringify({ lastBackup: o.now }));
        rotated = true;
      }
    }
  } catch (err) {
    console.error('backup failed', err);
  }
  const body = JSON.stringify({ ...payload, v: SAVE_VERSION });
  try {
    s.setItem(PREFIX + slot, body);
    return { ok: true, rotated };
  } catch {
    // out of room: give up the oldest backup and try once more
    try {
      s.removeItem(bakKey(slot, o.backups));
      s.removeItem(badKey(slot));
      s.setItem(PREFIX + slot, body);
      return { ok: true, rotated };
    } catch (err) {
      console.error('save failed', err);
      return { ok: false, rotated, why: 'the browser is out of room for saves' };
    }
  }
}

function readMeta(slot: number, s: Storage): { lastBackup: number } {
  try {
    const m = JSON.parse(s.getItem(metaKey(slot)) ?? '{}');
    return { lastBackup: typeof m.lastBackup === 'number' ? m.lastBackup : 0 };
  } catch {
    return { lastBackup: 0 };
  }
}

export interface LoadResult {
  data: SaveData | null;
  /** where it came from: 'main', or 'bak1' (newest backup) ... */
  from: string | null;
  /** what was wrong with the main save, in plain words (null when it loaded) */
  problem: string | null;
  /** the broken string was kept aside under _bad */
  keptBad: boolean;
}

/** Load a slot: the main save if it validates, else the newest backup that does. */
export function loadSave(slot: number, validate?: (d: SaveData) => void, backups = 3, s: Storage | null = store()): LoadResult {
  if (!s) return { data: null, from: null, problem: null, keptBad: false };
  const raw = s.getItem(PREFIX + slot);
  let problem: string | null = null;
  let keptBad = false;
  if (raw) {
    try {
      return { data: parseSave(raw, validate), from: 'main', problem: null, keptBad: false };
    } catch (err) {
      problem = (err as Error).message;
      try {
        s.setItem(badKey(slot), raw);
        keptBad = true;
      } catch { /* no room: the backup still loads */ }
    }
  }
  for (let i = 1; i <= backups; i++) {
    const b = s.getItem(bakKey(slot, i));
    if (!b) continue;
    try {
      return { data: parseSave(b, validate), from: 'bak' + i, problem: problem ?? 'the save was missing', keptBad };
    } catch { /* try the next one */ }
  }
  return { data: null, from: null, problem, keptBad };
}

/** The broken save kept aside, if any (to export and send in). */
export function badSave(slot: number, s: Storage | null = store()): string | null {
  return s?.getItem(badKey(slot)) ?? null;
}

/** Autosave cadence (DESIGN.md §20): due every `everyMs` of real time since the last save. */
export class AutoSave {
  last: number;
  constructor(public everyMs: number, now: number) {
    this.last = now;
  }
  due(now: number): boolean {
    return now - this.last >= this.everyMs;
  }
  mark(now: number) {
    this.last = now;
  }
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
