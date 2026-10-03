// Leitner-style spaced repetition with SM-2-flavoured ease.
export interface SrsState {
  box: number; // 0..MAX_BOX
  due: number; // epoch ms
  seen: number;
  correct: number;
  wrong: number;
  last: number; // epoch ms
  /** average response time (ms), first-try answers only */
  avgMs?: number;
}

export const MAX_BOX = 7;
const MIN = 60_000;
const DAY = 86_400_000;
/** Review interval for each box. */
export const BOX_INTERVALS = [0, 5 * MIN, 30 * MIN, 12 * 60 * MIN, 2 * DAY, 5 * DAY, 12 * DAY, 30 * DAY];

export type Grade = 'good' | 'easy' | 'again' | 'recovered';

export function newSrs(): SrsState {
  return { box: 0, due: 0, seen: 0, correct: 0, wrong: 0, last: 0 };
}

export function grade(s: SrsState | undefined, g: Grade, now = Date.now(), ms?: number): SrsState {
  const st = { ...(s ?? newSrs()) };
  st.seen++;
  st.last = now;
  if (g === 'again') {
    st.wrong++;
    st.box = Math.max(1, Math.floor(st.box / 2));
  } else {
    st.correct++;
    if (g === 'good') st.box = Math.min(MAX_BOX, st.box + 1);
    if (g === 'easy') st.box = Math.min(MAX_BOX, st.box + 2);
    // recovered: correct after a miss in this session → keep box.
    if (ms !== undefined && g !== 'recovered') st.avgMs = st.avgMs ? st.avgMs * 0.7 + ms * 0.3 : ms;
  }
  st.due = now + BOX_INTERVALS[st.box];
  return st;
}

/** 0 (unknown) .. 1 (mastered) */
export function strength(s: SrsState | undefined): number {
  if (!s || !s.seen) return 0;
  return s.box / MAX_BOX;
}

/**
 * Selection weight for review. Weak and overdue items get much more weight,
 * strong not-yet-due items still appear occasionally (interleaving keeps things fresh).
 */
export function reviewWeight(s: SrsState | undefined, now = Date.now()): number {
  if (!s || !s.seen) return 1.5;
  const weakness = (MAX_BOX + 1 - s.box) / (MAX_BOX + 1); // 1/8 .. 1
  const interval = Math.max(BOX_INTERVALS[s.box], MIN);
  const overdue = (now - s.due) / interval; // <0 not due yet
  const dueFactor = overdue >= 0 ? 1 + Math.min(overdue, 4) : Math.max(0.08, 1 + overdue);
  const errFactor = 1 + Math.min(1, s.wrong / Math.max(1, s.seen));
  return weakness * dueFactor * errFactor + 0.02;
}

export function weightedPick<T>(items: T[], weight: (t: T) => number, rnd = Math.random): T | undefined {
  const ws = items.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  if (!items.length || total <= 0) return items[0];
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
