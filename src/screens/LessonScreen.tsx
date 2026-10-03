import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findUnit, getCourse } from '../courses';
import type { Exercise, LessonRef } from '../courses/types';
import { lessonKey } from '../courses/types';
import { midiOf, type Clef, type Pitch } from '../music/notes';
import { Staff, type Mark, type StaffNote } from '../components/Staff';
import { PianoPanel } from '../components/PianoPanel';
import { RollStore } from '../components/PianoRoll';
import type { KeyMark } from '../components/Keyboard';
import { chime, playNotes } from '../audio/piano';
import {
  addXp, completeLesson, gainHeart, getProgress, gradeItem, heartsNow, loseHeart, touchStreak, useProgress,
} from '../state/progress';
import {
  buildLesson, easiestItem, mkSlot, needsIntro, nextPractice, practicePool, rangeFor, type Slot,
} from '../lesson/session';
import { Confetti } from '../components/Confetti';
import { MidiStatus } from '../components/MidiStatus';

export type SessionSpec =
  | { mode: 'lesson'; ref: LessonRef }
  | { mode: 'practice'; courseId: string; sectionId?: string; title: string };

type Phase = 'question' | 'correct' | 'wrong' | 'done' | 'noHearts';

const PRAISE = ['Nice!', 'Great!', 'Correct!', 'Excellent!', 'Well read!', 'Spot on!', 'Yes!'];
const PROMPT: Record<Exercise['kind'], string> = {
  note: 'Play this note',
  interval: 'Play both notes',
  chord: 'Play the whole chord',
  melody: 'Play the melody, left to right',
};

function spellMidi(m: number, preferFlats: boolean): Pitch {
  const sharp: [Pitch['step'], -1 | 0 | 1][] = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const flat: [Pitch['step'], -1 | 0 | 1][] = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  const [step, alter] = (preferFlats ? flat : sharp)[m % 12];
  return { step, alter, octave: Math.floor(m / 12) - 1 };
}

