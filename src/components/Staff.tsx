import type { ReactNode } from 'react';
import { keySigAlters, keySigSteps, staffPos, type Clef, type Pitch } from '../music/notes';

const S = 10; // staff space in SVG units
const G = {
  gClef: '\uE050', fClef: '\uE062', brace: '\uE000',
  whole: '\uE0A2', sharp: '\uE262', flat: '\uE260', natural: '\uE261',
};
const HEAD_W = 1.69 * S;
const FONT = 4 * S;

export type Mark = 'normal' | 'hint' | 'correct' | 'wrong' | 'active' | 'done' | 'ghost';
const COLORS: Record<Mark, string> = {
  normal: 'var(--ink)', hint: '#1cb0f6', correct: '#58a700', wrong: '#ea2b2b', active: 'var(--ink)', done: '#58a700', ghost: '#ea2b2b',
};

export interface StaffNote { pitch: Pitch; staff?: Clef; mark?: Mark }

interface Props {
  clef: Clef | 'grand';
  fifths?: number;
  notes: StaffNote[];
  layout: 'chord' | 'sequence';
  /** Extra (wrong) notes to show semi-transparently in the chord column / at index */
  ghosts?: StaffNote[];
  activeIndex?: number;
}

const SHARP_TREBLE = [8, 5, 9, 6, 3, 7, 4];
const FLAT_TREBLE = [4, 7, 3, 6, 2, 5, 1];

