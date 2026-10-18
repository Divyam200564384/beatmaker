import { beforeEach, describe, expect, test, vi } from "vitest";
import { playZone } from "./playZone.js";
import { scheduleSlot } from "./scheduleSlot.js";
import { midiToFreq } from "../music/lanes.js";
import { createDefaultSong, recordNote, setWaveform } from "../song/model.js";

let inst;
const ctx = {};
const out = {};
beforeEach(() => {
  inst = {
    playMelody: vi.fn(), playBass: vi.fn(), playChord: vi.fn(),
    playKick: vi.fn(), playSnare: vi.fn(), playHat: vi.fn(),
  };
});

describe("playZone", () => {
  test("melody plays the zone's note with the song waveform", () => {
    const song = setWaveform(createDefaultSong(), "triangle");
    playZone(ctx, out, song, "melody", 2, 1.0, inst);
    expect(inst.playMelody).toHaveBeenCalledWith(ctx, out, 1.0, midiToFreq(64), "triangle");
  });

  test("chords zone 1 plays A minor", () => {
    playZone(ctx, out, createDefaultSong(), "chords", 1, 0, inst);
    expect(inst.playChord).toHaveBeenCalledWith(ctx, out, 0, [45, 48, 52].map(midiToFreq));
  });

  test("bass zone 0 plays C2", () => {
    playZone(ctx, out, createDefaultSong(), "bass", 0, 0, inst);
    expect(inst.playBass).toHaveBeenCalledWith(ctx, out, 0, midiToFreq(36));
  });

  test("drum zones play kick, snare, hat", () => {
    const song = createDefaultSong();
    [0, 1, 2].forEach((z) => playZone(ctx, out, song, "drums", z, 0, inst));
    expect(inst.playKick).toHaveBeenCalledTimes(1);
    expect(inst.playSnare).toHaveBeenCalledTimes(1);
    expect(inst.playHat).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleSlot", () => {
  const song = recordNote(recordNote(createDefaultSong(), "melody", 4, 2), "drums", 4, 0);

  test("plays every lane recorded in the slot", () => {
    scheduleSlot(ctx, out, song, 4, 3, new Set(), inst);
    expect(inst.playMelody).toHaveBeenCalledWith(ctx, out, 3, midiToFreq(64), "square");
    expect(inst.playKick).toHaveBeenCalledWith(ctx, out, 3);
    const total = Object.values(inst).reduce((n, f) => n + f.mock.calls.length, 0);
    expect(total).toBe(2);
  });

  test("an empty slot plays nothing", () => {
    scheduleSlot(ctx, out, song, 5, 3, new Set(), inst);
    expect(Object.values(inst).every((f) => f.mock.calls.length === 0)).toBe(true);
  });

  test("skipped lane:slot keys are not played", () => {
    scheduleSlot(ctx, out, song, 4, 3, new Set(["drums:4"]), inst);
    expect(inst.playMelody).toHaveBeenCalledTimes(1);
    expect(inst.playKick).not.toHaveBeenCalled();
  });
});
