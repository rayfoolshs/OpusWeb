/**
 * Continuous light → dark theme scaling.
 *
 * The slider value (0–100%) interpolates every UI color token between the light
 * and dark palettes. Text tokens use a steep crossover around the midpoint so
 * labels stay readable while backgrounds darken smoothly.
 */

type Rgba = { r: number; g: number; b: number; a: number };

const LIGHT_PALETTE: Record<string, string> = {
  '--bg-app': '#edf0f5',
  '--bg-ribbon': '#f7f9fc',
  '--bg-panel': '#ffffff',
  '--bg-canvas': '#e2e7ef',
  '--bg-raised': '#ffffff',
  '--bg-sunken': '#f1f4f9',
  '--bg-sunken-hover': '#e9edf4',
  '--bg-card': '#f7f9fc',
  '--bg-card-2': '#fbfcfe',
  '--bg-button': '#f1f4f9',
  '--bg-button-hover': '#e3e9f2',
  '--bg-active': '#ffffff',
  '--text-strong': '#0f172a',
  '--text': '#334155',
  '--text-muted': '#64748b',
  '--text-faint': '#94a3b8',
  '--border': 'rgba(15, 23, 42, 0.1)',
  '--border-soft': 'rgba(15, 23, 42, 0.07)',
  '--border-strong': 'rgba(15, 23, 42, 0.18)',
  '--surface-soft': 'rgba(15, 23, 42, 0.05)',
  '--surface-hover': 'rgba(15, 23, 42, 0.09)',
  '--accent-text': '#2563eb',
  '--accent-text-strong': '#1d4ed8',
  '--scrollbar-track': '#edf0f5',
  '--scrollbar-thumb': '#c3cbd8',
  '--scrollbar-thumb-hover': '#a8b3c4',
  '--knob-bg': '#ffffff',
  '--knob-border': 'rgba(15, 23, 42, 0.2)',
};

const DARK_PALETTE: Record<string, string> = {
  '--bg-app': '#14171c',
  '--bg-ribbon': '#1c2027',
  '--bg-panel': '#181b21',
  '--bg-canvas': '#1b1e24',
  '--bg-raised': '#1b1f27',
  '--bg-sunken': '#121419',
  '--bg-sunken-hover': '#171b22',
  '--bg-card': '#1e222a',
  '--bg-card-2': '#1f242d',
  '--bg-button': '#262b35',
  '--bg-button-hover': '#313846',
  '--bg-active': '#252a34',
  '--text-strong': '#f8fafc',
  '--text': '#cbd5e1',
  '--text-muted': '#94a3b8',
  '--text-faint': '#64748b',
  '--border': 'rgba(255, 255, 255, 0.08)',
  '--border-soft': 'rgba(255, 255, 255, 0.06)',
  '--border-strong': 'rgba(255, 255, 255, 0.16)',
  '--surface-soft': 'rgba(255, 255, 255, 0.06)',
  '--surface-hover': 'rgba(255, 255, 255, 0.1)',
  '--accent-text': '#60a5fa',
  '--accent-text-strong': '#93c5fd',
  '--scrollbar-track': '#14171c',
  '--scrollbar-thumb': '#2c323d',
  '--scrollbar-thumb-hover': '#3d4554',
  '--knob-bg': '#3a424f',
  '--knob-border': 'rgba(255, 255, 255, 0.22)',
};

const TEXT_TOKENS = new Set(['--text-strong', '--text', '--text-muted', '--text-faint']);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseColor(input: string): Rgba | null {
  const value = input.trim();

  const hex = /^#([0-9a-f]{3,8})$/i.exec(value);
  if (hex) {
    const raw = hex[1];
    if (raw.length === 3 || raw.length === 4) {
      const channels = raw.split('').map((char) => parseInt(char + char, 16));
      return {
        r: channels[0],
        g: channels[1],
        b: channels[2],
        a: raw.length === 4 ? channels[3] / 255 : 1,
      };
    }
    if (raw.length === 6 || raw.length === 8) {
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
        a: raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }

  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    value
  );
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }

  return null;
}

function mixColors(from: string, to: string, t: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return to;

  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const alpha = Number((a.a + (b.a - a.a) * t).toFixed(3));

  if (alpha >= 0.999) {
    return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
  }
  return `rgba(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)}, ${alpha})`;
}

/** Apply a 0–100 theme level by interpolating every UI color token on :root. */
export function applyThemeLevel(level: number): void {
  const root = document.documentElement;
  const t = clamp01(level / 100);
  // Text switches at the midpoint (rather than blending through mid-gray on
  // mid-gray) so labels stay legible while the surfaces scale smoothly.
  const textT = t < 0.5 ? 0 : 1;
  // In the middle of the scale, lift secondary text toward the strong color so
  // small labels remain readable against mid-gray surfaces.
  const midBoost = Math.max(0, 1 - Math.abs(t - 0.5) / 0.15);
  const strongSide = t < 0.5 ? LIGHT_PALETTE['--text-strong'] : DARK_PALETTE['--text-strong'];

  for (const token of Object.keys(DARK_PALETTE)) {
    const from = LIGHT_PALETTE[token];
    const to = DARK_PALETTE[token];
    if (!from || !to) continue;
    const mix = TEXT_TOKENS.has(token) ? textT : t;
    let color = mixColors(from, to, mix);
    if (TEXT_TOKENS.has(token) && token !== '--text-strong' && midBoost > 0) {
      color = mixColors(color, strongSide, midBoost * 0.8);
    }
    root.style.setProperty(token, color);
  }
}

/** Clear inline tokens so the CSS palettes take over again. */
export function clearThemeLevel(): void {
  const root = document.documentElement;
  Object.keys(DARK_PALETTE).forEach((token) => root.style.removeProperty(token));
}
