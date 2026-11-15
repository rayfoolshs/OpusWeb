import { instrument as loadSoundfontInstrument } from 'soundfont-player';
import { InstrumentTimbre, Part } from '../types/score';

/**
 * Free, high-quality General MIDI soundfont used for playback.
 *
 * Samples come from the pre-rendered "Musyng Kite" GM bank published in
 * gleitz/midi-js-soundfonts (CC BY-SA 3.0) and are streamed on demand from
 * jsDelivr; nothing is bundled with the app.
 */
export const SOUNDFONT_NAME = 'MusyngKite';
export const SOUNDFONT_ATTRIBUTION = 'Musyng Kite GM soundfont (CC BY-SA 3.0)';
/**
 * Mirrors are tried in order. GitHub Pages is primary because jsDelivr can
 * rate-limit large soundfont downloads; jsDelivr is the fallback.
 */
const SOUNDFONT_BASE_URLS = [
  'https://gleitz.github.io/midi-js-soundfonts/',
  'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/',
];

export interface SoundfontPlayer {
  play: (
    note: number,
    when?: number,
    options?: {
      duration?: number;
      gain?: number;
      attack?: number;
      decay?: number;
      sustain?: number;
      release?: number;
      adsr?: [number, number, number, number];
    }
  ) => unknown;
  stop: (when?: number) => unknown;
}

export interface GMSound {
  program: number;
  /** midi-js-soundfonts instrument file name */
  id: string;
  name: string;
}

/** Curated GM programs that sound good with the sampled bank. */
export const GM_SOUNDS: GMSound[] = [
  { program: 0, id: 'acoustic_grand_piano', name: 'Acoustic Grand Piano' },
  { program: 25, id: 'acoustic_guitar_steel', name: 'Acoustic Guitar (steel)' },
  { program: 27, id: 'electric_guitar_clean', name: 'Electric Guitar (clean)' },
  { program: 33, id: 'electric_bass_finger', name: 'Electric Bass (finger)' },
  { program: 40, id: 'violin', name: 'Violin' },
  { program: 41, id: 'viola', name: 'Viola' },
  { program: 42, id: 'cello', name: 'Cello' },
  { program: 48, id: 'string_ensemble_1', name: 'String Ensemble' },
  { program: 52, id: 'choir_aahs', name: 'Choir Aahs' },
  { program: 73, id: 'flute', name: 'Flute' },
  { program: 71, id: 'clarinet', name: 'Clarinet' },
  { program: 56, id: 'trumpet', name: 'Trumpet' },
  { program: 60, id: 'french_horn', name: 'French Horn' },
  { program: 61, id: 'brass_section', name: 'Brass Section' },
];

const PROGRAM_TO_INSTRUMENT: Record<number, string> = GM_SOUNDS.reduce(
  (map, sound) => ({ ...map, [sound.program]: sound.id }),
  {} as Record<number, string>
);

const TIMBRE_DEFAULT_PROGRAM: Record<InstrumentTimbre, number> = {
  piano: 0,
  strings: 40,
  woodwind: 73,
  brass: 56,
  guitar: 25,
  voice: 52,
  percussion: 0,
};

/** Resolve the GM program a part should play (falls back to its timbre family). */
export function partProgram(part: Pick<Part, 'program' | 'timbre'>): number {
  if (typeof part.program === 'number' && Number.isFinite(part.program)) {
    return Math.max(0, Math.min(127, Math.round(part.program)));
  }
  return TIMBRE_DEFAULT_PROGRAM[part.timbre] ?? 0;
}

/** Resolve the soundfont instrument name for a GM program. */
export function soundfontNameForProgram(program: number): string {
  return PROGRAM_TO_INSTRUMENT[program] ?? PROGRAM_TO_INSTRUMENT[TIMBRE_DEFAULT_PROGRAM.piano];
}

const pending = new Map<string, Promise<SoundfontPlayer>>();
const ready = new Map<string, SoundfontPlayer>();
const warned = new Set<string>();

/** Synchronously fetch an already-decoded instrument, or null while it loads. */
export function getLoadedSoundfont(name: string): SoundfontPlayer | null {
  return ready.get(name) ?? null;
}

/**
 * Load and decode one instrument on demand. Repeated calls share one request,
 * and failures are not cached so a later playback attempt can retry.
 */
export function loadSoundfont(ctx: AudioContext, name: string): Promise<SoundfontPlayer> {
  const cached = pending.get(name);
  if (cached) return cached;

  const attempt = async (): Promise<SoundfontPlayer> => {
    let lastError: unknown = null;
    for (const baseUrl of SOUNDFONT_BASE_URLS) {
      try {
        const player = await loadSoundfontInstrument(ctx, name as never, {
          soundfont: SOUNDFONT_NAME,
          format: 'mp3',
          nameToUrl: (instrumentName: string, soundfont: string, format: string) =>
            `${baseUrl}${soundfont}/${instrumentName}-${format === 'ogg' ? 'ogg' : 'mp3'}.js`,
          adsr: [0.004, 0.08, 0.9, 0.22],
        });
        return player as unknown as SoundfontPlayer;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };

  const promise = attempt()
    .then((player) => {
      ready.set(name, player);
      return player;
    })
    .catch((error: unknown) => {
      pending.delete(name);
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`[OpusWeb] Could not load soundfont "${name}"; using synth fallback.`, error);
      }
      throw error;
    });

  pending.set(name, promise);
  return promise;
}

/** Kick off loading for a set of GM programs (deduplicated, non-blocking). */
export function preloadSoundfonts(ctx: AudioContext, programs: Iterable<number>): void {
  const names = new Set<string>();
  for (const program of programs) {
    names.add(soundfontNameForProgram(program));
  }
  names.forEach((name) => {
    if (!ready.has(name) && !pending.has(name)) {
      void loadSoundfont(ctx, name).catch(() => {
        // Fallback synthesis covers unavailable instruments.
      });
    }
  });
}
