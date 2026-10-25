import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// Most tests exercise the app itself, so the first-visit tutorial starts dismissed.
beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.setItem("beatmaker.tutorialSeen", "1");
});

// jsdom has no PointerEvent; a MouseEvent subclass carries clientX and pointerId.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type, props = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 1;
      this.pointerType = props.pointerType ?? "mouse";
    }
  }
  window.PointerEvent = PointerEvent;
}
