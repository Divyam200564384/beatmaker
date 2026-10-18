// Beat snapping. Slots are eighth notes; 16 slots make one loop.
const SLOTS = 16;

export function slotDuration(tempo) {
  return 60 / tempo / 2;
}

export function quantize(time, loopStartTime, tempo) {
  const raw = Math.round((time - loopStartTime) / slotDuration(tempo));
  return ((raw % SLOTS) + SLOTS) % SLOTS;
}
