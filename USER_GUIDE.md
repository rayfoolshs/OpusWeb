# OpusWeb User Guide

**OpusWeb 1.1.0 · by Ray Foo**

## 1. Creating or Opening a Score

- **New Score**: Click **New** in the top bar to configure title, composer, an instrument template (*Piano Grand Staff*, *Acoustic Guitar + TAB*, *Solo Violin*, *Solo Cello*, *Solo Flute*, *Solo Trumpet*, *String Quartet*, or *SATB Choir*), key signature, time signature, tempo, and initial measure count. Every template uses a high-quality sampled GM sound.
- **Open Local File**: Click **Open / Import → Local File** or drag and drop any `.mscz`, `.mscx`, `.musicxml`, `.mxl`, `.xml`, `.mid`, `.midi`, or `.json` file directly onto the sheet canvas.
- **Load from Web Link**: Click **Open / Import → Web Link** and paste a direct `http://` or `https://` link to a score file. Standard GitHub file links are automatically converted to raw download URLs. You can also open a score directly via URL parameter:
  `?scoreUrl=https://example.com/path/to/score.musicxml`
  *(Web-link loading needs the Node server; it is unavailable on a static GitHub Pages deployment.)*
- **Starter Library & Browser Saves**: Open built-in excerpts (*Minuet in G*, *Acoustic Guitar Arpeggio Study*, *Ode to Joy*, *Prelude in A Major*) or return to recent scores automatically saved in your browser.

## 2. Entering and Editing Notes

### Using Note Input Mode (`N`)
1. Click **Note Input** in the toolbar ribbon (or press `N`).
2. Choose a note duration (`1` Whole through `6` 32nd) and optional dot (`.`), tie (`T`), or accidental (`♯`, `♭`, `♮`).
3. Hover over any staff measure to see the blue ghost notehead snap to staff lines, spaces, and ledger lines with a live pitch label. On a percussion staff the label shows the drum piece instead.
4. Click to insert the note at that rhythmic slot — existing rests split automatically to keep the measure balanced.

### Using the Keyboard
- Select any note or rest and press **`A`–`G`** to enter a pitch and automatically advance to the next rhythmic slot.
- Press **`0`** or **`R`** to turn a slot into a rest.
- Press **`↑` / `↓`** to move a selected note up or down diatonically, or **`Shift + ↑` / `↓`** to shift by an octave.
- Press **`←` / `→`** to step through notes and rests.

### Chords, Ties, and Lyrics
- Enable **Chord** in the toolbar before clicking/typing a pitch to stack notes into a chord, or use the **Inspector → Stack Chord Interval** buttons (`+3rd`, `+m3`, `+5th`, `+8ve`).
- Select a note and use the right **Inspector** panel to toggle **Tie to Next Note**, change accidentals, or type a **Lyric Syllable**.

### Guitar & Bass TAB Fingering
- For parts with linked tablature, select a note and use **Inspector → Guitar TAB** / **Bass TAB**.
- Guitar parts use a 6-string EADGBE layout; bass parts use a 4-string EADG layout.
- Pick a string and type a **fret number (0–24)**. Press `Enter` or click away to apply it.
- You can also click a **fret number directly on the TAB staff**, then type the new number on your keyboard. Type `7` for fret 7, or `1` then `3` within a moment for fret 13. The notation, TAB number, and Inspector field update together.
- The notation staff above the TAB updates to the matching written pitch (guitar sounds an octave below written; bass sounds as written). For chords, each note gets its own string/fret row and clicking a number selects that string.

### Drum Kit
- Add a **Drum Kit** from **Parts → Add** and enter notes on the percussion staff. The mixer card shows the mapping legend:
  `F4 Kick · G4 Snare · A4 Closed Hi-Hat · B4 Open Hi-Hat · C5 Low Tom · D5 Mid Tom · E5 High Tom · F5 Crash · G5 Ride · A5 Clap · B5 Cowbell · C6 Side Stick`.
- Notes outside the listed positions map to the nearest drum piece. The kit is synthesized, so it works offline.

## 3. Palettes & Measure Controls

