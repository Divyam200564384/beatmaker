import { describe, expect, test, vi } from "vitest";
import { encodeWav, renderSongToWav, wavFileName } from "./renderWav.js";
import { createFakeContext } from "../test/fakeAudio.js";
import { createDefaultSong } from "../song/model.js";

const fakeBuffer = () => {
  const ch = [new Float32Array([1, -1, 0.5]), new Float32Array([0, 2, -2])];
  return { numberOfChannels: 2, sampleRate: 44100, length: 3, getChannelData: (i) => ch[i] };
};
const ascii = (view, at) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(at + i)));

describe("encodeWav", () => {
  const view = new DataView(encodeWav(fakeBuffer()));

  test("writes RIFF/WAVE/fmt/data headers with correct sizes", () => {
    expect([ascii(view, 0), ascii(view, 8), ascii(view, 12), ascii(view, 36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint32(4, true)).toBe(36 + 12);
    expect(view.getUint32(40, true)).toBe(12);
    expect(view.byteLength).toBe(44 + 12);
  });

  test("describes 16-bit stereo PCM at 44.1 kHz", () => {
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(44100 * 4);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
  });

  test("interleaves, scales and clamps samples", () => {
    const samples = [0, 1, 2, 3, 4, 5].map((i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([32767, 0, -32768, 32767, 16384, -32768]);
  });
});

describe("renderSongToWav", () => {
  test("renders one loop plus a 1 s tail offline and returns a WAV blob", async () => {
    const makeContext = vi.fn((channels, length, rate) => {
      const ctx = createFakeContext({ sampleRate: rate });
      ctx.startRendering = () => Promise.resolve(fakeBuffer());
      return ctx;
    });
    const blob = await renderSongToWav(createDefaultSong(), makeContext);
    expect(makeContext).toHaveBeenCalledWith(2, Math.ceil((16 * 0.3 + 1) * 44100), 44100);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
  });
});

test("wavFileName includes the tempo", () => {
  expect(wavFileName({ tempo: 120 })).toBe("beatmaker-120bpm.wav");
});
