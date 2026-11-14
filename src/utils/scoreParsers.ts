import JSZip from 'jszip';
import {
  ArticulationType,
  BarlineType,
  ClefType,
  DurationType,
  DynamicType,
  InstrumentTimbre,
  Measure,
  NoteHead,
  NoteStep,
  Part,
  Pitch,
  ScoreDocument,
  Staff,
  VoiceEvent,
} from '../types/score';
import {
  alterToAccidentalType,
  createMeasureRest,
  fillDurationWithRests,
  getEventBeats,
  getMeasureCapacityBeats,
  midiToPitch,
  uid,
} from './musicTheory';

function guessTimbreFromName(name: string): InstrumentTimbre {
  const lower = name.toLowerCase();
  if (lower.includes('piano') || lower.includes('harpsichord') || lower.includes('organ') || lower.includes('keyboard')) {
    return 'piano';
  }
  if (lower.includes('violin') || lower.includes('viola') || lower.includes('cello') || lower.includes('contrabass') || lower.includes('string')) {
    return 'strings';
  }
  if (lower.includes('flute') || lower.includes('clarinet') || lower.includes('oboe') || lower.includes('bassoon') || lower.includes('sax')) {
    return 'woodwind';
  }
  if (lower.includes('trumpet') || lower.includes('horn') || lower.includes('trombone') || lower.includes('tuba') || lower.includes('brass')) {
    return 'brass';
  }
  if (lower.includes('guitar') || lower.includes('ukulele') || lower.includes('harp') || lower.includes('lute')) {
    return 'guitar';
  }
  if (lower.includes('voice') || lower.includes('soprano') || lower.includes('alto') || lower.includes('tenor') || lower.includes('bass') || lower.includes('choir') || lower.includes('vocal')) {
    return 'voice';
  }
  return 'piano';
}

function mapDurationName(name: string | null | undefined): DurationType {
  const d = (name || '').toLowerCase().trim();
  if (d === 'whole' || d === 'breve' || d === 'long') return 'whole';
  if (d === 'half') return 'half';
  if (d === 'quarter') return 'quarter';
  if (d === 'eighth') return 'eighth';
  if (d === '16th' || d === 'sixteenth') return '16th';
  if (d === '32nd' || d === '64th' || d === '128th') return '32nd';
  return 'quarter';
}

function mapClefType(sign: string | null | undefined, line?: number, mscxClef?: string | null): ClefType {
  if (mscxClef) {
    const c = mscxClef.toUpperCase();
    if (c.startsWith('F')) return 'bass';
    if (c === 'C3') return 'alto';
    if (c === 'C4') return 'tenor';
    return 'treble';
  }
  const s = (sign || 'G').toUpperCase();
  if (s === 'F') return 'bass';
  if (s === 'C') {
    if (line === 4) return 'tenor';
    return 'alto';
  }
  return 'treble';
}

