// Core music model: spelled pitches, MIDI numbers, staff positions, key signatures.

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Alter = -1 | 0 | 1;
export type Clef = 'treble' | 'bass';

export interface Pitch {
  step: Step;
  alter: Alter;
  octave: number;
}

export const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parse "C4", "F#3", "Bb2" */
export function p(s: string): Pitch {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error('Bad pitch ' + s);
  return { step: m[1] as Step, alter: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, octave: Number(m[3]) };
}

export function pitchToString(pt: Pitch): string {
  return pt.step + (pt.alter === 1 ? '#' : pt.alter === -1 ? 'b' : '') + pt.octave;
}

/** Pretty name with real accidental glyphs */
export function prettyPitch(pt: Pitch, withOctave = true): string {
  return pt.step + (pt.alter === 1 ? '♯' : pt.alter === -1 ? '♭' : '') + (withOctave ? pt.octave : '');
}

export function midiOf(pt: Pitch): number {
  return 12 * (pt.octave + 1) + STEP_SEMITONES[pt.step] + pt.alter;
}

/** Diatonic index: C0 = 0, D0 = 1, ... */
export function diatonic(pt: Pitch): number {
  return pt.octave * 7 + STEPS.indexOf(pt.step);
}

export function fromDiatonic(d: number, alter: Alter = 0): Pitch {
  const octave = Math.floor(d / 7);
  return { step: STEPS[((d % 7) + 7) % 7], alter, octave };
}

/** Staff position in half-spaces above the bottom line (0 = bottom line, 8 = top line). */
export function staffPos(pt: Pitch, clef: Clef): number {
  const bottom = clef === 'treble' ? diatonic(p('E4')) : diatonic(p('G2'));
  return diatonic(pt) - bottom;
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function midiName(midi: number): string {
  return SHARP_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}
export function isBlack(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

// ---------- Key signatures ----------
export interface KeySig {
  name: string; // e.g. "G major"
  fifths: number; // +sharps / -flats
}
const SHARP_ORDER: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export function keySigAlters(fifths: number): Partial<Record<Step, Alter>> {
  const res: Partial<Record<Step, Alter>> = {};
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((s) => (res[s] = 1));
  if (fifths < 0) FLAT_ORDER.slice(0, -fifths).forEach((s) => (res[s] = -1));
  return res;
}
export function keySigSteps(fifths: number): Step[] {
  return fifths > 0 ? SHARP_ORDER.slice(0, fifths) : FLAT_ORDER.slice(0, -fifths);
}

/** Apply a key signature to a "written" natural pitch (written without an accidental). */
export function applyKey(pt: Pitch, fifths: number): Pitch {
  const a = keySigAlters(fifths)[pt.step];
  return a ? { ...pt, alter: a } : pt;
}

// ---------- Intervals ----------
const INTERVAL_NAMES: Record<string, string> = {
  '1:0': 'unison', '2:1': 'minor 2nd', '2:2': 'major 2nd', '3:3': 'minor 3rd', '3:4': 'major 3rd',
  '4:5': 'perfect 4th', '4:6': 'augmented 4th', '5:6': 'diminished 5th', '5:7': 'perfect 5th',
  '6:8': 'minor 6th', '6:9': 'major 6th', '7:10': 'minor 7th', '7:11': 'major 7th', '8:12': 'octave',
};
export function intervalName(a: Pitch, b: Pitch): string {
  const num = Math.abs(diatonic(b) - diatonic(a)) + 1;
  const semis = Math.abs(midiOf(b) - midiOf(a));
  return INTERVAL_NAMES[`${num}:${semis}`] ?? `${num}th`;
}
