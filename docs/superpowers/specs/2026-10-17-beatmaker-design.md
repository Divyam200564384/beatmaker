# Beatmaker: design spec

Date: 2026-10-17
Status: Draft, awaiting review

## 1. Goal

A basic step-sequencer beat maker that runs in the browser. You click cells in a
grid, press play, and hear a steady looping beat and melody. Its design draws on
BeepBox 4.2.0, which was studied with REA (Reverse Engineer Anything).

### Success criteria

In Chrome, on desktop, you can:

1. Click grid cells to turn notes on and off.
2. Press Play and hear a steady 16-step loop. The current column lights up in
   time with the sound.
3. Edit cells while it plays and hear the changes on the next pass of the loop.
4. Change the tempo (30–300 BPM), the melody waveform and the volume.
5. Reload the page, or open a copied link, and get the same song back.
6. Download the loop as a WAV file that plays in a normal media player.

### Constraints

- React and Vite, plain JavaScript.
- All files, dependencies and caches stay inside `REA demo\beatmaker\`. The npm
  cache lives in `REA demo\.npm-cache`. No global installs and no changes to
  system configuration.
- Sound is generated in code with the Web Audio API. No sample files and no
  audio library.
- The development server listens on localhost only.

### Out of scope

Multiple patterns or songs, mobile layout, MIDI, recording, extra instruments,
user accounts, and a backend.

## 2. What REA found in BeepBox

Source: REA `analyze_javascript_application` run on the published `beepbox@4.2.0`
npm package (MIT). Evidence record `ev_98a4c44f…`, saved at
`REA demo\output\beepbox-analysis.json`.

| # | Finding | Location | Type | How this app uses it |
|---|---------|----------|------|----------------------|
| 1 | Play creates and resumes a single `AudioContext` (`activateAudio`). | `synth.ts:4763`, `:4795` | Observed | Create and resume the context on the first Play click. |
| 2 | BeepBox computes every sample itself in a `ScriptProcessorNode` (now deprecated), with a 512–4096-sample buffer. | `synth.ts:4766-4777`, `:4916` | Observed | Not copied. This app uses built-in Web Audio nodes instead. |
| 3 | Timing comes from counting samples, not timers: `samplesPerTick = sampleRate / (bpm/60 × 24 × 2)`. Tempo range is 30–300. | `synth.ts:7725`, `SynthConfig.ts:251-271` | Observed | Use a look-ahead scheduler on the audio clock, so the beat doesn't drift. Same tempo range. |
| 4 | Drums are synthesized noise (NES-style generator and white noise), cached once per drum type. | `SynthConfig.ts:585-625`, `synth.ts:7479` | Observed | Drums are filtered noise and pitched oscillators. The noise buffer is created once and reused. |
| 5 | The whole song is serialized to compact base64: a version character, tag codes, then bit-packed note data. | `synth.ts:1885`, `:2216`, `:301` | Observed | Same idea for the URL hash. |
| 6 | Share links and WAV export are in BeepBox's editor, which is not in the package. | n/a | Unknown | This app's own design: offline rendering with the same scheduling code. |

## 3. Data model

```js
{
  version: 1,
  tempo: 120,            // integer, clamped to 30..300
  waveform: "square",    // "sine" | "square" | "sawtooth" | "triangle"
  volume: 0.8,           // 0..1, stored in steps of 0.05
  steps: 16,             // fixed in v1
  grid: boolean[11][16]  // grid[row][step]
}
```

Rows:

| Row | Sound |
|-----|-------|
| 0 | Kick |
| 1 | Snare |
| 2 | Hi-hat |
| 3–10 | Melody: C major scale from C4 to C5 (C4, D4, E4, F4, G4, A4, B4, C5) |

On screen, the higher notes sit at the top of the melody section and the drums
sit at the bottom.

## 4. Units

| File | Responsibility | Interface |
|------|----------------|-----------|
| `src/song/model.js` | Row definitions, default song, pure updates | `ROWS`, `createDefaultSong()`, `toggleCell(song,row,step)`, `clearGrid(song)`, `setTempo(song,bpm)`, `setWaveform(song,w)`, `setVolume(song,v)` |
| `src/song/codec.js` | Convert a song to and from a URL-safe string | `encodeSong(song) → string`, `decodeSong(str) → song`; throws `CodecError` on bad input |
| `src/audio/instruments.js` | Build the Web Audio nodes for one sound, starting at `time` | `playNote(ctx,out,time,freq,waveform,vel)`, `playKick(ctx,out,time)`, `playSnare(ctx,out,time)`, `playHat(ctx,out,time)` |
| `src/audio/scheduleStep.js` | Play every active cell in one column | `scheduleStep(ctx,out,song,step,time)` |
| `src/audio/scheduler.js` | Look-ahead clock | `createScheduler({ctx, out, getSong, onStep})` returns `{start(), stop(), isRunning()}` |
| `src/audio/renderWav.js` | Render offline and encode to WAV | `renderSongToWav(song, loops=1) → Promise<Blob>`, `encodeWav(audioBuffer) → ArrayBuffer` |
| `src/components/Grid.jsx` | Clickable grid and playhead | props: `song`, `currentStep`, `onToggle` |
| `src/components/Transport.jsx` | Play/stop button and tempo control | props: `playing`, `tempo`, `onPlay`, `onStop`, `onTempo` |
| `src/components/SoundControls.jsx` | Waveform picker and volume slider | props: `waveform`, `volume`, `onWaveform`, `onVolume` |
| `src/components/ShareButton.jsx` | Copy the current URL to the clipboard | props: none |
| `src/components/ExportButton.jsx` | Render the loop and download the WAV | props: `song` |
| `src/App.jsx` | Holds song state, keeps the URL hash in sync, owns the audio engine | none |

`instruments.js`, `scheduleStep.js` and `renderWav.js` accept any
`BaseAudioContext`, so live playback and offline export share the same code.

## 5. Codec format

The string is URL-safe base64, using the alphabet `A–Z a–z 0–9 - _`. Each
character holds 6 bits.

| Characters | Content |
|------------|---------|
| 1 | Format version (`1` → `B`) |
| 2 | Tempo, 12 bits, the BPM value itself (30..300) |
| 1 | Waveform index 0..3 |
| 1 | Volume step 0..20 (volume × 20) |
| 30 | Grid, 11 × 16 = 176 bits, row-major, zero-padded to 180 bits |

That makes 35 characters in total. Decoding rejects strings of the wrong length,
characters outside the alphabet, an unknown version, a tempo outside 30..300, a
waveform index above 3, and a volume step above 20.

## 6. Audio

- **Master chain:** each sound → master gain (song volume) →
  `DynamicsCompressor` (gentle limiter) → destination.
- **Melody:** an `OscillatorNode` with the chosen waveform at the row's
  frequency. The envelope rises to 0.3 in 5 ms and falls exponentially to 0.001
  over 0.25 s, then the oscillator stops.
- **Kick:** a sine wave that falls from 150 Hz to 50 Hz over 0.12 s. Gain starts
  at 1 and decays over 0.3 s.
- **Snare:** white noise through a high-pass filter at 1 kHz, decaying over
  0.15 s, plus a 180 Hz triangle wave decaying over 0.08 s.
- **Hi-hat:** white noise through a high-pass filter at 7 kHz, decaying over
  0.05 s.
- **Noise buffer:** 1 second of white noise, created once per context and cached
  in a `WeakMap`.
- **Step length:** `60 / tempo / 4` seconds (16th notes).
- **Scheduler:** a 25 ms `setInterval` tick. On each tick, every step whose time
  is less than `ctx.currentTime + 0.1` is scheduled. `onStep(step)` fires as
  close as possible to when that step is heard. The scheduler calls `getSong()`
  for each step, so edits and tempo changes apply on the next step.
- **Audio start:** the `AudioContext` is created lazily and `resume()` is called
  on the first Play click.
- **WAV export:** an `OfflineAudioContext` at 44.1 kHz, stereo, with a length of
  one loop plus a 0.5 s tail. Every step is scheduled at its offline time, then
  the result is encoded as 16-bit PCM WAV with samples clamped to −1..1. The file
  is named `beatmaker-<tempo>bpm.wav`.

## 7. URL sync

- **On load:** if `location.hash` decodes, use that song. If it is empty, use the
  default song. If decoding fails, use the default song and show a message:
  "Couldn't read that song link, started a new one".
- **On change:** call
  `history.replaceState(null, "", "#" + encodeSong(song))`, which adds no history
  entries.

## 8. Errors and edge cases

- **No Web Audio:** if `window.AudioContext` is missing, show a "browser not
  supported" banner and disable Play and Export.
- **Tempo input:** values are clamped and rounded before they reach the model.
- **WAV export:** the button shows "Rendering…" and is disabled while rendering.
  On failure, show an error message and re-enable the button.
- **Clipboard:** if copying fails, select the URL text and show a "Copy the link
  above" message.
- **Hidden tab:** browsers throttle intervals in background tabs. Scheduling
  ahead keeps short throttles from being heard. Long gaps are not handled in v1.

## 9. Testing

Vitest with jsdom. Each unit is written test-first.

- **codec:**
  - Round-trip gives back the identical song for an empty grid, a full grid,
    20 random grids, tempo 30 and tempo 300, and every waveform.
  - Bad input is rejected: wrong length, bad characters, wrong version, and
    values out of range.
- **model:**
  - Toggling a cell flips only that cell and does not mutate the input.
  - Clearing empties the grid.
  - Setters clamp out-of-range values.
  - Melody row frequencies are correct (C4 = 261.63 Hz, C5 = 523.25 Hz).
- **scheduler:**
  - With a fake context clock and fake timers, steps are spaced exactly
    `60/tempo/4` apart.
  - The step number wraps from 15 to 0.
  - A tempo change applies on the next step.
  - `stop()` stops further scheduling.
- **scheduleStep:** with a stub context, a column with kick + E4 calls
  `playKick` and `playNote(…, 329.63, …)` at the given time.
- **encodeWav:** the header has RIFF/WAVE/fmt/data, the sample rate, channel
  count and byte sizes are correct, and samples convert correctly (1.0 → 32767,
  −1.0 → −32768, clamped).
- **Manual check in Chrome:** every success criterion in section 1.

## 10. Project setup

- `REA demo\beatmaker\` is created from Vite's React template.
- Dependencies are installed locally with the in-folder npm cache.
- A local git repository is initialized in `beatmaker\` only.
- Scripts: `npm run dev` (localhost), `npm test`, `npm run build`.
