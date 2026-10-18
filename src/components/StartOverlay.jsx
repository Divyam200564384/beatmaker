import { Play } from "lucide-react";
import "./StartOverlay.css";

// Browsers only allow sound after a click or tap; hovering doesn't count.
export default function StartOverlay({ supported, onStart }) {
  return (
    <div className="start">
      <div className="start__panel">
        <h2 className="start__title">Sweep across the colours to make music</h2>
        {supported ? (
          <button type="button" className="start__btn" onClick={onStart} autoFocus>
            <Play size={24} aria-hidden="true" />
            Start
          </button>
        ) : (
          <p className="start__note">This browser can't play Web Audio. Try Chrome, Edge or Firefox.</p>
        )}
      </div>
    </div>
  );
}
