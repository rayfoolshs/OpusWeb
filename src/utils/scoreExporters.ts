import JSZip from 'jszip';
import {
  DurationType,
  NoteStep,
  Pitch,
  ScoreDocument,
} from '../types/score';
import { getEffectiveMeasureContext, getEventBeats, pitchToMidi } from './musicTheory';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pitchToTpc(pitch: Pitch): number {
  const baseTpc: Record<NoteStep, number> = {
    F: 13,
    C: 14,
    G: 15,
    D: 16,
    A: 17,
    E: 18,
    B: 19,
  };
  return baseTpc[pitch.step] + (pitch.alter || 0) * 7;
}

function clefToMscx(clef: string): string {
  if (clef === 'bass') return 'F';
  if (clef === 'alto') return 'C3';
  if (clef === 'tenor') return 'C4';
  if (clef === 'percussion') return 'PERCUSSION';
  return 'G';
}

function durationToMscx(dur: DurationType): string {
  return dur;
}

function durationToMusicXml(dur: DurationType): string {
  return dur;
}

/**
 * Export ScoreDocument to MuseScore 4.x .mscx XML
 */
export function exportToMscx(score: ScoreDocument): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<museScore version="4.20">');
  lines.push('  <Score>');
  lines.push(`    <metaTag name="workTitle">${escapeXml(score.title)}</metaTag>`);
  if (score.subtitle) {
    lines.push(`    <metaTag name="subtitle">${escapeXml(score.subtitle)}</metaTag>`);
  }
  if (score.composer) {
    lines.push(`    <metaTag name="composer">${escapeXml(score.composer)}</metaTag>`);
  }
  if (score.arranger) {
    lines.push(`    <metaTag name="arranger">${escapeXml(score.arranger)}</metaTag>`);
  }

  let globalStaffId = 1;
  const staffMap: { partIdx: number; staffIdx: number; id: number }[] = [];

  score.parts.forEach((part, pIdx) => {
    lines.push('    <Part>');
    part.staves.forEach((staff, sIdx) => {
      const id = globalStaffId++;
      staffMap.push({ partIdx: pIdx, staffIdx: sIdx, id });
      lines.push(`      <Staff id="${id}">`);
      lines.push('        <StaffType group="pitched"><name>stdNormal</name></StaffType>');
      lines.push(`        <defaultClef>${clefToMscx(staff.clef)}</defaultClef>`);
      lines.push('      </Staff>');
    });
    lines.push(`      <trackName>${escapeXml(part.name)}</trackName>`);
    lines.push('      <Instrument>');
    lines.push(`        <longName>${escapeXml(part.name)}</longName>`);
    lines.push(`        <shortName>${escapeXml(part.shortName)}</shortName>`);
    lines.push('      </Instrument>');
    lines.push('    </Part>');
  });

  staffMap.forEach(({ partIdx, staffIdx, id }) => {
    const part = score.parts[partIdx];
    const staff = part.staves[staffIdx];
    lines.push(`    <Staff id="${id}">`);

    if (id === 1) {
      lines.push('      <VBox>');
      lines.push('        <height>10</height>');
      lines.push(`        <Text><style>title</style><text>${escapeXml(score.title)}</text></Text>`);
      if (score.subtitle) {
        lines.push(`        <Text><style>subtitle</style><text>${escapeXml(score.subtitle)}</text></Text>`);
      }
      if (score.composer) {
        lines.push(`        <Text><style>composer</style><text>${escapeXml(score.composer)}</text></Text>`);
      }
      lines.push('      </VBox>');
    }

    staff.measures.forEach((measure, mIdx) => {
      lines.push('      <Measure>');
      if (measure.attributes.barlineLeft === 'repeat-begin') {
        lines.push('        <startRepeat/>');
      }
      if (measure.attributes.barlineRight === 'repeat-end') {
        lines.push('        <endRepeat>2</endRepeat>');
      }

      measure.voices.forEach((voice, vIdx) => {
        lines.push('        <voice>');
        if (vIdx === 0) {
          if (measure.attributes.keyFifths !== undefined) {
            lines.push(`          <KeySig><concertKey>${measure.attributes.keyFifths}</concertKey></KeySig>`);
          }
          if (measure.attributes.timeSignature) {
            lines.push(
              `          <TimeSig><sigN>${measure.attributes.timeSignature.beats}</sigN><sigD>${measure.attributes.timeSignature.beatType}</sigD></TimeSig>`
            );
          }
          if (measure.attributes.clef && mIdx > 0) {
            lines.push(`          <Clef><concertClefType>${clefToMscx(measure.attributes.clef)}</concertClefType></Clef>`);
          }
          if (measure.attributes.tempo && id === 1) {
            const bps = (measure.attributes.tempo / 60).toFixed(4);
            lines.push(`          <Tempo><tempo>${bps}</tempo><text>𝅘𝅥 = ${measure.attributes.tempo}</text></Tempo>`);
          }
        }

        voice.forEach((ev) => {
          if (ev.dynamic) {
            lines.push(`          <Dynamic><subtype>${escapeXml(ev.dynamic)}</subtype></Dynamic>`);
          }
          if (ev.isRest) {
            lines.push('          <Rest>');
            if (ev.isMeasureRest) {
              lines.push('            <durationType>measure</durationType>');
            } else {
              lines.push(`            <durationType>${durationToMscx(ev.duration)}</durationType>`);
              if (ev.dots > 0) lines.push(`            <dots>${ev.dots}</dots>`);
            }
            lines.push('          </Rest>');
          } else {
            lines.push('          <Chord>');
            if (ev.dots > 0) lines.push(`            <dots>${ev.dots}</dots>`);
            lines.push(`            <durationType>${durationToMscx(ev.duration)}</durationType>`);
            ev.articulations?.forEach((art) => {
              lines.push(`            <Articulation><subtype>${escapeXml(art)}</subtype></Articulation>`);
            });
            if (ev.lyric) {
              lines.push(`            <Lyrics><text>${escapeXml(ev.lyric)}</text></Lyrics>`);
            }
            ev.notes.forEach((note) => {
              lines.push('            <Note>');
              lines.push(`              <pitch>${pitchToMidi(note.pitch)}</pitch>`);
              lines.push(`              <tpc>${pitchToTpc(note.pitch)}</tpc>`);
              lines.push('            </Note>');
            });
            lines.push('          </Chord>');
          }
        });

        if (vIdx === 0 && (measure.attributes.barlineRight === 'double' || measure.attributes.barlineRight === 'end')) {
          lines.push(`          <BarLine><subtype>${measure.attributes.barlineRight}</subtype></BarLine>`);
        }

        lines.push('        </voice>');
      });

      lines.push('      </Measure>');
    });

    lines.push('    </Staff>');
  });

  lines.push('  </Score>');
  lines.push('</museScore>');
  return lines.join('\n');
}

