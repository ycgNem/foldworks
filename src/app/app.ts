// The app: owns the Game, the renderer, the UI, input, audio and the loop. Screens (title, play),
// tools (build, remove, fold), the camera, saves and the debug handle window.__app. The sim
// never sees any of this: the app turns clicks into Game.act commands and the Game's events into
// sounds and effects.
import { Input } from '../engine/input';
import { GameLoop } from '../engine/loop';
import { Audio } from '../engine/audio/audio';
import { readSave, writeSave, exportString, importString, store } from '../engine/save';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { UI } from '../ui/ui';
import { C } from '../data/palette';
import { Game, type Cmd, type ActResult } from '../sim/Game';
import { savePayload, restore } from '../sim/snapshot';
import { DX, DY, type Dir } from '../sim/world';
import { BUILD, BUILD_BAR, type BuildKind } from '../data/machines';
import { CHUNKS } from '../data/land';
import { RESEARCH } from '../data/research';
import { ORDER, CUSTOMERS } from '../data/orders';
import { TITLE } from '../game-info';
import { Renderer, type Overlay } from '../render/renderer';
import { TILE } from '../render/ground';
import { drawHud, drawTitle, type HudState } from './hud';

export type Mode =
  | { k: 'idle' }
  | { k: 'build'; kind: BuildKind }
  | { k: 'remove' };

export type Panel = 'research' | 'orders' | 'help' | null;

export interface Toast { title: string; text: string; color: string; t: number; life: number; icon?: string }

const SAVE_SLOT = 1;
const AUTOSAVE_S = 30;

