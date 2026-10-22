// The game's event queue: the sim pushes presentation events (a sound, a flash, a toast) and the
// renderer and audio drain them once per frame. Pure, so the sim can use it in tests.

export interface GameEvent {
  /** what happened, e.g. 'catch' */
  type: string;
  /** the tick it happened on */
  tick: number;
  /** optional payload: a position in sim coordinates, an id, a value */
  x?: number;
  y?: number;
  /** a second point (a zap's far end) */
  x2?: number;
  y2?: number;
  d?: number;
  id?: string;
  value?: number;
  /** the floor it happened on, when not the Workshop */
  floor?: 'factory' | 'district' | 'world' | 'beyond';
}

export class EventQueue {
  private items: GameEvent[] = [];
  /** past this the oldest events are dropped (a renderer that stopped draining must not grow
   * memory, and the newest events, like a run ending, are the ones that matter) */
  max = 512;

  push(e: GameEvent) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push(e);
  }

  /** Take every pending event, oldest first, and clear the queue. */
  drain(): GameEvent[] {
    const out = this.items;
    this.items = [];
    return out;
  }

  get length() {
    return this.items.length;
  }
}
