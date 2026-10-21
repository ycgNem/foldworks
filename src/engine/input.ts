// Keyboard + mouse input with rebindable actions. Edges are latched per frame.
// (Extracted from Sprocket & Sprout's engine layer by way of Trotline; the action list is Foldworks'.)

export const ACTIONS = [
  'panUp', 'panDown', 'panLeft', 'panRight', 'zoomIn', 'zoomOut',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9',
  'wheel', 'rotate', 'remove', 'fold', 'floor', 'research', 'orders', 'modules', 'cancel', 'pause', 'help', 'mute', 'hud', 'flow', 'debug',
] as const;
export type Action = (typeof ACTIONS)[number];

/** Debug keys exist only in dev builds or with ?debug in the address. */
export const DEBUG_KEYS = !!import.meta.env?.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'));
/** The actions a player sees in the controls lists. */
export const SHOWN_ACTIONS = ACTIONS.filter((a) => a !== 'debug' || DEBUG_KEYS);

export const ACTION_LABELS: Record<Action, string> = {
  panUp: 'Pan up', panDown: 'Pan down', panLeft: 'Pan left', panRight: 'Pan right', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
  slot1: 'Wheel pick 1', slot2: 'Wheel pick 2', slot3: 'Wheel pick 3', slot4: 'Wheel pick 4', slot5: 'Wheel pick 5',
  slot6: 'Wheel pick 6', slot7: 'Wheel pick 7', slot8: 'Wheel pick 8', slot9: 'Wheel pick 9',
  wheel: 'Workbench Wheel', rotate: 'Rotate', remove: 'Remove tool', fold: 'Fold tool', floor: 'Switch floor', research: 'Research',
  orders: 'Orders', modules: 'Modules', cancel: 'Cancel', pause: 'Pause', help: 'Options and keys', mute: 'Sound on or off',
  hud: 'HUD on/off', flow: 'Flow overlay', debug: 'Debug readout',
};

export const DEFAULT_BINDS: Record<Action, string[]> = {
  panUp: ['KeyW', 'ArrowUp'], panDown: ['KeyS', 'ArrowDown'], panLeft: ['KeyA', 'ArrowLeft'], panRight: ['KeyD', 'ArrowRight'],
  // Q opens the Workbench Wheel now, so zoom is the mouse wheel, +/- and E/Z
  zoomIn: ['Equal', 'NumpadAdd', 'KeyE'], zoomOut: ['Minus', 'NumpadSubtract', 'KeyZ'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'],
  slot6: ['Digit6'], slot7: ['Digit7'], slot8: ['Digit8'], slot9: ['Digit9'],
  wheel: ['KeyQ', 'Space'], rotate: ['KeyR'], remove: ['KeyX'], fold: ['KeyF'], floor: ['Tab'], research: ['KeyT'], orders: ['KeyO'], modules: ['KeyI'],
  cancel: ['Escape'], pause: ['KeyP'], help: ['Slash', 'F1'], mute: ['KeyM'], hud: ['KeyH'], flow: ['KeyL'], debug: ['Backquote'],
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
  mouse = { x: 0, y: 0, dx: 0, dy: 0, down: [false, false, false], pressed: [false, false, false], released: [false, false, false], wheel: 0, moved: false, px: 0, py: 0 };
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
      // where the press happened (a fast drag may have moved on by the next frame)
      this.mouse.px = e.offsetX;
      this.mouse.py = e.offsetY;
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
