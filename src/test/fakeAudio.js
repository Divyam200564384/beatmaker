// Minimal Web Audio stand-in for unit tests. Records every node created so
// tests can assert on the graph the audio code builds.

function fakeParam(initial = 0) {
  const events = [];
  return {
    value: initial,
    events,
    setValueAtTime(value, time) { events.push({ method: "set", value, time }); this.value = value; return this; },
    linearRampToValueAtTime(value, time) { events.push({ method: "linear", value, time }); return this; },
    exponentialRampToValueAtTime(value, time) { events.push({ method: "exp", value, time }); return this; },
    cancelScheduledValues() { return this; },
  };
}

export function createFakeContext({ currentTime = 0, sampleRate = 48000 } = {}) {
  const created = [];
  const node = (kind, params = {}, extra = {}) => {
    const n = {
      kind,
      connections: [],
      started: null,
      stopped: null,
      connect(target) { this.connections.push(target); return target; },
      disconnect() { this.connections = []; },
      start(time = 0) { this.started = time; },
      stop(time = 0) { this.stopped = time; },
      ...params,
      ...extra,
    };
    created.push(n);
    return n;
  };
  return {
    currentTime,
    sampleRate,
    created,
    destination: { kind: "destination" },
    createOscillator: () => node("oscillator", { frequency: fakeParam(440), detune: fakeParam(0) }, { type: "sine" }),
    createGain: () => node("gain", { gain: fakeParam(1) }),
    createBiquadFilter: () => node("biquad", { frequency: fakeParam(350), Q: fakeParam(1) }, { type: "lowpass" }),
    createBufferSource: () => node("bufferSource", {}, { buffer: null }),
    createDynamicsCompressor: () =>
      node("compressor", {
        threshold: fakeParam(-24), ratio: fakeParam(12), attack: fakeParam(0.003), release: fakeParam(0.25), knee: fakeParam(30),
      }),
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: (i) => data[i] };
    },
  };
}
