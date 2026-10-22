// Status pips with a shape as well as a colour (Milestone 13, colourblind-safe; DESIGN.md §17):
// working a round dot, starved a funnel pointing down, blocked a square (it blinks), paused two
// bars, no power a bolt, idle a ring. Each shape is 5x5 pixels of the pip colour inside a 1 px ink
// outline that follows it, so it reads on any machine art at 1x and the shapes differ by their
// outline as much as by their colour (a red-green reader tells working from blocked by the
// corners, the blink and the motion of the machine). Shared by the Workshop renderer, the Factory
// and District floors, the Chute Mouths, the hover reports' status chips and the legend.
import { C, rgba } from '../data/palette';

export type PipShape = 'work' | 'starved' | 'blocked' | 'paused' | 'power' | 'idle';

/** each shape's 5x5 pixels, top row first ('#' the pip colour) */
const SHAPES: Record<PipShape, string[]> = {
  work: ['.###.', '#####', '#####', '#####', '.###.'],
  starved: ['#####', '#####', '.###.', '.###.', '..#..'],
  blocked: ['#####', '#####', '#####', '#####', '#####'],
  paused: ['##.##', '##.##', '##.##', '##.##', '##.##'],
  power: ['...##', '..##.', '.####', '..##.', '.##..'],
  idle: ['.###.', '#...#', '#...#', '#...#', '.###.'],
};

/** The pixels of each shape, as [x, y] pairs (worked out once). */
const PTS: Record<PipShape, [number, number][]> = Object.fromEntries(
  (Object.keys(SHAPES) as PipShape[]).map((k) => [k, SHAPES[k].flatMap((row, y) => [...row].flatMap((c, x) => (c === '#' ? [[x, y] as [number, number]] : [])))]),
) as Record<PipShape, [number, number][]>;

/** What each shape means, in the order the legend lists them. */
export const PIP_MEANING: [PipShape, string, string][] = [
  ['work', 'working', C.pipGreen],
  ['starved', 'starved', C.pipYellow],
  ['blocked', 'blocked', C.pipRed],
  ['power', 'no power', C.pipBlue],
  ['paused', 'stopped', C.hull2],
  ['idle', 'idle', C.hull2],
];

/** The shape a pip colour stands for, for callers that only know the colour. */
export function shapeOf(col: string): PipShape {
  switch (col) {
    case C.pipGreen: return 'work';
    case C.pipYellow: return 'starved';
    case C.pipRed: return 'blocked';
    case C.pipBlue: return 'power';
    default: return 'idle';
  }
}

/** A machine's shape from its state (paused and unpowered first). */
export function stateShape(e: { state: string; why: string | null; paused?: boolean }): PipShape {
  if (e.paused || e.why === 'paused') return 'paused';
  if (e.why === 'power') return 'power';
  if (e.state === 'work') return 'work';
  if (e.state === 'starved') return 'starved';
  if (e.state === 'blocked') return 'blocked';
  return 'idle';
}

/** Draw a shape's 5x5 at (x, y), its ink outline one pixel around it (so it covers x-1..x+5).
 * A grey pip's shape is lightened so the ring and the bars read on dark art. */
export function drawPipShape(ctx: CanvasRenderingContext2D, x: number, y: number, shape: PipShape, col: string) {
  // one drawImage of the shape baked in its colour (Milestone 14: 200 modules' pips were 5,000
  // fillRects a frame); the same fills on a 7x7, drawn one pixel up and left
  let bake = PIP_BAKES.get(shape + col);
  if (bake === undefined && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 7;
    const bc = c.getContext('2d');
    if (bc) pipFills(bc, 1, 1, shape, col);
    PIP_BAKES.set(shape + col, (bake = bc ? c : null));
  }
  if (bake) ctx.drawImage(bake, x - 1, y - 1);
  else pipFills(ctx, x, y, shape, col);
}

const PIP_BAKES = new Map<string, HTMLCanvasElement | null>();

function pipFills(ctx: CanvasRenderingContext2D, x: number, y: number, shape: PipShape, col: string) {
  const pts = PTS[shape];
  ctx.fillStyle = C.ink;
  // the ring and the bars hold ink inside them: the whole 7x7 less its corners
  if (shape === 'idle' || shape === 'paused' || shape === 'blocked') {
    ctx.fillRect(x - 1, y, 7, 5);
    ctx.fillRect(x, y - 1, 5, 7);
  } else for (const [px, py] of pts) ctx.fillRect(x + px - 1, y + py - 1, 3, 3);
  ctx.fillStyle = col === C.pipGrey ? C.hull2 : col;
  for (const [px, py] of pts) ctx.fillRect(x + px, y + py, 1, 1);
  // a glint on its first pixel, as the old square pip had
  const [gx, gy] = pts[0];
  ctx.fillStyle = rgba(C.bone, 0.5);
  ctx.fillRect(x + gx, y + gy, 1, 1);
}

/** The status pip of the tile at (x, y) (world px): the top-right corner, its 5x5 shape at
 * (x + 10, y + 1) inside its outline. A blocked pip blinks (its colour, never its shape). */
export function drawPip(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, blink: boolean, time: number, shape: PipShape = shapeOf(col)) {
  const c = blink && Math.floor(time * 3) % 2 ? C.rust : col;
  drawPipShape(ctx, x + 10, y + 1, shape, c);
}
