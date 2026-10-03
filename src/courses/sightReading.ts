import type { Course, Exercise, Section, Unit } from './types';
import { applyKey, fromDiatonic, diatonic, intervalName, p, prettyPitch, type Clef, type Pitch } from '../music/notes';

// ---------------------------------------------------------------------------
// Helpers to build exercises
// ---------------------------------------------------------------------------

const NOTE_HINTS: Record<string, string> = {
  'treble:C4': 'Middle C sits on its own ledger line just below the treble staff. On the keyboard it is the C in the middle — the white key just left of a pair of black keys.',
  'treble:G4': 'The treble (G) clef curls around the 2nd line: that line is G4, the G just above middle C.',
  'treble:C5': 'Treble C: the 3rd space, exactly one octave above middle C.',
  'treble:D4': 'D4 hangs just below the bottom line — one step above middle C. On the keys: between the two black keys.',
  'treble:E4': 'E4 is the bottom line of the treble staff. Right of the two-black-key group.',
  'treble:F4': 'F4 is the first space — one step below the G line. Left of the three-black-key group.',
  'treble:A4': 'A4 is the 2nd space, one step above the G line (concert A, 440 Hz).',
  'treble:B4': 'B4 is the middle line — one step below treble C.',
  'treble:D5': 'D5 is the 4th line, one step above treble C.',
  'treble:E5': 'E5 is the top space (the "E" in F-A-C-E).',
  'treble:F5': 'F5 is the top line of the treble staff.',
  'treble:G5': 'G5 sits right on top of the staff, an octave above the G line.',
  'bass:C4': 'Middle C again — now one ledger line ABOVE the bass staff. Same key on the piano!',
  'bass:F3': 'The bass (F) clef’s two dots surround the 4th line: F3, the F just below middle C.',
  'bass:C3': 'Bass C: the 2nd space, one octave below middle C.',
  'bass:D3': 'D3 is the middle line of the bass staff.',
  'bass:E3': 'E3 is the 3rd space, one step below the F line.',
  'bass:G3': 'G3 is the top space of the bass staff.',
  'bass:A3': 'A3 is the top line of the bass staff.',
  'bass:B3': 'B3 sits just above the bass staff, one step below middle C.',
  'bass:B2': 'B2 is the 2nd line, right below bass C.',
  'bass:A2': 'A2 is the bottom space.',
  'bass:G2': 'G2 is the bottom line of the bass staff (G-B-D-F-A lines).',
  'bass:F2': 'F2 hangs just under the bass staff — an octave below the F line.',
  'bass:E2': 'E2 is on the first ledger line below the bass staff.',
  'bass:D2': 'D2 hangs below the first ledger line.',
  'bass:C2': 'C2 is on the 2nd ledger line below the bass staff — two octaves below middle C.',
  'treble:A5': 'A5: first ledger line above the treble staff.',
  'treble:B5': 'B5: just above the first ledger line.',
  'treble:C6': 'C6 (high C): two ledger lines above the treble staff — two octaves above middle C.',
  'treble:B3': 'B3 in treble clef: just below the middle-C ledger line.',
  'treble:A3': 'A3 in treble clef: on the 2nd ledger line below. (In bass clef this is the top line!)',
  'bass:D4': 'D4 in bass clef: just above the middle-C ledger line.',
  'bass:E4': 'E4 in bass clef: on the 2nd ledger line above. (In treble clef: the bottom line.)',
  'bass:B1': 'B1: just under the 2nd low ledger line.',
  'bass:A1': 'A1: on the 3rd ledger line below the bass staff.',
};

function noteEx(pitch: string, clef: Clef, opts: { teach?: boolean; fifths?: number; written?: string; hint?: string } = {}): Exercise {
  const pt = opts.fifths !== undefined && opts.written ? applyKey(p(opts.written), opts.fifths) : p(pitch);
  const keyTag = opts.fifths !== undefined ? `:k${opts.fifths}` : '';
  const natural = pt.alter === 0 ? `${clef}:${pitch}` : '';
  return {
    id: `note:${clef}:${pitch}${keyTag}`,
    kind: 'note',
    clef,
    fifths: opts.fifths,
    notes: [pt],
    label: prettyPitch(pt),
    hint: opts.hint ?? NOTE_HINTS[natural],
    teach: opts.teach ?? true,
  };
}

