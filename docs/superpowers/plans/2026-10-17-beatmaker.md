# Beatmaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser music toy. You sweep a pointer across four coloured instrument lanes, and every sound you make is snapped into an always-on, 16-slot pentatonic loop.

**Architecture:** Pure modules (`music/`, `song/`, `audio/quantize`) hold all the rules and are fully unit-tested. The audio modules build Web Audio nodes on any `BaseAudioContext`, so live playback and the WAV export share one code path. React components are thin; `App.jsx` owns the song state, keeps the URL in sync, and runs the engine and scheduler.

**Tech Stack:** Vite + React 18 (JavaScript), Vitest + jsdom + Testing Library, Web Audio API, `@fontsource/baloo-2` (bundled font, no network), `lucide-react` (SVG icons).

**Spec:** `docs/superpowers/specs/2026-10-17-beatmaker-design.md`

## Global Constraints

- All files stay in `REA demo\beatmaker\`. npm always runs with `--cache "C:/Users/wadha/OneDrive/Desktop/REA demo/.npm-cache"`. No `-g` installs and no global configuration changes.
- Scale: C major pentatonic only (pitch classes C D E G A).
- Loop: 16 slots. `slotDuration = 60 / tempo / 2` seconds. Tempo is an integer from 30 to 300, default 100.
- Waveforms: `"sine" | "square" | "sawtooth" | "triangle"`; default `"square"`. Volume is 0..1 in steps of 0.05; default 0.8.
- Lane order (top to bottom, and in the codec): melody, chords, bass, drums. Zone counts are 10, 4, 5 and 3. An empty slot is `-1` in the model and `15` in the codec.
- Sound comes only from the Web Audio API. No sample files and no audio library.
- The dev server listens on localhost only (`vite --host 127.0.0.1`).
- Copy rules: sentence case, active verbs, no emoji. The bad-link message is exactly "Couldn't read that song link, started a new one". The WAV filename is `beatmaker-<tempo>bpm.wav`.
- Quality floor: every interactive target is at least 44×44 px, focus is visible, `prefers-reduced-motion` is respected, text contrast is at least 4.5:1, and the layout works at 375 px width.

## Visual Direction (from frontend-design + ui-ux-pro-max)

**Concept: toy xylophone.** Each lane is one chunky bar divided into keys. Within a lane, each key is a step lighter than the one to its left (the low notes are darker and the high notes are lighter), so the colour itself shows pitch. That gradient is the one bold element. Everything else stays quiet.

| Token | Hex | Use |
|---|---|---|
| `--sky` | `#E6EEFB` | page background (a cool playroom wall, not cream) |
| `--ink` | `#16204A` | text and icons |
| `--paper` | `#FFFFFF` | top bar surface |
| `--melody` | `#2C5BE8` | melody lane base |
| `--chords` | `#8B4BD6` | chords lane base |
| `--bass` | `#13906A` | bass lane base |
| `--drums` | `#E8632B` | drums lane base |

- **Type:** Baloo 2 (rounded, friendly, legible to children) for everything, in weights 500, 700 and 800. Scale: 14 / 16 / 20 / 28 px. Lane names are 20 px weight 800 in sentence case ("Melody"). No all-caps labels and no eyebrows.
- **Key colours:** key *i* of *n* is `color-mix(in oklab, var(--lane) , white calc(i / n * 45%))`. Key labels are `--ink` on light keys and white on dark keys; Task 10 holds the contrast test.
- **Layout:** the TopBar is a single row that wraps on narrow screens. Lanes form a full-width stack with a 12 px gap. Each lane is a grid with three columns: name (120 px), keys (1fr) and loop dots (auto). Below 640 px, the name and dots go on a row of their own above the keys. Everything is left-aligned.
- **Motion:** only in response to the user. A hit key scales to 1.06 and brightens for 180 ms. The current loop-dot column pulses. Under reduced motion, animation is replaced by an instant outline change.
- **Icons:** lucide-react `Play`, `Square`, `Share2`, `Download`, `Trash2`, `X`, each with an `aria-label` on its button.

## Review Focus

