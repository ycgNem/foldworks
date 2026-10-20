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
import { CHUNKS, PATCHES, FACTORY } from '../data/land';
import { BUILD, isMachine, isPower, type BuildKind } from '../data/machines';
import { ITEMS } from '../data/items';
import { RULES } from '../data/rules';
import { TICK_RATE } from '../engine/time';
import type { GameEvent } from '../engine/events';
import { drawText, textWidth, ICON } from '../ui/font';
import { Ground, TILE } from './ground';
import { sheet, drawRot, frameAt, itemIcon, hasArt, spriteName } from './sprites';
import { Fx, FOLD_DUR } from './fx';
import { onGridKind, powered, gridIndex, cheb, wirePairs, reached, capacity } from './powerview';

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
}

/** screen-space labels collected during the world pass, drawn on top at UI scale */
interface Label { x: number; y: number; text: string; color: string; bg: string; /** widest it may be, screen px */ max?: number; /** used when text does not fit */ short?: string }

const PIP: Record<string, string> = { work: C.pipGreen, starved: C.pipYellow, blocked: C.pipRed, idle: C.pipGrey };

/** a sound the renderer wants played with an effect (the HUD drains these into the audio) */
export interface SoundReq { id: string; v: number; p: number }

export class Renderer {
  /** which floor is drawn; each floor keeps its own camera */
  floor: Floor = 'workshop';
  cams: Record<Floor, Camera> = { workshop: new Camera(), factory: new Camera() };
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
  /** sounds to play with the effects, drained by the HUD each frame */
  sounds: SoundReq[] = [];
  /** events that celebrate over the whole screen whatever floor is shown (the HUD draws them) */
  screenEvents: GameEvent[] = [];
  /** the wires between linked Poles (cached per layout version) */
  private wires: [Ent, Ent][] = [];
  private wiresV = -1;
  /** when each burner last puffed smoke */
  private smokeAt = new Map<number, number>();
  /** a picture of the graded fold box, taken while the grade card waits (the fold animation uses it) */
  private foldSnap: { x: number; y: number; w: number; h: number; img: HTMLCanvasElement; t: number } | null = null;
  /** any grid browned out last frame (a fizz when one starts) */
  private wasBrown = false;

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
    const pad = 48;
    c.x = mw + pad * 2 <= halfW * 2 ? mw / 2 : Math.max(halfW - pad, Math.min(mw + pad - halfW, c.x));
    c.y = mh + pad * 2 <= halfH * 2 ? mh / 2 : Math.max(halfH - pad, Math.min(mh + pad - halfH, c.y));
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
          fx.burst(px + c, py + c * 2 - 2, 6 * big, [C.tan, C.clay, C.fog], 30, 80);
          fx.ring(px + c, py + c, C.bone, 10 * big, 0.25, 6);
          if (e.id === 'pole') { fx.ring(px + 8, py + 8, C.teal1, (poleReach(g) + 0.5) * TILE, 0.5, 6); this.sfx('powerOn', 0.5); }
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
        case 'land': fx.ring(px, py, C.gold, 90, 0.9, 10); fx.burst(px, py, 40, [C.gold, C.amber, C.bone, C.lime], 80, 60, 1, 1.2); fx.kick(4); break;
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
          // x, y is the machine's centre tile
          const cx = px + 8, cy = py + 8;
          const ent = g.byId.get(e.value ?? -1);
          const r = ent && ent.w > 1 ? 24 : 14;
          fx.burst(cx, cy, 28, [C.hot, C.glow, C.gold, C.copper2], 90, 30, 1, 0.8);
          fx.ring(cx, cy, C.glow, r + 10, 0.45, r - 6);
          fx.ring(cx, cy, C.hot, r + 18, 0.7, r);
          fx.text(cx, cy - r - 6, '3x!', C.hot, 1.2, true);
          fx.kick(3);
          this.sfx('overdrive');
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
          if (e.floor === 'factory') {
            fx.burst(px, py, 40, [C.gold, C.brass1, C.hot, C.bone], 90, 30, 1, 1);
            fx.ring(px, py, C.gold, 40, 0.8, 6);
            break;
          }
          const snap = this.foldSnap;
          const box = snap ?? { x: Math.round((e.x ?? 0) - 1), y: Math.round((e.y ?? 0) - 1), w: 2, h: 2, img: null };
          fx.folds.push({ x: box.x * TILE, y: box.y * TILE, w: box.w * TILE, h: box.h * TILE, img: snap?.img ?? null, t: 0, letter: e.id ?? '' });
          this.foldSnap = null;
          this.sfx('whoosh');
          break;
        }
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
    if (!this.ground || this.ground.game !== g) this.ground = new Ground(g);
    this.labels.length = 0;
    const z = this.cam.zoom;
    const { ox, oy } = this.origin();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.imageSmoothingEnabled = false;
    if (ov.floor === 'factory') this.backdrop(ox, oy, z, FACTORY.w, FACTORY.h);
    else this.backdrop(ox, oy, z, g.W, g.H);
    if (ov.floor === 'factory') {
      drawFactory(ctx, g, this.time, ov.factory);
      this.effects(dt);
      return;
    }

    // a shadow under the whole workshop so it sits on the backdrop
    ctx.fillStyle = rgba(C.ink, 0.6);
    ctx.fillRect(3, 3, g.W * TILE, g.H * TILE);
    for (const ch of CHUNKS) ctx.drawImage(this.ground.chunk(ch.id), ch.x * TILE, ch.y * TILE);
    this.landLabels(g);
    this.veins(g);

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

  /** Swamp water around the floor (tile_water, each tile on its own frame), with a reedy bank
   *  (tile_shore) on the water tiles that touch the floor. */
  private backdrop(ox: number, oy: number, z: number, fw: number, fh: number) {
    if (!hasArt('tile_water')) return;
    const s = sheet('tile_water');
    const t = frameAt(s, this.time);
    const v = this.view;
    const tx0 = Math.floor((v.x - ox) / z / TILE) - 1, ty0 = Math.floor((v.y - oy) / z / TILE) - 1;
    const tx1 = Math.ceil((v.x + v.w - ox) / z / TILE) + 1, ty1 = Math.ceil((v.y + v.h - oy) / z / TILE) + 1;
    const land = (x: number, y: number) => x >= 0 && y >= 0 && x < fw && y < fh;
    for (let y = ty0; y <= ty1; y++)
      for (let x = tx0; x <= tx1; x++) if (!land(x, y)) this.ctx.drawImage(s.frames[(t + x * 3 + y * 5) & 3], x * TILE, y * TILE);
    if (!hasArt('tile_shore')) return;
    const sh = sheet('tile_shore');
    for (let y = -1; y <= fh; y++)
      for (let x = -1; x <= fw; x++) {
        if (land(x, y)) continue;
        // frame 0: land to the north, 1 east, 2 south, 3 west
        if (land(x, y - 1)) this.ctx.drawImage(sh.frames[0], x * TILE, y * TILE);
        if (land(x + 1, y)) this.ctx.drawImage(sh.frames[1], x * TILE, y * TILE);
        if (land(x, y + 1)) this.ctx.drawImage(sh.frames[2], x * TILE, y * TILE);
        if (land(x - 1, y)) this.ctx.drawImage(sh.frames[3], x * TILE, y * TILE);
      }
  }

  private landLabels(g: Game) {
    for (const ch of CHUNKS) {
      if (g.s.land.includes(ch.id)) continue;
      // centre the label on the part of the chunk inside the floor view; skip it if little shows
      const a = this.toScreen(ch.x, ch.y), b = this.toScreen(ch.x + ch.w, ch.y + ch.h), v = this.view;
      const x0 = Math.max(a.x, v.x), x1 = Math.min(b.x, v.x + v.w), y0 = Math.max(a.y, v.y), y1 = Math.min(b.y, v.y + v.h);
      if (x1 - x0 < 48 || y1 - y0 < 24) continue;
      const s = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      const ready = !ch.requires || g.done(ch.requires);
      this.labels.push({ x: s.x, y: s.y, max: x1 - x0, short: ready ? `${ICON.coin}${ch.cost.toLocaleString('en-US')}` : ICON.lock, text: ready ? `${ch.name}: ${ch.cost.toLocaleString('en-US')} coin` : `${ch.name}: research first`, color: ready ? (g.s.coin.gte(ch.cost) ? C.gold : C.bone) : C.fog, bg: C.ink });
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

  /** While a graded line waits for its fold, keep a picture of its box (the fold animation folds it). */
  private snapFold(g: Game) {
    const a = g.s.audit;
    if (!a || !a.result) return;
    const b = a.box;
    const s = this.foldSnap;
    if (s && s.x === b.x && s.y === b.y && s.w === b.w && s.h === b.h && this.time - s.t < 0.5) return;
    const p0 = this.toScreen(b.x, b.y), p1 = this.toScreen(b.x + b.w, b.y + b.h);
    const img = s && s.w === b.w && s.h === b.h ? s.img : document.createElement('canvas');
    img.width = b.w * TILE;
    img.height = b.h * TILE;
    const c = img.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    try {
      c.drawImage(this.ctx.canvas, p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, 0, 0, img.width, img.height);
    } catch {
      return;
    }
    this.foldSnap = { x: b.x, y: b.y, w: b.w, h: b.h, img, t: this.time };
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
    const a = g.s.audit;
    if (!a) return;
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
      if (f.t < FOLD_DUR && f.t + dt >= FOLD_DUR) {
        const s = this.toScreen((f.x + f.w / 2) / TILE, (f.y + f.h / 2) / TILE);
        const t = this.factoryTarget ?? { x: this.W / 2, y: this.H - 20 };
        this.fx.fly(s.x, s.y, t.x, t.y, 'module', true);
        this.fx.burst(f.x + f.w / 2, f.y + f.h / 2, 30, [C.gold, C.brass1, C.hot, C.bone], 70, 40, 1, 0.9);
        this.fx.ring(f.x + f.w / 2, f.y + f.h / 2, C.gold, 26, 0.6, 4);
        this.fx.kick(3);
        this.sfx('stampLand', 0.8);
      }
    }
    this.fx.update(dt);
    for (const f of this.fx.folds) this.foldAnim(f.x, f.y, f.w, f.h, f.img, f.t / FOLD_DUR);
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

  /** One frame of the fold: the box's picture folds in half sideways, then top to bottom, along
   *  creases, down to one tile, which becomes a brass module that pops. k runs 0..1. */
  private foldAnim(X: number, Y: number, W: number, H: number, img: HTMLCanvasElement | null, k: number) {
    const ctx = this.ctx;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const kx = ease(Math.min(1, k / 0.4)), ky = ease(Math.max(0, Math.min(1, (k - 0.3) / 0.4)));
    const w = Math.max(TILE, Math.round(W + (TILE - W) * kx)), h = Math.max(TILE, Math.round(H + (TILE - H) * ky));
    const cx = X + W / 2, cy = Y + H / 2;
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    if (k < 0.75) {
      // the line's picture, squeezed; the two halves darken toward the crease like a page turning
      ctx.fillStyle = rgba(C.ink, 0.5);
      ctx.fillRect(Math.round(cx - W / 2), Math.round(cy - H / 2), Math.round(W), Math.round(H));
      if (img) ctx.drawImage(img, x0, y0, w, h);
      else { ctx.fillStyle = C.brass0; ctx.fillRect(x0, y0, w, h); }
      ctx.fillStyle = rgba(C.ink, 0.15 + 0.4 * kx);
      ctx.fillRect(x0 + Math.floor(w / 2), y0, 1, h);
      ctx.fillStyle = rgba(C.ink, 0.15 + 0.4 * ky);
      ctx.fillRect(x0, y0 + Math.floor(h / 2), w, 1);
      ctx.fillStyle = rgba(C.gold, 0.25 + 0.5 * Math.max(kx, ky));
      ctx.fillRect(x0, y0, w, 1); ctx.fillRect(x0, y0 + h - 1, w, 1); ctx.fillRect(x0, y0, 1, h); ctx.fillRect(x0 + w - 1, y0, 1, h);
    } else {
      // the module, popping from 1.5x down to its tile
      const p = (k - 0.75) / 0.25;
      const sc = 1 + 0.5 * Math.sin(p * Math.PI);
      const m = sheet('module');
      const s = Math.round(TILE * sc);
      ctx.drawImage(m.frames[0], Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    }
  }

  /** Pops and flying coins and labels, drawn in screen space at the UI scale (crisp text). */
  drawScreenFx(ctx: CanvasRenderingContext2D, uiScale: number) {
    const z = this.cam.zoom;
    const { ox, oy } = this.origin();
    for (const l0 of this.labels) {
      let l = l0;
      let w = textWidth(l.text) * uiScale;
      if (l.max && w + 6 * uiScale > l.max) {
        if (!l.short) continue;
        l = { ...l0, text: l.short };
        w = textWidth(l.text) * uiScale;
      }
      const x = Math.round(l.x - w / 2), y = Math.round(l.y - 5 * uiScale);
      ctx.fillStyle = rgba(l.bg, 0.75);
      ctx.fillRect(x - 3 * uiScale, y - 2 * uiScale, w + 6 * uiScale, 12 * uiScale);
      drawText(ctx, l.text, x, y, l.color, uiScale);
    }
    for (const p of this.fx.pops) {
      const t = 1 - p.life / p.max;
      // big pops jump up with a bounce, then drift
      const rise = p.big ? 18 * Math.min(1, t * 4) + t * 8 : t * 14;
      const sx = ox + p.x * z, sy = oy + (p.y - rise) * z;
      const pop = p.big && t < 0.12 ? 1 + (0.12 - t) * 6 : 1;
      const sc = Math.max(1, Math.round((p.big ? uiScale * 2 : uiScale) * pop));
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      const w = textWidth(p.text) * sc + (p.icon ? 10 * sc : 0);
      let x = Math.round(sx - w / 2);
      if (p.icon) {
        const ic = itemIcon(p.icon);
        ctx.fillStyle = C.ink;
        ctx.fillRect(x - sc, Math.round(sy) - sc, 10 * sc, 10 * sc);
        ctx.drawImage(ic, x, Math.round(sy), 8 * sc, 8 * sc);
        x += 10 * sc;
      }
      drawText(ctx, p.text, x, Math.round(sy), p.color, sc, C.ink);
      ctx.globalAlpha = 1;
    }
    for (const f of this.fx.flyers) {
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
