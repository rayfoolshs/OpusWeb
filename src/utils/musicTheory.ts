import {
  AccidentalType,
  ClefType,
  DurationType,
  Measure,
  NoteHead,
  NoteStep,
  Part,
  Pitch,
  ScoreDocument,
  VoiceEvent,
} from '../types/score';

export const STEP_ORDER: NoteStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const STEP_SEMITONES: Record<NoteStep, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const DURATION_BEATS: Record<DurationType, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125,
};

export const DURATION_TO_VEXFLOW: Record<DurationType, string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
};

export const KEY_SIGNATURE_LIST: { fifths: number; label: string; vexKey: string }[] = [
  { fifths: 0, label: 'C Major / A Minor (0)', vexKey: 'C' },
  { fifths: 1, label: 'G Major / E Minor (1♯)', vexKey: 'G' },
  { fifths: 2, label: 'D Major / B Minor (2♯)', vexKey: 'D' },
  { fifths: 3, label: 'A Major / F♯ Minor (3♯)', vexKey: 'A' },
  { fifths: 4, label: 'E Major / C♯ Minor (4♯)', vexKey: 'E' },
  { fifths: 5, label: 'B Major / G♯ Minor (5♯)', vexKey: 'B' },
  { fifths: 6, label: 'F♯ Major / D♯ Minor (6♯)', vexKey: 'F#' },
  { fifths: 7, label: 'C♯ Major / A♯ Minor (7♯)', vexKey: 'C#' },
  { fifths: -1, label: 'F Major / D Minor (1♭)', vexKey: 'F' },
  { fifths: -2, label: 'B♭ Major / G Minor (2♭)', vexKey: 'Bb' },
  { fifths: -3, label: 'E♭ Major / C Minor (3♭)', vexKey: 'Eb' },
  { fifths: -4, label: 'A♭ Major / F Minor (4♭)', vexKey: 'Ab' },
  { fifths: -5, label: 'D♭ Major / B♭ Minor (5♭)', vexKey: 'Db' },
  { fifths: -6, label: 'G♭ Major / E♭ Minor (6♭)', vexKey: 'Gb' },
  { fifths: -7, label: 'C♭ Major / A♭ Minor (7♭)', vexKey: 'Cb' },
];

