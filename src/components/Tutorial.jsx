import { useEffect, useRef, useState } from "react";
import { Hand, MousePointer2, X } from "lucide-react";
import "./Tutorial.css";

export const TUTORIAL_KEY = "beatmaker.tutorialSeen";

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1");
  } catch {
    // Private mode can block storage; the tutorial just shows again next time.
  }
}

// Narrow screens get the square film made from the phone layout.
function isNarrow() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Phones and tablets report a coarse pointer; laptops with a mouse or trackpad don't.
function isTouchDevice() {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

function steps(touch) {
  return [
    {
      title: "Welcome to Beatmaker",
      body: "Make a song in under a minute. No music skills needed: every note fits together.",
      art: "video",
    },
    {
      title: touch ? "Drag your finger across a colour" : "Move your mouse across a colour",
      body: touch
        ? "Each coloured row is an instrument. Slide your finger along a row to play its notes. Try going from one row into the next."
        : "Each coloured row is an instrument. Just move the mouse along a row to play it, no clicking needed.",
      art: "sweep",
    },
    {
      title: "Everything you play loops",
      body: touch
        ? "Notes you play join the loop and keep repeating. The dots show what's saved. Tap ✕ to clear a row."
        : "Notes you play join the loop and keep repeating. The dots show what's saved. Click ✕ to clear a row.",
      art: "loop",
    },
    {
      title: "Make it yours",
      body: "Change the tempo, melody sound and volume in the white bar. Share copies a link to your song, and Save WAV downloads it.",
      art: "controls",
    },
  ];
}

function DemoVideo() {
  const [narrow] = useState(isNarrow);
  const [still] = useState(prefersReducedMotion);
  const name = `${import.meta.env.BASE_URL}tutorial/demo-${narrow ? "square" : "wide"}`;
  return (
    <video
      className={`tut-video tut-video--${narrow ? "square" : "wide"}`}
      src={`${name}.mp4`}
      poster={`${name}.jpg`}
      aria-label="A short silent demo: sweeping the coloured lanes, the loop, the controls, clearing a row, Share and Save WAV."
      muted
      loop
      playsInline
      autoPlay={!still}
      controls={still}
      preload="auto"
    />
  );
}

function Art({ kind, touch }) {
  const Pointer = touch ? Hand : MousePointer2;
  if (kind === "video") return <DemoVideo />;
  if (kind === "sweep") {
    return (
      <div className="tut-art tut-art--sweep" aria-hidden="true">
        <div className="tut-keys">
          {Array.from({ length: 6 }, (_, i) => <span key={i} style={{ "--i": i }} />)}
        </div>
        <Pointer className="tut-pointer" size={30} />
      </div>
    );
  }
  if (kind === "loop") {
    return (
      <div className="tut-art tut-art--loop" aria-hidden="true">
        {[1, 0, 1, 1, 0, 1, 0, 1].map((on, i) => (
          <span key={i} className={on ? "is-filled" : ""} style={{ "--i": i }} />
        ))}
        <span className="tut-x"><X size={16} /></span>
      </div>
    );
  }
  return (
    <div className="tut-art tut-art--controls" aria-hidden="true">
      <span className="tut-pill">Play</span>
      <span className="tut-slider"><span /></span>
      <span className="tut-pill tut-pill--light">Share</span>
    </div>
  );
}

export default function Tutorial({ onClose, onFinish }) {
  const [touch] = useState(isTouchDevice);
  const all = steps(touch);
  const [index, setIndex] = useState(0);
  const step = all[index];
  const last = index === all.length - 1;
  const nextRef = useRef(null);

  useEffect(() => {
    nextRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tut" role="dialog" aria-modal="true" aria-labelledby="tut-title">
      <div className="tut__card">
        <button type="button" className="tut__skip" onClick={onClose}>Skip</button>
        <Art kind={step.art} touch={touch} />
        <p className="tut__count">Step {index + 1} of {all.length}</p>
        <h2 id="tut-title" className="tut__title">{step.title}</h2>
        <p className="tut__body">{step.body}</p>

        <div className="tut__dots" aria-hidden="true">
          {all.map((_, i) => <span key={i} className={i === index ? "is-on" : ""} />)}
        </div>

        <div className="tut__nav">
          {index > 0 && (
            <button type="button" className="tut__btn tut__btn--light" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="tut__btn"
            onClick={last ? onFinish : () => setIndex(index + 1)}
          >
            {last ? "Start playing" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
