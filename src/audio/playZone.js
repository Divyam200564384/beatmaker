// Turns a lane + zone into the matching instrument call.
import * as instruments from "./instruments.js";
import { getLane, midiToFreq } from "../music/lanes.js";

const DRUMS = { kick: "playKick", snare: "playSnare", hat: "playHat" };

export function playZone(ctx, out, song, laneId, zone, time, inst = instruments) {
  const z = getLane(laneId).zones[zone];
  if (!z) return;
  switch (laneId) {
    case "melody":
      inst.playMelody(ctx, out, time, midiToFreq(z.midi[0]), song.waveform);
      break;
    case "chords":
      inst.playChord(ctx, out, time, z.midi.map(midiToFreq));
      break;
    case "bass":
      inst.playBass(ctx, out, time, midiToFreq(z.midi[0]));
      break;
    case "drums":
      inst[DRUMS[z.drum]](ctx, out, time);
      break;
  }
}
