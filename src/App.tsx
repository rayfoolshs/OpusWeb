import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  FilePlus2,
  FolderOpen,
  Keyboard,
  Pause,
  Play,
  Repeat,
  SkipBack,
  Square,
  Timer,
} from 'lucide-react';
import {
  AccidentalType,
  ArticulationType,
  BarlineType,
  ClefType,
  DurationType,
  DynamicType,
  EditorToolState,
  NoteStep,
  Pitch,
  ScoreDocument,
  SelectionTarget,
  VoiceEvent,
} from './types/score';
import {
  accidentalTypeToAlter,
  alterToAccidentalType,
  assignTabPositions,
  cloneScore,
  createEmptyMeasure,
  createMeasureRest,
  createNoteHead,
  getEffectiveMeasureContext,
  getKeySignatureAlterMap,
  getMeasureCapacityBeats,
  getTabConfig,
  getValidTabPositions,
  midiToPitch,
  pitchToMidi,
  replaceEventInMeasureVoice,
  supportsGuitarTab,
  tabPositionToWrittenPitch,
  transposeDiatonic,
  uid,
} from './utils/musicTheory';
import { importScoreFromBuffer } from './utils/scoreParsers';
import {
  exportToMidiBytes,
  exportToMscx,
  exportToMsczBlob,
  exportToMusicXml,
  triggerBlobDownload,
} from './utils/scoreExporters';
import {
  INSTRUMENT_PRESETS,
  NewScoreOptions,
  STARTER_SCORES,
  createBlankScore,
  createMinuetInG,
} from './utils/starterScores';
import { synthEngine } from './audio/synthEngine';
import { APP_AUTHOR, APP_VERSION } from './version';
import { ThemeMode, ThemeSlider } from './components/ThemeSlider';
import { ToolbarRibbon } from './components/ToolbarRibbon';
import { PaletteSidebar } from './components/PaletteSidebar';
import { ScoreCanvas } from './components/ScoreCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import {
  ExportModal,
  NewScoreModal,
  OpenScoreModal,
  ShortcutsModal,
} from './components/Modals';

const STORAGE_RECENT_KEY = 'opusweb_recent_scores_v1';
const STORAGE_ACTIVE_KEY = 'opusweb_active_score_v1';
const STORAGE_THEME_KEY = 'opusweb_theme_v1';

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage error
  }
  return 'dark';
}

