# OpusWeb User Guide

## 1. Creating or Opening a Score

- **New Score**: Click **New** in the top bar to configure title, composer, ensemble template (*Piano Grand Staff*, *Treble Solo*, *Bass / Cello*, *Acoustic Guitar*, *String Quartet*, or *SATB Choir*), key signature, time signature, tempo, and initial measure count.
- **Open Local File**: Click **Open / Import → Local File** or drag and drop any `.mscz`, `.mscx`, `.musicxml`, `.mxl`, `.xml`, `.mid`, `.midi`, or `.json` file directly onto the sheet canvas.
- **Load from Web Link**: Click **Open / Import → Web Link** and paste a direct `http://` or `https://` link to a score file. Standard GitHub file links are automatically converted to raw download URLs. You can also open a score directly via URL parameter:
  `?scoreUrl=https://example.com/path/to/score.musicxml`
- **Starter Library & Browser Saves**: Open built-in classical excerpts (*Minuet in G*, *Ode to Joy*, *Prelude in A Major*) or return to recent scores automatically saved in your browser.

## 2. Entering and Editing Notes

### Using Note Input Mode (`N`)
1. Click **Note Input** in the toolbar ribbon (or press `N`).
2. Choose a note duration (`1` Whole through `6` 32nd) and optional dot (`.`), tie (`T`), or accidental (`♯`, `♭`, `♮`).
3. Hover over any staff measure to see the blue ghost notehead snap to staff lines, spaces, and ledger lines with a live pitch label.
4. Click to insert the note at that rhythmic slot—existing rests split automatically to keep the measure balanced.

### Using the Keyboard
- Select any note or rest and press **`A`–`G`** to enter a pitch and automatically advance to the next rhythmic slot.
- Press **`0`** or **`R`** to turn a slot into a rest.
- Press **`↑` / `↓`** to move a selected note up or down diatonically, or **`Shift + ↑` / `↓`** to shift by an octave.
- Press **`←` / `→`** to step through notes and rests.

### Chords, Ties, and Lyrics
- Enable **Chord** in the toolbar before clicking/typing a pitch to stack notes into a chord, or use the **Inspector → Stack Chord Interval** buttons (`+3rd`, `+m3`, `+5th`, `+8ve`).
- Select a note and use the right **Inspector** panel to toggle **Tie to Next Note**, change accidentals, or type a **Lyric Syllable**.

## 3. Palettes & Measure Controls

Use the left **Palettes** sidebar to apply notation markings to the selected measure or note:
- **Clefs**: Treble, Bass, Alto, Tenor
- **Time Signatures**: `4/4`, `3/4`, `2/4`, `6/8`, `3/8`, `2/2`, `5/4`, `7/8`
- **Key Signatures**: `C Major / A Minor` up to `7♯` and `7♭`
- **Dynamics**: `ppp` through `fff` and `sfz`
- **Articulations**: Staccato, Accent, Tenuto, Marcato, Fermata
- **Barlines & Repeats**: Single, Double, Final, Start Repeat, End Repeat
- **Tempo**: Quick tempo presets or custom measure BPM in the Inspector

Use **+ Bar** and the trash icon in the toolbar ribbon to append or delete measures.

## 4. Instruments, Mixer & Playback

- Open the **Score & Parts** tab in the right sidebar to edit the score title, subtitle, and composer, adjust instrument volumes, Mute/Solo individual staves, or add/remove instruments.
- Use the top transport bar to **Play/Pause (`Space`)**, **Stop**, **Rewind**, toggle the **Metronome Click**, toggle **Loop**, or adjust the master **BPM**.

## 5. Exporting Your Score

Click **Export** in the top-right corner to download:
- **`.mscz`**: Compressed MuseScore project file (compatible with MuseScore Studio 3 & 4)
- **`.mscx`**: Uncompressed MuseScore XML
- **`.musicxml`**: Standard MusicXML 3.1 for Finale, Sibelius, Dorico, and MuseScore
- **`.mid`**: Multi-track Standard MIDI File
- **`.opusweb.json`**: Lossless OpusWeb backup
- **Print / Save as PDF**: Opens the browser print dialog styled cleanly for A4 sheet paper with all studio toolbars hidden.
