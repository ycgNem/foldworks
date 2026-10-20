// Keyboard + mouse input with rebindable actions. Edges are latched per frame.
// (Extracted from Sprocket & Sprout's engine layer by way of Trotline; the action list is Foldworks'.)

export const ACTIONS = [
  'panUp', 'panDown', 'panLeft', 'panRight', 'zoomIn', 'zoomOut',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9',
  'rotate', 'remove', 'fold', 'floor', 'research', 'orders', 'modules', 'cancel', 'pause', 'help', 'mute', 'hud', 'flow', 'debug',
] as const;
export type Action = (typeof ACTIONS)[number];

/** Debug keys exist only in dev builds or with ?debug in the address. */
export const DEBUG_KEYS = !!import.meta.env?.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'));
/** The actions a player sees in the controls lists. */
export const SHOWN_ACTIONS = ACTIONS.filter((a) => a !== 'debug' || DEBUG_KEYS);

export const ACTION_LABELS: Record<Action, string> = {
  panUp: 'Pan up', panDown: 'Pan down', panLeft: 'Pan left', panRight: 'Pan right', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
  slot1: 'Build slot 1', slot2: 'Build slot 2', slot3: 'Build slot 3', slot4: 'Build slot 4', slot5: 'Build slot 5',
  slot6: 'Build slot 6', slot7: 'Build slot 7', slot8: 'Build slot 8', slot9: 'Build slot 9',
  rotate: 'Rotate', remove: 'Remove tool', fold: 'Fold tool', floor: 'Switch floor', research: 'Research (the Hopper)',
  orders: 'Orders (the Dock)', modules: 'Modules', cancel: 'Cancel', pause: 'Pause', help: 'Help and keys', mute: 'Sound on/off',
  hud: 'HUD on/off', flow: 'Flow overlay', debug: 'Debug readout',
};

export const DEFAULT_BINDS: Record<Action, string[]> = {
  panUp: ['KeyW', 'ArrowUp'], panDown: ['KeyS', 'ArrowDown'], panLeft: ['KeyA', 'ArrowLeft'], panRight: ['KeyD', 'ArrowRight'],
  zoomIn: ['Equal', 'NumpadAdd', 'KeyE'], zoomOut: ['Minus', 'NumpadSubtract', 'KeyQ'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'],
  slot6: ['Digit6'], slot7: ['Digit7'], slot8: ['Digit8'], slot9: ['Digit9'],
  rotate: ['KeyR'], remove: ['KeyX'], fold: ['KeyF'], floor: ['Tab'], research: ['KeyT'], orders: ['KeyO'], modules: ['KeyI'],
  cancel: ['Escape'], pause: ['Space', 'KeyP'], help: ['Slash', 'F1'], mute: ['KeyM'], hud: ['KeyH'], flow: ['KeyL'], debug: ['Backquote'],
};

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ShiftLeft: 'LShift',
    ShiftRight: 'RShift', ControlLeft: 'LCtrl', Escape: 'Esc', Backquote: '`', Equal: '=', Minus: '-',
    Space: 'Space', Tab: 'Tab', Enter: 'Enter', NumpadAdd: 'Num+', NumpadSubtract: 'Num-', Backspace: 'Bksp', Slash: '/',
  };
  return map[code] ?? code;
}

export class Input {
  down = new Set<string>();
  pressed = new Set<string>();
  released = new Set<string>();
  binds: Record<Action, string[]> = structuredClone(DEFAULT_BINDS);
  /** Mouse position in CSS pixels relative to the element; dx/dy are this frame's movement. */
  mouse = { x: 0, y: 0, dx: 0, dy: 0, down: [false, false, false], pressed: [false, false, false], released: [false, false, false], wheel: 0, moved: false };
  /** Set by UI to capture the next key for rebinding. */
  captureKey: ((code: string) => void) | null = null;
  /** Set by UI while a text field has focus: printable keys go here instead of the binds. */
  typing: ((key: string) => void) | null = null;
  ctrl = false;
  shift = false;

  attach(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (this.captureKey) {
        e.preventDefault();
        const cb = this.captureKey;
        this.captureKey = null;
        cb(e.code);
        return;
      }
      if (this.typing && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        this.typing(e.key);
        return;
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      this.ctrl = e.ctrlKey || e.metaKey;
      this.shift = e.shiftKey;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Backquote' || e.code === 'F1' || e.code === 'Slash') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
      this.ctrl = e.ctrlKey || e.metaKey;
      this.shift = e.shiftKey;
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.shift = this.ctrl = false;
      this.mouse.down = [false, false, false];
    });
    el.addEventListener('mousemove', (e) => {
      this.mouse.dx += e.offsetX - this.mouse.x;
      this.mouse.dy += e.offsetY - this.mouse.y;
      this.mouse.x = e.offsetX;
      this.mouse.y = e.offsetY;
      this.mouse.moved = true;
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button > 2) return;
      this.mouse.x = e.offsetX;
      this.mouse.y = e.offsetY;
      this.mouse.down[e.button] = true;
      this.mouse.pressed[e.button] = true;
      this.shift = e.shiftKey;
      this.ctrl = e.ctrlKey || e.metaKey;
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button > 2) return;
      this.mouse.down[e.button] = false;
      this.mouse.released[e.button] = true;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  isDown(a: Action): boolean {
    for (const k of this.binds[a]) if (this.down.has(k)) return true;
    return false;
  }

  wasPressed(a: Action): boolean {
    for (const k of this.binds[a]) if (this.pressed.has(k)) return true;
    return false;
  }

  keyPressed(code: string) {
    return this.pressed.has(code);
  }

  /** Consume an action edge so lower UI layers don't also react. */
  consume(a: Action) {
    for (const k of this.binds[a]) this.pressed.delete(k);
  }

  consumeMouse(button = 0) {
    this.mouse.pressed[button] = false;
    this.mouse.released[button] = false;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.pressed = [false, false, false];
    this.mouse.released = [false, false, false];
    this.mouse.wheel = 0;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.moved = false;
  }
}
