// Headless smoke test: loads the built app, plays through a lesson, checks for console errors, takes screenshots.
import { chromium } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:4173/';
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });

async function run(name, viewport, isMobile, midi = false) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  if (midi) await page.addInitScript(() => {
    // Fake Web MIDI device
    const input = { name: 'Fake Digital Piano', onmidimessage: null };
    const access = { inputs: new Map([['1', input]]), outputs: new Map(), onstatechange: null };
    navigator.requestMIDIAccess = async () => access;
    window.__midi = (note, on = true) => input.onmidimessage?.({ data: new Uint8Array([on ? 0x90 : 0x80, note, on ? 90 : 0]) });
  });
  const play = async (m) => {
    if (midi) { await page.evaluate((m) => { window.__midi(m, true); setTimeout(() => window.__midi(m, false), 80); }, m); }
    else await page.click(`[data-midi="${m}"]`);
  };
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[${name}] requestfailed ${r.url()}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `screenshots/home-${name}.png` });
  // open first unit and start
  await page.click('.node >> nth=0');
  await page.click('.node-pop .btn.primary');
  await page.waitForSelector('.staff-card');
  await page.waitForTimeout(1500); // let samples load
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `screenshots/lesson-intro-${name}.png` });
  let steps = 0, wrongDone = false;
  while (steps++ < 80) {
    if (await page.$('.complete-card')) break;
    const card = await page.$('.staff-card');
    if (!card) { await page.waitForTimeout(200); continue; }
    const phase = await card.getAttribute('class');
    if (phase.includes('correct')) { await page.waitForTimeout(300); continue; }
    if (phase.includes('wrong')) {
      if (name === 'desktop' && !(await page.$('.wrong-shot'))) { await page.screenshot({ path: `screenshots/lesson-wrong-${name}.png` }); await page.evaluate(() => document.body.classList.add('wrong-shot')); }
      await page.click('.feedback .btn.danger'); await page.waitForTimeout(300); continue;
    }
    const target = (await card.getAttribute('data-target')).split(',').map(Number);
    const intro = !!(await page.$('.intro-badge'));
    if (!intro && !wrongDone && steps > 4) {
      wrongDone = true;
      await play(target[0] + 2);
      continue;
    }
    if (!intro && name !== 'mobile-x' && !(await page.$('.q-shot'))) {
      await page.screenshot({ path: `screenshots/lesson-${name}.png` });
      await page.evaluate(() => document.body.classList.add('q-shot'));
    }
    for (const m of target) { await play(m); await page.waitForTimeout(midi ? 10 : 60); }
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('.complete-card', { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `screenshots/complete-${name}.png` });
  const xp = await page.textContent('.tile.xp b');
  await page.click('.complete-card .btn.primary');
  const stats = await page.textContent('.top-stats');
  console.log(name, 'steps', steps, 'xp tile', xp, 'stats', stats);
  await ctx.close();
}
await run('desktop', { width: 1280, height: 800 }, false);
await run('mobile', { width: 390, height: 844 }, true);
await run('midi', { width: 1280, height: 800 }, false, true);
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No console errors');
process.exit(errors.length ? 1 : 0);