1. Very fast sweeps across every zone in one slot: each zone plays once, in order, the last zone ends up in the slot, and nothing throws (Tasks 3 and 11).
2. Pointer movement before Start, or while stopped, never records and never throws when no audio context exists (Task 13).
3. Two fingers in two lanes at once: each lane tracks its own pointer, and both lanes play (Task 11).
4. Pasting a different song link into the same tab (`hashchange`) loads that song; a bad link falls back with the message (Task 13).
5. A tempo change while the loop is playing never makes a slot repeat or get skipped (Task 8).

---

### Task 1: Project scaffold and test harness

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx` (placeholder), `src/test/setup.js`, `.gitignore`
- Test: `src/test/smoke.test.js`

**Interfaces:**
- Produces: `npm test` (`vitest run`), `npm run dev` (`vite --host 127.0.0.1`), `npm run build`

- [ ] **Step 1:** In `REA demo\beatmaker\`, run `npm create vite@5 scaffold -- --template react --cache "C:/Users/wadha/OneDrive/Desktop/REA demo/.npm-cache"`. Move its contents into `beatmaker\` without overwriting `docs\`, then delete `scaffold\`.
- [ ] **Step 2:** Install with the in-folder cache: runtime `@fontsource/baloo-2 lucide-react`; dev `vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`.
- [ ] **Step 3:** In `vite.config.js`, set `test: { environment: "jsdom", setupFiles: "src/test/setup.js" }` and `server: { host: "127.0.0.1" }`. `setup.js` imports `@testing-library/jest-dom/vitest`. Set the scripts: `"test": "vitest run"`, `"dev": "vite --host 127.0.0.1"`.
- [ ] **Step 4:** Write `smoke.test.js`: `expect(1 + 1).toBe(2)`. Run `npm test`. Expected: 1 passed.
- [ ] **Step 5:** `.gitignore` must contain `node_modules`, `dist`. Commit: `chore: scaffold vite react app with vitest`.

### Task 2: Lane definitions (`src/music/lanes.js`)

**Files:** Create `src/music/lanes.js`; Test `src/music/lanes.test.js`

**Interfaces:**
- Produces:
  - `midiToFreq(midi: number) → number`, using `440 * 2 ** ((midi - 69) / 12)`.
  - `LANES: Array<Lane>`, in the order melody, chords, bass, drums.
  - `Lane = { id: "melody"|"chords"|"bass"|"drums", label: string, color: string (CSS var name e.g. "--melody"), zones: Zone[] }`.
  - `Zone = { label: string, midi?: number[], drum?: "kick"|"snare"|"hat" }`. Melody and bass zones have one midi value. Chord zones have three. Drum zones have `drum`.
  - `LANE_IDS = LANES.map(l => l.id)`.
  - `getLane(id) → Lane`.

- [ ] **Step 1: Write the failing tests**

```js
test("midiToFreq anchors A4", () => expect(midiToFreq(69)).toBe(440));
test("zone counts", () => expect(LANES.map(l => l.zones.length)).toEqual([10, 4, 5, 3]));
test("lane order", () => expect(LANE_IDS).toEqual(["melody", "chords", "bass", "drums"]));
test("every pitched note is C pentatonic", () => {
  const ok = new Set([0, 2, 4, 7, 9]);
  for (const lane of LANES) for (const z of lane.zones) for (const m of z.midi ?? []) expect(ok.has(m % 12)).toBe(true);
});
test("melody spans C4..A5, bass C2..A2", () => {
  expect(getLane("melody").zones.map(z => z.midi[0])).toEqual([60, 62, 64, 67, 69, 72, 74, 76, 79, 81]);
  expect(getLane("bass").zones.map(z => z.midi[0])).toEqual([36, 38, 40, 43, 45]);
});
test("chords", () => {
  expect(getLane("chords").zones.map(z => [z.label, z.midi])).toEqual([
    ["C", [48, 52, 55]], ["Am", [45, 48, 52]], ["Gsus4", [43, 48, 50]], ["Csus2", [48, 50, 55]]]);
});
test("drums", () => expect(getLane("drums").zones.map(z => z.drum)).toEqual(["kick", "snare", "hat"]));
```

- [ ] **Step 2:** Run `npx vitest run src/music`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `lanes.js`. Labels: melody zones are named by note ("C", "D", …, uppercase letter only); bass zones the same; drums "Kick", "Snare", "Hi-hat"; lane labels "Melody", "Chords", "Bass", "Drums".
- [ ] **Step 4:** Run again. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add pentatonic lane definitions`.

