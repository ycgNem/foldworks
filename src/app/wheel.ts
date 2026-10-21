// The Workbench Wheel (docs/hud-180.md): the build menu, opened at the cursor. A stub so the
// screen and the menus can call it while the wheel is being built.
import type { App } from './app';
import type { Layout } from './layout';

/** Draw the wheel when it is open (and handle its clicks). Called last in the HUD, over the floor. */
export function drawWheel(_app: App, _L: Layout): void {}

/** Open the wheel centred at a UI-pixel point (clamped on screen). */
export function openWheel(_app: App, _x: number, _y: number): void {}

export function closeWheel(_app: App): void {}

export function wheelOpen(_app: App): boolean {
  return false;
}

/** The toolbox button beside the speaker's corner (the screen says where): opens the wheel at the
 * screen's centre, for mouse-only players and the first goal. */
export function toolboxButton(_app: App, _x: number, _y: number): void {}
