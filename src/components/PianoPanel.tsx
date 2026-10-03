import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type KeyMark } from './Keyboard';
import { PianoRoll, RollStore } from './PianoRoll';
import { keyLayout, octaveShiftFor, semitoneFor, shortcutLabel } from './keyLayout';
import { noteOff, noteOn, unlockAudio } from '../audio/piano';
import { onMidi, startMidi } from '../input/midi';
import { useProgress } from '../state/progress';

interface Props {
  lo: number;
  hi: number;
  marks: Record<number, KeyMark>;
  onNote: (midi: number) => void;
  roll: RollStore;
  /** Enter/Space handler (e.g. continue) */
  onEnter?: () => void;
  center?: number;
}

export function PianoPanel({ lo, hi, marks, onNote, roll, onEnter, center }: Props) {
  const settings = useProgress().settings;
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const [base, setBase] = useState(lo);
  const cb = useRef({ onNote, onEnter });
  cb.current = { onNote, onEnter };

  useEffect(() => { setBase(lo); }, [lo]);

  const down = useCallback((m: number, vel = 0.8) => {
    void unlockAudio();
    noteOn(m, vel);
    roll.on(m, 'played');
    setPressed((s) => new Set(s).add(m));
    cb.current.onNote(m);
    window.dispatchEvent(new CustomEvent('keysreader:note', { detail: { midi: m } }));
  }, [roll]);
  const up = useCallback((m: number) => {
    noteOff(m);
    roll.off(m);
    setPressed((s) => { const n = new Set(s); n.delete(m); return n; });
  }, [roll]);

  // MIDI
  useEffect(() => {
    void startMidi();
    return onMidi((m, on, v) => (on ? down(m, Math.max(0.3, v)) : up(m)));
  }, [down, up]);

  // Computer keyboard — physical positions via KeyboardEvent.code (layout independent: US, ES, FR, DE…).
  // Registered in the capture phase so nothing else on the page (focused buttons, other handlers) can swallow it.
  const baseRef = useRef(base);
  baseRef.current = base;
  const rangeRef = useRef({ lo, hi });
  rangeRef.current = { lo, hi };
  useEffect(() => {
    const held = new Map<string, number>(); // event.code (or key) -> midi
    const isFormField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const kd = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isFormField(e.target)) return;
      const { lo, hi } = rangeRef.current;
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) cb.current.onEnter?.();
        return;
      }
      const shift = octaveShiftFor(e);
      if (shift) {
        e.preventDefault();
        if (!e.repeat) setBase((b) => Math.min(Math.max(lo, b + 12 * shift), Math.max(lo, hi - 11)));
        return;
      }
      const semi = semitoneFor(e);
      if (semi === null) return;
      e.preventDefault(); // also stops dead-key composition (´ on Spanish layouts) and quick-find
      e.stopPropagation();
      const id = e.code || e.key;
      if (e.repeat || held.has(id)) return;
      const m = baseRef.current + semi;
      if (m < lo || m > hi) return;
      held.set(id, m);
      down(m);
    };
    const ku = (e: KeyboardEvent) => {
      const id = e.code || e.key;
      const m = held.get(id);
      if (m !== undefined) { held.delete(id); up(m); }
    };
    const releaseAll = () => { held.forEach((m) => up(m)); held.clear(); };
    window.addEventListener('keydown', kd, true);
    window.addEventListener('keyup', ku, true);
    window.addEventListener('blur', releaseAll);
    return () => {
      releaseAll();
      window.removeEventListener('keydown', kd, true);
      window.removeEventListener('keyup', ku, true);
      window.removeEventListener('blur', releaseAll);
    };
  }, [down, up]);

  return (
    <div className="piano-panel">
      <div className="piano-scroll">
        <div className="piano-inner" style={{ ['--whites' as string]: keyLayout(lo, hi).whiteCount }}>
          {settings.showRoll && <PianoRoll lo={lo} hi={hi} store={roll} />}
          <Keyboard
            lo={lo} hi={hi} pressed={pressed} marks={marks} onDown={(m) => down(m)} onUp={up}
            labels={settings.keyLabels} shortcutBase={settings.showShortcuts ? base : null} scrollTo={center}
          />
        </div>
      </div>
      {settings.showShortcuts && (
        <div className="kb-help">
          Keys <kbd>{shortcutLabel(0)}</kbd>…<kbd>{shortcutLabel(17)}</kbd> play C{Math.floor(base / 12) - 1}–F{Math.floor(base / 12)} · <kbd>Z</kbd>/<kbd>X</kbd> octave · <kbd>Enter</kbd> continue
        </div>
      )}
    </div>
  );
}
