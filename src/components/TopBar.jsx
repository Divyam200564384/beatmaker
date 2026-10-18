import { Play, Square } from "lucide-react";
import { TEMPO_MAX, TEMPO_MIN, WAVEFORMS } from "../song/model.js";
import "./TopBar.css";

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

export default function TopBar({
  song, playing, status, onPlay, onStop, onTempo, onWaveform, onVolume,
}) {
  return (
    <div className="topbar" role="toolbar" aria-label="Song controls">
      <button
        type="button"
        className="topbar__play"
        onClick={playing ? onStop : onPlay}
      >
        {playing ? <Square size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        {playing ? "Stop" : "Play"}
      </button>

      <div className="topbar__field">
        <label className="topbar__label" htmlFor="tempo">Tempo</label>
        <input
          id="tempo"
          type="range"
          aria-valuetext={`${song.tempo} BPM`}
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          step={1}
          value={song.tempo}
          onChange={(e) => onTempo(Number(e.target.value))}
        />
        <span className="topbar__value" aria-hidden="true">{song.tempo} BPM</span>
      </div>

      <label className="topbar__field">
        <span className="topbar__label">Melody sound</span>
        <select value={song.waveform} onChange={(e) => onWaveform(e.target.value)}>
          {WAVEFORMS.map((w) => (
            <option key={w} value={w}>{capitalize(w)}</option>
          ))}
        </select>
      </label>

      <label className="topbar__field">
        <span className="topbar__label">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={song.volume}
          onChange={(e) => onVolume(Number(e.target.value))}
        />
      </label>

      <p className="topbar__status" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
