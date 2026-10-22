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
  offlineEffMax: r(0.75, '§20 Offline efficiency: 0.5 at the start, plus the Patent tree\'s offline nodes and the Night Shift, never past 0.75 (a purchase that would add nothing past it is refused); the pace tests check 8 h offline at 0.75 still pays no more than 8 h open and idle at every stage measured, runs 1-3 on both seeds'),
  /** a machine or module counts as jammed once blocked this many seconds straight */
  jamSeconds: r(10, '§12 Report: a jam is a machine blocked 10 s straight (a belt that is briefly full blocks a machine for a tick or two; that is traffic, not a jam)'),
  /** after a heap fills or a Megaproject want is met while extrapolating: seconds replayed live to let
   * the jam spread, then seconds measured for the new rates */
  settleSeconds: r(60, '§12 Extrapolating in segments: 60 s for a full heap to block its smelters and the line behind them (a belt of 8 tiles drains in 4 s, a machine buffer in a craft or two)'),
  measureSeconds: r(180, '§12 Extrapolating in segments: 3 min of rates after a jam, measured like the replay\'s last minutes'),
  /** a jam inside a measuring window opens it again (the rates before it are a line now stopped),
   * at most this many times in one live stretch */
  remeasureMax: r(8, '§12 Extrapolating in segments: a cascade stops a line machine by machine within a minute or two (the slice\'s copper line: 4 machines); 8 windows of 3 min opened again cover the longest cascade the bots build, at most 24 min more of live ticks'),
  // ---- the compute budget (§20): the replay is shortened so a run costs about 5 s, by a tick's
  // cost estimated from what ticks (never a clock: the window is the same in every replay)
  /** ms the live ticks of one offline run (the replay and its segments' re-measures) may cost */
  replayBudgetMs: r(5000, '§20 The compute budget: an 8 h report in about 5 s (the Milestone 6 target; the Acts IV-V review measured 24-38 s at 15-40 h with the full hour replayed)'),
  /** the share of the budget the first replay takes; the segments\' settle-and-measure share the rest */
  replayShare: r(0.75, '§20 The compute budget: the bots\' factories need 0-7 segments in 8 h, 2-4 min of live ticks each; three quarters to the replay leaves a quarter for them'),
  /** the shortest first replay, however dear a tick: a settle and a full measuring window */
  replayMinSeconds: r(240, '§20 The compute budget: 60 s for lines to settle plus 3 min of rates (the segments\' own live stretch), so the rates are measured the same way however big the factory'),
  /** the shortest measuring window after a segment once the budget is spent */
  measureMinSeconds: r(60, '§20 The compute budget: a minute of rates after the 60 s settle (a District module at 0.05/s delivers 3 items in it; the Workshop\'s slowest line, a craft every 4-8 s)'),
  /** a tick's estimated cost: a fixed part, and per thing that ticks (ms on the reference PC) */
  tickBaseMs: r(0.008, '§20 The compute budget, calibrated: a tick with nothing built costs 0.007-0.011 ms (the checkpoints at 1, 5, 15, 30 and 40 h stripped bare; node, the owner\'s PC, best of 3 x 1,500 ticks, other agents running)'),
  tickWorkshopMs: r(0.0005, '§20 The compute budget, calibrated: the Workshop of the 1-40 h checkpoints (164-208 belts, Miners, machines, crates and heaps) costs 0.070-0.113 ms a tick over its bare floor: 0.00043-0.00054 ms a piece'),
  tickFactoryMs: r(0.0012, '§20 The compute budget, calibrated: the Factory\'s modules and trunks (18-48 of them) cost 0.041-0.062 ms a tick: 0.0010-0.0013 ms a piece'),
  tickHighMs: r(0.0018, '§20 The compute budget, calibrated: the high floors\' modules and routes (72, 108 and 242 of them at 30, 40 and 15 h) cost 0.13, 0.19 and 0.44 ms a tick: 0.0017-0.0018 ms a piece'),
  /** time slices the extrapolation credits in, so orders and research land at their times */
  creditSlice: r(900, '§12 Report: the extrapolated part is credited in 15-minute slices, so an order or a research node lands on the timeline within 15 min of when it would'),
  /** timeline entries kept in a report */
  timelineMax: r(40, '§12 Report: the 40 events nearest the start (jams first per machine), enough for a week away without a scroll that never ends'),
  // ---- the overnight forecast (§20)
  forecastHours: r(8, '§20 Safe for overnight: a night is 8 h; the screen also offers 1 h and 24 h'),
  /** an offline run or a forecast in the app: ms of it per animation frame, checked every chunk of ticks */
  jobMsPerFrame: r(20, '§20 Background tab: 20 ms of an offline run a frame keeps the page drawing at 30+ fps; the compute budget (replayBudgetMs) holds an 8 h run\'s live ticks to about 5 s of work, so its report shows in about 5-8 s with a progress bar, never a frozen page (it was 24-38 s at 15-40 h before the budget)'),
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
    blurb: '{u:overnight} offline efficiency {good:+5} points · someone minds the lines',
    derivation: '§20 Night Shift: a night is the first hour in full and 7 h at e, so +0.05 pays 0.05 x the 7 h of open idle after the first; measured from the Act II bot\'s factory at 1 h (Steam Power is done by then), 0.05 x (3.22M - 446K) = 139K a night (tests/pace-idle-early.test.ts): paid back in 1.1 nights. About 12 min of early Act II income',
  },
  {
    id: 'nightRota', name: 'Night Shift Rota', cost: 250_000, eff: 0.05, requires: 'circuits',
    blurb: '{u:overnight} offline efficiency {good:+5} more points · two crews in turn',
    derivation: '§20 Night Shift: offered with Circuits, done by 2 h; the factory then idles 3.17M in 8 h, 396K of it the first hour, so +0.05 is 0.05 x 2.77M = 139K a night (measured, tests/pace-idle-early.test.ts): 250K pays back in 1.8 nights (400K took 2.9). Re-derived from measured idle (6,600-8,000/min before the Bay floor), not the 12,500/min of active play the old price assumed',
  },
];
export type IdleUpgradeId = IdleUpgrade['id'];
export const IDLE_UPGRADE: Record<IdleUpgradeId, IdleUpgrade> = Object.fromEntries(IDLE_UPGRADES.map((u) => [u.id, u])) as Record<IdleUpgradeId, IdleUpgrade>;
