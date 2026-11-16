// Smoke test: every mode x view x style, from file:// like a double-click.
// Fails on console errors, failed console.assert self-checks, or a Spot who never moves.
// Run: npm test  (needs `npx playwright install chromium` once)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'index.html')).href;
const args = process.env.GPU ? ['--use-angle=metal', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const problems = [];
page.on('console', m => {
  if (m.type() === 'assert' || (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()))) problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => typeof window.__spot === 'function');

let runs = 0;
for (const view of ['2d', '3d']) for (const bit of ['0', '1']) for (const mode of ['dodge', 'endless', 'lure']) {
  await page.click(`[data-view="${view}"]`);
  await page.click(`[data-bit="${bit}"]`);
  await page.click(`[data-mode="${mode}"]`);
  // distance travelled, not start vs end: he may run a loop and finish where he began
  let prev = await page.evaluate(() => window.__spot()), travelled = 0;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    await page.mouse.move(600 + Math.cos(a) * 380, 400 + Math.sin(a) * 250, { steps: 4 });
    await page.waitForTimeout(60);
    const cur = await page.evaluate(() => window.__spot());
    travelled += Math.hypot(cur.x - prev.x, cur.z - prev.z); prev = cur;
  }
  const after = prev;
  if (after.view !== view) problems.push(`${mode}/${view}/${bit}: view is ${after.view}`);
  if (travelled < 0.05) problems.push(`${mode}/${view}/${bit}: Spot did not move`);
  if (mode === 'lure' && after.items.length !== 3) problems.push(`lure: expected 3 items, got ${after.items.length}`);
  await page.keyboard.press('Escape');
  if (!(await page.isVisible('#pause'))) problems.push(`${mode}/${view}/${bit}: Esc did not pause`);
  await page.click('#pause [data-act="title"]');
  runs++;
}
await browser.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`ok: ${runs} runs (2 views x 2 styles x 3 modes), no console errors, self-checks pass`);