### Task 3: Song model (`src/song/model.js`)

**Files:** Create `src/song/model.js`; Test `src/song/model.test.js`

**Interfaces:**
- Consumes: `LANES`, `LANE_IDS`, `getLane` (Task 2).
- Produces:
  - `SLOTS = 16`, `TEMPO_MIN = 30`, `TEMPO_MAX = 300`, `WAVEFORMS = ["sine", "square", "sawtooth", "triangle"]`.
  - `createDefaultSong() → Song`.
  - `recordNote(song, laneId, slot, zone) → Song`.
  - `clearLane(song, laneId) → Song`, `clearAll(song) → Song`.
  - `setTempo(song, bpm) → Song` (rounds, then clamps to 30..300).
  - `setWaveform(song, w) → Song` (an unknown value leaves the song unchanged).
  - `setVolume(song, v) → Song` (clamps to 0..1, rounds to the nearest 0.05).
  - `Song = { version: 2, tempo, waveform, volume, lanes: { melody: number[16], chords, bass, drums } }`.
  - Every function returns a new object and never mutates its input.

- [ ] **Step 1: Write the failing tests**
  - `createDefaultSong()` deep-equals `{ version: 2, tempo: 100, waveform: "square", volume: 0.8, lanes: {melody: Array(16).fill(-1), chords: …, bass: …, drums: …} }`.
  - `recordNote(s, "bass", 3, 2).lanes.bass[3] === 2`. The original `s.lanes.bass[3] === -1`, and `Object.isFrozen` is not required, but `s` must deep-equal its clone taken before the call.
  - Rapid overwrite (Review Focus 1): recording zones 0..9 one after another into melody slot 5 leaves `lanes.melody[5] === 9`, and no other slot changes.
  - `recordNote` throws `RangeError` for slot 16, zone 10 in melody, zone 4 in chords, and an unknown lane.
  - `clearLane` resets only that lane. `clearAll` resets every lane and keeps tempo, waveform and volume.
  - Setters: `setTempo(s, 12).tempo === 30`, `setTempo(s, 999).tempo === 300`, `setTempo(s, 120.6).tempo === 121`, `setVolume(s, 0.83).volume === 0.85`, `setVolume(s, -1).volume === 0`, `setWaveform(s, "noise") === s`.
- [ ] **Step 2:** Run `npx vitest run src/song/model`. Expected: FAIL.
- [ ] **Step 3:** Implement. Volume rounding is `Math.round(v * 20) / 20`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add immutable song model`.

### Task 4: Song codec (`src/song/codec.js`)

**Files:** Create `src/song/codec.js`; Test `src/song/codec.test.js`

**Interfaces:**
- Consumes: `createDefaultSong`, `WAVEFORMS`, `SLOTS` (Task 3); `LANES` (Task 2).
- Produces: `encodeSong(song) → string` (48 characters), `decodeSong(str) → Song`, `class CodecError extends Error`.

Format (spec §9): alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`, written MSB-first through a bit writer.

```
bits: version(6)=2 | tempo(12) | waveform(6) | volumeStep(6)=round(volume*20) |
      for lane of [melody,chords,bass,drums]: for slot 0..15: (v<0 ? 15 : v) in 4 bits
      → 30 + 256 = 286 bits, zero-pad to 288 = 48 chars
```

