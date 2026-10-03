// Probe which computer keys the (old) live build accepts, by checking which on-screen key turns "down".
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'https://jegasmlm.github.io/piano-trainer/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL); await page.evaluate(() => localStorage.setItem('pianoTrainer.progress.v1', JSON.stringify({ settings: { unlimitedHearts: true } })));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('.node >> nth=0'); await page.click('.node-pop .btn.primary'); await page.waitForSelector('.staff-card');
const probe = async (code, key, extra = {}) => {
  const r = await page.evaluate(({ code, key, extra }) => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, ...extra }));
    return new Promise((res) => setTimeout(() => { const d = [...document.querySelectorAll('.key.down')].map((e) => e.dataset.midi); document.body.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true })); res(d); }, 80));
  }, { code, key, extra });
  console.log(`${code.padEnd(10)} key=${JSON.stringify(key).padEnd(7)} ${JSON.stringify(extra)} -> ${r.length ? 'midi ' + r : 'NOTHING'}`);
};
for (const [c, k] of [['KeyA', 'a'], ['KeyG', 'g'], ['KeyK', 'k'], ['KeyG', 'G'], ['Semicolon', 'ñ'], ['Quote', 'Dead'], ['Semicolon', ';'], ['Quote', "'"]]) await probe(c, k);
await probe('KeyG', 'g', { repeat: true });
for (const k of ['Process', 'Unidentified', '´g']) { await probe('KeyG', k, { isComposing: true }); await probe('KeyK', k); }
await b.close();
