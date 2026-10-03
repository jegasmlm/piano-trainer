// Exhaustive QA suite for KeysReader. Usage: node tests/qa.mjs [baseURL]
import { chromium, webkit, devices } from 'playwright-core';
const URL = process.argv[2] ?? 'http://localhost:4173/';
const SHOTS = 'screenshots/qa';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
let wk = null; // WebKit (Safari engine) launched lazily
const engines = async (e) => e === 'webkit' ? (wk ??= await webkit.launch()) : browser;
const results = [];
const allErrors = [];
const CODES = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon', 'Quote'];
const ES_KEYS = { Semicolon: 'ñ', Quote: 'Dead' };
const AZERTY = { KeyA: 'q', KeyW: 'z', KeyS: 's', KeyE: 'e', KeyD: 'd', KeyF: 'f', KeyT: 't', KeyG: 'g', KeyY: 'y', KeyH: 'h', KeyU: 'u', KeyJ: 'j', KeyK: 'k', KeyO: 'o', KeyL: 'l', KeyP: 'p', Semicolon: 'm', Quote: 'ù' };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 } };
const IPHONE = devices['iPhone 13'];

function assert(c, msg) { if (!c) throw new Error(msg); }

async function open({ device = DESKTOP, progress = null, midi = false, midiLater = false, engine = 'chromium' } = {}) {
  const ctx = await (await engines(engine)).newContext({ ...device, deviceScaleFactor: device.deviceScaleFactor ?? 2 });
  const page = await ctx.newPage();
  const errors = [];
  // A version.json poll that is cancelled because the test navigates away is benign (WebKit reports it as an error).
  const benign = (t) => /version\.json/.test(t) && /(access control|cancelled|aborted|requestfailed)/i.test(t);
  page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => { if (!benign(e.message)) errors.push('pageerror ' + e.message); });
  page.on('requestfailed', (r) => { if (!benign('requestfailed ' + r.url())) errors.push('requestfailed ' + r.url() + ' ' + (r.failure()?.errorText ?? '')); });
  await page.addInitScript(({ midi, midiLater }) => {
    window.__notes = [];
    window.addEventListener('keysreader:note', (e) => window.__notes.push(e.detail.midi));
    if (midi || midiLater) {
      const input = { name: 'Fake Digital Piano', onmidimessage: null };
      const access = { inputs: new Map(midiLater ? [] : [['1', input]]), outputs: new Map(), onstatechange: null };
      navigator.requestMIDIAccess = async () => access;
      window.__midi = (note, on = true, vel = 90) => input.onmidimessage?.({ data: new Uint8Array([on ? 0x90 : 0x80, note, on ? vel : 0]) });
      window.__plug = () => { access.inputs.set('1', input); access.onstatechange?.({}); };
    }
  }, { midi, midiLater });
  await page.goto(URL);
  if (progress) {
    await page.evaluate((p) => localStorage.setItem('pianoTrainer.progress.v1', JSON.stringify(p)), progress);
  }
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}

const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
async function test(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now();
  const env = { opened: [] };
  try {
    await fn(async (o) => { const r = await open(o); env.opened.push(r); return r; });
    const errs = env.opened.flatMap((o) => o.errors);
    if (errs.length) throw new Error('console errors: ' + errs.join(' | '));
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name, ok: false, err: e.message.split('\n')[0] });
    console.log('FAIL', name, '—', e.message.split('\n').slice(0, 3).join(' '));
    allErrors.push(name);
    const last = env.opened[env.opened.length - 1];
    if (last) await last.page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  } finally {
    for (const o of env.opened) await o.ctx.close().catch(() => {});
  }
}

