# OpusWeb

OpusWeb is a single-user, browser-based music notation and score editor compatible with MuseScore (`.mscz`, `.mscx`), MusicXML (`.musicxml`, `.mxl`, `.xml`), and Standard MIDI (`.mid`, `.midi`) files.

It allows musicians, educators, and students to create, open, edit, play back, and export sheet music directly in the browser from local files or public web links—without requiring accounts, cloud-drive sign-ins, or real-time collaboration servers.

## Features

- **Publication-Grade SVG Engraving**: Renders single-staff, Grand Staff (Piano), and multi-part ensemble scores (String Quartet, SATB Choir, custom instruments) using VexFlow SVG in **Page** (A4) or **Continuous** layout with zoom (`55%`–`180%`) and clean print/PDF output.
- **Interactive Notation Editing**:
  - **Note Input Mode (`N`)**: Hover over any staff to preview a snapped ghost notehead with ledger lines and pitch readout, then click to insert notes or rests.
  - **Keyboard Entry**: Enter pitches by letter (`A`–`G`), switch durations (`1`–`6`), toggle dots (`.`), rests (`0`/`R`), ties (`T`), accidentals (`♯`, `♭`, `♮`, `𝄪`, `𝄫`), stack chords (`+3rd`, `+m3`, `+5th`, `+8ve`), add lyrics, and transpose diatonically/chromatically (`↑`/`↓`, `Shift+↑`/`↓`).
  - **Palettes Sidebar**: Apply clefs (Treble, Bass, Alto, Tenor), key signatures (`7♭` to `7♯`), time signatures (`4/4`, `3/4`, `2/4`, `6/8`, `3/8`, `2/2`, `5/4`, `7/8`), dynamics (`ppp`–`fff`, `sfz`), articulations (staccato, accent, tenuto, marcato, fermata), barlines/repeats, and tempo markings.
  - **Undo / Redo & Browser Auto-Save**: Up to 40-step edit history plus automatic local browser storage for the active score and recent scores.
- **Local File & Web Link Import**:
  - **Local Files**: Open via file picker or drag-and-drop directly onto the score canvas (`.mscz`, `.mscx`, `.musicxml`, `.mxl`, `.xml`, `.mid`, `.midi`, `.json`).
  - **Web Links**: Load public HTTP/HTTPS score URLs through the built-in `/api/fetch-score` proxy (avoiding browser CORS issues and automatically converting standard GitHub `blob` URLs to raw file links). Supports opening directly via `?scoreUrl=<encoded-url>`.
- **Polyphonic Web Audio Playback**:
  - Lookahead Web Audio synthesizer with per-part timbres (`piano`, `strings`, `woodwind`, `brass`, `guitar`, `voice`), Mute/Solo/Volume mixer, real-time animated playhead cursor, metronome click, loop mode, and instant pitch auditioning.
- **Multi-Format Export**:
  - Export edited scores as `.mscz`, `.mscx`, `.musicxml`, `.mid`, `.json`, or Print / Save as PDF.

## Supported Formats

| Format | Import | Export | Notes |
| --- | :---: | :---: | --- |
| MuseScore Compressed (`.mscz`) | Yes | Yes | ZIP archive with `META-INF/container.xml` + `.mscx` |
| MuseScore XML (`.mscx`) | Yes | Yes | MuseScore 3/4 XML with `<tpc>` enharmonic pitch spelling |
| MusicXML (`.musicxml`, `.xml`) | Yes | Yes | Partwise MusicXML 3.1 interchange |
| Compressed MusicXML (`.mxl`) | Yes | No | Unzipped client-side via JSZip |
| Standard MIDI (`.mid`, `.midi`) | Yes | Yes | Quantized 16th-note import & SMF Format 1 export |
| OpusWeb Project (`.json`) | Yes | Yes | Full lossless AST + mixer snapshot |

## Quick Start

### Prerequisites

- Node.js 20+ (tested on Node 22)
- npm

### Installation & Development

```bash
npm install
npm run dev
```

The Express + Vite development server starts on `http://localhost:3000`.

### Production Build & Start

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run lint
```

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `N` | Toggle Note Input Mode |
| `1` – `6` | Select Whole, Half, Quarter, 8th, 16th, or 32nd duration |
| `A` – `G` | Insert note by letter name at cursor / selection |
| `0` or `R` | Enter rest / toggle Rest mode |
| `.` | Toggle dotted duration |
| `T` | Toggle tie to next note |
| `↑` / `↓` | Move selected note diatonically (`Shift+↑`/`↓` for octave) |
| `←` / `→` | Navigate to previous / next note or rest |
| `Delete` / `Backspace` | Clear selected note to rest |
| `Space` | Play / Pause audio playback |
| `Ctrl/Cmd + Z` | Undo (`Ctrl/Cmd + Shift + Z` to Redo) |

## Documentation

- [User Guide](./USER_GUIDE.md) — Step-by-step instructions for creating, importing, editing, and exporting scores.
- [Architecture](./ARCHITECTURE.md) — Internal AST, parsers, exporters, VexFlow engraving pipeline, Web Audio engine, and server proxy.
- [Contributing](./CONTRIBUTING.md) — Development workflow and conventions.
- [Changelog](./CHANGELOG.md) — Release history.
