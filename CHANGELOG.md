# Changelog

All notable changes to OpusWeb are documented in this file.

## [1.1.0] - 2026-11-15

### Added
- **Light & dark studio themes** with a draggable sun/moon slider in the header (keyboard accessible; persisted in `localStorage`). Sheet pages stay white in both themes.
- **Guitar TAB fingering editor**: choose a string and fret in the Inspector, or click a fret number on the TAB staff and type digits (buffered for two-digit frets). The notation above updates to the matching pitch.
- **Bass TAB support**: 4-string EADG tablature with its own tuning/voicing model, plus a `Linked Bass TAB` toggle.
- **Sampled General MIDI playback** from the free **Musyng Kite** soundfont (CC BY-SA 3.0), streamed on demand with GitHub Pages and jsDelivr mirrors, decoded by `soundfont-player`, with a synth fallback while loading or offline.
- **New instruments**: Electric Guitar, Bass Guitar, Brass Section, and Drum Kit, joining the existing piano, strings, woodwind, brass, and choir presets.
- **Drum Kit part** with a percussion clef, drum-piece legend, nearest-position mapping, and a synthesized acoustic-style kit (kick, snare, side stick, clap, closed/open/pedal hi-hat, three toms, crash, ride, cowbell).
- **Chord Leadsheet**: a new **Chords** tab to add chord symbols at any beat with quick-add presets; symbols are engraved above the staff and played back as block chords. Supports maj/min/dim/aug/sus/6/7/maj7/m7/9/add9/m7♭5/dim7 and slash chords.
- **Repeat barline playback**: `|: … :|` sections are expanded and played twice; written repeats also render on linked TAB and percussion staves.
- **Version & author identity**: header now shows `OpusWeb v1.1.0 · by Ray Foo`; package metadata updated.
- **Documentation set**: rewritten README and user guide, new FEATURES reference, updated architecture/contributing docs.

### Changed
- New Score now lists only curated, sampled instrument templates (Piano, Acoustic Guitar + TAB, Solo Violin, Solo Cello, Solo Flute, Solo Trumpet, String Quartet, SATB Choir) with soundfont attribution.
- Parts now carry a GM `program`; the audio engine resolves sampled instruments per part and preloads them on the first user gesture.
- TAB handling is generalized behind `TabInstrumentConfig`, so guitar and bass share rendering, hit-testing, and fret editing.
- `Linked Guitar TAB` is now shown only for guitar-family parts; bass parts get `Linked Bass TAB`.
- UI chrome moved to CSS theme tokens for consistent light/dark styling.

### Fixed
- Playhead could disappear after pressing Stop then Play (or Pause then Play) because the previous run's tick callback reported `playing=false` into the fresh session. The engine now clears the stale callback before starting.
- Repeat barlines previously only drew; they now affect playback order.
- Linked TAB is no longer offered on piano, strings, brass, voice, or drum parts.
- Bass tablature no longer applies the guitar octave transposition.

## [1.0.0] - 2026-11-14

### Added
- Browser-based SVG sheet music engraver powered by VexFlow 4.2.5 supporting single-staff, Grand Staff, and multi-instrument ensemble layouts in Page and Continuous views.
- MuseScore-style Note Input Mode (`N`) with staff-snapping ghost cursor, ledger lines, letter pitch entry (`A`–`G`), rhythmic durations (`1`–`6`), dots, rests, ties, accidentals, chord stacking, and lyrics.
- Collapsible Palettes sidebar for clefs, key signatures, time signatures, dynamics, articulations, barlines/repeats, and tempo markings.
- Contextual right Inspector and Parts Mixer (instrument presets, mute/solo/volume, score metadata).
- Local file import (file picker and canvas drag-and-drop) for `.mscz`, `.mscx`, `.musicxml`, `.mxl`, `.xml`, `.mid`, `.midi`, and `.json`.
- Server-side `/api/fetch-score` web-link proxy with SSRF protection, GitHub blob-to-raw URL normalization, and `?scoreUrl=` query parameter loading.
- Polyphonic Web Audio synthesizer with lookahead scheduling, metronome click, loop playback, and live playhead cursor.
- Multi-format score export to `.mscz`, `.mscx`, `.musicxml`, `.mid`, `.json`, and print-ready PDF.
- Single-user browser persistence via `localStorage` with 40-step Undo/Redo history and built-in starter library.
