import { describe, expect, test } from "vitest";
import { contrastRatio, keyColor, keyTextColor, mixWithWhite } from "./contrast.js";
import { LANES } from "../music/lanes.js";

describe("contrast", () => {
  test("black on white is 21:1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });

  test("mixWithWhite at 0 keeps the colour and at 1 gives white", () => {
    expect(mixWithWhite("#2C5BE8", 0)).toBe("#2C5BE8");
    expect(mixWithWhite("#2C5BE8", 1)).toBe("#FFFFFF");
  });

  test("keys shade from 55% ink (lowest) to 25% ink (highest)", () => {
    expect(keyColor("#FFFFFF", 0, 3)).toBe("#7F849B");
    expect(keyColor("#FFFFFF", 2, 3)).toBe("#C5C7D2");
  });

  test("every key label meets 4.5:1 on its key colour", () => {
    for (const lane of LANES) {
      const n = lane.zones.length;
      for (let i = 0; i < n; i++) {
        const bg = keyColor(lane.hex, i, n);
        expect(contrastRatio(bg, keyTextColor(lane.hex, i, n)), `${lane.id} key ${i}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("ink text meets 4.5:1 on the sky background", () => {
    expect(contrastRatio("#16204A", "#E6EEFB")).toBeGreaterThanOrEqual(4.5);
  });
});
