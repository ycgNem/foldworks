// Fixed-timestep simulation loop decoupled from rendering (from the Sprocket & Sprout engine layer,
// by way of Trotline). The sim ticks at TICK_RATE (20 Hz); the renderer runs every animation frame
// and gets `alpha`, how far it is between the last tick and the next, for interpolation.
import { DT, TICK_RATE } from './time';

export { DT, TICK_RATE };

export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  /** Simulation speed multiplier (debug fast-forward x10, x100, x1000). */
  speed = 1;
  /** When set, the loop runs as many ticks as fit in `ffBudgetMs` per frame while it returns true. */
  fastForward: (() => boolean) | null = null;
  ffBudgetMs = 12;
  paused = false;
  /** Smoothed ms spent in ticks per frame (for the debug overlay and npm run perf). */
  tickMs = 0;
  frameMs = 0;
  fps = 60;

  constructor(
    private tick: () => void,
    private frame: (realDt: number, alpha: number) => void,
  ) {}

  start() {
    this.last = performance.now();
    const step = (now: number) => {
      this.raf = requestAnimationFrame(step);
      let realDt = (now - this.last) / 1000;
      this.last = now;
      // a background tab that wakes up must not try to catch up in one frame (offline progress
      // handles long gaps; see App.resume)
      if (realDt > 0.25) realDt = 0.25;
      this.fps = this.fps * 0.95 + (1 / Math.max(realDt, 0.001)) * 0.05;
      const t0 = performance.now();
      if (this.fastForward) {
        const ff = this.fastForward;
        while (ff() && performance.now() - t0 < this.ffBudgetMs) this.tick();
        if (!ff()) this.fastForward = null;
        this.acc = 0;
      } else if (!this.paused) {
        this.acc += realDt * this.speed;
        let steps = 0;
        // at high speeds, cap the ticks per frame by time instead of letting the frame stall
        const maxSteps = Math.max(8, Math.ceil(this.speed * 2));
        while (this.acc >= DT && steps < maxSteps) {
          this.tick();
          this.acc -= DT;
          steps++;
          if ((steps & 63) === 0 && performance.now() - t0 > this.ffBudgetMs) break;
        }
        if (steps >= maxSteps || this.acc > DT * 4 * Math.max(1, this.speed)) this.acc = 0;
      }
      const t1 = performance.now();
      this.tickMs = this.tickMs * 0.9 + (t1 - t0) * 0.1;
      this.frame(realDt, Math.min(1, this.acc / DT));
      this.frameMs = this.frameMs * 0.9 + (performance.now() - t1) * 0.1;
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}
