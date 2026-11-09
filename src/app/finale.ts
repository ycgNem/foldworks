// The core ending (DESIGN.md §21 The core ending, the playability pass): the Floating City complete
// is the story's end a normal player reaches (about 18-25 h). Once, the first time the City's last
// stage stands in this universe (a transition seen in this session, as Unit 7's ending watches its
// page), the screen goes to the key art and the City lifts off the island, the camera following it
// into the high sky; Bramble and the customers react and the Swamp Gazette prints a special; the
// credits roll the player's own numbers; then an invitation to the World floor (Acts IV and V, the
// post-game, still to play). Skip moves a scene on. The Codex's ending pages keep a key to see it
// again ("The City, again"). Presentation only: reads the Game, never writes it.
import { C, rgba } from '../data/palette';
import { MEGAS } from '../data/megaprojects';
import { GRADES } from '../data/rules';
import { megaComplete } from '../sim/systems/research';
import { Num } from '../engine/num';
import { bigWidth, textWidth, wrapText, LINE_H } from '../ui/font';
import { drawRich } from '../ui/rich';
import { sheet, hasArt, frameAt } from '../render/sprites';
import { button, portrait, bubble, ribbon, stamp, slip, T } from './chrome';
import { finaleState, openFinale } from './finalestate';
import cityMeta from '../art/finale_city.json';
import type { Game } from '../sim/Game';
import type { App } from './app';

export { openFinale };

const st = finaleState;
const watch = { game: null as Game | null, done: false, at: -1 };

/** Once a frame: the City completing in this game (not a save loaded with it complete) queues the
 * finale, which opens 3 s later (the stage's ribbon first) once nothing else is open. Only in the
 * first universe: a Last Fold's new universe builds the City again without the story ending again. */
export function finaleWatch(app: App) {
  if (app.screen !== 'play') return;
  const g = app.game;
  const done = megaComplete(g, 'city');
  if (watch.game !== g) { watch.game = g; watch.done = done; watch.at = -1; return; }
  if (done && !watch.done && !g.s.scenario && !(g.s.meta.lastFolds ?? 0)) watch.at = app.ui.time + 3;
  watch.done = done;
  if (watch.at >= 0 && app.ui.time >= watch.at && !app.panel && !app.offlineJob) {
    watch.at = -1;
    openFinale(app);
  }
}

// ------------------------------------------------------------------ the numbers

const fmtN = (n: number | Num) => (typeof n === 'number' ? Num.of(Math.floor(n)) : n).format();

/** The player's own numbers for the credits. */
export function finaleNumbers(g: Game): { label: string; value: string }[] {
  const s = g.s;
  const m = s.meta;
  const secs = g.seconds;
  const h = Math.floor(secs / 3600), mi = Math.floor((secs % 3600) / 60);
  const rank = (l?: string | null) => (l ? GRADES.findIndex((q) => q.letter === l) : 99);
  let best: string | null = null;
  const see = (l?: string | null) => { if (l && rank(l) >= 0 && rank(l) < rank(best)) best = l; };
  for (const d of s.designs) see(d.grade?.letter);
  for (const f of Object.values(m.patented)) see(f?.grade);
  for (const k of m.drawer) see(k.grade);
  let items = 0;
  for (const v of Object.values(m.lifetime.delivered)) items += v?.toNumber() ?? 0;
  for (const v of Object.values(s.delivered)) items += v?.toNumber() ?? 0;
  const coin = m.lifetime.earned.add(s.earned);
  const city = s.district?.ents.filter((e) => e.kind === 'module').length ?? 0;
  const trophies = s.flags.filter((f) => f.startsWith('trophy:')).length;
  return [
    { label: 'hours played', value: `${h} h ${String(mi).padStart(2, '0')} min` },
    { label: 'folds made', value: fmtN(m.lifetime.folds + s.designs.length) },
    { label: 'the best grade', value: best ?? '-' },
    { label: 'items delivered', value: fmtN(items) },
    { label: 'coin earned', value: fmtN(coin) },
    { label: 'modules flying the City', value: fmtN(city) },
    { label: 'Reorganizes', value: fmtN(m.runs) },
    { label: 'trophies', value: fmtN(trophies) },
  ];
}

