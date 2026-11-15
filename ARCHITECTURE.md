# Architecture

**OpusWeb 1.1.0 · by Ray Foo**

OpusWeb is a client-first React + TypeScript notation studio backed by a lightweight Express server for safe remote web-link fetching and production static asset serving. The UI can also be deployed as a static site (GitHub Pages); only the web-link proxy requires the Node server.

## Directory Layout

```text
├── server.ts                       # Express server, /api/fetch-score proxy, Vite dev middleware
├── index.html                      # App shell, early theme bootstrap, Google Fonts
├── src/
│   ├── main.tsx                    # React root entry point
│   ├── version.ts                  # App name, version, author
│   ├── index.css                   # Tailwind v4 entry, theme tokens, print sheet rules
│   ├── App.tsx                     # Studio state, undo/redo, shortcuts, import/export, chords
│   ├── types/
│   │   └── score.ts                # ScoreDocument AST, chord symbols, editor state
│   ├── utils/
│   │   ├── musicTheory.ts          # Pitch math, measure packing, TAB configs and fret mapping
│   │   ├── chords.ts               # Chord symbol parser and block-chord voicings
│   │   ├── scoreParsers.ts         # .mscz, .mscx, .musicxml, .mxl, .xml, .mid, .json import
│   │   ├── scoreExporters.ts       # .mscz, .mscx, .musicxml, .mid, .json export
│   │   └── starterScores.ts        # Starter library, templates, instrument presets
│   ├── audio/
│   │   ├── gmSoundfont.ts          # On-demand Musyng Kite GM sample loader
│   │   ├── drumKit.ts              # Drum mapping and synthesized percussion voices
│   │   └── synthEngine.ts          # Timeline, repeats, sampled/synth playback, scheduler
│   └── components/
│       ├── ScoreCanvas.tsx         # VexFlow engraving, TAB, chord symbols, hitboxes, playhead
│       ├── ToolbarRibbon.tsx       # Note input, durations, accidentals, voices, zoom
│       ├── PaletteSidebar.tsx      # Clefs, keys, time, dynamics, articulations, barlines
│       ├── InspectorPanel.tsx      # Note inspector, chord leadsheet, parts mixer
│       ├── ThemeSlider.tsx         # Draggable light/dark theme control
│       └── Modals.tsx              # Open/Import, Export, New Score, Shortcuts dialogs
```

## Canonical Score AST (`src/types/score.ts`)

All imported formats normalize into a unified `ScoreDocument` model:

- `ScoreDocument` → `parts: Part[]`
- `Part` → instrument metadata (`name`, `shortName`, `timbre`, GM `program`, `volume`, `muted`, `solo`, `showTab`, `drumKit`) + `staves: Staff[]`
- `Staff` → `clef` (treble/bass/alto/tenor/percussion), `measures: Measure[]`
- `Measure` → `attributes` (`clef`, `keyFifths`, `timeSignature`, `tempo`, `barlineLeft`, `barlineRight`) + `voices: VoiceEvent[][]` + optional `chordSymbols: ChordSymbol[]`
- `ChordSymbol` → `{ id, beat, symbol }`, where `beat` is a quarter-note offset from the measure start
- `VoiceEvent` → rest (`isRest: true`) or note/chord (`notes: NoteHead[]`) with `duration`, `dots`, `articulations`, `dynamic`, `lyric`
- `NoteHead` → `pitch`, ties, and optional `tabString` / `tabFret` manual fingering

## Rhythmic Integrity (`src/utils/musicTheory.ts`)

When inserting or changing a note duration inside a measure, `replaceEventInMeasureVoice` computes the beat offset and total measure capacity from the active time signature (`getMeasureCapacityBeats`). Leftover space is automatically filled with optimal standard rests (`fillDurationWithRests`), and oversized durations are clamped or consume adjacent rests so measure beat sums remain valid.

## Tablature Model (`src/utils/musicTheory.ts`)

Tablature is driven by a `TabInstrumentConfig`:

- `GUITAR_TAB_CONFIG`: 6 strings, sounding MIDI `[64, 59, 55, 50, 45, 40]`, written pitch = sounding + 12
- `BASS_TAB_CONFIG`: 4 strings, sounding MIDI `[43, 38, 33, 28]`, written pitch = sounding

`getTabConfig(part)` selects a layout from the part's timbre (guitar) or GM program (bass 32–39). `assignTabPositions` chooses non-overlapping string/fret positions (manual overrides first, then low-fret preference), and `tabPositionToWrittenPitch` converts a string/fret back into notation. `ScoreCanvas` creates a `TabStave` with `num_lines` from the config and records one hit box per string.

## Chord Leadsheet (`src/utils/chords.ts`)

