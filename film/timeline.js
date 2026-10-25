// The whole film as data. Every state is a pure function of time t, so any
// frame can be rendered on its own and gives the same pixels every time.
import { LANES } from "../src/music/lanes.js";
import { slotDuration } from "../src/audio/quantize.js";
import { createDefaultSong, recordNote, clearLane, setTempo, setWaveform, setVolume, SLOTS, TEMPO_MIN, TEMPO_MAX } from "../src/song/model.js";

// Storyboard seconds × PACE = film seconds. Raise PACE to slow the whole film;
// the app itself (key pops, BPM) keeps real time.
export const PACE = 1.3;
export const sec = (x) => x * PACE;
export const DURATION = sec(19.6);
const DT = 1 / 1000;

// ---------- easing ----------
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, k) => a + (b - a) * k;

function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 30; i++) {
      u = (lo + hi) / 2;
      if (sx(u) < x) lo = u; else hi = u;
    }
    return sy(u);
  };
}
// Leaves quickly, lands slowly: readable target → fast exit → slowing arrival.
export const easeMove = bezier(0.55, 0, 0.15, 1);
export const easeOut = bezier(0.2, 0.7, 0.3, 1);
export const easeIn = bezier(0.6, 0, 0.9, 0.4);
export const linear = (x) => x;