export class App {
  ctx: CanvasRenderingContext2D;
  input = new Input();
  ui = new UI();
  audio = new Audio();
  renderer: Renderer;
  loop: GameLoop;
  game: Game;
  screen: 'title' | 'play' = 'title';
  mode: Mode = { k: 'idle' };
  rot: Dir = 0;
  panel: Panel = null;
  /** the entity whose report is pinned on the right */
  selected: number | null = null;
  ready = false;
  uiScale = 2;
  frozen = false;
  toasts: Toast[] = [];
  /** the last refusal, shown under the cursor for a moment */
  refusal: { text: string; t: number } | null = null;
  /** belt drag in progress */
  drag: { x0: number; y0: number; path: { x: number; y: number; rot: Dir }[] } | null = null;
  /** right/middle-button pan in progress */
  panDrag: { sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null;
  hud: HudState = { coinShown: 0, coinBump: 0, hoverTile: null };
  flowOverlay = false;
  muted = false;
  private sinceSave = 0;
  private hasSave = false;
  /** what the title screen offers */
  titleInfo: { hasSave: boolean; coin: string } = { hasSave: false, coin: '0' };

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.ctx);
    this.game = new Game(1);
    this.loop = new GameLoop(() => this.tick(), (dt, alpha) => this.frame(dt, alpha));
    this.input.attach(canvas);
    this.ui.sfx = (id) => this.audio.sfx(id);
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.visibility());
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false });
    window.addEventListener('keydown', () => this.audio.unlock(), { once: false });
    window.addEventListener('beforeunload', () => { if (this.screen === 'play') this.save(); });
    this.resize();
    const d = readSave(SAVE_SLOT);
    this.hasSave = !!d;
    if (d) {
      try {
        const g = restore(d as never);
        this.titleInfo = { hasSave: true, coin: g.s.coin.format() };
      } catch {
        this.hasSave = false;
      }
    }
  }

  start() {
    this.ready = true;
    this.loop.start();
  }

  // ------------------------------------------------------------------ game lifecycle

  newGame(seed = (Math.random() * 1e9) | 0) {
    this.game = new Game(seed);
    this.screen = 'play';
    this.mode = { k: 'idle' };
    this.selected = null;
    this.panel = null;
    this.toasts = [];
    this.renderer.ground = null;
    this.fitCamera(true);
    this.hud.coinShown = 0;
  }

  continueGame() {
    const d = readSave(SAVE_SLOT);
    if (!d) return this.newGame();
    try {
      this.game = restore(d as never);
    } catch (err) {
      console.error(err);
      return this.newGame();
    }
    this.screen = 'play';
    this.renderer.ground = null;
    this.fitCamera(true);
    this.hud.coinShown = this.game.s.coin.toNumber();
  }

  save(): boolean {
    if (this.screen !== 'play') return false;
    const ok = writeSave(SAVE_SLOT, savePayload(this.game, Date.now()) as never);
    this.sinceSave = 0;
    this.hasSave = ok || this.hasSave;
    return ok;
  }

  exportSave(): string {
    return exportString(savePayload(this.game, Date.now()));
  }

  importSave(s: string): ActResult {
    try {
      const d = importString(s);
      this.game = restore(d as never);
      this.screen = 'play';
      this.renderer.ground = null;
      this.fitCamera(true);
      this.save();
      return { ok: true };
    } catch (err) {
      return { ok: false, why: (err as Error).message };
    }
  }

  private visibility() {
    if (this.screen !== 'play') return;
    const hidden = document.hidden;
    this.game.act({ k: 'visible', v: !hidden });
    if (hidden) this.save();
  }

  // ------------------------------------------------------------------ the loop

  private tick() {
    if (this.screen !== 'play' || this.frozen || this.panel === 'help') return;
    this.game.tick();
    this.sinceSave += 1 / TICK_RATE;
    if (this.sinceSave >= AUTOSAVE_S && store()) this.save();
  }

  private frame(dt: number, alpha: number) {
    const ctx = this.ctx;
    const g = this.game;
    this.events();
    if (this.screen === 'title') {
      this.renderer.resize(this.canvas.width, this.canvas.height);
      this.ui.begin(ctx, this.input, this.uiScale, dt, true);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = C.ink;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.uiScale, 0, 0, this.uiScale, 0, 0);
      drawTitle(this);
      this.ui.end();
      this.input.endFrame();
      return;
    }
    this.controls(dt);
    const ov = this.overlay();
    this.renderer.draw(g, dt, this.frozen ? 0 : alpha, ov);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.renderer.drawScreenFx(ctx, this.uiScale);
    this.ui.begin(ctx, this.input, this.uiScale, dt, false);
    drawHud(this, dt);
    this.ui.end();
    this.worldInput();
    this.audio.update(this.busyShare());
    this.input.endFrame();
  }

  private busyShare() {
    const ms = this.game.machines.length + this.game.miners.length;
    if (!ms) return 0;
    let w = 0;
    for (const m of this.game.machines) if (m.state === 'work') w++;
    for (const m of this.game.miners) if (m.state === 'work') w++;
    return Math.min(1, w / 12);
  }

  // ------------------------------------------------------------------ events -> sound, toasts

  private events() {
    const evs = this.game.events.drain();
    if (!evs.length) return;
    this.renderer.consume(evs, this.game);
    const a = this.audio;
    for (const e of evs) {
      switch (e.type) {
        case 'sell': a.sfx('coin', 0.7); this.hud.coinBump = 1; break;
        case 'hopper': a.sfx('hopper', 0.6); break;
        case 'orderFill': a.sfx('hopper', 0.5, 1.3); break;
        case 'mine': a.sfx('mine'); break;
        case 'crank': a.sfx('crank', 0.8, 0.8 + (e.value ?? 0) * 0.6); break;
        case 'crankEmpty': a.sfx('error', 0.5); break;
        case 'shovel': a.sfx('shovel'); break;
        case 'place': a.sfx(e.id === 'belt' ? 'belt' : 'place'); break;
        case 'remove': a.sfx('remove'); break;
        case 'rotate': a.sfx('rotate'); break;
        case 'upgrade':
          a.sfx('bellows');
          a.sfx('buy');
          this.toast('Bellows bought!', 'The Hand Furnace runs itself now: an ingot every 2 s. Keep it fed with ore.', C.amber);
          break;
        case 'land': a.sfx('land'); this.toast('Land bought', `${CHUNKS.find((c) => c.id === e.id)?.name ?? 'New land'} is yours. Build on it.`, C.gold); break;
        case 'research': {
          a.sfx('research');
          const d = RESEARCH[e.id as keyof typeof RESEARCH];
          this.toast(`Research complete: ${d.name}`, `Unlocked ${d.unlocks}.`, C.ice, 'flask');
          this.renderer.fx.kick(2);
          break;
        }
        case 'order': {
          a.sfx('order');
          const d = ORDER[e.id!];
          const c = CUSTOMERS[d.customer];
          const n = this.game.s.orders.done.length;
          this.toast(`${d.name}: filled!`, `+${Num.of(d.pays).format()} coin, +${d.rep} reputation. "${c.thanks[(n - 1) % c.thanks.length]}"`, C.lime, 'crate');
          break;
        }
        case 'spark': a.sfx('spark'); break;
        case 'sparkGet': a.sfx('sparkGet'); if (e.id === 'vein') this.toast('Lucky Vein!', "This patch's miners run 3x for 60 s.", C.gold); break;
        case 'inspected': this.toast(`Inspector: grade ${e.id}`, `Score ${(e.d ?? 0).toFixed(2)}. Paid ${Num.of(e.value ?? 0).format()} coin for a minute of this line's output.`, C.gold); break;
        case 'firstSlagJam': a.sfx('jam'); this.toast('Blocked: slag!', 'Smelting leaves slag, and it has nowhere to go. Click the machine to shovel it, or build a Slag Heap beside it.', C.pipRed); break;
        case 'firstSale': this.toast('First sale!', 'The Dock buys what you make. Coin buys machines.', C.gold); break;
        case 'orderAccept': a.sfx('open'); break;
      }
    }
  }

  toast(title: string, text: string, color: string, icon?: string) {
    this.toasts.push({ title, text, color, t: 0, life: 6, icon });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  // ------------------------------------------------------------------ input

  /** Do a command; refusals show under the cursor with a buzz. */
  act(c: Cmd): ActResult {
    const r = this.game.act(c);
    if (!r.ok && r.why && r.why !== 'too fast') {
      this.refusal = { text: r.why, t: 2 };
      if (c.k !== 'click') this.audio.sfx('error');
    }
    return r;
  }

  private controls(dt: number) {
    const inp = this.input;
    const cam = this.renderer.cam;
    if (inp.typing) return;
    const sp = (240 * dt) / Math.max(1, cam.zoom / 2);
    if (inp.isDown('panLeft')) cam.x -= sp;
    if (inp.isDown('panRight')) cam.x += sp;
    if (inp.isDown('panUp')) cam.y -= sp;
    if (inp.isDown('panDown')) cam.y += sp;
    if (inp.wasPressed('zoomIn')) this.zoom(1);
    if (inp.wasPressed('zoomOut')) this.zoom(-1);
    if (inp.mouse.wheel && !this.ui.captured) this.zoom(-inp.mouse.wheel);
    if (inp.wasPressed('rotate')) {
      if (this.mode.k === 'build') { this.rot = ((this.rot + 1) % 4) as Dir; this.audio.sfx('rotate'); }
      else if (this.hud.hoverTile) this.act({ k: 'rotate', x: this.hud.hoverTile.x, y: this.hud.hoverTile.y });
    }
    if (inp.wasPressed('remove')) this.setMode(this.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' });
    if (inp.wasPressed('research')) this.togglePanel('research');
    if (inp.wasPressed('orders')) this.togglePanel('orders');
    if (inp.wasPressed('help')) this.togglePanel('help');
    if (inp.wasPressed('flow')) this.flowOverlay = !this.flowOverlay;
    if (inp.wasPressed('mute')) { this.muted = !this.muted; this.audio.setMuted(this.muted); }
    if (inp.wasPressed('cancel')) {
      if (this.panel) this.panel = null;
      else if (this.mode.k !== 'idle') this.setMode({ k: 'idle' });
      else this.selected = null;
    }
    for (let i = 0; i < 9; i++) {
      if (inp.wasPressed(('slot' + (i + 1)) as 'slot1')) {
        const kind = BUILD_BAR[i];
        if (kind) this.pickBuild(kind);
      }
    }
    this.renderer.clampCam(this.game.W, this.game.H);
  }

  pickBuild(kind: BuildKind) {
    if (!this.game.unlocked(kind)) {
      this.refusal = { text: `${BUILD[kind].name} needs research: ${RESEARCH[BUILD[kind].unlock!].name}`, t: 2 };
      this.audio.sfx('error');
      return;
    }
    if (this.mode.k === 'build' && this.mode.kind === kind) this.setMode({ k: 'idle' });
    else this.setMode({ k: 'build', kind });
  }

  setMode(m: Mode) {
    this.mode = m;
    this.drag = null;
    this.audio.sfx('click');
  }

  togglePanel(p: Exclude<Panel, null>) {
    this.panel = this.panel === p ? null : p;
    if (p === 'orders') this.game.first('ordersSeen');
    this.audio.sfx(this.panel ? 'open' : 'close');
  }

  zoom(d: number) {
    const cam = this.renderer.cam;
    const max = this.maxZoom();
    const z = Math.max(1, Math.min(max, cam.zoom + d));
    if (z !== cam.zoom) cam.zoom = z;
  }

  maxZoom() {
    return Math.max(2, Math.round(4 * (window.devicePixelRatio || 1)));
  }

  /** Zoom to fit the land you own, and centre it. */
  fitCamera(reset = false) {
    const g = this.game;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of CHUNKS) {
      if (!g.s.land.includes(c.id)) continue;
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h);
    }
    // show a little of the land around what you own
    const w = (x1 - x0 + 2) * TILE, h = (y1 - y0 + 2) * TILE;
    const availH = this.canvas.height - 64 * this.uiScale, availW = this.canvas.width - 20 * this.uiScale;
    const z = Math.max(1, Math.min(this.maxZoom(), Math.floor(Math.min(availW / w, availH / h))));
    const cam = this.renderer.cam;
    if (reset || cam.zoom > z) cam.zoom = z;
    cam.x = ((x0 + x1) / 2) * TILE;
    cam.y = ((y0 + y1) / 2) * TILE + 4;
  }

  private overlay(): Overlay {
    const h = this.hud.hoverTile;
    return {
      hover: h,
      build: this.mode.k === 'build' ? this.mode.kind : null,
      rot: this.rot,
      drag: this.drag ? this.drag.path : null,
      remove: this.mode.k === 'remove',
      selected: this.selected,
      box: null,
      flow: this.flowOverlay,
    };
  }

  /** Mouse on the world, after the HUD has had its chance to take the click. */
  private worldInput() {
    const inp = this.input;
    const g = this.game;
    const k = this.canvas.width / (this.canvas.clientWidth || this.canvas.width);
    const sx = inp.mouse.x * k, sy = inp.mouse.y * k;
    const overUI = this.ui.overUI;
    const t = this.renderer.screenToTile(sx, sy);
    this.hud.hoverTile = !overUI && g.inb(t.x, t.y) ? t : null;

    // pan with the right or middle button held and moved
    const panBtn = inp.mouse.down[2] || inp.mouse.down[1];
    if ((inp.mouse.pressed[2] || inp.mouse.pressed[1]) && !overUI) this.panDrag = { sx, sy, cx: this.renderer.cam.x, cy: this.renderer.cam.y, moved: false };
    if (this.panDrag && panBtn) {
      const dx = sx - this.panDrag.sx, dy = sy - this.panDrag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.panDrag.moved = true;
      if (this.panDrag.moved) {
        this.renderer.cam.x = this.panDrag.cx - dx / this.renderer.cam.zoom;
        this.renderer.cam.y = this.panDrag.cy - dy / this.renderer.cam.zoom;
      }
    }
    if (this.panDrag && !panBtn) {
      if (!this.panDrag.moved) {
        // a right click without a drag: cancel the tool, or close the report
        if (this.mode.k !== 'idle') this.setMode({ k: 'idle' });
        else this.selected = null;
      }
      this.panDrag = null;
    }

    if (this.mode.k === 'build' && this.mode.kind === 'belt') return this.beltDrag(t, overUI);
    if (!inp.mouse.pressed[0] || overUI) return;
    if (!g.inb(t.x, t.y)) {
      this.selected = null;
      return;
    }
    if (this.mode.k === 'build') {
      this.act({ k: 'place', kind: this.mode.kind, x: t.x, y: t.y, rot: this.rot });
      return;
    }
    if (this.mode.k === 'remove') {
      this.act({ k: 'remove', x: t.x, y: t.y });
      return;
    }
    // idle: buy land, click the world, or open a report
    if (!g.owned(t.x, t.y)) {
      const ch = g.chunkAt(t.x, t.y);
      if (ch) this.act({ k: 'land', id: ch.id });
      return;
    }
    const e = g.entAt(t.x, t.y);
    const r = g.act({ k: 'click', x: t.x, y: t.y });
    if (r.ok) return;
    if (r.why && r.why !== 'nothing to click' && r.why !== 'too fast') this.refusal = { text: r.why, t: 1.5 };
    if (e) {
      if (e.kind === 'dock') this.togglePanel('orders');
      else if (e.kind === 'hopper') this.togglePanel('research');
      else this.selected = this.selected === e.id ? null : e.id;
    } else this.selected = null;
  }

  /** Lay belts by dragging: an L from where the drag started, each tile facing along the path. */
  private beltDrag(t: { x: number; y: number }, overUI: boolean) {
    const inp = this.input;
    if (inp.mouse.pressed[0] && !overUI && this.game.inb(t.x, t.y)) this.drag = { x0: t.x, y0: t.y, path: [{ x: t.x, y: t.y, rot: this.rot }] };
    if (this.drag && inp.mouse.down[0]) {
      const { x0, y0 } = this.drag;
      const dx = t.x - x0, dy = t.y - y0;
      const path: { x: number; y: number; rot: Dir }[] = [];
      if (dx === 0 && dy === 0) path.push({ x: x0, y: y0, rot: this.rot });
      else {
        const horizFirst = Math.abs(dx) >= Math.abs(dy);
        const hRot: Dir = dx > 0 ? 0 : 2, vRot: Dir = dy > 0 ? 1 : 3;
        let x = x0, y = y0;
        if (horizFirst) {
          for (; x !== t.x; x += Math.sign(dx)) path.push({ x, y, rot: hRot });
          for (; y !== t.y; y += Math.sign(dy)) path.push({ x, y, rot: vRot });
          path.push({ x, y, rot: dy ? vRot : hRot });
        } else {
          for (; y !== t.y; y += Math.sign(dy)) path.push({ x, y, rot: vRot });
          for (; x !== t.x; x += Math.sign(dx)) path.push({ x, y, rot: hRot });
          path.push({ x, y, rot: dx ? hRot : vRot });
        }
        this.rot = path[path.length - 1].rot;
      }
      this.drag.path = path;
    }
    if (this.drag && !inp.mouse.down[0]) {
      let placed = 0, why: string | undefined;
      for (const p of this.drag.path) {
        const r = this.game.act({ k: 'place', kind: 'belt', x: p.x, y: p.y, rot: p.rot });
        if (r.ok) placed++;
        else if (r.why !== 'already a belt facing that way') why = r.why;
      }
      if (!placed && why) {
        this.refusal = { text: why, t: 2 };
        this.audio.sfx('error');
      }
      this.drag = null;
    }
  }

  // ------------------------------------------------------------------ layout

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.imageSmoothingEnabled = false;
    this.uiScale = Math.max(1, Math.floor(Math.min(this.canvas.width / 480, this.canvas.height / 300)));
    this.renderer.resize(this.canvas.width, this.canvas.height);
    if (this.screen === 'play') this.fitCamera();
  }

  // ------------------------------------------------------------------ debug handle (window.__app)

  freeze() { this.frozen = true; }
  unfreeze() { this.frozen = false; }
  /** Run n ticks now (frozen or not). */
  step(n: number) { this.game.step(n); this.events(); }
  /** Fast-forward x10, x100 or x1000 (1 = normal). */
  ff(mult: number) { this.loop.speed = mult; }
  grant(coin: number) { this.game.s.coin = this.game.s.coin.add(coin); }
  /** CSS pixel of a tile's centre (for e2e clicks). */
  tileToCss(x: number, y: number) {
    const k = (window.devicePixelRatio || 1);
    const s = this.renderer.toScreen(x + 0.5, y + 0.5);
    return { x: s.x / k, y: s.y / k };
  }
  uiToCss(x: number, y: number) {
    const k = this.uiScale / (window.devicePixelRatio || 1);
    return { x: x * k, y: y * k };
  }
  stats() {
    const g = this.game;
    return {
      screen: this.screen, tick: g.s.tick, coin: g.s.coin.toNumber(), research: g.s.research.done.slice(),
      ents: g.s.ents.length, selected: this.selected, panel: this.panel, mode: this.mode.k,
    };
  }
  get TITLE() { return TITLE; }
  /** directions for e2e: tile deltas */
  get DIRS() { return { DX, DY }; }
  get hasSaveSlot() { return this.hasSave; }
}