- [ ] **Step 1: Write the failing tests**
  - `encodeSong(createDefaultSong()).length === 48`, and it matches `/^[A-Za-z0-9_-]{48}$/`.
  - Round-trip deep-equals for: the default song; every lane filled with each lane's maximum zone; 20 random songs (use a seeded LCG so failures can be reproduced); tempo 30 and 300; every waveform; volume 0 and 1.
  - Rejection (each `toThrow(CodecError)`): length 47; a `"!"` character; version 1 (re-encode with the first character `"B"`); tempo 29 and 301; waveform index 4; volume step 21; melody zone 10; chords zone 4; bass zone 5; drums zone 3.
  - Test helper: a `forge(fields)` function inside the test file builds a string from raw field values using the same bit layout, so out-of-range values can be produced.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with a small internal `BitWriter` (`write(value, bits)`, `toString()`) and `BitReader` (`read(bits)`). Validate every field after reading. A slot value of 15 decodes to -1; any other value must be less than the lane's zone count.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add compact URL song codec`.

### Task 5: Quantize (`src/audio/quantize.js`)

**Files:** Create `src/audio/quantize.js`; Test `src/audio/quantize.test.js`

**Interfaces:**
- Produces: `slotDuration(tempo) → number` (`60 / tempo / 2`); `quantize(time, loopStartTime, tempo) → 0..15`.

```js
const d = slotDuration(tempo);
const raw = Math.round((time - loopStartTime) / d);
return ((raw % 16) + 16) % 16;
```

- [ ] **Step 1: Write the failing tests:**
  - `slotDuration(100) === 0.3`.
  - At tempo 100 with loop start 10: time 10.0 gives 0; 10.14 gives 0; 10.16 gives 1; 10 + 0.3 × 15.6 gives 0 (wrap); time 9.9 (just before the anchor) gives 0.
  - Tempo 60: time `start + 2.5` gives 5.
  - Tempo 300: time `start + 0.55` gives 6 (0.55 / 0.1 = 5.5, which rounds to 6).
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add slot quantization`.

### Task 6: Engine and instruments (`src/audio/engine.js`, `src/audio/instruments.js`)

**Files:** Create both; Test `src/audio/instruments.test.js`; Create `src/test/fakeAudio.js` (shared stub)

**Interfaces:**
- Produces:
  - `buildMasterChain(ctx, volume) → { input: AudioNode, setVolume(v) }`: master `GainNode` → `DynamicsCompressor` (threshold −10, ratio 4, attack 0.003, release 0.25) → `ctx.destination`.
  - `createEngine() → { ctx: AudioContext, out: AudioNode, setVolume(v), resume(): Promise }`. It creates `new AudioContext({ latencyHint: "interactive" })` and is only called from the Start tap.
  - `getNoiseBuffer(ctx) → AudioBuffer`: 1 s of mono white noise, cached per context in a `WeakMap`.
  - `playMelody(ctx, out, time, freq, waveform)`, `playBass(ctx, out, time, freq)`, `playChord(ctx, out, time, freqs)`, `playKick(ctx, out, time)`, `playSnare(ctx, out, time)`, `playHat(ctx, out, time)`.
  - Envelope values are exactly those in spec §7. Every source is `start(time)`-ed and `stop()`-ed after its decay plus 0.05 s.
  - `fakeAudio.js` exports `createFakeContext({ currentTime = 0 })`, which records every created node in `ctx.created: Array<{ type, params, started, stopped }>` and supports `createOscillator`, `createGain`, `createBiquadFilter`, `createBufferSource`, `createBuffer`, `createDynamicsCompressor`, `destination`, and `AudioParam` methods (`setValueAtTime`, `exponentialRampToValueAtTime`, `linearRampToValueAtTime`).

- [ ] **Step 1: Write the failing tests** (using the fake context):
  - `getNoiseBuffer(ctx) === getNoiseBuffer(ctx)`. The length is `ctx.sampleRate`.
  - `playMelody(ctx, out, 2, 440, "sawtooth")` creates an oscillator with `type === "sawtooth"`, frequency 440, `started === 2` and `stopped ≈ 2.4`.
  - `playChord` with 3 frequencies creates 6 oscillators (one sine and one triangle per note) and a single low-pass filter at 1800.
  - `playKick` sets the frequency to 150 at the start time and ramps exponentially to 50 by start + 0.12.
  - `playHat` uses a buffer source with the cached noise buffer and a high-pass filter at 7000.
  - `buildMasterChain(ctx, 0.8).setVolume(0.5)` sets the master gain to 0.5.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add web audio instruments and master chain`.