- `parseChordSymbol` splits root, accidental, quality, and optional slash bass (`G7/B`).
- Quality intervals cover major/minor/dim/aug/sus/5/6/7/maj7/m7/6/9/add9/m7♭5/dim7/maj9/m9.
- `chordMidiNotes` builds a mid-register block voicing (root around C3) and places slash basses below.
- The Inspector **Chords** tab writes `chordSymbols` onto the lead staff's measure; `ScoreCanvas` engraves them above the staff at `noteStartX + (beat / capacity) * width`.
- `synthEngine` schedules them as block chords using the first pitched, unmuted part (piano by default).

## SVG Engraving & Interactive Overlay (`src/components/ScoreCanvas.tsx`)

1. **System & Page Pagination**: Measures are grouped into systems by event density and packed onto A4 pages (`900 × 1272` logical coordinates) or a single continuous sheet.
2. **Multi-Staff Alignment**: For each measure column across all parts and staves, VexFlow `Voice` instances are formatted together via `Formatter.joinVoices(...).format(...)` to preserve vertical beat alignment.
3. **Tab & Percussion Staves**: Guitar/bass parts draw a linked `TabStave` under the notation staff; drum parts use the percussion clef and suppress key signatures.
4. **Interactive Overlay**: Bounding boxes for notes, TAB strings, and measures populate `hitTargets` and `measureGeometries` to power:
   - Click selection and auditioning (nearest-target selection for stacked TAB strings)
   - Note Input Mode half-space snapping with ghost notehead, ledger lines, and pitch/drum readout
   - Chord-symbol engraving and the interpolated playback playhead

## Parsers & Exporters

- **MuseScore (`.mscz` / `.mscx`)**: `JSZip` extracts `META-INF/container.xml` and `.mscx` XML, mapping `<pitch>` and `<tpc>` to exact enharmonic spellings. Exports MuseScore 4.20 XML and zipped `.mscz` archives. Percussion clefs map to `PERCUSSION`.
- **MusicXML (`.musicxml` / `.mxl` / `.xml`)**: Parses partwise scores, multi-staff `<backup>`/`<staff>`, key/time/clef, chords, ties, dynamics, articulations, and lyrics; exports MusicXML 3.1.
- **MIDI (`.mid` / `.midi`)**: Binary SMF parser quantizing to a 16th-note grid with chord grouping and rest filling; exports SMF Format 1.

## Web Audio Engine (`src/audio/synthEngine.ts`)

`ScoreSynthEngine` compiles the score into a sorted `ScheduledNote[]` timeline and schedules ahead (`35ms` interval, `180ms` lookahead) while driving the playhead with `requestAnimationFrame`.

- **Repeat expansion**: `buildRepeatPlayOrder` expands `|: … :|` sections once, producing a playback-order list of measure indices. `measureStarts` holds one entry per occurrence, so the playhead and metronome follow repeats.
- **Sampled GM playback**: `gmSoundfont.ts` maps each part's GM program to a Musyng Kite instrument and streams the mp3 bank on demand (GitHub Pages primary, jsDelivr fallback), decoding with `soundfont-player`. Samples preload on the first user gesture; until ready — or if offline — the engine falls back to oscillator voices.
- **Percussion**: `drumKit.ts` maps staff positions to drum pieces and synthesizes kick, snare, hats, toms, cymbals, clap, cowbell, and side stick.
- **Chord playback**: chord symbols are scheduled as block chords with the first pitched part.

## Theme System (`src/index.css`, `src/components/ThemeSlider.tsx`)

UI colors are CSS custom properties (`--bg-*`, `--text-*`, `--border-*`, `--surface-*`, accent, scrollbar, knob colors). `src/theme.ts` holds the light and dark palettes and interpolates every token for the 0–100% slider level, writing inline variables on `:root`. Text tokens switch at the 50% midpoint (with a small mid-scale contrast boost) so labels stay readable while surfaces darken smoothly. `ThemeSlider` is a draggable percentage range input that keeps its position; both theme and level persist in `localStorage`, and `index.html` applies the saved theme before first paint. Score pages remain white at every level and in print.

## Server Proxy (`server.ts`)

`GET /api/fetch-score?url=...` enables loading scores from public web links without CORS failures:
- Normalizes `github.com/.../blob/...` links to `raw.githubusercontent.com`.
- Enforces `http:` / `https:` protocols and blocks private/loopback IPv4/IPv6 ranges via DNS lookup (`assertSafePublicUrl`).
- Caps payload size at `15 MB` with a `15s` request timeout and forwards `X-Score-Filename`.

## Static Deployment

For GitHub Pages, build with `GITHUB_PAGES=true` so Vite emits assets under `/OpusWeb/`, then publish `dist/` to the `gh-pages` branch. The static site keeps all editing, playback, import/export, and theme features; only `/api/fetch-score` web-link loading is unavailable.
