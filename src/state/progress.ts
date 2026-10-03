import { useSyncExternalStore } from 'react';
import { grade, type Grade, type SrsState } from '../srs/srs';

export type KeyLabels = 'none' | 'c' | 'all';
export interface Settings {
  sound: boolean;
  volume: number; // dB offset
  keyLabels: KeyLabels;
  showShortcuts: boolean;
  unlimitedHearts: boolean;
  unlockAll: boolean;
  lessonLength: number; // questions per lesson
  dailyGoal: number; // XP
  showRoll: boolean;
}

export interface LessonRecord {
  completions: number;
  bestAccuracy: number;
  lastCompleted: number;
}

export interface Progress {
  version: 1;
  xp: number;
  dailyXp: Record<string, number>;
  streak: number;
  longestStreak: number;
  lastActiveDay: string | null;
  hearts: number;
  heartsUpdatedAt: number;
  lessons: Record<string, LessonRecord>;
  srs: Record<string, SrsState>;
  settings: Settings;
}

export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 20 * 60_000;
const KEY = 'pianoTrainer.progress.v1';

const defaultSettings: Settings = {
  sound: true,
  volume: 0,
  keyLabels: 'c',
  showShortcuts: true,
  unlimitedHearts: false,
  unlockAll: false,
  lessonLength: 12,
  dailyGoal: 50,
  showRoll: true,
};

function fresh(): Progress {
  return {
    version: 1, xp: 0, dailyXp: {}, streak: 0, longestStreak: 0, lastActiveDay: null,
    hearts: MAX_HEARTS, heartsUpdatedAt: Date.now(), lessons: {}, srs: {}, settings: { ...defaultSettings },
  };
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Progress;
      return { ...fresh(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } };
    }
  } catch { /* ignore */ }
  return fresh();
}

let state: Progress = load();
const listeners = new Set<() => void>();

function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  listeners.forEach((l) => l());
}

export function update(fn: (s: Progress) => Progress | void) {
  const draft = structuredClone(state);
  const r = fn(draft);
  state = r ?? draft;
  emit();
}

export function getProgress() { return state; }

export function useProgress(): Progress {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
}

// ---------- day helpers ----------
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }

/** Streak as currently displayed (0 if broken). */
export function currentStreak(s: Progress): number {
  if (s.lastActiveDay === dayKey() || s.lastActiveDay === yesterdayKey()) return s.streak;
  return 0;
}

// ---------- hearts ----------
export function heartsNow(s: Progress, now = Date.now()): { hearts: number; nextInMs: number | null } {
  if (s.hearts >= MAX_HEARTS) return { hearts: MAX_HEARTS, nextInMs: null };
  const gained = Math.floor((now - s.heartsUpdatedAt) / HEART_REGEN_MS);
  const hearts = Math.min(MAX_HEARTS, s.hearts + gained);
  if (hearts >= MAX_HEARTS) return { hearts, nextInMs: null };
  return { hearts, nextInMs: HEART_REGEN_MS - ((now - s.heartsUpdatedAt) % HEART_REGEN_MS) };
}
function normalizeHearts(s: Progress, now = Date.now()) {
  const { hearts } = heartsNow(s, now);
  if (hearts !== s.hearts) {
    const gained = hearts - s.hearts;
    s.hearts = hearts;
    s.heartsUpdatedAt = hearts >= MAX_HEARTS ? now : s.heartsUpdatedAt + gained * HEART_REGEN_MS;
  }
  if (s.hearts >= MAX_HEARTS) s.heartsUpdatedAt = now;
}
export function loseHeart() {
  update((s) => {
    if (s.settings.unlimitedHearts) return;
    normalizeHearts(s);
    if (s.hearts >= MAX_HEARTS) s.heartsUpdatedAt = Date.now();
    s.hearts = Math.max(0, s.hearts - 1);
  });
}
export function gainHeart(n = 1) {
  update((s) => { normalizeHearts(s); s.hearts = Math.min(MAX_HEARTS, s.hearts + n); });
}

// ---------- actions ----------
export function gradeItem(id: string, g: Grade, ms?: number) {
  update((s) => { s.srs[id] = grade(s.srs[id], g, Date.now(), ms); });
}

export function addXp(n: number) {
  update((s) => {
    s.xp += n;
    const k = dayKey();
    s.dailyXp[k] = (s.dailyXp[k] ?? 0) + n;
  });
}

/** Mark today as active; returns true if the streak was extended today. */
export function touchStreak(): boolean {
  let extended = false;
  update((s) => {
    const today = dayKey();
    if (s.lastActiveDay === today) return;
    s.streak = s.lastActiveDay === yesterdayKey() ? s.streak + 1 : 1;
    s.longestStreak = Math.max(s.longestStreak, s.streak);
    s.lastActiveDay = today;
    extended = true;
  });
  return extended;
}

export function completeLesson(key: string, accuracy: number) {
  update((s) => {
    const r = s.lessons[key] ?? { completions: 0, bestAccuracy: 0, lastCompleted: 0 };
    r.completions++;
    r.bestAccuracy = Math.max(r.bestAccuracy, accuracy);
    r.lastCompleted = Date.now();
    s.lessons[key] = r;
  });
}

export function setSettings(patch: Partial<Settings>) {
  update((s) => { s.settings = { ...s.settings, ...patch }; });
}

export function resetProgress() {
  state = fresh();
  emit();
}