function tpcToStepAlter(tpc: number): { step: NoteStep; alter: number } {
  const fifthsSteps: NoteStep[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  // tpc 13 = F natural, 14 = C natural, 15 = G natural, 16 = D, 17 = A, 18 = E, 19 = B
  const offset = tpc - 13;
  const idx = ((offset % 7) + 7) % 7;
  const alter = Math.floor(offset / 7);
  return {
    step: fifthsSteps[idx],
    alter: Math.max(-2, Math.min(2, alter)),
  };
}

function mscxPitchToPitch(midi: number, tpcStr: string | null, keyFifths: number): Pitch {
  if (tpcStr !== null && tpcStr !== undefined && tpcStr !== '') {
    const tpc = Number(tpcStr);
    if (!Number.isNaN(tpc) && tpc >= -1 && tpc <= 33) {
      const { step, alter } = tpcToStepAlter(tpc);
      const stepSemitones: Record<NoteStep, number> = {
        C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
      };
      const octave = Math.round((midi - stepSemitones[step] - alter) / 12) - 1;
      return {
        step,
        alter,
        octave: Math.max(0, Math.min(8, octave)),
      };
    }
  }
  return midiToPitch(midi, keyFifths);
}

/**
 * Parse MuseScore .mscx XML string into ScoreDocument
 */
export function parseMscx(xmlText: string, sourceLabel = 'MuseScore File'): ScoreDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) {
    throw new Error('Invalid MuseScore (.mscx) XML structure.');
  }

  const scoreEl = doc.querySelector('Score');
  if (!scoreEl) {
    throw new Error('Missing <Score> root element in .mscx file.');
  }

  let title = 'Untitled Score';
  let subtitle = '';
  let composer = '';
  let arranger = '';

  scoreEl.querySelectorAll(':scope > metaTag').forEach((tag) => {
    const name = tag.getAttribute('name');
    const val = tag.textContent?.trim() || '';
    if (name === 'workTitle' && val) title = val;
    if (name === 'subtitle' && val) subtitle = val;
    if (name === 'composer' && val) composer = val;
    if (name === 'arranger' && val) arranger = val;
  });

  // Fallback check VBox text frames for title/composer if metaTags are empty
  if (title === 'Untitled Score' || !composer) {
    scoreEl.querySelectorAll('VBox > Text').forEach((textEl) => {
      const style = textEl.querySelector('style')?.textContent?.toLowerCase() || '';
      const txt = textEl.querySelector('text')?.textContent?.trim() || '';
      if (style === 'title' && txt && title === 'Untitled Score') title = txt;
      if (style === 'subtitle' && txt && !subtitle) subtitle = txt;
      if (style === 'composer' && txt && !composer) composer = txt;
    });
  }

  // Parse Parts & Staff mapping
  const partEls = Array.from(scoreEl.querySelectorAll(':scope > Part'));
  const staffToPartMeta = new Map<string, { partIdx: number; staffIdx: number; defaultClef: ClefType }>();
  const parts: Part[] = [];

  partEls.forEach((pEl, pIdx) => {
    const trackName =
      pEl.querySelector(':scope > trackName')?.textContent?.trim() ||
      pEl.querySelector(':scope > Instrument > longName')?.textContent?.trim() ||
      `Instrument ${pIdx + 1}`;
    const shortName =
      pEl.querySelector(':scope > Instrument > shortName')?.textContent?.trim() ||
      trackName.slice(0, 4);

    const staffEls = Array.from(pEl.querySelectorAll(':scope > Staff'));
    const staves: Staff[] = [];
    staffEls.forEach((sEl, sIdx) => {
      const staffId = sEl.getAttribute('id') || String(staffToPartMeta.size + 1);
      const defaultClefAttr = sEl.querySelector('defaultClef')?.textContent?.trim();
      const clef = mapClefType(undefined, undefined, defaultClefAttr || (sIdx === 1 ? 'F' : 'G'));
      staffToPartMeta.set(staffId, { partIdx: pIdx, staffIdx: sIdx, defaultClef: clef });
      staves.push({
        id: uid('staff'),
        clef,
        measures: [],
      });
    });

    if (staves.length === 0) {
      const staffId = String(staffToPartMeta.size + 1);
      staffToPartMeta.set(staffId, { partIdx: pIdx, staffIdx: 0, defaultClef: 'treble' });
      staves.push({ id: uid('staff'), clef: 'treble', measures: [] });
    }

    const timbre = guessTimbreFromName(trackName);
    parts.push({
      id: uid('part'),
      name: trackName,
      shortName,
      timbre,
      volume: 0.85,
      muted: false,
      solo: false,
      showTab: timbre === 'guitar',
      staves,
    });
  });

  // Parse <Score> > <Staff id="..."> > <Measure>
  let defaultTempo = 120;
  let foundInitialTempo = false;
  const scoreStaffEls = Array.from(scoreEl.querySelectorAll(':scope > Staff'));

  scoreStaffEls.forEach((staffEl) => {
    const staffId = staffEl.getAttribute('id') || '1';
    const meta = staffToPartMeta.get(staffId);
    if (!meta) return;

    const targetPart = parts[meta.partIdx];
    const targetStaff = targetPart.staves[meta.staffIdx];

    let runningKeyFifths = 0;
    let runningBeats = 4;
    let runningBeatType = 4;

    const measureEls = Array.from(staffEl.querySelectorAll(':scope > Measure'));
    measureEls.forEach((mEl, mIdx) => {
      const attrs: Measure['attributes'] = {};
      if (mIdx === 0) {
        attrs.clef = targetStaff.clef;
      }

      const voiceEls = Array.from(mEl.querySelectorAll(':scope > voice'));
      const parsedVoices: VoiceEvent[][] = [];

      // Check barline tags directly inside Measure or voice
      if (mEl.querySelector('startRepeat')) {
        attrs.barlineLeft = 'repeat-begin';
      }
      if (mEl.querySelector('endRepeat')) {
        attrs.barlineRight = 'repeat-end';
      }

      voiceEls.forEach((vEl, vIdx) => {
        const events: VoiceEvent[] = [];
        let pendingDynamic: DynamicType | undefined;

        for (const child of Array.from(vEl.children)) {
          const tag = child.tagName;

          if (tag === 'KeySig') {
            const acc = Number(child.querySelector('accidental')?.textContent ?? child.querySelector('concertKey')?.textContent ?? '0');
            if (!Number.isNaN(acc)) {
              runningKeyFifths = Math.max(-7, Math.min(7, acc));
              attrs.keyFifths = runningKeyFifths;
            }
          } else if (tag === 'TimeSig') {
            const sigN = Number(child.querySelector('sigN')?.textContent ?? '4');
            const sigD = Number(child.querySelector('sigD')?.textContent ?? '4');
            if (sigN > 0 && sigD > 0) {
              runningBeats = sigN;
              runningBeatType = sigD;
              attrs.timeSignature = { beats: sigN, beatType: sigD };
            }
          } else if (tag === 'Clef') {
            const cType = child.querySelector('concertClefType')?.textContent || child.querySelector('transposingClefType')?.textContent;
            const mapped = mapClefType(undefined, undefined, cType);
            attrs.clef = mapped;
            if (mIdx === 0) targetStaff.clef = mapped;
          } else if (tag === 'Tempo') {
            const tempoVal = Number(child.querySelector('tempo')?.textContent ?? '2');
            if (!Number.isNaN(tempoVal) && tempoVal > 0) {
              // MuseScore stores tempo in beats-per-second (quarter notes per second)
              const bpm = Math.round(tempoVal * 60);
              attrs.tempo = bpm;
              if (!foundInitialTempo) {
                defaultTempo = bpm;
                foundInitialTempo = true;
              }
            }
          } else if (tag === 'Dynamic') {
            const sub = (child.querySelector('subtype')?.textContent?.trim() || '').toLowerCase();
            if (['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sfz'].includes(sub)) {
              pendingDynamic = sub as DynamicType;
            }
          } else if (tag === 'BarLine') {
            const sub = child.querySelector('subtype')?.textContent?.trim();
            if (sub === 'double') attrs.barlineRight = 'double';
            if (sub === 'end') attrs.barlineRight = 'end';
            if (sub === 'start-repeat') attrs.barlineLeft = 'repeat-begin';
            if (sub === 'end-repeat') attrs.barlineRight = 'repeat-end';
          } else if (tag === 'Rest') {
            const durText = child.querySelector('durationType')?.textContent?.trim();
            const dotsCount = Math.min(2, Number(child.querySelector('dots')?.textContent ?? '0')) as 0 | 1 | 2;
            if (durText === 'measure') {
              const cap = getMeasureCapacityBeats(runningBeats, runningBeatType);
              events.push(...createMeasureRest(cap));
            } else {
              events.push({
                id: uid('rest'),
                isRest: true,
                duration: mapDurationName(durText),
                dots: dotsCount,
                notes: [],
              });
            }
          } else if (tag === 'Chord') {
            const durText = child.querySelector('durationType')?.textContent?.trim();
            const dotsCount = Math.min(2, Number(child.querySelector('dots')?.textContent ?? '0')) as 0 | 1 | 2;
            const duration = mapDurationName(durText);
            const noteEls = Array.from(child.querySelectorAll(':scope > Note'));
            const notes: NoteHead[] = noteEls.map((nEl) => {
              const midi = Number(nEl.querySelector('pitch')?.textContent ?? '60');
              const tpcText = nEl.querySelector('tpc')?.textContent ?? null;
              const pitch = mscxPitchToPitch(Number.isNaN(midi) ? 60 : midi, tpcText, runningKeyFifths);
              const tieStart = Boolean(nEl.querySelector('Spanner[type="Tie"] > next'));
              const tieStop = Boolean(nEl.querySelector('Spanner[type="Tie"] > prev'));
              return {
                id: uid('n'),
                pitch,
                tieStart,
                tieStop,
              };
            });

            const articulations: ArticulationType[] = [];
            child.querySelectorAll(':scope > Articulation').forEach((artEl) => {
              const sub = (artEl.querySelector('subtype')?.textContent || '').toLowerCase();
              if (sub.includes('staccato')) articulations.push('staccato');
              else if (sub.includes('accent')) articulations.push('accent');
              else if (sub.includes('tenuto')) articulations.push('tenuto');
              else if (sub.includes('marcato')) articulations.push('marcato');
              else if (sub.includes('fermata')) articulations.push('fermata');
            });

            const lyric = child.querySelector(':scope > Lyrics > text')?.textContent?.trim() || undefined;

            if (notes.length > 0) {
              events.push({
                id: uid('ev'),
                isRest: false,
                duration,
                dots: dotsCount,
                notes,
                articulations: articulations.length ? articulations : undefined,
                dynamic: pendingDynamic,
                lyric,
              });
              pendingDynamic = undefined;
            }
          }
        }

        if (events.length > 0 || vIdx === 0) {
          if (events.length === 0) {
            events.push(...createMeasureRest(getMeasureCapacityBeats(runningBeats, runningBeatType)));
          }
          parsedVoices.push(events);
        }
      });

      if (parsedVoices.length === 0) {
        parsedVoices.push(createMeasureRest(getMeasureCapacityBeats(runningBeats, runningBeatType)));
      }

      targetStaff.measures.push({
        id: uid('m'),
        attributes: attrs,
        voices: parsedVoices,
      });
    });
  });

  if (parts.length === 0) {
    throw new Error('No parts found in MuseScore file.');
  }

  return {
    id: uid('score'),
    title,
    subtitle,
    composer,
    arranger,
    defaultTempo,
    parts,
    updatedAt: Date.now(),
    sourceLabel,
  };
}

