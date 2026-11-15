import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accidental,
  Annotation,
  AnnotationHorizontalJustify,
  AnnotationVerticalJustify,
  Articulation,
  BarlineType as VexBarlineType,
  Beam,
  Dot,
  Formatter,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  TabNote,
  TabStave,
  TabTie,
  Voice,
} from 'vexflow';
import {
  AccidentalType,
  ClefType,
  EditorToolState,
  Measure,
  Pitch,
  ScoreDocument,
  SelectionTarget,
} from '../types/score';
import { drumLabelForPitch } from '../audio/drumKit';
import { sortedChords } from '../utils/chords';
import {
  DURATION_TO_VEXFLOW,
  accidentalToVexSymbol,
  accidentalTypeToAlter,
  alterToAccidentalType,
  assignTabPositions,
  formatPitchName,
  getEffectiveMeasureContext,
  getEventBeats,
  getKeySignatureAlterMap,
  getMeasureCapacityBeats,
  getVexKeySignature,
  getTabConfig,
  supportsGuitarTab,
  pitchToVexKey,
  staffStepToPitch,
} from '../utils/musicTheory';

interface ScoreCanvasProps {
  score: ScoreDocument;
  selection: SelectionTarget | null;
  toolState: EditorToolState;
  zoom: number;
  pageView: boolean;
  isPlaying: boolean;
  playhead: { measureIndex: number; beatInMeasure: number } | null;
  onSelectEvent: (target: SelectionTarget) => void;
  onSelectMeasure: (partIndex: number, staffIndex: number, measureIndex: number) => void;
  onInsertOrReplaceNote: (
    partIndex: number,
    staffIndex: number,
    measureIndex: number,
    voiceIndex: number,
    targetEventId: string | null,
    pitch: Pitch
  ) => void;
  onFileDrop: (file: File) => void;
}

interface HitTarget {
  pageIdx: number;
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  eventId: string;
  source: 'notation' | 'tab';
  noteIndex?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  beatStart: number;
  beatDuration: number;
}

interface MeasureGeometry {
  pageIdx: number;
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  x: number;
  noteStartX: number;
  width: number;
  topLineY: number; // Y coordinate of top line (line 0 in VexFlow, F5 in treble)
  bottomLineY: number; // Y coordinate of line 4 (E4 in treble)
  lineSpacing: number; // 10px in VexFlow default
  systemTopY: number;
  systemBottomY: number;
  clef: ClefType;
  keyFifths: number;
  capacityBeats: number;
}

interface HoverGhost {
  pageIdx: number;
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  targetEventId: string | null;
  x: number;
  y: number;
  pitch: Pitch;
  clef: ClefType;
  stepsFromBottomLine: number;
  topLineY: number;
  bottomLineY: number;
  lineSpacing: number;
}

const PAGE_WIDTH = 900;
const PAGE_HEIGHT = 1272;
const MARGIN_X = 54;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const STAFF_SPACING = 94;
const PART_EXTRA_GAP = 18;
const SYSTEM_VERTICAL_GAP = 42;

function mapBarlineToVex(bar?: string): number {
  switch (bar) {
    case 'double':
      return VexBarlineType.DOUBLE;
    case 'end':
      return VexBarlineType.END;
    case 'repeat-begin':
      return VexBarlineType.REPEAT_BEGIN;
    case 'repeat-end':
      return VexBarlineType.REPEAT_END;
    default:
      return VexBarlineType.SINGLE;
  }
}

function getRestKeyForClef(clef: ClefType): string {
  switch (clef) {
    case 'bass':
      return 'd/3';
    case 'alto':
      return 'c/4';
    case 'tenor':
      return 'a/3';
    case 'percussion':
      return 'b/4';
    default:
      return 'b/4';
  }
}

function getArticulationCode(art: string): string | null {
  switch (art) {
    case 'staccato':
      return 'a.';
    case 'accent':
      return 'a>';
    case 'tenuto':
      return 'a-';
    case 'marcato':
      return 'a^';
    case 'fermata':
      return 'a@a';
    default:
      return null;
  }
}