const openUnit = async (page, title) => {
  await page.click(`.node[aria-label="${title}"]`);
  await page.click('.node-pop .btn.primary');
  await page.waitForSelector('.staff-card');
};
const card = async (page) => {
  const el = await page.$('.staff-card');
  if (!el) return null;
  return { phase: (await el.getAttribute('class')).match(/phase-(\w+)/)[1], target: (await el.getAttribute('data-target')).split(',').map(Number), kind: await el.getAttribute('data-kind') };
};
const notes = (page) => page.evaluate(() => window.__notes.slice());
const clearNotes = (page) => page.evaluate(() => { window.__notes.length = 0; });
const kbBase = async (page) => {
  const t = await page.textContent('.kb-help');
  const m = /play C(-?\d)/.exec(t);
  return (Number(m[1]) + 1) * 12;
};
const synthKey = (page, type, code, key, extra = {}) =>
  page.evaluate(({ type, code, key, extra }) => document.body.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true, ...extra })), { type, code, key, extra });

/** Play one midi via the chosen method. */
async function play(page, m, method) {
  if (method === 'click') return page.click(`[data-midi="${m}"]`);
  if (method === 'tap') return page.tap(`[data-midi="${m}"]`);
  if (method === 'midi') return page.evaluate((m) => { window.__midi(m, true); setTimeout(() => window.__midi(m, false), 60); }, m);
  // computer keyboard (us | es): shift octave so the note is reachable
  let base = await kbBase(page);
  while (m - base > 17 || m < base) {
    const code = m < base ? 'KeyZ' : 'KeyX';
    if (method === 'us') await page.keyboard.press(code); else { await synthKey(page, 'keydown', code, code.slice(3).toLowerCase()); await synthKey(page, 'keyup', code, code.slice(3).toLowerCase()); }
    const nb = await kbBase(page);
    if (nb === base) throw new Error(`cannot reach ${m} from base ${base}`);
    base = nb;
  }
  const code = CODES[m - base];
  if (method === 'us') return page.keyboard.press(code);
  const key = ES_KEYS[code] ?? code.slice(3).toLowerCase();
  await synthKey(page, 'keydown', code, key);
  await synthKey(page, 'keyup', code, key);
}

