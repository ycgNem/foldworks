// Idle and offline at the stages of the campaign's run 3, seed 8919 (see tests/pace-idle-runs.ts).
import { laterRun } from './pace-idle-runs';

// 1 h and 3 h (2 h reads like 3 h here: the factory has settled after the Bay floor)
laterRun(8919, 3, [1, 3]);