/**
 * Parse MusicXML (.musicxml / .xml) string into ScoreDocument
 */
export function parseMusicXml(xmlText: string, sourceLabel = 'MusicXML File'): ScoreDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid MusicXML structure.');
  }

  const root = doc.documentElement;
  if (!root || (root.tagName !== 'score-partwise' && root.tagName !== 'score-timewise')) {
    throw new Error('Unsupported XML root element (expected <score-partwise>).');
  }

  const title =
    doc.querySelector('work > work-title')?.textContent?.trim() ||
    doc.querySelector('movement-title')?.textContent?.trim() ||
    'Untitled Score';
  const subtitle = doc.querySelector('movement-number')?.textContent?.trim() || '';
  const composer =
    doc.querySelector('identification > creator[type="composer"]')?.textContent?.trim() ||
    doc.querySelector('identification > creator')?.textContent?.trim() ||
    '';

  const partMetaMap = new Map<string, { name: string; shortName: string }>();
  doc.querySelectorAll('part-list > score-part').forEach((sp) => {
    const id = sp.getAttribute('id') || '';
    const name = sp.querySelector('part-name')?.textContent?.trim() || id || 'Instrument';
    const shortName = sp.querySelector('part-abbreviation')?.textContent?.trim() || name.slice(0, 4);
    partMetaMap.set(id, { name, shortName });
  });

  let defaultTempo = 120;
  let foundTempo = false;
  const parts: Part[] = [];

  const partEls = Array.from(doc.querySelectorAll(':scope > part'));
  partEls.forEach((pEl, pIdx) => {
    const partId = pEl.getAttribute('id') || `P${pIdx + 1}`;
    const meta = partMetaMap.get(partId) || { name: `Part ${pIdx + 1}`, shortName: `P${pIdx + 1}` };

    // Determine number of staves in this part
    let maxStaves = 1;
    const stavesAttr = pEl.querySelector('attributes > staves')?.textContent;
    if (stavesAttr && Number(stavesAttr) > 1) {
      maxStaves = Math.min(2, Number(stavesAttr));
    }

    const staves: Staff[] = Array.from({ length: maxStaves }, (_, idx) => ({
      id: uid('staff'),
      clef: idx === 1 ? 'bass' : 'treble',
      measures: [],
    }));

    let divisions = 1;
    let runningBeats = 4;
    let runningBeatType = 4;

    const measureEls = Array.from(pEl.querySelectorAll(':scope > measure'));
    measureEls.forEach((mEl, mIdx) => {
      const staffVoices: Map<number, Map<number, VoiceEvent[]>> = new Map();
      for (let s = 0; s < maxStaves; s++) {
        staffVoices.set(s, new Map([[0, []]]));
      }

      const staffAttrs: Measure['attributes'][] = Array.from({ length: maxStaves }, () => ({}));

      // Attributes
      const attrEl = mEl.querySelector(':scope > attributes');
      if (attrEl) {
        const divText = attrEl.querySelector('divisions')?.textContent;
        if (divText && Number(divText) > 0) divisions = Number(divText);

        const fifthsText = attrEl.querySelector('key > fifths')?.textContent;
        if (fifthsText !== undefined && fifthsText !== null) {
          const fifths = Math.max(-7, Math.min(7, Number(fifthsText)));
          staffAttrs.forEach((a) => {
            a.keyFifths = fifths;
          });
        }

        const beatsText = attrEl.querySelector('time > beats')?.textContent;
        const beatTypeText = attrEl.querySelector('time > beat-type')?.textContent;
        if (beatsText && beatTypeText) {
          runningBeats = Number(beatsText) || 4;
          runningBeatType = Number(beatTypeText) || 4;
          staffAttrs.forEach((a) => {
            a.timeSignature = { beats: runningBeats, beatType: runningBeatType };
          });
        }

        attrEl.querySelectorAll('clef').forEach((clefEl) => {
          const num = Math.max(1, Number(clefEl.getAttribute('number') || '1')) - 1;
          const sign = clefEl.querySelector('sign')?.textContent;
          const line = Number(clefEl.querySelector('line')?.textContent || '2');
          const mapped = mapClefType(sign, line);
          if (num < maxStaves) {
            staffAttrs[num].clef = mapped;
            if (mIdx === 0) staves[num].clef = mapped;
          }
        });
      }

      // Barlines
      mEl.querySelectorAll(':scope > barline').forEach((bEl) => {
        const loc = bEl.getAttribute('location') || 'right';
        const style = bEl.querySelector('bar-style')?.textContent?.trim();
        const repeatDir = bEl.querySelector('repeat')?.getAttribute('direction');
        let barType: BarlineType | undefined;
        if (repeatDir === 'forward') barType = 'repeat-begin';
        else if (repeatDir === 'backward') barType = 'repeat-end';
        else if (style === 'light-light') barType = 'double';
        else if (style === 'light-heavy') barType = 'end';

        if (barType) {
          staffAttrs.forEach((a) => {
            if (loc === 'left') a.barlineLeft = barType;
            else a.barlineRight = barType;
          });
        }
      });

      let pendingDynamic: DynamicType | undefined;

      // Directions (tempo / dynamics)
      mEl.querySelectorAll(':scope > direction').forEach((dEl) => {
        const soundTempo = dEl.querySelector('sound')?.getAttribute('tempo');
        if (soundTempo && Number(soundTempo) > 0) {
          const bpm = Math.round(Number(soundTempo));
          staffAttrs[0].tempo = bpm;
          if (!foundTempo) {
            defaultTempo = bpm;
            foundTempo = true;
          }
        }
        const dynEl = dEl.querySelector('direction-type > dynamics');
        if (dynEl && dynEl.firstElementChild) {
          const dynTag = dynEl.firstElementChild.tagName.toLowerCase();
          if (['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sfz'].includes(dynTag)) {
            pendingDynamic = dynTag as DynamicType;
          }
        }
      });

      // Notes
      mEl.querySelectorAll(':scope > note').forEach((nEl) => {
        if (nEl.querySelector('grace')) return; // Skip grace notes to preserve beat alignment
        const staffNum = Math.min(maxStaves - 1, Math.max(0, Number(nEl.querySelector('staff')?.textContent || '1') - 1));
        const voiceRaw = Number(nEl.querySelector('voice')?.textContent || '1');
        // MusicXML often uses voice 1-4 on staff 1, voice 5-8 on staff 2
        const voiceIdx = staffNum === 0 ? (voiceRaw > 1 ? 1 : 0) : (voiceRaw > 5 ? 1 : 0);

        const voiceMap = staffVoices.get(staffNum)!;
        if (!voiceMap.has(voiceIdx)) voiceMap.set(voiceIdx, []);
        const targetList = voiceMap.get(voiceIdx)!;

        const isChord = Boolean(nEl.querySelector('chord'));
        const isRest = Boolean(nEl.querySelector('rest'));

        const xmlType = nEl.querySelector('type')?.textContent?.trim();
        const dots = Math.min(2, nEl.querySelectorAll('dot').length) as 0 | 1 | 2;
        let duration: DurationType;
        if (xmlType) {
          duration = mapDurationName(xmlType);
        } else {
          const rawDur = Number(nEl.querySelector('duration')?.textContent || divisions);
          const beats = rawDur / divisions;
          if (beats >= 3.5) duration = 'whole';
          else if (beats >= 1.75) duration = 'half';
          else if (beats >= 0.8) duration = 'quarter';
          else if (beats >= 0.4) duration = 'eighth';
          else if (beats >= 0.2) duration = '16th';
          else duration = '32nd';
        }

        if (isRest) {
          const isMeasureRest = nEl.querySelector('rest')?.getAttribute('measure') === 'yes';
          if (isMeasureRest) {
            targetList.push(...createMeasureRest(getMeasureCapacityBeats(runningBeats, runningBeatType)));
          } else {
            targetList.push({
              id: uid('rest'),
              isRest: true,
              duration,
              dots,
              notes: [],
            });
          }
          return;
        }

        const pitchEl = nEl.querySelector('pitch');
        const step = (pitchEl?.querySelector('step')?.textContent?.trim() || 'C') as NoteStep;
        const alter = Number(pitchEl?.querySelector('alter')?.textContent || '0');
        const octave = Number(pitchEl?.querySelector('octave')?.textContent || '4');
        const accidentalText = nEl.querySelector('accidental')?.textContent?.trim();

        const pitch: Pitch = {
          step: ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(step) ? step : 'C',
          alter: Number.isNaN(alter) ? 0 : alter,
          octave: Number.isNaN(octave) ? 4 : octave,
          accidental:
            accidentalText === 'natural'
              ? 'natural'
              : accidentalText === 'sharp'
                ? 'sharp'
                : accidentalText === 'flat'
                  ? 'flat'
                  : alterToAccidentalType(alter),
        };

        const tieTypes = Array.from(nEl.querySelectorAll('tie')).map((t) => t.getAttribute('type'));
        const head: NoteHead = {
          id: uid('n'),
          pitch,
          tieStart: tieTypes.includes('start'),
          tieStop: tieTypes.includes('stop'),
        };

        if (isChord && targetList.length > 0 && !targetList[targetList.length - 1].isRest) {
          targetList[targetList.length - 1].notes.push(head);
          return;
        }

        const articulations: ArticulationType[] = [];
        const artEl = nEl.querySelector('notations > articulations');
        if (artEl) {
          if (artEl.querySelector('staccato')) articulations.push('staccato');
          if (artEl.querySelector('accent')) articulations.push('accent');
          if (artEl.querySelector('tenuto')) articulations.push('tenuto');
          if (artEl.querySelector('strong-accent')) articulations.push('marcato');
        }
        if (nEl.querySelector('notations > fermata')) {
          articulations.push('fermata');
        }

        const lyric = nEl.querySelector('lyric > text')?.textContent?.trim() || undefined;

        targetList.push({
          id: uid('ev'),
          isRest: false,
          duration,
          dots,
          notes: [head],
          articulations: articulations.length ? articulations : undefined,
          dynamic: pendingDynamic,
          lyric,
        });
        pendingDynamic = undefined;
      });

      // Push measures onto each staff
      for (let s = 0; s < maxStaves; s++) {
        const vMap = staffVoices.get(s)!;
        const voices: VoiceEvent[][] = [];
        const sortedKeys = Array.from(vMap.keys()).sort((a, b) => a - b);
        for (const k of sortedKeys) {
          const evs = vMap.get(k)!;
          if (evs.length === 0 && k === 0) {
            voices.push(createMeasureRest(getMeasureCapacityBeats(runningBeats, runningBeatType)));
          } else if (evs.length > 0) {
            voices.push(evs);
          }
        }
        staves[s].measures.push({
          id: uid('m'),
          attributes: staffAttrs[s],
          voices,
        });
      }
    });

    const timbre = guessTimbreFromName(meta.name);
    parts.push({
      id: uid('part'),
      name: meta.name,
      shortName: meta.shortName,
      timbre,
      volume: 0.85,
      muted: false,
      solo: false,
      showTab: timbre === 'guitar',
      staves,
    });
  });

  if (parts.length === 0) {
    throw new Error('No parts found in MusicXML document.');
  }

  return {
    id: uid('score'),
    title,
    subtitle,
    composer,
    defaultTempo,
    parts,
    updatedAt: Date.now(),
    sourceLabel,
  };
}

