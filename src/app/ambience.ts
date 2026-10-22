// The app's side of the ambience (Milestone 12): what is working on the floor on screen, as
// sources for the mixer (src/engine/audio/mix.ts), about ten times a second. The Workshop gives
// its working machines by family and its belt tiles that moved an item; the Factory its working
// modules and its trunks carrying; the District its working groups and its routes' skiffs in
// flight. A panel open over the floor ducks the mix; the title screen and a hidden tab hush it.
// Reads the Game and the camera; never writes either.
import type { App } from './app';
import type { Ent, FEnt } from '../sim/world';
import { mix, type Fam, type Src, type Voice } from '../engine/audio/mix';
import { TICK_RATE } from '../engine/time';
import { hent } from '../sim/systems/high';

/** The family a Workshop building sounds as (null: it makes no sound of its own). */
export function familyOf(kind: string): Fam | null {
  switch (kind) {
    case 'miner': return 'miner';
    case 'smelter': case 'furnace': case 'smelterMk2': return 'smelter';
    case 'press': case 'pressMk2': return 'press';
    case 'assembler': case 'assemblerMk2': return 'assembler';
    case 'kiln': case 'mixer': case 'refinery': return 'kiln';
    case 'chemVat': return 'chem';
    case 'greenhouse': return 'green';
    case 'boiler': case 'steamEngine': case 'generator': return 'power';
    default: return null;
  }
}

/** Where a thing at tile (tx, ty) is across the view (0..1), or null when it is off screen. */
export type Place = (tx: number, ty: number) => number | null;

/** The Workshop's sources: working machines by family, belts that moved an item this tick. */
export function workshopSources(ents: { machines: readonly Ent[]; miners: readonly Ent[]; power: readonly Ent[]; belts: readonly Ent[] }, at: Place): Src[] {
  const out: Src[] = [];
  for (const list of [ents.miners, ents.machines, ents.power]) {
    for (const e of list) {
      if (e.state !== 'work' || e.paused) continue;
      const fam = familyOf(e.kind);
      if (!fam) continue;
      const x = at(e.x + e.w / 2, e.y + e.h / 2);
      if (x !== null) out.push({ fam, x });
    }
  }
  for (const b of ents.belts) {
    if (!b.mv) continue;
    const x = at(b.x + 0.5, b.y + 0.5);
    if (x !== null) out.push({ fam: 'belt', x });
  }
  return out;
}

/** A Factory or District floor's modules (working) and trunks (carrying). */
export function floorSources(ents: readonly FEnt[], at: Place): Src[] {
  const out: Src[] = [];
  for (const e of ents) {
    const x = at(e.x + e.w / 2, e.y + e.h / 2);
    if (x === null) continue;
    if (e.kind === 'module' && e.state === 'work') out.push({ fam: 'module', x });
    else if (e.kind === 'trunk' && e.flow > 0.01) out.push({ fam: 'belt', x, w: 0.5 });
  }
  return out;
}

let acc = 0;
let hushed = true;
let last: Voice[] = [];

/** Once a frame from the app's loop: mix what works on screen into the ambience. */
export function ambience(app: App, dt: number) {
  const a = app.audio;
  if (!a.ctx) return;
  if (app.screen !== 'play' || (typeof document !== 'undefined' && document.hidden) || app.offlineJob) {
    if (!hushed) { a.amb.hush(); hushed = true; }
    return;
  }
  acc += dt;
  // the sources are gathered ten times a second; the voices tick every frame
  if (acc < 0.1 && !hushed) { a.ambience(last, dt); return; }
  hushed = false;
  acc = 0;
  const g = app.game, r = app.renderer, v = r.view;
  const at: Place = (tx, ty) => {
    const s = r.toScreen(tx, ty);
    if (s.x < v.x - 8 || s.x > v.x + v.w + 8 || s.y < v.y - 8 || s.y > v.y + v.h + 8) return null;
    return v.w > 0 ? (s.x - v.x) / v.w : 0.5;
  };
  let srcs: Src[];
  if (app.floor === 'factory') srcs = floorSources(g.s.factory.ents, at);
  else if (app.floor === 'district') {
    const st = g.s.district;
    srcs = st ? floorSources(st.ents, at) : [];
    // skiffs in flight: each busy route's skiffs, heard at the middle of its flight line
    if (st) for (const rt of st.routes) {
      if (!(rt.flow > 0.01 || (rt.used !== undefined && g.s.tick - rt.used < TICK_RATE))) continue;
      const p = hent(g, 'district', rt.from), q = hent(g, 'district', rt.to);
      if (!p || !q) continue;
      const x = at((p.x + p.w / 2 + q.x + q.w / 2) / 2, (p.y + p.h / 2 + q.y + q.h / 2) / 2);
      if (x !== null) srcs.push({ fam: 'skiff', x, w: Math.max(1, rt.skiffs) });
    }
  } else if (app.floor === 'workshop') srcs = workshopSources(g, at);
  else srcs = [];
  last = mix(srcs, { duck: app.panel !== null });
  a.ambience(last, dt);
}