function grandEx(pitch: string, staff: Clef, teach = false, hint?: string): Exercise {
  return {
    id: `note:grand:${pitch}:${staff[0]}`,
    kind: 'note',
    clef: 'grand',
    notes: [p(pitch)],
    staves: [staff],
    label: `${prettyPitch(p(pitch))} (${staff} staff)`,
    hint: hint ?? NOTE_HINTS[`${staff}:${pitch}`],
    teach,
  };
}

function intervalEx(lower: string, steps: number, clef: Clef, teach = false, hint?: string): Exercise {
  const lo = p(lower);
  const hi = fromDiatonic(diatonic(lo) + steps);
  const name = intervalName(lo, hi);
  return {
    id: `int:${clef}:${lower}+${steps}`,
    kind: 'interval',
    clef,
    notes: [lo, hi],
    label: `${prettyPitch(lo)}–${prettyPitch(hi)} · ${name}`,
    hint,
    teach,
  };
}

function chordEx(id: string, name: string, notes: string[], clef: Clef, opts: { fifths?: number; teach?: boolean; hint?: string } = {}): Exercise {
  const pts = notes.map(p);
  return {
    id: `chord:${clef}:${id}`,
    kind: 'chord',
    clef,
    fifths: opts.fifths,
    notes: pts,
    label: `${name} · ${pts.map((x) => prettyPitch(x)).join(' ')}`,
    hint: opts.hint,
    teach: opts.teach,
  };
}

function melodyEx(notes: string, clef: Clef, opts: { fifths?: number; teach?: boolean; hint?: string } = {}): Exercise {
  const pts = notes.split(' ').map((s) => (opts.fifths ? applyKey(p(s), opts.fifths) : p(s)));
  return {
    id: `mel:${clef}:${notes.replace(/ /g, '-')}${opts.fifths ? ':k' + opts.fifths : ''}`,
    kind: 'melody',
    clef,
    fifths: opts.fifths,
    notes: pts,
    label: pts.map((x) => prettyPitch(x)).join(' → '),
    hint: opts.hint,
    teach: opts.teach,
  };
}

const unit = (id: string, title: string, description: string, items: Exercise[], lessons = 3, icon = '♪'): Unit => ({
  id, title, description, items, lessons, type: 'learn', icon,
});
const checkpoint = (id: string, title: string, description: string, lessons = 2): Unit => ({
  id, title, description, items: [], lessons, type: 'checkpoint', icon: '🏆',
});

// ---------------------------------------------------------------------------
// Section 1 — Treble clef
// ---------------------------------------------------------------------------
const s1: Section = {
  id: 'treble',
  title: 'Treble Clef',
  description: 'Landmarks C4, G4, C5 — then every note from middle C to G5.',
  color: '#58cc02',
  units: [
    unit('t1', 'Middle C & Treble G', 'Your first two landmarks.', [noteEx('C4', 'treble'), noteEx('G4', 'treble')], 3, '🎯'),
    unit('t2', 'Treble C', 'The third landmark: C5.', [noteEx('C5', 'treble')], 2, '🎯'),
    unit('t3', 'Up from Middle C', 'D4 and E4.', [noteEx('D4', 'treble'), noteEx('E4', 'treble')]),
    unit('t4', 'Around the G line', 'F4 and A4.', [noteEx('F4', 'treble'), noteEx('A4', 'treble')]),
    unit('t5', 'Around Treble C', 'B4 and D5.', [noteEx('B4', 'treble'), noteEx('D5', 'treble')]),
    unit('t6', 'Top of the staff', 'E5 and F5.', [noteEx('E5', 'treble'), noteEx('F5', 'treble')]),
    unit('t7', 'High G', 'G5 completes the range.', [noteEx('G5', 'treble')], 2),
    checkpoint('t-cp', 'Treble Checkpoint', 'Every treble note from C4 to G5.'),
  ],
};

