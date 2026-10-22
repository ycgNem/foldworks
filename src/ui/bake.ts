// Baked bitmaps for things drawn the same way frame after frame (Milestone 14, DESIGN.md
// "Performance (measured)"): a 9-slice tiled to its size, a string in one face and colour, a status
// pip. Drawn the old way they cost one canvas call per tile, glyph or pixel (6,300 calls a frame on
// a dense Workshop, most of the 14 ms the frame took); baked, each is one drawImage.
//
// A key is baked the second time it is asked for (a size seen once, such as a card sliding open, is
// drawn directly and never fills the cache), and the cache keeps the most recently used bakes
// within a pixel budget. Nothing here changes a pixel: a bake is painted by the same code at the
// same size and drawn at the same place, and the canvas draws it with smoothing off.

type Ctx = CanvasRenderingContext2D;

export class BakeCache {
  private readonly baked = new Map<string, HTMLCanvasElement>();
  private readonly seen = new Set<string>();
  private px = 0;
  /** bakes made and drawn (for npm run perf) */
  made = 0;
  hits = 0;

  constructor(private readonly maxPx: number, private readonly maxSeen = 4096) {}

  /** The bake for `key` (painting it now at w x h if this is its second asking), or null when the
   *  caller should draw directly this time (the first asking, no document, or too big to keep). */
  get(key: string, w: number, h: number, paint: (ctx: Ctx) => void): HTMLCanvasElement | null {
    const hit = this.baked.get(key);
    if (hit) {
      // most recently used last (the Map keeps insertion order)
      this.baked.delete(key);
      this.baked.set(key, hit);
      this.hits++;
      return hit;
    }
    if (!this.seen.has(key)) {
      if (this.seen.size >= this.maxSeen) this.seen.clear();
      this.seen.add(key);
      return null;
    }
    const area = w * h;
    if (w < 1 || h < 1 || area > this.maxPx / 4 || typeof document === 'undefined') return null;
    this.seen.delete(key);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    paint(ctx);
    this.baked.set(key, c);
    this.px += area;
    this.made++;
    for (const [k, v] of this.baked) {
      if (this.px <= this.maxPx) break;
      this.baked.delete(k);
      this.px -= v.width * v.height;
    }
    return c;
  }

  clear() {
    this.baked.clear();
    this.seen.clear();
    this.px = 0;
  }

  get size() { return this.baked.size; }
}

/** A stable number for an image object (a sheet's frame), for cache keys. */
const ids = new WeakMap<object, number>();
let nextId = 1;
export function imageId(o: object): number {
  let id = ids.get(o);
  if (!id) ids.set(o, (id = nextId++));
  return id;
}
