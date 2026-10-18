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
        {busy ? "Rendering…" : "Save WAV"}
      </button>
      <button type="button" className="actions__btn" onClick={onClearAll}>
        <Trash2 size={18} aria-hidden="true" />
        Clear all
      </button>
    </div>
  );
}
