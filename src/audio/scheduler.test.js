import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createScheduler } from "./scheduler.js";
import { createDefaultSong, setTempo } from "../song/model.js";

let ctx, song, schedule, onSlot, scheduler;

function advance(time) {
  ctx.currentTime = time;
  vi.advanceTimersByTime(100);
}
const calls = () => schedule.mock.calls.map(([, , , slot, time, skip]) => ({ slot, time, skip }));

beforeEach(() => {
  vi.useFakeTimers();
  ctx = { currentTime: 0 };
  song = createDefaultSong();
  schedule = vi.fn();
  onSlot = vi.fn();
  scheduler = createScheduler({ ctx, out: {}, getSong: () => song, onSlot, schedule });
});
afterEach(() => {
  scheduler.stop();
  vi.useRealTimers();
});

describe("scheduler", () => {
  test("first slot is 0, scheduled 50 ms ahead", () => {
    scheduler.start();
    expect(calls()[0]).toMatchObject({ slot: 0, time: 0.05 });
    expect(scheduler.isRunning()).toBe(true);
  });

  test("slots are an eighth note apart at tempo 100", () => {
    scheduler.start();
    advance(1.0);
    const c = calls();
    expect(c.map((x) => x.slot)).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < c.length; i++) expect(c[i].time - c[i - 1].time).toBeCloseTo(0.3, 9);
  });

  test("wraps to slot 0 after 16 slots and re-anchors the loop start", () => {
    scheduler.start();
    advance(4.8);
    const c = calls();
    expect(c).toHaveLength(17);
    expect(c[16].slot).toBe(0);
    expect(scheduler.loopStartTime()).toBeCloseTo(c[16].time, 9);
  });

  test("a tempo change applies from the next slot with no repeat or gap", () => {
    scheduler.start();
    advance(0.7); // slots 0,1,2 scheduled
    song = setTempo(song, 200);
    advance(1.5);
    const c = calls();
    expect(c.map((x) => x.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let i = 4; i < c.length; i++) expect(c[i].time - c[i - 1].time).toBeCloseTo(0.15, 9);
  });

  test("a suppressed lane:slot is skipped once", () => {
    scheduler.start();
    advance(0.25);
    scheduler.suppress("drums", 1);
    advance(0.3);
    expect(calls()[1]).toMatchObject({ slot: 1 });
    expect(calls()[1].skip.has("drums:1")).toBe(true);
    advance(5.1);
    const later = calls().filter((x) => x.slot === 1);
    expect(later).toHaveLength(2);
    expect(later[1].skip.has("drums:1")).toBe(false);
  });

  test("reports each slot when it is heard", () => {
    scheduler.start();
    vi.advanceTimersByTime(60);
    expect(onSlot).toHaveBeenCalledWith(0);
  });

  test("stop halts scheduling", () => {
    scheduler.start();
    scheduler.stop();
    const n = schedule.mock.calls.length;
    advance(3);
    expect(schedule.mock.calls.length).toBe(n);
    expect(scheduler.isRunning()).toBe(false);
  });
});

describe("scheduler slot grid (final review)", () => {
  test("slotAt maps a time to the slot actually scheduled there after a mid-loop tempo change", () => {
    scheduler.start();
    advance(2.5); // slots 0..8 at tempo 100 (0.05 .. 2.45)
    song = setTempo(song, 60);
    advance(3.3); // slots 9 (2.75) and 10 (3.25) at 60 BPM spacing after slot 9
    const slot10 = calls().find((c) => c.slot === 10);
    expect(scheduler.slotAt(slot10.time)).toBe(10);
    expect(scheduler.slotAt(slot10.time + 0.2)).toBe(10);
  });

  test("slotAt rounds to the upcoming unscheduled slot when that is nearest", () => {
    scheduler.start();
    advance(0.0); // slot 0 at 0.05 queued, next slot 1 at 0.35
    expect(scheduler.slotAt(0.3)).toBe(1);
    expect(scheduler.slotAt(0.1)).toBe(0);
  });

  test("at 60 BPM a live hit 0.2 s before the next unqueued slot is not heard twice", () => {
    song = setTempo(song, 60);
    scheduler.start(); // slot 0 at 0.05, next slot 1 at 0.55 (not yet queued)
    ctx.currentTime = 0.35;
    scheduler.suppress("drums", 1);
    advance(0.5);
    expect(calls().find((c) => c.slot === 1).skip.has("drums:1")).toBe(true);
  });
});
