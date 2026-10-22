// The world renderer: a camera at an integer zoom, baked ground chunks, then buildings, items on
// belts (interpolated between ticks), status pips, Sparks, the placement overlays and the effects
// the sim's events ask for. Act II (DESIGN.md §18) adds power: wires between linked Poles, the
// reach overlay, brownout flicker, the blue pip, smoke from burners, the Overdrive glow and its
// cooling arc, 2x2 Mk2 machines and their ghosts. Reads the Game; never writes it.
import { C, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import { DX, DY, opposite, type Dir, type Ent, type Floor } from '../sim/world';
import { drawFactory, type FactoryOverlay } from './factory';
import { auditTicks } from '../sim/systems/audits';
import { poleReach } from '../sim/systems/power';
import { CHUNKS, PATCHES } from '../data/land';
import { BUILD, isMachine, isPower, type BuildKind } from '../data/machines';
import { ITEMS } from '../data/items';
import { RULES } from '../data/rules';
import { TICK_RATE } from '../engine/time';
import type { GameEvent } from '../engine/events';
import { drawText, textWidth, bigWidth, ICON } from '../ui/font';
import { T, onPaper } from '../ui/theme';
import { paperRaw, tagRaw, chipRaw, coinRaw, COIN_W, outlinedText } from '../ui/paper';
import { Ground, TILE } from './ground';
import { drawOreFx } from './orefx';
import { sheet, drawRot, frameAt, itemIcon, hasArt, spriteName } from './sprites';
import { Fx, FOLD_DUR, FOLD_FLASH } from './fx';
import { onGridKind, powered, gridIndex, cheb, wirePairs, reached, capacity } from './powerview';
import { Town, TOWN_ROWS } from './town';
import { drawSky } from './sky';
import { Island } from './island';
import { Platform } from './factory';
import { DistrictPlatform, drawDistrict, type DistrictOverlay } from './district';
import { HIGH } from '../data/floors';
import { highW } from '../sim/systems/high';

/** seconds the paving takes to spread over a bought chunk */
const PAVE_S = 0.7;

export class Camera {
  /** centre, in world pixels */
  x = 64;
  y = 64;
  zoom = 3;
}

export interface Overlay {
  /** the tile under the mouse (null when the mouse is over the HUD) */
  hover: { x: number; y: number } | null;
  /** placing this building: a ghost at hover with the rotation */
  build: BuildKind | null;
  rot: Dir;
  /** a dragged belt line being laid */
  drag: { x: number; y: number; rot: Dir }[] | null;
  remove: boolean;
  /** the entity whose report is open */
  selected: number | null;
  /** the fold box being dragged (tile rect, inclusive corners) */
  box: { x0: number; y0: number; x1: number; y1: number; ok: boolean } | null;
  /** the flow overlay is on */
  flow: boolean;
  /** which floor is on screen, and the Factory floor's own overlay */
  floor: Floor;
  factory: FactoryOverlay;
  /** the District's own overlay (DESIGN.md §21) */
  district: DistrictOverlay;
}

/** screen-space labels collected during the world pass, drawn on top at UI scale */
interface Label { x: number; y: number; text: string; color: string; bg: string; /** widest it may be, screen px */ max?: number; /** used when text does not fit */ short?: string;
  /** land for sale (the 180): a "for sale" sign tag with a price chip, its short form the chip alone */
  sale?: { name: string; price: string; ready: boolean; afford: boolean } }

const PIP: Record<string, string> = { work: C.pipGreen, starved: C.pipYellow, blocked: C.pipRed, idle: C.pipGrey };

/** a sound the renderer wants played with an effect (the HUD drains these into the audio) */
export interface SoundReq { id: string; v: number; p: number }

export class Renderer {
  /** which floor is drawn; each floor keeps its own camera */
  floor: Floor = 'workshop';
  cams: Record<Floor, Camera> = { workshop: new Camera(), factory: new Camera(), district: new Camera(), world: new Camera() };
  get cam(): Camera {
    return this.cams[this.floor];
  }
  ground: Ground | null = null;
  fx = new Fx();
  W = 0;
  H = 0;
  /** real time in seconds, for animation */
  time = 0;
  labels: Label[] = [];
  /** per-belt: the side it is fed from when that is a turn (cached per layout version) */
  private turns = new Map<number, -1 | 1>();
  private turnsV = -1;
  /** the screen point coins fly to (the HUD's coin counter), set by the app */
  coinTarget = { x: 40, y: 12 };
  /** the screen point a folded module flies to (the Factory floor tab), set by the HUD */
  factoryTarget: { x: number; y: number } | null = null;
  /** per-machine blink phase start when it became blocked */
  private jamSince = new Map<number, number>();
  /** recent crafting flashes: entity id -> time */
  private flashes = new Map<number, number>();
  /** buildings just placed on the Workshop (tile key y * 4096 + x -> time): they drop in from
   *  above and land with a squash and a puff of dust (the sky island: a tycoon's build, felt) */
  private drops = new Map<number, { t: number; landed: boolean }>();
  /** sounds to play with the effects, drained by the HUD each frame */
  sounds: SoundReq[] = [];
  /** events that celebrate over the whole screen whatever floor is shown (the HUD draws them) */
  screenEvents: GameEvent[] = [];
  /** the wires between linked Poles (cached per layout version) */
  private wires: [Ent, Ent][] = [];
  private wiresV = -1;
  /** when each burner last puffed smoke */
  private smokeAt = new Map<number, number>();
  /** pictures of the graded fold boxes, taken while their grades wait (the fold animation folds
   *  the right one), keyed by box */
  private foldSnaps = new Map<string, { x: number; y: number; w: number; h: number; img: HTMLCanvasElement; t: number }>();
  /** any grid browned out last frame (a fizz when one starts) */
  private wasBrown = false;
  /** Bramble's Town in the water around the floors */
  town = new Town();
  /** the Festival's Gizmo parade along the trunks into the Factory Dock (Factory-floor world px) */
  parade: { t: number; n: number; paths: { x: number; y: number }[][]; dock: { x: number; y: number } } | null = null;
  /** town news lines for the Gazette, drained by the HUD */
  townNews: string[] = [];
  /** the sky island under the Workshop, and the Factory's sky platform (docs/sky-island.md) */
  isle = new Island();
  plat = new Platform();
  /** the District's sky platform (DESIGN.md §21), higher and brighter than the Factory's */
  dplat = new DistrictPlatform();
  /** chunks being paved over after a buy: the wave's centre (tile units), its age, which tiles
   *  it has reached (a dust puff as it reaches each) */
  private paving: { id: string; x: number; y: number; t: number; hit: Uint8Array }[] = [];

  constructor(public ctx: CanvasRenderingContext2D) {}

  /** the part of the screen the floor is seen through (between the HUD columns), screen px */
  view = { x: 0, y: 0, w: 0, h: 0 };

  resize(W: number, H: number, view?: { x: number; y: number; w: number; h: number }) {
    this.W = W;
    this.H = H;
    this.view = view ?? { x: 0, y: 0, w: W, h: H };
  }

  /** screen point the camera centre sits on */
  private mid() {
    return { mx: this.view.x + this.view.w / 2, my: this.view.y + this.view.h / 2 };
  }

  /** Screen pixel offset of world pixel (0, 0). */
  origin() {
    const c = this.cam;
    const sx = this.fx.shake ? Math.round((Math.random() - 0.5) * this.fx.shake) : 0;
    const sy = this.fx.shake ? Math.round((Math.random() - 0.5) * this.fx.shake) : 0;
    const { mx, my } = this.mid();
    return { ox: Math.round(mx - Math.round(c.x) * c.zoom) + sx, oy: Math.round(my - Math.round(c.y) * c.zoom) + sy };
  }

  screenToTile(sx: number, sy: number) {
    const c = this.cam;
    const { mx, my } = this.mid();
    const ox = Math.round(mx - Math.round(c.x) * c.zoom), oy = Math.round(my - Math.round(c.y) * c.zoom);
    return { x: Math.floor((sx - ox) / c.zoom / TILE), y: Math.floor((sy - oy) / c.zoom / TILE) };
  }

  /** Screen position of a point in tile units (no shake). */
  toScreen(tx: number, ty: number) {
    const c = this.cam;
    const { mx, my } = this.mid();
    const ox = Math.round(mx - Math.round(c.x) * c.zoom), oy = Math.round(my - Math.round(c.y) * c.zoom);
    return { x: ox + tx * TILE * c.zoom, y: oy + ty * TILE * c.zoom };
  }

  clampCam(wTiles: number, hTiles: number) {
    const c = this.cam;
    const mw = wTiles * TILE, mh = hTiles * TILE;
    const halfW = this.view.w / 2 / c.zoom, halfH = this.view.h / 2 / c.zoom;
    // the rim either side may be scrolled to; above, the town on the north rim (and a row of sky
    // over it); below, the south rim and the cliff under it (the sky island)
    const pad = 4 * TILE;
    const top = (TOWN_ROWS + 1) * TILE;
    const bot = this.floor === 'factory' ? this.plat.below : this.floor === 'district' ? this.dplat.below : this.isle.below;
    c.x = mw + pad * 2 <= halfW * 2 ? mw / 2 : Math.max(halfW - pad, Math.min(mw + pad - halfW, c.x));
    // zoomed out far enough for the whole island (or platform) to show: frame all of it; else the
    // player may pan on down past the cliff to the island's point
    const B = this.floor === 'factory' ? this.plat.bounds() : this.floor === 'district' ? this.dplat.bounds() : this.isle.bounds();
    const low = Math.max(mh + bot, B.y1);
    if (B.y1 > B.y0 && B.y1 - B.y0 <= halfH * 2) c.y = (B.y0 + B.y1) / 2;
    else c.y = mh + top + bot <= halfH * 2 ? Math.max((mh + bot - top) / 2, Math.min(low - halfH, c.y)) : Math.max(halfH - top, Math.min(low - halfH, c.y));
  }

  /** World pixel under a screen pixel. */
  screenToWorld(sx: number, sy: number) {
    const c = this.cam;
    const { mx, my } = this.mid();
    const ox = Math.round(mx - Math.round(c.x) * c.zoom), oy = Math.round(my - Math.round(c.y) * c.zoom);
    return { x: (sx - ox) / c.zoom, y: (sy - oy) / c.zoom };
  }

  /** The town piece under a screen pixel: its one-line label. */
  townAt(sx: number, sy: number): string | null {
    const w = this.screenToWorld(sx, sy);
    return this.town.at(w.x, w.y)?.label ?? null;
  }

  private sfx(id: string, v = 1, p = 1) {
    if (this.sounds.length < 16) this.sounds.push({ id, v, p });
  }

  // ---------------------------------------------------------------- events -> effects

  consume(evs: GameEvent[], g: Game) {
    const fx = this.fx;
    for (const e of evs) {
      // celebrations that belong to the whole screen, whichever floor is shown
      if (e.type === 'megaDone' || e.type === 'claim') {
        this.screenEvents.push(e);
        this.sfx(e.type === 'megaDone' ? 'fanfare' : 'claim');
      }
      if (e.type === 'codex') this.sfx('codex');
      if (e.type === 'parts') this.sfx('kit', 0.7);
      if (e.type === 'order' && e.id) {
        this.town.times[e.id] = e.tick;
        this.orderCascade(g, e.id);
        if (e.id === 'gizmoFestival') this.startParade(g);
      }
      if ((e.floor ?? 'workshop') !== this.floor) continue;
      const px = (e.x ?? 0) * TILE, py = (e.y ?? 0) * TILE;
      switch (e.type) {
        case 'sell': {
          fx.pop(px, py - 4, e.value ?? 0, 'sell', C.gold);
          if (Math.random() < 0.5) {
            const s = this.toScreen(e.x ?? 0, e.y ?? 0);
            fx.fly(s.x, s.y, this.coinTarget.x, this.coinTarget.y);
          }
          break;
        }
        case 'firstSale': {
          // the first coin: a fountain out of the Dock and a ring
          fx.fountain(px + 8, py, 36, [C.gold, C.hot, C.brass1, C.bone], 110, 2, 1.3);
          fx.ring(px + 8, py + 8, C.gold, 34, 0.8, 4);
          fx.text(px + 8, py - 22, 'FIRST SALE!', C.gold, 2.2, true);
          fx.kick(3);
          for (let i = 0; i < 6; i++) {
            const s = this.toScreen((e.x ?? 0) + 0.5, e.y ?? 0);
            fx.fly(s.x + (i - 3) * 6, s.y, this.coinTarget.x, this.coinTarget.y);
          }
          this.sfx('codex', 0.8);
          break;
        }
        case 'hopper': fx.pop(px, py - 4, 1, 'hop:' + e.id, C.ice, e.id ?? null); fx.burst(px, py, 2, [C.ice, C.sky], 20, 40); break;
        case 'orderFill': fx.pop(px, py - 4, 1, 'ord:' + e.id, C.lime, e.id ?? null); break;
        case 'mine': fx.burst(px + 8, py + 8, 5, [C.steel, C.fog, C.sky], 40, 120); break;
        case 'crank': fx.burst(px + 12, py + 6, 2, [C.amber, C.gold], 20, 50); break;
        case 'shovel': fx.burst(px + 8, py + 8, 6, [C.plum, C.violet, C.iron], 45, 140); break;
        case 'craft': {
          this.flashes.set(e.value ?? 0, this.time);
          if (e.id === 'ironIngot' || e.id === 'copperIngot' || e.id === 'steel') fx.burst(px + 8, py + 4, 2, [C.amber, C.gold, C.orange], 18, -10, 1, 0.7);
          break;
        }
        case 'place': {
          const big = e.id && e.id in BUILD ? BUILD[e.id as BuildKind].w : 1;
          const c = big * 8;
          // belts are laid flat (a drag lays dozens); anything that stands up drops in, and its
          // dust and ring wait for the landing (building())
          if (e.id === 'belt' || e.floor) {
            fx.burst(px + c, py + c * 2 - 2, 6 * big, [C.tan, C.clay, C.fog], 30, 80);
            fx.ring(px + c, py + c, C.bone, 10 * big, 0.25, 6);
          } else this.drops.set((e.y ?? 0) * 4096 + (e.x ?? 0), { t: this.time, landed: false });
          if (e.id === 'pole') { fx.ring(px + 8, py + 8, C.teal1, (poleReach(g) + 0.5) * TILE, 0.5, 6); this.sfx('powerOn', 0.5); }
          if (e.floor === 'district' && e.id === 'module' && (g.s.counters.districtPlaced ?? 0) <= 1) {
            // the first group up on the District
            fx.burst(px + 8, py + 8, 40, [C.gold, C.brass1, C.hot, C.bone], 80, 40, 1, 1.1);
            fx.ring(px + 8, py + 8, C.gold, 30, 0.8, 4);
            fx.text(px + 8, py - 14, 'FIRST DISTRICT GROUP!', C.gold, 2, true);
            fx.kick(4);
            this.sfx('fanfare', 0.6);
          }
          if (e.floor === 'factory' && e.id === 'module' && (g.s.counters.modulesPlaced ?? 0) <= 1) {
            // the first module on the Factory floor
            fx.burst(px + 8, py + 8, 40, [C.gold, C.brass1, C.hot, C.bone], 80, 40, 1, 1.1);
            fx.ring(px + 8, py + 8, C.gold, 30, 0.8, 4);
            fx.text(px + 8, py - 14, 'FIRST MODULE!', C.gold, 2, true);
            fx.kick(4);
            this.sfx('fanfare', 0.6);
          }
          break;
        }
        case 'remove': fx.burst(px + 8, py + 8, 8, [C.steel, C.iron, C.fog], 40, 100); break;
        case 'land': {
          // the meadow is paved over in a wave from the middle out (drawn in draw()), a coin
          // shower out of the middle and a thump
          const ch = CHUNKS.find((c) => c.id === e.id);
          if (ch) this.paving.push({ id: ch.id, x: e.x ?? ch.x + ch.w / 2, y: e.y ?? ch.y + ch.h / 2, t: 0, hit: new Uint8Array(ch.w * ch.h) });
          fx.fountain(px, py, 46, [C.gold, C.hot, C.brass1, C.gold], 120, 2, 1.3);
          fx.ring(px, py, C.gold, 70, 0.8, 8);
          const s = this.toScreen(e.x ?? 0, e.y ?? 0);
          for (let i = 0; i < 12; i++) fx.fly(s.x + ((i % 4) - 2) * 6, s.y - (i % 3) * 4, this.coinTarget.x, this.coinTarget.y, undefined, false, 0.2 + i * 0.05);
          fx.kick(4);
          this.sfx('stampLand', 0.7);
          break;
        }
        case 'upgrade': {
          const f = g.machines.find((m) => m.kind === 'furnace');
          if (f) { fx.burst(f.x * TILE + 8, f.y * TILE + 8, 24, [C.orange, C.amber, C.gold, C.bone], 50, -20, 1, 0.9); fx.ring(f.x * TILE + 8, f.y * TILE + 8, C.amber, 24, 0.6); }
          break;
        }
        case 'spark': fx.ring(px + 8, py + 8, C.gold, 20, 0.8, 4); break;
        case 'sparkGet': fx.burst(px + 8, py + 8, 30, [C.gold, C.bone, C.amber, C.lime], 70, 40, 1, 1); fx.ring(px + 8, py + 8, C.gold, 28, 0.6); if (e.value) fx.pop(px + 8, py - 6, e.value, 'spark', C.gold, null, '+', true); break;
        case 'sparkMiss': fx.burst(px + 8, py + 8, 6, [C.fog, C.steel], 20, -10); break;
        case 'inspected': fx.text(px + 8, py - 18, 'Grade ' + (e.id ?? ''), C.bone, 1.8, true); break;
        case 'inspectGift': if (e.value) fx.pop(px + 8, py - 30, e.value, 'gift', C.teal1, e.id ?? null, '+', true); break;
        case 'order': fx.kick(3); break;
        case 'firstSlagJam': fx.ring(px + 8, py + 8, C.pipRed, 18, 0.8); break;
        // ---- Act II
        case 'overdrive': {
          // x, y is the machine's (or module's) centre tile; d is how many it set running hot
          const cx = px + 8, cy = py + 8;
          const n = e.d ?? 1;
          if (e.floor === 'factory' || e.floor === 'district') {
            // a module and every module trunked (or flown) to it: a burst on each, a big one on the clicked
            for (const m of e.floor === 'district' ? g.s.district?.ents ?? [] : g.s.factory.ents) {
              if (m.kind !== 'module' || !(m.od ?? 0) || m.id === e.value) continue;
              fx.burst(m.x * TILE + 8, m.y * TILE + 8, 12, [C.hot, C.glow, C.gold], 55, 20, 1, 0.6);
              fx.ring(m.x * TILE + 8, m.y * TILE + 8, C.glow, 14, 0.4, 4);
            }
            fx.burst(cx, cy, 34, [C.hot, C.glow, C.gold, C.copper2, C.bone], 100, 30, 1, 0.9);
            fx.ring(cx, cy, C.glow, 24, 0.45, 6);
            fx.ring(cx, cy, C.hot, 34, 0.7, 10);
            fx.text(cx, cy - 22, '3x!', C.hot, 1.4, true);
            if (n > 1) fx.text(cx, cy - 8, `Group overdriven x${n}`, C.gold, 1.8);
            fx.kick(n > 1 ? 4 : 3);
            this.sfx('overdrive');
            if (n > 1) this.sfx('powerOn', 0.5, 1.4);
            break;
          }
          const ent = g.byId.get(e.value ?? -1);
          const r = ent && ent.w > 1 ? 24 : 14;
          fx.burst(cx, cy, 28, [C.hot, C.glow, C.gold, C.copper2], 90, 30, 1, 0.8);
          fx.ring(cx, cy, C.glow, r + 10, 0.45, r - 6);
          fx.ring(cx, cy, C.hot, r + 18, 0.7, r);
          fx.text(cx, cy - r - 10, '3x!', C.hot, 1.4, true);
          if (n > 1) fx.text(cx, cy - r + 4, `Line overdriven x${n}`, C.gold, 1.8);
          fx.kick(n > 1 ? 4 : 3);
          this.sfx('overdrive');
          if (n > 1) this.sfx('powerOn', 0.5, 1.4);
          break;
        }
        case 'overdriveLine': {
          // the rest of the clicked machine's line: a smaller burst and ring on each
          const ent = g.byId.get(e.value ?? -1);
          const c = ent && ent.w > 1 ? 16 : 8;
          const bx = (ent ? ent.x * TILE : px) + c, by = (ent ? ent.y * TILE : py) + c;
          fx.burst(bx, by, 12, [C.hot, C.glow, C.gold], 55, 20, 1, 0.6);
          fx.ring(bx, by, C.glow, c + 8, 0.4, c - 4);
          break;
        }
        case 'mode': {
          const ent = g.entAt(e.x ?? 0, e.y ?? 0);
          const c = ent && ent.w > 1 ? 16 : 8;
          fx.ring(px + c, py + c, C.teal1, c + 8, 0.4, c - 2);
          fx.text(px + c, py - 6, MODE_WORD[e.id ?? ''] ?? '', C.teal1, 1.2);
          this.sfx('mode');
          break;
        }
        case 'codex': {
          // a gold fountain out of the Dock and a big number
          fx.fountain(px + 8, py, 44, [C.gold, C.hot, C.brass1, C.gold], 120, 2, 1.4);
          fx.ring(px + 8, py + 8, C.gold, 30, 0.7, 4);
          fx.pop(px + 8, py - 18, e.value ?? 0, 'codex', C.gold, e.id ?? null, '+', true);
          fx.kick(2);
          const s = this.toScreen((e.x ?? 0) + 0.5, e.y ?? 0);
          for (let i = 0; i < 8; i++) fx.fly(s.x + (i - 4) * 5, s.y, this.coinTarget.x, this.coinTarget.y);
          break;
        }
        case 'parts': {
          fx.pop(px + 8, py - 10, e.value ?? 1, 'kit', C.brass1, 'machineKit', '+', true);
          fx.burst(px + 8, py + 4, 10, [C.brass1, C.brass0, C.hot], 45, 60);
          fx.ring(px + 8, py + 8, C.brass1, 16, 0.4, 4);
          break;
        }
        case 'fold': {
          if (e.floor === 'factory' || e.floor === 'district') {
            fx.burst(px, py, 40, [C.gold, C.brass1, C.hot, C.bone], 90, 30, 1, 1);
            fx.ring(px, py, C.gold, 40, 0.8, 6);
            break;
          }
          // the picture of this box: the snapshot whose centre and area match the event's
          let snap: { x: number; y: number; w: number; h: number; img: HTMLCanvasElement | null } | null = null;
          for (const [key, q] of this.foldSnaps)
            if (q.x + q.w / 2 === e.x && q.y + q.h / 2 === e.y && q.w * q.h === (e.d ?? q.w * q.h)) { snap = q; this.foldSnaps.delete(key); break; }
          const side = Math.max(1, Math.round(Math.sqrt(e.d ?? 4)));
          const box = snap ?? { x: Math.round((e.x ?? 0) - side / 2), y: Math.round((e.y ?? 0) - side / 2), w: side, h: side, img: null };
          fx.folds.push({ x: box.x * TILE, y: box.y * TILE, w: box.w * TILE, h: box.h * TILE, img: snap?.img ?? null, t: 0, letter: e.id ?? '' });
          this.sfx('whoosh');
          break;
        }
        case 'route': {
          // a new route: a ring at each end, the first skiff off
          const x2 = (e.x2 ?? e.x ?? 0) * TILE, y2 = (e.y2 ?? e.y ?? 0) * TILE;
          fx.ring(px + 8, py + 8, C.lamp2, 14, 0.4, 4);
          fx.ring(x2 + 8, y2 + 8, C.lamp2, 14, 0.5, 4);
          this.sfx('place', 0.7, 1.3);
          break;
        }
        case 'firstRoute': fx.text(px + 8, py - 14, 'FIRST SKIFF ROUTE!', C.gold, 2, true); fx.kick(3); this.sfx('fanfare', 0.5); break;
        case 'bayOpen': fx.ring(px, py, C.gold, 40, 0.9, 6); fx.burst(px, py, 30, [C.gold, C.iron2, C.hot], 70, 40, 1, 1); fx.kick(3); break;
        case 'megaGive': fx.pop(px, py - 20, e.value ?? 1, 'mega:' + e.id, C.gold, e.id ?? null); fx.burst(px, py, 4, [C.gold, C.iron2], 25, 40); break;
        case 'megaDone': fx.ring(px, py, C.gold, 60, 1.2, 6); fx.burst(px, py, 80, [C.gold, C.hot, C.bone, C.iron2], 120, 40, 2, 1.6); break;
      }
    }
  }

  // ---------------------------------------------------------------- draw

  draw(g: Game, dt: number, alpha: number, ov: Overlay) {
    const ctx = this.ctx;
    this.time += dt;
    if (!this.ground || this.ground.game !== g) {
      this.ground = new Ground(g);
      // a wave from a game that is gone would pave land this one does not own
      this.paving.length = 0;
    }
    this.labels.length = 0;
    const z = this.cam.zoom;
    const { ox, oy } = this.origin();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // the sky over the whole canvas (the HUD floats over the floor), then the island in the world
    drawSky(ctx, this.W, this.H, this.cam, this.time, ov.floor);
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.imageSmoothingEnabled = false;
    if (ov.floor === 'district') {
      // the District (DESIGN.md §21): its own platform, no town up here
      this.dplat.draw(ctx, highW(g, 'district'), HIGH.district.h, this.time);
      const a = this.screenToWorld(this.view.x, this.view.y), b = this.screenToWorld(this.view.x + this.view.w, this.view.y + this.view.h);
      drawDistrict(ctx, g, this.time, ov.district, { x0: a.x, y0: a.y, x1: b.x, y1: b.y });
      this.effects(dt);
      return;
    }
    if (ov.floor === 'factory') this.plat.draw(ctx, g.fw, g.fh, this.time);
    else this.isle.draw(ctx, g.W, g.H, this.time);
    // Bramble's Town on the north rim, behind the floor
    if (ov.floor === 'factory') this.town.draw(ctx, g, g.fw, g.fh, this.time, 'factory');
    else this.town.draw(ctx, g, g.W, g.H, this.time, 'workshop');
    for (const n of this.town.news) {
      this.fx.burst(n.x, n.y, 30, [C.gold, C.leaf, C.bone, C.hot], 70, 40, 1, 1);
      this.fx.ring(n.x, n.y, C.gold, 28, 0.7, 4);
      this.sfx('land', 0.7);
      this.townNews.push(n.text);
    }
    this.town.news.length = 0;
    if (ov.floor === 'factory') {
      drawFactory(ctx, g, this.time, ov.factory, (this.view.x + this.view.w - ox) / z);
      this.drawParade(g, dt);
      this.effects(dt);
      return;
    }

    for (const ch of CHUNKS) {
      const w = this.paving.length ? this.paving.find((p) => p.id === ch.id) : undefined;
      if (w) this.paveWave(ch, w, dt);
      else ctx.drawImage(this.ground.chunk(ch.id), ch.x * TILE, ch.y * TILE);
    }
    this.landLabels(g);
    this.veins(g);
    drawOreFx(ctx, g, this.time, -ox / z, -oy / z, this.W / z, this.H / z);

    if (this.turnsV !== g.version) this.computeTurns(g);

    // belts first (flat on the floor), then the power wires, then the belts' items, then
    // everything that stands up
    for (const b of g.belts) this.belt(g, b);
    this.drawWires(g);
    for (const b of g.belts) if (b.item) this.beltItem(b, alpha);
    for (const e of g.s.ents) if (e.kind !== 'belt') this.building(g, e);
    this.sparks(g);
    this.snapFold(g);
    this.overlays(g, ov);
    this.effects(dt);
    // a fizz when a grid starts browning out
    const brown = g.grids.some((gr) => gr.demand > 0 && gr.sat < 1);
    if (brown && !this.wasBrown) this.sfx('brownout', 0.6);
    this.wasBrown = brown;
  }

  /** A bought chunk paving itself (docs/sky-island.md): the meadow under, the paving laid tile by
   *  tile in a ring spreading from the middle over PAVE_S, a puff of dust where it reaches. */
  private paveWave(ch: { id: string; x: number; y: number; w: number; h: number }, w: { id: string; x: number; y: number; t: number; hit: Uint8Array }, dt: number) {
    const ctx = this.ctx;
    const X = ch.x * TILE, Y = ch.y * TILE;
    w.t += dt;
    const meadow = this.ground!.bake(ch.id, false), paved = this.ground!.bake(ch.id, true);
    ctx.drawImage(meadow, X, Y);
    const reach = Math.hypot(ch.w, ch.h) / 2 + 0.5;
    const r = (Math.min(1, w.t / PAVE_S) ** 0.8) * reach;
    const dust = [C.pave2, C.pave3, C.pave1, C.bone];
    for (let ty = 0; ty < ch.h; ty++)
      for (let tx = 0; tx < ch.w; tx++) {
        const d = Math.hypot(ch.x + tx + 0.5 - w.x, ch.y + ty + 0.5 - w.y);
        if (d > r) continue;
        ctx.drawImage(paved, tx * TILE, ty * TILE, TILE, TILE, X + tx * TILE, Y + ty * TILE, TILE, TILE);
        const k = ty * ch.w + tx;
        if (!w.hit[k]) {
          w.hit[k] = 1;
          // the slab lands: dust off its edges, and a bright edge for a moment
          this.fx.burst(X + tx * TILE + 8, Y + ty * TILE + 12, 3, dust, 26, 50, 1, 0.45);
        }
        if (r - d < 0.9 && w.t < PAVE_S) {
          ctx.fillStyle = rgba(C.bone, 0.45 * (1 - (r - d) / 0.9));
          ctx.fillRect(X + tx * TILE, Y + ty * TILE, TILE, TILE);
        }
      }
    if (w.t >= PAVE_S + 0.05) this.paving.splice(this.paving.indexOf(w), 1);
  }

  private landLabels(g: Game) {
    for (const ch of CHUNKS) {
      if (g.s.land.includes(ch.id)) continue;
      // centre the label on the part of the chunk inside the floor view; skip it if little shows
      const a = this.toScreen(ch.x, ch.y), b = this.toScreen(ch.x + ch.w, ch.y + ch.h), v = this.view;
      const x0 = Math.max(a.x, v.x), x1 = Math.min(b.x, v.x + v.w), y0 = Math.max(a.y, v.y), y1 = Math.min(b.y, v.y + v.h);
      // the sign needs room: a sliver of a chunk at the screen's edge gets none (the 180's sign is taller)
      if (x1 - x0 < 120 || y1 - y0 < 90) continue;
      const s = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      const ready = !ch.requires || g.done(ch.requires);
      const price = ch.cost.toLocaleString('en-US');
      this.labels.push({ x: s.x, y: s.y, max: x1 - x0, short: ready ? `${ICON.coin}${price}` : ICON.lock, text: ready ? `${ch.name}: ${price} coin` : `${ch.name}: research first`, color: ready ? (g.s.coin.gte(ch.cost) ? C.gold : C.bone) : C.fog, bg: C.ink, sale: { name: ch.name.replace(/\{[^}]*\}/g, '').trim(), price, ready, afford: g.s.coin.gte(ch.cost) } });
    }
  }

  private veins(g: Game) {
    const ctx = this.ctx;
    for (const k of Object.keys(g.s.veins)) {
      const p = PATCHES[+k];
      const a = 0.25 + 0.15 * Math.sin(this.time * 6);
      ctx.fillStyle = rgba(C.gold, a);
      ctx.fillRect(p.x * TILE, p.y * TILE, p.w * TILE, p.h * TILE);
      for (let i = 0; i < 4; i++) {
        const t = (this.time * 1.7 + i * 0.37) % 1;
        const x = p.x * TILE + ((i * 23 + Math.floor(this.time * 3) * 7) % (p.w * TILE));
        const y = p.y * TILE + p.h * TILE * (1 - t);
        ctx.fillStyle = C.bone;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }

  private computeTurns(g: Game) {
    this.turns.clear();
    for (const b of g.belts) {
      const back = opposite(b.rot);
      const feeds = (d: Dir) => {
        const n = g.entAt(b.x + DX[d], b.y + DY[d]);
        if (!n) return false;
        if (n.kind === 'belt') return n.rot === opposite(d);
        if (n.kind === 'dock' || n.kind === 'hopper') return false;
        return n.rot === opposite(d); // a machine / splitter facing into this belt
      };
      if (feeds(back)) continue;
      const left = ((b.rot + 3) % 4) as Dir, right = ((b.rot + 1) % 4) as Dir;
      const fl = feeds(left), fr = feeds(right);
      if (fl && !fr) this.turns.set(b.id, -1);
      else if (fr && !fl) this.turns.set(b.id, 1);
    }
    this.turnsV = g.version;
  }

  private belt(g: Game, b: Ent) {
    const turn = this.turns.get(b.id);
    // belts move all the time: their treads only stop when the item on them is stuck
    const stuck = b.item !== null && !b.mv;
    const t = stuck ? 0 : this.time;
    if (turn) {
      const s = sheet('belt_turn');
      drawRot(this.ctx, s, frameAt(s, t), b.x * TILE, b.y * TILE, b.rot, turn === 1);
    } else {
      const s = sheet('belt');
      drawRot(this.ctx, s, frameAt(s, t), b.x * TILE, b.y * TILE, b.rot);
    }
  }

  private beltItem(b: Ent, alpha: number) {
    const step = RULES.beltSpeed.value / 20;
    const p = b.mv ? b.p + alpha * step : b.p;
    const turn = this.turns.get(b.id);
    let fx: number, fy: number;
    const cx = b.x * TILE + 8, cy = b.y * TILE + 8;
    if (turn && p < 0.5) {
      // come in from the side edge to the centre
      const side = ((b.rot + (turn === -1 ? 3 : 1)) % 4) as Dir;
      const k = 0.5 - p;
      fx = cx + DX[side] * k * TILE;
      fy = cy + DY[side] * k * TILE;
    } else {
      fx = cx + DX[b.rot] * (p - 0.5) * TILE;
      fy = cy + DY[b.rot] * (p - 0.5) * TILE;
    }
    this.ctx.drawImage(itemIcon(b.item!), Math.round(fx - 4), Math.round(fy - 4));
  }

  // ---------------------------------------------------------------- power

  /** The wires between linked Poles: a sagging line from crossarm to crossarm with its shadow on
   *  the floor; a spark of light runs along it while the grid carries power. */
  private drawWires(g: Game) {
    if (this.wiresV !== g.version) {
      this.wires = wirePairs(g);
      this.wiresV = g.version;
    }
    if (!this.wires.length) return;
    const ctx = this.ctx;
    for (const [a, b] of this.wires) {
      const gi = gridIndex(g, a);
      const gr = gi >= 0 ? g.grids[gi] : null;
      const live = !!gr && gr.demand > 0 && gr.supply > 0;
      const brown = live && gr!.sat < 1;
      const x0 = a.x * TILE + 8, y0 = a.y * TILE + 3, x1 = b.x * TILE + 8, y1 = b.y * TILE + 3;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      const sag = 2 + n / 14;
      const pt = (t: number) => ({ x: Math.round(x0 + (x1 - x0) * t), y: Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)) });
      // the shadow, straight on the floor below
      ctx.fillStyle = rgba(C.ink, 0.22);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + 11 + (y1 - y0) * t), 1, 1);
      }
      // the wire: dark, with a lit top edge so it reads over the floor
      for (let i = 0; i <= n; i++) {
        const p = pt(i / n);
        ctx.fillStyle = live ? C.shadow : C.ink;
        ctx.fillRect(p.x, p.y, 1, 1);
        ctx.fillStyle = rgba(live ? C.hull2 : C.hull1, 0.5);
        ctx.fillRect(p.x, p.y - 1, 1, 1);
      }
      if (live) {
        // power flowing: a bright pulse runs along (slower and amber in a brownout)
        const speed = brown ? 0.6 : 1.4;
        for (let k = 0; k < 2; k++) {
          const t = ((this.time * speed * 32) / n + k * 0.5 + a.id * 0.17) % 1;
          const p = pt(t);
          ctx.fillStyle = brown ? C.pipYellow : C.hot;
          ctx.fillRect(p.x, p.y, 1, 1);
          ctx.fillStyle = rgba(brown ? C.glow : C.teal1, 0.6);
          ctx.fillRect(p.x - 1, p.y, 1, 1);
        }
      }
    }
  }

  /** The grid the reach overlay is about: the hovered, selected or placed power building's. */
  private reachFocus(g: Game, ov: Overlay): { show: boolean; focus: number; ghost: { kind: BuildKind; x: number; y: number } | null } {
    if (ov.build && onGridKind(ov.build)) return { show: true, focus: -1, ghost: ov.hover ? { kind: ov.build, x: ov.hover.x, y: ov.hover.y } : null };
    const pick = (id: number | null) => (id ? g.byId.get(id) ?? null : null);
    const sel = pick(ov.selected);
    const hov = ov.hover && !ov.build && !ov.remove ? g.entAt(ov.hover.x, ov.hover.y) : null;
    for (const e of [hov, sel]) if (e && onGridKind(e.kind)) return { show: true, focus: gridIndex(g, e), ghost: null };
    return { show: false, focus: -1, ghost: null };
  }

  /** Tinted squares of every Pole's reach (brighter for the grid in focus), the edge of the
   *  powered area outlined, and the focus grid's members framed (producers gold, machines teal). */
  private reachOverlay(g: Game, ov: Overlay) {
    const { show, focus, ghost } = this.reachFocus(g, ov);
    if (!show) return;
    const ctx = this.ctx;
    const r = poleReach(g);
    const W = g.W, H = g.H;
    // 0: none, 1: some grid, 2: the focus grid, 3: the ghost pole's reach
    const cov = new Uint8Array(W * H);
    g.grids.forEach((gr, gi) => {
      for (const p of gr.poles)
        for (let y = Math.max(0, p.y - r); y <= Math.min(H - 1, p.y + r); y++)
          for (let x = Math.max(0, p.x - r); x <= Math.min(W - 1, p.x + r); x++) cov[y * W + x] = Math.max(cov[y * W + x], gi === focus ? 2 : 1);
    });
    const gp = ghost && ghost.kind === 'pole' ? ghost : null;
    if (gp)
      for (let y = Math.max(0, gp.y - r); y <= Math.min(H - 1, gp.y + r); y++)
        for (let x = Math.max(0, gp.x - r); x <= Math.min(W - 1, gp.x + r); x++) cov[y * W + x] = 3;
    const tint = ['', rgba(C.teal1, 0.13), rgba(C.teal1, 0.26), rgba(C.pipGreen, 0.22)];
    const edge = ['', rgba(C.teal1, 0.55), C.teal1, C.pipGreen];
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 5);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = cov[y * W + x];
        if (!c) continue;
        ctx.fillStyle = tint[c];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = edge[c];
        const at = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : cov[yy * W + xx]);
        if (at(x, y - 1) < c) ctx.fillRect(x * TILE, y * TILE, TILE, 1);
        if (at(x, y + 1) < c) ctx.fillRect(x * TILE, y * TILE + TILE - 1, TILE, 1);
        if (at(x - 1, y) < c) ctx.fillRect(x * TILE, y * TILE, 1, TILE);
        if (at(x + 1, y) < c) ctx.fillRect(x * TILE + TILE - 1, y * TILE, 1, TILE);
        ctx.globalAlpha = 1;
      }
    // the members of the grid in focus (or of every grid while placing)
    g.grids.forEach((gr, gi) => {
      if (focus >= 0 && gi !== focus) return;
      for (const p of gr.producers) this.frame(p.x, p.y, p.w, p.h, rgba(C.gold, 0.85));
      for (const m of gr.consumers) this.frame(m.x, m.y, m.w, m.h, rgba(C.teal1, 0.85));
      for (const p of gr.poles) this.frame(p.x, p.y, 1, 1, rgba(C.bone, 0.6));
    });
    if (gp) {
      // dashed wires to the Poles this one would link to
      const link = RULES.poleLink.value;
      for (const p of g.power) {
        if (p.kind !== 'pole' || Math.max(Math.abs(p.x - gp.x), Math.abs(p.y - gp.y)) > link) continue;
        const x0 = gp.x * TILE + 8, y0 = gp.y * TILE + 3, x1 = p.x * TILE + 8, y1 = p.y * TILE + 3;
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        const off = Math.floor(this.time * 12);
        for (let i = 0; i <= n; i++) {
          if ((i + off) % 4 >= 2) continue;
          const t = i / n;
          ctx.fillStyle = C.pipGreen;
          ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t + (2 + n / 14) * 4 * t * (1 - t)), 1, 1);
        }
      }
      // what the new Pole would reach: frame each powered building in its square
      for (const e of g.s.ents) if (onGridKind(e.kind) && e.kind !== 'pole' && cheb(e, gp.x, gp.y) <= r) this.frame(e.x, e.y, e.w, e.h, C.pipGreen);
    } else if (ghost && powered(ghost.kind)) {
      const d = BUILD[ghost.kind];
      if (!reached(g, ghost.x, ghost.y, d.w, d.h)) {
        const s = this.toScreen(ghost.x + d.w / 2, ghost.y - 0.2);
        this.labels.push({ x: s.x, y: s.y, text: 'No Pole in reach', color: C.pipBlue, bg: C.ink });
      }
    }
  }

  /** A small lightning bolt (5x6) with an ink outline. */
  private bolt(x: number, y: number, col: string) {
    const ctx = this.ctx;
    const px: [number, number][] = [[2, 0], [3, 0], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3], [1, 4], [2, 4], [1, 5]];
    ctx.fillStyle = C.ink;
    for (const [a, b] of px) ctx.fillRect(x + a - 1, y + b, 3, 1), ctx.fillRect(x + a, y + b - 1, 1, 3);
    ctx.fillStyle = col;
    for (const [a, b] of px) ctx.fillRect(x + a, y + b, 1, 1);
  }

  /** Smoke from a working burner now and then. */
  private smoke(e: Ent, dark: boolean, every: number) {
    const last = this.smokeAt.get(e.id) ?? 0;
    if (this.time - last < every) return;
    this.smokeAt.set(e.id, this.time + Math.random() * 0.15);
    // the chimney: the top middle of the tile, whatever way it faces
    this.fx.puff(e.x * TILE + 8, e.y * TILE + 2, dark);
  }

  // ---------------------------------------------------------------- buildings

  private building(g: Game, e: Ent) {
    const d = this.drops.size ? this.drops.get(e.y * 4096 + e.x) : undefined;
    if (!d) return this.buildingAt(g, e);
    // the drop: 0.12 s falling 14 px (accelerating), then 0.16 s of squash on landing, about the
    // footprint's bottom middle
    const FALL = 0.12, SQUASH = 0.16;
    const t = this.time - d.t;
    if (t >= FALL + SQUASH) { this.drops.delete(e.y * 4096 + e.x); return this.buildingAt(g, e); }
    const ctx = this.ctx;
    const bx = (e.x + e.w / 2) * TILE, by = (e.y + e.h) * TILE;
    if (t >= FALL && !d.landed) {
      d.landed = true;
      const c = e.w * 8;
      this.fx.burst(bx, by - 2, 8 * e.w, [C.tan, C.clay, C.fog, C.pave3], 40, 90);
      this.fx.ring(bx, by - c, C.bone, 12 * e.w, 0.25, 6);
      this.sfx('place', 0.35, 0.8);
    }
    let dy = 0, sx = 1, sy = 1;
    if (t < FALL) {
      const u = t / FALL;
      dy = -Math.round(14 * (1 - u * u));
      // its shadow on the ground grows as it comes down
      ctx.fillStyle = rgba(C.ink, 0.12 + 0.2 * u);
      const sw = Math.round(e.w * TILE * (0.5 + 0.4 * u));
      ctx.fillRect(Math.round(bx - sw / 2), by - 3, sw, 2);
    } else {
      const k = Math.sin(Math.PI * Math.min(1, (t - FALL) / SQUASH));
      sx = 1 + 0.14 * k;
      sy = 1 - 0.16 * k;
    }
    ctx.save();
    ctx.translate(bx, by + dy);
    ctx.scale(sx, sy);
    ctx.translate(-bx, -by);
    this.buildingAt(g, e);
    ctx.restore();
  }

  private buildingAt(g: Game, e: Ent) {
    const ctx = this.ctx;
    const x = e.x * TILE, y = e.y * TILE;
    const W = e.w * TILE, Ht = e.h * TILE;
    switch (e.kind) {
      case 'dock':
      case 'hopper': {
        const s = sheet(e.kind === 'dock' && g.s.orders.rep.bramble >= 3 ? 'dock_lily' : e.kind);
        const ss = s.placeholder && e.kind === 'dock' ? sheet('dock') : s;
        ctx.drawImage(ss.frames[frameAt(ss, this.time)], x, y);
        return;
      }
      case 'heap': {
        // the pile grows with its count: art has five fill frames (0, 25, 50, 75, 100%)
        const f = Math.min(1, e.count / (BUILD.heap.capacity ?? 100));
        const hs = sheet('heap');
        if (!hs.placeholder) drawRot(ctx, hs, Math.round(f * (hs.frames.length - 1)), x, y, 0);
        else {
          drawRot(ctx, hs, 0, x, y, 0);
          const h = Math.round(f * 7);
          if (h > 0) {
            ctx.fillStyle = C.plum;
            ctx.fillRect(x + 3, y + 13 - h, 10, h);
            ctx.fillStyle = C.violet;
            ctx.fillRect(x + 4, y + 13 - h, 6, 1);
          }
        }
        this.frontArrow(e);
        if (f >= 1) this.pip(x, y, C.pipRed, true);
        return;
      }
      default: {
        const s = sheet(spriteName(e.kind));
        if (isPower(e.kind)) return this.powerBuilding(g, e, s);
        const working = !isMachine(e.kind) || e.state === 'work';
        // a brownout slows the animation with the machine; Overdrive speeds it up
        const gi = powered(e.kind) ? g.gridOf.get(e.id) : undefined;
        const sat = gi === undefined ? 1 : g.grids[gi].sat;
        const od = (e.od ?? 0) > 0;
        const speed = (od ? 2.5 : 1) * (sat < 1 ? Math.max(0.35, sat) : 1);
        const f = working ? frameAt(s, (this.time + e.id * 0.13) * speed) : 0;
        drawRot(ctx, s, f, x, y, e.rot);
        // a craft just finished: a one-frame bright flash on the body
        const fl = this.flashes.get(e.id);
        if (fl !== undefined && this.time - fl < 0.08) {
          ctx.fillStyle = rgba(C.bone, 0.35);
          ctx.fillRect(x + 2, y + 3, W - 4, Ht - 5);
        }
        if (e.kind === 'crate' && e.store.length) this.fillBar(x, y, e.store.length / (BUILD.crate.capacity ?? 50));
        if ((e.kind === 'splitter' || e.kind === 'merger') && e.store.length) ctx.drawImage(itemIcon(e.store[0]), x + 4, y + 4);
        if (isMachine(e.kind)) {
          this.machineDetails(g, e);
          this.overdriveFx(e);
          let col = e.state === 'starved' && e.why === null && !e.recipe ? C.pipGrey : PIP[e.state];
          const blocked = e.state === 'blocked';
          if (blocked && !this.jamSince.has(e.id)) this.jamSince.set(e.id, this.time);
          if (!blocked) this.jamSince.delete(e.id);
          if (powered(e.kind)) {
            if (e.why === 'power') {
              // no power: the blue pip and a blinking bolt in the middle
              col = C.pipBlue;
              if (Math.floor(this.time * 2) % 2) this.bolt(x + W / 2 - 2, y + Ht / 2 - 3, C.pipBlue);
            } else if (sat < 1 && e.active) {
              // a brownout: the body flickers and a small amber bolt shows the shortage
              if (Math.random() < 0.25 * (1 - sat) + 0.05) {
                ctx.fillStyle = rgba(C.ink, 0.28);
                ctx.fillRect(x + 1, y + 2, W - 2, Ht - 3);
              }
              this.bolt(x + 1, y + 1, C.pipYellow);
            }
          }
          this.pip(x + W - TILE, y, col, blocked);
        }
      }
    }
  }

  /** Boilers, Steam Engines, Generators and Poles: animated by state, smoke while burning, and a
   *  pip (green: making power; yellow: out of fuel; grey: not connected or standing by; a Pole's
   *  pip shows its grid: green fed, yellow brownout, blue no power). */
  private powerBuilding(g: Game, e: Ent, s: ReturnType<typeof sheet>) {
    const x = e.x * TILE, y = e.y * TILE;
    if (e.kind === 'pole') {
      drawRot(this.ctx, s, 0, x, y, 0);
      const gi = gridIndex(g, e);
      const gr = gi >= 0 ? g.grids[gi] : null;
      let col: string = C.pipGrey;
      if (gr && gr.consumers.length + gr.producers.length > 0) {
        const cap = capacity(g, gr);
        if (gr.demand > 0 && cap <= 0) col = C.pipBlue;
        else if (gr.demand > 0 && gr.sat < 1) col = C.pipYellow;
        else if (gr.producers.length) col = C.pipGreen;
        else col = C.pipBlue;
      }
      // the Pole's pip sits low-right: its crossarm fills the top
      this.pip(x, y + 11, col, false);
      return;
    }
    const working = e.state === 'work';
    const f = working ? frameAt(s, this.time + e.id * 0.11) : 0;
    drawRot(this.ctx, s, f, x, y, e.rot);
    if (working) {
      if (e.kind === 'boiler') this.smoke(e, false, 0.45);
      else if (e.kind === 'generator') this.smoke(e, true, 0.6);
      else if (e.kind === 'steamEngine' && Math.random() < 0.02) this.fx.burst(x + 8, y + 4, 3, [C.bone, C.hull3], 10, -20, 1, 0.6);
    }
    const col = e.state === 'work' ? C.pipGreen : e.state === 'starved' ? C.pipYellow : C.pipGrey;
    this.pip(x, y, col, false);
  }

  /** The Overdrive ring while it runs (blinking in its last 2 s), then a dim arc that shrinks
   *  while it cools. */
  private overdriveFx(e: Ent) {
    const ctx = this.ctx;
    const x = e.x * TILE, y = e.y * TILE;
    const od = e.od ?? 0, cool = e.cool ?? 0;
    if (od > 0) {
      if (od < 2 * TICK_RATE && Math.floor(this.time * 8) % 2) return;
      // a warm pulse over the body, then the ring
      ctx.fillStyle = rgba(C.glow, 0.12 + 0.08 * Math.sin(this.time * 14));
      ctx.fillRect(x + 1, y + 1, e.w * TILE - 2, e.h * TILE - 2);
      const s = sheet(e.w > 1 ? 'fx_overdrive_big' : 'fx_overdrive');
      if (!s.placeholder) ctx.drawImage(s.frames[frameAt(s, this.time)], x, y);
      else {
        ctx.strokeStyle = C.glow;
        ctx.strokeRect(x + 0.5, y + 0.5, e.w * TILE - 1, e.h * TILE - 1);
      }
      if (Math.random() < 0.15) this.fx.burst(x + Math.random() * e.w * TILE, y + e.h * TILE - 2, 1, [C.hot, C.glow], 8, -40, 1, 0.5);
      return;
    }
    if (cool > 0) {
      const total = RULES.overdriveCool.value * TICK_RATE;
      const frac = Math.min(1, cool / total);
      const W = e.w * TILE, H = e.h * TILE;
      const P = 2 * (W + H) - 4;
      const n = Math.round(P * frac);
      ctx.fillStyle = rgba(C.iron2, 0.9);
      // clockwise from the top-left corner
      for (let i = 0; i < n; i++) {
        let px: number, py: number;
        if (i < W) { px = i; py = 0; }
        else if (i < W + H - 1) { px = W - 1; py = i - W + 1; }
        else if (i < 2 * W + H - 2) { px = W - 1 - (i - (W + H - 2)); py = H - 1; }
        else { px = 0; py = H - 1 - (i - (2 * W + H - 3)); }
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }

  /** the slag piling up and the output waiting, drawn small on the machine */
  private machineDetails(g: Game, e: Ent) {
    const ctx = this.ctx;
    const x = e.x * TILE, y = e.y * TILE;
    const bottom = y + e.h * TILE - 2;
    if (e.by > 0) {
      // slag cubes stacking on the machine's back-left corner
      for (let i = 0; i < Math.min(4, e.by); i++) {
        ctx.fillStyle = C.ink;
        ctx.fillRect(x + 1 + i * 3, bottom, 3, 2);
        ctx.fillStyle = e.by >= RULES.outputCap.value ? C.pipRed : C.violet;
        ctx.fillRect(x + 1 + i * 3, bottom, 2, 1);
      }
    }
    if (e.kind === 'furnace' && !g.has('bellows') && e.active) {
      // the crank's progress as a little heat bar
      const need = 40;
      const f = Math.min(1, e.prog / need);
      ctx.fillStyle = C.ink;
      ctx.fillRect(x + 2, y - 3, 12, 3);
      ctx.fillStyle = C.amber;
      ctx.fillRect(x + 3, y - 2, Math.round(10 * f), 1);
    }
  }

  private fillBar(x: number, y: number, f: number) {
    const ctx = this.ctx;
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 2, y + 13, 12, 2);
    ctx.fillStyle = C.lime;
    ctx.fillRect(x + 2, y + 13, Math.round(12 * f), 1);
  }

  /** the status pip, the top-right 4x4 of the tile at (x, y) (DESIGN.md §4, §17); blocked pips blink */
  private pip(x: number, y: number, col: string, blink: boolean) {
    const ctx = this.ctx;
    if (blink && Math.floor(this.time * 3) % 2) col = C.rust;
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 11, y, 5, 5);
    ctx.fillStyle = col;
    ctx.fillRect(x + 12, y + 1, 3, 3);
    ctx.fillStyle = rgba(C.bone, 0.6);
    ctx.fillRect(x + 12, y + 1, 1, 1);
  }

  private frontArrow(e: Ent) {
    const ctx = this.ctx;
    const cx = e.x * TILE + 8 + DX[e.rot] * 6, cy = e.y * TILE + 8 + DY[e.rot] * 6;
    ctx.fillStyle = rgba(C.bone, 0.5);
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  private sparks(g: Game) {
    for (const p of g.s.sparks) {
      const s = sheet(p.kind === 'vein' ? 'spark_vein' : 'spark_inspector');
      const bob = p.kind === 'inspector' ? Math.round(Math.sin(this.time * 4) * 1) : 0;
      // a pulsing gold ring makes it read as clickable, not decoration (§17)
      const a = 0.35 + 0.25 * Math.sin(this.time * 8);
      const ctx = this.ctx;
      ctx.strokeStyle = rgba(C.gold, a);
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x * TILE + 0.5, p.y * TILE + 0.5, 15, 15);
      ctx.drawImage(s.frames[frameAt(s, this.time)], p.x * TILE, p.y * TILE + bob);
      if (p.life < 100 && Math.floor(this.time * 6) % 2) {
        ctx.fillStyle = rgba(C.ink, 0.3);
        ctx.fillRect(p.x * TILE, p.y * TILE, 16, 16);
      }
    }
  }

  /** While graded lines wait for their folds, keep a picture of each box (the fold animation
   *  folds it). Pictures of boxes no longer graded are dropped. */
  private snapFold(g: Game) {
    const keep = new Set<string>();
    for (const a of g.s.audits) {
      if (!a.result) continue;
      const b = a.box;
      const key = `${b.x},${b.y},${b.w},${b.h}`;
      keep.add(key);
      const s = this.foldSnaps.get(key);
      if (s && this.time - s.t < 0.5) continue;
      const p0 = this.toScreen(b.x, b.y), p1 = this.toScreen(b.x + b.w, b.y + b.h);
      const img = s ? s.img : document.createElement('canvas');
      img.width = b.w * TILE;
      img.height = b.h * TILE;
      const c = img.getContext('2d')!;
      c.imageSmoothingEnabled = false;
      try {
        c.drawImage(this.ctx.canvas, p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, 0, 0, img.width, img.height);
      } catch {
        continue;
      }
      this.foldSnaps.set(key, { x: b.x, y: b.y, w: b.w, h: b.h, img, t: this.time });
    }
    for (const k of [...this.foldSnaps.keys()]) if (!keep.has(k)) this.foldSnaps.delete(k);
  }

  /** The fold box: marching ants and brass corners; teal while it audits, gold once graded. */
  private foldBox(x0: number, y0: number, w: number, h: number, col: string, tint: string | null) {
    const ctx = this.ctx;
    const X = x0 * TILE, Y = y0 * TILE, Wd = w * TILE, Hd = h * TILE;
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(X, Y, Wd, Hd);
    }
    const off = Math.floor(this.time * 10) % 4;
    const dash = (px: number, py: number, i: number) => {
      ctx.fillStyle = (i + off) % 4 < 2 ? col : C.ink;
      ctx.fillRect(px, py, 1, 1);
    };
    for (let i = 0; i < Wd + 2; i++) { dash(X - 1 + i, Y - 1, i); dash(X + Wd - i, Y + Hd, i); }
    for (let i = 0; i < Hd + 2; i++) { dash(X + Wd, Y - 1 + i, i); dash(X - 1, Y + Hd - i, i); }
    const corner = sheet('fold_corner');
    if (!corner.placeholder) {
      ctx.drawImage(corner.frames[0], X, Y);
      ctx.drawImage(corner.frames[1], X + Wd - 8, Y);
      ctx.drawImage(corner.frames[2], X, Y + Hd - 8);
      ctx.drawImage(corner.frames[3], X + Wd - 8, Y + Hd - 8);
    } else {
      ctx.fillStyle = C.gold;
      for (const [cx, cy, sx, sy] of [[X - 2, Y - 2, 1, 1], [X + Wd + 1, Y - 2, -1, 1], [X - 2, Y + Hd + 1, 1, -1], [X + Wd + 1, Y + Hd + 1, -1, -1]]) {
        ctx.fillRect(Math.min(cx, cx + sx * 4), cy, 5, 1);
        ctx.fillRect(cx, Math.min(cy, cy + sy * 4), 1, 5);
      }
    }
  }

  private audit(g: Game) {
    for (const a of g.s.audits) this.auditBox(g, a);
  }

  private auditBox(_g: Game, a: Game['s']['audits'][number]) {
    const ctx = this.ctx;
    const done = !!a.result;
    const pulse = 0.12 + 0.08 * Math.sin(this.time * 5);
    this.foldBox(a.box.x, a.box.y, a.box.w, a.box.h, done ? C.gold : C.teal1, rgba(done ? C.gold : C.teal0, done ? pulse : 0.12));
    // a scan line sweeping the box while it measures
    if (!done) {
      const sy = a.box.y * TILE + Math.floor(((this.time * 0.8) % 1) * a.box.h * TILE);
      ctx.fillStyle = rgba(C.teal1, 0.35);
      ctx.fillRect(a.box.x * TILE, sy, a.box.w * TILE, 1);
      void auditTicks;
    }
    // the ports: an arrow on the edge, teal coming in, gold going out
    for (const p of a.ports) {
      const cx = p.x * TILE + 8 + DX[p.dir] * (p.io === 'out' ? 8 : -8), cy = p.y * TILE + 8 + DY[p.dir] * (p.io === 'out' ? 8 : -8);
      const col = p.io === 'out' ? C.gold : C.teal1;
      ctx.fillStyle = C.ink;
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
      ctx.fillStyle = col;
      // a tiny arrow head pointing along dir
      const ax = DX[p.dir], ay = DY[p.dir];
      ctx.fillRect(cx - 1 + ax, cy - 1 + ay, 2, 2);
      ctx.fillRect(cx - 1 - ax + ay, cy - 1 - ay + ax, 2, 2);
      ctx.fillRect(cx - 1 - ax - ay, cy - 1 - ay - ax, 2, 2);
    }
  }

  private overlays(g: Game, ov: Overlay) {
    const ctx = this.ctx;
    if (ov.flow) this.flow(g);
    this.audit(g);
    this.reachOverlay(g, ov);
    if (ov.box) {
      const x0 = Math.min(ov.box.x0, ov.box.x1), y0 = Math.min(ov.box.y0, ov.box.y1);
      const w = Math.abs(ov.box.x1 - ov.box.x0) + 1, h = Math.abs(ov.box.y1 - ov.box.y0) + 1;
      this.foldBox(x0, y0, w, h, ov.box.ok ? C.pipGreen : C.pipRed, rgba(ov.box.ok ? C.pipGreen : C.pipRed, 0.12));
    }
    // the selected machine: a bright frame
    if (ov.selected) {
      const e = g.byId.get(ov.selected);
      if (e) this.frame(e.x, e.y, e.w, e.h, C.gold);
    }
    if (ov.drag) {
      for (const d of ov.drag) this.ghost(g, 'belt', d.x, d.y, d.rot);
      return;
    }
    const h = ov.hover;
    if (!h || !g.inb(h.x, h.y)) return;
    if (ov.build) {
      this.ghost(g, ov.build, h.x, h.y, ov.rot);
    } else if (ov.remove) {
      const e = g.entAt(h.x, h.y);
      if (e) {
        const ok = e.kind !== 'dock' && e.kind !== 'hopper' && e.kind !== 'furnace';
        ctx.fillStyle = rgba(ok ? C.pipRed : C.fog, 0.35);
        ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
        this.frame(e.x, e.y, e.w, e.h, ok ? C.pipRed : C.fog);
      }
    } else if (!ov.box) {
      const e = g.entAt(h.x, h.y);
      if (e) {
        // a machine Overdrive can boost: a hot, pulsing frame says "click me"
        const odReady = isMachine(e.kind) && g.done('overdrive') && !(e.od ?? 0) && !(e.cool ?? 0) && !(e.kind === 'furnace' && !g.has('bellows')) && !(e.by >= RULES.outputCap.value);
        if (odReady) {
          const a = 0.6 + 0.4 * Math.sin(this.time * 10);
          this.frame(e.x, e.y, e.w, e.h, rgba(C.glow, a));
          const s = this.toScreen(e.x + e.w, e.y);
          this.labels.push({ x: s.x, y: s.y - 2, text: '3x', color: C.hot, bg: C.ink });
        } else this.frame(e.x, e.y, e.w, e.h, rgba(C.bone, 0.7));
      } else {
        ctx.fillStyle = rgba(C.bone, 0.12);
        ctx.fillRect(h.x * TILE, h.y * TILE, TILE, TILE);
      }
    }
  }

  /** A building's ghost where it would go: its sprite (2x2 for Mk2) over a green or red tint of
   *  every tile it covers, and a marker on its front face. */
  private ghost(g: Game, kind: BuildKind, x: number, y: number, rot: Dir) {
    const ctx = this.ctx;
    const why = g.canPlace(kind, x, y);
    const onBelt = kind === 'belt' && g.entAt(x, y)?.kind === 'belt';
    const ok = !why || onBelt;
    const d = BUILD[kind];
    ctx.globalAlpha = 0.6;
    const s = sheet(spriteName(kind));
    drawRot(ctx, s, 0, x * TILE, y * TILE, rot);
    ctx.globalAlpha = 1;
    // tint each tile on its own: the ones that are blocked (off the land, in the way) show red
    for (let yy = y; yy < y + d.h; yy++)
      for (let xx = x; xx < x + d.w; xx++) {
        const e = g.entAt(xx, yy);
        const bad = !ok && (!g.inb(xx, yy) || !g.owned(xx, yy) || (!!e && !(kind === 'belt' && e.kind === 'belt')));
        ctx.fillStyle = rgba(ok ? C.pipGreen : C.pipRed, bad ? 0.4 : 0.22);
        ctx.fillRect(xx * TILE, yy * TILE, TILE, TILE);
      }
    this.frame(x, y, d.w, d.h, ok ? C.pipGreen : C.pipRed);
    // which way it faces: a 3x3 marker just past the middle of its front face
    const cx = x * TILE + (d.w * TILE) / 2 + DX[rot] * ((d.w * TILE) / 2 + 1), cy = y * TILE + (d.h * TILE) / 2 + DY[rot] * ((d.h * TILE) / 2 + 1);
    ctx.fillStyle = C.ink;
    ctx.fillRect(cx - 2, cy - 2, 5, 5);
    ctx.fillStyle = ok ? C.bone : C.pipRed;
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
    if (why && !onBelt && kind !== 'belt') {
      const sp = this.toScreen(x + d.w / 2, y + d.h + 0.15);
      this.labels.push({ x: sp.x, y: sp.y + 14, text: why, color: C.pipRed, bg: C.ink });
    }
  }

  private frame(x: number, y: number, w: number, h: number, col: string) {
    const ctx = this.ctx;
    ctx.fillStyle = col;
    const X = x * TILE, Y = y * TILE, Wd = w * TILE, Hd = h * TILE;
    ctx.fillRect(X - 1, Y - 1, Wd + 2, 1);
    ctx.fillRect(X - 1, Y + Hd, Wd + 2, 1);
    ctx.fillRect(X - 1, Y - 1, 1, Hd + 2);
    ctx.fillRect(X + Wd, Y - 1, 1, Hd + 2);
  }

  /** the flow overlay (DESIGN.md §15 diagnostics): each belt tinted by its load over the last few
   *  seconds, a teal trickle through green and yellow to a full belt, red where items stand still */
  private flow(g: Game) {
    const ctx = this.ctx;
    ctx.fillStyle = rgba(C.ink, 0.45);
    ctx.fillRect(0, 0, g.W * TILE, g.H * TILE);
    for (const b of g.belts) {
      const occ = b.occ ?? 0, jam = b.jam ?? 0;
      const col = jam > 0.35 ? C.pipRed : occ > 0.75 ? C.pipYellow : occ > 0.2 ? C.pipGreen : occ > 0.02 ? C.teal1 : C.hull0;
      ctx.fillStyle = rgba(col, 0.55 + 0.25 * Math.min(1, occ));
      ctx.fillRect(b.x * TILE + 1, b.y * TILE + 1, TILE - 2, TILE - 2);
      // the load as a bar along the belt's direction
      ctx.fillStyle = C.ink;
      ctx.fillRect(b.x * TILE + 3, b.y * TILE + 7, 10, 2);
      ctx.fillStyle = C.bone;
      ctx.fillRect(b.x * TILE + 3, b.y * TILE + 7, Math.round(10 * Math.min(1, occ)), 1);
    }
    for (const m of g.machines) {
      ctx.fillStyle = rgba(m.state === 'work' ? C.pipGreen : m.state === 'blocked' ? C.pipRed : m.why === 'power' ? C.pipBlue : m.state === 'starved' ? C.pipYellow : C.pipGrey, 0.5);
      ctx.fillRect(m.x * TILE, m.y * TILE, m.w * TILE, 2);
    }
  }

  private effects(dt: number) {
    const ctx = this.ctx;
    // folds that finish this frame send their module flying to the Factory tab
    for (const f of this.fx.folds) {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      // the flash as the packet becomes a tile
      if (f.t < FOLD_DUR * FOLD_FLASH && f.t + dt >= FOLD_DUR * FOLD_FLASH) {
        this.fx.burst(cx, cy, 16, [C.bone, C.gold, C.hot], 60, 0, 1, 0.5);
        this.fx.ring(cx, cy, C.bone, Math.max(f.w, f.h) / 2 + 6, 0.35, 6);
        this.sfx('stamp', 0.7);
      }
      if (f.t < FOLD_DUR && f.t + dt >= FOLD_DUR) {
        const s = this.toScreen(cx / TILE, cy / TILE);
        const t = this.factoryTarget ?? { x: this.W / 2, y: this.H - 20 };
        this.fx.fly(s.x, s.y, t.x, t.y, 'module', true);
        const top = f.letter === 'S+';
        this.fx.burst(cx, cy, top ? 70 : 30, top ? [C.gold, C.hot, C.bone, C.gold] : [C.gold, C.brass1, C.hot, C.bone], top ? 110 : 70, 40, top ? 2 : 1, top ? 1.3 : 0.9);
        this.fx.ring(cx, cy, C.gold, top ? 44 : 26, top ? 0.9 : 0.6, 4);
        if (top) { this.fx.ring(cx, cy, C.hot, 60, 1.1, 10); this.fx.text(cx, cy - 18, 'S+ MODULE!', C.gold, 2, true); }
        else if (f.letter) this.fx.text(cx, cy - 14, `${f.letter} module!`, C.gold, 1.4, true);
        this.fx.kick(top ? 7 : 3);
        this.sfx('stampLand', 0.8);
      }
    }
    this.fx.update(dt);
    for (const f of this.fx.folds) this.foldAnim(f.x, f.y, f.w, f.h, f.img, f.t / FOLD_DUR, f.letter);
    for (const p of this.fx.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of this.fx.rings) {
      const t = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * t;
      ctx.strokeStyle = rgba(r.color, 1 - t);
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(r.x - rad) + 0.5, Math.round(r.y - rad) + 0.5, Math.round(rad * 2), Math.round(rad * 2));
    }
  }

  /** One frame of the fold (k runs 0..1): a paper crease sweeps across the box's picture, the
   *  four corners fold in to the middle, the packet squeezes down to one tile, a flash, then the
   *  brass module pops. The art director's 'fx_fold' strip plays over the first part when it
   *  exists; otherwise all of it is drawn here. */
  private foldAnim(X: number, Y: number, W: number, H: number, img: HTMLCanvasElement | null, k: number, letter: string) {
    const ctx = this.ctx;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const cx = X + W / 2, cy = Y + H / 2;
    const top = letter === 'S+';
    const SWEEP = 0.2, CORNERS = 0.48, SQUEEZE = FOLD_FLASH;
    // the floor under the box goes dark while it folds away
    if (k < SQUEEZE) {
      ctx.fillStyle = rgba(C.ink, 0.55);
      ctx.fillRect(X, Y, W, H);
    }
    const art = hasArt('fx_fold');
    if (k < CORNERS && art) {
      // the picture under the art director's fold strip (drawn below, stretched over the box)
      if (img) ctx.drawImage(img, X, Y, W, H);
      else { ctx.fillStyle = C.brass0; ctx.fillRect(X, Y, W, H); }
    } else if (k < CORNERS) {
      // the picture, whole
      if (img) ctx.drawImage(img, X, Y, W, H);
      else { ctx.fillStyle = C.brass0; ctx.fillRect(X, Y, W, H); }
      // the crease: a bright band sweeping left to right, leaving the fold lines behind it
      const p = Math.min(1, k / SWEEP);
      const bx = Math.round(X + p * W);
      ctx.fillStyle = rgba(C.bone, 0.18);
      ctx.fillRect(X, Y, bx - X, H);
      if (p < 1) {
        ctx.fillStyle = rgba(C.bone, 0.85);
        ctx.fillRect(bx - 1, Y, 2, H);
        ctx.fillStyle = rgba(top ? C.gold : C.hot, 0.7);
        ctx.fillRect(bx - 3, Y, 2, H);
      }
      ctx.fillStyle = rgba(C.ink, 0.6);
      if (bx > cx) ctx.fillRect(Math.round(cx), Y, 1, H);
      if (p >= 0.5) ctx.fillRect(X, Math.round(cy), Math.round(Math.min(W, bx - X)), 1);
      // the corners fold in: paper backs (brass) growing from each corner along the diagonals
      const c = ease(Math.max(0, (k - SWEEP) / (CORNERS - SWEEP)));
      if (c > 0) {
        const L = Math.round((c * Math.min(W, H)) / 2);
        for (const [ox, oy, sx, sy] of [[X, Y, 1, 1], [X + W, Y, -1, 1], [X, Y + H, 1, -1], [X + W, Y + H, -1, -1]]) {
          ctx.fillStyle = C.brass0;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + sx * L, oy);
          ctx.lineTo(ox, oy + sy * L);
          ctx.closePath();
          ctx.fill();
          // the paper's back catches the light along the fold
          ctx.strokeStyle = C.brass1;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ox + sx * L, oy + sy * 0.5);
          ctx.lineTo(ox + sx * 0.5, oy + sy * L);
          ctx.stroke();
        }
      }
      ctx.fillStyle = rgba(C.gold, 0.4 + 0.4 * c);
      ctx.fillRect(X, Y, W, 1); ctx.fillRect(X, Y + H - 1, W, 1); ctx.fillRect(X, Y, 1, H); ctx.fillRect(X + W - 1, Y, 1, H);
    } else if (k < SQUEEZE) {
      // the folded packet squeezes down to one tile: brass, with its crease X
      const q = ease((k - CORNERS) / (SQUEEZE - CORNERS));
      const w = Math.max(TILE, Math.round(W + (TILE - W) * q)), h = Math.max(TILE, Math.round(H + (TILE - H) * q));
      const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
      ctx.fillStyle = C.ink;
      ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      ctx.fillStyle = C.brass0;
      ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = C.brass1;
      ctx.fillRect(x0, y0, w, 1); ctx.fillRect(x0, y0, 1, h);
      ctx.strokeStyle = rgba(C.ink, 0.6);
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, y0 + 0.5); ctx.lineTo(x0 + w - 0.5, y0 + h - 0.5);
      ctx.moveTo(x0 + w - 0.5, y0 + 0.5); ctx.lineTo(x0 + 0.5, y0 + h - 0.5);
      ctx.stroke();
      ctx.fillStyle = top ? C.gold : C.hot;
      ctx.fillRect(x0 + w - 3, y0 + 1, 2, 2);
    }
    // the art director's fold strip (the crease and the corners): played once, stretched over
    // the box, before the squeeze
    if (art && k < CORNERS) {
      const s = sheet('fx_fold');
      const fi = Math.min(s.frames.length - 1, Math.floor(k * FOLD_DUR * (s.fps || 16)));
      ctx.drawImage(s.frames[fi], X, Y, W, H);
    }
    if (k >= SQUEEZE) {
      // the flash, then the module popping from 1.6x down to its tile
      const p = (k - SQUEEZE) / (1 - SQUEEZE);
      if (p < 0.25) {
        ctx.fillStyle = rgba(C.bone, (0.25 - p) * 3.2);
        const r = Math.round(TILE / 2 + 10 * p);
        ctx.fillRect(Math.round(cx - r), Math.round(cy - r), r * 2, r * 2);
      }
      const sc = 1 + 0.6 * Math.sin(Math.min(1, p * 1.4) * Math.PI);
      const m = sheet('module');
      const sz = Math.round(TILE * sc);
      ctx.drawImage(m.frames[0], Math.round(cx - sz / 2), Math.round(cy - sz / 2), sz, sz);
      if (top) {
        // S+: gold sparkles circling the new module
        for (let i = 0; i < 6; i++) {
          const a = p * 6 + (i * Math.PI) / 3, rr = 10 + p * 6;
          ctx.fillStyle = i % 2 ? C.gold : C.bone;
          ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
        }
      }
    }
  }

  /** An order filled: a fountain of coins out of the Dock on screen and a cascade of them into
   *  the coin counter, staggered so they pour (the Milestone 4 review's missing juice). */
  private orderCascade(g: Game, id: string) {
    const fx = this.fx;
    let dock: { x: number; y: number } | null = null;
    if (this.floor === 'factory' || this.floor === 'district') {
      const d = (this.floor === 'district' ? g.s.district?.ents ?? [] : g.s.factory.ents).find((e) => e.kind === 'fdock');
      if (d) dock = { x: d.x + 1, y: d.y + 1 };
    } else {
      const d = g.s.ents.find((e) => e.kind === 'dock');
      if (d) dock = { x: d.x + d.w / 2, y: d.y + d.h / 2 };
    }
    if (!dock) return;
    const big = id === 'gizmoFestival' ? 2 : 1;
    fx.fountain(dock.x * TILE, dock.y * TILE - 6, 50 * big, [C.gold, C.hot, C.brass1, C.bone], 120, 2, 1.4);
    fx.ring(dock.x * TILE, dock.y * TILE, C.gold, 40, 0.8, 6);
    fx.text(dock.x * TILE, dock.y * TILE - 26, 'ORDER FILLED!', C.gold, 2, true);
    const s = this.toScreen(dock.x, dock.y);
    const n = 18 * big;
    for (let i = 0; i < n; i++) fx.fly(s.x + ((i % 6) - 3) * 6, s.y - (i % 3) * 4, this.coinTarget.x, this.coinTarget.y, undefined, false, i * 0.045);
    this.sfx('coin', 0.8, 1.2);
  }

  /** The Festival filled: Gizmos parade along every trunk that carries them into the Factory Dock. */
  private startParade(g: Game) {
    const dock = g.s.factory.ents.find((e) => e.kind === 'fdock');
    if (!dock) return;
    const paths: { x: number; y: number }[][] = [];
    for (const r of g.routes) {
      if (r.by || r.to?.kind !== 'fdock') continue;
      const d = g.design(r.from.design);
      if (!d || !(d.outs.gizmo ?? 0)) continue;
      const pts = [{ x: r.from.x + 0.5, y: r.from.y + 0.5 }, ...r.tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 })), { x: dock.x + 1, y: dock.y + 1 }];
      paths.push(pts.map((p) => ({ x: p.x * TILE, y: p.y * TILE })));
    }
    // no Gizmo trunk found (a hand-made state): march in from the floor's left edge
    if (!paths.length) paths.push([{ x: 0, y: (dock.y + 1) * TILE }, { x: (dock.x + 1) * TILE, y: (dock.y + 1) * TILE }]);
    this.parade = { t: 0, n: 0, paths, dock: { x: (dock.x + 1) * TILE, y: (dock.y + 1) * TILE } };
    this.sfx('fanfare', 0.8);
  }

  /** seconds the Gizmo parade runs (the slice-end card waits for it) */
  static PARADE_S = 3.6;

  private drawParade(g: Game, dt: number) {
    const p = this.parade;
    if (!p) return;
    p.t += dt;
    if (p.t > Renderer.PARADE_S) { this.parade = null; return; }
    const ctx = this.ctx;
    const icon = itemIcon('gizmo');
    const speed = 5 * TILE;
    let arrived = 0;
    for (const path of p.paths) {
      const lens: number[] = [0];
      for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
      const total = lens[lens.length - 1];
      for (let k = 0; k < 14; k++) {
        const d = (p.t - k * 0.16) * speed;
        if (d < 0) continue;
        if (d >= total) { arrived++; continue; }
        let i = 1;
        while (i < lens.length - 1 && lens[i] < d) i++;
        const seg = lens[i] - lens[i - 1] || 1;
        const u = (d - lens[i - 1]) / seg;
        const x = path[i - 1].x + (path[i].x - path[i - 1].x) * u, y = path[i - 1].y + (path[i].y - path[i - 1].y) * u;
        const hop = Math.abs(Math.sin(d / 6)) * 4;
        ctx.fillStyle = rgba(C.ink, 0.5);
        ctx.fillRect(Math.round(x - 3), Math.round(y + 3), 7, 2);
        ctx.fillStyle = C.gold;
        ctx.fillRect(Math.round(x - 5), Math.round(y - 5 - hop), 10, 10);
        ctx.drawImage(icon, Math.round(x - 4), Math.round(y - 4 - hop));
        if (k % 3 === 0) { ctx.fillStyle = C.bone; ctx.fillRect(Math.round(x - 6), Math.round(y - 8 - hop), 1, 1); }
      }
    }
    // each Gizmo that reaches the Dock pops a spark
    if (arrived > p.n) {
      for (let i = p.n; i < arrived; i++) {
        this.fx.burst(p.dock.x, p.dock.y - 4, 8, [C.gold, C.hot, C.bone], 50, 60, 1, 0.6);
        if (i % 2 === 0) this.fx.pop(p.dock.x, p.dock.y - 14, 20, 'parade', C.gold, 'gizmo', '+');
      }
      this.sfx('coin', 0.4, 1.4);
      p.n = arrived;
    }
  }

  /** The first Miner placed: a fountain of ore and gold, rings, and a big "FIRST MINER!" */
  firstMiner(tx: number, ty: number) {
    const fx = this.fx;
    const x = tx * TILE + 8, y = ty * TILE + 8;
    fx.fountain(x, y - 4, 40, [C.gold, C.iron2, C.hot, C.bone], 110, 2, 1.3);
    fx.ring(x, y, C.gold, 36, 0.9, 4);
    fx.ring(x, y, C.iron2, 24, 0.6, 2);
    fx.text(x, y - 22, 'FIRST MINER!', C.gold, 2.4, true);
    fx.kick(4);
  }

  /** The first Mk2 machine placed: a copper and gold burst over its 2x2 and "FIRST MK2!" */
  firstMk2(tx: number, ty: number) {
    const fx = this.fx;
    const x = tx * TILE + 16, y = ty * TILE + 16;
    fx.burst(x, y, 50, [C.copper2, C.gold, C.hot, C.bone], 100, 40, 2, 1.2);
    fx.ring(x, y, C.gold, 40, 0.9, 10);
    fx.ring(x, y, C.copper2, 28, 0.6, 6);
    fx.text(x, y - 26, 'FIRST MK2!', C.gold, 2.2, true);
  }

  /** Pops and flying coins and labels, drawn in screen space at the UI scale (crisp text). The
   *  180 (docs/hud-180.md): labels are paper (land for sale is a sign tag with its price chip; notes
   *  a slip of paper in ink), pops are light figures with an ink outline over the floor, big ones in
   *  the display face. */
  drawScreenFx(ctx: CanvasRenderingContext2D, uiScale: number) {
    const z = this.cam.zoom;
    const { ox, oy } = this.origin();
    const k = uiScale;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    for (const l of this.labels) {
      const lx = l.x / k, ly = l.y / k, max = l.max ? l.max / k : Infinity;
      if (l.sale) { saleSign(ctx, lx, ly, max, l.sale); continue; }
      let text = l.text;
      if (textWidth(text) + 8 > max) { if (!l.short) continue; text = l.short; }
      const w = textWidth(text) + 8;
      const x = Math.round(lx - w / 2), y = Math.round(ly - 6);
      paperRaw(ctx, x, y, w, 13, { deckle: false });
      drawText(ctx, text, x + 4, y + 2, onPaper(l.color));
    }
    for (const p of this.fx.pops) {
      const t = 1 - p.life / p.max;
      // big pops jump up with a bounce, then drift
      const rise = p.big ? 18 * Math.min(1, t * 4) + t * 8 : t * 14;
      const sx = (ox + p.x * z) / k, sy = (oy + (p.y - rise) * z) / k;
      const pop = p.big && t < 0.12 ? 1 + (0.12 - t) * 6 : 1;
      const sc = Math.max(1, Math.round((p.big ? 2 : 1) * pop));
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      const tw = (p.big ? bigWidth(p.text) : textWidth(p.text)) * sc;
      const w = tw + (p.icon ? 10 * sc : 0);
      let x = Math.round(sx - w / 2);
      if (p.icon) {
        chipRaw(ctx, x - sc, Math.round(sy) - sc, 10 * sc, 10 * sc, 'ink');
        ctx.drawImage(itemIcon(p.icon), x, Math.round(sy), 8 * sc, 8 * sc);
        x += 10 * sc;
      }
      outlinedText(ctx, p.text, x, Math.round(sy), p.color, T.floorOutline, sc, p.big);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    for (const f of this.fx.flyers) {
      if (f.t < 0) continue;
      const t = Math.min(1, f.t / f.dur);
      const e = t * t * (3 - 2 * t);
      const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(t * Math.PI) * f.arc * uiScale / 2;
      if (f.icon) {
        const big = f.icon === 'module';
        const img = big ? sheet('module').frames[0] : itemIcon(f.icon);
        const s = (big ? 16 : 8) * uiScale * (f.big ? 1 + 0.6 * Math.sin(t * Math.PI) : 1);
        // a short gold trail
        ctx.fillStyle = rgba(C.gold, 0.5);
        for (let i = 1; i <= 3; i++) {
          const tt = Math.max(0, t - i * 0.04), ee = tt * tt * (3 - 2 * tt);
          const tx = f.x0 + (f.x1 - f.x0) * ee, ty = f.y0 + (f.y1 - f.y0) * ee - Math.sin(tt * Math.PI) * f.arc * uiScale / 2;
          ctx.fillRect(Math.round(tx - uiScale), Math.round(ty - uiScale), 2 * uiScale, 2 * uiScale);
        }
        ctx.drawImage(img, Math.round(x - s / 2), Math.round(y - s / 2), Math.round(s), Math.round(s));
        continue;
      }
      const s = uiScale * 2;
      ctx.fillStyle = C.ink;
      ctx.fillRect(Math.round(x - 2 * s), Math.round(y - 2 * s), 4 * s, 4 * s);
      ctx.fillStyle = C.gold;
      ctx.fillRect(Math.round(x - 2 * s + s / 2), Math.round(y - 2 * s + s / 2), 3 * s, 3 * s);
      ctx.fillStyle = C.cream;
      ctx.fillRect(Math.round(x - 2 * s + s / 2), Math.round(y - 2 * s + s / 2), s, s);
    }
  }

  itemValue(id: string) {
    return (ITEMS as Record<string, { value: number }>)[id]?.value ?? 0;
  }
}

