import { describe, expect, test } from "vitest";
import { CodecError, decodeSong, encodeSong } from "./codec.js";
import { WAVEFORMS, createDefaultSong, recordNote, setTempo, setVolume, setWaveform } from "./model.js";
import { LANES } from "../music/lanes.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Builds a string from raw field values with the spec §9 layout, so tests can
// produce out-of-range values the encoder would never emit.
function forge({ version = 2, tempo = 100, waveform = 1, volumeStep = 16, slots = {} } = {}) {
  const bits = [];
  const write = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  write(version, 6);
  write(tempo, 12);
  write(waveform, 6);
  write(volumeStep, 6);
  for (const lane of LANES) for (let s = 0; s < 16; s++) write(slots[lane.id]?.[s] ?? 15, 4);
  while (bits.length % 6) bits.push(0);
  let out = "";
  for (let i = 0; i < bits.length; i += 6) out += ALPHABET[parseInt(bits.slice(i, i + 6).join(""), 2)];
  return out;
}

function lcg(seed) {
  let x = seed;
  return () => (x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

function randomSong(rand) {
  let s = createDefaultSong();
  s = setTempo(s, 30 + Math.floor(rand() * 271));
  s = setWaveform(s, WAVEFORMS[Math.floor(rand() * 4)]);
  s = setVolume(s, Math.floor(rand() * 21) / 20);
  for (const lane of LANES)
    for (let slot = 0; slot < 16; slot++)
      if (rand() < 0.5) s = recordNote(s, lane.id, slot, Math.floor(rand() * lane.zones.length));
  return s;
}

describe("codec", () => {
  test("encodes the default song as 48 URL-safe characters", () => {
    const str = encodeSong(createDefaultSong());
    expect(str).toHaveLength(48);
    expect(str).toMatch(/^[A-Za-z0-9_-]{48}$/);
  });

  test("encoder matches the forged layout", () => {
    expect(encodeSong(createDefaultSong())).toBe(forge());
  });

  test("round-trips the default song", () => {
    const s = createDefaultSong();
    expect(decodeSong(encodeSong(s))).toEqual(s);
  });

  test("round-trips every lane filled with its maximum zone", () => {
    let s = createDefaultSong();
    for (const lane of LANES) for (let slot = 0; slot < 16; slot++) s = recordNote(s, lane.id, slot, lane.zones.length - 1);
    expect(decodeSong(encodeSong(s))).toEqual(s);
  });

  test("round-trips 20 seeded random songs", () => {
    const rand = lcg(42);
    for (let i = 0; i < 20; i++) {
      const s = randomSong(rand);
      expect(decodeSong(encodeSong(s))).toEqual(s);
    }
  });

  test("round-trips tempo, waveform and volume edges", () => {
    for (const tempo of [30, 300]) {
      const s = setTempo(createDefaultSong(), tempo);
      expect(decodeSong(encodeSong(s))).toEqual(s);
    }
    for (const w of WAVEFORMS) {
      const s = setWaveform(createDefaultSong(), w);
      expect(decodeSong(encodeSong(s))).toEqual(s);
    }
    for (const v of [0, 1]) {
      const s = setVolume(createDefaultSong(), v);
      expect(decodeSong(encodeSong(s))).toEqual(s);
    }
  });

  test.each([
    ["wrong length", forge().slice(0, 47)],
    ["bad character", "!" + forge().slice(1)],
    ["version 1", forge({ version: 1 })],
    ["tempo 29", forge({ tempo: 29 })],
    ["tempo 301", forge({ tempo: 301 })],
    ["waveform 4", forge({ waveform: 4 })],
    ["volume step 21", forge({ volumeStep: 21 })],
    ["melody zone 10", forge({ slots: { melody: [10] } })],
    ["chords zone 4", forge({ slots: { chords: [4] } })],
    ["bass zone 5", forge({ slots: { bass: [5] } })],
    ["drums zone 3", forge({ slots: { drums: [3] } })],
  ])("rejects %s", (_name, str) => {
    expect(() => decodeSong(str)).toThrow(CodecError);
  });
});