// ------------------------------------------------------------------ the timeline

/** Scene starts (seconds): the lift-off, the town's reaction, the credits; the invitation follows
 * the roll. */
const LIFT = 0, NEWS = 9.5, ROLL = 22;
const ROLL_SPEED = 16;

const ease = (u: number) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

/** puffs from the rotors, in scene coordinates (they stay in the sky as the City climbs) */
const puffs: { x: number; y: number; t0: number; r: number }[] = [];
let lastPuff = 0;
let skyTop: string | null = null;

/** The key art's colour at its top row (the sky the camera climbs into continues from it). */
function sceneTop(): string {
  if (skyTop) return skyTop;
  const f = sheet('title_scene').frames[0];
  const d = f.getContext('2d')?.getImageData(Math.floor(f.width / 2), 0, 1, 1).data;
  skyTop = d ? `rgb(${d[0]},${d[1]},${d[2]})` : C.pipBlue;
  return skyTop;
}

/** Where the City stands in the scene (its sprite's top-left) and the camera's climb, at time t. */
function cityAt(t: number): { x: number; y: number; cam: number } {
  // docked on the town's island (x 228, its platform on the grass), then up and over the sky gap
  const lift = 210 * ease((t - 1.4) / 9);
  const x = 228 - 102 * ease((t - 2.5) / 8);
  const rise = Math.min(lift, 22);
  return { x, y: 26 - rise + Math.sin(t * 1.3) * (t > 3 ? 1.5 : 0), cam: lift - rise };
}

