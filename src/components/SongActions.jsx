import { Download, Share2, Trash2 } from "lucide-react";
import "./SongActions.css";

// Song-level actions, kept apart from the playback controls.
export default function SongActions({ busy, onShare, onSaveWav, onClearAll }) {
  return (
    <div className="actions">
      <button type="button" className="actions__btn" onClick={onShare}>
        <Share2 size={18} aria-hidden="true" />
        Share
      </button>
      <button type="button" className="actions__btn" onClick={onSaveWav} disabled={busy}>
        <Download size={18} aria-hidden="true" />
        {/* Both labels share one cell so the button never changes width (no reflow on phones). */}
        <span className="actions__label">
          <span aria-hidden={busy}>Save WAV</span>
          <span aria-hidden={!busy}>Saving…</span>
        </span>
      </button>
      <button type="button" className="actions__btn" onClick={onClearAll}>
        <Trash2 size={18} aria-hidden="true" />
        Clear all
      </button>
    </div>
  );
}
