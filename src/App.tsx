import { useEffect, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { LessonScreen, type SessionSpec } from './screens/LessonScreen';
import { Settings } from './screens/Settings';
import { unlockAudio, onPianoLoaded, isPianoLoaded } from './audio/piano';
import { applyUpdate, onUpdate, startVersionWatch } from './version';

type Route = { name: 'home' } | { name: 'session'; spec: SessionSpec; key: number };

export default function App() {
  const [courseId, setCourseId] = useState(() => localStorage.getItem('pianoTrainer.course') ?? 'sight-reading');
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [settings, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(isPianoLoaded());
  const [audioStarted, setAudioStarted] = useState(false);

  useEffect(() => onPianoLoaded(setLoaded), []);
  const [update, setUpdate] = useState<string | null>(null);
  useEffect(() => { startVersionWatch(); return onUpdate(setUpdate); }, []);
  // Auto-reload into a newer deploy whenever we're on the home screen (never interrupts a lesson).
  useEffect(() => { if (update && route.name === 'home') applyUpdate(update); }, [update, route.name]);
  useEffect(() => { localStorage.setItem('pianoTrainer.course', courseId); }, [courseId]);
  useEffect(() => {
    const go = () => { void unlockAudio(); setAudioStarted(true); };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  }, []);

  const practice = (sectionId?: string, title = 'Smart practice') =>
    setRoute({ name: 'session', spec: { mode: 'practice', courseId, sectionId, title }, key: Date.now() });

  return (
    <div className="app">
      {route.name === 'home' && (
        <HomeScreen
          courseId={courseId}
          onCourse={setCourseId}
          onLesson={(ref) => setRoute({ name: 'session', spec: { mode: 'lesson', ref }, key: Date.now() })}
          onPractice={practice}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {route.name === 'session' && (
        <LessonScreen key={route.key} spec={route.spec} onExit={() => setRoute({ name: 'home' })} onPractice={() => practice()} />
      )}
      {settings && <Settings onClose={() => setSettingsOpen(false)} />}
      {audioStarted && !loaded && <div className="loading-pill">🎹 Loading piano…</div>}
      {update && route.name !== 'home' && <div className="loading-pill update-pill">✨ Update ready — it installs when you finish</div>}
    </div>
  );
}