/** The sky, the key art, the City and its puffs: the backdrop every scene shares. */
function sky(app: App, t: number) {
  const ui = app.ui, ctx = ui.ctx;
  const W = ui.w, H = ui.h;
  const sc = sheet('title_scene');
  const SW = sc.w, SH = sc.h;
  const k = Math.max(1, Math.ceil(Math.max(W / SW, H / SH)));
  const ox = Math.floor((W - SW * k) / 2), oy = Math.floor((H - SH * k) / 2);
  const c = cityAt(t);
  const camPx = Math.round(c.cam) * k;
  // the high sky above the key art, darkening as the camera climbs (stars come out)
  const top = sceneTop();
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);
  const high = clamp01(c.cam / 180);
  // (darker the higher above the key art's top edge, so the seam carries no step)
  const seam = oy + camPx;
  const bands = 16;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor((seam * i) / bands), y1 = Math.floor((seam * (i + 1)) / bands);
    ctx.fillStyle = rgba(C.ink, 0.8 * high * (1 - i / bands));
    ctx.fillRect(0, y0, W, y1 - y0);
  }
  for (let i = 0; i < 90; i++) {
    const sx = Math.floor(((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1 * W);
    const sy = Math.floor(((Math.sin(i * 17.3 + 4) * 12543.1) % 1 + 1) % 1 * (oy + camPx));
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(ui.time * (0.6 + (i % 7) * 0.2) + i));
    ctx.fillStyle = rgba(i % 9 === 0 ? C.lamp3 : C.bone, tw * high * (i % 3 === 0 ? 0.9 : 0.5));
    ctx.fillRect(sx, sy, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
  }
  // the key art, dropping away below
  if (oy + camPx < H) ctx.drawImage(sc.frames[frameAt(sc, ui.time)], ox, oy + camPx, SW * k, SH * k);
  // clouds drifting past the climb
  if (hasArt('sky_cloud')) {
    const cl = sheet('sky_cloud');
    // (each at its own height above the key art, passing at its own parallax)
    for (let i = 0; i < 6; i++) {
      const yy = oy + Math.round(-30 - i * 42 + c.cam * (1 + (i % 3) * 0.2)) * k;
      const cx = ((i * 97 + ui.time * (4 + i * 2)) % (SW + 64)) - 64;
      if (yy > -cl.h * k && yy < H) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(cl.frames[i % cl.frames.length], ox + Math.round(cx) * k, yy, cl.w * k, cl.h * k);
        ctx.globalAlpha = 1;
      }
    }
  }
  // the City
  const cs = hasArt('finale_city') ? sheet('finale_city') : null;
  const cx = ox + Math.round(c.x) * k, cy = oy + Math.round(c.y) * k;
  // puffs from the rotors while it climbs (scene coordinates, so they fall behind)
  const tips = (cityMeta as { rotors?: number[][] }).rotors ?? [];
  if (t > 1 && t - lastPuff > 0.12 && t < NEWS + 30) {
    lastPuff = t;
    const tip = tips[Math.floor(t * 7) % Math.max(1, tips.length)];
    // (the City's place in the world is its place on screen less the camera's climb)
    if (tip) puffs.push({ x: c.x + tip[0] + Math.sin(t * 9) * 2, y: c.y - c.cam + tip[1] + 2, t0: t, r: 1 + (Math.floor(t * 13) % 3) });
  }
  if (puffs.length > 80) puffs.splice(0, puffs.length - 80);
  for (const p of puffs) {
    const age = t - p.t0;
    if (age < 0 || age > 3) continue;
    const r = Math.round(p.r + age * 2);
    // a round puff: a cross of two rects, whole scene pixels
    const qx = ox + Math.round(p.x - r) * k, qy = oy + Math.round(p.y + age * 6 + c.cam - r) * k, d = r * 2 * k;
    ctx.fillStyle = rgba(C.bone, 0.7 * (1 - age / 3));
    ctx.fillRect(qx + k, qy, d - 2 * k, d);
    ctx.fillRect(qx, qy + k, d, d - 2 * k);
  }
  if (cs) {
    const shake = t < 1.6 ? Math.round(Math.sin(t * 60) * (1.6 - t) * k) : 0;
    ctx.drawImage(cs.frames[0], cx + shake, cy, cs.w * k, cs.h * k);
    // the rotors: a blade on each brass stalk, spinning (wide, narrow)
    const wide = Math.floor(ui.time * 16) % 2 === 0;
    for (const tp of tips) {
      const bw = wide ? 7 : 3;
      ctx.fillStyle = C.ink;
      ctx.fillRect(cx + shake + (tp[0] - Math.floor(bw / 2)) * k, cy + (tp[1] + 1) * k, bw * k, k);
      ctx.fillStyle = rgba(C.bone, 0.7);
      ctx.fillRect(cx + shake + (tp[0] - Math.floor(bw / 2) + 1) * k, cy + (tp[1] + 1) * k, Math.max(1, bw - 2) * k, k);
    }
  }
  return { k, ox, oy };
}

// ------------------------------------------------------------------ the scenes

const REACTIONS: { who: string; name: string; line: string }[] = [
  { who: 'unit7', name: 'Unit 7', line: 'UNIT 7 HAS LOGGED A CITY. IT IS THE LARGEST SPECIMEN. IT IS STILL GOING UP.' },
  { who: 'voltaire', name: 'Dame Voltaire', line: 'At last, a grid with a view. I shall want a pylon on the spire.' },
  { who: 'committee', name: 'The Committee', line: '"it floats." "we knew it would." "we did not know it would."' },
  { who: 'inspector', name: 'The Inspector', line: 'Structurally sound. I checked twice. Then I checked the sky.' },
];

