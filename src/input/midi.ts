// Web MIDI input: listens to note-on/off on every connected input.
type Handler = (midi: number, on: boolean, velocity: number) => void;

const handlers = new Set<Handler>();
let started = false;
let devices: string[] = [];
const deviceListeners = new Set<(d: string[]) => void>();

export function onMidi(h: Handler) { handlers.add(h); return () => { handlers.delete(h); }; }
export function onMidiDevices(cb: (d: string[]) => void) { deviceListeners.add(cb); cb(devices); return () => { deviceListeners.delete(cb); }; }
export function midiSupported() { return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator; }

export async function startMidi() {
  if (started || !midiSupported()) return;
  started = true;
  try {
    const access = await navigator.requestMIDIAccess();
    const attach = () => {
      devices = [];
      access.inputs.forEach((input) => {
        devices.push(input.name ?? 'MIDI input');
        input.onmidimessage = (e: MIDIMessageEvent) => {
          const d = e.data;
          if (!d || d.length < 3) return;
          const cmd = d[0] & 0xf0;
          if (cmd === 0x90 && d[2] > 0) handlers.forEach((h) => h(d[1], true, d[2] / 127));
          else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) handlers.forEach((h) => h(d[1], false, 0));
        };
      });
      deviceListeners.forEach((l) => l([...devices]));
    };
    attach();
    access.onstatechange = attach;
  } catch (e) {
    console.info('MIDI not available:', e);
  }
}