/**
 * Export ScoreDocument to compressed MuseScore .mscz Blob
 */
export async function exportToMsczBlob(score: ScoreDocument): Promise<Blob> {
  const zip = new JSZip();
  const safeBase = (score.title || 'score').replace(/[^a-z0-9_-]+/gi, '_');
  const mscxFilename = `${safeBase}.mscx`;
  const mscxXml = exportToMscx(score);

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<container>\n  <rootfiles>\n    <rootfile full-path="${escapeXml(mscxFilename)}"/>\n  </rootfiles>\n</container>\n`
  );
  zip.file(mscxFilename, mscxXml);

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Export ScoreDocument to MusicXML 3.1 (.musicxml)
 */
export function exportToMusicXml(score: ScoreDocument): string {
  const divisions = 8; // Supports up to 32nd notes cleanly (quarter = 8)
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  lines.push('<score-partwise version="3.1">');
  lines.push('  <work>');
  lines.push(`    <work-title>${escapeXml(score.title)}</work-title>`);
  lines.push('  </work>');
  lines.push('  <identification>');
  if (score.composer) {
    lines.push(`    <creator type="composer">${escapeXml(score.composer)}</creator>`);
  }
  lines.push('    <encoding><software>OpusWeb</software></encoding>');
  lines.push('  </identification>');

  lines.push('  <part-list>');
  score.parts.forEach((p, idx) => {
    const pid = `P${idx + 1}`;
    lines.push(`    <score-part id="${pid}">`);
    lines.push(`      <part-name>${escapeXml(p.name)}</part-name>`);
    lines.push(`      <part-abbreviation>${escapeXml(p.shortName)}</part-abbreviation>`);
    lines.push('    </score-part>');
  });
  lines.push('  </part-list>');

  score.parts.forEach((part, pIdx) => {
    const pid = `P${pIdx + 1}`;
    lines.push(`  <part id="${pid}">`);
    const measureCount = part.staves[0]?.measures.length || 0;

    for (let mIdx = 0; mIdx < measureCount; mIdx++) {
      lines.push(`    <measure number="${mIdx + 1}">`);
      const leadMeasure = part.staves[0].measures[mIdx];
      const hasAttrChange =
        mIdx === 0 ||
        leadMeasure.attributes.keyFifths !== undefined ||
        leadMeasure.attributes.timeSignature !== undefined ||
        part.staves.some((st) => st.measures[mIdx]?.attributes.clef !== undefined);

      if (hasAttrChange) {
        lines.push('      <attributes>');
        if (mIdx === 0) {
          lines.push(`        <divisions>${divisions}</divisions>`);
        }
        if (leadMeasure.attributes.keyFifths !== undefined) {
          lines.push(`        <key><fifths>${leadMeasure.attributes.keyFifths}</fifths></key>`);
        }
        if (leadMeasure.attributes.timeSignature) {
          lines.push(
            `        <time><beats>${leadMeasure.attributes.timeSignature.beats}</beats><beat-type>${leadMeasure.attributes.timeSignature.beatType}</beat-type></time>`
          );
        }
        if (mIdx === 0 && part.staves.length > 1) {
          lines.push(`        <staves>${part.staves.length}</staves>`);
        }
        part.staves.forEach((st, sIdx) => {
          const clef = st.measures[mIdx]?.attributes.clef || (mIdx === 0 ? st.clef : undefined);
          if (clef) {
            const sign = clef === 'bass' ? 'F' : clef === 'alto' || clef === 'tenor' ? 'C' : 'G';
            const line = clef === 'bass' || clef === 'tenor' ? 4 : clef === 'alto' ? 3 : 2;
            lines.push(`        <clef number="${sIdx + 1}"><sign>${sign}</sign><line>${line}</line></clef>`);
          }
        });
        lines.push('      </attributes>');
      }

      if (leadMeasure.attributes.tempo && pIdx === 0) {
        lines.push(`      <direction placement="above"><sound tempo="${leadMeasure.attributes.tempo}"/></direction>`);
      }

      part.staves.forEach((staff, sIdx) => {
        const measure = staff.measures[mIdx];
        if (!measure) return;
        if (sIdx > 0) {
          const cap = Math.round(
            getEffectiveMeasureContext(part, 0, mIdx, score.defaultTempo).beats *
              (4 / getEffectiveMeasureContext(part, 0, mIdx, score.defaultTempo).beatType) *
              divisions
          );
          lines.push(`      <backup><duration>${cap}</duration></backup>`);
        }

        measure.voices.forEach((voice, vIdx) => {
          if (vIdx > 0) {
            const totalDur = voice.reduce((s, e) => s + Math.round(getEventBeats(e) * divisions), 0);
            lines.push(`      <backup><duration>${totalDur}</duration></backup>`);
          }
          const voiceNumber = sIdx * 4 + vIdx + 1;

          voice.forEach((ev) => {
            const durUnits = Math.max(1, Math.round(getEventBeats(ev) * divisions));
            if (ev.dynamic) {
              lines.push(`      <direction placement="below"><direction-type><dynamics><${ev.dynamic}/></dynamics></direction-type></direction>`);
            }
            if (ev.isRest) {
              lines.push('      <note>');
              lines.push(ev.isMeasureRest ? '        <rest measure="yes"/>' : '        <rest/>');
              lines.push(`        <duration>${durUnits}</duration>`);
              lines.push(`        <voice>${voiceNumber}</voice>`);
              lines.push(`        <type>${durationToMusicXml(ev.duration)}</type>`);
              for (let d = 0; d < ev.dots; d++) lines.push('        <dot/>');
              if (part.staves.length > 1) lines.push(`        <staff>${sIdx + 1}</staff>`);
              lines.push('      </note>');
            } else {
              ev.notes.forEach((note, nIdx) => {
                lines.push('      <note>');
                if (nIdx > 0) lines.push('        <chord/>');
                lines.push('        <pitch>');
                lines.push(`          <step>${note.pitch.step}</step>`);
                if (note.pitch.alter) lines.push(`          <alter>${note.pitch.alter}</alter>`);
                lines.push(`          <octave>${note.pitch.octave}</octave>`);
                lines.push('        </pitch>');
                lines.push(`        <duration>${durUnits}</duration>`);
                if (note.tieStart) lines.push('        <tie type="start"/>');
                if (note.tieStop) lines.push('        <tie type="stop"/>');
                lines.push(`        <voice>${voiceNumber}</voice>`);
                lines.push(`        <type>${durationToMusicXml(ev.duration)}</type>`);
                for (let d = 0; d < ev.dots; d++) lines.push('        <dot/>');
                if (part.staves.length > 1) lines.push(`        <staff>${sIdx + 1}</staff>`);
                if (nIdx === 0 && (ev.articulations?.length || ev.lyric)) {
                  if (ev.articulations?.length) {
                    lines.push('        <notations><articulations>');
                    ev.articulations.forEach((a) => {
                      if (a !== 'fermata') lines.push(`          <${a === 'marcato' ? 'strong-accent' : a}/>`);
                    });
                    lines.push('        </articulations>');
                    if (ev.articulations.includes('fermata')) lines.push('        <fermata/>');
                    lines.push('        </notations>');
                  }
                  if (ev.lyric) {
                    lines.push(`        <lyric><text>${escapeXml(ev.lyric)}</text></lyric>`);
                  }
                }
                lines.push('      </note>');
              });
            }
          });
        });
      });

      lines.push('    </measure>');
    }
    lines.push('  </part>');
  });

  lines.push('</score-partwise>');
  return lines.join('\n');
}

/**
 * Export ScoreDocument to Standard MIDI File (SMF Format 1) Uint8Array
 */
export function exportToMidiBytes(score: ScoreDocument): Uint8Array {
  const ticksPerBeat = 480;
  const writeVarLen = (val: number): number[] => {
    const out: number[] = [];
    let buffer = val & 0x7f;
    while ((val >>= 7) > 0) {
      buffer <<= 8;
      buffer |= (val & 0x7f) | 0x80;
    }
    while (true) {
      out.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return out;
  };

  const trackChunks: Uint8Array[] = [];

  score.parts.forEach((part, pIdx) => {
    const rawEvents: { tick: number; bytes: number[] }[] = [];
    if (pIdx === 0) {
      const usPerBeat = Math.round(60_000_000 / (score.defaultTempo || 120));
      rawEvents.push({
        tick: 0,
        bytes: [0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff],
      });
    }

    const channel = pIdx % 16;
    part.staves.forEach((staff) => {
      let measureStartTick = 0;
      staff.measures.forEach((measure, mIdx) => {
        const ctx = getEffectiveMeasureContext(part, 0, mIdx, score.defaultTempo);
        if (measure.attributes.tempo && pIdx === 0 && mIdx > 0) {
          const us = Math.round(60_000_000 / measure.attributes.tempo);
          rawEvents.push({
            tick: measureStartTick,
            bytes: [0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff],
          });
        }

        measure.voices.forEach((voice) => {
          let tick = measureStartTick;
          voice.forEach((ev) => {
            const durTicks = Math.round(getEventBeats(ev) * ticksPerBeat);
            if (!ev.isRest) {
              ev.notes.forEach((note) => {
                const midi = Math.max(0, Math.min(127, pitchToMidi(note.pitch)));
                rawEvents.push({ tick, bytes: [0x90 | channel, midi, 84] });
                rawEvents.push({ tick: tick + Math.max(10, durTicks - 10), bytes: [0x80 | channel, midi, 0] });
              });
            }
            tick += durTicks;
          });
        });

        measureStartTick += Math.round(((ctx.beats * 4) / ctx.beatType) * ticksPerBeat);
      });
    });

    rawEvents.sort((a, b) => a.tick - b.tick);
    const trackData: number[] = [];
    let lastTick = 0;
    rawEvents.forEach((ev) => {
      const delta = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;
      trackData.push(...writeVarLen(delta), ...ev.bytes);
    });
    // End of track
    trackData.push(0x00, 0xff, 0x2f, 0x00);

    const chunk = new Uint8Array(8 + trackData.length);
    chunk.set([0x4d, 0x54, 0x72, 0x6b], 0); // MTrk
    const len = trackData.length;
    chunk[4] = (len >>> 24) & 0xff;
    chunk[5] = (len >>> 16) & 0xff;
    chunk[6] = (len >>> 8) & 0xff;
    chunk[7] = len & 0xff;
    chunk.set(trackData, 8);
    trackChunks.push(chunk);
  });

  const header = new Uint8Array(14);
  header.set([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1], 0);
  header[10] = (trackChunks.length >>> 8) & 0xff;
  header[11] = trackChunks.length & 0xff;
  header[12] = (ticksPerBeat >>> 8) & 0xff;
  header[13] = ticksPerBeat & 0xff;

  const totalLen = header.length + trackChunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  out.set(header, 0);
  let offset = header.length;
  trackChunks.forEach((c) => {
    out.set(c, offset);
    offset += c.length;
  });
  return out;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
