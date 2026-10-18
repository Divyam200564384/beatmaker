// Look-ahead loop clock. A short timer queues slots a little ahead on the
// audio clock, so timing comes from the audio hardware, not from timers —
// the same drift-free idea as BeepBox's sample-counted ticks (REA finding 3).
import { scheduleSlot } from "./scheduleSlot.js";
import { slotDuration } from "./quantize.js";

const SLOTS = 16;
const START_DELAY = 0.05;

export function createScheduler({ ctx, out, getSong, onSlot, schedule = scheduleSlot, lookahead = 0.1, interval = 25 }) {
  let running = false;
  let timer = null;
  let nextSlot = 0;
  let nextTime = 0;
  let loopStart = 0;
  let suppressed = new Set();
  let recent = []; // the last 16 scheduled { slot, time } — the real slot grid
  const pending = new Set();

  function tick() {
    while (nextTime < ctx.currentTime + lookahead) {
      const song = getSong();
      const slot = nextSlot;
      if (slot === 0) loopStart = nextTime;
      const skip = new Set([...suppressed].filter((key) => key.endsWith(`:${slot}`)));
      for (const key of skip) suppressed.delete(key);
      schedule(ctx, out, song, slot, nextTime, skip);
      recent.push({ slot, time: nextTime });
      if (recent.length > SLOTS) recent.shift();
      const t = setTimeout(() => {
        pending.delete(t);
        onSlot(slot);
      }, Math.max(0, (nextTime - ctx.currentTime) * 1000));
      pending.add(t);
      nextTime += slotDuration(song.tempo);
      nextSlot = (slot + 1) % SLOTS;
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      nextSlot = 0;
      nextTime = ctx.currentTime + START_DELAY;
      loopStart = nextTime;
      suppressed = new Set();
      recent = [];
      timer = setInterval(tick, interval);
      tick();
    },
    stop() {
      running = false;
      clearInterval(timer);
      for (const t of pending) clearTimeout(t);
      pending.clear();
    },
    isRunning: () => running,
    loopStartTime: () => loopStart,
    // The slot whose actual scheduled time is nearest to `time`, measured on
    // the grid that was really played (so tempo changes mid-loop stay exact).
    slotAt(time) {
      let best = { slot: nextSlot, time: nextTime };
      for (const entry of recent) if (Math.abs(entry.time - time) < Math.abs(best.time - time)) best = entry;
      return best.slot;
    },
    // Skip the upcoming, not-yet-queued slot once for a lane whose note was
    // just played live, so the same hit isn't heard twice. Slots already queued
    // were scheduled before the note existed and can't double.
    suppress(laneId, slot) {
      if (running && slot === nextSlot) suppressed.add(`${laneId}:${slot}`);
    },
  };
}