// ---------------------------------------------------------------------------
// Section 2 — Bass clef
// ---------------------------------------------------------------------------
const s2: Section = {
  id: 'bass',
  title: 'Bass Clef',
  description: 'Landmarks C4, F3, C3 — then down to C2.',
  color: '#1cb0f6',
  units: [
    unit('b1', 'Middle C & Bass F', 'Bass clef landmarks.', [noteEx('C4', 'bass'), noteEx('F3', 'bass')], 3, '🎯'),
    unit('b2', 'Bass C', 'C3, one octave below middle C.', [noteEx('C3', 'bass')], 2, '🎯'),
    unit('b3', 'Up from Bass C', 'D3 and E3.', [noteEx('D3', 'bass'), noteEx('E3', 'bass')]),
    unit('b4', 'Above the F line', 'G3 and A3.', [noteEx('G3', 'bass'), noteEx('A3', 'bass')]),
    unit('b5', 'Just below Middle C', 'B3 and B2.', [noteEx('B3', 'bass'), noteEx('B2', 'bass')]),
    unit('b6', 'Lower staff', 'A2 and G2.', [noteEx('A2', 'bass'), noteEx('G2', 'bass')]),
    unit('b7', 'Below the staff', 'F2, E2.', [noteEx('F2', 'bass'), noteEx('E2', 'bass')]),
    unit('b8', 'Down to C2', 'D2 and C2.', [noteEx('D2', 'bass'), noteEx('C2', 'bass')]),
    checkpoint('b-cp', 'Bass Checkpoint', 'Every bass note from C2 to C4.'),
  ],
};

// ---------------------------------------------------------------------------
// Section 3 — Grand staff
// ---------------------------------------------------------------------------
const trebleNat = ['D4', 'E4', 'F4', 'A4', 'B4', 'D5', 'E5', 'F5', 'G5'];
const bassNat = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'D3', 'E3', 'G3', 'A3', 'B3'];
const s3: Section = {
  id: 'grand',
  title: 'Grand Staff',
  description: 'Both hands: read across treble and bass together.',
  color: '#ce82ff',
  units: [
    unit('g1', 'Middle C, two ways', 'The same key written on either staff.', [
      grandEx('C4', 'treble', true, 'On the grand staff, middle C can be written just below the treble staff OR just above the bass staff. Same key!'),
      grandEx('C4', 'bass', true, 'Middle C on the bass side: ledger line above the bass staff. Same key as before.'),
    ], 2, '🎯'),
    unit('g2', 'Mirror landmarks', 'G4 / F3 and C5 / C3 — symmetric around middle C.', [
      grandEx('G4', 'treble'), grandEx('F3', 'bass'), grandEx('C5', 'treble'), grandEx('C3', 'bass'),
    ], 3, '🪞'),
    unit('g3', 'Treble side', 'All treble notes in grand-staff context.', trebleNat.map((n) => grandEx(n, 'treble')), 3),
    unit('g4', 'Bass side', 'All bass notes in grand-staff context.', bassNat.map((n) => grandEx(n, 'bass')), 3),
    checkpoint('g-cp', 'Grand Staff Checkpoint', 'Jump between the hands.'),
  ],
};

