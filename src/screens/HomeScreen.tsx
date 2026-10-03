import { useState } from 'react';
import { allUnits, COURSES, getCourse } from '../courses';
import type { Course, LessonRef } from '../courses/types';
import { currentStreak, dayKey, heartsNow, useProgress } from '../state/progress';
import { lessonsDone, nextLessonIndex, unitComplete, unitUnlocked } from '../lesson/session';
import { strength } from '../srs/srs';
import { MidiStatus } from '../components/MidiStatus';

interface Props {
  courseId: string;
  onCourse: (id: string) => void;
  onLesson: (ref: LessonRef) => void;
  onPractice: (sectionId?: string, title?: string) => void;
  onSettings: () => void;
}

export function TopStats({ onSettings }: { onSettings?: () => void }) {
  const p = useProgress();
  const { hearts, nextInMs } = heartsNow(p);
  const streak = currentStreak(p);
  return (
    <div className="top-stats">
      <MidiStatus compact />
      <span className={`stat streak ${p.lastActiveDay === dayKey() ? 'lit' : ''}`} title="Day streak">🔥 {streak}</span>
      <span className="stat xp" title="Total XP">⚡ {p.xp}</span>
      <span className="stat stat-hearts" title={nextInMs ? `Next heart in ${Math.ceil(nextInMs / 60000)} min` : 'Hearts full'}>❤️ {p.settings.unlimitedHearts ? '∞' : hearts}</span>
      {onSettings && <button className="icon-btn" aria-label="Settings" onClick={onSettings}>⚙️</button>}
    </div>
  );
}

export function HomeScreen({ courseId, onCourse, onLesson, onPractice, onSettings }: Props) {
  const p = useProgress();
  const course: Course = getCourse(courseId);
  const units = allUnits(course);
  const [open, setOpen] = useState<string | null>(null);
  const today = p.dailyXp[dayKey()] ?? 0;
  const currentIdx = units.findIndex((u) => !unitComplete(p, course, u));
  const totalItems = units.flatMap((u) => u.unit.items);
  const mastered = totalItems.filter((e) => strength(p.srs[e.id]) >= 0.5).length;
  const seen = totalItems.filter((e) => p.srs[e.id]?.seen).length;

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand">🎹 <b>Keys</b>Reader</div>
        <TopStats onSettings={onSettings} />
      </header>

      <nav className="course-tabs">
        {COURSES.map((c) => (
          <button key={c.id} className={`course-tab ${c.id === courseId ? 'active' : ''}`} disabled={!c.available} onClick={() => onCourse(c.id)}>
            <span className="ct-icon">{c.icon}</span>
            <span><b>{c.title}</b><small>{c.available ? c.subtitle : 'Coming soon'}</small></span>
          </button>
        ))}
      </nav>

      <div className="home-grid">
        <aside className="side">
          <div className="card goal">
            <h3>Daily goal</h3>
            <div className="progress"><div className="bar" style={{ width: `${Math.min(100, (today / p.settings.dailyGoal) * 100)}%` }} /></div>
            <p className="muted">{today} / {p.settings.dailyGoal} XP today {today >= p.settings.dailyGoal ? '✅' : ''}</p>
          </div>
          <div className="card practice-card">
            <h3>Practice</h3>
            <p className="muted">Endless smart review of everything you’ve seen. No hearts lost — and you earn hearts back.</p>
            <button className="btn primary wide" onClick={() => onPractice(undefined, 'Smart practice')}>🏋️ Practice (endless)</button>
          </div>
          <div className="card">
            <h3>Memory</h3>
            <p className="muted">{seen} / {totalItems.length} items seen · {mastered} strong</p>
            <div className="progress small"><div className="bar alt" style={{ width: `${(mastered / Math.max(1, totalItems.length)) * 100}%` }} /></div>
          </div>
          <div className="card input-card">
            <h3>Input</h3>
            <MidiStatus />
            <p className="muted small">MIDI keyboards are detected automatically. No keyboard? Tap the on-screen keys, or use your computer keys (A W S E D F T G Y H U J K…).</p>
          </div>
        </aside>

        <main className="path">
          {course.sections.map((section) => {
            const sUnits = units.filter((u) => u.section.id === section.id);
            const anyUnlocked = sUnits.some((u) => unitUnlocked(p, course, u));
            return (
              <section key={section.id} className="section" style={{ ['--sec' as string]: section.color }}>
                <div className="section-banner">
                  <div>
                    <small>SECTION {course.sections.indexOf(section) + 1}</small>
                    <h2>{section.title}</h2>
                    <p>{section.description}</p>
                  </div>
                  {anyUnlocked && sUnits.some((u) => u.unit.items.some((e) => p.srs[e.id]?.seen)) && (
                    <button className="btn on-color small" onClick={() => onPractice(section.id, `Practice: ${section.title}`)}>🏋️ Practice</button>
                  )}
                </div>
                <div className="nodes">
                  {sUnits.map((u, i) => {
                    const unlocked = unitUnlocked(p, course, u);
                    const done = lessonsDone(p, course, u);
                    const complete = done >= u.unit.lessons;
                    const isCurrent = u.flatIndex === currentIdx;
                    const offset = Math.sin(i * 1.1) * 70;
                    const pct = (done / u.unit.lessons) * 100;
                    const isOpen = open === u.unit.id;
                    return (
                      <div key={u.unit.id} className={`node-wrap ${isOpen ? "open" : ""}`} style={{ transform: `translateX(${offset}px)` }}>
                        {isCurrent && !isOpen && <div className="start-bubble">START</div>}
                        <button
                          className={`node node--${u.unit.type} ${complete ? 'node--complete' : done > 0 ? 'node--partial' : ''} ${unlocked ? '' : 'node--locked'} ${isCurrent ? 'node--current' : ''}`}
                          style={{ ['--pct' as string]: `${pct}%` }}
                          onClick={() => setOpen(isOpen ? null : u.unit.id)}
                          aria-label={u.unit.title}
                        >
                          <span className="node-face">{unlocked ? (complete ? '★' : u.unit.icon) : '🔒'}</span>
                          {unlocked && u.unit.lessons > 1 && <span className="node-count">{done}/{u.unit.lessons}</span>}
                        </button>
                        <div className={`node-label ${complete ? "is-done" : ""}`}>{u.unit.title}</div>
                        {isOpen && (
                          <div className="node-pop pop" ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
                            <b>{u.unit.title}</b>
                            <p>{u.unit.description}</p>
                            {unlocked ? (
                              <>
                                <p className="muted small">{complete ? 'Completed — replay for review' : `Lesson ${done + 1} of ${u.unit.lessons}`}</p>
                                <button className="btn primary wide" onClick={() => onLesson({ courseId: course.id, unitId: u.unit.id, lessonIndex: nextLessonIndex(p, course, u) })}>
                                  {complete ? 'Replay' : done ? 'Continue' : 'Start'} {complete ? '' : `+${10 * p.settings.lessonLength + 10} XP`}
                                </button>
                              </>
                            ) : (
                              <p className="muted small">Complete the previous unit to unlock (or enable “Unlock all” in settings).</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <div className="path-end">🎓 More courses coming: Ear Training, Playing Songs</div>
        </main>
      </div>
    </div>
  );
}
