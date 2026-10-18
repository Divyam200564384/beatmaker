import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";
import { decodeSong } from "./song/codec.js";
import { createFakeContext } from "./test/fakeAudio.js";

const original = window.AudioContext;

function sweepMelody() {
  const keys = screen.getByRole("group", { name: "Melody keys" });
  vi.spyOn(keys, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000, top: 0, height: 72, right: 1000, bottom: 72 });
  for (let x = 0; x < 1000; x += 50) fireEvent.pointerMove(keys, { clientX: x, pointerId: 1 });
}

beforeEach(() => history.replaceState(null, "", "/"));
afterEach(() => {
  window.AudioContext = original;
  history.replaceState(null, "", "/");
});

describe("App", () => {
  test("sweeping before Start plays and records nothing", () => {
    window.AudioContext = function FakeAudioContext() {};
    render(<App />);
    expect(() => sweepMelody()).not.toThrow();
    expect(screen.getAllByRole("img", { name: "0 notes in loop" })).toHaveLength(4);
    expect(decodeSong(location.hash.slice(1)).lanes.melody.every((v) => v === -1)).toBe(true);
  });

  test("browsers without Web Audio see the unsupported message", () => {
    window.AudioContext = undefined;
    render(<App />);
    expect(screen.getByText("This browser can't play Web Audio. Try Chrome, Edge or Firefox.")).toBeInTheDocument();
  });

  test("after Start, sweeping records notes into the loop", async () => {
    window.AudioContext = function FakeAudioContext() {
      return Object.assign(createFakeContext(), { resume: () => Promise.resolve(), close: () => Promise.resolve() });
    };
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    sweepMelody();
    const melody = decodeSong(location.hash.slice(1)).lanes.melody;
    expect(melody.filter((v) => v !== -1).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });
});
