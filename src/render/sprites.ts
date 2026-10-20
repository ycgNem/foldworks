// Sprites: the art director's PNG strips from src/art/ (<name>.png + <name>.json, see
// .claude/agents/art-director.md) when they exist, otherwise a code-drawn placeholder in the
// palette. Frames are cut once into their own small canvases; every draw is on whole pixels.
// Machines face right; drawRot turns them in 90 degree steps about the tile's centre.
// (The loading pattern is Trotline's; every placeholder is Foldworks'.)
import { C } from '../data/palette';
import { ITEM_IDS, type ItemId } from '../data/items';

export interface SpriteSheet {
  frames: HTMLCanvasElement[];
  w: number;
  h: number;
  /** the pixel inside a frame that sits on the entity's position */
  ax: number;
  ay: number;
  fps: number;
  /** drawn by code, not imported */
  placeholder: boolean;
  /** 9-slice insets [left, top, right, bottom] for UI frames */
  slice?: [number, number, number, number];
}

interface Meta { frame: [number, number]; frames: number; anchor: [number, number]; fps?: number; slice?: [number, number, number, number] }

const PNG = import.meta.glob('../art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const JSON_META = import.meta.glob('../art/*.json', { eager: true, import: 'default' }) as Record<string, Meta>;

const sheets = new Map<string, SpriteSheet>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Load every imported sheet; resolves when all have loaded (or failed and kept their placeholder). */
export function loadArt(): Promise<void> {
  const loading: Promise<void>[] = [];
  for (const [path, url] of Object.entries(PNG)) {
    const name = path.replace(/^.*\//, '').replace(/\.png$/, '');
    const meta = JSON_META[path.replace(/\.png$/, '.json')];
    if (!meta) continue;
    loading.push(new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => {
        const [w, h] = meta.frame;
        const frames: HTMLCanvasElement[] = [];
        const perRow = Math.max(1, Math.floor(img.width / w));
        for (let i = 0; i < meta.frames; i++) {
          const c = canvas(w, h);
          c.getContext('2d')!.drawImage(img, (i % perRow) * w, Math.floor(i / perRow) * h, w, h, 0, 0, w, h);
          frames.push(c);
        }
        sheets.set(name, { frames, w, h, ax: meta.anchor[0], ay: meta.anchor[1], fps: meta.fps ?? 4, placeholder: false, slice: meta.slice });
        res();
      };
      img.onerror = () => { console.error('sprite failed to load', url); res(); };
      img.src = url;
    }));
  }
  return Promise.all(loading).then(() => { itemCells = null; });
}

/** The sheet for a name: imported art if loaded, else its placeholder. */
export function sheet(name: string): SpriteSheet {
  let s = sheets.get(name);
  if (s) return s;
  s = placeholder(name);
  sheets.set(name, s);
  return s;
}

export function hasArt(name: string) {
  const s = sheets.get(name);
  return !!s && !s.placeholder;
}

/** The sprite sheet name for a building kind: art files are snake_case (steamEngine ->
 *  steam_engine, smelterMk2 -> smelter_mk2). */
