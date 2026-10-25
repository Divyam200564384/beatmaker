# Beatmaker showcase film — brief

**Product.** Beatmaker v1 (https://divyam200564384.github.io/beatmaker/), a free browser music toy.
Four coloured lanes (Melody, Chords, Bass, Drums). Moving the mouse (laptop) or dragging a finger
(phone) across a lane plays notes; every note played joins a 16-step loop that keeps repeating.
All pitched notes are C major pentatonic, so everything fits together.

**Viewer.** A first-time visitor, any age, possibly a child, who has never made music. They see the
film inside the first-visit tutorial card, **muted, autoplaying, looping**.

**Problem.** They land on a page of coloured bars and don't know what to do with them.

**Single action (CTA).** "Sweep a colour to start." (The tutorial's button then starts the sound.)

**Provably true (all shown with the real UI components, real styles, real state logic):**
- Sweeping a lane plays its keys; notes are recorded into the loop (dots fill).
- The loop repeats; the ringed dot is the playhead.
- A finger can strum from one lane into the next.
- Tempo slider (30–300 BPM), Melody sound (Sine/Square/Sawtooth/Triangle), Volume.
- ✕ clears one lane.
- Share copies a link to the song ("Link copied"); Save WAV downloads it ("Saving…" → "WAV saved").

**Never claim.** Recording a voice, instruments beyond the four lanes, accounts, saving to a cloud,
"AI", user numbers, ratings or testimonials.

**Assets.** No AI footage. Every frame is the real React components (`Lane`, `TopBar`,
`SongActions`) rendered from a deterministic timeline. The pointer/finger is an overlay.

**Formats.**
- `wide` 16:9, laptop layout of the app, mouse pointer. Master 1920×1080, 60fps.
- `square` 1:1, real phone layout of the app (390px wide), touch indicator. Master 1080×1080, 60fps.
- Web encodes (H.264, 30fps, no audio) for the tutorial, each under ~1.5 MB, plus poster frames.

**Brand.** Sky `#e6eefb`, ink `#16204a`, paper `#fff`, lanes `#2C5BE8 #8B4BD6 #13906A #E8632B`.
Type: Baloo 2 (500/700/800).

**Length.** 15–20s (user: "5–15s, can increase if needed").

**Audio.** None in the delivered web files: the tutorial autoplays, and browsers only autoplay muted
video. Stated as a limit, not hidden.

## Storyboard (≈19s)

This is the first draft. The storyboard critic changed the order (controls now come before the
loop beat) and the captions; the final timings live in `timeline.js`.

| Time | On screen | Job | Out |
|---|---|---|---|
| 0.0–1.4 | Whole app, blurred and tinted; huge "Make a beat in seconds." | Hook: what it is | Title scales through camera; app sharpens underneath |
| 1.4–4.4 | Close on Melody lane (fills ~80% width). Pointer sweeps left→right; keys pop; dots fill; playhead ring moves. Caption "Sweep across a colour" | Core action → visible result | Camera eases down, pointer survives |
| 4.4–7.2 | Chords, Bass, Drums. Pointer strums down through three lanes, then taps a drum pattern. Caption "Four instruments. Every note fits." | Range of the toy | Camera slides right onto the dots |
| 7.2–8.8 | Macro on the dot grids of all four lanes, playhead ring running across filled dots. Caption "It keeps looping" | Loop concept | Camera rises to the control bar |
| 8.8–11.8 | Control bar close-up. Pointer drags Tempo 100→140 (value counts), switches Melody sound Square→Triangle, nudges Volume. Caption "Change tempo, sound and volume" | Controls | Camera drops to Drums row end |
| 11.8–13.4 | Drums row: pointer clicks ✕, drum dots empty. Caption "Clear a row with ✕" | Undo safety | Camera rises to actions |
| 13.4–16.6 | Share / Save WAV + status. Click Share → "Link copied". Click Save WAV → "Saving…" → "WAV saved". Caption "Share a link · Save a WAV" | Outcome | Camera pulls fully wide |
| 16.6–19.0 | Whole app, all lanes filled, tint + "Your turn." / "Sweep a colour to start" with slow push | CTA, loops back to frame 0 | (loop) |

Signature transformations: (1) the title flies through the camera to reveal the app it was
printed on; (2) a sweep across keys turns into dots filling in the loop; (3) the pointer is the
persistent actor carried through every shot.

## Gauntlet ledger

| Round | Artifact | Critic's top findings | Changes | Measured |
|---|---|---|---|---|
| Storyboard | BRIEF.md | Loop wrap not visible at 100 BPM; ✕ contradicts "all filled" ending; captions too small; wide must be hover-only | Tempo beat moved before loop beat (3s loop at 160 BPM); drums redrawn after ✕; captions ≥40px; hover-only on wide | — |
| r1 | wide/square r1 | Captions over the UI ~70% of runtime; no wide close-ups; square button reflow at 15.67 ("Rendering…"); title ghosting; pointer brushing keys in transit | Solid caption strip; tracking close-ups; app fix: fixed-width Save WAV button, label "Saving…"; routed pointer; pointer rides the playhead | Frozen 0.0s / 0.1s |
| r2 | wide/square r2 | Wide camera detour to Share at 6.4; "Volume" clipped; headline over UI at CTA entry and seam; lifted finger looked like a press; square CTA cropped two lanes | Follow camera holds until arrival; framing includes Volume; seam = veil first, then headline swap; dashed lifted ring; all four lanes in square CTA | Frozen 0.0s / 0.0s |
| r3 | wide/square r3 | **SHIP.** Optional polish: square strum diagonal presses across the Drums header (this is how a real strum crosses lanes in the phone layout); square header row half-cropped 14–16.3; wide loop dots ~20% of width | Not changed | Frozen 0.0s / 0.0s; web files 1.18 MB (wide) / 0.94 MB (square) |

Limits: frames were reviewed as sampled contact sheets (every 0.25s) plus dense 1/30s windows around transitions, not every frame. No audio.

**r4 (client: "slow the pace").** Whole script stretched by `PACE = 1.3` in `timeline.js` (19.6s → 25.5s):
pointer moves, camera moves, captions and holds all scale; the app itself (key pops, BPM, loop clock)
keeps real time. Frozen 0.0s / 0.0s. Web files 1.39 MB (wide) / 1.11 MB (square).
