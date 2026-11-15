# OpusWeb

**Version 1.1.0 · by Ray Foo**

OpusWeb is a single-user, browser-based music notation studio with sampled General MIDI playback, guitar/bass tablature, chord leadsheets, and MuseScore / MusicXML / MIDI import & export.

It lets musicians, educators, and students create, open, edit, play back, and export sheet music directly in the browser from local files or public web links — without accounts, cloud-drive sign-ins, or collaboration servers.

## Highlights

### Notation editing
- **Publication-grade SVG engraving** with VexFlow 4.2.5: single staff, Grand Staff (piano), multi-part ensembles, linked tablature, A4 **Page** view or **Continuous** view, zoom 55%–180%, clean print/PDF output.
- **Note Input Mode (`N`)** with a snapped ghost cursor, ledger lines, and live pitch (or drum-piece) readout.
- **Keyboard workflow**: letter pitch entry (`A`–`G`), durations (`1`–`6`), dots (`.`), rests (`0`/`R`), ties (`T`), accidentals, diatonic/chromatic/octave transposition, and note navigation.
- **Chords, ties, lyrics, dynamics, articulations, and barlines**; 40-step Undo/Redo and automatic browser autosave.
- **Palettes** for clefs (treble, bass, alto, tenor, percussion), key signatures (7♭–7♯), time signatures, dynamics (`ppp`–`fff`, `sfz`), articulations, barlines/repeats, and tempo.

### Chord leadsheets
- **Chords tab** in the Inspector: add chord symbols (e.g. `Cmaj7`, `Am7`, `G7/B`) at any beat, with a quick-add palette.
- Symbols are engraved **above the staff** and played back as **block chords** using the first pitched instrument.
- Chords are stored per measure, survive reloads, and repeat with repeat barlines.

### Guitar & bass tablature
- Linked **6-string guitar TAB** (EADGBE) and **4-string bass TAB** (EADG), rendered under the notation staff.
- **Fret editing**: pick a string and fret in the Inspector, or click a fret number on the TAB staff and type digits (`1` then `3` → fret 13). The notation above updates to the matching pitch.
- Toggle **Linked Guitar TAB / Linked Bass TAB** per part in **Instruments & Mixer** (only shown for guitar/bass parts).

### Sampled playback
- Free **Musyng Kite General MIDI soundfont** (CC BY-SA 3.0), streamed on demand from `midi-js-soundfonts` and decoded with `soundfont-player`; GitHub Pages first, jsDelivr fallback.
- Polyphonic lookahead scheduler, per-part Mute/Solo/Volume mixer, metronome, loop, tempo control, and an animated playhead.
- Built-in synth fallback while samples load or when offline.
- **Drum Kit** part with a synthesized acoustic-style kit (kick, snare, hats, toms, crash, ride, clap, cowbell, side stick).
- Curated instruments: Piano, Acoustic Guitar, Electric Guitar, Bass Guitar, Violin, Viola, Cello, Flute, Clarinet, Trumpet, French Horn, Brass Section, Drum Kit, Choir Aahs, plus ensembles.

### Import & export
- Import `.mscz`, `.mscx`, `.musicxml`, `.mxl`, `.xml`, `.mid`, `.midi`, and OpusWeb `.json` via file picker or drag-and-drop.
- Load public web links through the server proxy (`/api/fetch-score`) or `?scoreUrl=`; GitHub `blob` links are normalized to raw files.
- Export `.mscz`, `.mscx`, `.musicxml`, `.mid`, `.json`, or print/save as PDF.

### Appearance
- Draggable **0%–100% light ↔ dark theme slider** in the header with a percentage readout (below 50% = light, 50%+ = dark). The knob keeps its position, and both theme and level persist in `localStorage`.
- Sheet pages stay white in both themes for accurate engraving and printing.

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
- npm or Bun

### Development
```bash
npm install
npm run dev
```
The Express + Vite development server starts on `http://localhost:3000`.

### Production build
```bash
npm run build
npm start
```

### Type checking
```bash
npm run lint
```

## GitHub Pages

The site can be deployed as a static build. GitHub Pages cannot run the Express proxy, so **web-link import** requires the Node server; local file import, editing, playback, and export work fully static.

```bash
GITHUB_PAGES=true npm run build
npx gh-pages -d dist --dotfiles
```

Set `GITHUB_PAGES=true` so Vite uses the project base path `/OpusWeb/`. The published site is served from the `gh-pages` branch.

## Project Structure

```
src/
├── App.tsx                     # Studio shell, keyboard shortcuts, file/export actions
├── version.ts                  # App name, version, author
├── types/score.ts              # Score AST (parts, staves, measures, notes, chords)
├── components/
│   ├── ToolbarRibbon.tsx       # Note input, durations, accidentals, zoom, measures
│   ├── PaletteSidebar.tsx      # Clefs, keys, time, dynamics, articulations, barlines
│   ├── ScoreCanvas.tsx         # VexFlow engraving, TAB staves, chord symbols, playhead
│   ├── InspectorPanel.tsx      # Note inspector, chord leadsheet, parts mixer
│   ├── ThemeSlider.tsx         # Draggable light/dark slider
│   └── Modals.tsx              # New / Open / Export / Shortcuts dialogs
├── audio/
│   ├── synthEngine.ts          # Timeline, lookahead scheduler, repeat expansion
│   ├── gmSoundfont.ts          # Musyng Kite sample loader & GM program map
│   └── drumKit.ts              # Drum-kit mapping and synthesized percussion
└── utils/
    ├── musicTheory.ts          # Pitch math, measure packing, tab configs
    ├── chords.ts               # Chord symbol parsing and block-chord voicings
    ├── scoreParsers.ts         # MuseScore / MusicXML / MIDI import
    ├── scoreExporters.ts       # MuseScore / MusicXML / MIDI / JSON export
    └── starterScores.ts        # Templates and starter library
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
| `0`–`9` (TAB selected) | Type a fret number on the selected TAB string |

## Credits

- **OpusWeb** — designed and built by **Ray Foo**.
- **Musyng Kite General MIDI soundfont** — free sampled playback bank, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), pre-rendered by the [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) project. Samples are streamed on demand; no audio is bundled with this repository.
- [VexFlow](https://www.vexflow.com/) for SVG music engraving.
- [soundfont-player](https://github.com/danigb/soundfont-player) for soundfont decoding and playback.

## Documentation

- [Features](./FEATURES.md) — Complete feature list, shortcuts, and current limitations.
- [User Guide](./USER_GUIDE.md) — Step-by-step instructions for creating, importing, editing, playing, and exporting scores.
- [Architecture](./ARCHITECTURE.md) — Score AST, parsers, exporters, VexFlow pipeline, audio engine, and server proxy.
- [Contributing](./CONTRIBUTING.md) — Development workflow and conventions.
- [Changelog](./CHANGELOG.md) — Release history.
