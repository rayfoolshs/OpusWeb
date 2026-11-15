import { NoteStep, Pitch } from '../types/score';
import { STEP_ORDER } from '../utils/musicTheory';

export type DrumVoiceId =
  | 'kick'
  | 'snare'
  | 'sideStick'
  | 'clap'
  | 'closedHat'
  | 'openHat'
  | 'pedalHat'
  | 'lowTom'
  | 'midTom'
  | 'highTom'
  | 'crash'
  | 'ride'
  | 'cowbell';

export interface DrumPosition {
  step: NoteStep;
  octave: number;
  voice: DrumVoiceId;
  label: string;
}

/**
 * Drum-kit layout used by the "Drum Kit" instrument. Notes are written on a
 * percussion staff (treble positions) and map from low to high:
 * kick/snare/hats, toms, then cymbals and percussion.
 */
export const DRUM_LAYOUT: DrumPosition[] = [
  { step: 'F', octave: 4, voice: 'kick', label: 'Kick' },
  { step: 'G', octave: 4, voice: 'snare', label: 'Snare' },
  { step: 'A', octave: 4, voice: 'closedHat', label: 'Closed Hi-Hat' },
  { step: 'B', octave: 4, voice: 'openHat', label: 'Open Hi-Hat' },
  { step: 'C', octave: 5, voice: 'lowTom', label: 'Low Tom' },
  { step: 'D', octave: 5, voice: 'midTom', label: 'Mid Tom' },
  { step: 'E', octave: 5, voice: 'highTom', label: 'High Tom' },
  { step: 'F', octave: 5, voice: 'crash', label: 'Crash Cymbal' },
  { step: 'G', octave: 5, voice: 'ride', label: 'Ride Cymbal' },
  { step: 'A', octave: 5, voice: 'clap', label: 'Hand Clap' },
  { step: 'B', octave: 5, voice: 'cowbell', label: 'Cowbell' },
  { step: 'C', octave: 6, voice: 'sideStick', label: 'Side Stick' },
];

function diatonicIndex(step: NoteStep, octave: number): number {
  return octave * 7 + STEP_ORDER.indexOf(step);
}

/** Find the drum piece whose staff position is closest to a written pitch. */
export function drumPositionForPitch(pitch: Pitch): DrumPosition {
  const target = diatonicIndex(pitch.step, pitch.octave);
  let best = DRUM_LAYOUT[0];
  let bestDistance = Infinity;
  for (const position of DRUM_LAYOUT) {
    const distance = Math.abs(diatonicIndex(position.step, position.octave) - target);
    if (distance < bestDistance) {
      best = position;
      bestDistance = distance;
    }
  }
  return best;
}

export function drumVoiceForPitch(pitch: Pitch): DrumVoiceId {
  return drumPositionForPitch(pitch).voice;
}

export function drumLabelForPitch(pitch: Pitch): string {
  return drumPositionForPitch(pitch).label;
}

/** Legend text for the Inspector, ordered low to high. */
export function drumLayoutLegend(): string {
  return DRUM_LAYOUT.map((p) => `${p.step}${p.octave} ${p.label}`).join(' · ');
}

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const cached = noiseBuffers.get(ctx);
  if (cached) return cached;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

function playNoise(
  ctx: AudioContext,
  destination: AudioNode,
  time: number,
  duration: number,
  peak: number,
  filterType: BiquadFilterType,
  frequency: number,
  q = 1
) {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, time);
  filter.Q.setValueAtTime(q, time);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, peak), time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(time);
  source.stop(time + duration + 0.02);
}

function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  startFreq: number,
  endFreq: number,
  time: number,
  duration: number,
  peak: number
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, time);
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + Math.min(0.18, duration));
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, peak), time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/**
 * Synthesized acoustic-style drum kit. Kept in Web Audio so percussion works
 * offline and without extra sample licensing.
 */
export function triggerDrum(
  ctx: AudioContext,
  voice: DrumVoiceId,
  time: number,
  velocityGain: number,
  destination: AudioNode
) {
  const level = Math.max(0.04, Math.min(1, velocityGain * 0.95));
  const dest = destination;

  switch (voice) {
    case 'kick':
      playTone(ctx, dest, 'sine', 152, 44, time, 0.42, level * 0.95);
      playNoise(ctx, dest, time, 0.02, level * 0.22, 'highpass', 3200, 0.7);
      break;
    case 'snare':
      playNoise(ctx, dest, time, 0.2, level * 0.62, 'bandpass', 1800, 0.8);
      playTone(ctx, dest, 'triangle', 188, 150, time, 0.12, level * 0.32);
      break;
    case 'sideStick':
      playNoise(ctx, dest, time, 0.05, level * 0.4, 'highpass', 2600, 0.8);
      playTone(ctx, dest, 'square', 920, 760, time, 0.04, level * 0.18);
      break;
    case 'clap':
      [0, 0.012, 0.025].forEach((offset) => {
        playNoise(ctx, dest, time + offset, 0.045, level * 0.45, 'bandpass', 1200, 1.4);
      });
      playNoise(ctx, dest, time + 0.03, 0.16, level * 0.3, 'bandpass', 1350, 1.1);
      break;
    case 'closedHat':
      playNoise(ctx, dest, time, 0.05, level * 0.42, 'highpass', 7600, 0.8);
      break;
    case 'openHat':
      playNoise(ctx, dest, time, 0.42, level * 0.36, 'highpass', 6800, 0.9);
      break;
    case 'pedalHat':
      playNoise(ctx, dest, time, 0.09, level * 0.34, 'highpass', 7000, 0.9);
      break;
    case 'lowTom':
      playTone(ctx, dest, 'sine', 128, 72, time, 0.32, level * 0.8);
      playNoise(ctx, dest, time, 0.04, level * 0.12, 'lowpass', 900, 0.8);
      break;
    case 'midTom':
      playTone(ctx, dest, 'sine', 178, 108, time, 0.27, level * 0.72);
      playNoise(ctx, dest, time, 0.035, level * 0.1, 'lowpass', 1100, 0.8);
      break;
    case 'highTom':
      playTone(ctx, dest, 'sine', 236, 152, time, 0.22, level * 0.66);
      playNoise(ctx, dest, time, 0.03, level * 0.09, 'lowpass', 1400, 0.8);
      break;
    case 'crash':
      playNoise(ctx, dest, time, 1.35, level * 0.46, 'highpass', 5200, 0.7);
      playNoise(ctx, dest, time, 0.5, level * 0.2, 'bandpass', 8600, 0.9);
      break;
    case 'ride':
      playNoise(ctx, dest, time, 0.7, level * 0.28, 'bandpass', 6200, 1.2);
      playTone(ctx, dest, 'square', 610, 590, time, 0.5, level * 0.1);
      break;
    case 'cowbell':
      playTone(ctx, dest, 'square', 545, 540, time, 0.24, level * 0.18);
      playTone(ctx, dest, 'square', 805, 800, time, 0.22, level * 0.14);
      break;
    default:
      break;
  }
}
