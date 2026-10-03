import type { Clef, Pitch } from '../music/notes';

/**
 * Generic course model: Course > Section > Unit > Lesson.
 * Lessons are generated on the fly from a unit's items plus a spaced-repetition review pool,
 * so future courses (Ear Training, Songs) only need to supply sections/units/exercises
 * and (if they add new exercise kinds) a renderer for that kind.
 */
export type ExerciseKind = 'note' | 'interval' | 'chord' | 'melody';

export interface Exercise {
  /** Stable id used as the spaced-repetition key. */
  id: string;
  kind: ExerciseKind;
  clef: Clef | 'grand';
  /** Key signature: +n sharps / -n flats */
  fifths?: number;
  /** Sounding pitches (correctly spelled). Renderer decides which accidentals to print. */
  notes: Pitch[];
  /** For grand staff: which staff each note is written on. */
  staves?: Clef[];
  /** Human readable answer, e.g. "G4" or "C major · 1st inversion" */
  label: string;
  /** Teaching tip shown the first time the item appears */
  hint?: string;
  /** Show the intro card (hint + highlighted key) the first time it's seen. */
  teach?: boolean;
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  /** Items introduced in this unit */
  items: Exercise[];
  /** Number of lessons to complete the unit */
  lessons: number;
  /** checkpoint = pure review of the whole section */
  type: 'learn' | 'checkpoint';
  icon?: string;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  color: string;
  units: Unit[];
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  available: boolean;
  sections: Section[];
}

export interface LessonRef {
  courseId: string;
  unitId: string;
  lessonIndex: number;
}

export function lessonKey(ref: LessonRef) {
  return `${ref.courseId}/${ref.unitId}/${ref.lessonIndex}`;
}