// ---------- the script ----------
// Layout helpers (`L`) return points/rects in app ("world") pixels, measured
// from the real rendered components.
export function buildScript(L, touch) {
  const M = "melody", C = "chords", B = "bass", D = "drums";

  const tempoAt = (t) => Math.round(lerp(100, 160, easeMove(clamp01((t - sec(7.2)) / sec(0.55)))));
  const volumeAt = (t) => Math.round(lerp(0.8, 0.6, clamp01((t - sec(8.65)) / sec(0.3))) * 20) / 20;

  // Loop clock: slots elapsed since Play, integrating the live tempo.
  const phase = new Float64Array(Math.ceil(DURATION / DT) + 2);
  for (let i = 1; i < phase.length; i++) phase[i] = phase[i - 1] + DT / slotDuration(tempoAt(i * DT));
  const phaseAt = (t) => phase[Math.min(phase.length - 1, Math.max(0, Math.round(t / DT)))];

  // The pointer rides the playhead: it hops from dot to dot with the loop.
  const playhead = (t) => {
    const ph = phaseAt(t) % SLOTS;
    const i = Math.floor(ph);
    const a = L.dot(M, i), b = L.dot(M, (i + 1) % SLOTS);
    const k = easeMove(clamp01((ph - i) / 0.6));
    return { x: lerp(a.x, b.x, k) + 2, y: lerp(a.y, b.y, k) + 4 };
  };

  // Mouse travel follows the column right of the keys, so it never brushes a
  // key on the way (hovering plays in the real app).
  const col = (y) => ({ x: L.columnX(), y });

  const w = []; // pointer waypoints { t, p, ease, down }
  const at = (t, p, opt = {}) => w.push({ t, p, ease: opt.ease ?? easeMove, down: opt.down ?? false });

  // Opening: pointer waits beside the Melody lane, hidden under the title.
  at(sec(0), L.keyEdge(M, "left"));
  at(sec(1.25), L.keyEdge(M, "left"));
  // 1 · sweep the melody
  at(sec(1.5), L.key(M, 0, 0.5), { down: touch });
  at(sec(3.1), L.key(M, 9, 0.5), { ease: linear, down: touch });
  at(sec(3.4), L.keyEdge(M, "right"));
  // 2 · strum down through three lanes, then a drum pattern
  at(sec(3.95), L.keyEdge(C, "right"));
  at(sec(4.1), L.key(C, 3, 0.4), { ease: easeOut, down: touch });
  at(sec(4.75), L.key(D, 0, 0.5), { ease: linear, down: touch });
  at(sec(4.9), L.key(D, 0, 0.55), { down: touch });
  at(sec(5.25), L.key(D, 2, 0.5), { ease: linear, down: touch });
  at(sec(5.6), L.key(D, 0, 0.45), { ease: linear, down: touch });
  at(sec(5.95), L.key(D, 2, 0.5), { ease: linear, down: touch });
  at(sec(6.25), L.keyEdge(D, "right"));
  // 3 · controls: tempo 100 → 160, sound → Triangle, volume 0.8 → 0.6
  if (!touch) at(sec(6.65), col(L.thumb("tempo", 100).y));
  at(sec(6.95), L.thumb("tempo", 100));
  at(sec(7.2), L.thumb("tempo", 100));
  at(sec(7.75), L.thumb("tempo", 160));
  at(sec(8.05), L.center("select"));
  at(sec(8.25), L.center("select"));
  at(sec(8.55), L.thumb("volume", 0.8));
  at(sec(8.65), L.thumb("volume", 0.8));
  at(sec(8.95), L.thumb("volume", 0.6));
  // 4 · the loop: the pointer rides the playhead
  if (!touch) at(sec(9.3), col(L.thumb("volume", 0.6).y));
  at(sec(9.65), playhead);
  at(sec(11.55), playhead, { ease: linear });
  // 5 · clear the drums, then play a new pattern
  at(sec(12.1), L.center("clear-drums"));
  at(sec(12.45), L.center("clear-drums"));
  at(sec(12.7), L.keyEdge(D, "right"));
  at(sec(12.8), L.key(D, 2, 0.5), { down: touch });
  at(sec(13.05), L.key(D, 1, 0.5), { ease: linear, down: touch });
  at(sec(13.3), L.key(D, 2, 0.5), { ease: linear, down: touch });
  at(sec(13.5), L.keyEdge(D, "right"));
  // 6 · share and save
  if (!touch) at(sec(14.0), col(L.center("share").y));
  at(sec(14.4), L.center("share"));
  at(sec(14.75), L.center("share"));
  at(sec(15.25), L.center("save"));
  at(sec(16.3), L.center("save"));
  // 7 · your turn: sweep the melody again under the call to action
  if (!touch) at(sec(16.75), { x: L.keyEdge(M, "left").x, y: L.thumb("tempo", 160).y });
  at(sec(17.05), L.keyEdge(M, "left"));
  at(sec(17.3), L.key(M, 0, 0.5), { down: touch });
  at(sec(18.6), L.key(M, 9, 0.5), { ease: linear, down: touch });
  at(sec(18.9), L.keyEdge(M, "right"));
  at(DURATION, L.keyEdge(M, "right"));

  const clicks = [
    { t: sec(7.2), until: sec(7.8) }, // grab the tempo thumb
    { t: sec(8.25) },
    { t: sec(8.65), until: sec(9.0) },
    { t: sec(12.45) },
    { t: sec(14.75) },
    { t: sec(15.6) },
  ];

  const actions = [
    { t: sec(8.27), apply: (s) => setWaveform(s, "triangle") },
    { t: sec(12.47), apply: (s) => clearLane(s, D) },
  ];
  const status = [
    { t: sec(14.77), text: "Link copied" },
    { t: sec(16.25), text: "WAV saved" },
  ];
  const busy = { from: sec(15.62), to: sec(16.25) };

  // Close-ups track the pointer (a lagged copy, so the camera trails the hand).
  const follow = (width, bounds, lag = sec(0.15), from) => (width ? { follow: { width, bounds, lag, from } } : {});
  const shots = [
    { at: sec(0), rect: L.rect("app"), band: false },
    { at: sec(0.95), ...follow(touch ? 0 : 560, L.lanes([M])), rect: L.lanes([M]), dur: sec(0.7) },
    { at: sec(3.3), rect: touch ? L.lanes([C, B, D]) : L.keysUnion([C, B, D]) },
    { at: sec(6.3), ...follow(touch ? 0 : 820, L.rect("topbar"), 0.2, sec(6.95)), rect: L.controls() },
    { at: sec(9.05), rect: L.dots() },
    { at: sec(11.75), rect: touch ? L.lanes([D]) : L.drumsEnd() },
    { at: sec(13.65), rect: L.shareArea() },
    { at: sec(16.5), rect: L.lanes([M, C, B, D]), dur: sec(0.8), area: "lower", band: false },
    { at: sec(19.0), rect: L.rect("app"), dur: sec(0.6), band: false },
  ];

  const captions = [
    { from: sec(1.35), to: sec(3.25), text: touch ? "Drag across a colour" : "Sweep across a colour" },
    { from: sec(3.55), to: sec(6.15), text: "Strum across the lanes" },
    { from: sec(6.5), to: sec(9.0), text: "Tempo, sound and volume" },
    { from: sec(9.25), to: sec(11.65), text: "It keeps looping" },
    { from: sec(11.95), to: sec(13.55), text: "Clear a row, try again" },
    { from: sec(13.85), to: sec(16.35), text: "Share it or save it" },
  ];

  return { waypoints: w, clicks, tempoAt, volumeAt, phaseAt, actions, status, busy, shots, captions };
}

