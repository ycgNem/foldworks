// The background tab (DESIGN.md §20). A hidden tab gets no animation frames, so the frame loop
// stops; this keeps the sim running on a coarse timer instead. Browsers run a hidden tab's timers
// at most once a second (Chrome's intensive throttling: once a minute after five minutes), so
// each pump runs the ticks owed since the last one, within a time budget; what does not fit is
// carried as debt. A pump that comes very late means the machine slept or the browser froze the
// tab: that gap is time away (the offline model), not ticks owed. Sparks pause meanwhile (the app
// sends the sim `visible: false`). On return the caller gets what is still owed: a little is
// caught up live over the next frames, a lot goes through the offline path, so there is no
// catch-up stutter either way. The cost is measured (`stats`) for the debug handle and §20.
import { TICK_RATE } from '../engine/time';
import { IDLE } from '../data/idle';

export interface BackgroundStats {
  /** pumps run, ticks run, ms of work spent in them, and ms the tab was hidden */
  pumps: number;
  ticks: number;
  workMs: number;
  hiddenMs: number;
  /** the longest single pump, ms */
  maxPumpMs: number;
}

export class Background {
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private since = 0;
  /** ticks owed and not yet run */
  debt = 0;
  /** seconds the tab (or the machine) was asleep: time away */
  gap = 0;
  stats: BackgroundStats = { pumps: 0, ticks: 0, workMs: 0, hiddenMs: 0, maxPumpMs: 0 };

  constructor(private tick: () => void) {}

  get running() {
    return this.timer !== null;
  }

  /** The tab went hidden: start pumping. */
  hide(now = Date.now()) {
    this.stopTimer();
    this.last = this.since = now;
    this.debt = 0;
    this.gap = 0;
    this.timer = setInterval(() => this.pump(), IDLE.hiddenPumpMs.value);
  }

  /** One pump: count the time since the last, run what is owed within the budget. */
  pump(now = Date.now()) {
    const dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    if (dt > IDLE.hiddenGapSeconds.value) this.gap += dt;
    else this.debt += dt * TICK_RATE;
    const t0 = performance.now();
    // 40 ms always; a late pump (a throttled tab) up to 4% of the time since the last, at most 250 ms
    const budget = Math.min(IDLE.hiddenMaxPumpMs.value, Math.max(IDLE.hiddenBudgetMs.value, dt * 1000 * IDLE.hiddenShare.value));
    let n = 0;
    while (this.debt >= 1) {
      this.tick();
      this.debt--;
      n++;
      if ((n & 15) === 0 && performance.now() - t0 >= budget) break;
    }
    const ms = performance.now() - t0;
    this.stats.pumps++;
    this.stats.ticks += n;
    this.stats.workMs += ms;
    this.stats.maxPumpMs = Math.max(this.stats.maxPumpMs, ms);
  }

  /** The tab is back: stop pumping and say what is still owed (seconds of ticks) and how long
   * the tab was asleep (seconds away). */
  show(now = Date.now()): { owed: number; away: number } {
    if (!this.timer) return { owed: 0, away: 0 };
    this.stopTimer();
    // the time since the last pump is owed too (or a gap, if it is long)
    const dt = Math.max(0, (now - this.last) / 1000);
    if (dt > IDLE.hiddenGapSeconds.value) this.gap += dt;
    else this.debt += dt * TICK_RATE;
    this.stats.hiddenMs += now - this.since;
    const out = { owed: Math.floor(this.debt) / TICK_RATE, away: this.gap };
    this.debt = 0;
    this.gap = 0;
    return out;
  }

  private stopTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