### Task 7: Zone and slot playback (`src/audio/playZone.js`, `src/audio/scheduleSlot.js`)

**Files:** Create both; Test `src/audio/playback.test.js`

**Interfaces:**
- Consumes: the instruments (Task 6), `getLane` and `midiToFreq` (Task 2), `LANE_IDS`.
- Produces:
  - `playZone(ctx, out, song, laneId, zone, time, inst = instruments)`. The last argument lets tests inject spies.
  - `scheduleSlot(ctx, out, song, slot, time, skip = new Set(), inst = instruments)`. `skip` contains keys of the form `"laneId:slot"`.

- [ ] **Step 1: Write the failing tests** (`inst` holds `vi.fn()` spies):
  - `playZone(…, "melody", 2, 1.0)` calls `playMelody(ctx, out, 1.0, midiToFreq(64), song.waveform)`.
  - Chords zone 1 calls `playChord` with the frequencies of `[45, 48, 52]`.
  - Bass zone 0 calls `playBass` with `midiToFreq(36)`.
  - Drums zones 0, 1 and 2 call kick, snare and hat respectively.
  - `scheduleSlot` on a song with melody[4] = 2 and drums[4] = 0 at slot 4 makes exactly those two calls. At slot 5 (empty) it makes none. With `skip = new Set(["drums:4"])` it calls only melody.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: route lanes and slots to instruments`.

### Task 8: Scheduler (`src/audio/scheduler.js`)

**Files:** Create; Test `src/audio/scheduler.test.js`

**Interfaces:**
- Consumes: `scheduleSlot` (Task 7), `slotDuration` (Task 5).
- Produces: `createScheduler({ ctx, out, getSong, onSlot, schedule = scheduleSlot, lookahead = 0.1, interval = 25 })`, which returns `{ start(), stop(), isRunning(), loopStartTime(), suppress(laneId, slot) }`.

Algorithm:

```
start: nextSlot = 0; nextTime = ctx.currentTime + 0.05; loopStart = nextTime; timer = setInterval(tick, interval); tick()
tick:  while nextTime < ctx.currentTime + lookahead:
         song = getSong()
         if nextSlot === 0: loopStart = nextTime
         skip = keys in suppressed whose slot === nextSlot; remove them from suppressed
         schedule(ctx, out, song, nextSlot, nextTime, skip)
         setTimeout(() => onSlot(slot), max(0, (nextTime - ctx.currentTime) * 1000))
         nextTime += slotDuration(song.tempo); nextSlot = (nextSlot + 1) % 16
suppress(lane, slot): add "lane:slot" only if that slot is not yet scheduled and its time is < currentTime + 0.15
stop:  clearInterval; clear pending onSlot timeouts; running = false
```

- [ ] **Step 1: Write the failing tests** (`vi.useFakeTimers()`; a fake ctx whose `currentTime` the test advances; `schedule` is a spy):
  - After `start()` at currentTime 0, the first scheduled call is slot 0 at time 0.05.
  - Advancing currentTime to 1.0 and the timers by 1000 ms: scheduled times at tempo 100 increase by exactly 0.3 (`toBeCloseTo(…, 9)`), and slots run 0, 1, 2, 3.
  - After 16 slots the next one is 0 again, and `loopStartTime()` equals that slot's time.
  - Tempo change (Review Focus 5): switch `getSong()` to tempo 200 after slot 2 has been scheduled. The spacing after that is 0.15, and the slot sequence stays strictly consecutive, with no repeat and no gap.
  - Calling `suppress("drums", n)` for the next unscheduled slot n, when it is due within 0.15 s, gives that slot's call a `skip` containing `"drums:n"`, and the following loop's call does not.
  - After `stop()`, advancing the timers produces no more calls and `isRunning() === false`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add look-ahead loop scheduler`.

### Task 9: WAV export (`src/audio/renderWav.js`)