export function Staff({ clef, fifths = 0, notes, layout, ghosts = [], activeIndex }: Props) {
  const staves: Clef[] = clef === 'grand' ? ['treble', 'bass'] : [clef];
  const topY: Record<Clef, number> = clef === 'grand' ? { treble: 6 * S, bass: 17 * S } : { treble: 6 * S, bass: 6 * S };
  const height = clef === 'grand' ? 26 * S : 15 * S;
  const y = (pos: number, st: Clef) => topY[st] + ((8 - pos) * S) / 2;

  const staffOf = (n: StaffNote): Clef => n.staff ?? (clef === 'grand' ? (n.pitch.octave >= 4 ? 'treble' : 'bass') : clef);

  const nSig = Math.abs(fifths);
  const sigX0 = 4.9 * S;
  const sigW = nSig * 1.05 * S;
  const notesX0 = sigX0 + sigW + (layout === 'sequence' ? 3 * S : 4.5 * S);
  const seqSpacing = 5.2 * S;
  const cols = layout === 'sequence' ? notes.length : 1;
  const width = Math.max(notesX0 + (cols - 1) * seqSpacing + HEAD_W + (layout === 'sequence' ? 3 * S : 5 * S), 18 * S);

  const keyAlters = keySigAlters(fifths);
  const els: ReactNode[] = [];
  let k = 0;

  // Staff lines + clefs + key signatures
  for (const st of staves) {
    for (let i = 0; i < 5; i++) els.push(<line key={k++} x1={S * 0.8} x2={width - S * 0.5} y1={topY[st] + i * S} y2={topY[st] + i * S} className="staff-line" />);
    els.push(<text key={k++} x={S * 1.5} y={st === 'treble' ? y(2, st) : y(6, st)} className="glyph" fontSize={FONT}>{st === 'treble' ? G.gClef : G.fClef}</text>);
    const positions = fifths > 0 ? SHARP_TREBLE : FLAT_TREBLE;
    keySigSteps(fifths).forEach((_, i) => {
      const pos = positions[i] - (st === 'bass' ? 2 : 0);
      els.push(<text key={k++} x={sigX0 + i * 1.05 * S} y={y(pos, st)} className="glyph" fontSize={FONT}>{fifths > 0 ? G.sharp : G.flat}</text>);
    });
    els.push(<line key={k++} x1={width - S * 0.5} x2={width - S * 0.5} y1={topY[st]} y2={topY[st] + 4 * S} className="staff-line bar" />);
  }
  if (clef === 'grand') {
    const top = topY.treble, bot = topY.bass + 4 * S;
    els.push(<line key={k++} x1={S * 0.8} x2={S * 0.8} y1={top} y2={bot} className="staff-line bar" />);
    els.push(<line key={k++} x1={width - S * 0.5} x2={width - S * 0.5} y1={top} y2={bot} className="staff-line bar" />);
    els.push(
      <text key={k++} x={0} y={bot} className="glyph" fontSize={FONT * ((bot - top) / (4 * S))} transform={`translate(${-0.2 * S},0)`}>{G.brace}</text>,
    );
  }

  // Notes
  type Placed = { n: StaffNote; st: Clef; pos: number; x: number; ghost: boolean; idx: number };
  const placed: Placed[] = [];
  const all = [...notes.map((n, i) => ({ n, ghost: false, i })), ...ghosts.map((n) => ({ n, ghost: true, i: activeIndex ?? 0 }))];
  for (const { n, ghost, i } of all) {
    const st = staffOf(n);
    const x = layout === 'sequence' ? notesX0 + i * seqSpacing : notesX0;
    placed.push({ n, st, pos: staffPos(n.pitch, st), x, ghost, idx: i });
  }
  // displace seconds in chord columns
  const byCol = new Map<string, Placed[]>();
  for (const pl of placed) {
    const key = pl.x + pl.st;
    if (!byCol.has(key)) byCol.set(key, []);
    byCol.get(key)!.push(pl);
  }
  const accX = new Map<Placed, number>();
  for (const col of byCol.values()) {
    col.sort((a, b) => a.pos - b.pos);
    let prevDisplaced = false;
    for (let i = 1; i < col.length; i++) {
      if (col[i].pos - col[i - 1].pos === 1 && !prevDisplaced) {
        col[i].x += HEAD_W * 0.98;
        prevDisplaced = true;
      } else if (col[i].pos === col[i - 1].pos) {
        col[i].x = col[i - 1].x;
      } else prevDisplaced = false;
    }
    // accidental columns, top-down
    const accCols: number[][] = [];
    const baseX = Math.min(...col.map((c) => c.x));
    for (const pl of [...col].reverse()) {
      if (!needsAcc(pl.n.pitch)) continue;
      let c = 0;
      while (accCols[c]?.some((q) => Math.abs(q - pl.pos) < 6)) c++;
      (accCols[c] ??= []).push(pl.pos);
      accX.set(pl, baseX - 1.35 * S - c * 1.15 * S);
    }
  }

  function needsAcc(pt: Pitch) {
    return (keyAlters[pt.step] ?? 0) !== pt.alter;
  }

  for (const pl of placed) {
    const mark: Mark = pl.ghost ? 'ghost' : pl.n.mark ?? 'normal';
    const color = COLORS[mark];
    const yy = y(pl.pos, pl.st);
    const opacity = pl.ghost ? 0.55 : 1;
    // ledger lines
    const ledgers: number[] = [];
    for (let lp = -2; lp >= pl.pos; lp -= 2) ledgers.push(lp);
    for (let lp = 10; lp <= pl.pos; lp += 2) ledgers.push(lp);
    for (const lp of ledgers)
      els.push(<line key={k++} x1={pl.x - 0.45 * S} x2={pl.x + HEAD_W + 0.45 * S} y1={y(lp, pl.st)} y2={y(lp, pl.st)} className="staff-line ledger" opacity={opacity} />);
    const ax = accX.get(pl);
    if (ax !== undefined) {
      const glyph = pl.n.pitch.alter === 1 ? G.sharp : pl.n.pitch.alter === -1 ? G.flat : G.natural;
      els.push(<text key={k++} x={ax} y={yy} className="glyph" fontSize={FONT} style={{ fill: color }} opacity={opacity}>{glyph}</text>);
    }
    if (mark === 'active' && !pl.ghost)
      els.push(<rect key={k++} x={pl.x - 0.7 * S} y={topY[pl.st] - 2.2 * S} width={HEAD_W + 1.4 * S} height={8.4 * S} rx={S * 0.8} className="active-col" />);
    els.push(
      <text key={k++} x={pl.x} y={yy} className={`glyph note mark-${mark}`} fontSize={FONT} style={{ fill: color }} opacity={opacity}>{G.whole}</text>,
    );
  }

  // Crop vertically to the content so the note size stays constant (scale is set in CSS via --staff-k).
  const tops = staves.map((st) => topY[st] - 3 * S);
  const bots = staves.map((st) => topY[st] + 6.6 * S);
  for (const pl of placed) { tops.push(y(pl.pos, pl.st) - 1.6 * S); bots.push(y(pl.pos, pl.st) + 1.6 * S); }
  const vbTop = Math.max(0, Math.min(...tops, clef === 'grand' ? 3 * S : 2.2 * S));
  const vbBot = Math.min(height, Math.max(...bots, clef === 'grand' ? 23 * S : 12.4 * S));
  const vbH = vbBot - vbTop;
  return (
    <svg className={`staff ${clef === 'grand' ? 'grand' : ''}`} viewBox={`0 ${vbTop} ${width} ${vbH}`} style={{ height: `calc(var(--staff-k) * ${clef === 'grand' ? (vbH * 0.72).toFixed(1) : vbH})`, maxWidth: '100%' }} role="img" aria-label="music staff">
      {els}
    </svg>
  );
}