export function spriteName(kind: string): string {
  return kind.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Draw frame `f` (wrapped) with its anchor at world pixel (x, y). */
export function drawSprite(ctx: CanvasRenderingContext2D, s: SpriteSheet, f: number, x: number, y: number, flip = false) {
  const img = s.frames[((f % s.frames.length) + s.frames.length) % s.frames.length];
  const px = Math.round(x), py = Math.round(y);
  if (!flip) {
    ctx.drawImage(img, px - s.ax, py - s.ay);
    return;
  }
  ctx.save();
  ctx.translate(px, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, -(s.w - s.ax), py - s.ay);
  ctx.restore();
}

/** Draw a 16x16 tile sprite at tile pixel (x, y) turned `rot` quarter turns clockwise (0 = facing right). */
export function drawRot(ctx: CanvasRenderingContext2D, s: SpriteSheet, f: number, x: number, y: number, rot: number, flipY = false) {
  const img = s.frames[((f % s.frames.length) + s.frames.length) % s.frames.length];
  if (!rot && !flipY) {
    ctx.drawImage(img, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + s.w / 2, y + s.h / 2);
  ctx.rotate((rot * Math.PI) / 2);
  if (flipY) ctx.scale(1, -1);
  ctx.drawImage(img, -s.w / 2, -s.h / 2);
  ctx.restore();
}

/** The frame to show at time t (seconds) for an animated sheet. */
export function frameAt(s: SpriteSheet, t: number) {
  return Math.floor(t * s.fps) % s.frames.length;
}

// ---------------------------------------------------------------- item icons (8x8)

let itemCells: Map<string, HTMLCanvasElement> | null = null;

/** The 8x8 icon for an item: from src/art/items.png (the slice's items, ITEM_IDS order) and
 *  src/art/items2.png (Act II's, continuing the same order), or code. */
export function itemIcon(id: string): HTMLCanvasElement {
  if (!itemCells) {
    itemCells = new Map();
    const art = sheets.get('items');
    const art2 = sheets.get('items2');
    const n1 = art && !art.placeholder ? art.frames.length : 10;
    ITEM_IDS.forEach((it, i) => {
      if (i < n1 && art && !art.placeholder && art.frames[i]) itemCells!.set(it, art.frames[i]);
      else if (i >= n1 && art2 && !art2.placeholder && art2.frames[i - n1]) itemCells!.set(it, art2.frames[i - n1]);
      else itemCells!.set(it, drawItem(it));
    });
  }
  return itemCells.get(id) ?? itemCells.get('slag')!;
}

function drawItem(id: ItemId): HTMLCanvasElement {
  const c = canvas(8, 8);
  const x = c.getContext('2d')!;
  const R = (col: string, a: number, b: number, w: number, h: number) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  switch (id) {
    case 'ironOre':
    case 'copperOre': {
      const [d, m, l] = id === 'ironOre' ? [C.blue, C.sky, C.ice] : [C.clay, C.copper, C.tan];
      // a lumpy rock
      R(C.ink, 1, 2, 6, 5); R(C.ink, 2, 1, 4, 7);
      R(d, 2, 2, 4, 5); R(d, 1, 3, 6, 3);
      R(m, 2, 2, 3, 3); R(l, 3, 2, 1, 1); R(l, 2, 3, 1, 1);
      R(id === 'ironOre' ? C.rust : C.lime, 5, 5, 1, 1);
      break;
    }
    case 'ironIngot':
    case 'copperIngot': {
      const [d, m, l] = id === 'ironIngot' ? [C.blue, C.sky, C.ice] : [C.clay, C.copper, C.cream];
      // a trapezoid bar
      R(C.ink, 0, 3, 8, 4); R(C.ink, 1, 2, 6, 1);
      R(d, 1, 4, 6, 2); R(m, 2, 3, 4, 1); R(l, 2, 3, 3, 1); R(m, 1, 4, 6, 1);
      break;
    }
    case 'slag':
      R(C.ink, 1, 2, 6, 5); R(C.ink, 2, 1, 3, 1);
      R(C.plum, 2, 2, 4, 4); R(C.violet, 2, 2, 2, 1); R(C.violet, 5, 4, 1, 1); R(C.night, 3, 4, 1, 1);
      break;
    case 'ironPlate':
      // a flat square with a sheen
      R(C.ink, 1, 1, 6, 6); R(C.sky, 2, 2, 4, 4); R(C.ice, 2, 2, 3, 1); R(C.ice, 2, 3, 1, 2); R(C.blue, 5, 5, 1, 1);
      break;
    case 'copperWire':
      // a coil: two rings
      R(C.ink, 1, 1, 6, 6); R(C.amber, 2, 2, 4, 4); R(C.ink, 3, 3, 2, 2); R(C.gold, 2, 2, 2, 1); R(C.copper, 4, 5, 2, 1);
      R(C.amber, 6, 3, 1, 1);
      break;
    case 'gear':
      // teeth on four sides and a hole
      R(C.ink, 2, 0, 4, 8); R(C.ink, 0, 2, 8, 4); R(C.ink, 1, 1, 6, 6);
      R(C.mist, 3, 1, 2, 6); R(C.mist, 1, 3, 6, 2); R(C.mist, 2, 2, 4, 4); R(C.bone, 2, 2, 2, 1);
      R(C.ink, 3, 3, 2, 2);
      break;
    default: {
      // Act II items without art: a dot in the item's colour family
      R(C.ink, 1, 1, 6, 6); R(C.fog, 2, 2, 4, 4); R(C.bone, 2, 2, 2, 1);
      break;
    }
    case 'slagBrick':
      R(C.ink, 0, 2, 8, 5); R(C.plum, 1, 3, 6, 3); R(C.violet, 1, 3, 6, 1); R(C.ink, 4, 3, 1, 3);
      break;
    case 'gizmo':
      // a little box with an antenna and a dial
      R(C.ink, 1, 2, 6, 6); R(C.ink, 3, 0, 1, 3);
      R(C.gold, 2, 3, 4, 4); R(C.amber, 2, 6, 4, 1); R(C.rust, 3, 1, 1, 1); R(C.ink, 3, 4, 2, 2); R(C.pipGreen, 3, 4, 1, 1);
      break;
  }
  return c;
}

// ---------------------------------------------------------------- placeholders
// Readable shapes in the palette, facing right, so the floor reads before the real art lands.

type Draw = (x: CanvasRenderingContext2D, f: number) => void;

function make(w: number, h: number, ax: number, ay: number, n: number, fps: number, draw: Draw): SpriteSheet {
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < n; f++) {
    const c = canvas(w, h);
    draw(c.getContext('2d')!, f);
    frames.push(c);
  }
  return { frames, w, h, ax, ay, fps, placeholder: true };
}

function r(x: CanvasRenderingContext2D, c: string, a: number, b: number, w: number, h: number) {
  x.fillStyle = c;
  x.fillRect(a, b, w, h);
}

/** a bevelled machine body inside the tile (leaves the top-right 4x4 for the pip) */
function body(x: CanvasRenderingContext2D, base: string, light: string, dark: string) {
  r(x, C.ink, 1, 2, 14, 13);
  r(x, base, 2, 3, 12, 11);
  r(x, light, 2, 3, 12, 1);
  r(x, light, 2, 3, 1, 11);
  r(x, dark, 2, 13, 12, 1);
  r(x, dark, 13, 3, 1, 11);
}

/** the output chute on the right edge (the front) */
function chute(x: CanvasRenderingContext2D) {
  r(x, C.ink, 13, 6, 3, 5);
  r(x, C.steel, 14, 7, 2, 3);
  r(x, C.fog, 14, 7, 2, 1);
}

function placeholder(name: string): SpriteSheet {
  switch (name) {
    case 'belt':
      // treads running right; 4 frames shift the rungs 1 px... and the rails stay put
      return make(16, 16, 0, 0, 4, 8, (x, f) => {
        r(x, C.ink, 0, 2, 16, 12);
        r(x, C.slate, 0, 3, 16, 10);
        for (let i = -4; i < 16; i += 4) r(x, C.iron, i + f, 4, 2, 8);
        r(x, C.steel, 0, 3, 16, 1);
        r(x, C.night, 0, 12, 16, 1);
        r(x, C.fog, 0, 2, 16, 1);
        r(x, C.night, 0, 13, 16, 1);
      });
    case 'belt_turn':
      // entering from the left side (north when facing east) and leaving right
      return make(16, 16, 0, 0, 4, 8, (x, f) => {
        r(x, C.ink, 2, 0, 12, 14);
        r(x, C.ink, 2, 2, 14, 12);
        r(x, C.slate, 3, 0, 10, 13);
        r(x, C.slate, 3, 3, 13, 10);
        for (let i = 0; i < 3; i++) {
          const k = (i * 4 + f) % 12;
          if (k < 6) r(x, C.iron, 4, k, 8, 2);
          else r(x, C.iron, 4 + (k - 6) * 2, 5, 2, 7);
        }
        r(x, C.steel, 3, 0, 1, 13);
        r(x, C.night, 12, 12, 4, 1);
      });
    case 'miner':
      return make(16, 16, 0, 0, 4, 8, (x, f) => {
        body(x, C.rust, C.orange, C.umber);
        // a drill bit pointing down into the ore, bobbing
        const o = f % 2;
        r(x, C.ink, 5, 4 + o, 6, 6);
        r(x, C.mist, 6, 5 + o, 4, 4);
        r(x, C.bone, 6, 5 + o, 1, 4);
        r(x, C.steel, 7 + (f >> 1), 6 + o, 1, 3);
        chute(x);
      });
    case 'smelter':
    case 'furnace':
      return make(16, 16, 0, 0, 4, 6, (x, f) => {
        const hand = name === 'furnace';
        body(x, hand ? C.umber : C.iron, hand ? C.clay : C.steel, C.night);
        // the glowing mouth, flickering
        const glow = [C.orange, C.amber, C.gold, C.amber][f];
        r(x, C.ink, 4, 6, 7, 6);
        r(x, C.rust, 5, 7, 5, 4);
        r(x, glow, 5, 8, 5, 3);
        r(x, C.gold, 6 + (f % 2), 9, 2, 1);
        // chimney
        r(x, C.ink, 4, 0, 4, 4);
        r(x, C.steel, 5, 1, 2, 3);
        if (hand) { r(x, C.tan, 10, 4, 2, 2); r(x, C.ink, 11, 3 + (f % 2), 3, 1); }
        chute(x);
      });
    case 'press':
      return make(16, 16, 0, 0, 4, 8, (x, f) => {
        body(x, C.blue, C.sky, C.deep);
        // the ram stamps down
        const y = [4, 6, 8, 6][f];
        r(x, C.ink, 4, 3, 8, 2);
        r(x, C.ink, 7, 3, 2, y);
        r(x, C.ink, 4, y + 2, 8, 3);
        r(x, C.ice, 5, y + 3, 6, 1);
        r(x, C.slate, 4, 11, 8, 2);
        chute(x);
      });
    case 'assembler':
      return make(16, 16, 0, 0, 4, 8, (x, f) => {
        body(x, C.moss, C.lime, C.night);
        // two arms swinging toward the middle
        const a = [0, 1, 2, 1][f];
        r(x, C.ink, 3, 6, 10, 6);
        r(x, C.leaf, 4, 7, 8, 4);
        r(x, C.gold, 4 + a, 5, 2, 3);
        r(x, C.gold, 10 - a, 5, 2, 3);
        r(x, C.bone, 7, 8, 2, 2);
        chute(x);
      });
    case 'heap':
      return make(16, 16, 0, 0, 1, 1, (x) => {
        r(x, C.ink, 1, 6, 14, 9);
        r(x, C.umber, 2, 7, 12, 7);
        r(x, C.bark, 2, 12, 12, 2);
      });
    case 'crate':
      return make(16, 16, 0, 0, 1, 1, (x) => {
        r(x, C.ink, 1, 2, 14, 13);
        r(x, C.clay, 2, 3, 12, 11);
        r(x, C.copper, 2, 3, 12, 2);
        r(x, C.umber, 2, 8, 12, 1);
        r(x, C.umber, 7, 3, 2, 11);
        chute(x);
      });
    case 'splitter':
    case 'merger':
      return make(16, 16, 0, 0, 1, 1, (x) => {
        r(x, C.ink, 2, 2, 12, 12);
        r(x, C.slate, 3, 3, 10, 10);
        r(x, C.amber, 7, 7, 2, 2);
        if (name === 'splitter') { r(x, C.amber, 9, 7, 4, 2); r(x, C.amber, 7, 3, 2, 4); r(x, C.amber, 7, 9, 2, 4); r(x, C.steel, 3, 7, 4, 2); }
        else { r(x, C.amber, 9, 7, 4, 2); r(x, C.steel, 7, 3, 2, 4); r(x, C.steel, 7, 9, 2, 4); r(x, C.steel, 3, 7, 4, 2); }
      });
    case 'dock':
      return make(32, 32, 0, 0, 2, 2, (x, f) => {
        // planks over swamp water, a crane and a lily-pad green flag
        r(x, C.ink, 0, 0, 32, 32);
        r(x, C.deep, 1, 1, 30, 30);
        r(x, C.umber, 2, 4, 28, 26);
        for (let j = 4; j < 30; j += 4) { r(x, C.clay, 2, j, 28, 3); r(x, C.bark, 2, j + 3, 28, 1); }
        r(x, C.bark, 4, 4, 2, 26); r(x, C.bark, 26, 4, 2, 26);
        r(x, C.ink, 10, 10, 12, 12); r(x, C.copper, 11, 11, 10, 10); r(x, C.tan, 11, 11, 10, 2); r(x, C.umber, 15, 11, 2, 10);
        r(x, C.ink, 27, 0, 2, 12);
        r(x, f ? C.lime : C.leaf, 22, 1 + f, 5, 4);
        r(x, C.lime, 22, 1 + f, 5, 1);
      });
    case 'hopper':
      return make(32, 32, 0, 0, 2, 3, (x, f) => {
        // a funnel over a research desk
        r(x, C.ink, 0, 0, 32, 32);
        r(x, C.night, 1, 1, 30, 30);
        r(x, C.ink, 3, 3, 26, 14);
        r(x, C.sky, 4, 4, 24, 4);
        r(x, C.blue, 6, 8, 20, 4);
        r(x, C.deep, 10, 12, 12, 4);
        r(x, C.ice, 4, 4, 24, 1);
        r(x, C.slate, 4, 18, 24, 11);
        r(x, C.ink, 8, 20, 16, 7);
        r(x, f ? C.lime : C.pipGreen, 9, 21, 14, 5);
        r(x, C.ink, 10 + f * 6, 22, 2, 3);
      });
    case 'module':
      return make(16, 16, 0, 0, 1, 1, (x) => {
        r(x, C.ink, 0, 0, 16, 16);
        r(x, C.gold, 1, 1, 14, 14);
        r(x, C.amber, 2, 2, 12, 12);
        r(x, C.night, 3, 3, 10, 10);
        r(x, C.cream, 1, 1, 14, 1);
        r(x, C.rust, 1, 14, 14, 1);
        for (const [a, b] of [[1, 1], [14, 1], [1, 14], [14, 14]]) r(x, C.bone, a, b, 1, 1);
        // the fold seam
        r(x, C.amber, 3, 8, 10, 1);
      });
    case 'spark_vein':
      return make(16, 16, 0, 0, 4, 8, (x, f) => {
        const pts = [[3, 4], [11, 3], [7, 9], [12, 11], [4, 12]];
        pts.forEach(([a, b], i) => {
          const on = (i + f) % 4;
          if (on === 0) { r(x, C.bone, a, b - 1, 1, 3); r(x, C.bone, a - 1, b, 3, 1); }
          else if (on === 1) r(x, C.gold, a, b, 1, 1);
        });
      });
    case 'spark_inspector':
      return make(16, 16, 0, 0, 2, 2, (x, f) => {
        // a little figure with a clipboard and a hat
        r(x, C.ink, 5, 1, 6, 3); r(x, C.night, 6, 1, 4, 2); r(x, C.ink, 4, 3, 8, 1);
        r(x, C.ink, 5, 4, 6, 5); r(x, C.tan, 6, 4, 4, 4); r(x, C.ink, 7, 5, 1, 1); r(x, C.ink, 9, 5, 1, 1);
        r(x, C.ink, 4, 8, 8, 6); r(x, C.blue, 5, 9, 6, 4);
        r(x, C.ink, 9 + f, 8, 5, 5); r(x, C.cream, 10 + f, 9, 3, 3); r(x, C.ink, 10 + f, 10, 3, 1);
        r(x, C.ink, 5, 14, 2, 2); r(x, C.ink, 9, 14, 2, 2);
      });
  }
  return make(16, 16, 0, 0, 1, 1, (x) => { r(x, C.pipRed, 2, 2, 12, 12); r(x, C.ink, 2, 2, 6, 6); r(x, C.ink, 8, 8, 6, 6); });
}

/** Names the game draws (the art director's export list). */
export const SPRITE_NAMES = ['belt', 'belt_turn', 'miner', 'smelter', 'furnace', 'press', 'assembler', 'heap', 'crate', 'splitter', 'merger', 'dock', 'hopper', 'module', 'spark_vein', 'spark_inspector', 'items'];