**Files:** Create; Test `src/audio/renderWav.test.js`

**Interfaces:**
- Consumes: `scheduleSlot` (Task 7), `buildMasterChain` (Task 6), `slotDuration` (Task 5).
- Produces:
  - `encodeWav(audioBuffer) → ArrayBuffer`: 16-bit PCM, interleaved, with a 44-byte header.
  - `renderSongToWav(song, makeContext = (ch, len, rate) => new OfflineAudioContext(ch, len, rate)) → Promise<Blob>` (type `audio/wav`). It renders at 44100 Hz in stereo, with a length of `ceil((16 * slotDuration(tempo) + 1) * 44100)`, and schedules slots 0..15 at `i * slotDuration`.
  - `wavFileName(song) → "beatmaker-<tempo>bpm.wav"`.

- [ ] **Step 1: Write the failing tests:**
  - `encodeWav` on a fake buffer `{ numberOfChannels: 2, sampleRate: 44100, length: 3, getChannelData: i => [Float32Array [1, -1, 0.5], Float32Array [0, 2, -2]][i] }`:
    - Bytes 0–3 are "RIFF", 8–11 "WAVE", 12–15 "fmt ", 36–39 "data".
    - `getUint32(4, true) === 36 + 12` and `getUint32(40, true) === 12`.
    - `getUint16(22, true) === 2`, `getUint32(24, true) === 44100`, `getUint16(34, true) === 16`.
    - The samples are, in order, `32767, 0, -32768, 32767, 16384 (round(0.5*32767)=16384), -32768`. Values of 2 and −2 are clamped.
  - `renderSongToWav` with a `makeContext` that returns a fake offline context (`startRendering` resolves to the fake buffer) resolves to a Blob of type `audio/wav`, and calls `makeContext(2, Math.ceil((16*0.3+1)*44100), 44100)` for tempo 100.
  - `wavFileName({ tempo: 120 }) === "beatmaker-120bpm.wav"`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add offline WAV export`.

### Task 10: Design tokens and global styles

**Files:** Create `src/styles/tokens.css`, `src/styles/global.css`; Modify `src/main.jsx` (import `@fontsource/baloo-2/500.css`, `700.css`, `800.css` and both stylesheets); Create `src/styles/contrast.js`; Test `src/styles/contrast.test.js`

**Interfaces:**
- Produces:
  - The CSS custom properties from the Visual Direction table.
  - The utility classes `.visually-hidden` and `.focus-ring` (`outline: 3px solid var(--ink); outline-offset: 3px` on `:focus-visible`).
  - `keyTextColor(laneHex, index, count) → "#FFFFFF" | "#16204A"`: mixes `laneHex` toward white by `index / count * 0.45` in sRGB, then returns whichever of white or ink has the higher WCAG contrast.
  - `contrastRatio(hexA, hexB) → number`.

- [ ] **Step 1: Write the failing tests:**
  - `contrastRatio("#FFFFFF", "#000000")` is close to 21.
  - For every lane colour and every key index, `contrastRatio(mixed, keyTextColor(...)) >= 4.5`.
  - `contrastRatio("#16204A", "#E6EEFB") >= 4.5`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement `contrast.js` and write the CSS. `global.css` sets: `body` background `var(--sky)`, colour `var(--ink)`, `font-family: "Baloo 2", system-ui, sans-serif`, base 16 px with line-height 1.5; `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }`; and `button { cursor: pointer; min-height: 44px; min-width: 44px; }`. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add design tokens and accessible key colours`.

### Task 11: Lane component (`src/components/Lane.jsx`, `Lane.css`)

**Files:** Create both; Test `src/components/Lane.test.jsx`

**Interfaces:**
- Consumes: `Lane` objects (Task 2), `keyTextColor` (Task 10).
- Produces: `<Lane lane slots currentSlot onZone onClear />`, where `slots: number[16]`, `currentSlot: number | null`, `onZone(laneId, zone)` and `onClear(laneId)`. `zoneFromX(clientX, rect, count) → 0..count-1` is a named export.