// ---------------------------------------------------------------------------
// Section 4 — Ledger lines
// ---------------------------------------------------------------------------
const s4: Section = {
  id: 'ledger',
  title: 'Ledger Lines',
  description: 'Beyond the staff: high treble, low bass and the middle crossover.',
  color: '#ff9600',
  units: [
    unit('l1', 'High C', 'A5, B5 and C6 above the treble staff.', [noteEx('A5', 'treble'), noteEx('B5', 'treble'), noteEx('C6', 'treble')], 3, '⬆️'),
    unit('l2', 'Treble, below middle C', 'B3 and A3 written in treble clef.', [noteEx('B3', 'treble'), noteEx('A3', 'treble')], 3, '⬇️'),
    unit('l3', 'Bass, above middle C', 'D4 and E4 written in bass clef.', [noteEx('D4', 'bass'), noteEx('E4', 'bass')], 3, '⬆️'),
    unit('l4', 'Deep bass', 'B1 and A1.', [noteEx('B1', 'bass'), noteEx('A1', 'bass')], 3, '⬇️'),
    unit('l5', 'The crossover', 'Notes near middle C on the "other" staff.', [
      grandEx('B3', 'treble'), grandEx('A3', 'treble'), grandEx('D4', 'bass'), grandEx('E4', 'bass'),
    ], 3, '🔀'),
    checkpoint('l-cp', 'Ledger Checkpoint', 'Everything above and below the staves.'),
  ],
};

// ---------------------------------------------------------------------------
// Section 5 — Accidentals & key signatures
// ---------------------------------------------------------------------------
const SHARP_HINT = 'A sharp ♯ raises the note a half step: play the key immediately to the right (usually a black key).';
const FLAT_HINT = 'A flat ♭ lowers the note a half step: play the key immediately to the left.';
const ks = (written: string, clef: Clef, fifths: number, teach = false, hint?: string) => {
  const pt = applyKey(p(written), fifths);
  return noteEx(written, clef, { fifths, written, teach, hint: hint ?? (pt.alter ? `The key signature changes every ${pt.step} to ${prettyPitch(pt, false)} — in every octave.` : undefined) });
};
const natInKey = (pitch: string, fifths: number, keyName: string): Exercise => ({
  id: `note:treble:${pitch}:k${fifths}:nat`,
  kind: 'note',
  clef: 'treble',
  fifths,
  notes: [p(pitch)],
  label: `${prettyPitch(p(pitch))} (natural)`,
  hint: `The natural sign ♮ cancels the ${keyName} key signature for this note: play the white key.`,
  teach: true,
});
const s5: Section = {
  id: 'accidentals',
  title: 'Accidentals & Keys',
  description: 'Sharps, flats, naturals and key signatures.',
  color: '#ff4b4b',
  units: [
    unit('a1', 'Sharps', 'F♯, C♯ and G♯.', [
      noteEx('F#4', 'treble', { hint: SHARP_HINT }), noteEx('C#5', 'treble', { hint: SHARP_HINT }), noteEx('G#4', 'treble', { hint: SHARP_HINT }),
    ], 3, '♯'),
    unit('a2', 'Flats', 'B♭, E♭ and A♭.', [
      noteEx('Bb4', 'treble', { hint: FLAT_HINT }), noteEx('Eb4', 'treble', { hint: FLAT_HINT }), noteEx('Ab4', 'treble', { hint: FLAT_HINT }),
    ], 3, '♭'),
    unit('a3', 'Bass accidentals', 'F♯3, B♭2, C♯3, E♭3.', [
      noteEx('F#3', 'bass', { hint: SHARP_HINT }), noteEx('Bb2', 'bass', { hint: FLAT_HINT }),
      noteEx('C#3', 'bass', { hint: SHARP_HINT }), noteEx('Eb3', 'bass', { hint: FLAT_HINT }),
    ], 3),
    unit('a4', 'G major (1♯)', 'Every F becomes F♯.', [
      ks('F4', 'treble', 1, true), ks('F5', 'treble', 1, true), ks('G4', 'treble', 1), ks('A4', 'treble', 1), ks('B4', 'treble', 1), ks('D5', 'treble', 1), ks('E4', 'treble', 1),
    ], 3, '🔑'),
    unit('a5', 'F major (1♭)', 'Every B becomes B♭.', [
      ks('B4', 'treble', -1, true), ks('F4', 'treble', -1), ks('A4', 'treble', -1), ks('C5', 'treble', -1), ks('D5', 'treble', -1), ks('E4', 'treble', -1), ks('B2', 'bass', -1, true),
    ], 3, '🔑'),
    unit('a6', 'D major (2♯)', 'F♯ and C♯.', [
      ks('F4', 'treble', 2, true), ks('C5', 'treble', 2, true), ks('C4', 'treble', 2), ks('D4', 'treble', 2), ks('A4', 'treble', 2), ks('B4', 'treble', 2), ks('E5', 'treble', 2),
    ], 3, '🔑'),
    unit('a7', 'B♭ major (2♭)', 'B♭ and E♭.', [
      ks('B4', 'treble', -2, true), ks('E4', 'treble', -2, true), ks('E5', 'treble', -2), ks('F4', 'treble', -2), ks('G4', 'treble', -2), ks('C5', 'treble', -2), ks('D5', 'treble', -2),
    ], 3, '🔑'),
    unit('a8', 'Naturals', 'When ♮ cancels the key signature.', [
      natInKey('F4', 1, 'G major'), natInKey('F5', 1, 'G major'), natInKey('B4', -1, 'F major'), natInKey('C5', 2, 'D major'),
    ], 2, '♮'),
    checkpoint('a-cp', 'Accidentals Checkpoint', 'Sharps, flats and keys mixed.'),
  ],
};

