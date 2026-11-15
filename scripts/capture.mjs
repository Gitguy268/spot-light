// Makes the README pictures in docs/: screenshot.jpg, views.jpg, title.jpg and demo.webp.
// Needs Playwright Chromium, ImageMagick (magick) and img2webp. Run: npm run capture
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const tmp = mkdtempSync(join(tmpdir(), 'spot-capture-'));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.25 });
await page.goto(pathToFileURL(join(root, 'index.html')).href);
await page.waitForFunction(() => typeof window.__spot === 'function');
await page.evaluate(() => document.fonts.ready);
const sh = (name, opts = {}) => page.screenshot({ path: join(tmp, name), ...opts });
const circle = async (n, r = 300, ms = 40) => {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    await page.mouse.move(640 + Math.cos(a) * r, 420 + Math.sin(a * 2) * r * 0.45, { steps: 3 });
    await page.waitForTimeout(ms);
  }
};

await page.click('[data-view="3d"]');
await page.waitForTimeout(500);
await sh('title.png');

// Four looks for the views grid.
for (const [view, bit] of [['2d', '0'], ['2d', '1'], ['3d', '0'], ['3d', '1']]) {
  await page.click(`[data-view="${view}"]`); await page.click(`[data-bit="${bit}"]`);
  await page.click('[data-mode="lure"]');
  await circle(30);
  await sh(`view-${view}-${bit}.png`);
  if (view === '3d' && bit === '0') await sh('screenshot.png');
  await page.keyboard.press('Escape'); await page.click('#pause [data-act="title"]');
}

// Animated demo: 3D dodge, 12 fps for 6 s.
await page.click('[data-view="3d"]'); await page.click('[data-bit="0"]');
await page.click('[data-mode="dodge"]');
const frames = [];
for (let i = 0; i < 72; i++) {
  const a = i / 72 * Math.PI * 4;
  await page.mouse.move(640 + Math.cos(a) * 330, 430 + Math.sin(a * 1.5) * 170, { steps: 2 });
  const f = join(tmp, `f${String(i).padStart(3, '0')}.png`);
  await page.screenshot({ path: f }); frames.push(f);
  await page.waitForTimeout(40);
}
await browser.close();

const m = (...a) => execFileSync('magick', a, { stdio: 'inherit' });
m(join(tmp, 'screenshot.png'), '-resize', '1440x', '-quality', '84', join(docs, 'screenshot.jpg'));
m(join(tmp, 'title.png'), '-resize', '1440x', '-quality', '84', join(docs, 'title.jpg'));
m('montage', ...['2d-0', '2d-1', '3d-0', '3d-1'].map(v => join(tmp, `view-${v}.png`)), '-tile', '2x', '-geometry', '720x450+4+4', '-background', '#1C1B20', '-quality', '84', join(docs, 'views.jpg'));
const small = frames.map(f => { const o = f.replace('.png', '-s.png'); m(f, '-resize', '720x', o); return o; });
execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', '62', '-d', '83', ...small, '-o', join(docs, 'demo.webp')], { stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });
console.log('docs/ updated');
