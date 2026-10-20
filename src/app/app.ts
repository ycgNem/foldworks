// The app: owns the Game, the renderer, the UI, input, audio and the loop. Screens (title, play),
// tools (build, remove, fold), the camera, saves and the debug handle window.__app. The sim
// never sees any of this: the app turns clicks into Game.act commands and the Game's events into
// sounds and effects.
import { Input } from '../engine/input';
import { GameLoop } from '../engine/loop';
import { Audio } from '../engine/audio/audio';
import { readSave, exportString, importString, store, loadSave, writeSaveSafe, badSave, AutoSave, type LoadResult } from '../engine/save';
import { Num } from '../engine/num';
import { TICK_RATE } from '../engine/time';
import { UI } from '../ui/ui';
import { C } from '../data/palette';
import { Game, type Cmd, type ActResult } from '../sim/Game';
import { savePayload, restore, checkSave } from '../sim/snapshot';
import { DX, DY, type Dir, type Floor } from '../sim/world';
import { FACTORY } from '../data/land';
import { OfflineRun, type OfflineReport } from '../sim/offline';
// ---- Milestone 6 (idle and offline): the background tab, robust saves, settings
import { Background } from './background';
import { IDLE } from '../data/idle';
import { loadSettings } from './settings';
import { stepJob } from './offlinereport';
import { foldRefusal, gradedAudit } from '../sim/systems/audits';
import { RULES } from '../data/rules';
import { ffoldRefusal } from '../sim/systems/nested';
import { factoryOpen } from '../sim/systems/modules';
import { BUILD, STORE_TABS, type BuildKind } from '../data/machines';
import { ITEMS, type ItemId } from '../data/items';
import { MEGA } from '../data/megaprojects';
import { CHUNKS } from '../data/land';
import { RESEARCH } from '../data/research';
import { ORDER, CUSTOMERS } from '../data/orders';
import { TITLE } from '../game-info';
import { Renderer, type Overlay } from '../render/renderer';
import { TILE } from '../render/ground';
import { drawHud, drawTitle, newHudState, banner, type HudState } from './hud';
import { TOWN_ROWS } from '../render/town';
import { ICON } from '../ui/font';
import { plateRaw } from './chrome';
import { layout, type Layout } from './layout';
import { Gazette } from './gazette';
import type { ScreenName } from './screens';
import { TROPHY } from '../data/trophies';
import { Bot, type Policy } from '../sim/bot';
// Milestone 5: Reorganize, the Patent tree and blueprints (src/app/reorganize.ts, patents.ts, blueprints.ts)
import { blueprintInput, blueprintPreview, blueprintHud, bpBoxOk, ghostClick } from './blueprints';
import { prules } from '../sim/patents';

export type Mode =
  | { k: 'idle' }
  | { k: 'build'; kind: BuildKind }
  | { k: 'remove' }
  /** dragging a box over a line to audit and fold it (on the Factory floor: a group of modules) */
  | { k: 'fold' }
  /** the Factory floor: laying trunk belts, or placing a module design */
  | { k: 'ftrunk' }
  | { k: 'fmodule'; design: number }
  /** Milestone 5: dragging a box to save a blueprint; placing one as ghosts */
  | { k: 'bpsave' }
  | { k: 'bpplace'; id: number };

export type Panel = ScreenName | null;

export interface Toast { title: string; text: string; color: string; t: number; life: number; icon?: string }

