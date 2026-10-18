import { describe, expect, test } from "vitest";
import { quantize, slotDuration } from "./quantize.js";

describe("quantize", () => {
  test("slotDuration is an eighth note", () => {
    expect(slotDuration(100)).toBeCloseTo(0.3, 12);
  });

  test("snaps to the nearest slot at tempo 100", () => {
    expect(quantize(10.0, 10, 100)).toBe(0);
    expect(quantize(10.14, 10, 100)).toBe(0);
    expect(quantize(10.16, 10, 100)).toBe(1);
  });

  test("wraps past the last slot", () => {
    expect(quantize(10 + 0.3 * 15.6, 10, 100)).toBe(0);
  });

  test("a time just before the loop anchor rounds to slot 0", () => {
    expect(quantize(9.9, 10, 100)).toBe(0);
  });

  test("works at tempo 60 and 300", () => {
    expect(quantize(10 + 2.5, 10, 60)).toBe(5);
    expect(quantize(10 + 0.55, 10, 300)).toBe(6);
  });
});
