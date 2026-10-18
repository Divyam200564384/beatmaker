# Beatmaker: design spec

Date: 2026-10-17
Status: Draft v2 (sweep lanes; replaces the v1 click-grid design), awaiting review

## 1. Goal

A browser music toy that a child can use. You move the mouse (or a finger)
across coloured instrument lanes, as if strumming, and hear sounds straight away.
Whatever you play is snapped to the beat and kept in a loop that is always
playing, so you build up music by layering lanes. Every sound comes from one
pentatonic scale and every chord is built from that scale, so overlapping lanes
never clash. The design draws on BeepBox 4.2.0, which was studied with REA
(Reverse Engineer Anything).

### Success criteria

In Chrome, on desktop:

1. After a single "Start" tap, moving the cursor across a lane plays a sound
   each time it enters a new zone.
2. Those sounds are snapped to the nearest eighth-note slot and repeat every
   loop. You don't press record.
3. Sweeping several lanes produces layered music with no clashing notes.
4. Each lane can be cleared, and "Clear all" empties everything.
5. Tempo (30–300 BPM), melody waveform and volume can all be changed while the
   loop plays.
6. Reloading the page, or opening a copied link, restores the same loop.
7. "Save WAV" downloads the loop as a file that plays in a normal media player.
8. Touch input works the same way as the mouse (pointer events).

### Constraints

