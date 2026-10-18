import { expect, test } from "vitest";
import { slotDuration } from "./quantize.js";

test("slotDuration is an eighth note", () => {
  expect(slotDuration(100)).toBeCloseTo(0.3, 12);
  expect(slotDuration(60)).toBeCloseTo(0.5, 12);
});