function liftScene(app: App, t: number) {
  const ui = app.ui;
  const W = ui.w, H = ui.h;
  const title = 'The Floating City';
  const sc = bigWidth(title) * 3 + 20 <= W ? 3 : bigWidth(title) * 2 + 20 <= W ? 2 : 1;
  const a = clamp01((t - 3) / 0.6);
  if (a > 0) {
    const y = H - 34 - sc * 12;
    // an ink band behind the words, over the busy islands
    ui.ctx.fillStyle = rgba(C.ink, 0.55 * a);
    ui.ctx.fillRect(0, y - 8, W, sc * 12 + 34);
    ui.ctx.globalAlpha = a;
    ui.big(title, Math.floor(W / 2), y, C.lamp3, { align: 'center', scale: sc, shadow: C.ink });
    ui.ctx.globalAlpha = 1;
    if (t > 4.5) {
      ui.ctx.globalAlpha = clamp01((t - 4.5) / 0.6);
      ui.text('lifts off the island', Math.floor(W / 2), y + sc * 10 + 6, C.bone, { align: 'center', shadow: C.ink });
      ui.ctx.globalAlpha = 1;
    }
  }
}

function newsScene(app: App, t: number) {
  const ui = app.ui;
  const g = app.game;
  const W = ui.w, H = ui.h;
  const u = t - NEWS;
  // the sky dims behind the papers (the City stays, a backdrop)
  ui.ctx.fillStyle = rgba(C.ink, 0.55 * clamp01(u / 0.5));
  ui.ctx.fillRect(0, 0, W, H);
  // the Swamp Gazette's special, dropping in on the left
  const pw = Math.min(250, Math.floor(W * 0.46)), ph = Math.min(H - 70, 190);
  const drop = u < 0.5 ? Math.round((1 - ease(u / 0.5)) * -(ph + 30)) : 0;
  const px = Math.max(8, Math.floor(W / 2) - pw - 10), py = 14 + drop;
  ui.ctx.fillStyle = rgba(C.ink, 0.35);
  ui.ctx.fillRect(px + 3, py + 3, pw, ph);
  ui.fill(px, py, pw, ph, T.paperEdge);
  ui.fill(px + 1, py + 1, pw - 2, ph - 2, T.paperHi);
  let y = py + 6;
  const cx = px + Math.floor(pw / 2);
  ui.big('The Swamp Gazette', cx, y, C.ink, { align: 'center' });
  y += 14;
  ui.fill(px + 6, y, pw - 12, 1, C.ink);
  ui.fill(px + 6, y + 2, pw - 12, 1, C.ink);
  y += 5;
  ui.text('SPECIAL EDITION · ONE SHELL', cx, y, C.pipRed, { align: 'center' });
  y += 12;
  const head = 'TOWN TAKES FLIGHT';
  const hs = bigWidth(head) * 2 <= pw - 12 ? 2 : 1;
  ui.big(head, cx, y, C.ink, { align: 'center', scale: hs });
  y += hs === 2 ? 26 : 14;
  // a woodcut of the City: the sprite at 1x, in a frame
  const cs = hasArt('finale_city') ? sheet('finale_city') : null;
  const textX = cs ? px + 8 + cs.w + 8 : px + 8;
  if (cs && y + cs.h + 4 <= py + ph) {
    ui.fill(px + 6, y - 2, cs.w + 4, cs.h + 4, C.ink);
    ui.fill(px + 7, y - 1, cs.w + 2, cs.h + 2, T.paperLo);
    ui.ctx.drawImage(cs.frames[0], px + 8, y);
  }
  const mods = g.s.district?.ents.filter((e) => e.kind === 'module').length ?? 0;
  const body = [
    `The Floating City left the island at noon with ${mods} modules aboard and the Mayor's hat.`,
    'Witnesses describe the event as "up".',
    'The Gazette moves its office to the spire. Deliveries by skiff.',
  ];
  const bw = px + pw - 8 - textX;
  for (const line of body) {
    for (const wl of wrapText(line, bw)) {
      if (y + LINE_H > py + ph - 4) break;
      ui.text(wl, textX, y, C.ink);
      y += LINE_H;
    }
    y += 3;
  }
  if (u > 0.8) stamp(ui, 'EXTRA!', px + pw - 26, py + ph - 14, { angle: -0.15, alpha: 0.9 });
  // Bramble, cheering, on the right
  const rx = Math.floor(W / 2) + 10, rw = Math.min(250, W - rx - 8);
  if (u > 0.6) {
    const bob = Math.floor(ui.time * 3) % 2;
    portrait(ui, hasArt('portrait_bramble_cheer') ? 'bramble_cheer' : 'bramble', rx, 14 + bob, 48);
    const line = 'Ribbit! The whole town is flying! I will need a bigger lily pad. In the sky!';
    const lw = rw - 58;
    const ls = wrapText(line, lw - 12);
    const b = bubble(ui, rx + 54, 14, lw, ls.length * LINE_H + 12, { side: 'left', at: 14, blocking: false });
    ls.forEach((s, i) => ui.text(s, b.x, b.y + i * LINE_H, C.ink));
    ui.small('MAYOR BRAMBLE', rx + 24, 68, C.lamp3, { align: 'center', shadow: C.ink });
  }
  // the customers, one by one
  let ry = 84;
  REACTIONS.forEach((r, i) => {
    if (u < 2 + i * 1.6 || ry + 28 > H - 26) return;
    portrait(ui, r.who, rx, ry, 24);
    const lw = rw - 30;
    const ls = wrapText(r.line, lw - 12).slice(0, 3);
    const b = bubble(ui, rx + 30, ry, lw, ls.length * LINE_H + 12, { side: 'left', at: 8, blocking: false });
    ls.forEach((s, j) => ui.text(s, b.x, b.y + j * LINE_H, r.who === 'unit7' ? C.teal : C.ink));
    ry += Math.max(28, ls.length * LINE_H + 16);
  });
}

