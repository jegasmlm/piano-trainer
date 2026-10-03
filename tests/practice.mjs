import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:4173/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('text=Practice (endless)');
let answered = 0;
for (let i = 0; i < 60 && answered < 14; i++) {
  const card = await page.$('.staff-card');
  const cls = await card.getAttribute('class');
  if (!cls.includes('phase-question')) { await page.waitForTimeout(200); continue; }
  const t = (await card.getAttribute('data-target')).split(',').map(Number);
  for (const m of t) await page.keyboard.press({60:'a',62:'s',64:'d',65:'f',67:'g',69:'h',71:'j',72:'k',74:'l',76:';'}[m] ?? 'a');
  answered++;
  await page.waitForTimeout(300);
}
await page.screenshot({ path: 'screenshots/practice-desktop.png' });
await page.click('text=Finish');
await page.waitForSelector('.complete-card');
console.log('practice ok, answered', answered, await page.textContent('.tile.xp b'), errs);
await b.close();
