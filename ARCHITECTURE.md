# Architecture

OpusWeb is structured as a client-first React + TypeScript notation studio backed by a lightweight Express server for safe remote web-link fetching and production static asset serving.

## Directory Layout

```text
├── server.ts                       # Express server, /api/fetch-score proxy, Vite dev middleware
├── index.html                      # App shell and Google Fonts (Plus Jakarta Sans, Lora, JetBrains Mono)
├── src/
│   ├── main.tsx                    # React root entry point
│   ├── index.css                   # Tailwind CSS v4 entry + @media print sheet music rules
│   ├── App.tsx                     # Top-level studio state, undo/redo history, keyboard shortcuts, persistence
│   ├── types/
│   │   └── score.ts                # Canonical ScoreDocument AST and EditorToolState types
│   ├── utils/
│   │   ├── musicTheory.ts          # Pitch/MIDI conversion, key signature maps, rhythmic measure packing
│   │   ├── scoreParsers.ts         # Importers for .mscz, .mscx, .musicxml, .mxl, .xml, .mid, .json
│   │   ├── scoreExporters.ts       # Exporters for .mscz, .mscx, .musicxml, .mid, .json
│   │   └── starterScores.ts        # Built-in classical pieces, ensemble templates, instrument presets
│   ├── audio/
│   │   └── synthEngine.ts          # Polyphonic Web Audio synthesizer, lookahead scheduler, metronome
│   └── components/
│       ├── ScoreCanvas.tsx         # VexFlow 4.2.5 SVG engraver, interactive hitboxes, ghost cursor, playhead
│       ├── ToolbarRibbon.tsx       # Note input, durations, accidentals, voices, zoom, and page view controls
│       ├── PaletteSidebar.tsx      # Collapsible notation palettes (clefs, keys, time, dynamics, barlines)
│       ├── InspectorPanel.tsx      # Contextual note/measure inspector and multi-part instrument mixer
│       └── Modals.tsx              # Open/Import (local + web link + library), Export, New Score, Shortcuts
```

## Canonical Score AST (`src/types/score.ts`)

All imported formats normalize into a unified `ScoreDocument` model:

- `ScoreDocument` -> `parts: Part[]`
- `Part` -> instrument metadata (`name`, `shortName`, `timbre`, `volume`, `muted`, `solo`) + `staves: Staff[]` (1 staff for solo instruments, 2 for Piano Grand Staff)
- `Staff` -> `clef`, `measures: Measure[]`
- `Measure` -> `attributes` (`clef`, `keyFifths`, `timeSignature`, `tempo`, `barlineLeft`, `barlineRight`) + `voices: VoiceEvent[][]`
- `VoiceEvent` -> either a rest (`isRest: true`) or a chord/note (`notes: NoteHead[]`) with `duration`, `dots`, `articulations`, `dynamic`, and `lyric`

## Rhythmic Integrity (`src/utils/musicTheory.ts`)

When inserting or changing a note duration inside a measure, `replaceEventInMeasureVoice` computes the beat offset and total measure capacity from the active time signature (`getMeasureCapacityBeats`). Leftover space is automatically filled with optimal standard rests (`fillDurationWithRests`), and oversized durations are clamped or consume adjacent rests so measure beat sums remain valid.

## SVG Engraving & Interactive Overlay (`src/components/ScoreCanvas.tsx`)

1. **System & Page Pagination**: Measures are grouped into systems by event density and packed onto A4 pages (`900 x 1272` logical coordinates) or a single continuous scroll sheet.
2. **Multi-Staff Alignment**: For each measure column across all parts and staves, VexFlow `Voice` instances are collected and formatted together via `Formatter.joinVoices(...).format(...)` to preserve vertical beat alignment.
3. **Interactive Overlay**: After VexFlow renders the SVG, bounding boxes for every `StaveNote` and `Stave` are captured into `hitTargets` and `measureGeometries` to power:
   - Click selection and pitch auditioning
   - Note Input Mode vertical half-space snapping (`lineSpacing / 2`) with ghost notehead + ledger line preview
   - Interpolated vertical playback playhead spanning the active system

## Parsers & Exporters

- **MuseScore (`.mscz` / `.mscx`)**: Uses `JSZip` to extract `META-INF/container.xml` and `.mscx` XML, mapping `<pitch>` MIDI values and `<tpc>` (Tonal Pitch Class) values to exact enharmonic spellings (`step`, `alter`, `octave`). Exports valid MuseScore 4.20 `<museScore>` XML and zipped `.mscz` archives.
- **MusicXML (`.musicxml` / `.mxl` / `.xml`)**: Parses `<score-partwise>` parts, multi-staff `<backup>`/`<staff>` tags, key/time/clef attributes, chords, ties, dynamics, articulations, and lyrics; exports MusicXML 3.1.
- **MIDI (`.mid` / `.midi`)**: Binary SMF parser quantizing note-on/note-off events to a 16th-note grid with automatic chord grouping and rest filling; exports SMF Format 1.

## Web Audio Engine (`src/audio/synthEngine.ts`)

`ScoreSynthEngine` compiles the active score into a sorted `ScheduledNote[]` timeline and schedules Web Audio oscillator + filter envelopes ahead of time (`35ms` interval, `180ms` lookahead) while driving the visual playhead with `requestAnimationFrame`.

## Server Proxy (`server.ts`)

`GET /api/fetch-score?url=...` enables loading scores from public web links without CORS failures:
- Normalizes `github.com/.../blob/...` links to `raw.githubusercontent.com`.
- Enforces `http:` / `https:` protocols and blocks private/loopback IPv4/IPv6 ranges via DNS lookup (`assertSafePublicUrl`).
- Caps payload size at `15 MB` with a `15s` request timeout and forwards `X-Score-Filename`.
