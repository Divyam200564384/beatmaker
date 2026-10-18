import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopBar from "./TopBar.jsx";
import StartOverlay from "./StartOverlay.jsx";
import { createDefaultSong } from "../song/model.js";

function setup(props = {}) {
  const handlers = {
    onPlay: vi.fn(), onStop: vi.fn(), onTempo: vi.fn(), onWaveform: vi.fn(), onVolume: vi.fn(),
    onShare: vi.fn(), onSaveWav: vi.fn(), onClearAll: vi.fn(),
  };
  render(<TopBar song={createDefaultSong()} playing={false} busy={false} {...handlers} {...props} />);
  return handlers;
}

describe("TopBar", () => {
  test("Play calls onPlay when stopped", async () => {
    const h = setup();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(h.onPlay).toHaveBeenCalled();
  });

  test("Stop calls onStop when playing", async () => {
    const h = setup({ playing: true });
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(h.onStop).toHaveBeenCalled();
  });

  test("tempo slider reports a number and shows BPM", () => {
    const h = setup();
    expect(screen.getByText("100 BPM")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tempo"), { target: { value: "140" } });
    expect(h.onTempo).toHaveBeenCalledWith(140);
  });

  test("melody sound select reports the waveform", async () => {
    const h = setup();
    await userEvent.selectOptions(screen.getByLabelText("Melody sound"), "Triangle");
    expect(h.onWaveform).toHaveBeenCalledWith("triangle");
  });

  test("volume slider reports a number", () => {
    const h = setup();
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.5" } });
    expect(h.onVolume).toHaveBeenCalledWith(0.5);
  });

  test("busy disables Save WAV and shows Rendering…", () => {
    setup({ busy: true });
    const btn = screen.getByRole("button", { name: "Rendering…" });
    expect(btn).toBeDisabled();
  });

  test("Share and Clear all call their handlers", async () => {
    const h = setup();
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(h.onShare).toHaveBeenCalled();
    expect(h.onClearAll).toHaveBeenCalled();
  });

  test("Save WAV calls onSaveWav", async () => {
    const h = setup();
    await userEvent.click(screen.getByRole("button", { name: "Save WAV" }));
    expect(h.onSaveWav).toHaveBeenCalled();
  });
});

describe("StartOverlay", () => {
  test("Start calls onStart", async () => {
    const onStart = vi.fn();
    render(<StartOverlay supported onStart={onStart} />);
    expect(screen.getByRole("heading", { name: "Sweep across the colours to make music" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalled();
  });

  test("unsupported browsers see a message and no button", () => {
    render(<StartOverlay supported={false} onStart={() => {}} />);
    expect(screen.getByText("This browser can't play Web Audio. Try Chrome, Edge or Firefox.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
