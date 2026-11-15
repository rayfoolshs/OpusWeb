import { ChordSymbol } from '../types/score';

const NOTE_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Common chord qualities, longest suffix first. */
const QUALITY_INTERVALS: [string, number[]][] = [
  ['maj9', [0, 4, 7, 11, 14]],
  ['maj7', [0, 4, 7, 11]],
  ['m7b5', [0, 3, 6, 10]],
  ['dim7', [0, 3, 6, 9]],
  ['add9', [0, 4, 7, 14]],
  ['7sus4', [0, 5, 7, 10]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['aug', [0, 4, 8]],
  ['dim', [0, 3, 6]],
  ['m9', [0, 3, 7, 10, 14]],
  ['m7', [0, 3, 7, 10]],
  ['m6', [0, 3, 7, 9]],
  ['maj', [0, 4, 7]],
  ['min', [0, 3, 7]],
  ['sus', [0, 5, 7]],
  ['9', [0, 4, 7, 10, 14]],
  ['7', [0, 4, 7, 10]],
  ['6', [0, 4, 7, 9]],
  ['5', [0, 7]],
];

/** Quick-pick chords for the leadsheet palette. */
export const CHORD_PRESETS = [
  'C',
  'G',
  'Am',
  'F',
  'Dm',
  'Em',
  'G7',
  'Cmaj7',
  'Am7',
  'Fmaj7',
  'D7',
  'E7',
];

export interface ParsedChord {
  rootPitchClass: number;
  intervals: number[];
  bassPitchClass?: number;
  normalized: string;
}

function parseRoot(text: string): { pitchClass: number; rest: string } | null {
  const match = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(text.trim());
  if (!match) return null;
  const letter = match[1].toUpperCase();
  let pitchClass = NOTE_TO_PC[letter];
  if (pitchClass === undefined) return null;
  const accidental = match[2];
  if (accidental === '#' || accidental === '♯') pitchClass += 1;
  if (accidental === 'b' || accidental === '♭') pitchClass -= 1;
  pitchClass = ((pitchClass % 12) + 12) % 12;
  return { pitchClass, rest: match[3] || '' };
}

function intervalsForQuality(quality: string): number[] {
  const clean = quality.trim().replace(/\s+/g, '');
  if (!clean) return [0, 4, 7];

  // Case-sensitive cases: M7 = major seventh, m7 = minor seventh
  if (clean === 'M7' || clean === 'Δ7') return [0, 4, 7, 11];
  if (clean === 'M9' || clean === 'Δ9') return [0, 4, 7, 11, 14];
  if (clean === 'M') return [0, 4, 7];
  if (clean === 'ø7' || clean === 'ø') return [0, 3, 6, 10];
  if (clean === '°7' || clean === 'o7') return [0, 3, 6, 9];
  if (clean === '°' || clean === 'o') return [0, 3, 6];

  let lower = clean.toLowerCase();
  if (lower.startsWith('-')) lower = `m${lower.slice(1)}`;
  for (const [suffix, intervals] of QUALITY_INTERVALS) {
    if (lower === suffix) return intervals;
  }

  // Fall back to the longest matching prefix (e.g. "m7add11" still reads as m7)
  for (const [suffix, intervals] of QUALITY_INTERVALS) {
    if (lower.startsWith(suffix)) return intervals;
  }
  return [0, 4, 7];
}

/** Parse a lead-sheet symbol such as "Cmaj7", "Am7", "F#dim", or "G7/B". */
export function parseChordSymbol(symbol: string): ParsedChord | null {
  const trimmed = symbol.trim();
  if (!trimmed) return null;

  const [main, bassText] = trimmed.split('/');
  const root = parseRoot(main);
  if (!root) return null;

  let bassPitchClass: number | undefined;
  if (bassText !== undefined) {
    const bass = parseRoot(bassText);
    if (bass) bassPitchClass = bass.pitchClass;
  }

  return {
    rootPitchClass: root.pitchClass,
    intervals: intervalsForQuality(root.rest),
    bassPitchClass,
    normalized: trimmed,
  };
}

export function isValidChordSymbol(symbol: string): boolean {
  return parseChordSymbol(symbol) !== null;
}

/**
 * Build a mid-register block-chord voicing (MIDI note numbers) for playback.
 * Root sits around C3 so chord charts sit under a typical melody.
 */
export function chordMidiNotes(symbol: string): number[] {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return [];

  const rootMidi = 48 + parsed.rootPitchClass; // C3..B3
  const notes = parsed.intervals.map((interval) => rootMidi + interval);

  if (parsed.bassPitchClass !== undefined) {
    const chordToneIndex = notes.findIndex((midi) => midi % 12 === parsed.bassPitchClass);
    if (chordToneIndex >= 0) {
      // Slash chord where the bass is already a chord tone: move it to the bottom
      const [bassNote] = notes.splice(chordToneIndex, 1);
      notes.unshift(bassNote - 12 < 36 ? bassNote : bassNote - 12);
    } else {
      const bassMidi = 36 + parsed.bassPitchClass; // C2..B2
      notes.unshift(bassMidi);
    }
  }

  return [...new Set(notes)].sort((a, b) => a - b);
}

/** Sort chord symbols by beat position. */
export function sortedChords(chords: ChordSymbol[] | undefined): ChordSymbol[] {
  if (!chords) return [];
  return [...chords].sort((a, b) => a.beat - b.beat);
}
