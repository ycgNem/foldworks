// The world renderer: a camera at an integer zoom, baked ground chunks, then buildings, items on
// belts (interpolated between ticks), status pips, Sparks, the placement overlays and the effects
// the sim's events ask for. Reads the Game; never writes it.
import { C, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import { DX, DY, opposite, type Dir, type Ent } from '../sim/world';
import { CHUNKS, PATCHES } from '../data/land';
import { BUILD, isMachine, type BuildKind } from '../data/machines';
import { ITEMS } from '../data/items';
import { RULES } from '../data/rules';
import type { GameEvent } from '../engine/events';
import { drawText, textWidth } from '../ui/font';
import { Ground, TILE } from './ground';
import { sheet, drawRot, frameAt, itemIcon } from './sprites';
import { Fx } from './fx';

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
  /** the fold box being dragged or audited (tile rect) */
  box: { x0: number; y0: number; x1: number; y1: number; ok: boolean } | null;
  /** the flow overlay is on */
  flow: boolean;
}

/** screen-space labels collected during the world pass, drawn on top at UI scale */
interface Label { x: number; y: number; text: string; color: string; bg: string }

const PIP: Record<string, string> = { work: C.pipGreen, starved: C.pipYellow, blocked: C.pipRed, idle: C.pipGrey };

export class Renderer {
  cam = new Camera();
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
  /** per-machine blink phase start when it became blocked */
  private jamSince = new Map<number, number>();
  /** recent crafting flashes: entity id -> time */
  private flashes = new Map<number, number>();