/** The credits' rows: [kind, left, right]. */
function credits(g: Game): [string, string, string][] {
  const rows: [string, string, string][] = [
    ['title', 'FOLDWORKS', ''],
    ['sub', 'the Floating City', ''],
    ['gap', '', ''],
    ['head', 'YOUR FACTORY', ''],
    ...finaleNumbers(g).map((n): [string, string, string] => ['row', n.label, n.value]),
    ['gap', '', ''],
    ['head', 'THE TOWN', ''],
    ['row', 'the Mayor', 'Bramble'],
    ['row', 'the collector', 'Unit 7'],
    ['row', 'the power', 'Dame Voltaire'],
    ['row', 'three raccoons in a coat', 'the Committee'],
    ['row', 'the clipboard', 'the Inspector'],
    ['row', 'townsfrogs, crew, a canteen', 'everyone'],
    ['gap', '', ''],
    ['head', 'THE FOREMAN', ''],
    ['sub', 'you', ''],
    ['gap', '', ''],
    ['sub', 'thank you for playing', ''],
  ];
  return rows;
}
const ROW_H: Record<string, number> = { title: 30, sub: 14, gap: 16, head: 16, row: 12 };

/** How long the roll takes on this screen (seconds). */
function rollTime(app: App): number {
  const h = credits(app.game).reduce((a, r) => a + ROW_H[r[0]], 0);
  return (h + app.ui.h * 0.6) / ROLL_SPEED;
}

function rollScene(app: App, t: number) {
  const ui = app.ui;
  const W = ui.w, H = ui.h;
  const u = t - ROLL;
  ui.ctx.fillStyle = rgba(C.ink, Math.min(0.8, u * 0.8));
  ui.ctx.fillRect(0, 0, W, H);
  const colW = Math.min(300, W - 40);
  const cx = Math.floor(W / 2), x0 = cx - Math.floor(colW / 2);
  let y = Math.round(H - u * ROLL_SPEED);
  for (const [kind, a, b] of credits(app.game)) {
    const rh = ROW_H[kind];
    if (y > -rh && y < H) {
      if (kind === 'title') ui.big(a, cx, y, C.lamp3, { align: 'center', scale: 2, shadow: C.ink });
      else if (kind === 'sub') ui.text(a, cx, y, C.bone, { align: 'center', shadow: C.ink });
      else if (kind === 'head') ui.small(a, cx, y + 2, C.teal, { align: 'center' });
      else if (kind === 'row') {
        ui.text(a, x0, y, rgba(C.bone, 0.75));
        ui.text(b, x0 + colW, y, C.lamp3, { align: 'right' });
        const dots = x0 + textWidth(a) + 4, dote = x0 + colW - textWidth(b) - 4;
        for (let dx = dots; dx < dote; dx += 4) ui.fill(dx, y + 6, 1, 1, rgba(C.bone, 0.3));
      }
    }
    y += rh;
  }
}