/** Answer a whole session. mistakes: number of deliberate wrong answers to inject. */
async function runLesson(page, { method = 'click', mistakes = 0, maxSteps = 200, shotPrefix = null, enterToContinue = false } = {}) {
  let made = 0, sawRetry = false, sawIntro = false, answered = 0, qShot = false;
  for (let i = 0; i < maxSteps; i++) {
    if (await page.$('.results-screen')) break;
    const c = await card(page);
    if (!c) { await page.waitForTimeout(150); continue; }
    if (c.phase === 'correct') { await page.waitForTimeout(150); continue; }
    if (c.phase === 'wrong') {
      if (shotPrefix && made === 1 && !(await page.$('.shot-wrong-done'))) { await page.waitForTimeout(450); await page.screenshot({ path: `${SHOTS}/${shotPrefix}-wrong.png` }); await page.evaluate(() => document.body.classList.add('shot-wrong-done')); }
      if (enterToContinue) await page.keyboard.press('Enter'); else await page.click('.feedback .btn.danger');
      await page.waitForTimeout(200);
      continue;
    }
    const intro = !!(await page.$('.intro-badge'));
    sawIntro ||= intro;
    sawRetry ||= !!(await page.$('.retry-badge'));
    if (shotPrefix && i === 0) await page.screenshot({ path: `${SHOTS}/${shotPrefix}-first.png` });
    if (!intro && made < mistakes) {
      made++;
      const wrong = c.target[0] + (c.target.includes(c.target[0] + 2) ? 1 : 2);
      await play(page, wrong, method);
      await page.waitForTimeout(150);
      continue;
    }
    if (shotPrefix && !intro && !qShot) { qShot = true; await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/${shotPrefix}-question.png` }); }
    for (const m of c.target) { await play(page, m, method); await page.waitForTimeout(40); }
    answered++;
    await page.waitForTimeout(120);
  }
  await page.waitForSelector('.results-screen', { timeout: 8000 });
  await page.waitForTimeout(400);
  const acc = Number((await page.textContent('.tile.acc b')).replace(/\D/g, ''));
  const xp = Number((await page.textContent('.tile.xp b')).replace(/\D/g, ''));
  return { acc, xp, sawRetry, sawIntro, answered };
}
const nodeInfo = (page) => page.evaluate(() => [...document.querySelectorAll('.node')].map((n) => ({
  label: n.getAttribute('aria-label'), cls: n.className, count: n.querySelector('.node-count')?.textContent ?? null,
  h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width,
})));
/** Every unit button must be roughly square and < 120px in both directions. */
function assertSquareNodes(info, ctx = '') {
  const bad = info.filter((n) => !(n.w > 50 && n.w < 120 && n.h > 50 && n.h < 120 && Math.abs(n.w - n.h) <= 4));
  assert(info.length > 0 && bad.length === 0, `${ctx} non-square unit buttons: ` + bad.map((n) => `${n.label} ${Math.round(n.w)}x${Math.round(n.h)}`).join(', '));
}
function juanLikeState() {
  const now = Date.now();
  const lessons = {};
  const done = [['t1', 3], ['t2', 2], ['t3', 3], ['t4', 3], ['t5', 3], ['t6', 3], ['t7', 2], ['t-cp', 2], ['b1', 3], ['b2', 1]];
  for (const [u, n] of done) for (let i = 0; i < n; i++) lessons[`sight-reading/${u}/${i}`] = { completions: 1 + (i % 2), bestAccuracy: 0.85, lastCompleted: now - 3600e3 };
  const srs = {};
  for (const n of ['C4', 'G4', 'C5', 'D4', 'E4', 'F4', 'A4', 'B4', 'D5', 'E5', 'F5', 'G5']) srs[`note:treble:${n}`] = { box: 3, due: now, seen: 9, correct: 8, wrong: 1, last: now };
  return { version: 1, xp: 2015, dailyXp: {}, streak: 1, longestStreak: 1, lastActiveDay: null, hearts: 1, heartsUpdatedAt: now, lessons, srs,
    settings: { sound: true, volume: 0, keyLabels: 'c', showShortcuts: true, unlimitedHearts: false, unlockAll: false, lessonLength: 12, dailyGoal: 50, showRoll: true } };
}

// ====================================================================================
// (a) computer keyboard
// ====================================================================================
for (const layout of ['us', 'es', 'azerty', 'nocode']) {
  await test(`keyboard: every mapped key + octave shifts (${layout})`, async (open) => {
    const { page } = await open({ progress: { settings: { unlimitedHearts: true } } });
    await openUnit(page, 'Middle C & Treble G'); // range C4..B5
    const send = async (code) => {
      if (layout === 'us') return page.keyboard.press(code);
      const key = layout === 'es' ? (ES_KEYS[code] ?? code.replace('Key', '').toLowerCase())
        : layout === 'azerty' ? (AZERTY[code] ?? (code === 'KeyZ' ? 'w' : code === 'KeyX' ? 'x' : code))
        : code.replace('Key', '').toLowerCase().replace('semicolon', ';').replace('quote', "'");
      const c = layout === 'nocode' ? '' : code;
      await synthKey(page, 'keydown', c, key); await synthKey(page, 'keyup', c, key);
    };
    for (const [base, maxSemi] of [[60, 17], [72, 11]]) {
      if (base === 72) await send('KeyX');
      assert(await kbBase(page) === base, `base should be ${base}, got ${await kbBase(page)}`);
      for (let i = 0; i <= maxSemi; i++) {
        await clearNotes(page);
        await send(CODES[i]);
        const n = await notes(page);
        assert(n.length === 1 && n[0] === base + i, `${layout} ${CODES[i]} @base ${base}: expected ${base + i}, got ${JSON.stringify(n)}`);
      }
      // keys beyond the range must not register
      for (let i = maxSemi + 1; i < CODES.length; i++) {
        await clearNotes(page); await send(CODES[i]);
        assert((await notes(page)).length === 0, `${CODES[i]} beyond range registered`);
      }
    }
    await send('KeyX'); assert(await kbBase(page) === 72, 'X clamps at top');
    await send('KeyZ'); await send('KeyZ'); assert(await kbBase(page) === 60, 'Z clamps at bottom');
  });
}

await test('keyboard: Shift/CapsLock letters, key repeat, hold & release, dead-key Quote', async (open) => {
  const { page } = await open({ progress: { settings: { unlimitedHearts: true } } });
  await openUnit(page, 'Middle C & Treble G');
  await clearNotes(page);
  await synthKey(page, 'keydown', 'KeyG', 'G', { shiftKey: true }); await synthKey(page, 'keyup', 'KeyG', 'G');
  await synthKey(page, 'keydown', 'KeyK', 'K'); // caps lock
  await synthKey(page, 'keydown', 'KeyK', 'K', { repeat: true });
  await synthKey(page, 'keydown', 'KeyK', 'K'); // still held, no keyup → ignored
  await synthKey(page, 'keyup', 'KeyK', 'K');
  await synthKey(page, 'keydown', 'KeyK', 'k'); await synthKey(page, 'keyup', 'KeyK', 'k');
  await synthKey(page, 'keydown', 'Quote', 'Dead'); await synthKey(page, 'keyup', 'Quote', '´');
  await synthKey(page, 'keydown', 'Semicolon', 'Ñ', { shiftKey: true }); await synthKey(page, 'keyup', 'Semicolon', 'ñ');
  // keys arriving mid dead-key/IME composition (key = "Process"/"Unidentified"/"´g") must still map by physical code
  for (const k of ['Process', 'Unidentified', '´g']) {
    await synthKey(page, 'keydown', 'KeyG', k, { isComposing: true }); await synthKey(page, 'keyup', 'KeyG', k);
    await synthKey(page, 'keydown', 'KeyK', k); await synthKey(page, 'keyup', 'KeyK', k);
  }
  const n = await notes(page);
  assert(JSON.stringify(n) === JSON.stringify([67, 72, 72, 77, 76, 67, 72, 67, 72, 67, 72]), 'got ' + JSON.stringify(n));
  // Ctrl/Cmd combos must be left alone
  await clearNotes(page);
  await synthKey(page, 'keydown', 'KeyG', 'g', { ctrlKey: true });
  assert((await notes(page)).length === 0, 'ctrl+G should not play');
  // a focused button must not swallow keys (focus Continue/quit button and press G)
  await page.focus('.lesson-top .icon-btn');
  await clearNotes(page);
  await page.keyboard.press('KeyG');
  assert((await notes(page))[0] === 67, 'G with focused button');
});

for (const layout of ['us', 'es']) {
  await test(`keyboard-only full lesson incl. G and K (${layout} layout)`, async (open) => {
    const { page } = await open({ progress: { settings: { unlockAll: true } } });
    await openUnit(page, 'Middle C & Treble G');
    const r = await runLesson(page, { method: layout, mistakes: 1, enterToContinue: true });
    assert(r.acc > 0 && r.acc < 100, 'accuracy should reflect 1 mistake: ' + r.acc);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.home');
    // second unit uses K (C5)
    await openUnit(page, 'Treble C');
    const r2 = await runLesson(page, { method: layout });
    assert(r2.acc === 100, 'Treble C lesson accuracy ' + r2.acc);
  });
}

await test('Enter on focused Continue advances exactly once', async (open) => {
  const { page } = await open({ progress: { settings: { unlimitedHearts: true, lessonLength: 6 } } });
  await openUnit(page, 'Middle C & Treble G');
  // answer intro(s) until a normal question, then miss it
  for (let i = 0; i < 20; i++) {
    const c = await card(page);
    if (c?.phase === 'question' && !(await page.$('.intro-badge'))) break;
    if (c?.phase === 'question') for (const m of c.target) await play(page, m, 'click');
    await page.waitForTimeout(1200);
  }
  const before = await page.evaluate(() => document.querySelector('.progress .bar').style.width);
  const c = await card(page);
  await play(page, c.target[0] + 2, 'click');
  await page.waitForSelector('.staff-card.phase-wrong');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const c2 = await card(page);
  assert(c2.phase === 'question', 'should be at next question, got ' + c2.phase);
  const after = await page.evaluate(() => document.querySelector('.progress .bar').style.width);
  assert(before === after, 'progress should not move on a miss');
});

// ====================================================================================
// (b) on-screen keys  (c) MIDI
// ====================================================================================
for (const [dev, method] of [[DESKTOP, 'click'], [PHONE, 'tap']]) {
  await test(`on-screen: every key ${method === 'tap' ? 'tapped (phone)' : 'clicked (desktop)'} registers + sounds`, async (open) => {
    const { page } = await open({ device: dev, progress: { settings: { unlimitedHearts: true, unlockAll: true } } });
    for (const unit of ['Middle C & Treble G', 'Deep bass']) {
      await page.goto(URL, { waitUntil: 'networkidle' });
      await openUnit(page, unit);
      await page.waitForFunction(() => window.__keysreaderAudio?.loaded, null, { timeout: 15000 }).catch(() => {});
      const keys = await page.$$eval('[data-midi]', (els) => els.map((e) => Number(e.dataset.midi)));
      assert(keys.length >= 24, 'keyboard has ' + keys.length + ' keys');
      // first gesture unlocks audio; make sure it is loaded
      await play(page, keys[0], method);
      await page.waitForFunction(() => window.__keysreaderAudio?.loaded, null, { timeout: 15000 });
      await clearNotes(page);
      const t0 = await page.evaluate(() => window.__keysreaderAudio.triggered);
      for (const m of keys) {
        await page.$eval(`[data-midi="${m}"]`, (el) => el.scrollIntoView({ block: 'nearest', inline: 'center' }));
        await play(page, m, method);
      }
      const n = await notes(page);
      const t1 = await page.evaluate(() => window.__keysreaderAudio.triggered);
      assert(JSON.stringify(n) === JSON.stringify(keys), `registered ${n.length}/${keys.length}; missing ${keys.filter((k) => !n.includes(k))}`);
      assert(t1 - t0 === keys.length, `sound triggered ${t1 - t0}/${keys.length}`);
    }
  });
}

await test('MIDI: device indicator, all 88 notes register + sound, hot-plug', async (open) => {
  const { page } = await open({ midiLater: true, progress: { settings: { unlimitedHearts: true } } });
  assert((await page.textContent('.top-stats .midi-pill')).includes('No MIDI'), 'should start with no device');
  await page.evaluate(() => window.__plug());
  await page.waitForFunction(() => document.querySelector('.input-card .midi-pill')?.textContent.includes('Fake Digital Piano'));
  await page.screenshot({ path: `${SHOTS}/home-midi-connected.png` });
  await openUnit(page, 'Middle C & Treble G');
  await page.click('.lesson-sub'); // user gesture → audio
  await page.waitForFunction(() => window.__keysreaderAudio?.loaded, null, { timeout: 15000 });
  await clearNotes(page);
  const t0 = await page.evaluate(() => window.__keysreaderAudio.triggered);
  for (let m = 21; m <= 108; m++) await page.evaluate((m) => { window.__midi(m, true); window.__midi(m, false); }, m);
  const n = await notes(page);
  assert(n.length === 88 && n[0] === 21 && n[87] === 108, 'midi notes registered ' + n.length);
  assert((await page.evaluate(() => window.__keysreaderAudio.triggered)) - t0 === 88, 'midi sound count');
  // velocity 0 note-on = note-off must not register
  await clearNotes(page);
  await page.evaluate(() => window.__midi(60, true, 0));
  assert((await notes(page)).length === 0, 'vel-0 note on registered');
  assert((await page.textContent('.lesson-sub .midi-pill')).includes('MIDI'), 'lesson indicator');
});

await test('MIDI: full lesson + chords played simultaneously + melodies', async (open) => {
  const { page } = await open({ midi: true, progress: { settings: { unlockAll: true, lessonLength: 6 } } });
  await openUnit(page, 'Middle C & Treble G');
  let r = await runLesson(page, { method: 'midi', mistakes: 1 });
  assert(r.acc < 100, 'mistake counted');
  for (const unit of ['Major triads: C, F, G', 'Chords with sharps & flats', '3rds', 'Five-finger melodies']) {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await openUnit(page, unit);
    if (unit.startsWith('Major')) await page.screenshot({ path: `${SHOTS}/chord-intro.png` });
    r = await runLesson(page, { method: 'midi' });
    assert(r.acc === 100, `${unit} acc ${r.acc}`);
  }
});

// ====================================================================================
// (d) lessons, hearts, home path states, checkpoint, practice, settings, persistence
// ====================================================================================
for (const dev of ['desktop', 'phone', 'webkit-iphone']) {
  await test(`lessons + home path states after 0/1/2/3 lessons (${dev})`, async (open) => {
    const { page } = await open({ device: dev === 'phone' ? PHONE : dev === 'webkit-iphone' ? IPHONE : DESKTOP, engine: dev.startsWith('webkit') ? 'webkit' : 'chromium' });
    const method = dev === 'desktop' ? 'click' : 'tap';
    assertSquareNodes(await nodeInfo(page), 'fresh');
    let info = await nodeInfo(page);
    assert(info[0].cls.includes('node--current') && !info[0].cls.includes('locked'), 'unit1 current at start');
    assert(info[1].cls.includes('node--locked'), 'unit2 locked at start');
    await page.screenshot({ path: `${SHOTS}/home-0-lessons-${dev}.png` });
    for (let l = 1; l <= 3; l++) {
      await openUnit(page, 'Middle C & Treble G');
      const r = await runLesson(page, { method, mistakes: l === 2 ? 2 : 0, shotPrefix: l === 1 ? `lesson-${dev}` : l === 2 ? `lesson-${dev}-mistakes` : null });
      if (l === 1) { assert(r.sawIntro, 'intro shown'); await page.screenshot({ path: `${SHOTS}/results-${dev}.png` }); }
      if (l === 2) assert(r.sawRetry && r.acc < 100, 'retry & accuracy on mistakes');
      else assert(r.acc === 100, 'perfect lesson acc ' + r.acc);
      await page.click('.results-screen .btn.primary');
      await page.waitForSelector('.home');
      await page.waitForTimeout(300);
      info = await nodeInfo(page);
      assertSquareNodes(info, `after ${l} lessons`);
      assert(info[0].count === `${l}/3`, `count ${info[0].count} after ${l}`);
      if (l < 3) assert(info[0].cls.includes('node--partial') && info[0].cls.includes('node--current'), `partial after ${l}: ${info[0].cls}`);
      else {
        assert(info[0].cls.includes('node--complete'), 'complete after 3');
        assert(info[1].cls.includes('node--current') && !info[1].cls.includes('locked'), 'unit2 unlocked + current');
      }
      await page.screenshot({ path: `${SHOTS}/home-${l}-lessons-${dev}.png` });
    }
    // replay a completed unit
    await page.click('.node[aria-label="Middle C & Treble G"]');
    assert((await page.textContent('.node-pop')).includes('Replay'), 'replay offered');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/home-completed-popup-${dev}.png` });
    // persistence across reload
    const xp = await page.textContent('.stat.xp');
    await page.reload({ waitUntil: 'networkidle' });
    assert((await page.textContent('.stat.xp')) === xp, 'xp persisted');
    assert((await nodeInfo(page))[0].cls.includes('node--complete'), 'completion persisted');
    assert((await page.textContent('.stat.streak')).includes('1'), 'streak 1');
  });
}

