// Compact URL-safe song string, after BeepBox's bit-packed base64 song format
// (REA finding 5). Layout (spec §9), MSB first, 6 bits per character:
// version(6) tempo(12) waveform(6) volumeStep(6) then 4 lanes × 16 slots × 4 bits.
import { LANES } from "../music/lanes.js";
import { SLOTS, TEMPO_MAX, TEMPO_MIN, WAVEFORMS } from "./model.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const VERSION = 2;
const EMPTY = 15;
const TOTAL_BITS = 6 + 12 + 6 + 6 + LANES.length * SLOTS * 4;
const LENGTH = Math.ceil(TOTAL_BITS / 6);

export class CodecError extends Error {
  constructor(message) {
    super(message);
    this.name = "CodecError";
  }
}

class BitWriter {
  bits = [];
  write(value, count) {
    for (let i = count - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  toString() {
    while (this.bits.length % 6) this.bits.push(0);
    let out = "";
    for (let i = 0; i < this.bits.length; i += 6) {
      let v = 0;
      for (let j = 0; j < 6; j++) v = (v << 1) | this.bits[i + j];
      out += ALPHABET[v];
    }
    return out;
  }
}

class BitReader {
  constructor(str) {
    this.bits = [];
    this.pos = 0;
    for (const ch of str) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) throw new CodecError(`Bad character: ${ch}`);
      for (let i = 5; i >= 0; i--) this.bits.push((v >> i) & 1);
    }
  }
  read(count) {
    let v = 0;
    for (let i = 0; i < count; i++) v = (v << 1) | this.bits[this.pos++];
    return v;
  }
}

export function encodeSong(song) {
  const w = new BitWriter();
  w.write(VERSION, 6);
  w.write(song.tempo, 12);
  w.write(WAVEFORMS.indexOf(song.waveform), 6);
  w.write(Math.round(song.volume * 20), 6);
  for (const lane of LANES) for (const v of song.lanes[lane.id]) w.write(v < 0 ? EMPTY : v, 4);
  return w.toString();
}

export function decodeSong(str) {
  if (typeof str !== "string" || str.length !== LENGTH) throw new CodecError("Wrong length");
  const r = new BitReader(str);
  const version = r.read(6);
  if (version !== VERSION) throw new CodecError(`Unsupported version ${version}`);
  const tempo = r.read(12);
  if (tempo < TEMPO_MIN || tempo > TEMPO_MAX) throw new CodecError(`Bad tempo ${tempo}`);
  const waveform = WAVEFORMS[r.read(6)];
  if (!waveform) throw new CodecError("Bad waveform");
  const volumeStep = r.read(6);
  if (volumeStep > 20) throw new CodecError("Bad volume");
  const lanes = {};
  for (const lane of LANES) {
    lanes[lane.id] = [];
    for (let s = 0; s < SLOTS; s++) {
      const v = r.read(4);
      if (v !== EMPTY && v >= lane.zones.length) throw new CodecError(`Bad zone ${v} in ${lane.id}`);
      lanes[lane.id].push(v === EMPTY ? -1 : v);
    }
  }
  return { version, tempo, waveform, volume: volumeStep / 20, lanes };
}
