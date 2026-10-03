import { isBlack } from '../music/notes';

export interface KeyGeom { midi: number; x: number; w: number; black: boolean }

/** Geometry in white-key units (white key width = 1). */
export function keyLayout(lo: number, hi: number): { keys: KeyGeom[]; whiteCount: number } {
  const keys: KeyGeom[] = [];
  let wx = 0;
  // black key offsets relative to the boundary, for a natural look
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

// Computer keyboard mapping (relative semitones from the base C)
export const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17,
};
export const KEYMAP_REVERSE: Record<number, string> = Object.fromEntries(Object.entries(KEYMAP).map(([k, v]) => [v, k.toUpperCase()]));
