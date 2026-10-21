// The kit gallery's screenshots (gallery.html, the 180's paper-and-ink kit): one PNG per scene at
// 1280x720 (2x UI scale), and the overlap audit's findings for each.
// Usage: node e2e/gallery.mjs  (needs a dev server; BASE as for the other e2e scripts).
// Output: e2e/out/gallery/<scene>.png
import fs from 'node:fs';
import { launch, BASE } from './launch.mjs';

const out = 'e2e/out/gallery';
fs.mkdirSync(out, { recursive: true });
const scenes = (process.env.SCENES ?? 'hud,kit,old,book,rich').split(',');
const { browser } = await launch();
let bad = 0;
for (const s of scenes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
  await page.goto(BASE + 'gallery.html?scene=' + s);
  await page.waitForFunction(() => window.__galleryReady, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${s}.png` });
  const issues = await page.evaluate(() => window.__galleryIssues ?? []);
  console.log(`${s}: ${issues.length} audit finding(s)${errors.length ? `, ${errors.length} error(s)` : ''}`);
  for (const i of issues.slice(0, 20)) console.log(`  ${i.type}: "${i.text}" ${i.other ? `vs ${i.other}` : ''} @${i.rect.x},${i.rect.y}`);
  for (const e of errors) console.log('  error:', e);
  bad += issues.length + errors.length;
  await page.close();
}
await browser.close();
console.log(bad ? `${bad} finding(s)` : 'clean');
