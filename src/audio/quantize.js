// Slot length. Slots are eighth notes; 16 slots make one loop.
export function slotDuration(tempo) {
  return 60 / tempo / 2;
}
