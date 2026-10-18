// Immutable song model: every function returns a new song.
import { LANE_IDS, getLane } from "../music/lanes.js";

export const SLOTS = 16;
export const TEMPO_MIN = 30;
export const TEMPO_MAX = 300;
export const WAVEFORMS = ["sine", "square", "sawtooth", "triangle"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const emptyLane = () => Array(SLOTS).fill(-1);

export function createDefaultSong() {
  return {
    version: 2,
    tempo: 100,
    waveform: "square",
    volume: 0.8,
    lanes: Object.fromEntries(LANE_IDS.map((id) => [id, emptyLane()])),
  };
}

function withLane(song, laneId, slots) {
  return { ...song, lanes: { ...song.lanes, [laneId]: slots } };
}

export function recordNote(song, laneId, slot, zone) {
  const lane = getLane(laneId);
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) throw new RangeError(`Bad slot: ${slot}`);
  if (!Number.isInteger(zone) || zone < 0 || zone >= lane.zones.length)
    throw new RangeError(`Bad zone ${zone} for ${laneId}`);
  const slots = [...song.lanes[laneId]];
  slots[slot] = zone;
  return withLane(song, laneId, slots);
}

export function clearLane(song, laneId) {
  getLane(laneId);
  return withLane(song, laneId, emptyLane());
}

export function clearAll(song) {
  return { ...song, lanes: createDefaultSong().lanes };
}

export function setTempo(song, bpm) {
  return { ...song, tempo: clamp(Math.round(bpm), TEMPO_MIN, TEMPO_MAX) };
}

export function setWaveform(song, waveform) {
  return WAVEFORMS.includes(waveform) ? { ...song, waveform } : song;
}

export function setVolume(song, volume) {
  return { ...song, volume: clamp(Math.round(volume * 20) / 20, 0, 1) };
}