Behaviour:
- The keys container listens for `pointerdown` and `pointermove`. It finds the zone with `zoneFromX` and fires `onZone` only when the zone differs from the last zone seen for that `pointerId`, stored in a ref `Map`. On `pointerleave`, `pointerup` and `pointercancel`, that pointer's entry is deleted. `touch-action: none` is set on the keys.
- Each key is a `<button>` with `aria-label` "`<Lane label>` `<zone label>`" (for example "Melody E"). Enter or Space calls `onZone` (keyboard access, since hover alone is an anti-pattern). The key gets the class `is-hit` for 180 ms after its zone fires.
- Loop dots: 16 `<span>`s, filled when `slots[i] !== -1` and with the class `is-now` when `i === currentSlot`. The dot container has `aria-label` "`<n>` notes in loop".
- The ✕ is a `<button aria-label="Clear <label>">` showing the lucide `X` icon.

- [ ] **Step 1: Write the failing tests:**
  - `zoneFromX(150, { left: 100, width: 100 }, 4) === 2`. A point left of the bar gives 0 and a point right of it gives 3 (clamped).
  - Rendering the melody lane gives 10 buttons named "Melody C" … "Melody A".
  - Fast sweep (Review Focus 1): with the rect mocked via `getBoundingClientRect`, `pointermove` events from x = 0 to the full width in 1 px steps call `onZone` exactly 10 times, with zones 0..9 in order.
  - Staying inside one zone with repeated moves fires once.
  - Leaving and re-entering the same zone fires again.
  - Two pointers (Review Focus 3): pointerId 1 moving in zone 2 and pointerId 2 in zone 7 each fire, giving `[2, 7]`.
  - Keyboard: focusing "Melody G" and pressing Enter calls `onZone("melody", 3)`.
  - The ✕ calls `onClear("melody")`.
  - `slots` with 3 filled entries gives 3 filled dots and the label "3 notes in loop".
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement and style it according to the Visual Direction. Key backgrounds use the `color-mix` formula, key text uses `keyTextColor`, the bar has a border radius of 18 px on its outer ends only, keys are separated by 3 px gaps, and the bar is at least 72 px tall (56 px under 640 px). **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add sweepable lane component`.

### Task 12: TopBar and StartOverlay

**Files:** Create `src/components/TopBar.jsx`, `TopBar.css`, `StartOverlay.jsx`, `StartOverlay.css`; Test `src/components/TopBar.test.jsx`

**Interfaces:**
- Consumes: `WAVEFORMS`, `TEMPO_MIN`, `TEMPO_MAX` (Task 3).
- Produces:
  - `<TopBar song playing busy onPlay onStop onTempo onWaveform onVolume onShare onSaveWav onClearAll />`.
  - `<StartOverlay supported onStart />`.

Copy:
- **Play/Stop button:** "Play" or "Stop".
- **Tempo:** a range control labelled "Tempo" with its value shown as "100 BPM".
- **Melody sound:** a select with options "Sine", "Square", "Sawtooth", "Triangle".
- **Volume:** a range labelled "Volume".
- **Buttons:** "Share", "Save WAV" ("Rendering…" while `busy`), "Clear all".
- **Overlay:** heading "Sweep across the colours to make music", a large button "Start". When `supported` is false, the text reads "This browser can't play Web Audio. Try Chrome, Edge or Firefox." and no button is shown.

- [ ] **Step 1: Write the failing tests:**
  - The Play button calls `onPlay` when not playing. When playing it reads "Stop" and calls `onStop`.
  - Changing the tempo slider to 140 calls `onTempo(140)`, and the text "100 BPM" is shown for the default song.
  - Selecting "Triangle" calls `onWaveform("triangle")`.
  - `busy` disables "Save WAV" and shows "Rendering…".
  - "Clear all" calls `onClearAll`.
  - The overlay's "Start" calls `onStart`. With `supported={false}` there is no button and the message is shown.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. The TopBar is a `--paper` surface with a radius of 14 px. Controls have visible `<label>` elements; there are no placeholder-only labels. Icons are `Play`/`Square`/`Share2`/`Download`/`Trash2`. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add top bar and start overlay`.

