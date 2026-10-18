import { describe, expect, test } from "vitest";
import { LANES, LANE_IDS, getLane, midiToFreq } from "./lanes.js";

describe("lanes", () => {
  test("midiToFreq anchors A4 at 440 Hz", () => {
    expect(midiToFreq(69)).toBe(440);
  });

  test("zone counts are 10, 4, 5, 3", () => {
    expect(LANES.map((l) => l.zones.length)).toEqual([10, 4, 5, 3]);
  });

  test("lanes are ordered melody, chords, bass, drums", () => {
    expect(LANE_IDS).toEqual(["melody", "chords", "bass", "drums"]);
  });

  test("every pitched note is in C pentatonic", () => {
    const pentatonic = new Set([0, 2, 4, 7, 9]);
    for (const lane of LANES)
      for (const zone of lane.zones)
        for (const m of zone.midi ?? []) expect(pentatonic.has(m % 12)).toBe(true);
  });

  test("melody spans C4..A5 and bass C2..A2", () => {
    expect(getLane("melody").zones.map((z) => z.midi[0])).toEqual([60, 62, 64, 67, 69, 72, 74, 76, 79, 81]);
    expect(getLane("bass").zones.map((z) => z.midi[0])).toEqual([36, 38, 40, 43, 45]);
  });

  test("chord zones", () => {
    expect(getLane("chords").zones.map((z) => [z.label, z.midi])).toEqual([
      ["C", [48, 52, 55]],
      ["Am", [45, 48, 52]],
      ["Gsus4", [43, 48, 50]],
      ["Csus2", [48, 50, 55]],
    ]);
  });

  test("drum zones", () => {
    expect(getLane("drums").zones.map((z) => z.drum)).toEqual(["kick", "snare", "hat"]);
  });

  test("each lane carries a CSS var name and its hex colour", () => {
    expect(LANES.map((l) => [l.color, l.hex])).toEqual([
      ["--melody", "#2C5BE8"],
      ["--chords", "#8B4BD6"],
      ["--bass", "#13906A"],
      ["--drums", "#E8632B"],
    ]);
  });
});
