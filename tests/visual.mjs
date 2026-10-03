import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:4173/';
const units = process.argv.slice(3);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(URL);
await page.evaluate(() => localStorage.setItem('pianoTrainer.progress.v1', JSON.stringify({ settings: { unlockAll: true } })));
for (const u of units) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click(`.node[aria-label="${u}"]`);
  await page.click('.node-pop .btn.primary');
  await page.waitForSelector('.staff-card');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/unit-${u.replace(/[^a-z0-9]+/gi, '_')}.png` });
}
console.log(errs.length ? errs : 'ok');
await browser.close();