### Task 13: App wiring, URL sync and status messages

**Files:** Create `src/useSongUrl.js`; Modify `src/App.jsx`, `src/App.css`; Test `src/useSongUrl.test.js`, `src/App.test.jsx`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `loadSongFromHash(hash: string) → { song: Song, error: string | null }`. An empty hash returns the default song with no error. A bad hash returns the default song with the exact spec message.
  - `useSongUrl() → [song, setSong, error]`: initial state from `location.hash`; calls `history.replaceState(null, "", "#" + encodeSong(song))` on every change; listens for `hashchange` and loads that song.

App behaviour:
- The engine is created on Start, together with the scheduler (`getSong` reads a ref that always holds the latest song).
- `onZone(lane, zone)`:
  - If there is no engine, return without doing anything.
  - Otherwise, call `playZone` at `ctx.currentTime`.
  - If the scheduler is running: `slot = quantize(ctx.currentTime, scheduler.loopStartTime(), song.tempo)`, then `scheduler.suppress(lane, slot)`, then `setSong(recordNote(...))`.
- Volume changes call `engine.setVolume`.
- **Share:** `navigator.clipboard.writeText(location.href)`. On success, show the status "Link copied". On failure, show a selectable `<input readonly>` containing the URL and the text "Copy this link".
- **Save WAV:** set `busy`, call `renderSongToWav`, download through an object URL with `wavFileName`. On failure, show the status "Couldn't save the WAV file. Try again." Clear `busy` in a `finally` block.
- The status area is `<p role="status" aria-live="polite">` and clears after 4 s.

- [ ] **Step 1: Write the failing tests:**
  - `loadSongFromHash("")` returns the default song with error null.
  - `loadSongFromHash("#" + encodeSong(x))` deep-equals `x`.
  - `loadSongFromHash("#garbage")` returns the default song with the error "Couldn't read that song link, started a new one".
  - Hook: after `setSong(setTempo(s, 150))`, `location.hash` decodes to tempo 150.
  - Dispatching `hashchange` after setting `location.hash` to another encoded song updates the song (Review Focus 4).
  - App (Review Focus 2): render it without clicking Start, then fire `pointermove` across the melody lane. Nothing throws, the loop dots remain at 0 filled, and the hash still decodes to an empty melody lane.
  - App: with `window.AudioContext` undefined, the overlay shows the unsupported message.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. The layout follows the Visual Direction: the page has a maximum width of 1100 px and is left-aligned with 16 px gutters. The heading is "Beatmaker" at 28 px weight 800. Below it is one line of help text: "Move across a colour to play it. Everything you play joins the loop." **Step 4:** Run `npm test`. Expected: all suites pass.
- [ ] **Step 5:** Commit `feat: wire app state, audio engine and URL sync`.

### Task 14: Browser verification and production build

**Files:** Modify only to fix what verification finds.

- [ ] **Step 1:** Run `npm run build`. Expected: exit code 0 and a `dist/` folder.
- [ ] **Step 2:** Start `npm run dev` in the background (http://127.0.0.1:5173).
- [ ] **Step 3:** Load the `built-in-browser` skill and open the dev server in the in-app browser. If that browser is unavailable in this host, say so and ask the user to open the URL in Chrome instead, while still verifying everything that doesn't need it.
- [ ] **Step 4:** Check each of spec §1 criteria 1–8 and record the result of each:
  - Start
  - Sweep each lane
  - Loop repeats the sweep
  - Layered playback
  - Clear lane / Clear all
  - Tempo, waveform and volume while playing
  - Reload restores the song
  - Share copies the link
  - Save WAV downloads and plays
- [ ] **Step 5:** Take screenshots at 1440 px and 375 px widths. Check them against the ui-ux-pro-max pre-delivery checklist: no emoji icons, pointer cursor on clickable elements, focus visible when tabbing through, contrast, reduced motion (emulated), no horizontal scroll at 375 px.
- [ ] **Step 6:** Fix any issues test-first where they can be tested. Run `npm test` and `npm run build` again. Commit `fix: address browser verification findings` (only if anything changed).