// ---------------------------------------------------------------------------
// Section 6 — Intervals (harmonic: play both notes)
// ---------------------------------------------------------------------------
const lows = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
const ints = (steps: number, list: string[], clef: Clef, hint: string) =>
  list.map((l, i) => intervalEx(l, steps, clef, i === 0, hint));
const s6: Section = {
  id: 'intervals',
  title: 'Intervals',
  description: 'See the shape, play both notes. Line-line, space-space, and beyond.',
  color: '#2b70c9',
  units: [
    unit('i1', '2nds', 'Neighbors: one line + the next space.', ints(1, lows.slice(0, 5), 'treble', 'A 2nd: notes touch (line + adjacent space), drawn side by side. Play two neighbouring white keys.'), 3, '2'),
    unit('i2', '3rds', 'Line-line or space-space.', ints(2, lows, 'treble', 'A 3rd: both on lines or both in spaces, one apart. Skip one white key.'), 3, '3'),
    unit('i3', '4ths & 5ths', 'The open sounds.', [
      ...ints(3, lows.slice(0, 4), 'treble', 'A 4th: line→space (or space→line) with two notes skipped. Skip two white keys.'),
      ...ints(4, lows.slice(0, 5), 'treble', 'A 5th: line→line two apart (or space→space). Skip three white keys — the classic thumb-to-pinky reach.'),
    ], 4, '5'),
    unit('i4', '6ths', 'Wide but sweet.', ints(5, lows.slice(0, 5), 'treble', 'A 6th: one more than a 5th; line→space.'), 3, '6'),
    unit('i5', '7ths & Octaves', 'Stretch!', [
      ...ints(6, ['C4', 'D4', 'G4'], 'treble', 'A 7th: one less than an octave — line→line three apart.'),
      ...ints(7, ['C4', 'D4', 'E4', 'F4', 'G4'], 'treble', 'An octave: same letter, line↔space, 8 white keys apart.'),
    ], 3, '8'),
    unit('i6', 'Bass intervals', '3rds, 5ths and octaves in bass clef.', [
      ...['C3', 'D3', 'F3'].map((l, i) => intervalEx(l, 2, 'bass', i === 0, 'Same shapes in bass clef: a 3rd is line-line or space-space.')),
      ...['C3', 'G2', 'D3'].map((l, i) => intervalEx(l, 4, 'bass', i === 0, 'A 5th in bass clef — perfect for the left hand.')),
      ...['C2', 'G2', 'C3'].map((l, i) => intervalEx(l, 7, 'bass', i === 0, 'Bass octaves are the left hand’s bread and butter.')),
    ], 3, '𝄢'),
    checkpoint('i-cp', 'Intervals Checkpoint', 'Every interval shape.'),
  ],
};