export function LessonScreen({ spec, onExit, onPractice }: { spec: SessionSpec; onExit: () => void; onPractice: () => void }) {
  const progress = useProgress();
  const course = getCourse(spec.mode === 'lesson' ? spec.ref.courseId : spec.courseId);
  const isPractice = spec.mode === 'practice';

  // ---- build the session once ----
  const init = useMemo(() => {
    const p = getProgress();
    if (spec.mode === 'lesson') {
      const loc = findUnit(course, spec.ref.unitId);
      const slots = buildLesson(course, loc, spec.ref, p);
      const pool = [...new Map(slots.map((s) => [s.ex.id, s.ex])).values()];
      return { slots, pool, title: `${loc.unit.title} · Lesson ${spec.ref.lessonIndex + 1}/${loc.unit.lessons}`, color: loc.section.color };
    }
    const pool = practicePool(course, p, spec.sectionId);
    const first = nextPractice(pool, p);
    const second = nextPractice(pool, p, first.id);
    return { slots: [mkSlot(first, needsIntro(p, first)), mkSlot(second, false)], pool, title: spec.title, color: '#ce82ff' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [queue, setQueue] = useState<Slot[]>(init.slots);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [got, setGot] = useState<number[]>([]);
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [stats, setStats] = useState({ correct: 0, firstTry: 0, answered: 0, xp: 0, combo: 0, bestCombo: 0, misses: 0 });
  const [praise, setPraise] = useState('');
  const [startTime] = useState(() => Date.now());
  const [streakExtended, setStreakExtended] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const missed = useRef(new Set<number>()); // slot uids already missed
  const missedIds = useRef(new Set<string>());
  const consecutiveMiss = useRef(0);
  const qStart = useRef(Date.now());
  const roll = useMemo(() => new RollStore(), []);
  const planned = useMemo(() => init.slots.length, [init]);
  const [lo, hi] = useMemo(() => rangeFor(init.pool), [init]);

  const slot = queue[idx];
  const ex = slot?.ex;
  const target = useMemo(() => (ex ? ex.notes.map(midiOf) : []), [ex]);
  const isIntro = !!slot?.intro;

  // reset per question
  useEffect(() => {
    setGot([]);
    setWrongMidi(null);
    qStart.current = Date.now();
    roll.lanes = slot?.intro ? target.map((m) => ({ midi: m, kind: 'hint' as const })) : [];
  }, [slot?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    const accuracy = stats.answered ? stats.firstTry / stats.answered : 1;
    if (spec.mode === 'lesson') {
      const bonus = 10 + (stats.misses === 0 ? 5 : 0);
      addXp(stats.xp + bonus);
      setStats((s) => ({ ...s, xp: s.xp + bonus }));
      completeLesson(lessonKey(spec.ref), accuracy);
    } else {
      addXp(stats.xp);
    }
    if (stats.correct > 0) setStreakExtended(touchStreak());
    chime('complete');
    setPhase('done');
  }, [spec, stats]);

  const advance = useCallback(() => {
    if (phase === 'noHearts' || phase === 'done') return;
    if (phase === 'question') return;
    const p = getProgress();
    if (phase === 'wrong' && !isPractice && !p.settings.unlimitedHearts && heartsNow(p).hearts <= 0) {
      setPhase('noHearts');
      return;
    }
    let q = queue;
    if (isPractice && idx + 2 >= q.length) {
      const n = nextPractice(init.pool, p, q[q.length - 1]?.ex.id);
      q = [...q, mkSlot(n, needsIntro(p, n) && !q.some((s) => s.ex.id === n.id))];
      setQueue(q);
    }
    if (idx + 1 >= q.length) { finish(); return; }
    setIdx(idx + 1);
    setPhase('question');
    roll.lanes = [];
  }, [phase, queue, idx, isPractice, init.pool, finish, roll]);

  // auto-advance after a correct answer
  useEffect(() => {
    if (phase !== 'correct') return;
    const t = setTimeout(advance, isIntro ? 1100 : 850);
    return () => clearTimeout(t);
  }, [phase, advance, isIntro]);

  const onCorrect = () => {
    const ms = Date.now() - qStart.current;
    const wasMissed = missed.current.has(slot.uid) || missedIds.current.has(ex.id);
    gradeItem(ex.id, wasMissed ? 'recovered' : !slot.intro && ms < 2500 && ex.kind === 'note' ? 'easy' : 'good', ms);
    consecutiveMiss.current = 0;
    const gain = slot.intro || wasMissed ? 5 : 10;
    setStats((s) => {
      const combo = s.combo + 1;
      return {
        ...s, correct: s.correct + 1, xp: s.xp + gain + (combo % 5 === 0 ? 5 : 0), combo, bestCombo: Math.max(s.bestCombo, combo),
        answered: s.answered + (slot.retry || missed.current.has(slot.uid) ? 0 : 1), firstTry: s.firstTry + (slot.retry || missed.current.has(slot.uid) ? 0 : 1),
      };
    });
    if (isPractice && (stats.correct + 1) % 10 === 0 && heartsNow(getProgress()).hearts < 5) {
      gainHeart();
      setToast('❤️ +1 heart for practicing!');
      setTimeout(() => setToast(null), 2200);
    }
    const combo = stats.combo + 1;
    setPraise(combo >= 3 && combo % 5 === 0 ? `🔥 ${combo} in a row!` : PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    target.forEach((m) => roll.mark(m, 'correct'));
    if (ex.kind !== 'note') playNotes(target, { arpeggio: ex.kind === 'melody' ? 0.28 : 0, delay: 0.35 });
    chime('correct');
    setPhase('correct');
  };

  const onWrong = (m: number) => {
    setWrongMidi(m);
    roll.mark(m, 'wrong');
    roll.lanes = target.map((t) => ({ midi: t, kind: 'target' as const }));
    if (!missed.current.has(slot.uid)) {
      missed.current.add(slot.uid);
      missedIds.current.add(ex.id);
      gradeItem(ex.id, 'again');
      if (!isPractice) loseHeart();
      setStats((s) => ({ ...s, misses: s.misses + 1, combo: 0, answered: s.answered + (slot.retry ? 0 : 1) }));
    }
    consecutiveMiss.current++;
    // re-ask the item later in this session (adaptive), plus a confidence booster after repeated misses
    setQueue((q) => {
      const nq = [...q];
      const insertAt = Math.min(nq.length, idx + 3);
      nq.splice(insertAt, 0, mkSlot(ex, false, true));
      if (consecutiveMiss.current >= 2) {
        const easy = easiestItem(init.pool, getProgress(), ex.id);
        if (easy) nq.splice(idx + 1, 0, mkSlot(easy));
        consecutiveMiss.current = 0;
      }
      return nq;
    });
    chime('wrong');
    playNotes(target, { arpeggio: ex.kind === 'melody' ? 0.3 : 0, delay: 0.45 });
    roll.demo(target, ex.kind === 'melody' ? 300 : 0, 600);
    setPhase('wrong');
  };

  const handleNote = (m: number) => {
    if (phase !== 'question' || !ex) return;
    let ok = false, complete = false;
    if (ex.kind === 'melody') {
      ok = target[got.length] === m;
      complete = ok && got.length + 1 === target.length;
    } else {
      if (got.includes(m)) return;
      ok = target.includes(m);
      complete = ok && new Set([...got, m]).size === new Set(target).size;
    }
    if (ok) {
      roll.mark(m, 'correct');
      setGot((g) => [...g, m]);
      if (complete) onCorrect();
    } else if (slot.intro) {
      // during an intro, a wrong key just flashes — no penalty
      roll.mark(m, 'wrong');
      setFlash(m);
      setTimeout(() => setFlash(null), 400);
    } else onWrong(m);
  };

  // ---------- derived view ----------
  const hearts = heartsNow(progress).hearts;
  const preferFlats = (ex?.fifths ?? 0) < 0 || ex?.notes.some((n) => n.alter === -1);
  const staffNotes: StaffNote[] = (ex?.notes ?? []).map((pt, i) => {
    const m = target[i];
    let mark: Mark = 'normal';
    if (phase === 'correct' || phase === 'wrong') mark = 'correct';
    else if (isIntro) mark = 'hint';
    else if (ex.kind === 'melody') mark = i < got.length ? 'done' : i === got.length && ex.notes.length > 1 ? 'active' : 'normal';
    else if (got.includes(m)) mark = 'done';
    return { pitch: pt, staff: ex.staves?.[i], mark };
  });
  const ghostStaff: Clef | undefined = ex?.staves?.[0] ?? (ex?.clef === 'grand' ? undefined : (ex?.clef as Clef));
  const ghosts: StaffNote[] = phase === 'wrong' && wrongMidi !== null ? [{ pitch: spellMidi(wrongMidi, !!preferFlats), staff: ghostStaff }] : [];

  const marks: Record<number, KeyMark> = {};
  if (ex) {
    if (isIntro && phase === 'question') {
      if (ex.kind === 'melody') { if (target[got.length] !== undefined) marks[target[got.length]] = 'hint'; }
      else target.forEach((m) => (marks[m] = 'hint'));
    }
    got.forEach((m) => (marks[m] = 'correct'));
    if (phase === 'correct') target.forEach((m) => (marks[m] = 'correct'));
    if (phase === 'wrong') { target.forEach((m) => (marks[m] = 'target')); if (wrongMidi !== null) marks[wrongMidi] = 'wrong'; }
    if (flash !== null && !marks[flash]) marks[flash] = 'wrong';
  }
  const pct = isPractice ? Math.min(100, (stats.correct % 10) * 10) : Math.min(100, (stats.correct / Math.max(1, planned + 0)) * 100);
  const octaveSlip = phase === 'wrong' && wrongMidi !== null && ex?.kind === 'note' && wrongMidi % 12 === target[0] % 12;
  const center = Math.round((lo + hi) / 2);

  // ---------- screens ----------
  if (phase === 'done') {
    const acc = stats.answered ? Math.round((stats.firstTry / stats.answered) * 100) : 100;
    const secs = Math.round((Date.now() - startTime) / 1000);
    return (
      <div className="results-screen">
        <Confetti />
        <div className="complete-card pop">
          <div className="big-emoji">{acc >= 90 ? '🏆' : acc >= 70 ? '🎉' : '💪'}</div>
          <h1>{isPractice ? 'Practice complete!' : 'Lesson complete!'}</h1>
          <p className="muted">{acc >= 90 ? 'Outstanding reading!' : acc >= 70 ? 'Great work — it’s sticking.' : 'Every mistake is a rep. Missed items will come back soon.'}</p>
          <div className="tiles">
            <div className="tile xp"><span>Total XP</span><b>⚡ {stats.xp}</b></div>
            <div className="tile acc"><span>Accuracy</span><b>🎯 {acc}%</b></div>
            <div className="tile time"><span>Time</span><b>⏱ {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</b></div>
            <div className="tile combo"><span>Best combo</span><b>🔥 {stats.bestCombo}</b></div>
          </div>
          {streakExtended && <div className="streak-banner">🔥 Streak extended: {getProgress().streak} day{getProgress().streak === 1 ? '' : 's'}!</div>}
          <button className="btn primary wide" autoFocus onClick={onExit}>Continue</button>
        </div>
      </div>
    );
  }
  if (phase === 'noHearts') {
    return (
      <div className="results-screen">
        <div className="complete-card pop">
          <div className="big-emoji">💔</div>
          <h1>Out of hearts</h1>
          <p className="muted">Hearts refill one every 20 minutes — or earn them back in Practice (no hearts lost there).</p>
          <button className="btn primary wide" onClick={onPractice}>Practice to earn hearts</button>
          <button className="btn ghost wide" onClick={onExit}>Quit lesson</button>
        </div>
      </div>
    );
  }
  if (!ex) return null;

  return (
    <div className="lesson" style={{ ['--accent' as string]: init.color }}>
      <header className="lesson-top">
        <button className="icon-btn" aria-label="Quit" onClick={() => { if (isPractice && stats.correct) finish(); else onExit(); }}>✕</button>
        <div className="progress"><div className="bar" style={{ width: `${pct}%` }} /></div>
        {isPractice ? (
          <button className="btn small" onClick={finish}>Finish</button>
        ) : (
          <div className={`lesson-hearts ${progress.settings.unlimitedHearts ? 'inf' : ''}`}>❤️ {progress.settings.unlimitedHearts ? '∞' : hearts}</div>
        )}
      </header>
      <div className="lesson-sub">
        <span>{init.title}</span>
        <MidiStatus compact />
        {stats.combo >= 3 && <span className="combo-pill">🔥 {stats.combo}</span>}
        {isPractice && <span className="muted">⚡ {stats.xp} XP · {stats.correct} correct</span>}
      </div>

      <div className="stage">
      <main className="question">
        {isIntro ? (
          <div className="intro-badge">✨ New {ex.kind === 'note' ? 'note' : ex.kind}: <b>{ex.label}</b></div>
        ) : slot.retry ? (
          <div className="retry-badge">↺ Let’s try this one again</div>
        ) : null}
        <h2>{PROMPT[ex.kind]}</h2>
        <div className={`staff-card phase-${phase}`} key={slot.uid} data-target={target.join(",")} data-kind={ex.kind}>
          <Staff clef={ex.clef} fifths={ex.fifths} notes={staffNotes} layout={ex.kind === 'melody' ? 'sequence' : 'chord'} ghosts={ghosts} activeIndex={got.length} />
        </div>
        {isIntro && ex.hint && <p className="hint">💡 {ex.hint}</p>}
        {!isIntro && (ex.kind === 'chord' || ex.kind === 'interval') && phase === 'question' && (
          <p className="sub-hint">{got.length}/{new Set(target).size} notes · any order, or all at once on MIDI</p>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}

      <div className={`feedback fb-${phase}`}>
        {phase === 'correct' && (
          <div className="fb-inner">
            <div className="fb-text"><b>✓ {praise}</b><span>{ex.label}</span></div>
            <button className="btn primary" onClick={advance}>Continue</button>
          </div>
        )}
        {phase === 'wrong' && (
          <div className="fb-inner">
            <div className="fb-text">
              <b>✗ Correct answer: {ex.label}</b>
              <span>
                {octaveSlip ? 'Right letter — wrong octave. Check the landmarks!' : ex.hint && !isIntro ? ex.hint : 'The correct keys are highlighted. It will come back in a moment.'}
              </span>
            </div>
            <div className="fb-actions">
              <button className="btn ghost small" onClick={() => playNotes(target, { arpeggio: ex.kind === 'melody' ? 0.3 : 0 })}>🔊 Hear it</button>
              <button className="btn danger" autoFocus onClick={advance}>Continue</button>
            </div>
          </div>
        )}
      </div>

      </div>

      <PianoPanel lo={lo} hi={hi} marks={marks} onNote={handleNote} roll={roll} onEnter={advance} center={center} />
    </div>
  );
}
