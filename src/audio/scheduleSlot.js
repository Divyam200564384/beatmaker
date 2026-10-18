// Plays every lane's recorded note for one loop slot.
import * as instruments from "./instruments.js";
import { LANE_IDS } from "../music/lanes.js";
import { playZone } from "./playZone.js";

export function scheduleSlot(ctx, out, song, slot, time, skip = new Set(), inst = instruments) {
  for (const laneId of LANE_IDS) {
    const zone = song.lanes[laneId][slot];
    if (zone < 0 || skip.has(`${laneId}:${slot}`)) continue;
    playZone(ctx, out, song, laneId, zone, time, inst);
  }
}