/**
 * Parse Standard MIDI File (.mid / .midi) binary buffer into quantized ScoreDocument
 */
export function parseMidiBuffer(buffer: ArrayBuffer, filename = 'MIDI Import.mid'): ScoreDocument {
  const view = new DataView(buffer);
  let pos = 0;

  const readStr = (len: number) => {
    let s = '';
    for (let i = 0; i < len && pos < view.byteLength; i++) {
      s += String.fromCharCode(view.getUint8(pos++));
    }
    return s;
  };
  const readU32 = () => {
    const v = view.getUint32(pos);
    pos += 4;
    return v;
  };
  const readU16 = () => {
    const v = view.getUint16(pos);
    pos += 2;
    return v;
  };
  const readU8 = () => view.getUint8(pos++);
  const readVarLen = () => {
    let value = 0;
    let b = 0;
    do {
      if (pos >= view.byteLength) break;
      b = readU8();
      value = (value << 7) | (b & 0x7f);
    } while (b & 0x80);
    return value;
  };

  if (readStr(4) !== 'MThd') {
    throw new Error('Invalid MIDI file header.');
  }
  const headerLen = readU32();
  const format = readU16();
  const trackCount = readU16();
  const ticksPerBeat = readU16();
  pos = 8 + headerLen;

  let tempo = 120;
  let beats = 4;
  let beatType = 4;
  let maxEndTicks = 0;

  interface RawMidiNote {
    midi: number;
    startTick: number;
    durationTicks: number;
  }
  const tracks: { name: string; notes: RawMidiNote[] }[] = [];

  for (let t = 0; t < trackCount && pos < view.byteLength - 8; t++) {
    const chunkId = readStr(4);
    const chunkLen = readU32();
    const trackEnd = Math.min(view.byteLength, pos + chunkLen);
    if (chunkId !== 'MTrk') {
      pos = trackEnd;
      continue;
    }

    let currentTick = 0;
    let runningStatus = 0;
    let trackName = `Track ${tracks.length + 1}`;
    const activeNotes = new Map<number, number>();
    const notes: RawMidiNote[] = [];

    while (pos < trackEnd) {
      const delta = readVarLen();
      currentTick += delta;
      if (pos >= trackEnd) break;

      let status = view.getUint8(pos);
      if (status < 0x80) {
        status = runningStatus;
      } else {
        pos++;
        if (status < 0xf0) runningStatus = status;
      }

      if (status === 0xff) {
        const metaType = readU8();
        const len = readVarLen();
        if (metaType === 0x51 && len === 3 && pos + 3 <= trackEnd) {
          const usPerBeat = (view.getUint8(pos) << 16) | (view.getUint8(pos + 1) << 8) | view.getUint8(pos + 2);
          if (usPerBeat > 0) tempo = Math.round(60_000_000 / usPerBeat);
        } else if (metaType === 0x58 && len >= 2 && pos + 2 <= trackEnd) {
          beats = view.getUint8(pos) || 4;
          beatType = Math.pow(2, view.getUint8(pos + 1)) || 4;
        } else if (metaType === 0x03 && len > 0 && pos + len <= trackEnd) {
          let n = '';
          for (let i = 0; i < len; i++) n += String.fromCharCode(view.getUint8(pos + i));
          if (n.trim()) trackName = n.trim();
        }
        pos += len;
      } else if (status === 0xf0 || status === 0xf7) {
        const len = readVarLen();
        pos += len;
      } else {
        const cmd = status & 0xf0;
        const d1 = readU8();
        const d2 = cmd === 0xc0 || cmd === 0xd0 ? 0 : readU8();

        if (cmd === 0x90 && d2 > 0) {
          activeNotes.set(d1, currentTick);
        } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
          const startTick = activeNotes.get(d1);
          if (startTick !== undefined) {
            const dur = Math.max(ticksPerBeat / 4, currentTick - startTick);
            notes.push({ midi: d1, startTick, durationTicks: dur });
            activeNotes.delete(d1);
            if (startTick + dur > maxEndTicks) maxEndTicks = startTick + dur;
          }
        }
      }
    }

    // Close hanging notes
    activeNotes.forEach((startTick, midi) => {
      const dur = ticksPerBeat;
      notes.push({ midi, startTick, durationTicks: dur });
      if (startTick + dur > maxEndTicks) maxEndTicks = startTick + dur;
    });

    pos = trackEnd;
    if (notes.length > 0 || (format === 0 && tracks.length === 0)) {
      tracks.push({ name: trackName, notes });
    }
  }

  const measureCapBeats = getMeasureCapacityBeats(beats, beatType);
  const totalMeasures = Math.max(4, Math.ceil(maxEndTicks / (ticksPerBeat * measureCapBeats)));

  const parts: Part[] = (tracks.length > 0 ? tracks : [{ name: 'Piano', notes: [] }]).slice(0, 6).map((tr, idx) => {
    // Quantize notes to 16th-note grid (0.25 beats)
    const avgMidi =
      tr.notes.length > 0 ? tr.notes.reduce((s, n) => s + n.midi, 0) / tr.notes.length : 64;
    const clef: ClefType = avgMidi < 57 ? 'bass' : 'treble';

    const measures: Measure[] = [];
    for (let m = 0; m < totalMeasures; m++) {
      const mStartBeat = m * measureCapBeats;
      const mEndBeat = mStartBeat + measureCapBeats;
      const notesInMeasure = tr.notes
        .map((n) => ({
          midi: n.midi,
          startBeat: Math.round((n.startTick / ticksPerBeat) * 4) / 4,
          durBeats: Math.max(0.25, Math.round((n.durationTicks / ticksPerBeat) * 4) / 4),
        }))
        .filter((n) => n.startBeat >= mStartBeat - 0.01 && n.startBeat < mEndBeat - 0.01);

      // Group simultaneous quantized starts into chords
      const groups = new Map<number, { midi: number; durBeats: number }[]>();
      notesInMeasure.forEach((n) => {
        const rel = Math.round((n.startBeat - mStartBeat) * 4) / 4;
        const clampedRel = Math.max(0, Math.min(measureCapBeats - 0.25, rel));
        if (!groups.has(clampedRel)) groups.set(clampedRel, []);
        groups.get(clampedRel)!.push({ midi: n.midi, durBeats: n.durBeats });
      });

      const sortedStarts = Array.from(groups.keys()).sort((a, b) => a - b);
      const events: VoiceEvent[] = [];
      let cursor = 0;

      for (let i = 0; i < sortedStarts.length; i++) {
        const start = sortedStarts[i];
        if (start > cursor + 0.01) {
          events.push(...fillDurationWithRests(start - cursor));
          cursor = start;
        }
        const nextStart = i + 1 < sortedStarts.length ? sortedStarts[i + 1] : measureCapBeats;
        const maxSlot = Math.max(0.25, nextStart - start);
        const chordNotes = groups.get(start)!;
        const desiredDur = Math.min(maxSlot, chordNotes[0].durBeats);

        const bestMatch = (
          [
            { d: 'whole', dots: 0, b: 4 },
            { d: 'half', dots: 1, b: 3 },
            { d: 'half', dots: 0, b: 2 },
            { d: 'quarter', dots: 1, b: 1.5 },
            { d: 'quarter', dots: 0, b: 1 },
            { d: 'eighth', dots: 1, b: 0.75 },
            { d: 'eighth', dots: 0, b: 0.5 },
            { d: '16th', dots: 0, b: 0.25 },
          ] as { d: DurationType; dots: 0 | 1; b: number }[]
        ).find((cand) => cand.b <= desiredDur + 0.01) || { d: '16th' as DurationType, dots: 0 as const, b: 0.25 };

        events.push({
          id: uid('ev'),
          isRest: false,
          duration: bestMatch.d,
          dots: bestMatch.dots,
          notes: chordNotes.map((cn) => ({
            id: uid('n'),
            pitch: midiToPitch(cn.midi, 0),
          })),
        });
        cursor = start + bestMatch.b;
      }

      if (cursor < measureCapBeats - 0.01) {
        if (events.length === 0) {
          events.push(...createMeasureRest(measureCapBeats));
        } else {
          events.push(...fillDurationWithRests(measureCapBeats - cursor));
        }
      }

      // Normalize if sum slightly drifted
      const total = events.reduce((s, e) => s + getEventBeats(e), 0);
      if (total > measureCapBeats + 0.01) {
        // Fallback safe measure rest
        measures.push({
          id: uid('m'),
          attributes:
            m === 0
              ? { clef, keyFifths: 0, timeSignature: { beats, beatType }, tempo }
              : {},
          voices: [createMeasureRest(measureCapBeats)],
        });
      } else {
        measures.push({
          id: uid('m'),
          attributes:
            m === 0
              ? { clef, keyFifths: 0, timeSignature: { beats, beatType }, tempo }
              : {},
          voices: [events],
        });
      }
    }

    return {
      id: uid('part'),
      name: tr.name || `Instrument ${idx + 1}`,
      shortName: (tr.name || `P${idx + 1}`).slice(0, 4),
      timbre: guessTimbreFromName(tr.name),
      volume: 0.85,
      muted: false,
      solo: false,
      staves: [{ id: uid('staff'), clef, measures }],
    };
  });

  const cleanTitle = filename.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ');

  return {
    id: uid('score'),
    title: cleanTitle || 'MIDI Score',
    subtitle: 'Imported from MIDI',
    composer: '',
    defaultTempo: tempo,
    parts,
    updatedAt: Date.now(),
    sourceLabel: 'MIDI Import',
  };
}

