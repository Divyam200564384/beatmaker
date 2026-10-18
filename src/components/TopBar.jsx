import { Download, Play, Share2, Square, Trash2 } from "lucide-react";
import { TEMPO_MAX, TEMPO_MIN, WAVEFORMS } from "../song/model.js";
import "./TopBar.css";

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

export default function TopBar({
  song, playing, busy, onPlay, onStop, onTempo, onWaveform, onVolume, onShare, onSaveWav, onClearAll,
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

      <label className="topbar__field">
        <span className="topbar__label">Tempo</span>
        <input
          type="range"
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          step={1}
          value={song.tempo}
          onChange={(e) => onTempo(Number(e.target.value))}
        />
        <output className="topbar__value">{song.tempo} BPM</output>
      </label>

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

      <div className="topbar__actions">
        <button type="button" className="topbar__btn" onClick={onShare}>
          <Share2 size={18} aria-hidden="true" />
          Share
        </button>
        <button type="button" className="topbar__btn" onClick={onSaveWav} disabled={busy}>
          <Download size={18} aria-hidden="true" />
          {busy ? "Rendering…" : "Save WAV"}
        </button>
        <button type="button" className="topbar__btn" onClick={onClearAll}>
          <Trash2 size={18} aria-hidden="true" />
          Clear all
        </button>
      </div>
    </div>
  );
}
