import { useEffect, useRef } from 'react';
import { keyLayout } from './keyLayout';

export type RollKind = 'played' | 'correct' | 'wrong' | 'target';
interface RollEvent { midi: number; t0: number; t1: number | null; kind: RollKind }

/** A tiny store so any component can push events to the roll. */
export class RollStore {
  events: RollEvent[] = [];
  /** notes that are currently the target (drawn as lane highlights) */
  lanes: { midi: number; kind: 'target' | 'hint' }[] = [];
  on(midi: number, kind: RollKind) {
    this.off(midi);
    this.events.push({ midi, t0: performance.now(), t1: null, kind });
    if (this.events.length > 200) this.events.splice(0, 50);
  }
  off(midi: number) {
    const now = performance.now();
    for (const e of this.events) if (e.midi === midi && e.t1 === null) e.t1 = Math.max(now, e.t0 + 120);
  }
  /** Mark the most recent event for a key (e.g. once it's been judged correct/wrong). */
  mark(midi: number, kind: RollKind) {
    for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i].midi === midi) { this.events[i].kind = kind; return; }
  }
  /** Add a demo note sequence (e.g. playback of the answer). */
  demo(midis: number[], gapMs: number, durMs: number) {
    const t = performance.now();
    midis.forEach((m, i) => this.events.push({ midi: m, t0: t + i * gapMs, t1: t + i * gapMs + durMs, kind: 'target' }));
  }
}

const COLORS: Record<RollKind, string> = { played: '#8b8fff', correct: '#58cc02', wrong: '#ff4b4b', target: '#1cb0f6' };
const SPEED = 0.07; // px per ms

export function PianoRoll({ lo, hi, store }: { lo: number; hi: number; store: RollStore }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const { keys, whiteCount } = keyLayout(lo, hi);
    const byMidi = new Map(keys.map((k) => [k.midi, k]));
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const u = W / whiteCount;
      // background lanes: C lines + black-key lanes
      for (const k of keys) {
        if (k.black) { ctx.fillStyle = 'rgba(0,0,0,0.035)'; ctx.fillRect(k.x * u, 0, k.w * u, H); }
        if (k.midi % 12 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(k.x * u, 0, 1, H); }
      }
      for (const l of store.lanes) {
        const k = byMidi.get(l.midi);
        if (!k) continue;
        ctx.fillStyle = l.kind === 'hint' ? 'rgba(28,176,246,0.15)' : 'rgba(88,204,2,0.16)';
        ctx.fillRect(k.x * u, 0, k.w * u, H);
      }
      const now = performance.now();
      for (const e of store.events) {
        const k = byMidi.get(e.midi);
        if (!k) continue;
        if (e.t0 > now) continue;
        const end = e.t1 === null ? now : Math.min(e.t1, now);
        const yBottom = H - (now - end) * SPEED;
        const yTop = H - (now - e.t0) * SPEED;
        if (yBottom < 0) continue;
        const x = k.x * u + 1.5, w = k.w * u - 3;
        ctx.fillStyle = COLORS[e.kind];
        ctx.globalAlpha = 0.9;
        const r = Math.min(5, w / 2);
        ctx.beginPath();
        ctx.roundRect(x, Math.max(-10, yTop), w, Math.max(4, yBottom - yTop), r);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [lo, hi, store]);
  return <canvas ref={ref} className="roll" />;
}
