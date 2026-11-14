import React, { useState } from 'react';
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
import {
  KEY_SIGNATURE_LIST,
  assignGuitarChordTabPositions,
  formatPitchName,
  getEffectiveMeasureContext,
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
  onCycleGuitarTabString: (dir: -1 | 1) => void;
  onUpdatePartMixer: (partIndex: number, patch: Partial<Pick<Part, 'volume' | 'muted' | 'solo' | 'name' | 'showTab'>>) => void;
  onAddInstrumentPart: (presetId: string) => void;
  onRemoveInstrumentPart: (partIndex: number) => void;
  onUpdateMeasureTempo: (measureIndex: number, tempo: number | undefined) => void;
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
  onCycleGuitarTabString,
  onUpdatePartMixer,
  onAddInstrumentPart,
  onRemoveInstrumentPart,
  onUpdateMeasureTempo,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'parts'>('inspector');
  const [selectedPreset, setSelectedPreset] = useState(INSTRUMENT_PRESETS[0].id);

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
  const activeMeasure = activePart?.staves[activeStaffIdx]?.measures[activeMeasureIdx];
  const measureCtx = activePart
    ? getEffectiveMeasureContext(activePart, activeStaffIdx, activeMeasureIdx, score.defaultTempo)
    : null;

  return (
    <aside className="no-print w-[276px] shrink-0 bg-[#181B21] border-l border-white/8 flex flex-col overflow-hidden select-none">
      {/* Segmented Tab Switcher */}
      <div className="p-2 border-b border-white/8">
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#121419] rounded-md border border-white/6">
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`h-7 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'inspector'
                ? 'bg-[#252A34] text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inspector
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parts')}
            className={`h-7 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'parts'
                ? 'bg-[#252A34] text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Score &amp; Parts
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
        {activeTab === 'inspector' ? (
          <>
            {/* Selected Note / Rest Inspector */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-200">
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
                <div className="rounded-lg bg-[#1E222A] border border-white/6 p-3 text-xs text-slate-400 leading-relaxed">
                  Click any note or rest on the score to inspect or edit pitch, duration, accidentals, ties, and lyrics.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Pitch Display & Transposition */}
                  {!selectedEvent.isRest && (
                    <div className="rounded-lg bg-[#1E222A] border border-white/6 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Pitch</span>
                        <span className="font-mono-tabular text-xs font-semibold text-blue-400">
                          {selectedEvent.notes.map((n) => formatPitchName(n.pitch)).join(' · ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('diatonic', 1)}
                          title="Diatonic Step Up (ArrowUp)"
                          className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200 flex items-center justify-center gap-1"
                        >
                          <ArrowUp className="w-3 h-3" /> Step
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('chromatic', 1)}
                          title="Half Step Up"
                          className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200"
                        >
                          +1 Semi
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('octave', 1)}
                          title="Octave Up (Shift+ArrowUp)"
                          className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200"
                        >
                          +8va
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('diatonic', -1)}
                          title="Diatonic Step Down (ArrowDown)"
                          className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200 flex items-center justify-center gap-1"
                        >
                          <ArrowDown className="w-3 h-3" /> Step
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('chromatic', -1)}
                          title="Half Step Down"
                          className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200"
                        >
                          -1 Semi
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransposeSelectedNote('octave', -1)}
                          title="Octave Down (Shift+ArrowDown)"
                          className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200"
                        >
                          -8vb
                        </button>
                      </div>

                      {/* Stack Chord Intervals */}
                      <div className="pt-1 border-t border-white/6">
                        <span className="text-[11px] text-slate-400 block mb-1.5">
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
                              className="h-7 rounded bg-[#262B35] hover:bg-blue-600/80 text-[11px] font-mono-tabular text-slate-200 transition-colors"
                            >
                              {intv.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Guitar Tablature Fingering (when part.showTab is active) */}
                      {activePart?.showTab && (
                        <div className="pt-2 border-t border-white/6 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Guitar TAB</span>
                            <span className="font-mono-tabular text-[11px] font-semibold text-blue-300">
                              {assignGuitarChordTabPositions(selectedEvent.notes)
                                .map((p) => `S${p.str}:F${p.fret}`)
                                .join(' ')}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => onCycleGuitarTabString(-1)}
                              className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200"
                            >
                              Lower String
                            </button>
                            <button
                              type="button"
                              onClick={() => onCycleGuitarTabString(1)}
                              className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-[11px] text-slate-200"
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
                    <div className="rounded-lg bg-[#1E222A] border border-white/6 p-3 space-y-2.5">
                      <span className="text-[11px] text-slate-400 block">Accidental &amp; Tie</span>
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
                            className="h-7 rounded bg-[#262B35] hover:bg-[#313846] text-xs font-semibold text-slate-200"
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
                            : 'bg-[#262B35] hover:bg-[#313846] text-slate-200'
                        }`}
                      >
                        {selectedEvent.notes.some((n) => n.tieStart)
                          ? 'Tied to Next Note'
                          : 'Tie to Next Note'}
                      </button>
                    </div>
                  )}

                  {/* Duration & Dot */}
                  <div className="rounded-lg bg-[#1E222A] border border-white/6 p-3 space-y-2">
                    <span className="text-[11px] text-slate-400 block">Duration</span>
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
                                : 'bg-[#262B35] hover:bg-[#313846] text-slate-300'
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
                          : 'bg-[#262B35] hover:bg-[#313846] text-slate-300'
                      }`}
                    >
                      Dotted ({selectedEvent.dots > 0 ? 'On' : 'Off'})
                    </button>
                  </div>

                  {/* Lyric */}
                  {!selectedEvent.isRest && (
                    <div className="rounded-lg bg-[#1E222A] border border-white/6 p-3 space-y-1.5">
                      <label className="text-[11px] text-slate-400 block">Lyric Syllable</label>
                      <input
                        type="text"
                        value={selectedEvent.lyric || ''}
                        onChange={(e) => onSetSelectedLyric(e.target.value)}
                        placeholder="e.g. Hal-le-lu-jah"
                        className="w-full h-8 px-2.5 rounded bg-[#14171C] border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Measure Context Inspector */}
            {measureCtx && (
              <section className="pt-3 border-t border-white/8 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200">
                    Measure {activeMeasureIdx + 1}
                  </h3>
                  <span className="text-[11px] font-mono-tabular text-slate-400">
                    {measureCtx.beats}/{measureCtx.beatType} · {measureCtx.clef}
                  </span>
                </div>
                <div className="rounded-lg bg-[#1E222A] border border-white/6 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Key</span>
                    <span>
                      {KEY_SIGNATURE_LIST.find((k) => k.fifths === measureCtx.keyFifths)?.label ||
                        'C Major'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-400 shrink-0">Measure Tempo</label>
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
                      className="w-20 h-7 px-2 rounded bg-[#14171C] border border-white/10 font-mono-tabular text-right text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          /* Score Metadata & Parts Mixer */
          <div className="space-y-5">
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-200">Score Details</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={score.title}
                    onChange={(e) => onUpdateScoreMeta({ title: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-[#14171C] border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={score.subtitle}
                    onChange={(e) => onUpdateScoreMeta({ subtitle: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-[#14171C] border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Composer</label>
                  <input
                    type="text"
                    value={score.composer}
                    onChange={(e) => onUpdateScoreMeta({ composer: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-[#14171C] border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </section>

            <section className="pt-3 border-t border-white/8 space-y-3">
              <h3 className="text-xs font-semibold text-slate-200">Instruments &amp; Mixer</h3>

              <div className="space-y-2">
                {score.parts.map((part, pIdx) => (
                  <div
                    key={part.id}
                    className="rounded-lg bg-[#1E222A] border border-white/6 p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) =>
                          onUpdatePartMixer(pIdx, { name: e.target.value })
                        }
                        className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none border-b border-transparent focus:border-blue-500 min-w-0 flex-1"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdatePartMixer(pIdx, { muted: !part.muted })}
                          title="Mute"
                          className={`h-6 w-6 rounded flex items-center justify-center text-[11px] ${
                            part.muted
                              ? 'bg-rose-600/80 text-white'
                              : 'bg-white/6 text-slate-300 hover:bg-white/12'
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
                              : 'bg-white/6 text-slate-300 hover:bg-white/12'
                          }`}
                        >
                          S
                        </button>
                        {score.parts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveInstrumentPart(pIdx)}
                            title="Remove Part"
                            className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/6"
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
                      <span className="font-mono-tabular text-[11px] text-slate-400 w-8 text-right">
                        {Math.round(part.volume * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[11px] text-slate-400">Linked Guitar TAB</span>
                      <button
                        type="button"
                        onClick={() => onUpdatePartMixer(pIdx, { showTab: !part.showTab })}
                        className={`h-6 px-2.5 rounded text-[11px] font-medium transition-colors ${
                          part.showTab
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/6 text-slate-300 hover:bg-white/12'
                        }`}
                      >
                        {part.showTab ? 'Shown' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="flex-1 h-8 px-2 rounded bg-[#14171C] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
