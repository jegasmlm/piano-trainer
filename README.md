# KeysReader — Duolingo-style piano sight reading

Learn to turn staff positions into piano keys automatically, then read intervals, triads and melodies.
Question → think → play the answer on a piano keyboard (on-screen/touch, computer keys, or a **Web MIDI** keyboard).

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/ (static, base './', works offline & from any sub-path)
npm run preview
node tests/smoke.mjs http://localhost:4173/   # headless smoke test (needs google-chrome)
```

## Architecture
- `src/courses/` — generic **Course > Section > Unit > Lesson** model (`types.ts`), course registry (`index.ts`),
  and the Sight Reading curriculum (`sightReading.ts`). New courses (Ear Training, Songs) plug into `COURSES`.
- `src/lesson/session.ts` — lesson builder (new items + SRS-weighted review, intros first), endless practice picker, unlock logic.
- `src/srs/srs.ts` — Leitner boxes (8 boxes, 0 → 30 days) with weakness/overdue/error weighting.
- `src/state/progress.ts` — localStorage store: XP, daily XP, streak, hearts (regen 1/20 min), lesson records, per-item SRS, settings.
- `src/screens/LessonScreen.tsx` — question engine (single note / set / ordered sequence), adaptive re-queue, confidence boosters, hearts, celebrations.
- `src/components/` — custom SVG `Staff` (Bravura SMuFL font), `Keyboard`, canvas `PianoRoll`, `PianoPanel` (input: pointer/touch, computer keys, MIDI), `MidiStatus`.
- `src/audio/piano.ts` — Tone.js Sampler with bundled Salamander Grand Piano samples (`public/samples/salamander`).

## Credits
Salamander Grand Piano samples by Alexander Holm (CC-BY 3.0). Bravura font by Steinberg (SIL OFL 1.1). Tone.js (MIT).