function inviteScene(app: App, t: number, at: number) {
  const ui = app.ui;
  const g = app.game;
  const W = ui.w, H = ui.h;
  const u = t - at;
  ui.ctx.fillStyle = rgba(C.ink, 0.8 - 0.35 * clamp01(u / 0.8));
  ui.ctx.fillRect(0, 0, W, H);
  const cw = Math.min(330, W - 24), ch = 146;
  const x = Math.floor((W - cw) / 2), y = Math.max(8, H - ch - Math.max(24, Math.floor(H * 0.08)));
  const r = slip(ui, x, y, cw, ch, { blocking: true });
  ribbon(ui, x - 6, y - 10, cw + 12, "The story isn't over", { color: 'gold', icon: 'world' });
  let ty = r.y + 14;
  const lines = [
    '{u:world} {big:the World floor}',
    g.done('charting') ? '{good:Charting is done} · fly a barge route' : '{u:research} {soft:research} Charting {soft:to open it}',
    '{soft:islands to fly the town to, with rules of their own}',
    '{u:relocate} Relocate · {u:mega} the Lighthouse and the Sky Anchor · {u:lastFold} the Last Fold',
    // the post-game opens here (the playability pass): Challenges and the Scenario boards
    '{u:star} {good:Challenges} and {u:trophies} {good:Scenarios} are open · {u:options} Options',
  ];
  for (const s of lines) { ty += drawRich(ui, s, r.x + 4, ty, r.w - 8, C.ink) + 4; }
  const by = y + ch - 24, bw = Math.floor((cw - 30) / 2);
  if (button(ui, 'finaleOnward', x + cw - 10 - bw, by, bw, 17, 'Keep building', { gold: true, icon: 'play', tip: [{ text: '{big:Keep building}' }, { text: 'the City flies on · the World is next' }] })) { app.panel = null; app.audio.sfx('close'); }
  if (button(ui, 'finaleResearch', x + 10, by, bw, 17, 'To the research', { icon: 'research', tip: '{u:research} the research page · Charting' })) { app.panel = 'research'; app.audio.sfx('open'); }
}

/** The finale, full screen (drawn from screens.ts's switch). */
export function finalePage(app: App) {
  const ui = app.ui;
  const W = ui.w, H = ui.h;
  // Skip moves the clock to the next scene
  if (st.jump > ui.time - st.at) st.at = ui.time - st.jump;
  const t = ui.time - st.at;
  ui.region(0, 0, W, H, 'panel', true);
  if (t < 0.05) { puffs.length = 0; lastPuff = 0; }
  sky(app, t);
  const roll = rollTime(app);
  const inviteAt = ROLL + roll;
  if (t < NEWS) liftScene(app, t);
  else if (t < ROLL) newsScene(app, t);
  else if (t < inviteAt) rollScene(app, t);
  else inviteScene(app, t, inviteAt);
  if (!st.rolled && t >= ROLL) { st.rolled = true; app.audio.sfx('milestone', 0.5); }
  if (t < inviteAt) {
    const next = t < NEWS ? NEWS : t < ROLL ? ROLL : inviteAt;
    if (button(ui, 'finaleSkip', W - 66, H - 22, 58, 16, 'Skip', { tip: 'the next scene' })) { st.jump = next; app.audio.sfx('click'); }
  }
  void MEGAS;
}
