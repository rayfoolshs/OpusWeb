import {
  ClefType,
  DurationType,
  InstrumentTimbre,
  Measure,
  NoteStep,
  Part,
  Pitch,
  ScoreDocument,
  VoiceEvent,
} from '../types/score';
import { createEmptyMeasure, createMeasureRest, getMeasureCapacityBeats, uid } from './musicTheory';

function n(
  step: NoteStep,
  octave: number,
  duration: DurationType = 'quarter',
  options?: {
    alter?: number;
    dots?: 0 | 1;
    dynamic?: VoiceEvent['dynamic'];
    articulations?: VoiceEvent['articulations'];
    lyric?: string;
  }
): VoiceEvent {
  return {
    id: uid('ev'),
    isRest: false,
    duration,
    dots: options?.dots ?? 0,
    notes: [
      {
        id: uid('n'),
        pitch: { step, alter: options?.alter ?? 0, octave },
      },
    ],
    dynamic: options?.dynamic,
    articulations: options?.articulations,
    lyric: options?.lyric,
  };
}

function chord(
  pitches: { step: NoteStep; octave: number; alter?: number }[],
  duration: DurationType = 'quarter',
  dots: 0 | 1 = 0
): VoiceEvent {
  return {
    id: uid('ev'),
    isRest: false,
    duration,
    dots,
    notes: pitches.map((p) => ({
      id: uid('n'),
      pitch: { step: p.step, alter: p.alter ?? 0, octave: p.octave },
    })),
  };
}

function r(duration: DurationType = 'quarter', dots: 0 | 1 = 0): VoiceEvent {
  return {
    id: uid('rest'),
    isRest: true,
    duration,
    dots,
    notes: [],
  };
}

/**
 * J.S. Bach / Christian Petzold - Minuet in G Major (BWV Anh. 114), Piano Grand Staff
 */