await test('hearts run out → out-of-hearts screen → practice', async (open) => {
  const { page } = await open({ progress: { hearts: 1, heartsUpdatedAt: Date.now() } });
  await openUnit(page, 'Middle C & Treble G');
  for (let i = 0; i < 30; i++) {
    const c = await card(page);
    if (c?.phase === 'wrong') break;
    if (c?.phase === 'question') {
      if (await page.$('.intro-badge')) { for (const m of c.target) await play(page, m, 'click'); await page.waitForTimeout(1300); }
      else await play(page, c.target[0] + 2, 'click');
    }
    await page.waitForTimeout(200);
  }
  assert((await page.textContent('.lesson-hearts')).includes('0'), 'hearts 0');
  await page.click('.feedback .btn.danger');
  await page.waitForSelector('text=Out of hearts');
  await page.screenshot({ path: `${SHOTS}/out-of-hearts.png` });
  await page.click('text=Practice to earn hearts');
  await page.waitForSelector('.staff-card');
  assert(await page.$('text=Finish'), 'practice mode');
});

await test('checkpoint lesson completes', async (open) => {
  const { page } = await open({ progress: { settings: { unlockAll: true, lessonLength: 10 } } });
  await openUnit(page, 'Treble Checkpoint');
  const r = await runLesson(page, { method: 'click', mistakes: 1 });
  assert(r.answered >= 9, 'answered ' + r.answered);
  await page.click('.results-screen .btn.primary');
  const info = await nodeInfo(page);
  const cp = info.find((n) => n.label === 'Treble Checkpoint');
  assert(cp.count === '1/2' && cp.cls.includes('node--checkpoint'), 'checkpoint state ' + JSON.stringify(cp));
  await page.$eval('.node[aria-label="Treble Checkpoint"]', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/home-checkpoint-progress.png` });
});

await test('practice mode: endless, earns hearts, finish → results', async (open) => {
  const { page } = await open({ progress: { hearts: 3, heartsUpdatedAt: Date.now() } });
  await page.click('text=Practice (endless)');
  let answered = 0;
  for (let i = 0; i < 150 && answered < 21; i++) {
    const c = await card(page);
    if (c?.phase === 'question') { for (const m of c.target) await play(page, m, 'us'); answered++; }
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: `${SHOTS}/practice.png` });
  await page.click('text=Finish');
  await page.waitForSelector('.results-screen');
  await page.click('.results-screen .btn.primary');
  assert((await page.textContent('.stat.stat-hearts')).includes('5'), 'hearts regained: ' + (await page.textContent('.stat.stat-hearts')));
});

await test('settings toggles apply and persist', async (open) => {
  const { page } = await open({});
  await page.click('[aria-label="Settings"]');
  await page.screenshot({ path: `${SHOTS}/settings.png` });
  await page.selectOption('.modal select >> nth=0', '6'); // lesson length
  await page.selectOption('.modal select >> nth=2', 'all'); // key labels
  const toggle = (label) => page.click(`.modal label.row:has-text("${label}") .switch`);
  await toggle('Computer-keyboard letters');
  await toggle('Piano roll');
  await toggle('Unlimited hearts');
  await toggle('Unlock all lessons');
  await page.click('.modal [aria-label="Close"]');
  await page.reload({ waitUntil: 'networkidle' });
  assert((await page.textContent('.stat.stat-hearts')).includes('∞'), 'unlimited hearts shown');
  const locked = await page.$$('.node--locked');
  assert(locked.length === 0, 'unlock all');
  await openUnit(page, 'Middle C & Treble G');
  assert((await page.$$('.shortcut')).length === 0, 'shortcut letters hidden');
  assert(!(await page.$('canvas.roll')), 'roll hidden');
  assert((await page.$$('.kname')).length === 14, 'all white keys labelled: ' + (await page.$$('.kname')).length);
  await page.screenshot({ path: `${SHOTS}/lesson-settings-applied.png` });
  const r = await runLesson(page, { method: 'click' });
  assert(r.answered === 6, 'lesson length 6 respected: ' + r.answered);
});


// ====================================================================================
// (g) WebKit / iOS Safari + existing-user data + deploy updates
// ====================================================================================
for (const [label, engine, device] of [['webkit-iphone', 'webkit', IPHONE], ['chromium-phone', 'chromium', PHONE], ['chromium-desktop', 'chromium', DESKTOP]]) {
  await test(`existing user (2015 XP, many completed units) home path renders (${label})`, async (open) => {
    const state = juanLikeState();
    const { page } = await open({ engine, device, progress: state });
    const info = await nodeInfo(page);
    assertSquareNodes(info, label);
    const complete = info.filter((n) => n.cls.includes('node--complete'));
    assert(complete.length === 9, 'completed units: ' + complete.length);
    assert(info.find((n) => n.label === 'Bass C').cls.includes('node--current'), 'Bass C current');
    assert((await page.textContent('.stat.xp')).includes('2015'), 'xp kept');
    assert((await page.textContent('.stat.stat-hearts')).includes('1'), 'hearts kept');
    // the stored progress must be untouched by loading the new build
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('pianoTrainer.progress.v1')));
    assert(stored.xp === 2015 && Object.keys(stored.lessons).length === Object.keys(state.lessons).length, 'progress preserved');
    await page.$eval('.node[aria-label="Treble C"]', (el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/home-completed-units-${label}.png` });
    // the replay popup of a completed unit
    await page.click('.node[aria-label="Around the G line"]');
    await page.waitForTimeout(500);
    assert((await page.textContent('.node-pop')).includes('Replay'), 'replay');
    await page.screenshot({ path: `${SHOTS}/home-completed-popup-${label}.png` });
  });
}

