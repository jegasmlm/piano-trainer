import * as Tone from 'tone';
import { getProgress } from '../state/progress';

// Salamander Grand Piano samples (CC-BY 3.0, Alexander Holm), bundled in /public/samples.
const SAMPLE_NOTES = ['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7', 'D#7', 'F#7', 'A7', 'C8'];

let sampler: Tone.Sampler | null = null;
let loaded = false;
let loading: Promise<void> | null = null;
const loadListeners = new Set<(b: boolean) => void>();

export function isPianoLoaded() { return loaded; }
export function onPianoLoaded(cb: (b: boolean) => void) { loadListeners.add(cb); return () => { loadListeners.delete(cb); }; }

export function initPiano(): Promise<void> {
  if (loading) return loading;
  const urls: Record<string, string> = {};
  for (const n of SAMPLE_NOTES) urls[n] = n.replace('#', 's') + '.mp3';
  loading = new Promise<void>((resolve) => {
    const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.16 }).toDestination();
    sampler = new Tone.Sampler({
      urls,
      baseUrl: import.meta.env.BASE_URL + 'samples/salamander/',
      release: 1.2,
      onload: () => {
        loaded = true;
        loadListeners.forEach((l) => l(true));
        resolve();
      },
      onerror: (e) => { console.warn('Piano samples failed to load', e); resolve(); },
    }).connect(reverb);
  });
  return loading;
}

/** Must be called from a user gesture at least once (browser autoplay policy). */
export async function unlockAudio() {
  if (Tone.getContext().state !== 'running') {
    try { await Tone.start(); } catch { /* ignore */ }
  }
  void initPiano();
}

const midiToFreqName = (m: number) => Tone.Frequency(m, 'midi').toNote();

export function noteOn(midi: number, velocity = 0.8) {
  const s = getProgress().settings;
  if (!s.sound || !sampler || !loaded) return;
  sampler.volume.value = s.volume;
  sampler.triggerAttack(midiToFreqName(midi), Tone.now(), velocity);
}
export function noteOff(midi: number) {
  if (!sampler || !loaded) return;
  sampler.triggerRelease(midiToFreqName(midi), Tone.now() + 0.05);
}
export function playNotes(midis: number[], opts: { arpeggio?: number; duration?: number; delay?: number } = {}) {
  const s = getProgress().settings;
  if (!s.sound || !sampler || !loaded) return;
  sampler.volume.value = s.volume;
  const t0 = Tone.now() + (opts.delay ?? 0);
  midis.forEach((m, i) =>
    sampler!.triggerAttackRelease(midiToFreqName(m), opts.duration ?? 1.2, t0 + i * (opts.arpeggio ?? 0), 0.7),
  );
}

// Tiny synthesized UI sounds (correct / wrong) so feedback works even without samples.
let ui: Tone.PolySynth | null = null;
function uiSynth() {
  if (!ui) {
    ui = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 } }).toDestination();
    ui.volume.value = -14;
  }
  return ui;
}
export function chime(kind: 'correct' | 'wrong' | 'complete') {
  if (!getProgress().settings.sound) return;
  const s = uiSynth();
  const t = Tone.now() + 0.02;
  if (kind === 'correct') { s.triggerAttackRelease('E6', 0.08, t); s.triggerAttackRelease('A6', 0.12, t + 0.08); }
  else if (kind === 'wrong') { s.triggerAttackRelease('C4', 0.15, t); s.triggerAttackRelease('A3', 0.2, t + 0.1); }
  else { ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => s.triggerAttackRelease(n, 0.15, t + i * 0.1)); }
}
