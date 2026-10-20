import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, TICK_HZ, TILE_PX } from '../src/game-info';

describe('scaffold', () => {
  it('uses the decided tick rate and tile size (DECISIONS.md 2026-10-20)', () => {
    expect(TICK_HZ).toBe(20);
    expect(TILE_PX).toBe(16);
    expect(SAVE_VERSION).toBe(1);
  });
});
