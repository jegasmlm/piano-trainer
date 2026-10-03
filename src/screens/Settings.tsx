import { resetProgress, setSettings, useProgress, type KeyLabels } from '../state/progress';
import { MidiStatus } from '../components/MidiStatus';
import { playNotes, unlockAudio } from '../audio/piano';

export function Settings({ onClose }: { onClose: () => void }) {
  const s = useProgress().settings;
  const Toggle = ({ k, label, desc }: { k: 'sound' | 'showShortcuts' | 'unlimitedHearts' | 'unlockAll' | 'showRoll'; label: string; desc?: string }) => (
    <label className="row">
      <span><b>{label}</b>{desc && <small>{desc}</small>}</span>
      <input type="checkbox" className="switch" checked={s[k]} onChange={(e) => setSettings({ [k]: e.target.checked })} />
    </label>
  );
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal pop" onClick={(e) => e.stopPropagation()}>
        <header><h2>Settings</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></header>
        <div className="row"><span><b>MIDI keyboard</b><small>Auto-detected; hot-plugging works.</small></span><MidiStatus /></div>
        <Toggle k="sound" label="Sound" />
        <label className="row">
          <span><b>Volume</b></span>
          <input type="range" min={-24} max={6} value={s.volume} onChange={(e) => setSettings({ volume: Number(e.target.value) })} onPointerUp={async () => { await unlockAudio(); playNotes([60, 64, 67]); }} />
        </label>
        <label className="row">
          <span><b>Lesson length</b><small>Questions per lesson (practice mode is endless)</small></span>
          <select value={s.lessonLength} onChange={(e) => setSettings({ lessonLength: Number(e.target.value) })}>
            <option value={6}>Quick · 6</option><option value={10}>Short · 10</option><option value={12}>Normal · 12</option><option value={20}>Long · 20</option><option value={30}>Marathon · 30</option>
          </select>
        </label>
        <label className="row">
          <span><b>Daily goal</b></span>
          <select value={s.dailyGoal} onChange={(e) => setSettings({ dailyGoal: Number(e.target.value) })}>
            <option value={30}>Casual · 30 XP</option><option value={50}>Regular · 50 XP</option><option value={100}>Serious · 100 XP</option><option value={200}>Intense · 200 XP</option>
          </select>
        </label>
        <label className="row">
          <span><b>Key labels</b><small>Note names printed on the on-screen keys</small></span>
          <select value={s.keyLabels} onChange={(e) => setSettings({ keyLabels: e.target.value as KeyLabels })}>
            <option value="none">None</option><option value="c">C keys only</option><option value="all">All white keys</option>
          </select>
        </label>
        <Toggle k="showShortcuts" label="Computer-keyboard letters" desc="Show A W S E D… on the keys" />
        <Toggle k="showRoll" label="Piano roll" desc="Visualise played vs. target notes above the keys" />
        <Toggle k="unlimitedHearts" label="Unlimited hearts" desc="Turn off the hearts mechanic" />
        <Toggle k="unlockAll" label="Unlock all lessons" desc="Jump anywhere in the course" />
        <div className="row danger-row">
          <span><b>Reset progress</b><small>Deletes XP, streak and memory data on this device</small></span>
          <button className="btn danger small" onClick={() => { if (confirm('Reset all progress?')) resetProgress(); }}>Reset</button>
        </div>
        <p className="muted small credits">Piano: Salamander Grand Piano (CC-BY 3.0, Alexander Holm) · Notation font: Bravura (SIL OFL)</p>
      </div>
    </div>
  );
}
