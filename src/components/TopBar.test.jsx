import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopBar from "./TopBar.jsx";
import StartOverlay from "./StartOverlay.jsx";
import SongActions from "./SongActions.jsx";
import { createDefaultSong } from "../song/model.js";

function setup(props = {}) {
  const handlers = {
    onPlay: vi.fn(), onStop: vi.fn(), onTempo: vi.fn(), onWaveform: vi.fn(), onVolume: vi.fn(),
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

});

describe("TopBar status", () => {
  test("shows the status message in a polite live region", () => {
    setup({ status: "Link copied" });
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });
});

describe("SongActions", () => {
  function setupActions(props = {}) {
    const h = { onShare: vi.fn(), onSaveWav: vi.fn(), onClearAll: vi.fn() };
    render(<SongActions busy={false} {...h} {...props} />);
    return h;
  }

  test("Share, Save WAV and Clear all call their handlers", async () => {
    const h = setupActions();
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await userEvent.click(screen.getByRole("button", { name: "Save WAV" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(h.onShare).toHaveBeenCalled();
    expect(h.onSaveWav).toHaveBeenCalled();
    expect(h.onClearAll).toHaveBeenCalled();
  });

  test("busy disables Save WAV and shows Saving…", () => {
    setupActions({ busy: true });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
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
