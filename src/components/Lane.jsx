import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { keyColor, keyTextColor } from "../styles/contrast.js";
import "./Lane.css";

export function zoneFromX(clientX, rect, count) {
  const ratio = (clientX - rect.left) / rect.width;
  return Math.min(count - 1, Math.max(0, Math.floor(ratio * count)));
}

// Spoken name of a key: single notes include their octave ("G4") so the two
// G keys in the melody lane are distinguishable; chords and drums use labels.
function keyName(zone) {
  if (zone.midi?.length === 1) return `${zone.label}${Math.floor(zone.midi[0] / 12) - 1}`;
  return zone.label;
}

export default function Lane({ lane, slots, currentSlot, onZone, onClear }) {
  const keysRef = useRef(null);
  const lastZone = useRef(new Map()); // pointerId → last zone entered
  const [hits, setHits] = useState(() => new Set());
  const timers = useRef([]);
  const count = lane.zones.length;
  const filled = slots.filter((v) => v !== -1).length;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function fire(zone) {
    onZone(lane.id, zone);
    setHits((h) => new Set(h).add(zone));
    timers.current.push(
      setTimeout(() => setHits((h) => {
        const next = new Set(h);
        next.delete(zone);
        return next;
      }), 180),
    );
  }

  function handlePointer(e) {
    const zone = zoneFromX(e.clientX, keysRef.current.getBoundingClientRect(), count);
    if (lastZone.current.get(e.pointerId) === zone) return;
    lastZone.current.set(e.pointerId, zone);
    fire(zone);
  }

  function forget(e) {
    lastZone.current.delete(e.pointerId);
  }

  function handleKey(e, zone) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fire(zone);
    }
  }

  return (
    <section className="lane" style={{ "--lane": lane.hex }} aria-label={lane.label}>
      <h2 className="lane__name">{lane.label}</h2>

      <div
        ref={keysRef}
        className="lane__keys"
        role="group"
        aria-label={`${lane.label} keys`}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        onPointerLeave={forget}
        onPointerUp={forget}
        onPointerCancel={forget}
      >
        {lane.zones.map((zone, i) => (
          <button
            key={i}
            type="button"
            className={`lane__key${hits.has(i) ? " is-hit" : ""}`}
            style={{ background: keyColor(lane.hex, i, count), color: keyTextColor(lane.hex, i, count) }}
            aria-label={`${lane.label} ${keyName(zone)}`}
            onKeyDown={(e) => handleKey(e, i)}
          >
            {zone.label}
          </button>
        ))}
      </div>

      <div className="lane__side">
        <span className="lane__dots" role="img" aria-label={`${filled} notes in loop`}>
          {slots.map((v, i) => (
            <span
              key={i}
              className={`lane__dot${v !== -1 ? " is-filled" : ""}${i === currentSlot ? " is-now" : ""}`}
            />
          ))}
        </span>
        <button type="button" className="lane__clear" aria-label={`Clear ${lane.label.toLowerCase()}`} onClick={() => onClear(lane.id)}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