  constructor(public ctx: CanvasRenderingContext2D) {}

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
  }

  /** Screen pixel offset of world pixel (0, 0). */
  origin() {
    const c = this.cam;
    const sx = this.fx.shake ? Math.round((Math.random() - 0.5) * this.fx.shake) : 0;
    const sy = this.fx.shake ? Math.round((Math.random() - 0.5) * this.fx.shake) : 0;
    return { ox: Math.round(this.W / 2 - Math.round(c.x) * c.zoom) + sx, oy: Math.round(this.H / 2 - Math.round(c.y) * c.zoom) + sy };
  }

  screenToTile(sx: number, sy: number) {
    const c = this.cam;
    const ox = Math.round(this.W / 2 - Math.round(c.x) * c.zoom), oy = Math.round(this.H / 2 - Math.round(c.y) * c.zoom);
    return { x: Math.floor((sx - ox) / c.zoom / TILE), y: Math.floor((sy - oy) / c.zoom / TILE) };
  }

  /** Screen position of a point in tile units (no shake). */
  toScreen(tx: number, ty: number) {
    const c = this.cam;
    const ox = Math.round(this.W / 2 - Math.round(c.x) * c.zoom), oy = Math.round(this.H / 2 - Math.round(c.y) * c.zoom);
    return { x: ox + tx * TILE * c.zoom, y: oy + ty * TILE * c.zoom };
  }

  clampCam(wTiles: number, hTiles: number) {
    const c = this.cam;
    const mw = wTiles * TILE, mh = hTiles * TILE;
    const halfW = this.W / 2 / c.zoom, halfH = this.H / 2 / c.zoom;
    const pad = 48;
    c.x = mw + pad * 2 <= halfW * 2 ? mw / 2 : Math.max(halfW - pad, Math.min(mw + pad - halfW, c.x));
    c.y = mh + pad * 2 <= halfH * 2 ? mh / 2 : Math.max(halfH - pad, Math.min(mh + pad - halfH, c.y));
  }

  // ---------------------------------------------------------------- events -> effects

  consume(evs: GameEvent[], g: Game) {
    const fx = this.fx;
    for (const e of evs) {
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
        case 'hopper': fx.pop(px, py - 4, 1, 'hop:' + e.id, C.ice, e.id ?? null); fx.burst(px, py, 2, [C.ice, C.sky], 20, 40); break;
        case 'orderFill': fx.pop(px, py - 4, 1, 'ord:' + e.id, C.lime, e.id ?? null); break;
        case 'mine': fx.burst(px + 8, py + 8, 5, [C.steel, C.fog, C.sky], 40, 120); break;
        case 'crank': fx.burst(px + 12, py + 6, 2, [C.amber, C.gold], 20, 50); break;
        case 'shovel': fx.burst(px + 8, py + 8, 6, [C.plum, C.violet, C.iron], 45, 140); break;
        case 'craft': {
          this.flashes.set(e.value ?? 0, this.time);
          if (e.id === 'ironIngot' || e.id === 'copperIngot') fx.burst(px + 8, py + 4, 2, [C.amber, C.gold, C.orange], 18, -10, 1, 0.7);
          break;
        }
        case 'place': fx.burst(px + 8, py + 14, 6, [C.tan, C.clay, C.fog], 30, 80); fx.ring(px + 8, py + 8, C.bone, 10, 0.25, 6); break;
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
        case 'order': fx.kick(3); break;
        case 'firstSlagJam': fx.ring(px + 8, py + 8, C.pipRed, 18, 0.8); break;
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

    // a shadow under the whole workshop so it sits on the backdrop
    ctx.fillStyle = rgba(C.ink, 0.6);
    ctx.fillRect(3, 3, g.W * TILE, g.H * TILE);
    for (const ch of CHUNKS) ctx.drawImage(this.ground.chunk(ch.id), ch.x * TILE, ch.y * TILE);
    this.landLabels(g);
    this.veins(g);

    if (this.turnsV !== g.version) this.computeTurns(g);

    // belts first (flat on the floor), then their items, then everything that stands up
    for (const b of g.belts) this.belt(g, b);
    for (const b of g.belts) if (b.item) this.beltItem(b, alpha);
    for (const e of g.s.ents) if (e.kind !== 'belt') this.building(g, e);
    this.sparks(g);
    this.overlays(g, ov);
    this.effects(dt);
  }

  private landLabels(g: Game) {
    for (const ch of CHUNKS) {
      if (g.s.land.includes(ch.id)) continue;
      const s = this.toScreen(ch.x + ch.w / 2, ch.y + ch.h / 2);
      const ready = !ch.requires || g.done(ch.requires);
      this.labels.push({ x: s.x, y: s.y, text: ready ? `${ch.name}: ${ch.cost.toLocaleString('en-US')} coin` : `${ch.name}: research first`, color: ready ? (g.s.coin.gte(ch.cost) ? C.gold : C.bone) : C.fog, bg: C.ink });
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

  private building(g: Game, e: Ent) {
    const ctx = this.ctx;
    const x = e.x * TILE, y = e.y * TILE;
    switch (e.kind) {
      case 'dock':
      case 'hopper': {
        const s = sheet(e.kind === 'dock' && g.s.orders.rep.bramble >= 3 ? 'dock_lily' : e.kind);
        const ss = s.placeholder && e.kind === 'dock' ? sheet('dock') : s;
        ctx.drawImage(ss.frames[frameAt(ss, this.time)], x, y);
        return;
      }
      case 'heap': {
        drawRot(ctx, sheet('heap'), 0, x, y, 0);
        // the pile grows with its count
        const f = Math.min(1, e.count / (BUILD.heap.capacity ?? 100));
        const h = Math.round(f * 7);
        if (h > 0) {
          ctx.fillStyle = C.plum;
          ctx.fillRect(x + 3, y + 13 - h, 10, h);
          ctx.fillStyle = C.violet;
          ctx.fillRect(x + 4, y + 13 - h, 6, 1);
        }
        this.frontArrow(e);
        if (f >= 1) this.pip(x, y, C.pipRed, true);
        return;
      }
      default: {
        const name = e.kind;
        const s = sheet(name);
        const working = !isMachine(e.kind) || e.state === 'work';
        const f = working ? frameAt(s, this.time + e.id * 0.13) : 0;
        drawRot(ctx, s, f, x, y, e.rot);
        // a craft just finished: a one-frame bright flash on the body
        const fl = this.flashes.get(e.id);
        if (fl !== undefined && this.time - fl < 0.08) {
          ctx.fillStyle = rgba(C.bone, 0.35);
          ctx.fillRect(x + 2, y + 3, 12, 11);
        }
        if (e.kind === 'crate' && e.store.length) this.fillBar(x, y, e.store.length / (BUILD.crate.capacity ?? 50));
        if ((e.kind === 'splitter' || e.kind === 'merger') && e.store.length) ctx.drawImage(itemIcon(e.store[0]), x + 4, y + 4);
        if (isMachine(e.kind)) {
          this.machineDetails(g, e);
          const col = e.state === 'starved' && e.why === null && !e.recipe ? C.pipGrey : PIP[e.state];
          const blocked = e.state === 'blocked';
          if (blocked && !this.jamSince.has(e.id)) this.jamSince.set(e.id, this.time);
          if (!blocked) this.jamSince.delete(e.id);
          this.pip(x, y, col, blocked);
        }
      }
    }
  }

  /** the slag piling up and the output waiting, drawn small on the machine */
  private machineDetails(g: Game, e: Ent) {
    const ctx = this.ctx;
    const x = e.x * TILE, y = e.y * TILE;
    if (e.by > 0) {
      // slag cubes stacking on the machine's back-left corner
      for (let i = 0; i < Math.min(4, e.by); i++) {
        ctx.fillStyle = C.ink;
        ctx.fillRect(x + 1 + i * 3, y + 14, 3, 2);
        ctx.fillStyle = e.by >= RULES.outputCap.value ? C.pipRed : C.violet;
        ctx.fillRect(x + 1 + i * 3, y + 14, 2, 1);
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

  /** the status pip, top-right 4x4 (DESIGN.md §4, §17); blocked pips blink */
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

  private overlays(g: Game, ov: Overlay) {
    const ctx = this.ctx;
    if (ov.flow) this.flow(g);
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
      if (e) this.frame(e.x, e.y, e.w, e.h, rgba(C.bone, 0.7));
      else {
        ctx.fillStyle = rgba(C.bone, 0.12);
        ctx.fillRect(h.x * TILE, h.y * TILE, TILE, TILE);
      }
    }
  }

  private ghost(g: Game, kind: BuildKind, x: number, y: number, rot: Dir) {
    const ctx = this.ctx;
    const why = g.canPlace(kind, x, y);
    const onBelt = kind === 'belt' && g.entAt(x, y)?.kind === 'belt';
    const ok = !why || onBelt;
    ctx.globalAlpha = 0.6;
    const s = sheet(kind);
    drawRot(ctx, s, 0, x * TILE, y * TILE, rot);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(ok ? C.pipGreen : C.pipRed, 0.25);
    ctx.fillRect(x * TILE, y * TILE, BUILD[kind].w * TILE, BUILD[kind].h * TILE);
    this.frame(x, y, BUILD[kind].w, BUILD[kind].h, ok ? C.pipGreen : C.pipRed);
    // which way it faces
    const cx = x * TILE + 8 + DX[rot] * 9, cy = y * TILE + 8 + DY[rot] * 9;
    ctx.fillStyle = ok ? C.bone : C.pipRed;
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
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

  /** the flow overlay: each belt tinted by how full it has been (green free, red jammed) */
  private flow(g: Game) {
    const ctx = this.ctx;
    for (const b of g.belts) {
      const col = b.item === null ? C.pipGreen : b.mv ? C.pipYellow : C.pipRed;
      ctx.fillStyle = rgba(col, 0.35);
      ctx.fillRect(b.x * TILE, b.y * TILE, TILE, TILE);
    }
  }

  private effects(dt: number) {
    const ctx = this.ctx;
    this.fx.update(dt);
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

  /** Pops and flying coins and labels, drawn in screen space at the UI scale (crisp text). */
  drawScreenFx(ctx: CanvasRenderingContext2D, uiScale: number) {
    const z = this.cam.zoom;
    const { ox, oy } = this.origin();
    for (const l of this.labels) {
      const w = textWidth(l.text) * uiScale;
      const x = Math.round(l.x - w / 2), y = Math.round(l.y - 5 * uiScale);
      ctx.fillStyle = rgba(l.bg, 0.75);
      ctx.fillRect(x - 3 * uiScale, y - 2 * uiScale, w + 6 * uiScale, 12 * uiScale);
      drawText(ctx, l.text, x, y, l.color, uiScale);
    }
    for (const p of this.fx.pops) {
      const t = 1 - p.life / p.max;
      const sx = ox + p.x * z, sy = oy + (p.y - t * 14) * z;
      const sc = p.big ? uiScale * 2 : uiScale;
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      const w = textWidth(p.text) * sc + (p.icon ? 10 * sc : 0);
      let x = Math.round(sx - w / 2);
      if (p.icon) {
        const ic = itemIcon(p.icon);
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
