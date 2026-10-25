import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";
import { TUTORIAL_KEY } from "./Tutorial.jsx";
import { createFakeContext } from "../test/fakeAudio.js";

const originalAudio = window.AudioContext;
const originalMatch = window.matchMedia;

function mockPointer(coarse) {
  window.matchMedia = (q) => ({ matches: coarse && q === "(pointer: coarse)", media: q });
}

beforeEach(() => {
  localStorage.removeItem(TUTORIAL_KEY);
  history.replaceState(null, "", "/");
  window.AudioContext = function FakeAudioContext() {
    return Object.assign(createFakeContext(), { resume: () => Promise.resolve(), close: () => Promise.resolve() });
  };
});

afterEach(() => {
  window.AudioContext = originalAudio;
  window.matchMedia = originalMatch;
});

describe("first-visit tutorial", () => {
  test("shows on the first visit and not after it is skipped", async () => {
    const { unmount } = render(<App />);
    expect(screen.getByRole("dialog", { name: "Welcome to Beatmaker" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    render(<App />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("uses mouse wording on laptops and finger wording on phones", async () => {
    mockPointer(false);
    const { unmount } = render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Move your mouse across a colour" })).toBeInTheDocument();
    unmount();

    localStorage.removeItem(TUTORIAL_KEY);
    mockPointer(true);
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Drag your finger across a colour" })).toBeInTheDocument();
  });

  test("the last step starts the music", async () => {
    render(<App />);
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Start playing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(localStorage.getItem(TUTORIAL_KEY)).toBe("1");
  });

  test("How to play reopens it", async () => {
    localStorage.setItem(TUTORIAL_KEY, "1");
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
