import { describe, expect, test } from "vitest";
import {
  SLOTS, TEMPO_MIN, TEMPO_MAX, WAVEFORMS,
  createDefaultSong, recordNote, clearLane, clearAll, setTempo, setWaveform, setVolume,
} from "./model.js";

const empty = () => Array(16).fill(-1);
const clone = (x) => JSON.parse(JSON.stringify(x));

describe("song model", () => {
  test("constants", () => {
    expect([SLOTS, TEMPO_MIN, TEMPO_MAX]).toEqual([16, 30, 300]);
    expect(WAVEFORMS).toEqual(["sine", "square", "sawtooth", "triangle"]);
  });

  test("default song", () => {
    expect(createDefaultSong()).toEqual({
      version: 2, tempo: 100, waveform: "square", volume: 0.8,
      lanes: { melody: empty(), chords: empty(), bass: empty(), drums: empty() },
    });
  });

  test("recordNote sets a slot without mutating the input", () => {
    const s = createDefaultSong();
    const before = clone(s);
    const next = recordNote(s, "bass", 3, 2);
    expect(next.lanes.bass[3]).toBe(2);
    expect(s).toEqual(before);
  });

  test("rapid overwrites into one slot keep the last zone only", () => {
    let s = createDefaultSong();
    for (let z = 0; z <= 9; z++) s = recordNote(s, "melody", 5, z);
    const expected = empty();
    expected[5] = 9;
    expect(s.lanes.melody).toEqual(expected);
  });

  test("recordNote rejects out-of-range input", () => {
    const s = createDefaultSong();
    expect(() => recordNote(s, "melody", 16, 0)).toThrow(RangeError);
    expect(() => recordNote(s, "melody", 0, 10)).toThrow(RangeError);
    expect(() => recordNote(s, "chords", 0, 4)).toThrow(RangeError);
    expect(() => recordNote(s, "kazoo", 0, 0)).toThrow(RangeError);
  });

  test("clearLane resets one lane; clearAll resets every lane and keeps settings", () => {
    let s = recordNote(recordNote(createDefaultSong(), "bass", 1, 1), "drums", 2, 2);
    s = setTempo(s, 140);
    expect(clearLane(s, "bass").lanes.bass).toEqual(empty());
    expect(clearLane(s, "bass").lanes.drums[2]).toBe(2);
    const all = clearAll(s);
    expect(Object.values(all.lanes)).toEqual([empty(), empty(), empty(), empty()]);
    expect([all.tempo, all.waveform, all.volume]).toEqual([140, "square", 0.8]);
  });

  test("setters clamp and validate", () => {
    const s = createDefaultSong();
    expect(setTempo(s, 12).tempo).toBe(30);
    expect(setTempo(s, 999).tempo).toBe(300);
    expect(setTempo(s, 120.6).tempo).toBe(121);
    expect(setVolume(s, 0.83).volume).toBe(0.85);
    expect(setVolume(s, -1).volume).toBe(0);
    expect(setWaveform(s, "triangle").waveform).toBe("triangle");
    expect(setWaveform(s, "noise")).toBe(s);
  });
});
