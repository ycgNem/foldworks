// The title screen in the real game with a save (Continue, New game and the coin chip), at the
// three window sizes, frames 0 and 5 of the scene (Bramble's hat up). Needs the dev server:
// BASE=http://127.0.0.1:5217/ node pixel-art/title/shot.mjs  -> pixel-art/title/out/game-*.png
import { launch, openGame, frames } from '../../e2e/launch.mjs';

const OUT = new URL('./out/', import.meta.url);
const { browser } = await launch();
for (const [w, h] of [[1280, 720], [1920, 1080], [1024, 640]]) {
  const { page, errors } = await openGame(browser, { w, h });
  for (const [t, tag] of [[0.01, 'f0'], [0.66, 'f5']]) {
    await page.evaluate((t) => {
      const a = window.__app;
      a.screen = 'title';
      a.titleInfo = { hasSave: true, coin: '12.4K' };
      a.ui.time = t;
    }, t);
    await frames(page, 2);
    await page.screenshot({ path: new URL(`game-${w}x${h}-save-${tag}.png`, OUT).pathname.slice(1) });
  }
  if (errors.length) console.log(`${w}x${h}:`, errors.join('\n'));
  await page.close();
}
await browser.close();
console.log('ok');
