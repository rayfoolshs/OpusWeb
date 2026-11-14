export type NoteStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type AccidentalType = 'sharp' | 'flat' | 'natural' | 'double-sharp' | 'double-flat';

export type DurationType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';

export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor';

export type ArticulationType = 'staccato' | 'accent' | 'tenuto' | 'marcato' | 'fermata';

export type DynamicType = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'sfz';

export type BarlineType = 'single' | 'double' | 'end' | 'repeat-begin' | 'repeat-end';

export type InstrumentTimbre =
  | 'piano'
  | 'strings'
  | 'woodwind'
  | 'brass'
  | 'guitar'
  | 'voice';

export interface Pitch {
  step: NoteStep;
  alter: number; // -2, -1, 0, +1, +2
  octave: number; // 0..8 (C4 = middle C)
  accidental?: AccidentalType; // Explicit accidental override if needed
}

export interface NoteHead {
  id: string;
  pitch: Pitch;
  tieStart?: boolean;
  tieStop?: boolean;
  tabString?: number; // 1 (high E) to 6 (low E)
  tabFret?: number; // 0..24
}

export interface VoiceEvent {
  id: string;
  isRest: boolean;
  isMeasureRest?: boolean; // True when representing a full-measure rest
  duration: DurationType;
  dots: 0 | 1 | 2;
  notes: NoteHead[]; // Empty when isRest=true; 1+ notes for single note or chord
  articulations?: ArticulationType[];
  dynamic?: DynamicType;
  lyric?: string;
  slurStart?: boolean;
  slurStop?: boolean;
}

export interface MeasureAttributes {
  clef?: ClefType;
  keyFifths?: number; // -7 to +7
  timeSignature?: {
    beats: number;
    beatType: number;
  };
  tempo?: number; // BPM
  barlineLeft?: BarlineType;
  barlineRight?: BarlineType;
}

export interface Measure {
  id: string;
  attributes: MeasureAttributes;
  // Voices per staff (usually voice 0 = primary, voice 1 = secondary)
  voices: VoiceEvent[][];
}

export interface Staff {
  id: string;
  clef: ClefType;
  measures: Measure[];
}

export interface Part {
  id: string;
  name: string;
  shortName: string;
  timbre: InstrumentTimbre;
  volume: number; // 0..1
  muted: boolean;
  solo: boolean;
  showTab?: boolean; // Render linked 6-string Guitar Tablature staff below notation
  staves: Staff[]; // 1 for solo instruments, 2 for Piano/Grand Staff
}

export interface ScoreDocument {
  id: string;
  title: string;
  subtitle: string;
  composer: string;
  arranger?: string;
  defaultTempo: number;
  parts: Part[];
  updatedAt: number;
  sourceLabel?: string; // e.g. 'Local File', 'Web Link', 'Built-in Library'
}

export interface SelectionTarget {
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  eventId: string | null;
  noteIndex?: number;
}

export interface EditorToolState {
  noteInputMode: boolean;
  duration: DurationType;
  dots: 0 | 1;
  accidental: AccidentalType | null;
  isRestMode: boolean;
  tieActive: boolean;
  voiceIndex: 0 | 1;
  chordMode: boolean;
}
