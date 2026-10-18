import { describe, expect, test } from "vitest";
import { createFakeContext } from "../test/fakeAudio.js";
import { getNoiseBuffer, playChord, playHat, playKick, playMelody } from "./instruments.js";
import { buildMasterChain } from "./engine.js";

const ofKind = (ctx, kind) => ctx.created.filter((n) => n.kind === kind);

describe("instruments", () => {
  test("noise buffer is one second long and cached per context", () => {
    const ctx = createFakeContext();
    const buf = getNoiseBuffer(ctx);
    expect(getNoiseBuffer(ctx)).toBe(buf);
    expect(buf.length).toBe(ctx.sampleRate);
  });

  test("playMelody uses the chosen waveform and frequency and stops after its decay", () => {
    const ctx = createFakeContext();
    playMelody(ctx, ctx.destination, 2, 440, "sawtooth");
    const [osc] = ofKind(ctx, "oscillator");
    expect(osc.type).toBe("sawtooth");
    expect(osc.frequency.value).toBe(440);
    expect(osc.started).toBe(2);
    expect(osc.stopped).toBeCloseTo(2.4, 9);
  });

  test("playChord builds a sine and a triangle per note through one 1800 Hz low-pass", () => {
    const ctx = createFakeContext();
    playChord(ctx, ctx.destination, 0, [130.81, 164.81, 196]);
    const oscs = ofKind(ctx, "oscillator");
    expect(oscs).toHaveLength(6);
    expect(oscs.map((o) => o.type).sort()).toEqual(["sine", "sine", "sine", "triangle", "triangle", "triangle"]);
    const filters = ofKind(ctx, "biquad");
    expect(filters).toHaveLength(1);
    expect(filters[0].type).toBe("lowpass");
    expect(filters[0].frequency.value).toBe(1800);
  });

  test("playKick sweeps from 150 Hz to 50 Hz over 0.12 s", () => {
    const ctx = createFakeContext();
    playKick(ctx, ctx.destination, 1);
    const [osc] = ofKind(ctx, "oscillator");
    expect(osc.frequency.events).toContainEqual({ method: "set", value: 150, time: 1 });
    expect(osc.frequency.events).toContainEqual({ method: "exp", value: 50, time: 1.12 });
  });

  test("playHat plays cached noise through a 7 kHz high-pass", () => {
    const ctx = createFakeContext();
    playHat(ctx, ctx.destination, 0);
    const [src] = ofKind(ctx, "bufferSource");
    expect(src.buffer).toBe(getNoiseBuffer(ctx));
    const [hp] = ofKind(ctx, "biquad");
    expect(hp.type).toBe("highpass");
    expect(hp.frequency.value).toBe(7000);
  });

  test("master chain volume can be changed", () => {
    const ctx = createFakeContext();
    const chain = buildMasterChain(ctx, 0.8);
    expect(chain.input.gain.value).toBe(0.8);
    chain.setVolume(0.5);
    expect(chain.input.gain.value).toBe(0.5);
    const [comp] = ofKind(ctx, "compressor");
    expect(chain.input.connections).toContain(comp);
    expect(comp.connections).toContain(ctx.destination);
  });
});
