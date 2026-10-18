import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Lane, { zoneFromX } from "./Lane.jsx";
import { getLane } from "../music/lanes.js";

const melody = getLane("melody");
const empty = () => Array(16).fill(-1);

function setup(props = {}) {
  const onZone = vi.fn();
  const onClear = vi.fn();
  render(<Lane lane={melody} slots={empty()} currentSlot={null} onZone={onZone} onClear={onClear} {...props} />);
  const keys = screen.getByRole("group", { name: "Melody keys" });
  vi.spyOn(keys, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000, top: 0, height: 72, right: 1000, bottom: 72 });
  const move = (x, pointerId = 1) => fireEvent.pointerMove(keys, { clientX: x, pointerId });
  return { onZone, onClear, keys, move };
}

describe("zoneFromX", () => {
  test("maps x to a zone and clamps outside the bar", () => {
    const rect = { left: 100, width: 100 };
    expect(zoneFromX(150, rect, 4)).toBe(2);
    expect(zoneFromX(50, rect, 4)).toBe(0);
    expect(zoneFromX(250, rect, 4)).toBe(3);
  });
});

describe("Lane", () => {
  test("chord and drum keys use their zone names", () => {
    render(<Lane lane={getLane("drums")} slots={empty()} currentSlot={null} onZone={() => {}} onClear={() => {}} />);
    expect(screen.getByRole("button", { name: "Drums Hi-hat" })).toBeInTheDocument();
  });

  test("renders one uniquely named key per zone, with octave", () => {
    setup();
    const names = screen.getAllByRole("button", { name: /^Melody / }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5"].map((n) => `Melody ${n}`));
  });

  test("a fast sweep fires each zone once, in order", () => {
    const { onZone, move } = setup();
    for (let x = 0; x < 1000; x++) move(x);
    expect(onZone.mock.calls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((z) => ["melody", z]));
  });

  test("moving inside one zone fires once", () => {
    const { onZone, move } = setup();
    move(210);
    move(230);
    move(260);
    expect(onZone).toHaveBeenCalledTimes(1);
  });

  test("leaving and re-entering the same zone fires again", () => {
    const { onZone, move, keys } = setup();
    move(250);
    fireEvent.pointerLeave(keys, { pointerId: 1 });
    move(250);
    expect(onZone).toHaveBeenCalledTimes(2);
  });

  test("two pointers are tracked separately", () => {
    const { onZone, move } = setup();
    move(250, 1);
    move(750, 2);
    expect(onZone.mock.calls.map((c) => c[1])).toEqual([2, 7]);
  });

  test("pointerdown plays the zone under the pointer", () => {
    const { onZone, keys } = setup();
    fireEvent.pointerDown(keys, { clientX: 450, pointerId: 3 });
    expect(onZone).toHaveBeenCalledWith("melody", 4);
  });

  test("Enter on a focused key plays it", async () => {
    const { onZone } = setup();
    screen.getByRole("button", { name: "Melody G4" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onZone).toHaveBeenCalledWith("melody", 3);
  });

  test("the clear button clears the lane", async () => {
    const { onClear } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Clear melody" }));
    expect(onClear).toHaveBeenCalledWith("melody");
  });

  test("loop dots show recorded notes", () => {
    const slots = empty();
    slots[0] = 1;
    slots[4] = 2;
    slots[9] = 0;
    setup({ slots, currentSlot: 4 });
    expect(screen.getByRole("img", { name: "3 notes in loop" })).toBeInTheDocument();
  });
});