export const ScoreCanvas: React.FC<ScoreCanvasProps> = ({
  score,
  selection,
  toolState,
  zoom,
  pageView,
  isPlaying,
  playhead,
  onSelectEvent,
  onSelectMeasure,
  onInsertOrReplaceNote,
  onFileDrop,
}) => {
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hitTargets, setHitTargets] = useState<HitTarget[]>([]);
  const [measureGeometries, setMeasureGeometries] = useState<MeasureGeometry[]>([]);
  const [hoverGhost, setHoverGhost] = useState<HoverGhost | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Compute total measures and system/page layout
  const layoutPages = useMemo(() => {
    const leadPart = score.parts[0];
    const totalMeasures = leadPart?.staves[0]?.measures.length || 0;
    if (totalMeasures === 0) return [];

    // Group measures into systems by visual density
    const systems: number[][] = [];
    let currentSys: number[] = [];
    let currentWeight = 0;

    for (let m = 0; m < totalMeasures; m++) {
      let maxEvents = 1;
      let hasAttr = m === 0;
      score.parts.forEach((p) =>
        p.staves.forEach((s) => {
          const meas: Measure | undefined = s.measures[m];
          if (meas) {
            const evCount = meas.voices[0]?.length || 1;
            if (evCount > maxEvents) maxEvents = evCount;
            if (meas.attributes.keyFifths !== undefined || meas.attributes.timeSignature || meas.attributes.clef) {
              hasAttr = true;
            }
          }
        })
      );

      const weight = Math.max(2.2, maxEvents * 0.65) + (hasAttr ? 1.1 : 0);
      if (currentSys.length > 0 && (currentWeight + weight > 11.5 || currentSys.length >= 4)) {
        systems.push(currentSys);
        currentSys = [m];
        currentWeight = weight;
      } else {
        currentSys.push(m);
        currentWeight += weight;
      }
    }
    if (currentSys.length > 0) systems.push(currentSys);

    // Compute vertical height of a single system (including linked Guitar TAB staves)
    const totalStaves = score.parts.reduce(
      (sum, p) => sum + p.staves.length + (p.showTab && supportsGuitarTab(p) ? 1 : 0),
      0
    );
    const systemHeight =
      totalStaves * STAFF_SPACING + Math.max(0, score.parts.length - 1) * PART_EXTRA_GAP + SYSTEM_VERTICAL_GAP;

    if (!pageView) {
      return [
        {
          pageIdx: 0,
          hasHeader: true,
          systems,
          height: Math.max(760, 170 + systems.length * systemHeight + 60),
          systemHeight,
        },
      ];
    }

    // Paginate systems across A4 pages
    const pages: {
      pageIdx: number;
      hasHeader: boolean;
      systems: number[][];
      height: number;
      systemHeight: number;
    }[] = [];

    let sysCursor = 0;
    let pageIdx = 0;
    while (sysCursor < systems.length) {
      const topPadding = pageIdx === 0 ? 170 : 68;
      const bottomPadding = 64;
      const avail = PAGE_HEIGHT - topPadding - bottomPadding;
      const maxSysOnPage = Math.max(1, Math.floor(avail / systemHeight));
      const slice = systems.slice(sysCursor, sysCursor + maxSysOnPage);
      pages.push({
        pageIdx,
        hasHeader: pageIdx === 0,
        systems: slice,
        height: PAGE_HEIGHT,
        systemHeight,
      });
      sysCursor += slice.length;
      pageIdx++;
    }

    return pages;
  }, [score, pageView]);

  // Render VexFlow SVG onto each page container
  useEffect(() => {
    const newHitTargets: HitTarget[] = [];
    const newMeasureGeos: MeasureGeometry[] = [];

    layoutPages.forEach((page) => {
      const host = containerRefs.current[page.pageIdx];
      if (!host) return;
      host.innerHTML = '';

      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(PAGE_WIDTH, page.height);
      const context = renderer.getContext();
      context.setFont('Lora', 12);

      const svgEl = host.querySelector('svg');
      if (svgEl) {
        svgEl.style.display = 'block';
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
      }

      let cursorY = page.hasHeader ? 164 : 68;

      page.systems.forEach((measureIndices, sysLocalIdx) => {
        const systemStartY = cursorY;

        // Calculate proportional widths per measure in this system
        const isMultiPart =
          score.parts.length > 1 ||
          (score.parts[0]?.staves.length || 0) > 1 ||
          score.parts.some((p) => Boolean(p.showTab) && supportsGuitarTab(p));
        const leftLabelReserve = sysLocalIdx === 0 && page.hasHeader && isMultiPart ? 48 : 16;
        const availSysWidth = USABLE_WIDTH - leftLabelReserve;
        const startSysX = MARGIN_X + leftLabelReserve;

        const measureWeights = measureIndices.map((mIdx, posInSys) => {
          let maxEv = 1;
          score.parts.forEach((p) =>
            p.staves.forEach((s) => {
              const cnt = s.measures[mIdx]?.voices[0]?.length || 1;
              if (cnt > maxEv) maxEv = cnt;
            })
          );
          const hasInitialMeta = posInSys === 0 ? 1.6 : 0;
          return Math.max(2.2, maxEv * 0.72) + hasInitialMeta;
        });
        const totalW = measureWeights.reduce((a, b) => a + b, 0);

        // Compute Y positions for every (partIdx, staffIdx) and optional linked TabStave in this system
        const staffYPositions: { partIdx: number; staffIdx: number; y: number; tabY?: number }[] = [];
        let staffY = systemStartY;
        score.parts.forEach((part, pIdx) => {
          part.staves.forEach((_staff, sIdx) => {
            const notationY = staffY;
            staffY += STAFF_SPACING;
            let tabY: number | undefined;
            if (part.showTab && supportsGuitarTab(part) && sIdx === part.staves.length - 1) {
              tabY = staffY - 4;
              staffY += STAFF_SPACING;
            }
            staffYPositions.push({ partIdx: pIdx, staffIdx: sIdx, y: notationY, tabY });
          });
          if (pIdx < score.parts.length - 1) {
            staffY += PART_EXTRA_GAP;
          }
        });
        const systemBottomY = staffY - STAFF_SPACING + 50;

        // Track previous measure's StaveNotes per (partIdx, staffIdx, voiceIdx) for cross-measure ties
        const prevMeasureLastNote = new Map<string, { staveNote: StaveNote; tieKeys: number[] }>();
        const prevMeasureLastTabNote = new Map<string, { tabNote: TabNote; indices: number[] }>();

        let measureX = startSysX;

        measureIndices.forEach((mIdx, posInSys) => {
          const mWidth = (measureWeights[posInSys] / totalW) * availSysWidth;

          // Draw measure number above top staff at start of system
          if (posInSys === 0 && staffYPositions.length > 0) {
            context.save();
            context.setFont('JetBrains Mono', 10, 'normal');
            context.setFillStyle('#64748b');
            context.fillText(String(mIdx + 1), measureX, systemStartY - 12);
            context.restore();
          }

          // 1. Build Staves & Voices for all parts/staves in this measure
          const staveMap = new Map<string, Stave>();
          const tabStaveMap = new Map<string, TabStave>();
          const allVoicesInMeasure: Voice[] = [];
          const beamGroups: Beam[] = [];
          const tiePairs: { from: StaveNote; to: StaveNote; indices: number[] }[] = [];
          const tabTiePairs: { from: TabNote; to: TabNote; indices: number[] }[] = [];
          const noteRenderRecords: {
            partIdx: number;
            staffIdx: number;
            voiceIdx: number;
            eventId: string;
            staveNote: StaveNote | TabNote;
            source: 'notation' | 'tab';
            tabStops?: { noteIndex: number; str: number }[];
            beatStart: number;
            beatDuration: number;
          }[] = [];

          // Keep the lead stave for formatting reference
          let leadStave: Stave | null = null;

          staffYPositions.forEach(({ partIdx, staffIdx, y, tabY }) => {
            const part = score.parts[partIdx];
            const staff = part.staves[staffIdx];
            const measure = staff.measures[mIdx];
            if (!measure) return;
            const tabConfig = getTabConfig(part);

            const eff = getEffectiveMeasureContext(part, staffIdx, mIdx, score.defaultTempo);
            const stave = new Stave(measureX, y, mWidth);
            if (!leadStave) leadStave = stave;

            // Left barline
            if (measure.attributes.barlineLeft) {
              stave.setBegBarType(mapBarlineToVex(measure.attributes.barlineLeft));
            }
            // Right barline
            if (measure.attributes.barlineRight) {
              stave.setEndBarType(mapBarlineToVex(measure.attributes.barlineRight));
            }

            // Clef & Key Signature on first measure of each system or when changed
            const showClef = posInSys === 0 || Boolean(measure.attributes.clef);
            const showKey = posInSys === 0 || measure.attributes.keyFifths !== undefined;
            const showTime = mIdx === 0 || Boolean(measure.attributes.timeSignature);

            if (showClef) {
              stave.addClef(eff.clef);
            }
            // Percussion staves never display a key signature
            if (eff.clef !== 'percussion') {
              if (showKey && eff.keyFifths !== 0) {
                stave.addKeySignature(getVexKeySignature(eff.keyFifths));
              } else if (showKey && measure.attributes.keyFifths === 0 && mIdx > 0 && posInSys > 0) {
                stave.addKeySignature('C');
              }
            }
            if (showTime) {
              stave.addTimeSignature(`${eff.beats}/${eff.beatType}`);
            }

            // Tempo text on first staff when tempo changes or mIdx === 0
            if (partIdx === 0 && staffIdx === 0 && (measure.attributes.tempo || mIdx === 0)) {
              const bpm = measure.attributes.tempo || score.defaultTempo;
              stave.setTempo({ duration: 'q', dots: 0, bpm }, -22);
            }

            // Instrument name label on system 0
            if (posInSys === 0 && page.hasHeader && sysLocalIdx === 0 && isMultiPart) {
              if (staffIdx === 0) {
                const label = part.shortName || part.name.slice(0, 5);
                context.save();
                context.setFont('Plus Jakarta Sans', 11, '600');
                context.setFillStyle('#334155');
                const yMid =
                  part.staves.length > 1
                    ? y + ((part.staves.length - 1) * STAFF_SPACING) / 2 + 24
                    : y + 24;
                context.fillText(label, MARGIN_X - 6, yMid);
                context.restore();
              }
            }

            stave.setContext(context).draw();
            staveMap.set(`${partIdx}:${staffIdx}`, stave);

            // Linked Guitar/Bass Tablature Stave right below notation staff
            let tabStave: TabStave | null = null;
            if (tabY !== undefined && tabConfig) {
              tabStave = new TabStave(measureX, tabY, mWidth, { num_lines: tabConfig.strings });
              if (measure.attributes.barlineLeft) {
                tabStave.setBegBarType(mapBarlineToVex(measure.attributes.barlineLeft));
              }
              if (measure.attributes.barlineRight) {
                tabStave.setEndBarType(mapBarlineToVex(measure.attributes.barlineRight));
              }
              if (posInSys === 0) {
                tabStave.addTabGlyph();
              }
              tabStave.setContext(context).draw();
              tabStaveMap.set(`${partIdx}:${staffIdx}`, tabStave);
            }

            // Running accidental state inside this measure
            const keyAlterMap = getKeySignatureAlterMap(eff.keyFifths);

            measure.voices.forEach((voiceEvents, voiceIdx) => {
              const measureAccidentalState = new Map<string, number>();
              const vfNotes: StaveNote[] = [];
              const tieKeyTracker: { staveNote: StaveNote; tieStartIndices: number[]; tieStopIndices: number[] }[] = [];
              let beatCursor = 0;

              voiceEvents.forEach((ev) => {
                const evBeats = getEventBeats(ev);
                const vexDurBase = DURATION_TO_VEXFLOW[ev.duration] || 'q';
                const dotStr = ev.dots === 2 ? 'dd' : ev.dots === 1 ? 'd' : '';

                let vfNote: StaveNote;

                if (ev.isRest) {
                  const restKey = getRestKeyForClef(eff.clef);
                  vfNote = new StaveNote({
                    clef: eff.clef,
                    keys: [restKey],
                    duration: `${vexDurBase}${dotStr}r`,
                    align_center: Boolean(ev.isMeasureRest),
                  });
                  if (ev.dots > 0) {
                    Dot.buildAndAttach([vfNote], { all: true });
                  }
                } else {
                  const sortedNotes = [...ev.notes].sort((a, b) => {
                    const aVal = a.pitch.octave * 7 + 'CDEFGAB'.indexOf(a.pitch.step);
                    const bVal = b.pitch.octave * 7 + 'CDEFGAB'.indexOf(b.pitch.step);
                    return aVal - bVal;
                  });
                  const keys = sortedNotes.map((nh) => pitchToVexKey(nh.pitch));
                  vfNote = new StaveNote({
                    clef: eff.clef,
                    keys,
                    duration: `${vexDurBase}${dotStr}`,
                    auto_stem: measure.voices.length === 1,
                    stem_direction: measure.voices.length > 1 ? (voiceIdx === 0 ? 1 : -1) : undefined,
                  });

                  if (ev.dots > 0) {
                    Dot.buildAndAttach([vfNote], { all: true });
                  }

                  // Accidentals
                  sortedNotes.forEach((nh, nIdx) => {
                    const pitchKey = `${nh.pitch.step}${nh.pitch.octave}`;
                    const expectedAlter = measureAccidentalState.has(pitchKey)
                      ? measureAccidentalState.get(pitchKey)!
                      : keyAlterMap[nh.pitch.step];
                    const actualAlter = nh.pitch.alter || 0;

                    if (actualAlter !== expectedAlter) {
                      const accType: AccidentalType =
                        alterToAccidentalType(actualAlter) || 'natural';
                      vfNote.addModifier(new Accidental(accidentalToVexSymbol(accType)), nIdx);
                      measureAccidentalState.set(pitchKey, actualAlter);
                    } else if (nh.pitch.accidental && accidentalTypeToAlter(nh.pitch.accidental) === actualAlter && nh.pitch.accidental === 'natural' && expectedAlter !== 0) {
                      vfNote.addModifier(new Accidental('n'), nIdx);
                      measureAccidentalState.set(pitchKey, 0);
                    }
                  });

                  // Articulations
                  ev.articulations?.forEach((art) => {
                    const code = getArticulationCode(art);
                    if (code) {
                      vfNote.addModifier(new Articulation(code), 0);
                    }
                  });

                  // Dynamics
                  if (ev.dynamic) {
                    const dyn = new Annotation(ev.dynamic)
                      .setFont('Lora', 12, 'bold italic')
                      .setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
                      .setJustification(AnnotationHorizontalJustify.CENTER);
                    vfNote.addModifier(dyn, 0);
                  }

                  // Lyrics
                  if (ev.lyric) {
                    const lyr = new Annotation(ev.lyric)
                      .setFont('Lora', 11, 'normal')
                      .setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
                      .setJustification(AnnotationHorizontalJustify.CENTER);
                    vfNote.addModifier(lyr, 0);
                  }

                  // Track ties
                  const startIndices: number[] = [];
                  const stopIndices: number[] = [];
                  sortedNotes.forEach((nh, idx) => {
                    if (nh.tieStart) startIndices.push(idx);
                    if (nh.tieStop) stopIndices.push(idx);
                  });

                  const prevKey = `${partIdx}:${staffIdx}:${voiceIdx}`;
                  if (stopIndices.length > 0 && tieKeyTracker.length > 0) {
                    const prevEntry = tieKeyTracker[tieKeyTracker.length - 1];
                    if (prevEntry.tieStartIndices.length > 0) {
                      tiePairs.push({
                        from: prevEntry.staveNote,
                        to: vfNote,
                        indices: stopIndices,
                      });
                    }
                  } else if (stopIndices.length > 0 && prevMeasureLastNote.has(prevKey)) {
                    const prev = prevMeasureLastNote.get(prevKey)!;
                    tiePairs.push({
                      from: prev.staveNote,
                      to: vfNote,
                      indices: stopIndices,
                    });
                  }

                  tieKeyTracker.push({
                    staveNote: vfNote,
                    tieStartIndices: startIndices,
                    tieStopIndices: stopIndices,
                  });
                }

                vfNote.setStave(stave);
                vfNotes.push(vfNote);
                noteRenderRecords.push({
                  partIdx,
                  staffIdx,
                  voiceIdx,
                  eventId: ev.id,
                  staveNote: vfNote,
                  source: 'notation',
                  beatStart: beatCursor,
                  beatDuration: evBeats,
                });

                beatCursor += evBeats;
              });

              if (vfNotes.length > 0) {
                const voice = new Voice({ num_beats: eff.beats, beat_value: eff.beatType });
                voice.setMode(Voice.Mode.SOFT);
                voice.addTickables(vfNotes);
                allVoicesInMeasure.push(voice);

                // Generate automatic beams for eighth/16th/32nd runs
                try {
                  const beams = Beam.generateBeams(vfNotes, {
                    beam_rests: false,
                    maintain_stem_directions: measure.voices.length > 1,
                  });
                  beamGroups.push(...beams);
                } catch {
                  // Ignore beaming edge cases on irregular imported rhythms
                }

                const lastTrack = tieKeyTracker[tieKeyTracker.length - 1];
                if (lastTrack && lastTrack.tieStartIndices.length > 0) {
                  prevMeasureLastNote.set(`${partIdx}:${staffIdx}:${voiceIdx}`, {
                    staveNote: lastTrack.staveNote,
                    tieKeys: lastTrack.tieStartIndices,
                  });
                } else {
                  prevMeasureLastNote.delete(`${partIdx}:${staffIdx}:${voiceIdx}`);
                }
              }

              // Render synchronized Guitar Tablature voice for primary voice
              if (tabStave && tabConfig && voiceIdx === 0 && voiceEvents.length > 0) {
                const tabTickables: (TabNote | GhostNote)[] = [];
                const tabTracker: {
                  tabNote: TabNote | null;
                  tieStartIndices: number[];
                }[] = [];
                let tabBeatCursor = 0;

                voiceEvents.forEach((ev) => {
                  const evBeats = getEventBeats(ev);
                  const vexDurBase = DURATION_TO_VEXFLOW[ev.duration] || 'q';
                  const dotStr = ev.dots === 2 ? 'dd' : ev.dots === 1 ? 'd' : '';

                  if (ev.isRest) {
                    const ghost = new GhostNote({ duration: `${vexDurBase}${dotStr}` });
                    ghost.setStave(tabStave!);
                    tabTickables.push(ghost);
                    tabTracker.push({ tabNote: null, tieStartIndices: [] });
                  } else {
                    const sortedNotes = [...ev.notes].sort((a, b) => {
                      const aVal = a.pitch.octave * 7 + 'CDEFGAB'.indexOf(a.pitch.step);
                      const bVal = b.pitch.octave * 7 + 'CDEFGAB'.indexOf(b.pitch.step);
                      return aVal - bVal;
                    });
                    const assigned = assignTabPositions(sortedNotes, tabConfig);
                    const positions = assigned.map((p) => ({ str: p.str, fret: p.fret }));

                    const tNote = new TabNote({
                      positions,
                      duration: `${vexDurBase}${dotStr}`,
                    });
                    tNote.setStave(tabStave!);
                    tabTickables.push(tNote);

                    noteRenderRecords.push({
                      partIdx,
                      staffIdx,
                      voiceIdx,
                      eventId: ev.id,
                      staveNote: tNote,
                      source: 'tab',
                      tabStops: assigned.map((p) => ({
                        noteIndex: ev.notes.findIndex((nh) => nh.id === p.noteId),
                        str: p.str,
                      })),
                      beatStart: tabBeatCursor,
                      beatDuration: evBeats,
                    });

                    const startIndices: number[] = [];
                    const stopIndices: number[] = [];
                    sortedNotes.forEach((nh, idx) => {
                      if (nh.tieStart) startIndices.push(idx);
                      if (nh.tieStop) stopIndices.push(idx);
                    });

                    const prevKey = `${partIdx}:${staffIdx}:tab`;
                    if (stopIndices.length > 0 && tabTracker.length > 0) {
                      const prevEntry = tabTracker[tabTracker.length - 1];
                      if (prevEntry.tabNote && prevEntry.tieStartIndices.length > 0) {
                        tabTiePairs.push({
                          from: prevEntry.tabNote,
                          to: tNote,
                          indices: stopIndices,
                        });
                      }
                    } else if (stopIndices.length > 0 && prevMeasureLastTabNote.has(prevKey)) {
                      const prev = prevMeasureLastTabNote.get(prevKey)!;
                      tabTiePairs.push({
                        from: prev.tabNote,
                        to: tNote,
                        indices: stopIndices,
                      });
                    }

                    tabTracker.push({ tabNote: tNote, tieStartIndices: startIndices });
                  }

                  tabBeatCursor += evBeats;
                });

                if (tabTickables.length > 0) {
                  const tabVoice = new Voice({ num_beats: eff.beats, beat_value: eff.beatType });
                  tabVoice.setMode(Voice.Mode.SOFT);
                  tabVoice.addTickables(tabTickables);
                  allVoicesInMeasure.push(tabVoice);

                  const lastTab = tabTracker[tabTracker.length - 1];
                  if (lastTab && lastTab.tabNote && lastTab.tieStartIndices.length > 0) {
                    prevMeasureLastTabNote.set(`${partIdx}:${staffIdx}:tab`, {
                      tabNote: lastTab.tabNote,
                      indices: lastTab.tieStartIndices,
                    });
                  } else {
                    prevMeasureLastTabNote.delete(`${partIdx}:${staffIdx}:tab`);
                  }
                }
              }
            });
          });

          // 2. Format & Draw all voices together for clean vertical beat alignment
          if (allVoicesInMeasure.length > 0 && leadStave) {
            const firstNoteStartX = Math.max(
              ...Array.from(staveMap.values()).map((st) => st.getNoteStartX()),
              ...Array.from(tabStaveMap.values()).map((st) => st.getNoteStartX())
            );
            staveMap.forEach((st) => {
              st.setNoteStartX(firstNoteStartX);
            });
            tabStaveMap.forEach((st) => {
              st.setNoteStartX(firstNoteStartX);
            });
            const noteAreaWidth = Math.max(40, measureX + mWidth - firstNoteStartX - 16);
            try {
              const formatter = new Formatter();
              formatter.joinVoices(allVoicesInMeasure).format(allVoicesInMeasure, noteAreaWidth);
            } catch {
              // Fallback format individually if voices have mismatched lengths
              allVoicesInMeasure.forEach((v) => {
                try {
                  new Formatter().joinVoices([v]).format([v], noteAreaWidth);
                } catch {
                  // Ignore
                }
              });
            }

            allVoicesInMeasure.forEach((v) => v.draw(context));
            beamGroups.forEach((b) => b.setContext(context).draw());
            tiePairs.forEach((tp) => {
              try {
                new StaveTie({
                  first_note: tp.from,
                  last_note: tp.to,
                  first_indices: tp.indices,
                  last_indices: tp.indices,
                })
                  .setContext(context)
                  .draw();
              } catch {
                // Ignore tie draw errors
              }
            });
            tabTiePairs.forEach((tp) => {
              try {
                new TabTie({
                  first_note: tp.from,
                  last_note: tp.to,
                  first_indices: tp.indices,
                  last_indices: tp.indices,
                })
                  .setContext(context)
                  .draw();
              } catch {
                // Ignore tab tie draw errors
              }
            });
          }

          // 3. Draw System Connectors on posInSys === 0 and linked Notation+TAB connectors
          const topSystemStave = staveMap.get('0:0');
          const lastPos = staffYPositions[staffYPositions.length - 1];
          const bottomSystemStave = lastPos
            ? tabStaveMap.get(`${lastPos.partIdx}:${lastPos.staffIdx}`) ||
              staveMap.get(`${lastPos.partIdx}:${lastPos.staffIdx}`)
            : undefined;

          if (posInSys === 0) {
            if (isMultiPart && topSystemStave && bottomSystemStave && topSystemStave !== bottomSystemStave) {
              new StaveConnector(topSystemStave, bottomSystemStave)
                .setType(StaveConnector.type.SINGLE_LEFT)
                .setContext(context)
                .draw();
            }
            // Grand staff Brace for 2-staff parts (like Piano) or Bracket for Guitar + TAB
            score.parts.forEach((part, pIdx) => {
              if (part.staves.length > 1) {
                const topS = staveMap.get(`${pIdx}:0`);
                const botS =
                  (part.showTab && supportsGuitarTab(part) && tabStaveMap.get(`${pIdx}:${part.staves.length - 1}`)) ||
                  staveMap.get(`${pIdx}:${part.staves.length - 1}`);
                if (topS && botS) {
                  new StaveConnector(topS, botS)
                    .setType(StaveConnector.type.BRACE)
                    .setContext(context)
                    .draw();
                }
              } else if (part.showTab && supportsGuitarTab(part)) {
                const topS = staveMap.get(`${pIdx}:0`);
                const botTab = tabStaveMap.get(`${pIdx}:0`);
                if (topS && botTab) {
                  new StaveConnector(topS, botTab)
                    .setType(StaveConnector.type.BRACKET)
                    .setContext(context)
                    .draw();
                }
              }
            });
            if (score.parts.length > 1 && topSystemStave && bottomSystemStave) {
              new StaveConnector(topSystemStave, bottomSystemStave)
                .setType(StaveConnector.type.BRACKET)
                .setContext(context)
                .draw();
            }
          }

          // Right connector across multi-staff or Notation+TAB system
          if (isMultiPart && topSystemStave && bottomSystemStave && topSystemStave !== bottomSystemStave) {
            new StaveConnector(topSystemStave, bottomSystemStave)
              .setType(StaveConnector.type.SINGLE_RIGHT)
              .setContext(context)
              .draw();
          }

          // 4. Record exact interactive bounding boxes
          staffYPositions.forEach(({ partIdx, staffIdx }) => {
            const stave = staveMap.get(`${partIdx}:${staffIdx}`);
            if (!stave) return;
            const part = score.parts[partIdx];
            const eff = getEffectiveMeasureContext(part, staffIdx, mIdx, score.defaultTempo);
            const topLineY = stave.getYForLine(0);
            const bottomLineY = stave.getYForLine(4);
            const lineSpacing = stave.getSpacingBetweenLines();

            newMeasureGeos.push({
              pageIdx: page.pageIdx,
              partIndex: partIdx,
              staffIndex: staffIdx,
              measureIndex: mIdx,
              x: measureX,
              noteStartX: stave.getNoteStartX(),
              width: mWidth,
              topLineY,
              bottomLineY,
              lineSpacing,
              systemTopY: systemStartY + 12,
              systemBottomY: systemBottomY + 16,
              clef: eff.clef,
              keyFifths: eff.keyFifths,
              capacityBeats: getMeasureCapacityBeats(eff.beats, eff.beatType),
            });
          });

          noteRenderRecords.forEach((rec) => {
            try {
              const bb = rec.staveNote.getBoundingBox();
              const tabStave = tabStaveMap.get(`${rec.partIdx}:${rec.staffIdx}`);

              // Guitar TAB: one hit box per fret number so the exact string can be selected
              if (rec.source === 'tab' && tabStave && rec.tabStops && rec.tabStops.length > 0) {
                const startX = (bb ? bb.getX() : rec.staveNote.getAbsoluteX()) - 4;
                const hitWidth = Math.max(18, bb ? bb.getW() + 4 : 18);
                rec.tabStops.forEach((stop) => {
                  const lineY = tabStave.getYForLine(stop.str - 1);
                  newHitTargets.push({
                    pageIdx: page.pageIdx,
                    partIndex: rec.partIdx,
                    staffIndex: rec.staffIdx,
                    measureIndex: mIdx,
                    voiceIndex: rec.voiceIdx,
                    eventId: rec.eventId,
                    source: 'tab',
                    noteIndex: stop.noteIndex >= 0 ? stop.noteIndex : undefined,
                    x: startX,
                    y: lineY - 9,
                    width: hitWidth,
                    height: 18,
                    centerX: startX + hitWidth / 2,
                    beatStart: rec.beatStart,
                    beatDuration: rec.beatDuration,
                  });
                });
                return;
              }

              const x = bb ? bb.getX() - 4 : rec.staveNote.getAbsoluteX() - 8;
              const y = bb ? bb.getY() - 4 : staffYPositions[0].y;
              const width = bb ? Math.max(20, bb.getW() + 8) : 24;
              const height = bb ? Math.max(28, bb.getH() + 8) : 44;
              newHitTargets.push({
                pageIdx: page.pageIdx,
                partIndex: rec.partIdx,
                staffIndex: rec.staffIdx,
                measureIndex: mIdx,
                voiceIndex: rec.voiceIdx,
                eventId: rec.eventId,
                source: rec.source,
                x,
                y,
                width,
                height,
                centerX: x + width / 2,
                beatStart: rec.beatStart,
                beatDuration: rec.beatDuration,
              });
            } catch {
              // Ignore
            }
          });

          measureX += mWidth;
        });

        cursorY += page.systemHeight;
      });
    });

    setHitTargets(newHitTargets);
    setMeasureGeometries(newMeasureGeos);
  }, [score, layoutPages]);

  const handleSvgMouseMove = (
    e: React.MouseEvent<SVGSVGElement>,
    pageIdx: number
  ) => {
    if (!toolState.noteInputMode) {
      if (hoverGhost) setHoverGhost(null);
      return;
    }

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = (layoutPages[pageIdx]?.height || PAGE_HEIGHT) / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Find closest measure box vertically and horizontally
    const geo = measureGeometries.find(
      (g) =>
        g.pageIdx === pageIdx &&
        mx >= g.x &&
        mx <= g.x + g.width &&
        my >= g.topLineY - 38 &&
        my <= g.bottomLineY + 38
    );

    if (!geo) {
      setHoverGhost(null);
      return;
    }

    // Snap Y to nearest half-space (5px)
    const halfStepPx = geo.lineSpacing / 2;
    const stepsFromBottom = Math.round((geo.bottomLineY - my) / halfStepPx);
    const clampedSteps = Math.max(-6, Math.min(14, stepsFromBottom));
    const snappedY = geo.bottomLineY - clampedSteps * halfStepPx;

    // Determine pitch from clef + key signature + optional accidental override
    const pitch = staffStepToPitch(geo.clef, clampedSteps, geo.keyFifths);
    if (toolState.accidental) {
      pitch.alter = accidentalTypeToAlter(toolState.accidental);
      pitch.accidental = toolState.accidental;
    }

    // Find nearest event slot in this measure/voice to replace
    const measureHits = hitTargets.filter(
      (h) =>
        h.pageIdx === pageIdx &&
        h.partIndex === geo.partIndex &&
        h.staffIndex === geo.staffIndex &&
        h.measureIndex === geo.measureIndex &&
        h.voiceIndex === toolState.voiceIndex
    );

    let closestHit: HitTarget | null = null;
    let bestDist = Infinity;
    measureHits.forEach((h) => {
      const dist = Math.abs(mx - h.centerX);
      if (dist < bestDist) {
        bestDist = dist;
        closestHit = h;
      }
    });

    const ghostX = closestHit ? (closestHit as HitTarget).centerX : Math.max(geo.noteStartX + 12, mx);

    setHoverGhost({
      pageIdx,
      partIndex: geo.partIndex,
      staffIndex: geo.staffIndex,
      measureIndex: geo.measureIndex,
      targetEventId: closestHit ? (closestHit as HitTarget).eventId : null,
      x: ghostX,
      y: snappedY,
      pitch,
      clef: geo.clef,
      stepsFromBottomLine: clampedSteps,
      topLineY: geo.topLineY,
      bottomLineY: geo.bottomLineY,
      lineSpacing: geo.lineSpacing,
    });
  };

  const handleOverlayClick = (
    e: React.MouseEvent<SVGSVGElement>,
    pageIdx: number
  ) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = (layoutPages[pageIdx]?.height || PAGE_HEIGHT) / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (toolState.noteInputMode && hoverGhost && hoverGhost.pageIdx === pageIdx) {
      onInsertOrReplaceNote(
        hoverGhost.partIndex,
        hoverGhost.staffIndex,
        hoverGhost.measureIndex,
        toolState.voiceIndex,
        hoverGhost.targetEventId,
        hoverGhost.pitch
      );
      return;
    }

    // Select the nearest hit target under the pointer (TAB chord lines sit close together)
    const candidates = hitTargets.filter(
      (h) =>
        h.pageIdx === pageIdx &&
        mx >= h.x - 4 &&
        mx <= h.x + h.width + 4 &&
        my >= h.y - 6 &&
        my <= h.y + h.height + 6
    );
    const hit = candidates.reduce<HitTarget | null>((best, h) => {
      if (!best) return h;
      const bestDist = Math.hypot(mx - best.centerX, my - (best.y + best.height / 2));
      const dist = Math.hypot(mx - h.centerX, my - (h.y + h.height / 2));
      return dist < bestDist ? h : best;
    }, null);
    if (hit) {
      onSelectEvent({
        partIndex: hit.partIndex,
        staffIndex: hit.staffIndex,
        measureIndex: hit.measureIndex,
        voiceIndex: hit.voiceIndex,
        eventId: hit.eventId,
        source: hit.source,
        noteIndex: hit.noteIndex,
      });
      return;
    }

    // Otherwise select measure
    const geo = measureGeometries.find(
      (g) =>
        g.pageIdx === pageIdx &&
        mx >= g.x &&
        mx <= g.x + g.width &&
        my >= g.topLineY - 28 &&
        my <= g.bottomLineY + 28
    );
    if (geo) {
      onSelectMeasure(geo.partIndex, geo.staffIndex, geo.measureIndex);
    }
  };

  // Compute active playhead line coordinates
  const activePlayheadPos = useMemo(() => {
    if (!isPlaying || !playhead) return null;
    const geo = measureGeometries.find(
      (g) => g.partIndex === 0 && g.staffIndex === 0 && g.measureIndex === playhead.measureIndex
    );
    if (!geo) return null;
    const progress = Math.max(0, Math.min(1, playhead.beatInMeasure / Math.max(0.5, geo.capacityBeats)));
    const startX = geo.noteStartX + 6;
    const endX = geo.x + geo.width - 12;
    const x = startX + progress * Math.max(20, endX - startX);
    return {
      pageIdx: geo.pageIdx,
      x,
      topY: geo.systemTopY,
      bottomY: geo.systemBottomY,
    };
  }, [isPlaying, playhead, measureGeometries]);

  const scaledWidth = Math.round(PAGE_WIDTH * zoom);
  const hoverGhostLabel = hoverGhost
    ? hoverGhost.clef === 'percussion'
      ? drumLabelForPitch(hoverGhost.pitch)
      : formatPitchName(hoverGhost.pitch)
    : '';
  const hoverGhostTagWidth = Math.max(34, hoverGhostLabel.length * 6 + 12);

  return (
    <div
      className="score-scroll-area relative flex-1 overflow-auto bg-[var(--bg-canvas)] p-6 sm:p-10 flex flex-col items-center gap-8 select-none"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileDrop(file);
      }}
    >
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-blue-950/70 backdrop-blur-xs flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--bg-panel)] border border-blue-500 rounded-xl px-8 py-6 text-center shadow-2xl">
            <p className="text-base font-semibold text-[var(--text-strong)]">Drop score file to open in OpusWeb</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Supports .mscz, .mscx, .musicxml, .mxl, .xml, .mid, and .json
            </p>
          </div>
        </div>
      )}

      {layoutPages.map((page) => {
        const scaledHeight = Math.round(page.height * zoom);
        const pageHits = hitTargets.filter((h) => h.pageIdx === page.pageIdx);
        const matchingHits = selection?.eventId
          ? pageHits.filter(
              (h) =>
                h.eventId === selection.eventId &&
                h.partIndex === selection.partIndex &&
                h.staffIndex === selection.staffIndex &&
                h.measureIndex === selection.measureIndex
            )
          : [];
        const selectedHit =
          matchingHits.find(
            (h) =>
              (!selection?.source || h.source === selection.source) &&
              (selection?.noteIndex === undefined || h.noteIndex === selection.noteIndex)
          ) ||
          matchingHits[0] ||
          null;
        const selectedMeasureGeo =
          selection && !selection.eventId
            ? measureGeometries.find(
                (g) =>
                  g.pageIdx === page.pageIdx &&
                  g.partIndex === selection.partIndex &&
                  g.staffIndex === selection.staffIndex &&
                  g.measureIndex === selection.measureIndex
              )
            : null;

        return (
          <div
            key={page.pageIdx}
            className="score-page-sheet relative bg-[#FFFFFF] text-[#111827] shadow-[0_18px_50px_rgba(0,0,0,0.45)] border border-slate-200 shrink-0"
            style={{
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
            }}
          >
            {/* Header engraved on Page 1 */}
            {page.hasHeader && (
              <div
                className="absolute inset-x-0 top-0 pointer-events-none"
                style={{
                  padding: `${Math.round(36 * zoom)}px ${Math.round(MARGIN_X * zoom)}px 0`,
                }}
              >
                <h1
                  className="font-serif-score font-bold text-center text-[#0F172A] leading-tight truncate"
                  style={{ fontSize: `${Math.round(28 * zoom)}px` }}
                >
                  {score.title || 'Untitled Score'}
                </h1>
                {score.subtitle && (
                  <p
                    className="font-serif-score text-center text-[#475569] mt-1 truncate"
                    style={{ fontSize: `${Math.round(13 * zoom)}px` }}
                  >
                    {score.subtitle}
                  </p>
                )}
                {score.composer && (
                  <p
                    className="font-serif-score italic text-right text-[#334155] mt-1 truncate"
                    style={{ fontSize: `${Math.round(13 * zoom)}px` }}
                  >
                    {score.composer}
                  </p>
                )}
              </div>
            )}

            {/* VexFlow SVG target */}
            <div
              ref={(el) => {
                containerRefs.current[page.pageIdx] = el;
              }}
              className="absolute inset-0 w-full h-full"
            />

            {/* Interactive SVG Overlay */}
            <svg
              viewBox={`0 0 ${PAGE_WIDTH} ${page.height}`}
              className={`no-print absolute inset-0 w-full h-full ${
                toolState.noteInputMode ? 'cursor-crosshair' : 'cursor-pointer'
              }`}
              onMouseMove={(e) => handleSvgMouseMove(e, page.pageIdx)}
              onMouseLeave={() => setHoverGhost(null)}
              onClick={(e) => handleOverlayClick(e, page.pageIdx)}
            >
              {/* Lead-sheet chord symbols above the top staff */}
              {measureGeometries
                .filter(
                  (geo) =>
                    geo.pageIdx === page.pageIdx && geo.partIndex === 0 && geo.staffIndex === 0
                )
                .map((geo) => {
                  const measure = score.parts[0]?.staves[0]?.measures[geo.measureIndex];
                  const chords = measure?.chordSymbols;
                  if (!chords || chords.length === 0) return null;

                  const startX = geo.noteStartX + 6;
                  const endX = geo.x + geo.width - 14;
                  const span = Math.max(20, endX - startX);

                  return sortedChords(chords).map((chord) => {
                    const offset = Math.max(0, Math.min(geo.capacityBeats, chord.beat));
                    const x =
                      startX +
                      (offset / Math.max(0.25, geo.capacityBeats)) * span;

                    return (
                      <text
                        key={`chord-${geo.measureIndex}-${chord.id}`}
                        x={x}
                        y={geo.topLineY - 24}
                        fill="#0F172A"
                        stroke="#FFFFFF"
                        strokeWidth={3}
                        paintOrder="stroke"
                        fontSize={13}
                        fontWeight={700}
                        fontFamily="Lora, Georgia, serif"
                        style={{ pointerEvents: 'none' }}
                      >
                        {chord.symbol}
                      </text>
                    );
                  });
                })}

              {/* Selected measure subtle frame */}
              {selectedMeasureGeo && (
                <rect
                  x={selectedMeasureGeo.x + 2}
                  y={selectedMeasureGeo.topLineY - 12}
                  width={Math.max(10, selectedMeasureGeo.width - 4)}
                  height={selectedMeasureGeo.bottomLineY - selectedMeasureGeo.topLineY + 24}
                  rx={4}
                  fill="rgba(37, 99, 235, 0.06)"
                  stroke="#2563EB"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}

              {/* Selected note/rest highlight */}
              {selectedHit && (
                <rect
                  x={selectedHit.x}
                  y={selectedHit.y}
                  width={selectedHit.width}
                  height={selectedHit.height}
                  rx={4}
                  fill="rgba(37, 99, 235, 0.14)"
                  stroke="#2563EB"
                  strokeWidth={1.75}
                />
              )}

              {/* Note Input Mode Ghost Cursor */}
              {hoverGhost && hoverGhost.pageIdx === page.pageIdx && (
                <g className="pointer-events-none">
                  {/* Ledger lines if outside 5-line staff */}
                  {hoverGhost.stepsFromBottomLine < 0 &&
                    Array.from({
                      length: Math.floor(Math.abs(hoverGhost.stepsFromBottomLine) / 2),
                    }).map((_, idx) => {
                      const ly = hoverGhost.bottomLineY + (idx + 1) * hoverGhost.lineSpacing;
                      return (
                        <line
                          key={`lb-${idx}`}
                          x1={hoverGhost.x - 10}
                          x2={hoverGhost.x + 10}
                          y1={ly}
                          y2={ly}
                          stroke="#2563EB"
                          strokeWidth={1.4}
                          opacity={0.75}
                        />
                      );
                    })}
                  {hoverGhost.stepsFromBottomLine > 8 &&
                    Array.from({
                      length: Math.floor((hoverGhost.stepsFromBottomLine - 8) / 2),
                    }).map((_, idx) => {
                      const ly = hoverGhost.topLineY - (idx + 1) * hoverGhost.lineSpacing;
                      return (
                        <line
                          key={`lt-${idx}`}
                          x1={hoverGhost.x - 10}
                          x2={hoverGhost.x + 10}
                          y1={ly}
                          y2={ly}
                          stroke="#2563EB"
                          strokeWidth={1.4}
                          opacity={0.75}
                        />
                      );
                    })}

                  {/* Ghost Notehead */}
                  <ellipse
                    cx={hoverGhost.x}
                    cy={hoverGhost.y}
                    rx={6.5}
                    ry={4.6}
                    transform={`rotate(-18 ${hoverGhost.x} ${hoverGhost.y})`}
                    fill={
                      toolState.duration === 'whole' || toolState.duration === 'half'
                        ? 'rgba(37,99,235,0.18)'
                        : 'rgba(37,99,235,0.68)'
                    }
                    stroke="#2563EB"
                    strokeWidth={1.6}
                  />
                  {/* Pitch Tag */}
                  <g transform={`translate(${hoverGhost.x + 12}, ${hoverGhost.y - 16})`}>
                    <rect
                      x={0}
                      y={0}
                      width={hoverGhostTagWidth}
                      height={18}
                      rx={3}
                      fill="#1E293B"
                    />
                    <text
                      x={hoverGhostTagWidth / 2}
                      y={12.5}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize={10}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={600}
                    >
                      {hoverGhostLabel}
                    </text>
                  </g>
                </g>
              )}

              {/* Live Audio Playback Playhead */}
              {activePlayheadPos && activePlayheadPos.pageIdx === page.pageIdx && (
                <line
                  x1={activePlayheadPos.x}
                  x2={activePlayheadPos.x}
                  y1={activePlayheadPos.topY}
                  y2={activePlayheadPos.bottomY}
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  opacity={0.85}
                />
              )}
            </svg>

            {/* Page Number Footer */}
            {pageView && (
              <div
                className="absolute bottom-3 inset-x-0 text-center text-[var(--text-muted)] font-mono-tabular pointer-events-none"
                style={{ fontSize: `${Math.max(10, Math.round(11 * zoom))}px` }}
              >
                {page.pageIdx + 1} / {layoutPages.length}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
