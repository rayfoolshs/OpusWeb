# Changelog

All notable changes to OpusWeb are documented in this file.

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
