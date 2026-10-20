// Idle and offline (Milestone 6, DESIGN.md §12 and §20): the offline model's segments and jam
// rule, the overnight forecast, Inspiration clicking, the Night Shift upgrades (a coin sink that
// raises offline efficiency a little), the background tab's cadence and the save cadence. Every
// number with its derivation. Plain numbers: rates, shares, timers and prices, never stocks.
import type { ResearchId } from './research';

export interface IdleRule { value: number; derivation: string }
const r = (value: number, derivation: string): IdleRule => ({ value, derivation });

export const IDLE = {
  // ---- the offline model (§12)
  /** offline efficiency never goes past this, whatever raises it (upgrades now, Patents later) */
  offlineEffMax: r(0.75, '§20 Offline efficiency: 0.5 at the start, the Night Shift to 0.6, Patent nodes (Milestone 5) toward 0.75; the pace test checks 8 h offline at 0.75 still pays no more than 8 h open and idle at every stage'),
  /** a machine or module counts as jammed once blocked this many seconds straight */
  jamSeconds: r(10, '§12 Report: a jam is a machine blocked 10 s straight (a belt that is briefly full blocks a machine for a tick or two; that is traffic, not a jam)'),
  /** after a heap fills or a Megaproject want is met while extrapolating: seconds replayed live to let
   * the jam spread, then seconds measured for the new rates */
  settleSeconds: r(60, '§12 Extrapolating in segments: 60 s for a full heap to block its smelters and the line behind them (a belt of 8 tiles drains in 4 s, a machine buffer in a craft or two)'),
  measureSeconds: r(180, '§12 Extrapolating in segments: 3 min of rates after a jam, measured like the replay\'s last minutes'),
  /** time slices the extrapolation credits in, so orders and research land at their times */
  creditSlice: r(900, '§12 Report: the extrapolated part is credited in 15-minute slices, so an order or a research node lands on the timeline within 15 min of when it would'),
  /** timeline entries kept in a report */
  timelineMax: r(40, '§12 Report: the 40 events nearest the start (jams first per machine), enough for a week away without a scroll that never ends'),
  // ---- the overnight forecast (§20)
  forecastHours: r(8, '§20 Safe for overnight: a night is 8 h; the screen also offers 1 h and 24 h'),
  /** an offline run or a forecast in the app: ms of it per animation frame, checked every chunk of ticks */
  jobMsPerFrame: r(20, '§20 Background tab: 20 ms of an offline run a frame keeps the page drawing at 30+ fps; at 0.05 ms an Act II tick (measured) an 8 h run (about 86,000 ticks: the 1 h replay and its re-measured segments) shows its report in about 5 s, with a progress bar, never a frozen page'),
  jobChunkTicks: r(100, '§20 Background tab: the clock is read every 100 ticks (about 5 ms), so a frame overruns its 20 ms by at most that'),
  // ---- Inspiration (§15)
  inspireShare: r(0.001, '§15 Inspiration: 1 click = 0.1% of the selected node\'s remaining cost'),
  inspireCap: r(0.3, '§15 Inspiration: capped at 30% of each node (clicking helps but never replaces the line)'),
  // ---- the background tab (§20)
  hiddenPumpMs: r(1000, '§20 Background tab: browsers run a hidden tab\'s timers at most once a second, so the sim catches up in 1 s chunks of 20 ticks'),
  hiddenBudgetMs: r(40, '§20 Background tab: a pump may always spend 40 ms on ticks (4% of a core at 1 pump a second)'),
  hiddenShare: r(0.04, '§20 Background tab: a late pump may spend up to 4% of the time since the last one, so a tab throttled to one pump a minute still keeps up (1,200 ticks at 0.05 ms is 60 ms of the 2.4 s allowed)'),
  hiddenMaxPumpMs: r(250, '§20 Background tab: never more than 250 ms in one pump (a quarter-second hitch in a tab nobody is looking at); what is left is carried as debt'),
  /** a pump that comes this many seconds late means the machine slept or the tab was frozen: that gap is time away (offline), not debt */
  hiddenGapSeconds: r(120, '§20 Background tab: Chrome runs a hidden tab\'s timers once a minute at worst (intensive throttling); a pump 2 min late means the tab or the machine was asleep, so that gap is time away'),
  /** on return, debt up to this many seconds is caught up live over the next frames; more goes through the offline path */
  catchUpLiveSeconds: r(60, '§20 Background tab: up to 60 s owed (1,200 ticks, about 60 ms at Act II) is spread over the next frames; past it the offline path runs, as for a closed game (§12 also starts at 60 s)'),
  catchUpTicksPerFrame: r(40, '§20 Background tab: 40 extra ticks a frame (about 2 ms) clears a minute owed in half a second with no stutter'),
  // ---- saves (§20)
  autosaveSeconds: r(30, '§20 Saves: every 30 s of real time, so a crash loses at most 30 s (ROADMAP.md Milestone 6 exit)'),
  backupMinutes: r(10, '§20 Saves: a backup every 10 min, three kept, so a save broken by a bug is at most 10-30 min behind a good one'),
  backups: r(3, '§20 Saves: three rolling backups (ROADMAP.md Milestone 6)'),
};

export type IdleRuleId = keyof typeof IDLE;

/** The Night Shift: one-off coin purchases that raise offline efficiency (§20). Flat prices. */
export interface IdleUpgrade {
  id: 'nightForeman' | 'nightRota';
  name: string;
  cost: number;
  /** added to offline efficiency */
  eff: number;
  requires: ResearchId;
  blurb: string;
  derivation: string;
}

export const IDLE_UPGRADES: IdleUpgrade[] = [
  {
    id: 'nightForeman', name: 'Night Foreman', cost: 150_000, eff: 0.05, requires: 'steamPower',
    blurb: 'Someone minds the lines while you sleep: offline efficiency +5 points.',
    derivation: '§20 Night Shift: the slice-end factory earns about 7,200 coin/min idle (§18); +0.05 of 7 extrapolated hours is 0.05 x 7,200 x 420 = 151K, so it pays back in one night. 150K is 12 min of early Act II income (12,500/min, §18), offered with Steam Power (S+25 min)',
  },
  {
    id: 'nightRota', name: 'Night Shift Rota', cost: 400_000, eff: 0.05, requires: 'circuits',
    blurb: 'Two crews in turn: offline efficiency +5 more points (0.6 in all).',
    derivation: '§20 Night Shift: offered with Circuits (S+55 min), when the factory idles at about 12,500/min; 0.05 x 12,500 x 420 = 262K a night, paid back in 1.5 nights. 32 min of Act II income: a sink for the coin that piles up (1.8M at 4 h, §18)',
  },
];
export type IdleUpgradeId = IdleUpgrade['id'];
export const IDLE_UPGRADE: Record<IdleUpgradeId, IdleUpgrade> = Object.fromEntries(IDLE_UPGRADES.map((u) => [u.id, u])) as Record<IdleUpgradeId, IdleUpgrade>;
