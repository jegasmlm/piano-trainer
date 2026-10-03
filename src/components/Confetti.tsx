import { useMemo } from 'react';

const COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff', '#ffc800'];
export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 2.2 + Math.random() * 1.8,
    color: COLORS[i % COLORS.length],
    rot: Math.random() * 360,
    size: 6 + Math.random() * 8,
    drift: (Math.random() - 0.5) * 200,
  })), [count]);
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i key={i} style={{
          left: `${p.left}%`, background: p.color, width: p.size, height: p.size * 0.45,
          animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          ['--rot' as string]: `${p.rot}deg`, ['--drift' as string]: `${p.drift}px`,
        }} />
      ))}
    </div>
  );
}