// ---------------------------------------------------------------------------
// Section 7 — Triads & inversions (play all notes together)
// ---------------------------------------------------------------------------
const s7: Section = {
  id: 'triads',
  title: 'Triads & Inversions',
  description: 'Snowmen and their inversions: read the whole chord at once.',
  color: '#a560e8',
  units: [
    unit('c1', 'Major triads: C, F, G', 'Root position "snowmen": three lines or three spaces.', [
      chordEx('C', 'C major', ['C4', 'E4', 'G4'], 'treble', { teach: true, hint: 'Root position triad = stacked 3rds (all lines or all spaces). Play keys 1-3-5: skip one white key between each.' }),
      chordEx('F', 'F major', ['F4', 'A4', 'C5'], 'treble'),
      chordEx('G', 'G major', ['G4', 'B4', 'D5'], 'treble'),
    ], 3, '⛄'),
    unit('c2', 'Minor triads: Dm, Em, Am', 'Same shape, different colour.', [
      chordEx('Dm', 'D minor', ['D4', 'F4', 'A4'], 'treble', { teach: true, hint: 'Same snowman shape on white keys gives the minor triads on D, E and A.' }),
      chordEx('Em', 'E minor', ['E4', 'G4', 'B4'], 'treble'),
      chordEx('Am', 'A minor', ['A4', 'C5', 'E5'], 'treble'),
    ], 3, '⛄'),
    unit('c3', 'First inversion', 'A 3rd + a 4th: the gap is on top.', [
      chordEx('C/E', 'C major · 1st inv.', ['E4', 'G4', 'C5'], 'treble', { teach: true, hint: '1st inversion: the root moves to the top. Look for the wider gap (a 4th) at the TOP — the top note is the root.' }),
      chordEx('F/A', 'F major · 1st inv.', ['A4', 'C5', 'F5'], 'treble'),
      chordEx('G/B', 'G major · 1st inv.', ['B3', 'D4', 'G4'], 'treble'),
      chordEx('Am/C', 'A minor · 1st inv.', ['C4', 'E4', 'A4'], 'treble'),
    ], 3, '🔄'),
    unit('c4', 'Second inversion', 'A 4th + a 3rd: the gap is at the bottom.', [
      chordEx('C/G', 'C major · 2nd inv.', ['G4', 'C5', 'E5'], 'treble', { teach: true, hint: '2nd inversion: the wide gap (a 4th) is at the BOTTOM — the root is the upper note of that gap.' }),
      chordEx('F/C', 'F major · 2nd inv.', ['C4', 'F4', 'A4'], 'treble'),
      chordEx('G/D', 'G major · 2nd inv.', ['D4', 'G4', 'B4'], 'treble'),
      chordEx('Dm/A', 'D minor · 2nd inv.', ['A4', 'D5', 'F5'], 'treble'),
    ], 3, '🔄'),
    unit('c5', 'Bass clef triads', 'Left-hand chords.', [
      chordEx('C', 'C major', ['C3', 'E3', 'G3'], 'bass', { teach: true, hint: 'Same snowmen in the bass: C3 is the 2nd space.' }),
      chordEx('F', 'F major', ['F2', 'A2', 'C3'], 'bass'),
      chordEx('G', 'G major', ['G2', 'B2', 'D3'], 'bass'),
      chordEx('Am', 'A minor', ['A2', 'C3', 'E3'], 'bass'),
    ], 3, '𝄢'),
    unit('c6', 'Chords with sharps & flats', 'Key signatures meet triads.', [
      chordEx('D', 'D major', ['D4', 'F#4', 'A4'], 'treble', { fifths: 2, teach: true, hint: 'D major: the key signature makes the F sharp — D, F♯, A.' }),
      chordEx('Bm', 'B minor', ['B4', 'D5', 'F#5'], 'treble', { fifths: 2 }),
      chordEx('Bb', 'B♭ major', ['Bb4', 'D5', 'F5'], 'treble', { fifths: -2, teach: true, hint: 'B♭ major: B♭, D, F. The key signature flattens the B.' }),
      chordEx('A', 'A major', ['A4', 'C#5', 'E5'], 'treble', { teach: true, hint: 'A major: the ♯ in front of C turns the minor shape into major.' }),
      chordEx('E', 'E major', ['E4', 'G#4', 'B4'], 'treble'),
    ], 3, '♯'),
    checkpoint('c-cp', 'Triads Checkpoint', 'All chords and inversions.'),
  ],
};

