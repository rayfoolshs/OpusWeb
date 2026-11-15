import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

interface ThemeSliderProps {
  theme: ThemeMode;
  /** 0–100: 0% is the lightest setting, 100% the darkest */
  level: number;
  onLevelChange: (level: number) => void;
}

const TRACK_WIDTH = 88;
const KNOB_SIZE = 24;
const KNOB_MARGIN = 4;
const KNOB_TRAVEL = TRACK_WIDTH - 2 - KNOB_MARGIN * 2 - KNOB_SIZE; // 54px

/**
 * 0–100% light ↔ dark slider. The knob stays wherever you release it (it does
 * not snap to the ends), the current percentage is shown beside the track, and
 * the theme switches at the 50% midpoint.
 */
export const ThemeSlider: React.FC<ThemeSliderProps> = ({ theme, level, onLevelChange }) => {
  const isDark = theme === 'dark';
  const [dragging, setDragging] = useState(false);
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  const knobOffset = Math.round((clamped / 100) * KNOB_TRAVEL);

  const beginDrag = () => {
    setDragging(true);
    const finish = () => setDragging(false);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', finish, { once: true });
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div
        className="relative h-8 shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-sunken)] transition-colors focus-within:ring-2 focus-within:ring-blue-500/70"
        style={{ width: `${TRACK_WIDTH}px` }}
        title={`Theme level ${clamped}% — ${isDark ? 'dark' : 'light'} (switches at 50%)`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full opacity-70"
          style={{
            background:
              'linear-gradient(90deg, rgba(251, 191, 36, 0.16) 0%, rgba(251, 191, 36, 0.02) 42%, rgba(96, 165, 250, 0.02) 58%, rgba(96, 165, 250, 0.18) 100%)',
          }}
        />
        <Sun
          aria-hidden="true"
          className={`pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors ${
            isDark ? 'text-[var(--text-faint)]' : 'text-amber-500'
          }`}
        />
        <Moon
          aria-hidden="true"
          className={`pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors ${
            isDark ? 'text-[var(--accent-text)]' : 'text-[var(--text-faint)]'
          }`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm ${
            dragging ? '' : 'transition-transform duration-150 ease-out'
          }`}
          style={{
            left: `${KNOB_MARGIN}px`,
            transform: `translateX(${knobOffset}px)`,
            backgroundColor: 'var(--knob-bg)',
            borderColor: 'var(--knob-border)',
          }}
        >
          {isDark ? (
            <Moon className="h-3.5 w-3.5 text-[var(--accent-text)]" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-500" />
          )}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={clamped}
          aria-label="Color theme level: 0 percent light to 100 percent dark"
          aria-valuetext={`${clamped}% (${isDark ? 'dark' : 'light'})`}
          title="Drag between light and dark; the theme switches at 50%"
          onPointerDown={beginDrag}
          onChange={(e) => onLevelChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 focus-visible:outline-none"
        />
        {dragging && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-blue-500/60"
          />
        )}
      </div>
      <span
        aria-hidden="true"
        className="w-8 select-none text-right font-mono-tabular text-[10px] text-[var(--text-faint)]"
      >
        {clamped}%
      </span>
    </div>
  );
};