await test('webkit-iphone: lesson with mistakes → results screen', async (open) => {
  const { page } = await open({ engine: 'webkit', device: IPHONE, progress: { settings: { unlockAll: true } } });
  await openUnit(page, 'Major triads: C, F, G');
  const r = await runLesson(page, { method: 'tap', mistakes: 1, shotPrefix: 'webkit-iphone-chords' });
  assert(r.acc < 100 && r.sawRetry, 'acc/retry');
  const box = await page.$eval('.results-screen .complete-card', (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  assert(box.w <= 390 && box.h < 800, 'results card size ' + JSON.stringify(box));
  await page.screenshot({ path: `${SHOTS}/results-webkit-iphone.png` });
  await page.click('.results-screen .btn.primary');
  assertSquareNodes(await nodeInfo(page), 'after results');
});

await test('webkit: every mapped key incl. Spanish Ñ/´ registers', async (open) => {
  const { page } = await open({ engine: 'webkit', progress: { settings: { unlimitedHearts: true } } });
  await openUnit(page, 'Middle C & Treble G');
  for (let i = 0; i < CODES.length; i++) {
    await clearNotes(page);
    const key = ES_KEYS[CODES[i]] ?? CODES[i].slice(3).toLowerCase();
    await synthKey(page, 'keydown', CODES[i], key); await synthKey(page, 'keyup', CODES[i], key);
    assert((await notes(page))[0] === 60 + i, `${CODES[i]} → ${JSON.stringify(await notes(page))}`);
  }
});

await test('new deploy detected → reloads on home, keeps progress; never interrupts a lesson', async (open) => {
  const { page } = await open({ progress: juanLikeState() });
  // pretend a newer build was deployed
  await page.route('**/version.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ build: 'newer-build-xyz' }) }));
  // in a lesson: must NOT reload, only show the banner
  await openUnit(page, 'Bass C');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForSelector('.update-pill', { timeout: 5000 });
  assert(!page.url().includes('v=newer-build-xyz'), 'reloaded mid-lesson');
  // back home → reload into the new build
  await page.click('[aria-label="Quit"]');
  await page.waitForURL(/v=newer-build-xyz/, { timeout: 8000 });
  await page.waitForSelector('.home');
  assert((await page.textContent('.stat.xp')).includes('2015'), 'xp survived reload');
  // loop guard: same build again must not reload a second time
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1500);
  assert(await page.$('.home'), 'still on home, no loop');
});

await test('served build is current (version.json matches running bundle)', async (open) => {
  const { page } = await open({});
  const v = await page.evaluate(async () => (await (await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })).json()).build);
  const bundle = await page.evaluate(async () => { const src = document.querySelector('script[type=module]').src; return (await (await fetch(src, { cache: 'no-store' })).text()); });
  assert(v && bundle.includes(v), `version.json build ${v} not in running bundle`);
});

// ====================================================================================
console.log('\n==== SUMMARY ====');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? ` (${(r.ms / 1000).toFixed(1)}s)` : ' — ' + r.err}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
await browser.close();
if (wk) await wk.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
