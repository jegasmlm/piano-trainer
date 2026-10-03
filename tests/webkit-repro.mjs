// Reproduce Juan's iPhone state in WebKit iPhone emulation and measure unit buttons.
import { webkit, devices } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'screenshots/webkit-repro.png';
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(URL);
const now = Date.now();
const lessons = {};
for (const [u, n] of [['t1', 3], ['t2', 2], ['t3', 3], ['t4', 3], ['t5', 3], ['t6', 1]]) for (let i = 0; i < n; i++) lessons[`sight-reading/${u}/${i}`] = { completions: 1, bestAccuracy: 0.9, lastCompleted: now };
await page.evaluate(({ lessons, now }) => localStorage.setItem('pianoTrainer.progress.v1', JSON.stringify({
  version: 1, xp: 2015, dailyXp: {}, streak: 1, longestStreak: 1, lastActiveDay: null, hearts: 1, heartsUpdatedAt: now, lessons,
  srs: { 'note:treble:C4': { box: 3, due: now, seen: 9, correct: 8, wrong: 1, last: now } },
})), { lessons, now });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const boxes = await page.$$eval('.node', (ns) => ns.slice(0, 8).map((n) => { const r = n.getBoundingClientRect(); return `${n.getAttribute('aria-label')}: ${Math.round(r.width)}x${Math.round(r.height)} [${n.className}]`; }));
console.log(boxes.join('\n'));
console.log('build:', await page.evaluate(() => document.querySelector('script[type=module]')?.src));
await page.screenshot({ path: out });
console.log(errs.length ? errs : 'no errors');
await b.close();