const SAVE_SLOT = 1;
/** a save loads only if the game rebuilds from it (DESIGN.md §20, corruption recovery) */
const validSave = (d: unknown) => void checkSave(d as never);

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
  hud: HudState = newHudState();
  flowOverlay = false;
  muted = false;
  /** big-number notation for the HUD (options) */
  notation: 'standard' | 'scientific' = 'standard';
  /** where the HUD regions sit, in UI px */
  layout: Layout = layout(480, 300);
  gazette = new Gazette();
  /** trophies just earned, shown as a medal sliding in */
  trophyPops: { id: string; t: number }[] = [];
  /** which floor is on screen */
  floor: Floor = 'workshop';
  /** the fold box being dragged (tiles, inclusive corners) */
  foldDrag: { x0: number; y0: number; x1: number; y1: number } | null = null;
  /** the Factory floor entity whose report is pinned */
  fselected: number | null = null;
  /** the grade card's name field while it is open */
  nameDraft: string | null = null;
  /** when the grade card opened (its stamp animation runs from here) */
  gradeAt = 0;
  /** the Workshop audit whose grade card is open (several can be graded at once) */
  gradeId: number | null = null;
  /** what happened while the player was away, shown once on Continue */
  offline: OfflineReport | null = null;
  /** a bot playing this game (debug handle and the e2e scripts) */
  bot: Bot | null = null;
  private hasSave = false;
  // ---- Milestone 6 (DESIGN.md §20): autosave by the real clock, the background tab, offline runs
  /** autosave every 30 s of real time (not sim time: fast-forward must not save every frame) */
  autosave = new AutoSave(IDLE.autosaveSeconds.value * 1000, Date.now());
  /** keeps the sim running on a coarse timer while the tab is hidden */
  bg = new Background(() => this.tick());
  /** an offline run spread over frames (the report card shows its progress) */
  offlineJob: OfflineRun | null = null;
  /** how the last load went: a damaged save and the backup used, in plain words */
  loadNote: string | null = null;
  /** what the title screen offers */
  titleInfo: { hasSave: boolean; coin: string } = { hasSave: false, coin: '0' };
  /** the town piece under the mouse: its one-line label */
  townTip: string | null = null;
  /** the slice-end card waits for the Gizmo parade (UI time it opens at) */
  sliceAt: number | null = null;
  /** the mouse is over the canvas (edge-scrolling and the coin drop-down stop when it leaves) */
  mouseIn = false;
  /** seconds the mouse has rested at an edge of the floor view */
  private edgeT = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.ctx);
    this.game = new Game(1);
    this.loop = new GameLoop(() => this.tick(), (dt, alpha) => this.frame(dt, alpha));
    this.input.attach(canvas);
    canvas.addEventListener('pointerenter', () => { this.mouseIn = true; });
    canvas.addEventListener('pointermove', () => { this.mouseIn = true; });
    canvas.addEventListener('pointerleave', () => { this.mouseIn = false; });
    window.addEventListener('blur', () => { this.mouseIn = false; });
    this.ui.sfx = (id) => this.audio.sfx(id);
    // tooltips wear the HUD's plate (the UI redesign: one calm panel language)
    this.ui.tipSkin = (ctx, x, y, w, h) => plateRaw(ctx, x, y, w, h);
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.visibility());
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false });
    window.addEventListener('keydown', () => this.audio.unlock(), { once: false });
    window.addEventListener('beforeunload', () => { if (this.screen === 'play') this.save(); });
    // pagehide fires where beforeunload does not (mobile, bfcache): closing never loses more than
    // the last 30 s, and usually nothing (DESIGN.md §20)
    window.addEventListener('pagehide', () => { if (this.screen === 'play') this.save(); });
    loadSettings();
    this.resize();
    const r = this.readSlot();
    this.hasSave = !!r.data;
    if (r.data) {
      try {
        const g = restore(r.data as never);
        this.titleInfo = { hasSave: true, coin: g.s.coin.format() };
      } catch {
        this.hasSave = false;
      }
    }
  }

  /** Read the save slot, falling back to the newest good backup (DESIGN.md §20). */
  private readSlot(): LoadResult {
    const r = loadSave(SAVE_SLOT, validSave, IDLE.backups.value);
    if (r.problem && r.data) {
      const ago = Math.max(0, Date.now() - (r.data.saved ?? Date.now())) / 60000;
      const when = ago < 1 ? 'less than a minute' : ago < 120 ? `${Math.round(ago)} minutes` : `${Math.round(ago / 60)} hours`;
      this.loadNote = `Your last save could not be loaded (${r.problem}). Loaded the backup from ${when} ago; the damaged one is kept in Options.`;
    } else if (r.problem) this.loadNote = `Your save could not be loaded (${r.problem}) and no backup loads. It is kept in Options.`;
    else this.loadNote = null;
    return r;
  }

  /** The damaged save kept aside by the last failed load, if any. */
  damagedSave(): string | null {
    return badSave(SAVE_SLOT);
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
    this.trophyPops = [];
    this.renderer.ground = null;
    this.hud = newHudState();
    this.offline = null;
    this.gradeId = null;
    this.setFloor('workshop', true);
    this.fitCamera(true);
  }

  continueGame() {
    const d = this.readSlot().data;
    if (!d) return this.newGame();
    try {
      this.game = restore(d as never);
    } catch (err) {
      console.error(err);
      return this.newGame();
    }
    this.screen = 'play';
    this.renderer.ground = null;
    this.setFloor('workshop', true);
    this.fitCamera(true);
    if (this.loadNote) {
      this.toasts.push({ title: 'Save recovered', text: this.loadNote, color: C.amber, t: 0, life: 16 });
      this.loadNote = null;
    }
    // offline progress (DESIGN.md §12): the clock is read here, in the app, never in the sim
    const away = (Date.now() - (d.saved ?? Date.now())) / 1000;
    if (away >= 60) this.startOffline(away);
    this.hud = newHudState();
    this.hud.coinShown = this.game.s.coin.toNumber();
    // a saved game past its first Miner never celebrates it again
    this.hud.firstMiner = this.game.miners.length > 0 || this.game.done('pressing');
  }

  /** Switch the floor on screen (the Factory opens with the first fold). */
  setFloor(f: Floor, quiet = false) {
    if (f === 'factory' && !factoryOpen(this.game)) {
      if (!quiet) this.refuse('The Factory floor opens with your first fold');
      return;
    }
    const first = f !== this.floor;
    if (first) this.renderer.fx.clearWorld();
    this.floor = f;
    this.renderer.floor = f;
    this.mode = { k: 'idle' };
    // a report pinned on one floor never shows over the other (the Milestone 1-2 review)
    if (f === 'factory') this.selected = null;
    else this.fselected = null;
    this.drag = null;
    this.foldDrag = null;
    if (first && !quiet) this.audio.sfx('open');
    if (f === 'factory' && !this.game.flag('factorySeen')) {
      this.game.first('factorySeen');
      this.fitCamera(true);
    }
  }

  toTitle() {
    const d = readSave(SAVE_SLOT);
    this.titleInfo = { hasSave: !!d, coin: this.game.s.coin.format() };
    this.screen = 'title';
    this.panel = null;
  }

  /** Copy an export string to the clipboard (falls back to a prompt to copy from). */
  copyExport() {
    const s = this.exportSave();
    const done = () => this.toast('Save copied', 'Paste it into Import on any browser to carry on there.', C.leaf);
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => window.prompt('Copy your save string:', s));
    else window.prompt('Copy your save string:', s);
  }

  promptImport() {
    const s = window.prompt('Paste a Foldworks save string:');
    if (!s) return;
    const r = this.importSave(s.trim());
    if (r.ok) this.toast('Save loaded', 'Welcome back.', C.leaf);
    else this.refuse(r.why ?? 'that save did not load');
  }

  save(): boolean {
    if (this.screen !== 'play') return false;
    // mid offline run the state is between two moments: the save before it stands until it ends
    if (this.offlineJob) return false;
    const now = Date.now();
    const r = writeSaveSafe(SAVE_SLOT, savePayload(this.game, now) as never, { now, backupMs: IDLE.backupMinutes.value * 60000, backups: IDLE.backups.value, validate: validSave });
    this.autosave.mark(now);
    this.hasSave = r.ok || this.hasSave;
    return r.ok;
  }

  /** Offline progress for `away` seconds (DESIGN.md §12), spread over frames with the report card
   * showing its progress, then the report. */
  startOffline(away: number) {
    const run = new OfflineRun(this.game, away);
    this.offlineJob = run;
    this.offline = null;
    this.panel = 'offline';
    this.loop.job = () => {
      if (!stepJob(run)) return false;
      this.offlineJob = null;
      this.offline = run.report;
      this.panel = 'offline';
      this.game.events.drain();
      this.save();
      return true;
    };
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

  /** when the tab was hidden (ms since epoch), for offline progress on its return */
  private hiddenAt = 0;

  private visibility() {
    if (this.screen !== 'play') return;
    const hidden = document.hidden;
    if (hidden) {
      this.game.act({ k: 'visible', v: false });
      this.hiddenAt = Date.now();
      this.save();
      // the sim keeps running on a coarse timer, Sparks paused (DESIGN.md §20); an offline run
      // already going carries on when the tab is back
      if (!this.offlineJob && !this.frozen) this.bg.hide(this.hiddenAt);
      return;
    }
    const back = this.bg.show();
    this.hiddenAt = 0;
    this.game.act({ k: 'visible', v: true });
    // what the pump could not run: a little is caught up live over the next frames; a long sleep
    // (or a lot owed) is time away, through the offline path (DESIGN.md §20)
    const live = back.owed <= IDLE.catchUpLiveSeconds.value;
    const away = back.away + (live ? 0 : back.owed);
    this.loop.catchUpPerFrame = IDLE.catchUpTicksPerFrame.value;
    if (live) this.loop.catchUp += Math.round(back.owed * TICK_RATE);
    if (away >= 60 && !this.bot) this.startOffline(away);
    else if (away > 0) this.loop.catchUp += Math.round(away * TICK_RATE);
  }

  // ------------------------------------------------------------------ the loop

  private tick() {
    if (this.screen !== 'play' || this.frozen || this.offlineJob) return;
    this.bot?.update();
    this.game.tick();
    // autosave by the real clock, checked once a game second (DESIGN.md §20)
    if (this.game.s.tick % TICK_RATE === 0 && this.autosave.due(Date.now()) && store()) this.save();
  }

  private frame(dt: number, alpha: number) {
    const ctx = this.ctx;
    const g = this.game;
    this.events();
    if (this.screen === 'title') {
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
    if (this.sliceAt !== null && (this.ui.time >= this.sliceAt || !this.renderer.parade)) {
      this.sliceAt = null;
      this.panel = 'sliceEnd';
      this.gradeAt = this.ui.time;
    }
    const ov = this.overlay();
    this.renderer.draw(g, dt, this.frozen ? 0 : alpha, ov);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.renderer.drawScreenFx(ctx, this.uiScale);
    this.ui.begin(ctx, this.input, this.uiScale, dt, false);
    drawHud(this, dt);
    blueprintHud(this); // Milestone 5
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
        case 'place': {
          a.sfx(e.id === 'belt' ? 'belt' : 'place');
          // the first Miner: the first thing that works without a click (the first automation)
          if (e.id === 'miner' && (e.floor ?? 'workshop') === 'workshop' && this.game.miners.length === 1 && !this.hud.firstMiner) {
            this.hud.firstMiner = true;
            a.sfx('fanfare', 0.7);
            a.sfx('codex', 0.6, 1.2);
            this.renderer.firstMiner(e.x ?? 0, e.y ?? 0);
            this.toast('Your first Miner!', 'It digs on its own: ore every 2 s, no clicks. Belt it into the furnace and the line runs while you watch.', C.gold, 'build');
          }
          // the first Mk2 machine: a fanfare and a banner
          if (e.id && /Mk2$/.test(e.id) && (e.floor ?? 'workshop') === 'workshop' && (this.game.s.counters.mk2Built ?? 0) <= 1 && this.game.s.ents.filter((q) => /Mk2$/.test(q.kind)).length === 1) {
            a.sfx('fanfare', 0.8);
            this.renderer.fx.kick(4);
            banner(this, 'FIRST MK2!', `${BUILD[e.id as BuildKind]?.name ?? 'A Mk2 machine'}: ${BUILD[e.id as BuildKind]?.speed ?? 4}x the speed of its Mk1, in 2x2`, C.copper2);
            this.renderer.firstMk2(e.x ?? 0, e.y ?? 0);
          }
          break;
        }
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
          this.gazette.push(`EXTRA! ${d.name} delivered to ${c.name}. ${Num.of(d.pays).format()} coin changes hands.`);
          // a reputation level: a fanfare and a banner naming what it gives
          const rep = this.game.s.orders.rep[d.customer];
          const reward = c.rewards.find((q) => q.rep === rep);
          a.sfx('fanfare', 0.7);
          banner(this, `${ICON.heart.repeat(Math.max(1, Math.min(3, rep)))} REPUTATION ${rep}!`, `${c.name}: ${reward ? reward.text : 'a new house in town'}`, C.leaf);
          // the Festival: the Factory floor, to watch the Gizmo parade into its Dock
          if (e.id === 'gizmoFestival' && !this.panel && this.floor !== 'factory') this.setFloor('factory', true);
          break;
        }
        case 'spark': a.sfx('spark'); break;
        case 'sparkGet': a.sfx('sparkGet'); if (e.id === 'vein') this.toast('Lucky Vein!', "This patch's miners run 3x for 60 s.", C.gold); break;
        case 'inspected': this.toast(`Inspector: grade ${e.id}`, `Score ${(e.d ?? 0).toFixed(2)}. Handed ${Num.of(e.value ?? 0).format()} items, a minute of this line's output, to research.`, C.gold); break;
        case 'firstSlagJam': a.sfx('jam'); this.toast('Blocked: slag!', 'Smelting leaves slag, and it has nowhere to go. Click the machine to shovel it, or build a Slag Heap beside it.', C.pipRed); break;
        case 'firstSale': this.toast('First sale!', 'The Dock buys what you make. Coin buys machines.', C.gold); break;
        case 'orderAccept': a.sfx('open'); break;
        case 'trophy': {
          a.sfx('milestone', 0.7);
          if (e.id && TROPHY[e.id]) this.trophyPops.push({ id: e.id, t: 0 });
          if (this.trophyPops.length > 3) this.trophyPops.shift();
          break;
        }
        case 'jam': a.sfx('jam', 0.4); break;
        case 'auditStart': a.sfx('foldStart'); break;
        case 'auditCancel': a.sfx('close'); break;
        case 'auditDone': {
          // the grade card opens with its stamp (the stamp's sound plays when it lands), unless
          // the player is reading another line's grade card: then its badge waits, glowing
          const reading = this.panel === 'grade' && this.gradeId !== null && this.game.s.audits.some((q) => q.id === this.gradeId && q.result);
          this.audio.sfx('auditTick');
          if (e.id === 'S+') this.toast('S+! A flawless line', 'Every machine busy, every scrap of waste handled, not a tile wasted. Fold it: x1.35 for good.', C.gold, 'star');
          if (reading) break;
          this.panel = e.floor === 'factory' ? 'fgrade' : 'grade';
          if (e.floor !== 'factory' && e.value !== undefined) this.gradeId = e.value;
          this.gradeAt = this.ui.time;
          this.nameDraft = null;
          this.hud.stamped = false;
          break;
        }
        // ---- Act II (Milestone 4)
        case 'overdrive': break; // the renderer plays its burst, sound and kick
        case 'mode': a.sfx('click'); break;
        case 'powerOn':
          a.sfx('powerOn');
          this.renderer.fx.kick(2);
          this.toast('Power on!', 'The grid hums. Powered machines run while supply meets demand; past it, everything on the grid slows together.', C.teal1, 'power');
          break;
        case 'codex': {
          a.sfx('sparkGet');
          const it = ITEMS[e.id as ItemId];
          this.toast('Codex entry!', `Unit 7 catalogues ${it ? it.name.toLowerCase() : 'it'}: ${Num.of(e.value ?? 0).format()} coin for the first one.`, C.gold, 'codex');
          a.sfx('fanfare', 0.5, 1.2);
          banner(this, 'CODEX FIRST!', `${it ? it.name : 'A new item'}: +${Num.of(e.value ?? 0).format()} coin`, C.teal1);
          break;
        }
        case 'claim': a.sfx('upgrade'); this.toast('Claims staked', `${e.value ?? 4} more ${ITEMS[e.id as ItemId]?.name.toLowerCase() ?? ''} claims: stamp more copies of modules that dig it.`, C.leaf, 'claim'); break;
        case 'parts': a.sfx('hopper', 0.5); break;
        case 'bayOpen': a.sfx('milestone', 0.7); this.toast('The Megaproject Bay', 'Trunk Drill Bits, concrete and steel into it to build the Great Drill.', C.gold, 'mega'); break;
        case 'megaGive': break;
        case 'megaDone': {
          a.sfx('milestone');
          this.renderer.fx.kick(6);
          this.panel = 'mega';
          this.gradeAt = this.ui.time;
          const st = MEGA.find((m) => m.stage === e.value);
          this.toast(`${st?.name ?? 'Megaproject'}: done!`, st?.reward ?? '', C.gold, 'mega');
          break;
        }
        case 'firstNested': this.toast('A module of modules', 'A depth-2 module: the group\'s rates in one tile, times its own grade.', C.gold, 'fold'); break;
        case 'inspectGift': break;
        case 'fold':
          a.sfx('fold');
          this.renderer.fx.kick(4);
          if (e.id === 'S+') {
            a.sfx('fanfare', 0.8);
            this.hud.celebs.push({ kind: 'splus', t: 0, x: this.ui.w / 2, y: this.ui.h / 2, id: 'fold' });
            this.toast('Folded at S+!', 'The best module there is: x1.35 its rates, in one tile. The Gazette is printing a special edition.', C.gold, 'star');
          } else this.toast('Folded!', 'The line is a module now: one tile with its rates. Open Modules (I) or the Factory floor (Tab) to place it.', C.gold, 'module');
          break;
        case 'firstFold':
          this.toast('The Factory floor is open', 'Press Tab or the Factory tab to go there. Modules run as rates; trunk belts carry 480 a minute.', C.gold, 'factory');
          break;
        case 'stamp': a.sfx('stamp'); break;
        case 'unfold': a.sfx('place'); break;
        case 'sliceEnd':
          a.sfx('milestone');
          this.renderer.fx.kick(5);
          // the card waits for the Gizmo parade into the Factory Dock to finish
          if (this.game.s.meta.runs > 0) {
            // a later run (DESIGN.md §19): the Festival again, celebrated briefly
            this.toast('The Gizmo Festival, again', 'Bramble throws it every run. The swamp has learned to expect it.', C.gold, 'star');
            break;
          }
          if (this.renderer.parade && this.floor === 'factory') this.sliceAt = this.ui.time + Math.max(0.5, 3.6 - this.renderer.parade.t);
          else {
            this.panel = 'sliceEnd';
            this.gradeAt = this.ui.time;
          }
          break;
      }
    }
  }

  /** Say no, under the cursor, with a buzz. */
  refuse(text: string) {
    this.refusal = { text, t: 2 };
    this.audio.sfx('error');
  }

  /** Centre the camera on a tile point (from the HUD's find button, land buys, goals). */
  lookAt(tx: number, ty: number) {
    this.renderer.cam.x = tx * TILE;
    this.renderer.cam.y = ty * TILE;
    this.renderer.clampCam(this.game.W, this.game.H);
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
    this.edgeScroll(dt);
    if (inp.wasPressed('zoomIn')) this.zoom(1);
    if (inp.wasPressed('zoomOut')) this.zoom(-1);
    if (inp.mouse.wheel && !this.ui.captured) this.zoom(-inp.mouse.wheel);
    if (inp.wasPressed('rotate')) {
      if (this.mode.k === 'build' || this.mode.k === 'ftrunk' || this.mode.k === 'fmodule') { this.rot = ((this.rot + 1) % 4) as Dir; this.audio.sfx('rotate'); }
      else if (this.hud.hoverTile) {
        const h = this.hud.hoverTile;
        this.act(this.floor === 'factory' ? { k: 'frotate', x: h.x, y: h.y } : { k: 'rotate', x: h.x, y: h.y });
      }
    }
    if (inp.wasPressed('remove')) this.setMode(this.mode.k === 'remove' ? { k: 'idle' } : { k: 'remove' });
    if (inp.wasPressed('floor')) this.setFloor(this.floor === 'workshop' ? 'factory' : 'workshop');
    if (inp.wasPressed('fold')) this.toggleFold();
    if (inp.wasPressed('modules')) this.togglePanel('modules');
    if (inp.wasPressed('research')) this.togglePanel('research');
    if (inp.wasPressed('orders')) this.togglePanel('orders');
    if (inp.wasPressed('help')) this.togglePanel('options');
    if (inp.wasPressed('flow')) this.flowOverlay = !this.flowOverlay;
    if (inp.wasPressed('mute')) { this.muted = !this.muted; this.audio.setMuted(this.muted); }
    if (inp.wasPressed('cancel')) {
      if (this.panel) this.panel = null;
      else if (this.mode.k !== 'idle') this.setMode({ k: 'idle' });
      else { this.selected = null; this.fselected = null; }
    }
    for (let i = 0; i < 9; i++) {
      if (inp.wasPressed(('slot' + (i + 1)) as 'slot1')) {
        if (this.floor === 'factory') {
          // 1: trunk belts; 2-9: the module designs in inventory order
          if (i === 0) this.setMode(this.mode.k === 'ftrunk' ? { k: 'idle' } : { k: 'ftrunk' });
          else {
            const d = this.game.s.designs[i - 1];
            if (d) this.pickModule(d.id);
          }
          continue;
        }
        // keys 1-9 pick from the build bar's open tab (Build, Power, Heavy); from Upgrades they
        // go back to the last building tab
        if (this.hud.storeTab === 'upgrades') this.hud.storeTab = 'build';
        const tab = STORE_TABS.find((q) => q.id === this.hud.buildTab) ?? STORE_TABS[0];
        const kind = tab.kinds[i];
        if (kind) this.pickBuild(kind);
      }
    }
    if (this.floor === 'factory') this.renderer.clampCam(FACTORY.w, FACTORY.h);
    else this.renderer.clampCam(this.game.W, this.game.H);
  }

  /** Rest the mouse at an edge of the floor view to pan that way, while the floor runs past it. */
  private edgeScroll(dt: number) {
    const c = this.layout.center;
    const ui = this.ui;
    const m = 10;
    const inside = this.mouseIn && !this.panel && ui.mx >= c.x && ui.my >= c.y && ui.mx < c.x + c.w && ui.my < c.y + c.h;
    const dx = !inside ? 0 : ui.mx < c.x + m ? -1 : ui.mx >= c.x + c.w - m ? 1 : 0;
    const dy = !inside ? 0 : ui.my < c.y + m ? -1 : ui.my >= c.y + c.h - m ? 1 : 0;
    if (!dx && !dy) { this.edgeT = 0; return; }
    this.edgeT += dt;
    if (this.edgeT < 0.3 || this.input.mouse.down[0]) return;
    const cam = this.renderer.cam;
    const sp = (200 * dt) / Math.max(1, cam.zoom / 2) * Math.min(1, (this.edgeT - 0.3) * 3);
    cam.x += dx * sp;
    cam.y += dy * sp;
  }

  /** Which edges of the floor view have more floor (or town) beyond them: for the HUD's arrows. */
  panHints(): { l: boolean; r: boolean; u: boolean; d: boolean } {
    const r = this.renderer;
    const fw = this.floor === 'factory' ? FACTORY.w : this.game.W, fh = this.floor === 'factory' ? FACTORY.h : this.game.H;
    const a = r.screenToWorld(r.view.x, r.view.y), b = r.screenToWorld(r.view.x + r.view.w, r.view.y + r.view.h);
    return { l: a.x > 4, r: b.x < fw * TILE - 4, u: a.y > -TOWN_ROWS * TILE + 4, d: b.y < fh * TILE - 4 };
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

  /** The Fold tool (F): drag a box over a working line (on the Factory floor, with Nested Folds:
   * over a group of modules). */
  toggleFold() {
    if (!this.game.done('folding')) return this.refuse('Research Folding first');
    if (this.floor === 'factory' && this.game.done('nestedFolds')) {
      const fa = this.game.s.faudit;
      if (fa) {
        this.panel = fa.result ? 'fgrade' : null;
        return this.refuse(fa.result ? 'Fold or cancel the graded group first' : 'An audit is running on this floor: one at a time');
      }
      this.setMode(this.mode.k === 'fold' ? { k: 'idle' } : { k: 'fold' });
      return;
    }
    if (this.floor !== 'workshop') this.setFloor('workshop', true);
    const maxAudits = prules(this.game).maxAudits; // Milestone 5: More Auditors raises it
    if (this.game.s.audits.length >= maxAudits) {
      const ga = gradedAudit(this.game);
      this.panel = ga ? 'grade' : null;
      if (ga) { this.gradeId = ga.id; this.gradeAt = this.ui.time; this.hud.stamped = false; this.nameDraft = null; }
      return this.refuse(ga ? 'Fold or cancel a graded line first' : `${maxAudits} audits are running: wait for a grade`);
    }
    this.setMode(this.mode.k === 'fold' ? { k: 'idle' } : { k: 'fold' });
  }

  /** Place a module design on the Factory floor. */
  pickModule(id: number) {
    const d = this.game.design(id);
    if (!d) return;
    if (d.spare < 1) return this.refuse(`No spare ${d.name}: stamp a copy`);
    if (this.floor !== 'factory') this.setFloor('factory');
    if (this.floor !== 'factory') return;
    this.panel = null;
    this.setMode(this.mode.k === 'fmodule' && this.mode.design === id ? { k: 'idle' } : { k: 'fmodule', design: id });
  }

  setMode(m: Mode) {
    this.mode = m;
    this.drag = null;
    this.foldDrag = null;
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

  /** The zoom that fills the floor view: the largest whole zoom at which `w` x `h` world px fit,
   *  one more when that leaves most of the view empty water (the Milestone 4 review: the 24x16
   *  Workshop drew at 1x in a quarter of a 1280x720 view). Past the fit the floor pans (drag with
   *  the right button, WASD, or rest the mouse at the view's edge). */
  private fillZoom(w: number, h: number): number {
    const v = this.renderer.view;
    const availH = v.h - 8 * this.uiScale, availW = v.w - 8 * this.uiScale;
    let z = Math.max(1, Math.min(this.maxZoom(), Math.floor(Math.min(availW / w, availH / h))));
    if (z + 1 <= this.maxZoom() && w * z < availW * 0.75 && h * z < availH * 0.75) z++;
    return z;
  }

  /** Centre the camera on rows y0..y1 (world px), showing Bramble's Town above them when the
   *  floor and the town fit together. */
  private frameRows(y0: number, y1: number) {
    const cam = this.renderer.cam;
    const viewH = this.renderer.view.h / cam.zoom;
    const town = TOWN_ROWS * TILE;
    const over = y1 - y0 + town - viewH;
    // all of it fits: centre floor and town together; a little short: the town on top and the
    // floor's last few pixels off the bottom (a pan away); far short: the floor alone
    if (over <= 0) cam.y = (y0 - town + y1) / 2;
    else if (over <= 2 * TILE) cam.y = y0 - town + viewH / 2;
    else cam.y = (y0 + y1) / 2;
  }

  /** Zoom to fill the view with the land you own, and centre it. */
  fitCamera(reset = false) {
    const g = this.game;
    const cam = this.renderer.cam;
    if (this.floor === 'factory') {
      const z = this.fillZoom((FACTORY.w + 1) * TILE, (FACTORY.h + 1) * TILE);
      if (reset || cam.zoom > z) cam.zoom = z;
      cam.x = (FACTORY.w / 2) * TILE;
      this.frameRows(0, FACTORY.h * TILE);
      this.renderer.clampCam(FACTORY.w, FACTORY.h);
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of CHUNKS) {
      if (!g.s.land.includes(c.id)) continue;
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h);
    }
    // show a little of the land around what you own
    const z = this.fillZoom((x1 - x0 + 2) * TILE, (y1 - y0 + 2) * TILE);
    if (reset || cam.zoom > z) cam.zoom = z;
    cam.x = ((x0 + x1) / 2) * TILE;
    // the town sits on the water above the top edge: frame it in when the owned land starts there
    if (y0 === 0) this.frameRows(0, y1 * TILE + 4);
    else cam.y = ((y0 + y1) / 2) * TILE + 4;
    this.renderer.clampCam(g.W, g.H);
  }

  private overlay(): Overlay {
    const h = this.hud.hoverTile;
    return {
      hover: this.floor === 'workshop' ? h : null,
      build: this.mode.k === 'build' ? this.mode.kind : null,
      rot: this.rot,
      drag: this.floor === 'workshop' && this.drag ? this.drag.path : null,
      remove: this.mode.k === 'remove',
      selected: this.selected,
      box: this.foldDrag && this.floor === 'workshop' ? { ...this.foldDrag, ok: this.mode.k === 'bpsave' ? bpBoxOk(this) : !foldRefusal(this.game, this.dragBox()!) } : null,
      bp: blueprintPreview(this), // Milestone 5
      flow: this.flowOverlay,
      floor: this.floor,
      factory: {
        hover: this.floor === 'factory' ? h : null,
        place: this.mode.k === 'ftrunk' ? { kind: 'trunk' } : this.mode.k === 'fmodule' ? { kind: 'module', design: this.mode.design } : null,
        rot: this.rot,
        drag: this.floor === 'factory' && this.drag ? this.drag.path : null,
        remove: this.mode.k === 'remove',
        selected: this.fselected,
        box: this.foldDrag && this.floor === 'factory' ? { ...this.foldDrag, ok: !ffoldRefusal(this.game, this.dragBox()!) } : null,
      },
    };
  }

  /** The dragged fold box as x, y, w, h. */
  dragBox() {
    const d = this.foldDrag;
    if (!d) return null;
    return { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0) + 1, h: Math.abs(d.y1 - d.y0) + 1 };
  }

  /** Mouse on the world, after the HUD has had its chance to take the click. */
  private worldInput() {
    const inp = this.input;
    const g = this.game;
    const k = this.canvas.width / (this.canvas.clientWidth || this.canvas.width);
    const sx = inp.mouse.x * k, sy = inp.mouse.y * k;
    const overUI = this.ui.overUI;
    const t = this.renderer.screenToTile(sx, sy);
    // the tile the button went down on (drags start there even if the mouse has moved on)
    const pt = this.renderer.screenToTile(inp.mouse.px * k, inp.mouse.py * k);
    const inFloor = this.floor === 'factory' ? t.x >= 0 && t.y >= 0 && t.x < FACTORY.w && t.y < FACTORY.h : g.inb(t.x, t.y);
    this.hud.hoverTile = !overUI && inFloor ? t : null;
    this.townTip = !overUI && !inFloor && this.mouseIn ? this.renderer.townAt(sx, sy) : null;

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

    if (this.floor === 'factory') return this.factoryInput(t, overUI, pt);
    if (this.mode.k === 'fold') return this.foldInput(t, overUI, pt);
    if (blueprintInput(this, t, overUI, pt)) return; // Milestone 5: the blueprint tools
    if (this.mode.k === 'build' && this.mode.kind === 'belt') return this.beltDrag(t, overUI, pt);
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
    if (ghostClick(this, t.x, t.y)) return; // Milestone 5: a click on a ghost builds it
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

  /** The Fold tool: drag a box; on release, start the audit (or say why not). */
  private foldInput(t: { x: number; y: number }, overUI: boolean, pt: { x: number; y: number }) {
    const inp = this.input;
    const g = this.game;
    const cx = Math.max(0, Math.min(g.W - 1, t.x)), cy = Math.max(0, Math.min(g.H - 1, t.y));
    if (inp.mouse.pressed[0] && !overUI && g.inb(pt.x, pt.y)) this.foldDrag = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
    if (this.foldDrag && inp.mouse.down[0]) {
      this.foldDrag.x1 = cx;
      this.foldDrag.y1 = cy;
    }
    if (this.foldDrag && !inp.mouse.down[0]) {
      const b = this.dragBox()!;
      this.foldDrag = null;
      const r = this.act({ k: 'audit', ...b });
      if (r.ok) this.setMode({ k: 'idle' });
    }
  }

  /** The Factory floor: lay trunks by dragging, place modules, remove, or open a report. */
  private factoryInput(t: { x: number; y: number }, overUI: boolean, pt: { x: number; y: number }) {
    const inp = this.input;
    const g = this.game;
    const inFloor = t.x >= 0 && t.y >= 0 && t.x < FACTORY.w && t.y < FACTORY.h;
    if (this.mode.k === 'fold') {
      // a nested fold: drag a box over a group of modules (DESIGN.md §18)
      const pIn = pt.x >= 0 && pt.y >= 0 && pt.x < FACTORY.w && pt.y < FACTORY.h;
      const cx = Math.max(0, Math.min(FACTORY.w - 1, t.x)), cy = Math.max(0, Math.min(FACTORY.h - 1, t.y));
      if (inp.mouse.pressed[0] && !overUI && pIn) this.foldDrag = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      if (this.foldDrag && inp.mouse.down[0]) { this.foldDrag.x1 = cx; this.foldDrag.y1 = cy; }
      if (this.foldDrag && !inp.mouse.down[0]) {
        const b = this.dragBox()!;
        this.foldDrag = null;
        if (this.act({ k: 'faudit', ...b }).ok) this.setMode({ k: 'idle' });
      }
      return;
    }
    if (this.mode.k === 'ftrunk') {
      const pIn = pt.x >= 0 && pt.y >= 0 && pt.x < FACTORY.w && pt.y < FACTORY.h;
      if (inp.mouse.pressed[0] && !overUI && pIn) this.drag = { x0: pt.x, y0: pt.y, path: [{ x: pt.x, y: pt.y, rot: this.rot }] };
      if (this.drag && inp.mouse.down[0]) this.drag.path = this.lPath(this.drag.x0, this.drag.y0, t.x, t.y);
      if (this.drag && !inp.mouse.down[0]) {
        let placed = 0, why: string | undefined;
        for (const p of this.drag.path) {
          const r = g.act({ k: 'ftrunk', x: p.x, y: p.y, rot: p.rot });
          if (r.ok) placed++;
          else if (r.why !== 'already a trunk facing that way') why = r.why;
        }
        if (!placed && why) this.refuse(why);
        this.drag = null;
      }
      return;
    }
    if (!inp.mouse.pressed[0] || overUI) return;
    if (!inFloor) { this.fselected = null; return; }
    if (this.mode.k === 'fmodule') {
      const r = this.act({ k: 'fplace', design: this.mode.design, x: t.x, y: t.y, rot: this.rot });
      if (r.ok && (g.design(this.mode.design)?.spare ?? 0) < 1) this.setMode({ k: 'idle' });
      return;
    }
    if (this.mode.k === 'remove') { this.act({ k: 'fremove', x: t.x, y: t.y }); return; }
    const e = g.fentAt(t.x, t.y);
    if (e?.kind === 'fdock') this.togglePanel('orders');
    else if (e?.kind === 'fhopper') { if (!g.act({ k: 'fclick', x: t.x, y: t.y }).ok) this.togglePanel('research'); } // Inspiration (§20)
    else if (e?.kind === 'fbay') this.togglePanel('mega');
    else if (e?.kind === 'module' && g.done('overdrive') && g.act({ k: 'fclick', x: t.x, y: t.y }).ok) return;
    else this.fselected = e && this.fselected !== e.id ? e.id : null;
  }

  /** An L-shaped path of tiles from (x0, y0) to (x1, y1), each facing along it. */
  private lPath(x0: number, y0: number, x1: number, y1: number): { x: number; y: number; rot: Dir }[] {
    const dx = x1 - x0, dy = y1 - y0;
    const path: { x: number; y: number; rot: Dir }[] = [];
    if (dx === 0 && dy === 0) return [{ x: x0, y: y0, rot: this.rot }];
    const horizFirst = Math.abs(dx) >= Math.abs(dy);
    const hRot: Dir = dx > 0 ? 0 : 2, vRot: Dir = dy > 0 ? 1 : 3;
    let x = x0, y = y0;
    if (horizFirst) {
      for (; x !== x1; x += Math.sign(dx)) path.push({ x, y, rot: hRot });
      for (; y !== y1; y += Math.sign(dy)) path.push({ x, y, rot: vRot });
      path.push({ x, y, rot: dy ? vRot : hRot });
    } else {
      for (; y !== y1; y += Math.sign(dy)) path.push({ x, y, rot: vRot });
      for (; x !== x1; x += Math.sign(dx)) path.push({ x, y, rot: hRot });
      path.push({ x, y, rot: dx ? hRot : vRot });
    }
    this.rot = path[path.length - 1].rot;
    return path;
  }

  /** Lay belts by dragging: an L from where the drag started, each tile facing along the path. */
  private beltDrag(t: { x: number; y: number }, overUI: boolean, pt: { x: number; y: number }) {
    const inp = this.input;
    if (inp.mouse.pressed[0] && !overUI && this.game.inb(pt.x, pt.y)) this.drag = { x0: pt.x, y0: pt.y, path: [{ x: pt.x, y: pt.y, rot: this.rot }] };
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
    this.layout = layout(Math.floor(this.canvas.width / this.uiScale), Math.floor(this.canvas.height / this.uiScale));
    const c = this.layout.center, k = this.uiScale;
    this.renderer.resize(this.canvas.width, this.canvas.height, { x: c.x * k, y: c.y * k, w: c.w * k, h: c.h * k });
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
  /** Let a bot play (null stops it). */
  attachBot(policy: Policy | null) { this.bot = policy ? new Bot(this.game, policy) : null; }
  /** Run up to n ticks now with the bot (if any) playing, stopping early when until(game) holds
   *  (checked once a game second). Returns the ticks run. Events wait for the next frame. */
  botTicks(n: number, until?: (g: Game) => boolean): number {
    let i = 0;
    for (; i < n; i++) {
      this.bot?.update();
      this.game.tick();
      if (i % TICK_RATE === 0 && until && until(this.game)) { i++; break; }
    }
    return i;
  }
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
