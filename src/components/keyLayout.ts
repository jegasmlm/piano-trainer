import { isBlack } from '../music/notes';

export interface KeyGeom { midi: number; x: number; w: number; black: boolean }

/** Geometry in white-key units (white key width = 1). */
export function keyLayout(lo: number, hi: number): { keys: KeyGeom[]; whiteCount: number } {
  const keys: KeyGeom[] = [];
  let wx = 0;
  const offs: Record<number, number> = { 1: -0.1, 3: 0.1, 6: -0.12, 8: 0, 10: 0.12 };
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) {
      const w = 0.62;
      keys.push({ midi: m, x: wx - w / 2 + (offs[m % 12] ?? 0) * w, w, black: true });
    } else {
      keys.push({ midi: m, x: wx, w: 1, black: false });
      wx += 1;
    }
  }
  return { keys, whiteCount: wx };
}

/**
 * Computer-keyboard mapping by PHYSICAL key position (KeyboardEvent.code), so it works on any
 * layout (US, Spanish ES — where Semicolon is Ñ and Quote is the ´ dead key —, AZERTY, QWERTZ…).
 * Values are semitones above the current base C.
 */
export const CODEMAP: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
  KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
};
/** Fallback when `code` is missing/unidentified (some virtual keyboards): map by produced character. */
export const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, 'ñ': 16, "'": 17, '´': 17,
};
export const OCTAVE_DOWN_CODES = ['KeyZ'];
export const OCTAVE_UP_CODES = ['KeyX'];

/** Resolve a keyboard event to a semitone offset (or null). */
export function semitoneFor(e: Pick<KeyboardEvent, 'code' | 'key'>): number | null {
  if (e.code && e.code in CODEMAP) return CODEMAP[e.code];
  const k = (e.key ?? '').toLowerCase();
  if ((!e.code || e.code === 'Unidentified') && k in KEYMAP) return KEYMAP[k];
  return null;
}
export function octaveShiftFor(e: Pick<KeyboardEvent, 'code' | 'key'>): -1 | 1 | 0 {
  if (OCTAVE_DOWN_CODES.includes(e.code)) return -1;
  if (OCTAVE_UP_CODES.includes(e.code)) return 1;
  if (!e.code || e.code === 'Unidentified') {
    const k = (e.key ?? '').toLowerCase();
    if (k === 'z') return -1;
    if (k === 'x') return 1;
  }
  return 0;
}

// Labels printed on the on-screen keys. Defaults to US; replaced by the user's real layout when the
// browser exposes it (navigator.keyboard.getLayoutMap, Chromium), e.g. "Ñ" and "´" on Spanish keyboards.
const US_LABELS: Record<string, string> = Object.fromEntries(
  Object.keys(CODEMAP).map((c) => [c, c.startsWith('Key') ? c.slice(3) : c === 'Semicolon' ? ';' : "'"]),
);
let labels: Record<string, string> = { ...US_LABELS };
const labelListeners = new Set<() => void>();
export function onLabels(cb: () => void) { labelListeners.add(cb); return () => { labelListeners.delete(cb); }; }

type LayoutMap = { get(code: string): string | undefined };
const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & { keyboard?: { getLayoutMap?: () => Promise<LayoutMap> } }) | undefined;
if (nav?.keyboard?.getLayoutMap) {
  nav.keyboard.getLayoutMap().then((map) => {
    const next = { ...US_LABELS };
    for (const code of Object.keys(CODEMAP)) {
      const v = map.get(code);
      if (v) next[code] = v.toUpperCase();
    }
    labels = next;
    labelListeners.forEach((l) => l());
  }).catch(() => { /* not allowed (e.g. iframe) – keep US labels */ });
}
/** Label for the key `rel` semitones above the base, or undefined. */
export function shortcutLabel(rel: number): string | undefined {
  const code = Object.keys(CODEMAP).find((c) => CODEMAP[c] === rel);
  return code ? labels[code] : undefined;
}
export function octaveLabels() {
  return { down: 'Z', up: 'X' };
}
