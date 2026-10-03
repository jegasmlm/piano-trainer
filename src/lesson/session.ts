import { allUnits, itemsUpTo, sectionItems, type UnitLoc } from '../courses';
import type { Course, Exercise, LessonRef } from '../courses/types';
import { lessonKey } from '../courses/types';
import { midiOf } from '../music/notes';
import type { Progress } from '../state/progress';
import { reviewWeight, weightedPick } from '../srs/srs';

export interface Slot {
  ex: Exercise;
  intro: boolean;
  /** this slot is a re-ask of a missed item */
  retry?: boolean;
  uid: number;
}

let uidCounter = 1;
export const mkSlot = (ex: Exercise, intro = false, retry = false): Slot => ({ ex, intro, retry, uid: uidCounter++ });

export function isSeen(p: Progress, id: string) {
  return (p.srs[id]?.seen ?? 0) > 0;
}
export function needsIntro(p: Progress, ex: Exercise) {
  return !!ex.teach && !isSeen(p, ex.id);
}

// ---------- unit progress ----------
export function lessonsDone(p: Progress, course: Course, loc: UnitLoc): number {
  let n = 0;
  for (let i = 0; i < loc.unit.lessons; i++) if (p.lessons[lessonKey({ courseId: course.id, unitId: loc.unit.id, lessonIndex: i })]) n++;
  return n;
}
export function unitComplete(p: Progress, course: Course, loc: UnitLoc) {
  return lessonsDone(p, course, loc) >= loc.unit.lessons;
}
export function unitUnlocked(p: Progress, course: Course, loc: UnitLoc) {
  if (p.settings.unlockAll || loc.flatIndex === 0) return true;
  const prev = allUnits(course)[loc.flatIndex - 1];
  return unitComplete(p, course, prev);
}
export function nextLessonIndex(p: Progress, course: Course, loc: UnitLoc) {
  for (let i = 0; i < loc.unit.lessons; i++)
    if (!p.lessons[lessonKey({ courseId: course.id, unitId: loc.unit.id, lessonIndex: i })]) return i;
  return loc.unit.lessons - 1; // replay the last (most review-heavy) lesson
}

// ---------- lesson building ----------
function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Re-order so that no item appears twice in a row (best effort). */
export function spread(slots: Slot[]): Slot[] {
  const out: Slot[] = [];
  const rest = [...slots];
  while (rest.length) {
    const prev = out[out.length - 1]?.ex.id;
    let idx = rest.findIndex((s) => s.ex.id !== prev);
    if (idx < 0) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}

export function buildLesson(course: Course, loc: UnitLoc, ref: LessonRef, p: Progress): Slot[] {
  const len = p.settings.lessonLength;
  const now = Date.now();
  const isCp = loc.unit.type === 'checkpoint';
  const newItems = isCp ? [] : loc.unit.items;
  let pool: Exercise[] = isCp
    ? sectionItems(loc.section)
    : itemsUpTo(course, loc.flatIndex - 1).filter((e) => isSeen(p, e.id));
  if (isCp && pool.length === 0) pool = sectionItems(loc.section);

  const share = [0.6, 0.45, 0.35, 0.3][ref.lessonIndex] ?? 0.3;
  let nNew = pool.length === 0 ? len : Math.round(len * share);
  nNew = Math.max(nNew, Math.min(newItems.length, Math.round(len * 0.75)));
  if (!newItems.length) nNew = 0;
  const nReview = len - nNew;

  const sameSection = new Set(sectionItems(loc.section).map((e) => e.id));
  const w = (e: Exercise) => reviewWeight(p.srs[e.id], now) * (sameSection.has(e.id) ? 1.6 : 1);

  // New-item slots: each new item at least once, then weighted by weakness.
  const newSlots: Exercise[] = [];
  const order = shuffle(newItems);
  for (let i = 0; i < nNew; i++) {
    newSlots.push(i < order.length ? order[i] : weightedPick(newItems, w)!);
  }
  // Review slots: weighted without immediate repeats; allow repeats when pool is small.
  const reviewSlots: Exercise[] = [];
  const used = new Map<string, number>();
  for (let i = 0; i < nReview && pool.length; i++) {
    const pick = weightedPick(pool, (e) => w(e) / (1 + 2 * (used.get(e.id) ?? 0)))!;
    used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
    reviewSlots.push(pick);
  }

  // Intros first: intro A, (review), A, intro B, (review), B, then the shuffled rest.
  const introItems = newItems.filter((e) => needsIntro(p, e)).slice(0, 3);
  const head: Slot[] = [];
  const restNew = [...newSlots];
  const restReview = [...reviewSlots];
  const take = (arr: Exercise[], id?: string) => {
    const i = id ? arr.findIndex((e) => e.id === id) : 0;
    return i >= 0 && arr.length ? arr.splice(i, 1)[0] : undefined;
  };
  for (const it of introItems) {
    head.push(mkSlot(take(restNew, it.id) ?? it, true)); // the intro uses up one of the item's slots
    const otherNew = restNew.find((e) => e.id !== it.id && !introItems.includes(e));
    const rv = take(restReview) ?? (otherNew ? take(restNew, otherNew.id) : undefined);
    if (rv) head.push(mkSlot(rv));
    const again = take(restNew, it.id);
    if (again) head.push(mkSlot(again));
  }
  // in-checkpoint intros (unlockAll path) for unseen items
  const tail = spread(shuffle([...restNew, ...restReview].map((e) => mkSlot(e, needsIntro(p, e)))));
  // only the first occurrence of an item can be an intro
  const seenIntro = new Set(head.filter((s) => s.intro).map((s) => s.ex.id));
  for (const s of tail) {
    if (s.intro) {
      if (seenIntro.has(s.ex.id)) s.intro = false;
      else seenIntro.add(s.ex.id);
    }
  }
  const all = [...head, ...tail];
  return all.length ? all : [mkSlot(loc.unit.items[0], true)];
}

/** Endless practice: pick the next item from everything seen so far (or a section). */
export function practicePool(course: Course, p: Progress, sectionId?: string): Exercise[] {
  const units = allUnits(course).filter((u) => !sectionId || u.section.id === sectionId);
  const all = units.flatMap((u) => u.unit.items);
  const seen = all.filter((e) => isSeen(p, e.id));
  if (seen.length >= 2) return seen;
  return units[0]?.unit.items ?? [];
}

export function nextPractice(pool: Exercise[], p: Progress, prevId?: string): Exercise {
  const now = Date.now();
  const cands = pool.length > 1 ? pool.filter((e) => e.id !== prevId) : pool;
  return weightedPick(cands, (e) => reviewWeight(p.srs[e.id], now))!;
}

/** Strongest seen item (used as a confidence booster after consecutive misses). */
export function easiestItem(pool: Exercise[], p: Progress, excludeId?: string): Exercise | undefined {
  const c = pool.filter((e) => e.id !== excludeId && isSeen(p, e.id));
  c.sort((a, b) => (p.srs[b.id]?.box ?? 0) - (p.srs[a.id]?.box ?? 0));
  return c[Math.floor(Math.random() * Math.min(3, c.length))];
}

// ---------- keyboard range ----------
export function rangeFor(exs: Exercise[]): [number, number] {
  const ms = exs.flatMap((e) => e.notes.map(midiOf));
  let lo = Math.min(...ms, 60);
  let hi = Math.max(...ms, 60);
  lo = lo - (lo % 12); // C at or below
  hi = hi - (hi % 12) + 11; // B at or above
  while (hi - lo + 1 < 24) {
    if (hi < 83) hi += 12;
    else lo -= 12;
  }
  return [lo, hi];
}
