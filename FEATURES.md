# OpusWeb Features

**OpusWeb 1.1.0 · by Ray Foo**

A complete reference of what the studio can do, how playback works, and current limitations.

## Score creation & layout
- **Templates**: Piano Grand Staff, Acoustic Guitar + TAB, Solo Violin, Solo Cello, Solo Flute, Solo Trumpet, String Quartet, SATB Choir.
- **Layouts**: A4 **Page** view and **Continuous** view, with automatic system grouping and pagination.
- **Zoom**: 55%–180%, plus reset-to-100%.
- **Multi-part scores** with grand staff, solo staves, linked tablature, and percussion staves.
- **Metadata**: title, subtitle, composer, default tempo, per-measure tempo changes.
- **Measures**: append, delete, key/time/clef changes, barlines and repeats.

## Note editing
- **Note Input Mode (`N`)** with snapped ghost cursor, ledger lines, and live pitch readout.
- **Mouse input** on any staff or linked TAB.
- **Keyboard pitch entry** (`A`–`G`), durations (`1`–`6`), dots (`.`), rests (`0`/`R`), ties (`T`).
- **Accidentals**: ♯, ♭, ♮, 𝄪, 𝄫, plus key-signature-aware spelling.
- **Chords**: stack intervals (`+3rd`, `+m3`, `+5th`, `+8ve`) or enter chord mode.
- **Transposition**: diatonic step, chromatic semitone, octave up/down.
- **Lyrics** per note, dynamics (`ppp`–`fff`, `sfz`), and articulations (staccato, accent, tenuto, marcato, fermata).
- **Undo / Redo** with a 40-step history.
- **Autosave** of the active score and recent scores in `localStorage`.

## Palettes
- **Clefs**: treble, bass, alto, tenor, percussion.
- **Key signatures**: 7 flats through 7 sharps.
- **Time signatures**: `4/4`, `3/4`, `2/4`, `6/8`, `3/8`, `2/2`, `5/4`, `7/8`.
- **Dynamics**: `ppp`, `pp`, `p`, `mp`, `mf`, `f`, `ff`, `fff`, `sfz`.
- **Articulations**: staccato, accent, tenuto, marcato, fermata.
- **Barlines**: single, double, final, start repeat, end repeat.
- **Tempo**: Largo through Presto presets and custom measure BPM.

## Chord leadsheets
- **Chords tab** in the Inspector, tied to the selected measure.
- **Symbol input** with validation: `C`, `Am`, `F#m7`, `Bb`, `G7/B`, `Cmaj7`, `Dm7b5`, `E°7`, `Aø7`, etc.
- **Quick-add palette** for common chords.
- **Beat placement** using the measure's time signature; quick-add advances automatically.
- **Engraved above the staff** at the correct beat position.
- **Progression list** with per-chord delete.
- **Playback**: block-chord voicings (root around C3, slash bass below) using the first pitched instrument.
- **Persistence & repeats**: chords are stored per measure and repeat with repeat barlines.

## Tablature
- **6-string guitar TAB** (EADGBE) and **4-string bass TAB** (EADG).
- **Automatic fingering** that prefers low frets and unused strings for chords.
- **Manual fingering** per note: string picker and fret field (0–24).
- **Click-to-type**: select a fret number on the TAB staff, then type digits (`1` then `3` → 13).
- **Notation sync**: changing string/fret rewrites the pitch on the staff above.
- **Per-part toggle** (`Linked Guitar TAB` / `Linked Bass TAB`) shown only for guitar and bass parts.
- **TAB ties, hit-testing, and selection highlight** per string.

## Instruments & playback
- **Curated instruments**: Piano, Violin, Viola, Violoncello, Flute, Clarinet, Trumpet, French Horn, Acoustic Guitar, Electric Guitar, Bass Guitar, Brass Section, Drum Kit, Choir Aahs.
- **Sampled GM playback** using the free **Musyng Kite** soundfont (CC BY-SA 3.0), loaded on demand and cached.
- **Synth fallback** while samples load, when offline, or if a bank fails.
- **Mixer**: per-part volume, mute, solo.
- **Transport**: play/pause, stop, rewind, metronome, loop, master tempo, animated playhead.
- **Repeat playback**: `|: … :|` sections play twice.
- **Drum kit**: synthesized kit with a percussion staff and mapped pieces (kick, snare, hats, toms, cymbals, clap, cowbell, side stick).
- **Audition**: selecting or entering a note previews its sampled pitch (or drum hit).

## Import
- `.mscz` (MuseScore compressed), `.mscx` (MuseScore XML), `.musicxml`, `.xml`, `.mxl`, `.mid`, `.midi`, and OpusWeb `.json`.
- **File picker** or **drag-and-drop** onto the sheet canvas.
- **Web links** through the `/api/fetch-score` proxy, with GitHub `blob` → raw normalization and `?scoreUrl=` loading.
- **Starter library**: Minuet in G, Acoustic Guitar Arpeggio Study, Ode to Joy, Prelude in A Major, plus a blank piano score.
- **Recent scores** restored from the browser.

## Export
- `.mscz` (MuseScore 3/4), `.mscx`, `.musicxml` 3.1, `.mid` (SMF Format 1), `.opusweb.json`, and **Print / Save as PDF**.

## Appearance
- **Continuous 0%–100% theme scaling** with a draggable sun/moon slider: surfaces, borders, buttons, scrollbars, and accents interpolate smoothly between light and dark, with a percentage readout. Text switches at 50% for contrast, and the knob keeps its position instead of snapping to the ends.
- **Keyboard support**: arrow keys, `Home` (0%), and `End` (100%).
- **Persistent choice** of both theme and slider level across reloads.
- **Print-safe**: studio chrome is hidden and pages print white regardless of theme.

## Identity
- Header displays **OpusWeb v1.1.0 · by Ray Foo**.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `N` | Toggle Note Input Mode |
| `1` – `6` | Whole, Half, Quarter, 8th, 16th, 32nd duration |
| `A` – `G` | Insert note by letter name |
| `0` or `R` | Rest / toggle Rest mode |
| `.` | Dotted duration |
| `T` | Tie to next note |
| `↑` / `↓` | Diatonic step (`Shift+↑`/`↓` = octave) |
| `←` / `→` | Previous / next note or rest |
| `Delete` / `Backspace` | Clear note to rest |
| `Space` | Play / Pause |
| `Ctrl/Cmd + Z` | Undo (`Shift` for Redo) |
| `0`–`9` (TAB selected) | Type a fret number |

## Current limitations
- **GitHub Pages is static**: the `/api/fetch-score` web-link proxy requires the Node server. Local file import, editing, playback, and export work without it.
- **Soundfont downloads**: the first playback of each instrument downloads a sample bank (~2–3 MB). A synth fallback plays until it is ready.
- **Repeats** play a section exactly twice; nested repeats and multiple endings are not implemented.
- **Drum kit** is synthesized rather than sampled, and uses a fixed mapping on a percussion staff.
- **Chord leadsheet** symbols are stored on the lead staff only; MusicXML/MuseScore export does not currently write them as harmony elements.
- **MIDI export** does not place drum parts on channel 10.
- **Audio** requires a browser user gesture before the AudioContext can start (normal browser policy).

## Browser support
- Modern Chromium, Firefox, and Safari with Web Audio API and ES2022 support.
- Best experienced on desktop; the studio layout is optimized for large screens.
