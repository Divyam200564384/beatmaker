// Synthesized instruments. Each function builds its nodes on any
// BaseAudioContext, so live playback and offline WAV rendering share them.
// Drums are filtered noise, after BeepBox's noise-based drums (REA finding 4).

const FLOOR = 0.0001;
const TAIL = 0.05;
const noiseCache = new WeakMap();

export function getNoiseBuffer(ctx) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

// Gain node with a click-free envelope: rises to `peak` over `attack`, then
// falls to silence at `time + decay`.
function envelope(ctx, out, time, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(FLOOR, time);
  g.gain.exponentialRampToValueAtTime(peak, time + attack);
  g.gain.exponentialRampToValueAtTime(FLOOR, time + decay);
  g.connect(out);
  return g;
}

function oscillator(ctx, type, freq, time) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  return osc;
}

function run(source, time, decay) {
  source.start(time);
  source.stop(time + decay + TAIL);
}

export function playMelody(ctx, out, time, freq, waveform) {
  const decay = 0.35;
  const env = envelope(ctx, out, time, 0.25, 0.005, decay);
  const osc = oscillator(ctx, waveform, freq, time);
  osc.connect(env);
  run(osc, time, decay);
}

export function playBass(ctx, out, time, freq) {
  const decay = 0.4;
  const env = envelope(ctx, out, time, 0.5, 0.008, decay);
  for (const [type, f] of [["triangle", freq], ["sine", freq / 2]]) {
    const osc = oscillator(ctx, type, f, time);
    osc.connect(env);
    run(osc, time, decay);
  }
}

export function playChord(ctx, out, time, freqs) {
  const decay = 0.9;
  const env = envelope(ctx, out, time, 0.12 * freqs.length, 0.03, decay);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1800, time);
  lp.connect(env);
  for (const f of freqs) {
    for (const type of ["sine", "triangle"]) {
      const osc = oscillator(ctx, type, f, time);
      osc.connect(lp);
      run(osc, time, decay);
    }
  }
}

export function playKick(ctx, out, time) {
  const decay = 0.3;
  const env = envelope(ctx, out, time, 1, 0.002, decay);
  const osc = oscillator(ctx, "sine", 150, time);
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.12);
  osc.connect(env);
  run(osc, time, decay);
}

function noiseBurst(ctx, out, time, cutoff, peak, decay) {
  const env = envelope(ctx, out, time, peak, 0.001, decay);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(cutoff, time);
  hp.connect(env);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.connect(hp);
  run(src, time, decay);
}

export function playSnare(ctx, out, time) {
  noiseBurst(ctx, out, time, 1000, 0.6, 0.15);
  const env = envelope(ctx, out, time, 0.4, 0.001, 0.08);
  const osc = oscillator(ctx, "triangle", 180, time);
  osc.connect(env);
  run(osc, time, 0.08);
}

export function playHat(ctx, out, time) {
  noiseBurst(ctx, out, time, 7000, 0.3, 0.05);
}
