import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type KeyMark } from './Keyboard';
import { PianoRoll, RollStore } from './PianoRoll';
import { KEYMAP, keyLayout } from './keyLayout';
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

  // Computer keyboard
  useEffect(() => {
    const held = new Map<string, number>();
    const kd = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'enter' || key === ' ') { e.preventDefault(); if (!e.repeat) cb.current.onEnter?.(); return; }
      if (e.repeat) { if (key in KEYMAP) e.preventDefault(); return; }
      if (key === 'z') { setBase((b) => Math.max(lo, b - 12)); return; }
      if (key === 'x') { setBase((b) => Math.min(hi - 11, b + 12)); return; }
      if (key in KEYMAP) {
        e.preventDefault();
        const m = base + KEYMAP[key];
        if (m < lo || m > hi) return;
        held.set(key, m);
        down(m);
      }
    };
    const ku = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const m = held.get(key);
      if (m !== undefined) { held.delete(key); up(m); }
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [base, lo, hi, down, up]);

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
          Keys <kbd>A</kbd>…<kbd>;</kbd> play from C{Math.floor(base / 12) - 1} · <kbd>Z</kbd>/<kbd>X</kbd> octave · <kbd>Enter</kbd> continue
        </div>
      )}
    </div>
  );
}
