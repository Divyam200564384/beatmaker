import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";
import { decodeSong, encodeSong } from "./song/codec.js";
import { createDefaultSong, setVolume } from "./song/model.js";
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

describe("App audio lifetime", () => {
  const fakeCtor = (made) =>
    function FakeAudioContext() {
      const ctx = Object.assign(createFakeContext(), { state: "running", resume: () => Promise.resolve() });
      ctx.close = () => { ctx.state = "closed"; return Promise.resolve(); };
      made.push(ctx);
      return ctx;
    };

  test("works under StrictMode: Start then sweep records notes", async () => {
    const made = [];
    window.AudioContext = fakeCtor(made);
    render(<StrictMode><App /></StrictMode>);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    sweepMelody();
    expect(made.at(-1).state).toBe("running");
    expect(decodeSong(location.hash.slice(1)).lanes.melody.some((v) => v !== -1)).toBe(true);
  });

  test("unmounting after Start closes the audio context", async () => {
    const made = [];
    window.AudioContext = fakeCtor(made);
    const { unmount } = render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    unmount();
    expect(made.every((c) => c.state === "closed")).toBe(true);
  });
});

describe("App (final review)", () => {
  test("a second bad link in a row shows the message again", () => {
    vi.useFakeTimers();
    try {
      window.AudioContext = function FakeAudioContext() {};
      history.replaceState(null, "", "#bad-one");
      render(<App />);
      expect(screen.getByRole("status")).toHaveTextContent("Couldn't read that song link");
      act(() => vi.advanceTimersByTime(4500));
      expect(screen.getByRole("status")).toHaveTextContent("");
      act(() => {
        history.replaceState(null, "", "#bad-two");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      expect(screen.getByRole("status")).toHaveTextContent("Couldn't read that song link");
    } finally {
      vi.useRealTimers();
    }
  });

  test("loading a link while playing applies its volume to the audio", async () => {
    const made = [];
    window.AudioContext = function FakeAudioContext() {
      const c = Object.assign(createFakeContext(), { resume: () => Promise.resolve(), close: () => Promise.resolve() });
      made.push(c);
      return c;
    };
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const master = made[0].created.find((n) => n.kind === "gain");
    act(() => {
      history.replaceState(null, "", "#" + encodeSong(setVolume(createDefaultSong(), 0.2)));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(master.gain.value).toBeCloseTo(0.2, 6);
  });
});
