import { DynamicType, InstrumentTimbre, Pitch, ScoreDocument } from '../types/score';
import {
  getEffectiveMeasureContext,
  getEventBeats,
  getMeasureCapacityBeats,
  pitchToMidi,
  writtenGuitarPitchToSoundingMidi,
} from '../utils/musicTheory';
import {
  getLoadedSoundfont,
  partProgram,
  preloadSoundfonts,
  soundfontNameForProgram,
} from './gmSoundfont';
import { DrumVoiceId, drumVoiceForPitch, triggerDrum } from './drumKit';
import { chordMidiNotes, sortedChords } from '../utils/chords';

interface ScheduledNote {
  startBeatGlobal: number;
  durationBeats: number;
  midi: number;
  timbre: InstrumentTimbre;
  program: number;
  drum?: DrumVoiceId;
  gain: number;
  tempo: number;
}

/** Applies the part dynamic/volume to the sampled player's per-note gain. */
const SAMPLE_GAIN_TRIM = 0.55;

const DYNAMIC_GAIN: Record<DynamicType, number> = {
  ppp: 0.16,
  pp: 0.25,
  p: 0.36,
  mp: 0.5,
  mf: 0.65,
  f: 0.8,
  ff: 0.92,
  fff: 1.0,
  sfz: 0.95,
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Expand the written measures into playback order, repeating each section
 * delimited by repeat barlines once (|: … :|).
 */
function buildRepeatPlayOrder(
  measures: { attributes: { barlineLeft?: string; barlineRight?: string } }[]
): number[] {
  const order: number[] = [];
  let repeatStart = 0;

  for (let m = 0; m < measures.length; m++) {
    order.push(m);
    const attrs = measures[m].attributes;
    if (attrs.barlineLeft === 'repeat-begin') {
      repeatStart = m;
    }
    if (attrs.barlineRight === 'repeat-end') {
      for (let r = repeatStart; r <= m; r++) {
        order.push(r);
      }
      repeatStart = m + 1;
    }
  }

  return order;
}

class ScoreSynthEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private timerId: number | null = null;
  private rafId: number | null = null;

  private timeline: ScheduledNote[] = [];
  private measureStarts: { measureIndex: number; startBeat: number; capacityBeats: number; tempo: number }[] = [];
  private totalBeats = 0;

  private playbackStartAudioTime = 0;
  private playbackStartBeat = 0;
  private nextNoteIndex = 0;
  private lastMetronomeBeat = -1;

  private metronomeEnabled = false;
  private loopEnabled = false;
  private tempoMultiplier = 1;

  private onTickCallback: ((measureIndex: number, beatInMeasure: number, playing: boolean) => void) | null = null;

  private pendingPrograms: number[] = [];
  private warmUpAttached = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setOptions(opts: { metronome?: boolean; loop?: boolean; tempoScale?: number }) {
    if (opts.metronome !== undefined) this.metronomeEnabled = opts.metronome;
    if (opts.loop !== undefined) this.loopEnabled = opts.loop;
    if (opts.tempoScale !== undefined) this.tempoMultiplier = Math.max(0.25, Math.min(2.5, opts.tempoScale));
  }

  public auditionPitch(
    pitch: Pitch,
    timbre: InstrumentTimbre = 'piano',
    durationSec = 0.45,
    program?: number,
    drumKit?: boolean
  ) {
    const ctx = this.ensureContext();
    if (drumKit) {
      triggerDrum(ctx, drumVoiceForPitch(pitch), ctx.currentTime, 0.8, ctx.destination);
      return;
    }
    const resolvedProgram = program ?? partProgram({ timbre });
    this.preloadPrograms([resolvedProgram]);
    const midi = timbre === 'guitar' ? writtenGuitarPitchToSoundingMidi(pitch) : pitchToMidi(pitch);
    this.triggerVoice(ctx, midi, ctx.currentTime, durationSec, timbre, 0.55, resolvedProgram);
  }

  /**
   * Start loading sampled instruments for a score. Safe to call repeatedly;
   * the AudioContext is only created inside the first user gesture.
   */
  public preloadScore(score: ScoreDocument) {
    this.pendingPrograms = score.parts
      .filter((part) => !part.muted && !part.drumKit)
      .map(partProgram);
    if (this.ctx) {
      this.preloadPrograms(this.pendingPrograms);
      return;
    }
    this.attachWarmUp();
  }

  private preloadPrograms(programs: number[]) {
    if (!this.ctx) return;
    preloadSoundfonts(this.ctx, programs);
  }

  private attachWarmUp() {
    if (this.warmUpAttached) return;
    this.warmUpAttached = true;
    const handler = () => {
      this.warmUpAttached = false;
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
      this.ensureContext();
      this.preloadPrograms(this.pendingPrograms);
    };
    window.addEventListener('pointerdown', handler, { passive: true });
    window.addEventListener('keydown', handler);
  }

  private triggerMetronomeClick(ctx: AudioContext, time: number, accented: boolean) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accented ? 1280 : 880, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(accented ? 0.25 : 0.14, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.065);
  }

  private triggerVoice(
    ctx: AudioContext,
    midi: number,
    startTime: number,
    durationSec: number,
    timbre: InstrumentTimbre,
    velocityGain: number,
    program: number,
    drum?: DrumVoiceId
  ) {
    if (drum) {
      triggerDrum(ctx, drum, Math.max(startTime, ctx.currentTime), velocityGain, ctx.destination);
      return;
    }

    // Prefer the sampled GM soundfont; fall back to the built-in synth while
    // samples load (or if the network is unavailable).
    const sampler = getLoadedSoundfont(soundfontNameForProgram(program));
    if (sampler) {
      try {
        sampler.play(midi, Math.max(startTime, ctx.currentTime), {
          duration: Math.max(0.08, Math.min(6, durationSec)),
          gain: Math.max(0.015, Math.min(1, velocityGain * SAMPLE_GAIN_TRIM)),
        });
        return;
      } catch {
        // Fall through to the oscillator voice.
      }
    }

    const freq = midiToFreq(midi);
    const dur = Math.max(0.08, Math.min(4.5, durationSec));
    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    const peak = Math.max(0.02, Math.min(0.26, velocityGain * 0.22));

    if (timbre === 'piano') {
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 2, startTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(7000, freq * 6), startTime);
      filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.8), startTime + dur);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.22, startTime);
      osc1.connect(filter);
      osc2.connect(subGain);
      subGain.connect(filter);

      masterGain.gain.setValueAtTime(0.0001, startTime);
      masterGain.gain.linearRampToValueAtTime(peak, startTime + 0.012);
      masterGain.gain.exponentialRampToValueAtTime(peak * 0.35, startTime + Math.min(dur * 0.65, 0.35));
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 0.08);
    } else if (timbre === 'strings') {
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 1.003, startTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, startTime);
      osc1.connect(filter);
      osc2.connect(filter);

      masterGain.gain.setValueAtTime(0.0001, startTime);
      masterGain.gain.linearRampToValueAtTime(peak * 0.75, startTime + Math.min(0.11, dur * 0.3));
      masterGain.gain.setValueAtTime(peak * 0.65, startTime + Math.max(0.05, dur - 0.05));
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 0.12);
    } else if (timbre === 'woodwind') {
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq, startTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, startTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.35, startTime);
      osc1.connect(filter);
      osc2.connect(subGain);
      subGain.connect(filter);

      masterGain.gain.setValueAtTime(0.0001, startTime);
      masterGain.gain.linearRampToValueAtTime(peak * 0.85, startTime + 0.035);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 0.05);
    } else if (timbre === 'brass') {
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq, startTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, startTime);
      filter.frequency.linearRampToValueAtTime(2800, startTime + 0.08);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.2, startTime);
      osc1.connect(filter);
      osc2.connect(subGain);
      subGain.connect(filter);

      masterGain.gain.setValueAtTime(0.0001, startTime);
      masterGain.gain.linearRampToValueAtTime(peak * 0.8, startTime + 0.04);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 0.06);
    } else if (timbre === 'guitar') {
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq, startTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4200, startTime);
      filter.frequency.exponentialRampToValueAtTime(550, startTime + dur);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.3, startTime);
      osc1.connect(filter);
      osc2.connect(subGain);
      subGain.connect(filter);

      masterGain.gain.setValueAtTime(0.0001, startTime);
      masterGain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 0.1);
    } else {
      // Voice
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 2, startTime);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.max(500, freq * 2.2), startTime);
      filter.Q.setValueAtTime(1.4, startTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.25, startTime);
      osc1.connect(filter);
      osc2.connect(subGain);
      subGain.connect(filter);

      masterGain.gain.setValueAtTime(0.0001, startTime);
      masterGain.gain.linearRampToValueAtTime(peak * 0.85, startTime + 0.06);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 0.08);
    }

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + dur + 0.15);
    osc2.stop(startTime + dur + 0.15);
  }

  private buildTimeline(score: ScoreDocument) {
    this.timeline = [];
    this.measureStarts = [];
    const leadPart = score.parts[0];
    if (!leadPart || !leadPart.staves[0]) {
      this.totalBeats = 0;
      return;
    }

    const measureCount = leadPart.staves[0].measures.length;
    const measureContexts: { capacityBeats: number; tempo: number }[] = [];
    for (let m = 0; m < measureCount; m++) {
      const ctxInfo = getEffectiveMeasureContext(leadPart, 0, m, score.defaultTempo);
      measureContexts.push({
        capacityBeats: getMeasureCapacityBeats(ctxInfo.beats, ctxInfo.beatType),
        tempo: ctxInfo.tempo,
      });
    }

    // Repeat barlines expand the measure sequence (each |: … :| plays twice)
    const playOrder = buildRepeatPlayOrder(leadPart.staves[0].measures);
    let runningBeat = 0;
    playOrder.forEach((measureIndex) => {
      const measureCtx = measureContexts[measureIndex];
      if (!measureCtx) return;
      this.measureStarts.push({
        measureIndex,
        startBeat: runningBeat,
        capacityBeats: measureCtx.capacityBeats,
        tempo: measureCtx.tempo,
      });
      runningBeat += measureCtx.capacityBeats;
    });
    this.totalBeats = runningBeat;

    const anySolo = score.parts.some((p) => p.solo);

    score.parts.forEach((part) => {
      if (part.muted) return;
      if (anySolo && !part.solo) return;

      part.staves.forEach((staff) => {
        let currentDynamicGain = 0.65;

        this.measureStarts.forEach((mInfo) => {
          const measure = staff.measures[mInfo.measureIndex];
          if (!measure) return;

          measure.voices.forEach((voice) => {
            let beatOffset = 0;
            voice.forEach((ev) => {
              if (ev.dynamic) {
                currentDynamicGain = DYNAMIC_GAIN[ev.dynamic] ?? 0.65;
              }
              const evBeats = getEventBeats(ev);
              if (!ev.isRest) {
                let durScale = 0.92;
                if (ev.articulations?.includes('staccato')) durScale = 0.45;
                if (ev.articulations?.includes('tenuto')) durScale = 0.99;

                ev.notes.forEach((note) => {
                  if (note.tieStop) return; // Tied continuation already sounding
                  // Look ahead for tied notes if tieStart
                  const durBeats = evBeats * durScale;
                  this.timeline.push({
                    startBeatGlobal: mInfo.startBeat + beatOffset,
                    durationBeats: durBeats,
                    midi:
                      part.timbre === 'guitar'
                        ? writtenGuitarPitchToSoundingMidi(note.pitch)
                        : pitchToMidi(note.pitch),
                    timbre: part.timbre,
                    program: partProgram(part),
                    drum: part.drumKit ? drumVoiceForPitch(note.pitch) : undefined,
                    gain: currentDynamicGain * part.volume,
                    tempo: mInfo.tempo,
                  });
                });
              }
              beatOffset += evBeats;
            });
          });
        });
      });
    });

    // Lead-sheet chord symbols play as block chords using the first pitched part
    const chordSourcePart = score.parts.find((part) => !part.muted && !part.drumKit);
    const chordTimbre: InstrumentTimbre = chordSourcePart?.timbre ?? 'piano';
    const chordProgram = chordSourcePart ? partProgram(chordSourcePart) : 0;
    const chordGain = 0.38 * (chordSourcePart?.volume ?? 0.85);

    this.measureStarts.forEach((mInfo) => {
      const measure = leadPart.staves[0]?.measures[mInfo.measureIndex];
      const chords = sortedChords(measure?.chordSymbols);
      if (chords.length === 0) return;

      chords.forEach((chord, idx) => {
        const startOffset = Math.max(0, Math.min(mInfo.capacityBeats, chord.beat));
        const nextOffset =
          idx + 1 < chords.length
            ? Math.max(0, Math.min(mInfo.capacityBeats, chords[idx + 1].beat))
            : mInfo.capacityBeats;
        const durationBeats = Math.max(0.25, nextOffset - startOffset);

        chordMidiNotes(chord.symbol).forEach((midi) => {
          this.timeline.push({
            startBeatGlobal: mInfo.startBeat + startOffset,
            durationBeats: durationBeats * 0.96,
            midi,
            timbre: chordTimbre,
            program: chordProgram,
            gain: chordGain,
            tempo: mInfo.tempo,
          });
        });
      });
    });

    this.timeline.sort((a, b) => a.startBeatGlobal - b.startBeatGlobal);
  }

  public start(
    score: ScoreDocument,
    startMeasureIndex = 0,
    onTick?: (measureIndex: number, beatInMeasure: number, playing: boolean) => void
  ) {
    // Clear the previous run's callback before stopping, otherwise stop() reports
    // playing=false into the UI and the fresh playback loses its playhead.
    this.onTickCallback = null;
    this.stop();
    const ctx = this.ensureContext();
    this.preloadScore(score);
    this.buildTimeline(score);
    if (this.totalBeats <= 0) return;

    this.onTickCallback = onTick || null;
    const startMeasure =
      this.measureStarts.find((ms) => ms.measureIndex === startMeasureIndex) || this.measureStarts[0];
    const startBeat = startMeasure ? startMeasure.startBeat : 0;

    this.isPlaying = true;
    this.playbackStartBeat = startBeat;
    this.playbackStartAudioTime = ctx.currentTime + 0.05;
    this.nextNoteIndex = this.timeline.findIndex((n) => n.startBeatGlobal >= startBeat - 0.001);
    if (this.nextNoteIndex === -1) this.nextNoteIndex = this.timeline.length;
    this.lastMetronomeBeat = Math.floor(startBeat) - 1;

    const baseTempo = (startMeasure?.tempo || score.defaultTempo || 120) * this.tempoMultiplier;
    const secPerBeat = 60 / baseTempo;

    const scheduleAheadSec = 0.18;

    const schedulerTick = () => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const elapsedSec = now - this.playbackStartAudioTime;
      const currentBeat = this.playbackStartBeat + elapsedSec / secPerBeat;
      const lookaheadBeat = this.playbackStartBeat + (elapsedSec + scheduleAheadSec) / secPerBeat;

      // Schedule notes
      while (
        this.nextNoteIndex < this.timeline.length &&
        this.timeline[this.nextNoteIndex].startBeatGlobal <= lookaheadBeat
      ) {
        const note = this.timeline[this.nextNoteIndex];
        const noteTime =
          this.playbackStartAudioTime + (note.startBeatGlobal - this.playbackStartBeat) * secPerBeat;
        if (noteTime >= now - 0.05) {
          this.triggerVoice(
            this.ctx,
            note.midi,
            Math.max(now, noteTime),
            note.durationBeats * secPerBeat,
            note.timbre,
            note.gain,
            note.program,
            note.drum
          );
        }
        this.nextNoteIndex++;
      }

      // Schedule metronome clicks
      if (this.metronomeEnabled) {
        const targetIntBeat = Math.floor(lookaheadBeat);
        while (this.lastMetronomeBeat < targetIntBeat && this.lastMetronomeBeat + 1 < this.totalBeats) {
          this.lastMetronomeBeat++;
          const clickBeat = this.lastMetronomeBeat;
          const m = this.measureStarts.find(
            (ms) => clickBeat >= ms.startBeat - 0.001 && clickBeat < ms.startBeat + ms.capacityBeats - 0.001
          );
          const isDownbeat = m ? Math.abs(clickBeat - m.startBeat) < 0.01 : clickBeat === 0;
          const clickTime =
            this.playbackStartAudioTime + (clickBeat - this.playbackStartBeat) * secPerBeat;
          if (clickTime >= now - 0.02) {
            this.triggerMetronomeClick(this.ctx, Math.max(now, clickTime), isDownbeat);
          }
        }
      }

      if (currentBeat >= this.totalBeats) {
        if (this.loopEnabled) {
          this.playbackStartBeat = 0;
          this.playbackStartAudioTime = now + 0.05;
          this.nextNoteIndex = 0;
          this.lastMetronomeBeat = -1;
        } else {
          this.stop();
        }
      }
    };

    const uiLoop = () => {
      if (!this.isPlaying || !this.ctx) return;
      const elapsedSec = Math.max(0, this.ctx.currentTime - this.playbackStartAudioTime);
      const currentBeat = this.playbackStartBeat + elapsedSec / secPerBeat;
      let activeM = 0;
      let beatInM = 0;
      for (let i = 0; i < this.measureStarts.length; i++) {
        const ms = this.measureStarts[i];
        if (currentBeat >= ms.startBeat) {
          activeM = ms.measureIndex;
          beatInM = Math.max(0, currentBeat - ms.startBeat);
        }
      }
      this.onTickCallback?.(activeM, beatInM, true);
      this.rafId = requestAnimationFrame(uiLoop);
    };

    this.timerId = window.setInterval(schedulerTick, 35);
    schedulerTick();
    this.rafId = requestAnimationFrame(uiLoop);
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.onTickCallback?.(0, 0, false);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const synthEngine = new ScoreSynthEngine();
