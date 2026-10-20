// The fixed tick, in a file with no browser APIs so the pure sim can import it.
// 20 Hz, not the 60 Hz of the owner's other games (DECISIONS.md 2026-10-20): an incremental game
// fast-forwards and replays offline time headless, and belts at 2 tiles/s need no finer steps.

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