const SHARP_ORDER: NoteStep[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: NoteStep[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function getVexKeySignature(fifths: number): string {
  const found = KEY_SIGNATURE_LIST.find((k) => k.fifths === fifths);
  return found ? found.vexKey : 'C';
}

export function getKeySignatureAlterMap(fifths: number): Record<NoteStep, number> {
  const map: Record<NoteStep, number> = {
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
    A: 0,
    B: 0,
  };
  if (fifths > 0) {
    for (let i = 0; i < Math.min(7, fifths); i++) {
      map[SHARP_ORDER[i]] = 1;
    }
  } else if (fifths < 0) {
    for (let i = 0; i < Math.min(7, Math.abs(fifths)); i++) {
      map[FLAT_ORDER[i]] = -1;
    }
  }
  return map;
}

export function getEventBeats(event: Pick<VoiceEvent, 'duration' | 'dots'>): number {
  const base = DURATION_BEATS[event.duration] ?? 1;
  if (event.dots === 1) return base * 1.5;
  if (event.dots === 2) return base * 1.75;
  return base;
}

export function getMeasureCapacityBeats(beats: number, beatType: number): number {
  // Quarter-note beats per measure: e.g. 4/4 -> 4, 3/4 -> 3, 6/8 -> 3, 2/2 -> 4
  return (beats * 4) / beatType;
}

export function pitchToMidi(pitch: Pitch): number {
  return (pitch.octave + 1) * 12 + STEP_SEMITONES[pitch.step] + (pitch.alter || 0);
}

export function midiToPitch(midi: number, keyFifths = 0): Pitch {
  const clamped = Math.max(12, Math.min(115, Math.round(midi)));
  const octave = Math.floor(clamped / 12) - 1;
  const pc = ((clamped % 12) + 12) % 12;

  const preferFlats = keyFifths < 0;
  const sharpTable: { step: NoteStep; alter: number }[] = [
    { step: 'C', alter: 0 },
    { step: 'C', alter: 1 },
    { step: 'D', alter: 0 },
    { step: 'D', alter: 1 },
    { step: 'E', alter: 0 },
    { step: 'F', alter: 0 },
    { step: 'F', alter: 1 },
    { step: 'G', alter: 0 },
    { step: 'G', alter: 1 },
    { step: 'A', alter: 0 },
    { step: 'A', alter: 1 },
    { step: 'B', alter: 0 },
  ];
  const flatTable: { step: NoteStep; alter: number }[] = [
    { step: 'C', alter: 0 },
    { step: 'D', alter: -1 },
    { step: 'D', alter: 0 },
    { step: 'E', alter: -1 },
    { step: 'E', alter: 0 },
    { step: 'F', alter: 0 },
    { step: 'G', alter: -1 },
    { step: 'G', alter: 0 },
    { step: 'A', alter: -1 },
    { step: 'A', alter: 0 },
    { step: 'B', alter: -1 },
    { step: 'B', alter: 0 },
  ];

  const chosen = (preferFlats ? flatTable : sharpTable)[pc];
  return { step: chosen.step, alter: chosen.alter, octave };
}

export function formatPitchName(pitch: Pitch): string {
  const alterSymbol =
    pitch.alter === 1
      ? '♯'
      : pitch.alter === 2
        ? '𝄪'
        : pitch.alter === -1
          ? '♭'
          : pitch.alter === -2
            ? '𝄫'
            : '';
  return `${pitch.step}${alterSymbol}${pitch.octave}`;
}

export function pitchToVexKey(pitch: Pitch): string {
  const acc =
    pitch.alter === 1
      ? '#'
      : pitch.alter === 2
        ? '##'
        : pitch.alter === -1
          ? 'b'
          : pitch.alter === -2
            ? 'bb'
            : '';
  return `${pitch.step.toLowerCase()}${acc}/${pitch.octave}`;
}

export function alterToAccidentalType(alter: number): AccidentalType | undefined {
  if (alter === 1) return 'sharp';
  if (alter === -1) return 'flat';
  if (alter === 2) return 'double-sharp';
  if (alter === -2) return 'double-flat';
  return undefined;
}

export function accidentalTypeToAlter(acc: AccidentalType): number {
  switch (acc) {
    case 'sharp':
      return 1;
    case 'flat':
      return -1;
    case 'double-sharp':
      return 2;
    case 'double-flat':
      return -2;
    case 'natural':
      return 0;
  }
}

export function accidentalToVexSymbol(acc: AccidentalType): string {
  switch (acc) {
    case 'sharp':
      return '#';
    case 'flat':
      return 'b';
    case 'natural':
      return 'n';
    case 'double-sharp':
      return '##';
    case 'double-flat':
      return 'bb';
  }
}

/**
 * Given a clef and diatonic step offset relative to the bottom staff line (line 0 = bottom line),
 * compute the Pitch using the current key signature's alterations.
 * In Treble clef: bottom line (pos 0) = E4.
 * In Bass clef: bottom line (pos 0) = G2.
 * In Alto clef: bottom line (pos 0) = F3.
 * In Tenor clef: bottom line (pos 0) = D3.
 */
export function staffStepToPitch(
  clef: ClefType,
  diatonicStepsFromBottomLine: number,
  keyFifths: number
): Pitch {
  const anchor: Record<ClefType, { stepIndex: number; octave: number }> = {
    treble: { stepIndex: 2, octave: 4 }, // E4
    bass: { stepIndex: 4, octave: 2 }, // G2
    alto: { stepIndex: 3, octave: 3 }, // F3
    tenor: { stepIndex: 1, octave: 3 }, // D3
  };
  const base = anchor[clef] || anchor.treble;
  const totalSteps = base.octave * 7 + base.stepIndex + diatonicStepsFromBottomLine;
  const octave = Math.max(1, Math.min(7, Math.floor(totalSteps / 7)));
  const stepIdx = ((totalSteps % 7) + 7) % 7;
  const step = STEP_ORDER[stepIdx];
  const alterMap = getKeySignatureAlterMap(keyFifths);
  return {
    step,
    alter: alterMap[step],
    octave,
  };
}

export function pitchToDiatonicStepsFromBottomLine(clef: ClefType, pitch: Pitch): number {
  const anchor: Record<ClefType, { stepIndex: number; octave: number }> = {
    treble: { stepIndex: 2, octave: 4 }, // E4
    bass: { stepIndex: 4, octave: 2 }, // G2
    alto: { stepIndex: 3, octave: 3 }, // F3
    tenor: { stepIndex: 1, octave: 3 }, // D3
  };
  const base = anchor[clef] || anchor.treble;
  const pitchStepIndex = STEP_ORDER.indexOf(pitch.step);
  return (pitch.octave - base.octave) * 7 + (pitchStepIndex - base.stepIndex);
}

export function transposeDiatonic(pitch: Pitch, stepDelta: number, keyFifths: number): Pitch {
  const stepIndex = STEP_ORDER.indexOf(pitch.step);
  const totalSteps = pitch.octave * 7 + stepIndex + stepDelta;
  const newOctave = Math.max(1, Math.min(7, Math.floor(totalSteps / 7)));
  const newStepIdx = ((totalSteps % 7) + 7) % 7;
  const newStep = STEP_ORDER[newStepIdx];
  const alterMap = getKeySignatureAlterMap(keyFifths);
  return {
    step: newStep,
    alter: alterMap[newStep],
    octave: newOctave,
  };
}

/**
 * Convert an arbitrary beat duration into optimal standard rests.
 */
export function fillDurationWithRests(totalBeats: number): VoiceEvent[] {
  const rests: VoiceEvent[] = [];
  let remaining = Math.round(totalBeats * 32) / 32;
  const candidates: { duration: DurationType; dots: 0 | 1; beats: number }[] = [
    { duration: 'whole', dots: 0, beats: 4 },
    { duration: 'half', dots: 1, beats: 3 },
    { duration: 'half', dots: 0, beats: 2 },
    { duration: 'quarter', dots: 1, beats: 1.5 },
    { duration: 'quarter', dots: 0, beats: 1 },
    { duration: 'eighth', dots: 1, beats: 0.75 },
    { duration: 'eighth', dots: 0, beats: 0.5 },
    { duration: '16th', dots: 0, beats: 0.25 },
    { duration: '32nd', dots: 0, beats: 0.125 },
  ];

  let safety = 0;
  while (remaining >= 0.124 && safety < 32) {
    safety++;
    const match = candidates.find((c) => c.beats <= remaining + 0.001);
    if (!match) break;
    rests.push({
      id: uid('rest'),
      isRest: true,
      duration: match.duration,
      dots: match.dots,
      notes: [],
    });
    remaining = Math.round((remaining - match.beats) * 32) / 32;
  }
  return rests;
}

export function createMeasureRest(capacityBeats: number): VoiceEvent[] {
  // Standard notation uses a whole rest for an empty full measure of any common meter,
  // or exact rests if needed. For VexFlow + playback accuracy, keep duration aligned with capacity if <= 4,
  // or split cleanly.
  if (Math.abs(capacityBeats - 4) < 0.001) {
    return [
      {
        id: uid('mrest'),
        isRest: true,
        isMeasureRest: true,
        duration: 'whole',
        dots: 0,
        notes: [],
      },
    ];
  }
  if (Math.abs(capacityBeats - 3) < 0.001) {
    return [
      {
        id: uid('mrest'),
        isRest: true,
        isMeasureRest: true,
        duration: 'half',
        dots: 1,
        notes: [],
      },
    ];
  }
  if (Math.abs(capacityBeats - 2) < 0.001) {
    return [
      {
        id: uid('mrest'),
        isRest: true,
        isMeasureRest: true,
        duration: 'half',
        dots: 0,
        notes: [],
      },
    ];
  }
  return fillDurationWithRests(capacityBeats);
}

/**
 * Compute effective clef, keyFifths, timeSignature, and tempo at any measure index.
 */
export function getEffectiveMeasureContext(
  part: Part,
  staffIndex: number,
  measureIndex: number,
  defaultTempo = 120
): {
  clef: ClefType;
  keyFifths: number;
  beats: number;
  beatType: number;
  tempo: number;
} {
  const staff = part.staves[staffIndex] || part.staves[0];
  let clef: ClefType = staff.clef || 'treble';
  let keyFifths = 0;
  let beats = 4;
  let beatType = 4;
  let tempo = defaultTempo;

  for (let i = 0; i <= measureIndex && i < staff.measures.length; i++) {
    const attrs = staff.measures[i].attributes;
    if (attrs.clef) clef = attrs.clef;
    if (attrs.keyFifths !== undefined) keyFifths = attrs.keyFifths;
    if (attrs.timeSignature) {
      beats = attrs.timeSignature.beats;
      beatType = attrs.timeSignature.beatType;
    }
    if (attrs.tempo !== undefined) tempo = attrs.tempo;
  }

  return { clef, keyFifths, beats, beatType, tempo };
}

/**
 * Replace or insert a VoiceEvent inside a measure's voice while maintaining exact beat capacity.
 */
export function replaceEventInMeasureVoice(
  events: VoiceEvent[],
  targetEventId: string,
  newEvent: VoiceEvent,
  measureCapacityBeats: number
): VoiceEvent[] {
  const idx = events.findIndex((e) => e.id === targetEventId);
  if (idx === -1) return events;

  // Calculate beat offset before idx
  let beatStart = 0;
  for (let i = 0; i < idx; i++) {
    beatStart += getEventBeats(events[i]);
  }

  const maxAllowedForNew = Math.max(0.125, measureCapacityBeats - beatStart);
  let clampedNew = { ...newEvent };
  let newBeats = getEventBeats(clampedNew);

  if (newBeats > maxAllowedForNew + 0.001) {
    // Shrink duration to fit remaining space in the measure
    const fitting = (['whole', 'half', 'quarter', 'eighth', '16th', '32nd'] as DurationType[]).find(
      (d) => DURATION_BEATS[d] <= maxAllowedForNew + 0.001
    );
    clampedNew = {
      ...clampedNew,
      duration: fitting || '32nd',
      dots: 0,
    };
    newBeats = getEventBeats(clampedNew);
  }

  const prefix = events.slice(0, idx);
  const oldEventBeats = getEventBeats(events[idx]);
  const suffix = events.slice(idx + 1);

  if (Math.abs(newBeats - oldEventBeats) < 0.001) {
    return [...prefix, clampedNew, ...suffix];
  }

  if (newBeats < oldEventBeats) {
    const leftover = oldEventBeats - newBeats;
    const fillerRests = fillDurationWithRests(leftover);
    return [...prefix, clampedNew, ...fillerRests, ...suffix];
  }

  // newBeats > oldEventBeats: consume subsequent events/rests until capacity matches
  let consumed = oldEventBeats;
  let suffixCursor = 0;
  while (suffixCursor < suffix.length && consumed < newBeats - 0.001) {
    consumed += getEventBeats(suffix[suffixCursor]);
    suffixCursor++;
  }
  const leftover = Math.max(0, consumed - newBeats);
  const fillerRests = leftover >= 0.124 ? fillDurationWithRests(leftover) : [];
  return [...prefix, clampedNew, ...fillerRests, ...suffix.slice(suffixCursor)];
}

export function createEmptyMeasure(
  beats: number,
  beatType: number,
  isFirst = false,
  clef?: ClefType,
  keyFifths?: number,
  tempo?: number
): Measure {
  const capacity = getMeasureCapacityBeats(beats, beatType);
  return {
    id: uid('m'),
    attributes: isFirst
      ? {
          clef,
          keyFifths: keyFifths ?? 0,
          timeSignature: { beats, beatType },
          tempo,
        }
      : {},
    voices: [createMeasureRest(capacity)],
  };
}

export function cloneScore(score: ScoreDocument): ScoreDocument {
  return JSON.parse(JSON.stringify(score)) as ScoreDocument;
}

export function createNoteHead(pitch: Pitch, tieStart = false, tieStop = false): NoteHead {
  return {
    id: uid('n'),
    pitch: { ...pitch },
    tieStart,
    tieStop,
  };
}

// Standard 6-string Guitar tuning (sounding MIDI): String 1 (E4=64) to String 6 (E2=40)
export const GUITAR_TUNING_MIDI: readonly number[] = [64, 59, 55, 50, 45, 40];

/**
 * Compute sounding guitar MIDI from written treble_8vb guitar notation.
 * Standard guitar notation is written 1 octave above sounding pitch (E3 written -> E2 sounding).
 */
export function writtenGuitarPitchToSoundingMidi(pitch: Pitch): number {
  const writtenMidi = pitchToMidi(pitch);
  let sounding = writtenMidi >= 52 ? writtenMidi - 12 : writtenMidi;
  while (sounding < 40) sounding += 12;
  while (sounding > 88) sounding -= 12;
  return sounding;
}

/**
 * Find all valid (string 1..6, fret 0..24) positions on standard EADGBE guitar for a Pitch.
 */
export function getValidGuitarPositions(pitch: Pitch): { str: number; fret: number }[] {
  const sounding = writtenGuitarPitchToSoundingMidi(pitch);
  const options: { str: number; fret: number }[] = [];
  for (let i = 0; i < GUITAR_TUNING_MIDI.length; i++) {
    const fret = sounding - GUITAR_TUNING_MIDI[i];
    if (fret >= 0 && fret <= 24) {
      options.push({ str: i + 1, fret });
    }
  }
  return options;
}

/**
 * Assign optimal non-overlapping guitar string & fret positions for a chord or single note.
 */
export function assignGuitarChordTabPositions(
  notes: NoteHead[]
): { str: number; fret: number; noteId: string }[] {
  const usedStrings = new Set<number>();
  const result: { str: number; fret: number; noteId: string }[] = [];

  // Process explicit manual overrides first
  const remaining: NoteHead[] = [];
  notes.forEach((nh) => {
    if (
      nh.tabString !== undefined &&
      nh.tabString >= 1 &&
      nh.tabString <= 6 &&
      nh.tabFret !== undefined &&
      nh.tabFret >= 0 &&
      nh.tabFret <= 24
    ) {
      usedStrings.add(nh.tabString);
      result.push({ str: nh.tabString, fret: nh.tabFret, noteId: nh.id });
    } else {
      remaining.push(nh);
    }
  });

  // Sort remaining notes highest pitch first so upper notes prefer higher strings (1..6)
  const sorted = [...remaining].sort((a, b) => pitchToMidi(b.pitch) - pitchToMidi(a.pitch));

  sorted.forEach((nh) => {
    const options = getValidGuitarPositions(nh.pitch);
    // Prefer lowest fret in open/first position (<= 5) on an unused string
    const unused = options.filter((o) => !usedStrings.has(o.str));
    const pool = unused.length > 0 ? unused : options;

    if (pool.length === 0) {
      result.push({ str: 1, fret: 0, noteId: nh.id });
      return;
    }

    // Score each candidate: lower fret preferred, open strings lightly favored
    pool.sort((a, b) => {
      const scoreA = a.fret === 0 ? -0.5 : a.fret;
      const scoreB = b.fret === 0 ? -0.5 : b.fret;
      return scoreA - scoreB;
    });

    const chosen = pool[0];
    usedStrings.add(chosen.str);
    result.push({ str: chosen.str, fret: chosen.fret, noteId: nh.id });
  });

  return result;
}

