// Offline render of one loop to a 16-bit PCM WAV, using the same instrument
// and slot code as live playback.
import { buildMasterChain } from "./engine.js";
import { scheduleSlot } from "./scheduleSlot.js";
import { slotDuration } from "./quantize.js";

const RATE = 44100;
const TAIL_SECONDS = 1;

export function wavFileName(song) {
  return `beatmaker-${song.tempo}bpm.wav`;
}

export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const dataBytes = frames * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));

  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);

  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, s < 0 ? s * 32768 : Math.round(s * 32767), true);
      offset += 2;
    }
  }
  return view.buffer;
}

export async function renderSongToWav(
  song,
  makeContext = (channels, length, rate) => new OfflineAudioContext(channels, length, rate),
) {
  const step = slotDuration(song.tempo);
  const ctx = makeContext(2, Math.ceil((16 * step + TAIL_SECONDS) * RATE), RATE);
  const { input } = buildMasterChain(ctx, song.volume);
  for (let slot = 0; slot < 16; slot++) scheduleSlot(ctx, input, song, slot, slot * step);
  const rendered = await ctx.startRendering();
  return new Blob([encodeWav(rendered)], { type: "audio/wav" });
}
