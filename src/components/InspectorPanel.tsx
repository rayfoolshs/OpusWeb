import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AccidentalType,
  DurationType,
  Part,
  ScoreDocument,
  SelectionTarget,
  VoiceEvent,
} from '../types/score';
import { drumLabelForPitch, drumLayoutLegend } from '../audio/drumKit';
import { CHORD_PRESETS, isValidChordSymbol, sortedChords } from '../utils/chords';
import {
  KEY_SIGNATURE_LIST,
  assignTabPositions,
  formatPitchName,
  getEffectiveMeasureContext,
  getTabConfig,
  supportsGuitarTab,
  tabLabelForPart,
} from '../utils/musicTheory';
import { INSTRUMENT_PRESETS } from '../utils/starterScores';

interface InspectorPanelProps {
  score: ScoreDocument;
  selection: SelectionTarget | null;
  onUpdateScoreMeta: (patch: Partial<Pick<ScoreDocument, 'title' | 'subtitle' | 'composer' | 'defaultTempo'>>) => void;
  onTransposeSelectedNote: (mode: 'diatonic' | 'chromatic' | 'octave', delta: number) => void;
  onSetSelectedAccidental: (acc: AccidentalType | null) => void;
  onSetSelectedDuration: (dur: DurationType, dots?: 0 | 1) => void;
  onToggleSelectedTie: () => void;
  onSetSelectedLyric: (lyric: string) => void;
  onDeleteSelectedEvent: () => void;
  onAddIntervalToChord: (semitones: number) => void;
  onSetGuitarTabPosition: (noteIndex: number, tabString: number, tabFret: number) => void;
  onCycleGuitarTabString: (dir: -1 | 1) => void;
  onUpdatePartMixer: (partIndex: number, patch: Partial<Pick<Part, 'volume' | 'muted' | 'solo' | 'name' | 'showTab'>>) => void;
  onAddInstrumentPart: (presetId: string) => void;
  onRemoveInstrumentPart: (partIndex: number) => void;
  onUpdateMeasureTempo: (measureIndex: number, tempo: number | undefined) => void;
  onAddChord: (measureIndex: number, beat: number, symbol: string) => void;
  onRemoveChord: (measureIndex: number, chordId: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  score,
  selection,
  onUpdateScoreMeta,
  onTransposeSelectedNote,
  onSetSelectedAccidental,
  onSetSelectedDuration,
  onToggleSelectedTie,
  onSetSelectedLyric,
  onDeleteSelectedEvent,
  onAddIntervalToChord,
  onSetGuitarTabPosition,
  onCycleGuitarTabString,
  onUpdatePartMixer,
  onAddInstrumentPart,
  onRemoveInstrumentPart,
  onUpdateMeasureTempo,
  onAddChord,
  onRemoveChord,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'chords' | 'parts'>('inspector');
  const [selectedPreset, setSelectedPreset] = useState(INSTRUMENT_PRESETS[0].id);
  const [chordInput, setChordInput] = useState('');
  const [chordBeat, setChordBeat] = useState(1);
  const [chordError, setChordError] = useState<string | null>(null);

  let selectedEvent: VoiceEvent | null = null;
  if (selection && selection.eventId) {
    const part = score.parts[selection.partIndex];
    const staff = part?.staves[selection.staffIndex];
    const measure = staff?.measures[selection.measureIndex];
    const voice = measure?.voices[selection.voiceIndex];
    selectedEvent = voice?.find((e) => e.id === selection.eventId) || null;
  }

  const activeMeasureIdx = selection?.measureIndex ?? 0;
  const activePartIdx = selection?.partIndex ?? 0;
  const activeStaffIdx = selection?.staffIndex ?? 0;
  const activePart = score.parts[activePartIdx] || score.parts[0];
  const activePartIsDrum = Boolean(activePart?.drumKit);
  const activeMeasure = activePart?.staves[activeStaffIdx]?.measures[activeMeasureIdx];
  const measureCtx = activePart
    ? getEffectiveMeasureContext(activePart, activeStaffIdx, activeMeasureIdx, score.defaultTempo)
    : null;

  const activeTabConfig = activePart ? getTabConfig(activePart) : null;
  const tabPositions =
    selectedEvent && !selectedEvent.isRest && activeTabConfig
      ? assignTabPositions(selectedEvent.notes, activeTabConfig)
      : [];

  // Chord leadsheet works on the lead staff's selected measure
  const leadMeasure = score.parts[0]?.staves[0]?.measures[activeMeasureIdx];
  const measureBeatValue = 4 / (measureCtx?.beatType ?? 4); // quarter-note beats per notated beat
  const measureBeatCount = Math.max(1, measureCtx?.beats ?? 4);
  const measureChords = sortedChords(leadMeasure?.chordSymbols);

  // Start each measure (or score) at beat 1, but keep the advancing beat within a measure
  useEffect(() => {
    setChordBeat(1);
  }, [activeMeasureIdx, score.id]);

  useEffect(() => {
    setChordBeat((beat) => Math.min(beat, measureBeatCount));
  }, [measureBeatCount]);

  const addChordNow = (symbol: string) => {
    const trimmed = symbol.trim();
    if (!trimmed) {
      setChordError('Enter a chord symbol');
      return;
    }
    if (!isValidChordSymbol(trimmed)) {
      setChordError('Unrecognized chord symbol');
      return;
    }
    setChordError(null);
    onAddChord(activeMeasureIdx, (chordBeat - 1) * measureBeatValue, trimmed);
    setChordInput('');
    setChordBeat((beat) => Math.min(measureBeatCount, beat + 1));
  };

  const formatChordBeat = (beat: number) => {
    const value = beat / measureBeatValue + 1;
    return `Beat ${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
  };

  return (
    <aside className="no-print w-[276px] shrink-0 bg-[var(--bg-panel)] border-l border-[var(--border)] flex flex-col overflow-hidden select-none">
      {/* Segmented Tab Switcher */}
      <div className="p-2 border-b border-[var(--border)]">
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-[var(--bg-sunken)] rounded-md border border-[var(--border-soft)]">
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`h-7 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'inspector'
                ? 'bg-[var(--bg-active)] text-[var(--text-strong)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            Inspector
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chords')}
            className={`h-7 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'chords'
                ? 'bg-[var(--bg-active)] text-[var(--text-strong)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            Chords
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parts')}
            className={`h-7 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'parts'
                ? 'bg-[var(--bg-active)] text-[var(--text-strong)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            Parts
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
        {activeTab === 'inspector' ? (
          <>
            {/* Selected Note / Rest Inspector */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--text-strong)]">
                  {selectedEvent
                    ? selectedEvent.isRest
                      ? 'Selected Rest'
                      : selectedEvent.notes.length > 1
                        ? 'Selected Chord'
                        : 'Selected Note'
                    : 'Note & Chord'}
                </h3>
                {selectedEvent && (
                  <button
                    type="button"
                    onClick={onDeleteSelectedEvent}
                    title="Convert to Rest / Delete (Del)"
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {!selectedEvent ? (
                <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 text-xs text-[var(--text-muted)] leading-relaxed">
                  Click any note or rest on the score to inspect or edit pitch, duration, accidentals, ties, and lyrics.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Pitch Display & Transposition */}
                  {!selectedEvent.isRest && (
                    <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--text-muted)]">Pitch</span>
                        <span className="font-mono-tabular text-xs font-semibold text-[var(--accent-text)]">
                          {selectedEvent.notes.map((n) => formatPitchName(n.pitch)).join(' · ')}
                        </span>
                      </div>

                      {activePartIsDrum && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[var(--text-muted)]">Drum</span>
                          <span className="text-[11px] font-semibold text-[var(--accent-text)] text-right">
                            {selectedEvent.notes.map((n) => drumLabelForPitch(n.pitch)).join(' · ')}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('diatonic', 1)}
                          title="Diatonic Step Up (ArrowUp)"
                          className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)] flex items-center justify-center gap-1"
                        >
                          <ArrowUp className="w-3 h-3" /> Step
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('chromatic', 1)}
                          title="Half Step Up"
                          className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)]"
                        >
                          +1 Semi
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('octave', 1)}
                          title="Octave Up (Shift+ArrowUp)"
                          className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)]"
                        >
                          +8va
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('diatonic', -1)}
                          title="Diatonic Step Down (ArrowDown)"
                          className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)] flex items-center justify-center gap-1"
                        >
                          <ArrowDown className="w-3 h-3" /> Step
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('chromatic', -1)}
                          title="Half Step Down"
                          className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)]"
                        >
                          -1 Semi
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('octave', -1)}
                          title="Octave Down (Shift+ArrowDown)"
                          className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)]"
                        >
                          -8vb
                        </button>
                      </div>

                      {/* Stack Chord Intervals */}
                      <div className="pt-1 border-t border-[var(--border-soft)]">
                        <span className="text-[11px] text-[var(--text-muted)] block mb-1.5">
                          Stack Chord Interval
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { label: '+3rd', semi: 4 },
                            { label: '+m3', semi: 3 },
                            { label: '+5th', semi: 7 },
                            { label: '+8ve', semi: 12 },
                          ].map((intv) => (
                            <button
                              key={intv.label}
                              type="button"
                              onClick={() => onAddIntervalToChord(intv.semi)}
                              className="h-7 rounded bg-[var(--bg-button)] hover:bg-blue-600/80 text-[11px] font-mono-tabular text-[var(--text-strong)] transition-colors"
                            >
                              {intv.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Guitar Tablature Fingering (guitar parts with linked TAB only) */}
                      {activePart?.showTab && supportsGuitarTab(activePart) && (
                        <div className="pt-2 border-t border-[var(--border-soft)] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {activeTabConfig?.name === 'bass' ? 'Bass TAB' : 'Guitar TAB'}
                            </span>
                            <span className="text-[10px] text-[var(--text-faint)] text-right">
                              Type 0–24 on the score, or use the fret box
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {selectedEvent.notes.map((note, noteIdx) => {
                              const pos = tabPositions.find((p) => p.noteId === note.id);
                              const str = pos?.str ?? 1;
                              const fret = pos?.fret ?? 0;
                              return (
                                <div key={note.id} className="flex items-center gap-1.5">
                                  <span className="w-10 shrink-0 font-mono-tabular text-[11px] font-semibold text-[var(--accent-text-strong)]">
                                    {formatPitchName(note.pitch)}
                                  </span>
                                  <select
                                    value={str}
                                    onChange={(e) =>
                                      onSetGuitarTabPosition(noteIdx, Number(e.target.value), fret)
                                    }
                                    title={`String for ${formatPitchName(note.pitch)}`}
                                    className="h-7 w-[64px] shrink-0 rounded bg-[var(--bg-app)] border border-[var(--border)] px-1 font-mono-tabular text-[11px] text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
                                  >
                                    {Array.from(
                                      { length: activeTabConfig?.strings ?? 6 },
                                      (_, i) => i + 1
                                    ).map((s) => (
                                      <option key={s} value={s}>
                                        Str {s}
                                      </option>
                                    ))}
                                  </select>
                                  <FretInput
                                    noteId={note.id}
                                    value={fret}
                                    onCommit={(nextFret) =>
                                      onSetGuitarTabPosition(noteIdx, str, nextFret)
                                    }
                                  />
                                  <span className="text-[10px] text-[var(--text-faint)]">fret</span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => onCycleGuitarTabString(-1)}
                              className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)]"
                            >
                              Lower String
                            </button>
                            <button
                              type="button"
                              onClick={() => onCycleGuitarTabString(1)}
                              className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] text-[var(--text-strong)]"
                            >
                              Higher String
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Accidental & Tie */}
                  {!selectedEvent.isRest && (
                    <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 space-y-2.5">
                      <span className="text-[11px] text-[var(--text-muted)] block">Accidental &amp; Tie</span>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: 'sharp', label: '♯' },
                            { id: 'flat', label: '♭' },
                            { id: 'natural', label: '♮' },
                            { id: 'double-sharp', label: '𝄪' },
                            { id: 'double-flat', label: '𝄫' },
                          ] as const
                        ).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => onSetSelectedAccidental(a.id)}
                            className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-xs font-semibold text-[var(--text-strong)]"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={onToggleSelectedTie}
                        className={`w-full h-8 rounded text-xs font-medium transition-colors ${
                          selectedEvent.notes.some((n) => n.tieStart)
                            ? 'bg-blue-600 text-white'
                            : 'bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[var(--text-strong)]'
                        }`}
                      >
                        {selectedEvent.notes.some((n) => n.tieStart)
                          ? 'Tied to Next Note'
                          : 'Tie to Next Note'}
                      </button>
                    </div>
                  )}

                  {/* Duration & Dot */}
                  <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 space-y-2">
                    <span className="text-[11px] text-[var(--text-muted)] block">Duration</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['whole', 'half', 'quarter', 'eighth', '16th', '32nd'] as DurationType[]).map(
                        (d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => onSetSelectedDuration(d, selectedEvent?.dots === 1 ? 1 : 0)}
                            className={`h-7 rounded text-[11px] capitalize transition-colors ${
                              selectedEvent?.duration === d
                                ? 'bg-blue-600 text-white'
                                : 'bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[var(--text)]'
                            }`}
                          >
                            {d}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSetSelectedDuration(
                          selectedEvent!.duration,
                          selectedEvent!.dots > 0 ? 0 : 1
                        )
                      }
                      className={`w-full h-7 rounded text-[11px] font-medium ${
                        selectedEvent.dots > 0
                          ? 'bg-blue-600 text-white'
                          : 'bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[var(--text)]'
                      }`}
                    >
                      Dotted ({selectedEvent.dots > 0 ? 'On' : 'Off'})
                    </button>
                  </div>

                  {/* Lyric */}
                  {!selectedEvent.isRest && (
                    <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 space-y-1.5">
                      <label className="text-[11px] text-[var(--text-muted)] block">Lyric Syllable</label>
                      <input
                        type="text"
                        value={selectedEvent.lyric || ''}
                        onChange={(e) => onSetSelectedLyric(e.target.value)}
                        placeholder="e.g. Hal-le-lu-jah"
                        className="w-full h-8 px-2.5 rounded bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Measure Context Inspector */}
            {measureCtx && (
              <section className="pt-3 border-t border-[var(--border)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[var(--text-strong)]">
                    Measure {activeMeasureIdx + 1}
                  </h3>
                  <span className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
                    {measureCtx.beats}/{measureCtx.beatType} · {measureCtx.clef}
                  </span>
                </div>
                <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[var(--text)]">
                    <span className="text-[var(--text-muted)]">Key</span>
                    <span>
                      {KEY_SIGNATURE_LIST.find((k) => k.fifths === measureCtx.keyFifths)?.label ||
                        'C Major'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[var(--text-muted)] shrink-0">Measure Tempo</label>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={activeMeasure?.attributes.tempo ?? ''}
                      placeholder={String(measureCtx.tempo)}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        onUpdateMeasureTempo(
                          activeMeasureIdx,
                          val ? Math.max(30, Math.min(300, Number(val))) : undefined
                        );
                      }}
                      className="w-20 h-7 px-2 rounded bg-[var(--bg-app)] border border-[var(--border)] font-mono-tabular text-right text-xs text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </section>
            )}
          </>
        ) : activeTab === 'chords' ? (
          <div className="space-y-4">
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--text-strong)]">Chord Leadsheet</h3>
                <span className="text-[11px] text-[var(--text-muted)]">Measure {activeMeasureIdx + 1}</span>
              </div>

              <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={chordInput}
                    onChange={(e) => {
                      setChordInput(e.target.value);
                      setChordError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addChordNow(chordInput);
                      }
                    }}
                    placeholder="Cmaj7, Am, G7/B…"
                    className="flex-1 h-8 px-2.5 rounded bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => addChordNow(chordInput)}
                    className="h-8 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shrink-0"
                  >
                    Add
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] text-[var(--text-muted)] shrink-0">At beat</label>
                  <select
                    value={chordBeat}
                    onChange={(e) => setChordBeat(Number(e.target.value))}
                    className="h-7 px-2 rounded bg-[var(--bg-sunken)] border border-[var(--border)] font-mono-tabular text-[11px] text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
                  >
                    {Array.from({ length: measureBeatCount }, (_, i) => i + 1).map((beat) => (
                      <option key={beat} value={beat}>
                        {beat}
                      </option>
                    ))}
                  </select>
                </div>

                {chordError && <p className="text-[10px] text-rose-400">{chordError}</p>}

                <div>
                  <span className="text-[10px] text-[var(--text-faint)] block mb-1">Quick add</span>
                  <div className="grid grid-cols-4 gap-1">
                    {CHORD_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => addChordNow(preset)}
                        className="h-7 rounded bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[11px] font-serif-score font-bold text-[var(--text-strong)] transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-[var(--text-faint)] leading-relaxed">
                  Symbols appear above the staff and play back as block chords with the first pitched instrument.
                </p>
              </div>
            </section>

            <section className="pt-3 border-t border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--text-strong)]">Progression</h3>
                <span className="text-[10px] text-[var(--text-faint)]">
                  {measureCtx ? `${measureCtx.beats}/${measureCtx.beatType}` : ''}
                </span>
              </div>

              {measureChords.length === 0 ? (
                <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
                  No chords in this measure yet. Pick a beat and add a symbol above.
                </div>
              ) : (
                <div className="space-y-1">
                  {measureChords.map((chord) => (
                    <div
                      key={chord.id}
                      className="flex items-center gap-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-soft)] px-2 py-1.5"
                    >
                      <span className="font-mono-tabular text-[10px] text-[var(--text-faint)] w-14 shrink-0">
                        {formatChordBeat(chord.beat)}
                      </span>
                      <span className="font-serif-score text-sm font-bold text-[var(--text-strong)] flex-1 truncate">
                        {chord.symbol}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveChord(activeMeasureIdx, chord.id)}
                        title="Remove chord"
                        className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--surface-soft)]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* Score Metadata & Parts Mixer */
          <div className="space-y-5">
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-[var(--text-strong)]">Score Details</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1">Title</label>
                  <input
                    type="text"
                    value={score.title}
                    onChange={(e) => onUpdateScoreMeta({ title: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={score.subtitle}
                    onChange={(e) => onUpdateScoreMeta({ subtitle: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1">Composer</label>
                  <input
                    type="text"
                    value={score.composer}
                    onChange={(e) => onUpdateScoreMeta({ composer: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </section>

            <section className="pt-3 border-t border-[var(--border)] space-y-3">
              <h3 className="text-xs font-semibold text-[var(--text-strong)]">Instruments &amp; Mixer</h3>

              <div className="space-y-2">
                {score.parts.map((part, pIdx) => (
                  <div
                    key={part.id}
                    className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) =>
                          onUpdatePartMixer(pIdx, { name: e.target.value })
                        }
                        className="bg-transparent text-xs font-medium text-[var(--text-strong)] focus:outline-none border-b border-transparent focus:border-blue-500 min-w-0 flex-1"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdatePartMixer(pIdx, { muted: !part.muted })}
                          title="Mute"
                          className={`h-6 w-6 rounded flex items-center justify-center text-[11px] ${
                            part.muted
                              ? 'bg-rose-600/80 text-white'
                              : 'bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          {part.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdatePartMixer(pIdx, { solo: !part.solo })}
                          title="Solo"
                          className={`h-6 w-6 rounded text-[10px] font-bold ${
                            part.solo
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          S
                        </button>
                        {score.parts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveInstrumentPart(pIdx)}
                            title="Remove Part"
                            className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--surface-soft)]"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={part.volume}
                        onChange={(e) =>
                          onUpdatePartMixer(pIdx, { volume: Number(e.target.value) })
                        }
                        className="flex-1 accent-blue-500 h-1.5"
                      />
                      <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] w-8 text-right">
                        {Math.round(part.volume * 100)}%
                      </span>
                    </div>
                    {supportsGuitarTab(part) && (
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-soft)]">
                        <span className="text-[11px] text-[var(--text-muted)]">{tabLabelForPart(part)}</span>
                        <button
                          type="button"
                          onClick={() => onUpdatePartMixer(pIdx, { showTab: !part.showTab })}
                          className={`h-6 px-2.5 rounded text-[11px] font-medium transition-colors ${
                            part.showTab
                              ? 'bg-blue-600 text-white'
                              : 'bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          {part.showTab ? 'Shown' : 'Hidden'}
                        </button>
                      </div>
                    )}
                    {part.drumKit && (
                      <p
                        className="text-[10px] leading-relaxed text-[var(--text-faint)] pt-1 border-t border-[var(--border-soft)]"
                        title={drumLayoutLegend()}
                      >
                        {drumLayoutLegend()}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="flex-1 h-8 px-2 rounded bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
                >
                  {INSTRUMENT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onAddInstrumentPart(selectedPreset)}
                  className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
};

/**
 * Fret number field that keeps a local draft while typing and commits a clamped
 * 0–24 value on blur or Enter, so multi-digit frets can be entered cleanly.
 */
function FretInput({
  noteId,
  value,
  onCommit,
}: {
  noteId: string;
  value: number;
  onCommit: (fret: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [noteId, value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.max(0, Math.min(24, parsed));
      setDraft(String(clamped));
      if (clamped !== value) onCommit(clamped);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <input
      type="number"
      min={0}
      max={24}
      step={1}
      value={draft}
      aria-label="Fret number"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="h-7 w-14 shrink-0 rounded bg-[var(--bg-app)] border border-[var(--border)] px-1.5 text-right font-mono-tabular text-[11px] text-[var(--text-strong)] focus:outline-none focus:border-blue-500"
    />
  );
}
