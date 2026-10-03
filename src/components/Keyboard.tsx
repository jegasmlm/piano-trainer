import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { keyLayout, KEYMAP_REVERSE } from './keyLayout';
import { midiName } from '../music/notes';
import type { KeyLabels } from '../state/progress';

export type KeyMark = 'hint' | 'correct' | 'wrong' | 'target';

interface Props {
  lo: number;
  hi: number;
  pressed: Set<number>;
  marks: Record<number, KeyMark>;
  onDown: (midi: number) => void;
  onUp: (midi: number) => void;
  labels: KeyLabels;
  shortcutBase?: number | null;
  scrollTo?: number;
}

export function Keyboard({ lo, hi, pressed, marks, onDown, onUp, labels, shortcutBase, scrollTo }: Props) {
  const { keys, whiteCount } = keyLayout(lo, hi);
  const active = useRef(new Map<number, number>()); // pointerId -> midi
  const wrap = useRef<HTMLDivElement>(null);

  // keep the interesting region in view on narrow screens
  useEffect(() => {
    const el = wrap.current?.parentElement;
    if (!el || scrollTo === undefined) return;
    const k = keys.find((k) => k.midi === scrollTo);
    if (!k) return;
    const px = (k.x / whiteCount) * el.scrollWidth;
    el.scrollTo({ left: Math.max(0, px - el.clientWidth / 2), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo, lo, hi]);

  const midiAt = (e: RPointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const m = el?.closest('[data-midi]')?.getAttribute('data-midi');
    return m ? Number(m) : null;
  };

  const down = (e: RPointerEvent) => {
    e.preventDefault();
    const m = midiAt(e);
    if (m === null) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    active.current.set(e.pointerId, m);
    onDown(m);
  };
  const move = (e: RPointerEvent) => {
    if (!active.current.has(e.pointerId)) return;
    const m = midiAt(e);
    const prev = active.current.get(e.pointerId)!;
    if (m !== null && m !== prev) {
      onUp(prev);
      active.current.set(e.pointerId, m);
      onDown(m);
    }
  };
  const up = (e: RPointerEvent) => {
    const prev = active.current.get(e.pointerId);
    if (prev !== undefined) { onUp(prev); active.current.delete(e.pointerId); }
  };

  return (
    <div
      ref={wrap}
      className="keyboard"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {keys.map((k) => {
        const mark = marks[k.midi];
        const rel = shortcutBase != null ? k.midi - shortcutBase : -1;
        const sc = rel >= 0 ? KEYMAP_REVERSE[rel] : undefined;
        const name = midiName(k.midi);
        const showName = labels === 'all' ? !k.black : labels === 'c' ? k.midi % 12 === 0 : false;
        return (
          <div
            key={k.midi}
            data-midi={k.midi}
            className={`key ${k.black ? 'black' : 'white'} ${pressed.has(k.midi) ? 'down' : ''} ${mark ? 'mark-' + mark : ''}`}
            style={{ left: `${(k.x / whiteCount) * 100}%`, width: `${(k.w / whiteCount) * 100}%` }}
          >
            {sc && <span className="shortcut">{sc}</span>}
            {showName && <span className={`kname ${k.midi === 60 ? 'middle' : ''}`}>{name}</span>}
          </div>
        );
      })}
    </div>
  );
}