const MODE_WORD: Record<string, string> = { normal: 'Normal', efficient: 'Efficient', overclock: 'Overclocked!', precision: 'Precision' };

/** Land for sale (the 180): a paper sign tag on a stake with the chunk's name and a price chip
 *  (coin ink when you can pay, soft when not; a padlock while it waits on research), centred on
 *  (cx, cy) in UI px. Where the chunk shows too little for the name, the chip alone. */
function saleSign(ctx: CanvasRenderingContext2D, cx: number, cy: number, max: number, s: { name: string; price: string; ready: boolean; afford: boolean }) {
  const chipS = s.ready ? s.price : 'research first';
  const chipW = (s.ready ? COIN_W + 3 : 9) + textWidth(chipS) + 8;
  const nameW = textWidth(s.name);
  // land you cannot buy yet is a padlock on a stake, quiet (its name is on hover); land for sale
  // carries its name and price
  if (!s.ready) {
    const x = Math.round(cx - 8), y = Math.round(cy - 8);
    ctx.fillStyle = C.ink;
    ctx.fillRect(Math.round(cx) - 2, y + 12, 4, 8);
    ctx.fillStyle = C.wood3;
    ctx.fillRect(Math.round(cx) - 1, y + 12, 2, 7);
    tagRaw(ctx, x, y, 17, 15, { hole: 'none', anchor: null });
    drawText(ctx, ICON.lock, x + 5, y + 4, T.inkSoft);
    return;
  }
  const full = Math.max(nameW, chipW) + 16 <= max;
  if (!full && chipW + 16 > max) return;
  const w = (full ? Math.max(nameW, chipW) : chipW) + 12;
  const h = full ? 30 : 19;
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  // the stake
  ctx.fillStyle = C.ink;
  ctx.fillRect(Math.round(cx) - 2, y + h - 2, 4, 9);
  ctx.fillStyle = C.wood3;
  ctx.fillRect(Math.round(cx) - 1, y + h - 2, 2, 8);
  tagRaw(ctx, x, y, w, h, { hole: 'top', anchor: null });
  let yy = y + 6;
  if (full) { drawText(ctx, s.name, Math.round(cx - nameW / 2), yy, T.ink); yy += 11; }
  const chx = Math.round(cx - chipW / 2);
  chipRaw(ctx, chx, yy, chipW, 12, s.ready ? (s.afford ? 'coin' : 'soft') : 'soft');
  if (s.ready) { coinRaw(ctx, chx + 4, yy + 2); drawText(ctx, chipS, chx + 4 + COIN_W + 3, yy + 2, s.afford ? T.coin : T.inkSoft); }
  else { drawText(ctx, ICON.lock, chx + 3, yy + 2, T.inkSoft); drawText(ctx, chipS, chx + 12, yy + 2, T.inkSoft); }
}