Use the left **Palettes** sidebar to apply notation markings to the selected measure or note:
- **Clefs**: Treble, Bass, Alto, Tenor, Percussion
- **Time Signatures**: `4/4`, `3/4`, `2/4`, `6/8`, `3/8`, `2/2`, `5/4`, `7/8`
- **Key Signatures**: `C Major / A Minor` up to `7♯` and `7♭`
- **Dynamics**: `ppp` through `fff` and `sfz`
- **Articulations**: Staccato, Accent, Tenuto, Marcato, Fermata
- **Barlines & Repeats**: Single, Double, Final, Start Repeat, End Repeat
- **Tempo**: Quick tempo presets or custom measure BPM in the Inspector

Use **+ Bar** and the trash icon in the toolbar ribbon to append or delete measures.

### Repeat Barlines
- **Start Repeat** sets the left repeat sign on the selected measure; **End Repeat** sets the right repeat sign.
- Playback honors `|: … :|`: the section is played **twice**, then playback continues. Repeat marks are also drawn on linked TAB and percussion staves.
- The transport **Loop** toggle loops the entire score independently of written repeats.

## 4. Instruments, Mixer & Playback

- Open the **Parts** tab in the right sidebar to edit the score title, subtitle, and composer, adjust instrument volumes, Mute/Solo individual staves, or add/remove instruments.
- Available instruments: Piano, Violin, Viola, Violoncello, Flute, Clarinet, Trumpet, French Horn, Acoustic Guitar, Electric Guitar, Bass Guitar, Brass Section, Drum Kit, and Choir Aahs.
- **Linked Guitar TAB / Linked Bass TAB** appears only for guitar and bass parts. It is hidden for every other instrument.
- Use the top transport bar to **Play/Pause (`Space`)**, **Stop**, **Rewind**, toggle the **Metronome Click**, toggle **Loop**, or adjust the master **BPM**.
- Playback uses the free **Musyng Kite** GM soundfont (CC BY-SA 3.0). Sample banks download on demand the first time you interact with the editor, then play from cache. A built-in synth covers playback if samples are still loading or the network is unavailable.
- Chord symbols play back as block chords using the first pitched (non-drum) instrument.

## 5. Chord Leadsheets

- Select the measure you want to write and open the **Chords** tab in the right sidebar.
- Type a symbol in the field (for example `C`, `Am7`, `Fmaj7`, `G7/B`) and press **Add**, or use the **Quick add** palette (`C`, `G`, `Am`, `F`, `Dm`, `Em`, `G7`, `Cmaj7`, `Am7`, `Fmaj7`, `D7`, `E7`).
- Choose the beat with the **At beat** selector. Quick-add advances to the next beat automatically; adding at a beat that already has a chord replaces it.
- Chord symbols are engraved above the top staff at their beat positions.
- The **Progression** list shows every chord in the selected measure with a delete button.
- Supported qualities include major, minor, diminished, augmented, sus2/sus4, 5, 6, 7, maj7, m7, m6, m7♭5, dim7, add9, 9, maj9, m9, and slash chords. Use `#`/`b` or `♯`/`♭` for accidentals.
- Chord symbols are stored per measure, survive reloads, and repeat with repeat barlines.

## 6. Exporting Your Score

Click **Export** in the top-right corner to download:
- **`.mscz`**: Compressed MuseScore project file (compatible with MuseScore Studio 3 & 4)
- **`.mscx`**: Uncompressed MuseScore XML
- **`.musicxml`**: Standard MusicXML 3.1 for Finale, Sibelius, Dorico, and MuseScore
- **`.mid`**: Multi-track Standard MIDI File
- **`.opusweb.json`**: Lossless OpusWeb backup
- **Print / Save as PDF**: Opens the browser print dialog styled cleanly for A4 sheet paper with all studio toolbars hidden.

## 7. Light & Dark Theme

Use the sun/moon slider in the top-right header to switch the studio chrome between **light** and **dark**. Drag the knob left for light or right for dark (clicking either end works too), or focus it and press `←` / `→`, `Home`, or `End`. The setting is saved in your browser and restored on the next visit. Sheet pages always stay white for accurate engraving and printing.

## 8. Version & Shortcuts

- The header shows **OpusWeb v1.1.0 · by Ray Foo**.
- Press the keyboard icon in the header to open the in-app shortcut reference.

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
