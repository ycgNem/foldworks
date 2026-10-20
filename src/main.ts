// Placeholder entry point until Milestone 0 brings in the engine layer (ROADMAP.md).
// Draws the title on a pixel-scaled canvas so the scaffold can be built and served.
import { TITLE, TILE_PX } from './game-info';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function draw(): void {
  const zoom = Math.max(1, Math.floor(Math.min(window.innerWidth / 320, window.innerHeight / 180)));
  canvas.width = Math.floor(window.innerWidth / zoom);
  canvas.height = Math.floor(window.innerHeight / zoom);
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#0e0b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // A faint workshop grid.
  ctx.fillStyle = '#1a1420';
  for (let x = 0; x < canvas.width; x += TILE_PX) ctx.fillRect(x, 0, 1, canvas.height);
  for (let y = 0; y < canvas.height; y += TILE_PX) ctx.fillRect(0, y, canvas.width, 1);

  ctx.fillStyle = '#f2c14e';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TITLE, Math.floor(canvas.width / 2), Math.floor(canvas.height / 2) - 6);
  ctx.fillStyle = '#8a7f99';
  ctx.font = '8px monospace';
  ctx.fillText('scaffold - Milestone 0 next', Math.floor(canvas.width / 2), Math.floor(canvas.height / 2) + 10);
}

window.addEventListener('resize', draw);
draw();
