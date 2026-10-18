// Instrument lanes. Every pitched note is in C major pentatonic (C D E G A),
// so anything played across lanes sounds consonant together.

export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

const NOTE_NAMES = { 0: "C", 2: "D", 4: "E", 7: "G", 9: "A" };
const noteZones = (midis) => midis.map((m) => ({ label: NOTE_NAMES[m % 12], midi: [m] }));

export const LANES = [
  {
    id: "melody",
    label: "Melody",
    color: "--melody",
    hex: "#2C5BE8",
    zones: noteZones([60, 62, 64, 67, 69, 72, 74, 76, 79, 81]),
  },
  {
    id: "chords",
    label: "Chords",
    color: "--chords",
    hex: "#8B4BD6",
    zones: [
      { label: "C", midi: [48, 52, 55] },
      { label: "Am", midi: [45, 48, 52] },
      { label: "Gsus4", midi: [43, 48, 50] },
      { label: "Csus2", midi: [48, 50, 55] },
    ],
  },
  {
    id: "bass",
    label: "Bass",
    color: "--bass",
    hex: "#13906A",
    zones: noteZones([36, 38, 40, 43, 45]),
  },
  {
    id: "drums",
    label: "Drums",
    color: "--drums",
    hex: "#E8632B",
    zones: [
      { label: "Kick", drum: "kick" },
      { label: "Snare", drum: "snare" },
      { label: "Hi-hat", drum: "hat" },
    ],
  },
];

export const LANE_IDS = LANES.map((l) => l.id);

export function getLane(id) {
  const lane = LANES.find((l) => l.id === id);
  if (!lane) throw new RangeError(`Unknown lane: ${id}`);
  return lane;
}