/**
 * Universal score importer handling .mscz, .mscx, .musicxml, .mxl, .xml, .mid, .midi, .json
 */
export async function importScoreFromBuffer(
  buffer: ArrayBuffer,
  filename: string,
  sourceLabel = 'Local File'
): Promise<ScoreDocument> {
  const lower = filename.toLowerCase();

  // Check ZIP signature PK\x03\x04 for .mscz / .mxl even if filename lacks extension
  const headerBytes = new Uint8Array(buffer.slice(0, 4));
  const isZip = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b;

  if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
    return parseMidiBuffer(buffer, filename);
  }

  if (lower.endsWith('.json')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    const parsed = JSON.parse(text) as ScoreDocument;
    if (!parsed.parts || !Array.isArray(parsed.parts)) {
      throw new Error('Invalid OpusWeb JSON score format.');
    }
    return { ...parsed, id: uid('score'), updatedAt: Date.now(), sourceLabel };
  }

  if (lower.endsWith('.mscz') || lower.endsWith('.mxl') || isZip) {
    const zip = await JSZip.loadAsync(buffer);
    // Locate rootfile via META-INF/container.xml if present
    let targetPath: string | null = null;
    const containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
      const containerXml = await containerFile.async('text');
      const match = containerXml.match(/full-path="([^"]+)"/i);
      if (match?.[1] && zip.file(match[1])) {
        targetPath = match[1];
      }
    }

    if (!targetPath) {
      const candidates = Object.keys(zip.files).filter(
        (name) =>
          !zip.files[name].dir &&
          (name.toLowerCase().endsWith('.mscx') ||
            name.toLowerCase().endsWith('.musicxml') ||
            (name.toLowerCase().endsWith('.xml') && !name.toLowerCase().includes('meta-inf')))
      );
      targetPath = candidates[0] || null;
    }

    if (!targetPath) {
      throw new Error('No .mscx or .musicxml score found inside archive.');
    }

    const innerXml = await zip.file(targetPath)!.async('text');
    if (targetPath.toLowerCase().endsWith('.mscx') || innerXml.includes('<museScore')) {
      return parseMscx(innerXml, sourceLabel);
    }
    return parseMusicXml(innerXml, sourceLabel);
  }

  // Plain XML (.mscx, .musicxml, .xml)
  const text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('<museScore')) {
    return parseMscx(text, sourceLabel);
  }
  if (text.includes('<score-partwise') || text.includes('<score-timewise')) {
    return parseMusicXml(text, sourceLabel);
  }

  throw new Error('Unsupported file format. Supported: .mscz, .mscx, .musicxml, .mxl, .xml, .mid, .json');
}