export default function App() {
  const [score, setScore] = useState<ScoreDocument>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ScoreDocument;
        if (parsed?.parts?.length) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return createMinuetInG();
  });

  const [history, setHistory] = useState<ScoreDocument[]>([]);
  const [redoStack, setRedoStack] = useState<ScoreDocument[]>([]);

  const [recentScores, setRecentScores] = useState<ScoreDocument[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_RECENT_KEY);
      if (raw) return JSON.parse(raw) as ScoreDocument[];
    } catch {
      // Ignore
    }
    return [];
  });

  const [selection, setSelection] = useState<SelectionTarget | null>({
    partIndex: 0,
    staffIndex: 0,
    measureIndex: 0,
    voiceIndex: 0,
    eventId: null,
  });

  const [toolState, setToolState] = useState<EditorToolState>({
    noteInputMode: false,
    duration: 'quarter',
    dots: 0,
    accidental: null,
    isRestMode: false,
    tieActive: false,
    voiceIndex: 0,
    chordMode: false,
  });

  const [zoom, setZoom] = useState(1);
  const [pageView, setPageView] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  const [isPlaying, setIsPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [loop, setLoop] = useState(false);
  const [playhead, setPlayhead] = useState<{ measureIndex: number; beatInMeasure: number } | null>(null);

  const [openModalVisible, setOpenModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [newModalVisible, setNewModalVisible] = useState(false);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error' } | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  // Accumulates digits typed on the TAB staff so frets like 12 can be entered quickly
  const tabFretBufferRef = useRef<{ digits: string; at: number }>({ digits: '', at: 0 });

  const showToast = useCallback((msg: string, type: 'info' | 'error' = 'info') => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  // Persist active score & recent scores in single-user local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(score));
      setRecentScores((prev) => {
        const filtered = prev.filter((s) => s.id !== score.id);
        const next = [score, ...filtered].slice(0, 8);
        localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      // Ignore quota exceeded
    }
  }, [score]);

  // Sync synth options
  useEffect(() => {
    synthEngine.setOptions({ metronome, loop });
  }, [metronome, loop]);

  // Warm up the sampled GM instruments for the current score
  useEffect(() => {
    synthEngine.preloadScore(score);
  }, [score]);

  // Apply & persist the light/dark studio theme
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignore storage error
    }
  }, [theme]);

  const commitScoreChange = useCallback(
    (updater: (draft: ScoreDocument) => void) => {
      setScore((prev) => {
        const snapshot = cloneScore(prev);
        setHistory((h) => [...h.slice(-39), snapshot]);
        setRedoStack([]);
        const next = cloneScore(prev);
        updater(next);
        next.updatedAt = Date.now();
        return next;
      });
    },
    []
  );

  const loadNewDocument = useCallback((doc: ScoreDocument) => {
    synthEngine.stop();
    setIsPlaying(false);
    setPlayhead(null);
    setHistory([]);
    setRedoStack([]);
    setScore(doc);
    const firstEv = doc.parts[0]?.staves[0]?.measures[0]?.voices[0]?.[0]?.id || null;
    setSelection({
      partIndex: 0,
      staffIndex: 0,
      measureIndex: 0,
      voiceIndex: 0,
      eventId: firstEv,
    });
  }, []);

  // Support opening directly from ?scoreUrl=... query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('scoreUrl');
    if (urlParam) {
      void (async () => {
        try {
          const resp = await fetch(`/api/fetch-score?url=${encodeURIComponent(urlParam)}`);
          if (!resp.ok) throw new Error('Failed to load linked score');
          const fn = resp.headers.get('X-Score-Filename') || urlParam.split('/').pop() || 'linked.musicxml';
          const buf = await resp.arrayBuffer();
          const doc = await importScoreFromBuffer(buf, fn, 'Web Link');
          loadNewDocument(doc);
          showToast(`Loaded "${doc.title}" from web link`);
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Failed to load web link', 'error');
        }
      })();
    }
  }, [loadNewDocument, showToast]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedoStack((r) => [...r, cloneScore(score)]);
    setScore(prev);
  }, [history, score]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistory((h) => [...h, cloneScore(score)]);
    setScore(next);
  }, [redoStack, score]);

  const handlePlayToggle = useCallback(() => {
    if (synthEngine.getIsPlaying()) {
      synthEngine.stop();
      setIsPlaying(false);
      setPlayhead(null);
      return;
    }
    const startMeasure = selection?.measureIndex ?? 0;
    setIsPlaying(true);
    synthEngine.start(score, startMeasure, (mIdx, beatInM, playing) => {
      if (!playing) {
        setIsPlaying(false);
        setPlayhead(null);
      } else {
        setPlayhead({ measureIndex: mIdx, beatInMeasure: beatInM });
      }
    });
  }, [score, selection]);

  const handleStop = useCallback(() => {
    synthEngine.stop();
    setIsPlaying(false);
    setPlayhead(null);
  }, []);

  const handleRewind = useCallback(() => {
    const wasPlaying = synthEngine.getIsPlaying();
    synthEngine.stop();
    setPlayhead(null);
    setSelection((prev) => ({
      partIndex: prev?.partIndex ?? 0,
      staffIndex: prev?.staffIndex ?? 0,
      measureIndex: 0,
      voiceIndex: prev?.voiceIndex ?? 0,
      eventId: score.parts[0]?.staves[0]?.measures[0]?.voices[0]?.[0]?.id ?? null,
    }));
    if (wasPlaying) {
      setIsPlaying(true);
      synthEngine.start(score, 0, (mIdx, beatInM, playing) => {
        if (!playing) {
          setIsPlaying(false);
          setPlayhead(null);
        } else {
          setPlayhead({ measureIndex: mIdx, beatInMeasure: beatInM });
        }
      });
    } else {
      setIsPlaying(false);
    }
  }, [score]);

  // Select an event & audition its pitch
  const handleSelectEvent = useCallback(
    (target: SelectionTarget) => {
      setSelection(target);
      const part = score.parts[target.partIndex];
      const ev = part?.staves[target.staffIndex]?.measures[target.measureIndex]?.voices[target.voiceIndex]?.find(
        (e) => e.id === target.eventId
      );
      if (ev && !ev.isRest && ev.notes.length > 0) {
        ev.notes.forEach((n) => synthEngine.auditionPitch(n.pitch, part.timbre, 0.35, part.program, part.drumKit));
      }
    },
    [score]
  );

  // Navigate left/right through events
  const moveSelection = useCallback(
    (dir: -1 | 1) => {
      const pIdx = selection?.partIndex ?? 0;
      const sIdx = selection?.staffIndex ?? 0;
      const vIdx = selection?.voiceIndex ?? 0;
      const staff = score.parts[pIdx]?.staves[sIdx];
      if (!staff) return;

      const flat: { measureIndex: number; eventId: string }[] = [];
      staff.measures.forEach((m, mIdx) => {
        const voice = m.voices[vIdx] || m.voices[0] || [];
        voice.forEach((ev) => flat.push({ measureIndex: mIdx, eventId: ev.id }));
      });
      if (flat.length === 0) return;

      const curIdx = selection?.eventId
        ? flat.findIndex((x) => x.eventId === selection.eventId)
        : -1;
      const nextIdx =
        curIdx === -1
          ? 0
          : Math.max(0, Math.min(flat.length - 1, curIdx + dir));
      const target = flat[nextIdx];
      handleSelectEvent({
        partIndex: pIdx,
        staffIndex: sIdx,
        measureIndex: target.measureIndex,
        voiceIndex: vIdx,
        eventId: target.eventId,
        source: selection?.source,
      });
    },
    [score, selection, handleSelectEvent]
  );

  // Insert or replace a note/chord/rest at target slot and advance cursor
  const handleInsertOrReplaceNote = useCallback(
    (
      partIndex: number,
      staffIndex: number,
      measureIndex: number,
      voiceIndex: number,
      targetEventId: string | null,
      pitch: Pitch
    ) => {
      const part = score.parts[partIndex];
      const staff = part?.staves[staffIndex];
      const measure = staff?.measures[measureIndex];
      if (!part || !staff || !measure) return;

      const eff = getEffectiveMeasureContext(part, staffIndex, measureIndex, score.defaultTempo);
      const cap = getMeasureCapacityBeats(eff.beats, eff.beatType);

      if (!toolState.isRestMode) {
        synthEngine.auditionPitch(pitch, part.timbre, 0.4, part.program, part.drumKit);
      }

      let nextSelectionEventId: string | null = null;
      let nextMeasureIndex = measureIndex;

      commitScoreChange((draft) => {
        const dPart = draft.parts[partIndex];
        const dStaff = dPart.staves[staffIndex];
        const dMeasure = dStaff.measures[measureIndex];
        while (dMeasure.voices.length <= voiceIndex) {
          dMeasure.voices.push(createMeasureRest(cap));
        }

        const voice = dMeasure.voices[voiceIndex];
        const effectiveTargetId = targetEventId || voice[0]?.id;
        if (!effectiveTargetId) return;

        // Chord stacking mode: add notehead onto existing note
        if (toolState.chordMode && !toolState.isRestMode) {
          const existing = voice.find((e) => e.id === effectiveTargetId);
          if (existing && !existing.isRest) {
            const exists = existing.notes.some((n) => pitchToMidi(n.pitch) === pitchToMidi(pitch));
            if (!exists) {
              existing.notes.push(createNoteHead(pitch, toolState.tieActive));
            }
            nextSelectionEventId = existing.id;
            return;
          }
        }

        const createdId = uid(toolState.isRestMode ? 'rest' : 'ev');
        const newEv: VoiceEvent = {
          id: createdId,
          isRest: toolState.isRestMode,
          duration: toolState.duration,
          dots: toolState.dots,
          notes: toolState.isRestMode ? [] : [createNoteHead(pitch, toolState.tieActive)],
        };

        const updatedVoice = replaceEventInMeasureVoice(voice, effectiveTargetId, newEv, cap);
        dMeasure.voices[voiceIndex] = updatedVoice;

        // Advance cursor to next slot in measure or first slot of next measure
        const newIdx = updatedVoice.findIndex((e) => e.id === createdId);
        if (newIdx !== -1 && newIdx + 1 < updatedVoice.length) {
          nextSelectionEventId = updatedVoice[newIdx + 1].id;
        } else if (measureIndex + 1 < dStaff.measures.length) {
          nextMeasureIndex = measureIndex + 1;
          nextSelectionEventId = dStaff.measures[measureIndex + 1].voices[voiceIndex]?.[0]?.id || null;
        } else {
          nextSelectionEventId = createdId;
        }
      });

      setSelection({
        partIndex,
        staffIndex,
        measureIndex: nextMeasureIndex,
        voiceIndex,
        eventId: nextSelectionEventId,
      });
    },
    [score, toolState, commitScoreChange]
  );

  // Selected note/measure mutation helpers
  const transposeSelected = useCallback(
    (mode: 'diatonic' | 'chromatic' | 'octave', delta: number) => {
      if (!selection?.eventId) return;
      const part = score.parts[selection.partIndex];
      const eff = part
        ? getEffectiveMeasureContext(part, selection.staffIndex, selection.measureIndex, score.defaultTempo)
        : { keyFifths: 0 };

      commitScoreChange((draft) => {
        const dPart = draft.parts[selection.partIndex];
        const ev = dPart?.staves[selection.staffIndex]?.measures[selection.measureIndex]?.voices[
          selection.voiceIndex
        ]?.find((e) => e.id === selection.eventId);
        if (!ev || ev.isRest) return;

        ev.notes.forEach((nh) => {
          if (mode === 'diatonic') {
            nh.pitch = transposeDiatonic(nh.pitch, delta, eff.keyFifths);
          } else if (mode === 'octave') {
            nh.pitch = {
              ...nh.pitch,
              octave: Math.max(1, Math.min(7, nh.pitch.octave + delta)),
            };
          } else {
            nh.pitch = midiToPitch(pitchToMidi(nh.pitch) + delta, eff.keyFifths);
          }
          nh.tabString = undefined;
          nh.tabFret = undefined;
          synthEngine.auditionPitch(nh.pitch, dPart.timbre, 0.35, dPart.program, dPart.drumKit);
        });
      });
    },
    [selection, score, commitScoreChange]
  );

  // Editing a TAB position (string + fret) rewrites the notation pitch above it
  const setSelectedGuitarTabPosition = useCallback(
    (noteIndex: number, tabString: number, tabFret: number) => {
      if (!selection?.eventId) return;
      const part = score.parts[selection.partIndex];
      if (!part) return;
      const tabConfig = getTabConfig(part);
      if (!tabConfig) return;
      const eff = getEffectiveMeasureContext(
        part,
        selection.staffIndex,
        selection.measureIndex,
        score.defaultTempo
      );
      const str = Math.max(1, Math.min(tabConfig.strings, Math.round(tabString)));
      const fret = Math.max(0, Math.min(24, Math.round(tabFret)));
      const nextPitch = tabPositionToWrittenPitch(str, fret, tabConfig, eff.keyFifths);

      synthEngine.auditionPitch(nextPitch, part.timbre, 0.35, part.program, part.drumKit);

      commitScoreChange((draft) => {
        const ev = draft.parts[selection.partIndex]?.staves[selection.staffIndex]?.measures[
          selection.measureIndex
        ]?.voices[selection.voiceIndex]?.find((e) => e.id === selection.eventId);
        if (!ev || ev.isRest) return;
        const note = ev.notes[noteIndex];
        if (!note) return;
        note.pitch = nextPitch;
        note.tabString = str;
        note.tabFret = fret;
      });
    },
    [selection, score, commitScoreChange]
  );

  // Apply a typed fret number to the selected TAB string (keeps the current string)
  const applySelectedTabFret = useCallback(
    (fret: number) => {
      if (!selection?.eventId) return;
      const part = score.parts[selection.partIndex];
      const ev = part?.staves[selection.staffIndex]?.measures[selection.measureIndex]?.voices[
        selection.voiceIndex
      ]?.find((e) => e.id === selection.eventId);
      if (!ev || ev.isRest || ev.notes.length === 0) return;

      const tabConfig = getTabConfig(part);
      if (!tabConfig) return;
      const candidateIdx = selection.noteIndex ?? -1;
      const noteIndex = candidateIdx >= 0 && candidateIdx < ev.notes.length ? candidateIdx : 0;
      const assigned = assignTabPositions(ev.notes, tabConfig).find(
        (p) => p.noteId === ev.notes[noteIndex].id
      );
      setSelectedGuitarTabPosition(noteIndex, assigned?.str ?? 1, fret);
    },
    [selection, score, setSelectedGuitarTabPosition]
  );

  // Digit buffer so "1" then "2" becomes fret 12 instead of two separate edits
  const typeTabFretDigit = useCallback(
    (digit: number) => {
      const now = Date.now();
      const buffer = tabFretBufferRef.current;
      const continuing = now - buffer.at < 900;
      let digits = `${continuing ? buffer.digits : ''}${digit}`.replace(/^0+(?=\d)/, '');
      let value = Number(digits);
      if (!Number.isFinite(value) || value > 24) {
        digits = String(digit);
        value = digit;
      }
      tabFretBufferRef.current = { digits, at: now };
      applySelectedTabFret(value);
    },
    [applySelectedTabFret]
  );

  const deleteSelectedEvent = useCallback(() => {
    if (!selection?.eventId) return;
    commitScoreChange((draft) => {
      const ev = draft.parts[selection.partIndex]?.staves[selection.staffIndex]?.measures[
        selection.measureIndex
      ]?.voices[selection.voiceIndex]?.find((e) => e.id === selection.eventId);
      if (!ev) return;
      ev.isRest = true;
      ev.notes = [];
      ev.articulations = undefined;
      ev.lyric = undefined;
    });
  }, [selection, commitScoreChange]);

  const handleSetSelectedDuration = useCallback(
    (dur: DurationType, dots: 0 | 1 = 0) => {
      if (!selection?.eventId) return;
      const part = score.parts[selection.partIndex];
      if (!part) return;
      const eff = getEffectiveMeasureContext(part, selection.staffIndex, selection.measureIndex, score.defaultTempo);
      const cap = getMeasureCapacityBeats(eff.beats, eff.beatType);

      commitScoreChange((draft) => {
        const measure = draft.parts[selection.partIndex]?.staves[selection.staffIndex]?.measures[selection.measureIndex];
        if (!measure) return;
        const voice = measure.voices[selection.voiceIndex];
        const existing = voice?.find((e) => e.id === selection.eventId);
        if (!existing) return;
        const replacement: VoiceEvent = {
          ...existing,
          duration: dur,
          dots,
          isMeasureRest: false,
        };
        measure.voices[selection.voiceIndex] = replaceEventInMeasureVoice(
          voice,
          existing.id,
          replacement,
          cap
        );
      });
    },
    [selection, score, commitScoreChange]
  );

  // Palette applications
  const applyClef = useCallback(
    (clef: ClefType) => {
      const pIdx = selection?.partIndex ?? 0;
      const sIdx = selection?.staffIndex ?? 0;
      const mIdx = selection?.measureIndex ?? 0;
      commitScoreChange((draft) => {
        const staff = draft.parts[pIdx]?.staves[sIdx];
        if (!staff) return;
        if (mIdx === 0) staff.clef = clef;
        if (staff.measures[mIdx]) staff.measures[mIdx].attributes.clef = clef;
      });
    },
    [selection, commitScoreChange]
  );

  const applyKeySignature = useCallback(
    (fifths: number) => {
      const mIdx = selection?.measureIndex ?? 0;
      commitScoreChange((draft) => {
        draft.parts.forEach((part) => {
          part.staves.forEach((staff) => {
            if (staff.measures[mIdx]) {
              staff.measures[mIdx].attributes.keyFifths = fifths;
            }
          });
        });
      });
    },
    [selection, commitScoreChange]
  );

  const applyTimeSignature = useCallback(
    (beats: number, beatType: number) => {
      const mIdx = selection?.measureIndex ?? 0;
      const newCap = getMeasureCapacityBeats(beats, beatType);
      commitScoreChange((draft) => {
        draft.parts.forEach((part) => {
          part.staves.forEach((staff) => {
            const meas = staff.measures[mIdx];
            if (meas) {
              meas.attributes.timeSignature = { beats, beatType };
              // If measure only contains rests, re-fit to new capacity
              if (meas.voices[0]?.every((e) => e.isRest)) {
                meas.voices[0] = createMeasureRest(newCap);
              }
            }
          });
        });
      });
    },
    [selection, commitScoreChange]
  );

  const applyDynamic = useCallback(
    (dyn: DynamicType) => {
      if (!selection?.eventId) {
        showToast('Select a note first to attach a dynamic marking');
        return;
      }
      commitScoreChange((draft) => {
        const ev = draft.parts[selection.partIndex]?.staves[selection.staffIndex]?.measures[
          selection.measureIndex
        ]?.voices[selection.voiceIndex]?.find((e) => e.id === selection.eventId);
        if (ev) {
          ev.dynamic = ev.dynamic === dyn ? undefined : dyn;
        }
      });
    },
    [selection, commitScoreChange, showToast]
  );

  const applyArticulation = useCallback(
    (art: ArticulationType) => {
      if (!selection?.eventId) {
        showToast('Select a note first to toggle an articulation');
        return;
      }
      commitScoreChange((draft) => {
        const ev = draft.parts[selection.partIndex]?.staves[selection.staffIndex]?.measures[
          selection.measureIndex
        ]?.voices[selection.voiceIndex]?.find((e) => e.id === selection.eventId);
        if (ev && !ev.isRest) {
          const list = ev.articulations || [];
          ev.articulations = list.includes(art)
            ? list.filter((a) => a !== art)
            : [...list, art];
        }
      });
    },
    [selection, commitScoreChange, showToast]
  );

  const applyBarline = useCallback(
    (bar: BarlineType) => {
      const mIdx = selection?.measureIndex ?? (score.parts[0]?.staves[0]?.measures.length || 1) - 1;
      commitScoreChange((draft) => {
        draft.parts.forEach((part) => {
          part.staves.forEach((staff) => {
            const meas = staff.measures[mIdx];
            if (meas) {
              if (bar === 'repeat-begin') {
                meas.attributes.barlineLeft = bar;
              } else {
                meas.attributes.barlineRight = bar;
              }
            }
          });
        });
      });
    },
    [selection, score, commitScoreChange]
  );

  const applyTempo = useCallback(
    (bpm: number) => {
      const mIdx = selection?.measureIndex ?? 0;
      commitScoreChange((draft) => {
        if (mIdx === 0) draft.defaultTempo = bpm;
        const meas = draft.parts[0]?.staves[0]?.measures[mIdx];
        if (meas) meas.attributes.tempo = bpm;
      });
    },
    [selection, commitScoreChange]
  );

  // Chord leadsheet: symbols attach to the lead staff's measure and play as block chords
  const handleAddChord = useCallback(
    (measureIndex: number, beat: number, symbol: string) => {
      const trimmed = symbol.trim();
      if (!trimmed) return;
      commitScoreChange((draft) => {
        const measure = draft.parts[0]?.staves[0]?.measures[measureIndex];
        if (!measure) return;
        const chords = measure.chordSymbols ? [...measure.chordSymbols] : [];
        const existingIndex = chords.findIndex((c) => Math.abs(c.beat - beat) < 0.01);
        const nextChord = {
          id: existingIndex >= 0 ? chords[existingIndex].id : uid('chord'),
          beat,
          symbol: trimmed,
        };
        if (existingIndex >= 0) {
          chords[existingIndex] = nextChord;
        } else {
          chords.push(nextChord);
        }
        measure.chordSymbols = chords.sort((a, b) => a.beat - b.beat);
      });
      showToast(`Added chord ${trimmed}`);
    },
    [commitScoreChange, showToast]
  );

  const handleRemoveChord = useCallback(
    (measureIndex: number, chordId: string) => {
      commitScoreChange((draft) => {
        const measure = draft.parts[0]?.staves[0]?.measures[measureIndex];
        if (!measure?.chordSymbols) return;
        const remaining = measure.chordSymbols.filter((chord) => chord.id !== chordId);
        measure.chordSymbols = remaining.length > 0 ? remaining : undefined;
      });
    },
    [commitScoreChange]
  );

  // Measure Add / Delete
  const handleAddMeasure = useCallback(() => {
    commitScoreChange((draft) => {
      draft.parts.forEach((part) => {
        part.staves.forEach((staff, sIdx) => {
          const lastIdx = Math.max(0, staff.measures.length - 1);
          const ctx = getEffectiveMeasureContext(part, sIdx, lastIdx, draft.defaultTempo);
          if (staff.measures[lastIdx]?.attributes.barlineRight === 'end') {
            staff.measures[lastIdx].attributes.barlineRight = 'single';
          }
          const m = createEmptyMeasure(ctx.beats, ctx.beatType, false);
          m.attributes.barlineRight = 'end';
          staff.measures.push(m);
        });
      });
    });
    showToast('Added measure to end of score');
  }, [commitScoreChange, showToast]);

  const handleDeleteMeasure = useCallback(() => {
    const total = score.parts[0]?.staves[0]?.measures.length || 0;
    if (total <= 1) {
      showToast('Score must contain at least one measure', 'error');
      return;
    }
    const targetIdx = selection?.measureIndex ?? total - 1;
    commitScoreChange((draft) => {
      draft.parts.forEach((part) => {
        part.staves.forEach((staff) => {
          staff.measures.splice(targetIdx, 1);
          if (targetIdx === 0 && staff.measures[0]) {
            staff.measures[0].attributes.clef = staff.clef;
            staff.measures[0].attributes.timeSignature =
              staff.measures[0].attributes.timeSignature || { beats: 4, beatType: 4 };
          }
        });
      });
    });
    setSelection((prev) =>
      prev
        ? {
            ...prev,
            measureIndex: Math.max(0, Math.min(total - 2, targetIdx)),
            eventId: null,
          }
        : null
    );
  }, [score, selection, commitScoreChange, showToast]);

  // Global Keyboard Shortcuts (MuseScore workflow)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayToggle();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        setToolState((t) => ({ ...t, noteInputMode: !t.noteInputMode }));
        return;
      }

      // Typing a number on a selected TAB fret edits that fret (MuseScore-style)
      if (/^[0-9]$/.test(e.key) && selection?.source === 'tab' && selection.eventId) {
        const tabPart = score.parts[selection.partIndex];
        if (tabPart?.showTab && supportsGuitarTab(tabPart)) {
          e.preventDefault();
          typeTabFretDigit(Number(e.key));
          return;
        }
      }

      const durMap: Record<string, DurationType> = {
        '1': 'whole',
        '2': 'half',
        '3': 'quarter',
        '4': 'eighth',
        '5': '16th',
        '6': '32nd',
      };
      if (durMap[key]) {
        e.preventDefault();
        setToolState((t) => ({ ...t, duration: durMap[key], isRestMode: false }));
        if (!toolState.noteInputMode && selection?.eventId) {
          handleSetSelectedDuration(durMap[key], toolState.dots);
        }
        return;
      }

      if (key === '.') {
        e.preventDefault();
        setToolState((t) => ({ ...t, dots: t.dots === 1 ? 0 : 1 }));
        return;
      }

      if (key === 'r' || key === '0') {
        e.preventDefault();
        if (toolState.noteInputMode && selection) {
          handleInsertOrReplaceNote(
            selection.partIndex,
            selection.staffIndex,
            selection.measureIndex,
            toolState.voiceIndex,
            selection.eventId,
            { step: 'B', alter: 0, octave: 4 }
          );
        } else {
          setToolState((t) => ({ ...t, isRestMode: !t.isRestMode }));
        }
        return;
      }

      if (key === 't') {
        e.preventDefault();
        setToolState((t) => ({ ...t, tieActive: !t.tieActive }));
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveSelection(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveSelection(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        transposeSelected(e.shiftKey ? 'octave' : 'diatonic', 1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        transposeSelected(e.shiftKey ? 'octave' : 'diatonic', -1);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedEvent();
        return;
      }

      // Direct letter pitch entry A-G when in Note Input Mode or when a slot is selected
      if (/^[a-g]$/.test(key) && (toolState.noteInputMode || selection?.eventId)) {
        e.preventDefault();
        const step = key.toUpperCase() as NoteStep;
        const pIdx = selection?.partIndex ?? 0;
        const sIdx = selection?.staffIndex ?? 0;
        const mIdx = selection?.measureIndex ?? 0;
        const part = score.parts[pIdx];
        if (!part) return;
        const eff = getEffectiveMeasureContext(part, sIdx, mIdx, score.defaultTempo);
        const keyMap = getKeySignatureAlterMap(eff.keyFifths);
        const octave = eff.clef === 'bass' ? 3 : 4;
        const alter = toolState.accidental
          ? accidentalTypeToAlter(toolState.accidental)
          : keyMap[step];

        handleInsertOrReplaceNote(
          pIdx,
          sIdx,
          mIdx,
          toolState.voiceIndex,
          selection?.eventId ?? null,
          {
            step,
            alter,
            octave,
            accidental: toolState.accidental || undefined,
          }
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handlePlayToggle,
    moveSelection,
    transposeSelected,
    deleteSelectedEvent,
    handleSetSelectedDuration,
    handleInsertOrReplaceNote,
    typeTabFretDigit,
    toolState,
    selection,
    score,
  ]);

  // Local File & Web Link Import handlers
  const handleImportLocalFile = useCallback(
    async (file: File) => {
      const buf = await file.arrayBuffer();
      const doc = await importScoreFromBuffer(buf, file.name, 'Local File');
      loadNewDocument(doc);
      showToast(`Imported "${doc.title}"`);
    },
    [loadNewDocument, showToast]
  );

  const handleImportWebUrl = useCallback(
    async (url: string) => {
      const resp = await fetch(`/api/fetch-score?url=${encodeURIComponent(url)}`);
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(errBody.error || `HTTP ${resp.status}`);
      }
      const filename =
        resp.headers.get('X-Score-Filename') || url.split('/').pop() || 'web-score.musicxml';
      const buf = await resp.arrayBuffer();
      const doc = await importScoreFromBuffer(buf, filename, 'Web Link');
      loadNewDocument(doc);
      showToast(`Loaded "${doc.title}" from web link`);
    },
    [loadNewDocument, showToast]
  );

  // Export handler
  const handleExport = useCallback(
    async (format: 'mscz' | 'mscx' | 'musicxml' | 'mid' | 'json' | 'print') => {
      const safeName = (score.title || 'score').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
      if (format === 'print') {
        window.print();
        return;
      }
      if (format === 'mscz') {
        const blob = await exportToMsczBlob(score);
        triggerBlobDownload(blob, `${safeName}.mscz`);
        showToast(`Exported ${safeName}.mscz`);
        return;
      }
      if (format === 'mscx') {
        const xml = exportToMscx(score);
        triggerBlobDownload(new Blob([xml], { type: 'application/xml' }), `${safeName}.mscx`);
        showToast(`Exported ${safeName}.mscx`);
        return;
      }
      if (format === 'musicxml') {
        const xml = exportToMusicXml(score);
        triggerBlobDownload(
          new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }),
          `${safeName}.musicxml`
        );
        showToast(`Exported ${safeName}.musicxml`);
        return;
      }
      if (format === 'mid') {
        const bytes = exportToMidiBytes(score);
        triggerBlobDownload(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/midi' }), `${safeName}.mid`);
        showToast(`Exported ${safeName}.mid`);
        return;
      }
      if (format === 'json') {
        triggerBlobDownload(
          new Blob([JSON.stringify(score, null, 2)], { type: 'application/json' }),
          `${safeName}.opusweb.json`
        );
        showToast(`Exported ${safeName}.opusweb.json`);
      }
    },
    [score, showToast]
  );

  const activeMeasureIdx = playhead?.measureIndex ?? selection?.measureIndex ?? 0;
  const activeBeatDisplay = playhead ? Math.floor(playhead.beatInMeasure) + 1 : 1;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--bg-app)] text-[var(--text-strong)]">
      {/* Top Bar: Clean 3-Zone Studio Contract */}
      <header className="no-print h-13 bg-[var(--bg-app)] border-b border-[var(--border)] px-4 flex items-center justify-between gap-8 shrink-0">
        {/* Zone 1: Single-line Brand & Active Score Title */}
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-base font-bold tracking-tight text-[var(--text-strong)] whitespace-nowrap shrink-0">
            OpusWeb
          </span>
          <span className="text-[10px] font-mono-tabular text-[var(--text-faint)] whitespace-nowrap shrink-0">
            v{APP_VERSION}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap shrink-0 hidden sm:inline">
            by {APP_AUTHOR}
          </span>
          <span className="text-[var(--text-faint)] select-none" aria-hidden="true">
            /
          </span>
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <span className="font-medium text-[var(--text-strong)] truncate max-w-[220px]">
              {score.title}
            </span>
            {score.sourceLabel && (
              <>
                <span className="text-[var(--text-faint)] hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="text-[var(--text-muted)] hidden sm:inline whitespace-nowrap">
                  {score.sourceLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Zone 2: Audio Transport & Tempo */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-2 py-1 shrink-0">
          <button
            type="button"
            onClick={handleRewind}
            title="Rewind to Start"
            className="h-7 w-7 rounded flex items-center justify-center text-[var(--text)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)] transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePlayToggle}
            title="Play / Pause (Space)"
            className={`h-7 px-2.5 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              isPlaying
                ? 'bg-blue-600 text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-strong)] hover:bg-blue-600 hover:text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={handleStop}
            title="Stop"
            className="h-7 w-7 rounded flex items-center justify-center text-[var(--text)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)] transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[var(--surface-hover)] mx-1" />

          <button
            type="button"
            onClick={() => setMetronome((m) => !m)}
            title="Toggle Metronome Click"
            className={`h-7 px-2 rounded flex items-center gap-1 text-xs transition-colors whitespace-nowrap ${
              metronome ? 'bg-blue-600/25 text-[var(--accent-text-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Click</span>
          </button>
          <button
            type="button"
            onClick={() => setLoop((l) => !l)}
            title="Toggle Loop Playback"
            className={`h-7 w-7 rounded flex items-center justify-center transition-colors ${
              loop ? 'bg-blue-600/25 text-[var(--accent-text-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[var(--surface-hover)] mx-1" />

          <div className="flex items-center gap-1 text-xs font-mono-tabular text-[var(--text)] px-1 whitespace-nowrap">
            <span className="text-[var(--text-faint)]">m.{activeMeasureIdx + 1}</span>
            <span className="text-[var(--text-faint)]">·</span>
            <span className="text-[var(--text-muted)]">b.{activeBeatDisplay}</span>
            <span className="text-[var(--text-faint)] mx-1">|</span>
            <span>♩=</span>
            <input
              type="number"
              min={30}
              max={260}
              value={score.defaultTempo}
              onChange={(e) => {
                const bpm = Math.max(30, Math.min(260, Number(e.target.value) || 120));
                commitScoreChange((d) => {
                  d.defaultTempo = bpm;
                });
              }}
              className="w-11 bg-transparent text-right font-mono-tabular text-[var(--text-strong)] focus:outline-none border-b border-transparent focus:border-blue-500"
            />
          </div>
        </div>

        {/* Zone 3: Primary File & Export Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeSlider theme={theme} onChange={setTheme} />
          <button
            type="button"
            onClick={() => setShortcutsVisible(true)}
            title="Keyboard Shortcuts"
            className="h-8 w-8 rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)] flex items-center justify-center transition-colors"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setNewModalVisible(true)}
            className="h-8 px-3 rounded-md bg-[var(--surface-soft)] hover:bg-[var(--surface-hover)] text-xs font-medium text-[var(--text-strong)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenModalVisible(true)}
            className="h-8 px-3 rounded-md bg-[var(--surface-soft)] hover:bg-[var(--surface-hover)] text-xs font-medium text-[var(--text-strong)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open / Import</span>
          </button>
          <button
            type="button"
            onClick={() => setExportModalVisible(true)}
            className="h-8 px-3.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Note Input Ribbon */}
      <ToolbarRibbon
        toolState={toolState}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
        zoom={zoom}
        pageView={pageView}
        onToggleNoteInput={() =>
          setToolState((t) => ({ ...t, noteInputMode: !t.noteInputMode }))
        }
        onSelectDuration={(dur) => {
          setToolState((t) => ({ ...t, duration: dur }));
          if (!toolState.noteInputMode && selection?.eventId) {
            handleSetSelectedDuration(dur, toolState.dots);
          }
        }}
        onToggleDot={() => {
          const nextDots: 0 | 1 = toolState.dots === 1 ? 0 : 1;
          setToolState((t) => ({ ...t, dots: nextDots }));
          if (!toolState.noteInputMode && selection?.eventId) {
            handleSetSelectedDuration(toolState.duration, nextDots);
          }
        }}
        onToggleRestMode={() => setToolState((t) => ({ ...t, isRestMode: !t.isRestMode }))}
        onToggleTie={() => setToolState((t) => ({ ...t, tieActive: !t.tieActive }))}
        onSelectAccidental={(acc) => setToolState((t) => ({ ...t, accidental: acc }))}
        onSelectVoice={(v) => setToolState((t) => ({ ...t, voiceIndex: v }))}
        onToggleChordMode={() => setToolState((t) => ({ ...t, chordMode: !t.chordMode }))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAddMeasure={handleAddMeasure}
        onDeleteMeasure={handleDeleteMeasure}
        onZoomChange={setZoom}
        onTogglePageView={() => setPageView((v) => !v)}
      />

      {/* 3-Pane Studio Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <PaletteSidebar
          onApplyClef={applyClef}
          onApplyKeySignature={applyKeySignature}
          onApplyTimeSignature={applyTimeSignature}
          onApplyDynamic={applyDynamic}
          onApplyArticulation={applyArticulation}
          onApplyBarline={applyBarline}
          onApplyTempo={applyTempo}
        />

        <ScoreCanvas
          score={score}
          selection={selection}
          toolState={toolState}
          zoom={zoom}
          pageView={pageView}
          isPlaying={isPlaying}
          playhead={playhead}
          onSelectEvent={handleSelectEvent}
          onSelectMeasure={(pIdx, sIdx, mIdx) =>
            setSelection({
              partIndex: pIdx,
              staffIndex: sIdx,
              measureIndex: mIdx,
              voiceIndex: toolState.voiceIndex,
              eventId: null,
            })
          }
          onInsertOrReplaceNote={handleInsertOrReplaceNote}
          onFileDrop={(file) => {
            void handleImportLocalFile(file).catch((err: unknown) =>
              showToast(err instanceof Error ? err.message : 'Failed to parse dropped file', 'error')
            );
          }}
        />

        <InspectorPanel
          score={score}
          selection={selection}
          onUpdateScoreMeta={(patch) =>
            commitScoreChange((d) => {
              Object.assign(d, patch);
            })
          }
          onTransposeSelectedNote={transposeSelected}
          onSetSelectedAccidental={(acc: AccidentalType | null) => {
            if (!selection?.eventId) return;
            commitScoreChange((draft) => {
              const part = draft.parts[selection.partIndex];
              const ev = part?.staves[selection.staffIndex]?.measures[selection.measureIndex]?.voices[
                selection.voiceIndex
              ]?.find((e) => e.id === selection.eventId);
              if (!ev || ev.isRest) return;
              ev.notes.forEach((n) => {
                const newAlter = acc ? accidentalTypeToAlter(acc) : 0;
                n.pitch.alter = newAlter;
                n.pitch.accidental = acc || alterToAccidentalType(newAlter) || 'natural';
                n.tabString = undefined;
                n.tabFret = undefined;
              });
            });
          }}
          onSetSelectedDuration={handleSetSelectedDuration}
          onToggleSelectedTie={() => {
            if (!selection?.eventId) return;
            commitScoreChange((draft) => {
              const ev = draft.parts[selection.partIndex]?.staves[selection.staffIndex]?.measures[
                selection.measureIndex
              ]?.voices[selection.voiceIndex]?.find((e) => e.id === selection.eventId);
              if (ev && !ev.isRest) {
                const nextTie = !ev.notes.some((n) => n.tieStart);
                ev.notes.forEach((n) => {
                  n.tieStart = nextTie;
                });
              }
            });
          }}
          onSetSelectedLyric={(lyric) => {
            if (!selection?.eventId) return;
            commitScoreChange((draft) => {
              const ev = draft.parts[selection.partIndex]?.staves[selection.staffIndex]?.measures[
                selection.measureIndex
              ]?.voices[selection.voiceIndex]?.find((e) => e.id === selection.eventId);
              if (ev && !ev.isRest) {
                ev.lyric = lyric || undefined;
              }
            });
          }}
          onDeleteSelectedEvent={deleteSelectedEvent}
          onAddIntervalToChord={(semitones) => {
            if (!selection?.eventId) return;
            commitScoreChange((draft) => {
              const part = draft.parts[selection.partIndex];
              const eff = getEffectiveMeasureContext(
                part,
                selection.staffIndex,
                selection.measureIndex,
                draft.defaultTempo
              );
              const ev = part?.staves[selection.staffIndex]?.measures[selection.measureIndex]?.voices[
                selection.voiceIndex
              ]?.find((e) => e.id === selection.eventId);
              if (!ev || ev.isRest || ev.notes.length === 0) return;
              const topNote = ev.notes[ev.notes.length - 1];
              const newPitch = midiToPitch(pitchToMidi(topNote.pitch) + semitones, eff.keyFifths);
              ev.notes.push(createNoteHead(newPitch));
              synthEngine.auditionPitch(newPitch, part.timbre, 0.35, part.program, part.drumKit);
            });
          }}
          onSetGuitarTabPosition={setSelectedGuitarTabPosition}
          onCycleGuitarTabString={(dir) => {
            if (!selection?.eventId) return;
            commitScoreChange((draft) => {
              const part = draft.parts[selection.partIndex];
              const tabConfig = part ? getTabConfig(part) : null;
              const ev = part?.staves[selection.staffIndex]?.measures[selection.measureIndex]?.voices[
                selection.voiceIndex
              ]?.find((e) => e.id === selection.eventId);
              if (!tabConfig || !ev || ev.isRest || ev.notes.length === 0) return;
              const nh = ev.notes[0];
              const options = getValidTabPositions(nh.pitch, tabConfig);
              if (options.length <= 1) return;
              const curStr = nh.tabString ?? options[0].str;
              const curIdx = options.findIndex((o) => o.str === curStr);
              const nextIdx =
                curIdx === -1
                  ? 0
                  : (curIdx + dir + options.length) % options.length;
              nh.tabString = options[nextIdx].str;
              nh.tabFret = options[nextIdx].fret;
            });
          }}
          onUpdatePartMixer={(pIdx, patch) => {
            setScore((prev) => {
              const next = cloneScore(prev);
              const part = next.parts[pIdx];
              if (part) {
                const safePatch = { ...patch };
                // Linked TAB is only meaningful for guitar-family instruments
                if (safePatch.showTab !== undefined && !supportsGuitarTab(part)) {
                  delete safePatch.showTab;
                }
                Object.assign(part, safePatch);
              }
              return next;
            });
          }}
          onAddInstrumentPart={(presetId) => {
            const preset = INSTRUMENT_PRESETS.find((p) => p.id === presetId);
            if (!preset) return;
            commitScoreChange((draft) => {
              const refPart = draft.parts[0];
              const refMeasures = refPart?.staves[0]?.measures || [];
              const newStaves = preset.staves.map((clef) => ({
                id: uid('staff'),
                clef,
                measures: refMeasures.map((rm, mIdx) => {
                  const ctx = getEffectiveMeasureContext(refPart, 0, mIdx, draft.defaultTempo);
                  const cap = getMeasureCapacityBeats(ctx.beats, ctx.beatType);
                  return {
                    id: uid('m'),
                    attributes:
                      mIdx === 0
                        ? {
                            clef,
                            keyFifths: ctx.keyFifths,
                            timeSignature: { beats: ctx.beats, beatType: ctx.beatType },
                          }
                        : {
                            keyFifths: rm.attributes.keyFifths,
                            timeSignature: rm.attributes.timeSignature,
                            barlineRight: rm.attributes.barlineRight,
                          },
                    voices: [createMeasureRest(cap)],
                  };
                }),
              }));
              draft.parts.push({
                id: uid('part'),
                name: preset.name,
                shortName: preset.shortName,
                timbre: preset.timbre,
                program: preset.program,
                volume: 0.85,
                muted: false,
                solo: false,
                showTab: Boolean(preset.showTab),
                drumKit: Boolean(preset.drumKit),
                staves: newStaves,
              });
            });
            showToast(`Added ${preset.name} staff`);
          }}
          onRemoveInstrumentPart={(pIdx) => {
            if (score.parts.length <= 1) return;
            commitScoreChange((draft) => {
              draft.parts.splice(pIdx, 1);
            });
            setSelection({
              partIndex: 0,
              staffIndex: 0,
              measureIndex: 0,
              voiceIndex: 0,
              eventId: null,
            });
          }}
          onUpdateMeasureTempo={(mIdx, tempo) => {
            commitScoreChange((draft) => {
              const meas = draft.parts[0]?.staves[0]?.measures[mIdx];
              if (meas) meas.attributes.tempo = tempo;
            });
          }}
          onAddChord={handleAddChord}
          onRemoveChord={handleRemoveChord}
        />
      </div>

      {/* Modals */}
      <OpenScoreModal
        isOpen={openModalVisible}
        recentScores={recentScores.map((s) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
          sourceLabel: s.sourceLabel,
        }))}
        onClose={() => setOpenModalVisible(false)}
        onImportLocalFile={handleImportLocalFile}
        onImportWebUrl={handleImportWebUrl}
        onLoadStarter={(id) => {
          const found = STARTER_SCORES.find((st) => st.id === id);
          if (found) {
            loadNewDocument(found.create());
            showToast(`Opened "${found.title}"`);
          }
        }}
        onLoadRecent={(id) => {
          const found = recentScores.find((rs) => rs.id === id);
          if (found) {
            loadNewDocument(found);
            showToast(`Opened "${found.title}"`);
          }
        }}
      />

      <ExportModal
        isOpen={exportModalVisible}
        score={score}
        onClose={() => setExportModalVisible(false)}
        onExport={(fmt) => {
          void handleExport(fmt);
        }}
      />

      <NewScoreModal
        isOpen={newModalVisible}
        onClose={() => setNewModalVisible(false)}
        onCreate={(opts: NewScoreOptions) => {
          const created = createBlankScore(opts);
          loadNewDocument(created);
          showToast(`Created "${created.title}"`);
        }}
      />

      <ShortcutsModal
        isOpen={shortcutsVisible}
        onClose={() => setShortcutsVisible(false)}
      />

      {/* Toast feedback */}
      {toast && (
        <div
          className={`no-print fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border text-xs font-medium shadow-xl transition-opacity ${
            toast.type === 'error'
              ? 'bg-rose-950/95 border-rose-500/50 text-rose-100'
              : 'bg-[var(--bg-panel)] border-[var(--border-strong)] text-[var(--text-strong)]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
