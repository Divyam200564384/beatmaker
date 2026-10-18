// Audio context and master chain: sound → master gain → limiter → speakers.

export function buildMasterChain(ctx, volume) {
  const master = ctx.createGain();
  master.gain.value = volume;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  master.connect(limiter);
  limiter.connect(ctx.destination);
  return {
    input: master,
    setVolume(v) {
      master.gain.value = v;
    },
  };
}

// Created from the Start tap only: browsers allow audio after a user gesture,
// which is also how BeepBox starts its context on Play (REA finding 1).
export function createEngine(volume = 0.8) {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  const chain = buildMasterChain(ctx, volume);
  return {
    ctx,
    out: chain.input,
    setVolume: chain.setVolume,
    resume: () => ctx.resume(),
  };
}