- React and Vite, plain JavaScript.
- All files, dependencies and caches stay inside `REA demo\beatmaker\`. The npm
  cache is `REA demo\.npm-cache`. No global installs and no system
  configuration changes.
- Sound is generated in code with the Web Audio API. No sample files and no
  audio library.
- The development server listens on localhost only.

### Out of scope

Multiple loops or songs, different keys or scales, recording microphone audio,
MIDI, undo history, accounts and any backend.

## 2. What REA found in BeepBox

Source: REA `analyze_javascript_application` run on the published `beepbox@4.2.0`
npm package (MIT). Evidence record `ev_98a4c44f…`, saved at
`REA demo\output\beepbox-analysis.json`.

| # | Finding | Location | Type | How this app uses it |
|---|---------|----------|------|----------------------|
| 1 | Play creates and resumes one `AudioContext` (`activateAudio`). | `synth.ts:4763`, `:4795` | Observed | Create and resume the context on the Start tap. Browsers require a click or tap; hovering does not count. |
| 2 | BeepBox computes every sample itself in a `ScriptProcessorNode` (deprecated), buffer 512–4096. | `synth.ts:4766-4777`, `:4916` | Observed | Not copied. Built-in Web Audio nodes are used instead. |
| 3 | Timing comes from counting samples, not timers: `samplesPerTick = sampleRate / (bpm/60 × 24 × 2)`. Tempo range 30–300. | `synth.ts:7725`, `SynthConfig.ts:251-271` | Observed | A look-ahead scheduler on the audio clock, so the beat doesn't drift. Same tempo range. |
| 4 | Drums are synthesized noise (NES-style generator and white noise), cached once per drum type. | `SynthConfig.ts:585-625`, `synth.ts:7479` | Observed | Drums are filtered noise and pitched oscillators. The noise buffer is created once and reused. |
| 5 | The song is serialized to compact base64: version character, tag codes, then bit-packed note data. | `synth.ts:1885`, `:2216`, `:301` | Observed | Same idea for the share link in the URL hash. |
| 6 | BeepBox's share links and WAV export live in its editor, which is not in the package. | n/a | Unknown | This app's own design: offline rendering with the same scheduling code. |

## 3. Music rules

- **Scale:** C major pentatonic (C D E G A) only.
- **Loop:** 16 slots, each an eighth note, which is 2 bars of 4/4.
  `slotDuration = 60 / tempo / 2` seconds. The default tempo is 100.
- **One note per lane per slot.** Recording into a filled slot replaces the old
  note.

Lanes are listed top to bottom on screen. Zones run left to right.

| Lane | Colour | Zones (left → right) |
|------|--------|----------------------|
| Melody | blue | C4, D4, E4, G4, A4, C5, D5, E5, G5, A5 (10 zones) |
| Chords | purple | C (C3 E3 G3), Am (A2 C3 E3), Gsus4 (G2 C3 D3), Csus2 (C3 D3 G3) (4 zones) |
| Bass | green | C2, D2, E2, G2, A2 (5 zones) |
| Drums | orange | kick, snare, hi-hat (3 zones) |

Frequencies use equal temperament with A4 = 440 Hz:
`f = 440 × 2^((midi − 69) / 12)`.

## 4. Interaction

- **Start overlay:** a large "▶ Start" overlay covers the lanes until it is
  tapped. The tap creates and resumes the `AudioContext` and starts the loop.
  After that the overlay is gone and the TopBar shows a Stop/Play toggle.
- **TopBar** (above the lanes, so reaching it never crosses a lane): Play/Stop,
  tempo slider with its value, melody waveform select (sine, square, sawtooth,
  triangle), volume slider, Share, Save WAV, Clear all.
- **Sweeping:** each lane is a horizontal strip divided into equal zones. On
  `pointermove` or `pointerdown` inside a lane, the zone under the pointer is
  worked out. When it differs from the last zone that pointer was in for that
  lane, the lane calls `onZone(laneId, zone)`. Leaving the lane resets the last
  zone, so re-entering the same zone plays again.
- **On a zone event while playing:**
  1. Play the sound immediately (live feedback).
  2. Work out `slot = quantize(now)`.
  3. Record it with `recordNote(song, lane, slot, zone)`.
  4. Tell the scheduler to skip that lane and slot if it is due within the next
     150 ms. This avoids hearing the same hit twice.
- **On a zone event while stopped:** play the sound only. Nothing is recorded.
- **Loop dots:** each lane shows 16 dots at its right edge. A filled dot means a
  note is recorded there. The dot for the current slot is highlighted on every
  lane as the loop plays.
- **Clearing:** a ✕ button per lane clears that lane. "Clear all" clears every
  lane.

## 5. Data model

```js
{
  version: 2,
  tempo: 100,          // integer 30..300
  waveform: "square",  // "sine" | "square" | "sawtooth" | "triangle"
  volume: 0.8,         // 0..1, steps of 0.05
  lanes: {             // 16 entries each; -1 = empty, otherwise zone index
    melody: number[16],  // 0..9
    chords: number[16],  // 0..3
    bass:   number[16],  // 0..4
    drums:  number[16]   // 0..2
  }
}
```

The default song has a tempo of 100, the square waveform, volume 0.8 and every
lane empty.

## 6. Units

| File | Responsibility | Interface |
|------|----------------|-----------|
| `src/music/lanes.js` | Lane and zone definitions and frequencies | `LANES` (ordered array of `{id, label, color, zones:[{label, freqs:number[]}]}` for melody, chords and bass; for drums, `{label, drum:"kick"\|"snare"\|"hat"}`), `midiToFreq(m)` |
| `src/song/model.js` | Pure song updates | `createDefaultSong()`, `recordNote(song,lane,slot,zone)`, `clearLane(song,lane)`, `clearAll(song)`, `setTempo`, `setWaveform`, `setVolume` (all return a new song and clamp values) |
| `src/song/codec.js` | Convert a song to and from a URL-safe string | `encodeSong(song)`, `decodeSong(str)`; throws `CodecError` |
| `src/audio/quantize.js` | Snap a time to a slot | `quantize(time, loopStartTime, tempo) → 0..15` (nearest slot, wraps) |
| `src/audio/instruments.js` | Build the Web Audio nodes for one sound at `time` | `playMelody(ctx,out,time,freq,waveform)`, `playBass(ctx,out,time,freq)`, `playChord(ctx,out,time,freqs)`, `playKick`, `playSnare`, `playHat` `(ctx,out,time)` |
| `src/audio/playZone.js` | Turn a lane and zone into the right instrument call | `playZone(ctx,out,song,laneId,zone,time)` |
| `src/audio/scheduleSlot.js` | Play every lane's note for one slot | `scheduleSlot(ctx,out,song,slot,time,skip?)` |
| `src/audio/scheduler.js` | Look-ahead loop clock | `createScheduler({ctx,out,getSong,onSlot})` returns `{start(), stop(), isRunning(), loopStartTime(), suppress(laneId,slot)}` |
| `src/audio/engine.js` | Owns the context and the master chain | `createEngine()` returns `{ctx, out, setVolume(v)}`; chain: sound → master gain → compressor → destination |
| `src/audio/renderWav.js` | Render offline and encode WAV | `renderSongToWav(song) → Promise<Blob>`, `encodeWav(audioBuffer) → ArrayBuffer` |
| `src/components/StartOverlay.jsx` | First-tap audio unlock | props: `onStart` |
| `src/components/TopBar.jsx` | Controls | props: `song`, `playing`, `onPlay`, `onStop`, `onTempo`, `onWaveform`, `onVolume`, `onClearAll`, `onShare`, `onSaveWav`, `busy` |
| `src/components/Lane.jsx` | Zones, pointer handling, loop dots, ✕ | props: `lane`, `slots`, `currentSlot`, `onZone`, `onClear` |
| `src/App.jsx` | Holds state, keeps the URL in sync, connects engine, scheduler and UI | none |

`instruments.js`, `playZone.js`, `scheduleSlot.js` and `renderWav.js` accept any
`BaseAudioContext`, so live playback and WAV export share the same code.

## 7. Sounds

All envelopes start at 0.0001 and use exponential ramps, so notes don't click.

- **Melody:** an oscillator with the chosen waveform. Attack to 0.25 over 5 ms,
  decay to 0.0001 over 0.35 s.
- **Bass:** a triangle wave plus a sine an octave lower, mixed. Peak 0.5, decay
  over 0.4 s.
- **Chord:** one sine and one triangle per chord note through a low-pass filter
  at 1.8 kHz. Peak 0.12 per note, attack 30 ms, decay over 0.9 s (soft pad).
- **Kick:** a sine wave falling from 150 Hz to 50 Hz over 0.12 s, gain 1 decaying
  over 0.3 s.
- **Snare:** white noise through a high-pass filter at 1 kHz, decaying over
  0.15 s, plus a 180 Hz triangle wave decaying over 0.08 s.
- **Hi-hat:** white noise through a high-pass filter at 7 kHz, decaying over
  0.05 s.
- **Noise buffer:** 1 s of white noise per context, cached in a `WeakMap`.

## 8. Scheduler

- A `setInterval` tick runs every 25 ms. Each tick schedules every slot whose
  time is less than `ctx.currentTime + 0.1` s, using `scheduleSlot` with the
  latest `getSong()`.
- After each slot, the next slot time is the current one plus
  `60 / tempo / 2`. A tempo change takes effect from the next slot.
  `loopStartTime` is re-anchored each time the slot number wraps to 0.
- `onSlot(slot)` is called with a `setTimeout` timed to when the slot is
  actually heard, which drives the UI highlight.
- `suppress(laneId, slot)` skips that lane and slot once, if it is already
  queued or is due within 150 ms.

## 9. Codec format

The string uses URL-safe base64 (`A–Z a–z 0–9 - _`), 6 bits per character.

| Characters | Content |
|------------|---------|
| 1 | Format version (2) |
| 2 | Tempo, 12 bits (30..300) |
| 1 | Waveform index 0..3 |
| 1 | Volume step 0..20 (volume × 20) |
| 43 | Lanes in order melody, chords, bass, drums; 16 slots each; 4 bits per slot (15 = empty); 256 bits, zero-padded to 258 |

That makes 48 characters. Decoding rejects strings of the wrong length,
characters outside the alphabet, a version other than 2, a tempo outside
30..300, a waveform index above 3, a volume step above 20, and a zone index
outside the lane's range (other than 15).

## 10. URL sync

- **On load:** decode `location.hash`. If the hash is empty, use the default
  song. If decoding fails, use the default song and show the message "Couldn't
  read that song link, started a new one".
- **On every song change:**
  `history.replaceState(null, "", "#" + encodeSong(song))`.

## 11. WAV export

An `OfflineAudioContext` at 44.1 kHz, stereo, with a length of one loop plus a
1 s tail, using the same master chain. Every slot is scheduled at its offline
time with `scheduleSlot`. The result is encoded as 16-bit PCM WAV with samples
clamped to −1..1, and downloaded as `beatmaker-<tempo>bpm.wav`.

## 12. Errors and edge cases

- **No Web Audio:** if `window.AudioContext` is missing, show a "browser not
  supported" banner and disable Start.
- **Settings input:** tempo, volume and waveform are clamped or validated in the
  model.
- **WAV export:** the button shows "Rendering…" and is disabled while rendering.
  On failure, show an error message and re-enable it.
- **Clipboard:** if copying fails, show the URL in a selectable box with "Copy
  this link".
- **Old links:** a v1 link fails the version check and is treated as a bad link.
- **Background tabs:** scheduling ahead absorbs short timer throttling. Long
  gaps are not handled in v1.

## 13. Testing

Vitest with jsdom. Each unit is written test-first.

- **lanes:**
  - Every melody and bass frequency, and every chord note, maps to a pitch class
    in {C, D, E, G, A}. This is the "no wrong notes" guarantee.
  - Zone counts are 10, 4, 5 and 3.
  - `midiToFreq(69) = 440`.
- **model:**
  - `recordNote` replaces a filled slot and leaves the input unchanged.
  - Clearing one lane and clearing all both work.
  - Setters clamp out-of-range values.
- **codec:**
  - Round-trip gives back the identical song for an empty song, a full song,
    20 random songs, tempo 30 and 300, and every waveform.
  - Every invalid input listed in §9 is rejected.
- **quantize:**
  - Times just before and just after a slot boundary round to the nearest slot.
  - Slot 15.6 wraps to 0.
  - Results are correct at tempos 60, 100 and 300.
- **scheduler** (fake context clock, fake timers):
  - Slots are spaced `60/tempo/2` apart.
  - The slot number wraps from 15 to 0.
  - A tempo change applies on the next slot.
  - A suppressed lane and slot is skipped once.
  - `stop()` halts scheduling.
- **scheduleSlot / playZone** (stub instruments):
  - Each lane routes to the right instrument with the right frequencies.
  - Empty slots play nothing.
- **encodeWav:**
  - RIFF/WAVE/fmt/data headers are correct.
  - Sample rate, channel count and sizes are correct.
  - Samples convert correctly (1.0 → 32767, −1.0 → −32768) and are clamped.
- **Manual check in Chrome:** every success criterion in §1.

## 14. Project setup

- `REA demo\beatmaker\` is created from Vite's React template.
- Dependencies are installed locally with the in-folder npm cache.
- The git repository is local to `beatmaker\`.
- Scripts: `npm run dev` (localhost), `npm test`, `npm run build`.
