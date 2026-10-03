import type { Course, Exercise, Section, Unit } from './types';
import { sightReading } from './sightReading';

export const COURSES: Course[] = [
  sightReading,
  {
    id: 'ear-training',
    title: 'Ear Training',
    subtitle: 'Hear it, name it, play it',
    icon: '👂',
    available: false,
    sections: [],
  },
  {
    id: 'songs',
    title: 'Playing Songs',
    subtitle: 'Real pieces, step by step',
    icon: '🎵',
    available: false,
    sections: [],
  },
];

export function getCourse(id: string): Course {
  const c = COURSES.find((c) => c.id === id);
  if (!c) throw new Error('Unknown course ' + id);
  return c;
}

export interface UnitLoc {
  course: Course;
  section: Section;
  sectionIndex: number;
  unit: Unit;
  unitIndex: number; // index within section
  flatIndex: number; // index within the course
}

export function allUnits(course: Course): UnitLoc[] {
  const out: UnitLoc[] = [];
  course.sections.forEach((section, si) =>
    section.units.forEach((unit, ui) =>
      out.push({ course, section, sectionIndex: si, unit, unitIndex: ui, flatIndex: out.length }),
    ),
  );
  return out;
}

export function findUnit(course: Course, unitId: string): UnitLoc {
  const u = allUnits(course).find((u) => u.unit.id === unitId);
  if (!u) throw new Error('Unknown unit ' + unitId);
  return u;
}

/** All exercises introduced up to (and including) the given unit. */
export function itemsUpTo(course: Course, flatIndex: number): Exercise[] {
  return allUnits(course)
    .slice(0, flatIndex + 1)
    .flatMap((u) => u.unit.items);
}

export function sectionItems(section: Section): Exercise[] {
  return section.units.flatMap((u) => u.items);
}

export function allItems(course: Course): Map<string, Exercise> {
  const m = new Map<string, Exercise>();
  for (const u of allUnits(course)) for (const it of u.unit.items) m.set(it.id, it);
  return m;
}
