import { useEffect, useRef, useState } from "react";
import Lane from "./components/Lane.jsx";
import StartOverlay from "./components/StartOverlay.jsx";
import TopBar from "./components/TopBar.jsx";
import SongActions from "./components/SongActions.jsx";
import { LANES } from "./music/lanes.js";
import { createEngine } from "./audio/engine.js";
import { createScheduler } from "./audio/scheduler.js";
import { playZone } from "./audio/playZone.js";
import { quantize } from "./audio/quantize.js";
import { renderSongToWav, wavFileName } from "./audio/renderWav.js";
import { clearAll, clearLane, recordNote, setTempo, setVolume, setWaveform } from "./song/model.js";
import { useSongUrl } from "./useSongUrl.js";
import "./App.css";

const STATUS_MS = 4000;

export default function App() {
  const [song, setSong, linkError] = useSongUrl();
  const songRef = useRef(song);
  songRef.current = song;

  const engineRef = useRef(null);
  const schedulerRef = useRef(null);
  const [engine, setEngine] = useState(null);
  const started = engine !== null;
  const [playing, setPlaying] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [shareFallback, setShareFallback] = useState(null);
  const supported = typeof window.AudioContext === "function";

  useEffect(() => {
    if (linkError) setStatus(linkError);
  }, [linkError]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(t);
  }, [status]);

  // The loop clock lives exactly as long as the engine it drives. Tying both
  // to one effect means a teardown (including StrictMode's practice unmount)
  // can only close the engine that the same effect set up.
  useEffect(() => {
    if (!engine) return;
    const scheduler = createScheduler({
      ctx: engine.ctx,
      out: engine.out,
      getSong: () => songRef.current,
      onSlot: setCurrentSlot,
    });
    engineRef.current = engine;
    schedulerRef.current = scheduler;
    scheduler.start();
    return () => {
      scheduler.stop();
      engine.ctx.close?.();
      engineRef.current = null;
      schedulerRef.current = null;
    };
  }, [engine]);

  // Created inside the Start tap: browsers only allow audio after a gesture.
  function start() {
    const created = createEngine(songRef.current.volume);
    created.resume();
    setEngine(created);
    setPlaying(true);
  }

  function play() {
    engineRef.current?.resume();
    schedulerRef.current?.start();
    setPlaying(true);
  }

  function stop() {
    schedulerRef.current?.stop();
    setPlaying(false);
    setCurrentSlot(null);
  }

  function handleZone(laneId, zone) {
    const engine = engineRef.current;
    if (!engine) return;
    const { ctx, out } = engine;
    playZone(ctx, out, songRef.current, laneId, zone, ctx.currentTime);
    const scheduler = schedulerRef.current;
    if (!scheduler?.isRunning()) return;
    const slot = quantize(ctx.currentTime, scheduler.loopStartTime(), songRef.current.tempo);
    scheduler.suppress(laneId, slot);
    setSong((s) => recordNote(s, laneId, slot, zone));
  }

  function handleVolume(v) {
    setSong((s) => setVolume(s, v));
    engineRef.current?.setVolume(v);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setShareFallback(null);
      setStatus("Link copied");
    } catch {
      setShareFallback(location.href);
    }
  }

  async function saveWav() {
    setBusy(true);
    try {
      const blob = await renderSongToWav(songRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = wavFileName(songRef.current);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("WAV saved");
    } catch {
      setStatus("Couldn't save the WAV file. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__intro">
          <h1 className="app__title">Beatmaker</h1>
          <p className="app__help">Move across a colour to play it. Everything you play joins the loop.</p>
        </div>
        <SongActions busy={busy} onShare={share} onSaveWav={saveWav} onClearAll={() => setSong(clearAll)} />
      </header>

      <TopBar
        song={song}
        playing={playing}
        status={status}
        onPlay={started ? play : start}
        onStop={stop}
        onTempo={(bpm) => setSong((s) => setTempo(s, bpm))}
        onWaveform={(w) => setSong((s) => setWaveform(s, w))}
        onVolume={handleVolume}
      />

      {shareFallback && (
        <label className="app__share">
          Copy this link
          <input readOnly value={shareFallback} onFocus={(e) => e.target.select()} autoFocus />
        </label>
      )}

      <div className="app__stage">
        <div className="app__lanes">
          {LANES.map((lane) => (
            <Lane
              key={lane.id}
              lane={lane}
              slots={song.lanes[lane.id]}
              currentSlot={currentSlot}
              onZone={handleZone}
              onClear={(id) => setSong((s) => clearLane(s, id))}
            />
          ))}
        </div>
        {!started && <StartOverlay supported={supported} onStart={start} />}
      </div>
    </main>
  );
}
