import { useEffect, useState } from 'react';
import { midiSupported, onMidi, onMidiDevices, startMidi } from '../input/midi';

/** Visible MIDI connection indicator. Auto-detects devices (hot-plug supported). */
export function MidiStatus({ compact = false }: { compact?: boolean }) {
  const [devices, setDevices] = useState<string[]>([]);
  const [activity, setActivity] = useState(false);
  useEffect(() => {
    void startMidi();
    const off1 = onMidiDevices(setDevices);
    let t: ReturnType<typeof setTimeout>;
    const off2 = onMidi((_, on) => { if (on) { setActivity(true); clearTimeout(t); t = setTimeout(() => setActivity(false), 150); } });
    return () => { off1(); off2(); clearTimeout(t); };
  }, []);
  if (!midiSupported()) {
    return compact ? null : <span className="midi-pill off" title="Web MIDI is not supported in this browser (use Chrome or Edge on desktop/Android). The on-screen and computer keyboards work everywhere.">🎹 MIDI n/a</span>;
  }
  const on = devices.length > 0;
  return (
    <span className={`midi-pill ${on ? 'on' : 'off'} ${activity ? 'blink' : ''}`} title={on ? `Connected: ${devices.join(', ')}` : 'Plug in a MIDI keyboard — it is detected automatically.'}>
      <span className="dot" /> 🎹 {on ? (compact ? 'MIDI' : devices[0]) : compact ? 'No MIDI' : 'No MIDI device'}
    </span>
  );
}