// ---------- pointer ----------
// A waypoint may be a fixed point or a function of time (e.g. the playhead).
const resolve = (p, t) => (typeof p === "function" ? p(t) : p);

export function pointerAt(script, t) {
  const w = script.waypoints;
  if (t <= w[0].t) return { ...resolve(w[0].p, t), down: w[0].down };
  for (let i = 1; i < w.length; i++) {
    const b = w[i];
    if (t <= b.t) {
      const a = w[i - 1];
      const k = b.ease(clamp01((t - a.t) / (b.t - a.t)));
      const pa = resolve(a.p, t), pb = resolve(b.p, t);
      // A press lasts over a segment only if both ends are pressed.
      return { x: lerp(pa.x, pb.x, k), y: lerp(pa.y, pb.y, k), down: a.down && b.down };
    }
  }
  const last = w[w.length - 1];
  return { ...resolve(last.p, t), down: last.down };
}

// ---------- simulation of the real app logic ----------
// Mirrors Lane.handlePointer: entering a key fires it, and every key a fast
// move skipped over fires too, in order. Mouse plays on hover; touch only
// while the finger is down.
export function simulate(script, L, touch) {
  const hits = [];
  const last = new Map();
  for (let t = 0; t <= DURATION; t += DT) {
    const p = pointerAt(script, t);
    for (const lane of LANES) {
      const r = L.keysRect(lane.id);
      const inside = p.x >= r.left && p.x < r.right && p.y >= r.top && p.y <= r.bottom;
      const active = inside && (!touch || p.down);
      if (!active) {
        last.delete(lane.id);
        continue;
      }
      const count = lane.zones.length;
      const zone = Math.min(count - 1, Math.max(0, Math.floor(((p.x - r.left) / r.width) * count)));
      const prev = last.get(lane.id);
      if (prev === zone) continue;
      last.set(lane.id, zone);
      if (prev !== undefined) {
        const step = zone > prev ? 1 : -1;
        for (let z = prev + step; z !== zone; z += step) hits.push({ t, lane: lane.id, zone: z });
      }
      hits.push({ t, lane: lane.id, zone });
    }
  }

  // Notes land in the slot nearest the moment they're played (scheduler.slotAt).
  const { phaseAt } = script;
  const timeline = [
    ...hits.map((h) => ({ t: h.t, apply: (s) => recordNote(s, h.lane, Math.round(phaseAt(h.t)) % SLOTS, h.zone) })),
    ...script.actions,
  ].sort((a, b) => a.t - b.t);

  return { hits, phaseAt, timeline };
}

export function songAt(script, sim, t) {
  let song = createDefaultSong();
  for (const e of sim.timeline) {
    if (e.t > t) break;
    song = e.apply(song);
  }
  song = setTempo(song, script.tempoAt(t));
  song = setVolume(song, script.volumeAt(t));
  return song;
}

export function currentSlotAt(sim, t) {
  return Math.floor(sim.phaseAt(t)) % SLOTS;
}

export function statusAt(script, t) {
  let text = null;
  for (const s of script.status) if (t >= s.t && t < s.t + 4) text = s.text;
  return text;
}

export const tempoFraction = (bpm) => (bpm - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN);
