// Entry point: one canvas, the App, the art. (DESIGN.md / CLAUDE.md: one Canvas 2D, integer zoom,
// imageSmoothingEnabled = false, a 20 Hz sim decoupled from a rAF renderer.)
import { App } from './app/app';
import { loadArt } from './render/sprites';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas);
(window as unknown as { __app: App }).__app = app;
loadArt().then(() => app.start());