// ---------------------------------------------------------------------------
// Section 8 — Melodic patterns (play in order)
// ---------------------------------------------------------------------------
const mels = (list: string[], clef: Clef, hint: string, fifths?: number) =>
  list.map((m, i) => melodyEx(m, clef, { teach: i === 0, hint, fifths }));
const s8: Section = {
  id: 'melodies',
  title: 'Melodic Patterns',
  description: 'Read ahead: steps, skips and leaps in sequence.',
  color: '#00cd9c',
  units: [
    unit('m1', 'Steps (3 notes)', 'Stepwise motion around middle C.', mels(['C4 D4 E4', 'E4 D4 C4', 'D4 E4 F4', 'G4 F4 E4', 'E4 F4 G4', 'F4 E4 D4'], 'treble', 'Play the notes left to right. Steps go line→space→line: neighbouring keys.'), 3, '🪜'),
    unit('m2', 'Steps & skips', '4-note patterns.', mels(['C4 E4 D4 C4', 'E4 G4 F4 E4', 'G4 E4 F4 D4', 'C4 D4 E4 C4', 'D4 F4 E4 G4'], 'treble', 'A skip (3rd) jumps over one key: line→line or space→space.'), 3, '🦘'),
    unit('m3', 'G position', 'Patterns from G4 to D5.', mels(['G4 A4 B4 C5', 'D5 C5 B4 A4', 'G4 B4 D5 B4', 'A4 C5 B4 G4'], 'treble', 'Shift your hand: thumb on G4, pinky on D5.'), 3, '✋'),
    unit('m4', 'Five-finger melodies', '5 notes in C position.', mels(['C4 D4 E4 F4 G4', 'G4 F4 E4 D4 C4', 'C4 E4 G4 E4 C4', 'E4 D4 C4 D4 E4', 'G4 E4 F4 D4 C4'], 'treble', 'Keep your hand on C–G: one finger per key.'), 3, '🖐️'),
    unit('m5', 'Bass clef melodies', 'Left-hand lines.', mels(['C3 D3 E3', 'G3 F3 E3', 'C3 E3 G3', 'F3 E3 D3 C3', 'G3 F3 E3 D3 C3'], 'bass', 'Left hand: pinky on C3, thumb on G3.'), 3, '𝄢'),
    unit('m6', 'Landmark leaps', 'Jump between C4, G4, C5.', mels(['C4 G4 C5', 'C5 G4 C4', 'G4 C5 G5', 'C4 E4 G4 C5'], 'treble', 'Use your landmarks: find C4, G4, C5 instantly, then everything else is close by.'), 3, '🎯'),
    unit('m7', 'Melodies in G major', 'Remember the F♯!', mels(['G4 F4 G4 A4', 'B4 A4 G4 F4 G4', 'D5 C5 B4 A4 G4', 'E4 F4 G4 A4 B4'], 'treble', 'The key signature applies to every F in the melody: play F♯.', 1), 3, '🔑'),
    checkpoint('m-cp', 'Final Checkpoint', 'Melodies from the whole course.'),
  ],
};

export const sightReading: Course = {
  id: 'sight-reading',
  title: 'Sight Reading',
  subtitle: 'Staff → keys, automatically',
  icon: '🎼',
  available: true,
  sections: [s1, s2, s3, s4, s5, s6, s7, s8],
};

export type { Pitch };