export function createMinuetInG(): ScoreDocument {
  const rhMeasures: Measure[] = [
    {
      id: uid('m'),
      attributes: {
        clef: 'treble',
        keyFifths: 1,
        timeSignature: { beats: 3, beatType: 4 },
        tempo: 112,
      },
      voices: [[n('D', 5, 'quarter', { dynamic: 'mf' }), n('G', 4, 'eighth'), n('A', 4, 'eighth'), n('B', 4, 'eighth'), n('C', 5, 'eighth')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('D', 5, 'quarter'), n('G', 4, 'quarter', { articulations: ['staccato'] }), n('G', 4, 'quarter', { articulations: ['staccato'] })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('E', 5, 'quarter'), n('C', 5, 'eighth'), n('D', 5, 'eighth'), n('E', 5, 'eighth'), n('F', 5, 'eighth', { alter: 1 })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('G', 5, 'quarter'), n('G', 4, 'quarter', { articulations: ['staccato'] }), n('G', 4, 'quarter', { articulations: ['staccato'] })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('C', 5, 'quarter'), n('D', 5, 'eighth'), n('C', 5, 'eighth'), n('B', 4, 'eighth'), n('A', 4, 'eighth')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('B', 4, 'quarter'), n('C', 5, 'eighth'), n('B', 4, 'eighth'), n('A', 4, 'eighth'), n('G', 4, 'eighth')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('F', 4, 'quarter', { alter: 1 }), n('G', 4, 'eighth'), n('A', 4, 'eighth'), n('B', 4, 'eighth'), n('G', 4, 'eighth')]],
    },
    {
      id: uid('m'),
      attributes: { barlineRight: 'repeat-end' },
      voices: [[n('A', 4, 'half', { dots: 1 })]],
    },
  ];

  const lhMeasures: Measure[] = [
    {
      id: uid('m'),
      attributes: {
        clef: 'bass',
        keyFifths: 1,
        timeSignature: { beats: 3, beatType: 4 },
      },
      voices: [[chord([{ step: 'G', octave: 3 }, { step: 'B', octave: 3 }], 'half'), n('A', 3, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('B', 3, 'half', { dots: 1 })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('C', 4, 'half', { dots: 1 })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('B', 3, 'half', { dots: 1 })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('A', 3, 'half', { dots: 1 })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('G', 3, 'half', { dots: 1 })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('D', 3, 'quarter'), n('B', 2, 'quarter'), n('G', 2, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: { barlineRight: 'repeat-end' },
      voices: [[n('D', 3, 'quarter'), n('D', 3, 'eighth'), n('C', 3, 'eighth'), n('B', 2, 'eighth'), n('A', 2, 'eighth')]],
    },
  ];

  return {
    id: uid('score'),
    title: 'Minuet in G Major',
    subtitle: 'BWV Anh. 114 (Notebook for Anna Magdalena Bach)',
    composer: 'Christian Petzold / J.S. Bach',
    defaultTempo: 112,
    updatedAt: Date.now(),
    sourceLabel: 'Built-in Library',
    parts: [
      {
        id: uid('part'),
        name: 'Piano',
        shortName: 'Pno.',
        timbre: 'piano',
        volume: 0.9,
        muted: false,
        solo: false,
        staves: [
          { id: uid('staff'), clef: 'treble', measures: rhMeasures },
          { id: uid('staff'), clef: 'bass', measures: lhMeasures },
        ],
      },
    ],
  };
}

/**
 * Beethoven - Ode to Joy (Symphony No. 9), Lead Sheet with Lyrics
 */
export function createOdeToJoy(): ScoreDocument {
  const measures: Measure[] = [
    {
      id: uid('m'),
      attributes: { clef: 'treble', keyFifths: 0, timeSignature: { beats: 4, beatType: 4 }, tempo: 116 },
      voices: [[n('E', 4, 'quarter', { dynamic: 'f', lyric: 'Freu-' }), n('E', 4, 'quarter', { lyric: 'de,' }), n('F', 4, 'quarter', { lyric: 'schö-' }), n('G', 4, 'quarter', { lyric: 'ner' })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('G', 4, 'quarter', { lyric: 'Göt-' }), n('F', 4, 'quarter', { lyric: 'ter-' }), n('E', 4, 'quarter', { lyric: 'fun-' }), n('D', 4, 'quarter', { lyric: 'ken,' })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('C', 4, 'quarter', { lyric: 'Toch-' }), n('C', 4, 'quarter', { lyric: 'ter' }), n('D', 4, 'quarter', { lyric: 'aus' }), n('E', 4, 'quarter', { lyric: 'E-' })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('E', 4, 'quarter', { dots: 1, lyric: 'ly-' }), n('D', 4, 'eighth', { lyric: 'si-' }), n('D', 4, 'half', { lyric: 'um!' })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('E', 4, 'quarter'), n('E', 4, 'quarter'), n('F', 4, 'quarter'), n('G', 4, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('G', 4, 'quarter'), n('F', 4, 'quarter'), n('E', 4, 'quarter'), n('D', 4, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('C', 4, 'quarter'), n('C', 4, 'quarter'), n('D', 4, 'quarter'), n('E', 4, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: { barlineRight: 'end' },
      voices: [[n('D', 4, 'quarter', { dots: 1 }), n('C', 4, 'eighth'), n('C', 4, 'half')]],
    },
  ];

  const bassMeasures: Measure[] = [
    {
      id: uid('m'),
      attributes: { clef: 'bass', keyFifths: 0, timeSignature: { beats: 4, beatType: 4 } },
      voices: [[chord([{ step: 'C', octave: 3 }, { step: 'G', octave: 3 }], 'half'), chord([{ step: 'C', octave: 3 }, { step: 'G', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'G', octave: 2 }, { step: 'G', octave: 3 }], 'half'), chord([{ step: 'G', octave: 2 }, { step: 'B', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'C', octave: 3 }, { step: 'G', octave: 3 }], 'half'), chord([{ step: 'C', octave: 3 }, { step: 'G', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'G', octave: 2 }, { step: 'G', octave: 3 }], 'whole')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'C', octave: 3 }, { step: 'E', octave: 3 }, { step: 'G', octave: 3 }], 'half'), chord([{ step: 'C', octave: 3 }, { step: 'G', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'G', octave: 2 }, { step: 'G', octave: 3 }], 'half'), chord([{ step: 'F', octave: 3 }, { step: 'B', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'C', octave: 3 }, { step: 'E', octave: 3 }], 'half'), chord([{ step: 'F', octave: 3 }, { step: 'A', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: { barlineRight: 'end' },
      voices: [[n('G', 3, 'half'), chord([{ step: 'C', octave: 3 }, { step: 'E', octave: 3 }, { step: 'G', octave: 3 }], 'half')]],
    },
  ];

  return {
    id: uid('score'),
    title: 'Ode to Joy',
    subtitle: 'Theme from Symphony No. 9 in D Minor, Op. 125',
    composer: 'Ludwig van Beethoven',
    defaultTempo: 116,
    updatedAt: Date.now(),
    sourceLabel: 'Built-in Library',
    parts: [
      {
        id: uid('part'),
        name: 'Piano',
        shortName: 'Pno.',
        timbre: 'piano',
        volume: 0.9,
        muted: false,
        solo: false,
        staves: [
          { id: uid('staff'), clef: 'treble', measures },
          { id: uid('staff'), clef: 'bass', measures: bassMeasures },
        ],
      },
    ],
  };
}

/**
 * Chopin - Prelude in A Major, Op. 28 No. 7 (Opening 8 bars)
 */
export function createChopinPreludeA(): ScoreDocument {
  const rh: Measure[] = [
    {
      id: uid('m'),
      attributes: { clef: 'treble', keyFifths: 3, timeSignature: { beats: 3, beatType: 4 }, tempo: 72 },
      voices: [[r('quarter'), r('quarter'), n('E', 4, 'quarter', { dynamic: 'p' })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('C', 5, 'quarter', { alter: 1, dots: 1 }), n('D', 5, 'eighth'), n('B', 4, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'G', octave: 4, alter: 1 }, { step: 'B', octave: 4 }, { step: 'D', octave: 5 }], 'quarter'), chord([{ step: 'G', octave: 4, alter: 1 }, { step: 'B', octave: 4 }, { step: 'D', octave: 5 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'G', octave: 4, alter: 1 }, { step: 'B', octave: 4 }, { step: 'D', octave: 5 }], 'quarter'), chord([{ step: 'G', octave: 4, alter: 1 }, { step: 'B', octave: 4 }, { step: 'D', octave: 5 }], 'quarter'), n('D', 5, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('D', 5, 'quarter', { dots: 1 }), n('E', 5, 'eighth'), n('C', 5, 'quarter', { alter: 1 })]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'E', octave: 4 }, { step: 'A', octave: 4 }, { step: 'C', octave: 5, alter: 1 }], 'quarter'), chord([{ step: 'E', octave: 4 }, { step: 'A', octave: 4 }, { step: 'C', octave: 5, alter: 1 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[chord([{ step: 'E', octave: 4 }, { step: 'A', octave: 4 }, { step: 'C', octave: 5, alter: 1 }], 'quarter'), chord([{ step: 'E', octave: 4 }, { step: 'A', octave: 4 }, { step: 'C', octave: 5, alter: 1 }], 'quarter'), n('E', 4, 'quarter')]],
    },
    {
      id: uid('m'),
      attributes: { barlineRight: 'end' },
      voices: [[n('C', 5, 'half', { alter: 1, dots: 1 })]],
    },
  ];

  const lh: Measure[] = [
    {
      id: uid('m'),
      attributes: { clef: 'bass', keyFifths: 3, timeSignature: { beats: 3, beatType: 4 } },
      voices: [createMeasureRest(3)],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('E', 2, 'quarter'), chord([{ step: 'E', octave: 3 }, { step: 'B', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('E', 2, 'quarter'), chord([{ step: 'E', octave: 3 }, { step: 'B', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('E', 2, 'quarter'), chord([{ step: 'E', octave: 3 }, { step: 'B', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('A', 2, 'quarter'), chord([{ step: 'E', octave: 3 }, { step: 'A', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('A', 2, 'quarter'), chord([{ step: 'E', octave: 3 }, { step: 'A', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[n('A', 2, 'quarter'), chord([{ step: 'E', octave: 3 }, { step: 'A', octave: 3 }], 'half')]],
    },
    {
      id: uid('m'),
      attributes: { barlineRight: 'end' },
      voices: [[chord([{ step: 'A', octave: 2 }, { step: 'E', octave: 3 }, { step: 'A', octave: 3 }], 'half', 1)]],
    },
  ];

  return {
    id: uid('score'),
    title: 'Prelude in A Major',
    subtitle: 'Op. 28, No. 7 (Andantino)',
    composer: 'Frédéric Chopin',
    defaultTempo: 72,
    updatedAt: Date.now(),
    sourceLabel: 'Built-in Library',
    parts: [
      {
        id: uid('part'),
        name: 'Piano',
        shortName: 'Pno.',
        timbre: 'piano',
        volume: 0.9,
        muted: false,
        solo: false,
        staves: [
          { id: uid('staff'), clef: 'treble', measures: rh },
          { id: uid('staff'), clef: 'bass', measures: lh },
        ],
      },
    ],
  };
}

export interface NewScoreOptions {
  title: string;
  subtitle?: string;
  composer?: string;
  keyFifths: number;
  beats: number;
  beatType: number;
  tempo: number;
  measureCount: number;
  template: NewScoreTemplate;
}

export type NewScoreTemplate =
  | 'piano'
  | 'guitar'
  | 'violin'
  | 'cello'
  | 'flute'
  | 'trumpet'
  | 'quartet'
  | 'choir';

function makeBlankStaff(
  clef: ClefType,
  opts: NewScoreOptions,
  includeTempo: boolean
) {
  const measures: Measure[] = [];
  for (let i = 0; i < opts.measureCount; i++) {
    const m = createEmptyMeasure(
      opts.beats,
      opts.beatType,
      i === 0,
      clef,
      i === 0 ? opts.keyFifths : undefined,
      i === 0 && includeTempo ? opts.tempo : undefined
    );
    if (i === opts.measureCount - 1) {
      m.attributes.barlineRight = 'end';
    }
    measures.push(m);
  }
  return {
    id: uid('staff'),
    clef,
    measures,
  };
}

export function createBlankScore(opts: NewScoreOptions): ScoreDocument {
  const makePart = (
    name: string,
    shortName: string,
    timbre: InstrumentTimbre,
    program: number,
    clef: ClefType,
    includeTempo: boolean,
    showTab = false
  ): Part => ({
    id: uid('part'),
    name,
    shortName,
    timbre,
    program,
    volume: 0.85,
    muted: false,
    solo: false,
    showTab: showTab || undefined,
    staves: [makeBlankStaff(clef, opts, includeTempo)],
  });

  let parts: Part[] = [];

  switch (opts.template) {
    case 'piano':
      parts = [
        {
          id: uid('part'),
          name: 'Piano',
          shortName: 'Pno.',
          timbre: 'piano',
          program: 0,
          volume: 0.9,
          muted: false,
          solo: false,
          staves: [makeBlankStaff('treble', opts, true), makeBlankStaff('bass', opts, false)],
        },
      ];
      break;
    case 'guitar':
      parts = [makePart('Acoustic Guitar', 'Gtr.', 'guitar', 25, 'treble', true, true)];
      break;
    case 'violin':
      parts = [makePart('Violin', 'Vln.', 'strings', 40, 'treble', true)];
      break;
    case 'cello':
      parts = [makePart('Violoncello', 'Vc.', 'strings', 42, 'bass', true)];
      break;
    case 'flute':
      parts = [makePart('Flute', 'Fl.', 'woodwind', 73, 'treble', true)];
      break;
    case 'trumpet':
      parts = [makePart('Trumpet', 'Tpt.', 'brass', 56, 'treble', true)];
      break;
    case 'quartet':
      parts = [
        makePart('Violin I', 'Vln. I', 'strings', 40, 'treble', true),
        makePart('Violin II', 'Vln. II', 'strings', 40, 'treble', false),
        makePart('Viola', 'Vla.', 'strings', 41, 'alto', false),
        makePart('Violoncello', 'Vc.', 'strings', 42, 'bass', false),
      ];
      break;
    case 'choir':
      parts = [
        makePart('Soprano', 'S.', 'voice', 52, 'treble', true),
        makePart('Alto', 'A.', 'voice', 52, 'treble', false),
        makePart('Tenor', 'T.', 'voice', 52, 'treble', false),
        makePart('Bass', 'B.', 'voice', 52, 'bass', false),
      ];
      break;
    default:
      parts = [makePart('Piano', 'Pno.', 'piano', 0, 'treble', true)];
  }

  return {
    id: uid('score'),
    title: opts.title || 'Untitled Score',
    subtitle: opts.subtitle || '',
    composer: opts.composer || '',
    defaultTempo: opts.tempo,
    parts,
    updatedAt: Date.now(),
    sourceLabel: 'Created in OpusWeb',
  };
}

export const INSTRUMENT_PRESETS: {
  id: string;
  name: string;
  shortName: string;
  timbre: InstrumentTimbre;
  /** General MIDI program backed by the sampled Playback soundfont */
  program: number;
  staves: ClefType[];
  showTab?: boolean;
  drumKit?: boolean;
}[] = [
  { id: 'piano', name: 'Piano', shortName: 'Pno.', timbre: 'piano', program: 0, staves: ['treble', 'bass'] },
  { id: 'violin', name: 'Violin', shortName: 'Vln.', timbre: 'strings', program: 40, staves: ['treble'] },
  { id: 'viola', name: 'Viola', shortName: 'Vla.', timbre: 'strings', program: 41, staves: ['alto'] },
  { id: 'cello', name: 'Violoncello', shortName: 'Vc.', timbre: 'strings', program: 42, staves: ['bass'] },
  { id: 'flute', name: 'Flute', shortName: 'Fl.', timbre: 'woodwind', program: 73, staves: ['treble'] },
  { id: 'clarinet', name: 'Clarinet', shortName: 'Cl.', timbre: 'woodwind', program: 71, staves: ['treble'] },
  { id: 'trumpet', name: 'Trumpet', shortName: 'Tpt.', timbre: 'brass', program: 56, staves: ['treble'] },
  { id: 'horn', name: 'French Horn', shortName: 'Hn.', timbre: 'brass', program: 60, staves: ['treble'] },
  { id: 'guitar', name: 'Acoustic Guitar', shortName: 'Gtr.', timbre: 'guitar', program: 25, staves: ['treble'], showTab: true },
  { id: 'electric-guitar', name: 'Electric Guitar', shortName: 'E.Gtr.', timbre: 'guitar', program: 27, staves: ['treble'] },
  { id: 'bass-guitar', name: 'Bass Guitar', shortName: 'Bass', timbre: 'strings', program: 33, staves: ['bass'], showTab: true },
  { id: 'brass', name: 'Brass Section', shortName: 'Brass', timbre: 'brass', program: 61, staves: ['treble'] },
  { id: 'drumkit', name: 'Drum Kit', shortName: 'Dr.', timbre: 'percussion', program: 0, staves: ['percussion'], drumKit: true },
  { id: 'voice', name: 'Choir Aahs', shortName: 'Ch.', timbre: 'voice', program: 52, staves: ['treble'] },
];

export function createGuitarArpeggioEtude(): ScoreDocument {
  const measures: Measure[] = [
    {
      id: uid('m'),
      attributes: { clef: 'treble', keyFifths: 1, timeSignature: { beats: 3, beatType: 4 }, tempo: 96 },
      voices: [[
        n('E', 3, 'eighth', { dynamic: 'mp' }),
        n('G', 4, 'eighth'),
        n('B', 4, 'eighth'),
        n('E', 5, 'eighth'),
        n('B', 4, 'eighth'),
        n('G', 4, 'eighth'),
      ]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[
        n('E', 3, 'eighth'),
        n('G', 4, 'eighth'),
        n('B', 4, 'eighth'),
        n('E', 5, 'eighth'),
        n('D', 5, 'eighth'),
        n('C', 5, 'eighth'),
      ]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[
        n('A', 3, 'eighth'),
        n('E', 4, 'eighth'),
        n('A', 4, 'eighth'),
        n('C', 5, 'eighth'),
        n('A', 4, 'eighth'),
        n('E', 4, 'eighth'),
      ]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[
        n('B', 3, 'eighth'),
        n('D', 4, 'eighth', { alter: 1 }),
        n('A', 4, 'eighth'),
        n('B', 4, 'eighth'),
        n('A', 4, 'eighth'),
        n('F', 4, 'eighth', { alter: 1 }),
      ]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[
        n('C', 4, 'eighth'),
        n('E', 4, 'eighth'),
        n('G', 4, 'eighth'),
        n('C', 5, 'eighth'),
        n('G', 4, 'eighth'),
        n('E', 4, 'eighth'),
      ]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[
        n('D', 4, 'eighth'),
        n('F', 4, 'eighth', { alter: 1 }),
        n('A', 4, 'eighth'),
        n('D', 5, 'eighth'),
        n('A', 4, 'eighth'),
        n('F', 4, 'eighth', { alter: 1 }),
      ]],
    },
    {
      id: uid('m'),
      attributes: {},
      voices: [[
        n('G', 3, 'eighth'),
        n('B', 3, 'eighth'),
        n('D', 4, 'eighth'),
        n('G', 4, 'eighth'),
        n('B', 4, 'eighth'),
        n('D', 5, 'eighth'),
      ]],
    },
    {
      id: uid('m'),
      attributes: { barlineRight: 'end' },
      voices: [[
        chord([
          { step: 'E', octave: 3 },
          { step: 'B', octave: 3 },
          { step: 'E', octave: 4 },
          { step: 'G', octave: 4 },
          { step: 'B', octave: 4 },
          { step: 'E', octave: 5 },
        ], 'half', 1),
      ]],
    },
  ];

  return {
    id: uid('score'),
    title: 'Acoustic Guitar Arpeggio Study',
    subtitle: 'Standard Notation & 6-String Tablature (E Minor)',
    composer: 'OpusWeb Guitar Studio',
    defaultTempo: 96,
    updatedAt: Date.now(),
    sourceLabel: 'Built-in Library',
    parts: [
      {
        id: uid('part'),
        name: 'Acoustic Guitar',
        shortName: 'Gtr.',
        timbre: 'guitar',
        volume: 0.9,
        muted: false,
        solo: false,
        showTab: true,
        staves: [{ id: uid('staff'), clef: 'treble', measures }],
      },
    ],
  };
}

export const STARTER_SCORES: { id: string; title: string; subtitle: string; create: () => ScoreDocument }[] = [
  {
    id: 'minuet-g',
    title: 'Minuet in G Major (BWV Anh. 114)',
    subtitle: 'Piano Grand Staff · 3/4 · J.S. Bach / C. Petzold',
    create: createMinuetInG,
  },
  {
    id: 'guitar-etude',
    title: 'Acoustic Guitar Arpeggio Study',
    subtitle: 'Guitar Notation + Tablature · 3/4 · E Minor',
    create: createGuitarArpeggioEtude,
  },
  {
    id: 'ode-joy',
    title: 'Ode to Joy (Symphony No. 9)',
    subtitle: 'Piano & Lyrics · 4/4 · Ludwig van Beethoven',
    create: createOdeToJoy,
  },
  {
    id: 'chopin-a',
    title: 'Prelude in A Major, Op. 28 No. 7',
    subtitle: 'Piano Grand Staff · 3/4 · Frédéric Chopin',
    create: createChopinPreludeA,
  },
  {
    id: 'blank-piano',
    title: 'Blank Piano Grand Staff',
    subtitle: '8 Measures · 4/4 · C Major',
    create: () =>
      createBlankScore({
        title: 'Untitled Piano Piece',
        composer: '',
        keyFifths: 0,
        beats: 4,
        beatType: 4,
        tempo: 120,
        measureCount: 8,
        template: 'piano',
      }),
  },
];
