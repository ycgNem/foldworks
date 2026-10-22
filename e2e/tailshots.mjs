// Milestone 11's moments alone (the long tail's screens), without the bot's run that `npm run shots`
// takes first: the same states as shots.mjs's long-tail section, at one size. Needs the dev server.
// Usage: node e2e/tailshots.mjs [w h] [state ...]  (BASE=... for another server)
import fs from 'node:fs';
import { launch, openGame, frames } from './launch.mjs';
import { runTail, TAIL } from './screens.mjs';

const args = process.argv.slice(2);
const nums = args.filter((x) => /^\d+$/.test(x)).map(Number);
const [w = 1280, h = 720] = nums;
const only = args.filter((x) => !/^\d+$/.test(x));
const OUT = 'e2e/out/tail';
fs.mkdirSync(OUT, { recursive: true });
const { browser } = await launch();
const { page, errors } = await openGame(browser, { w, h });
await page.evaluate(() => window.__app.onboarding.lessons.hold(true));
for (const state of Object.keys(TAIL)) {
  if (only.length && !only.includes(state)) continue;
  await page.mouse.move(2, Math.floor(h * 0.3));
  await runTail(page, state);
  await frames(page, 6);
  await page.screenshot({ path: `${OUT}/${w}x${h}-${state}.png` });
  console.log(`${w}x${h}-${state}`);
}
if (errors.length) console.log(errors.join('\n'));
await browser.close();
