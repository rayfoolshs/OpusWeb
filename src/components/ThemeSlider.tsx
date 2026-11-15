import React, { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

interface ThemeSliderProps {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

const TRACK_WIDTH = 88;
const KNOB_SIZE = 24;
const KNOB_MARGIN = 4;
const KNOB_TRAVEL = TRACK_WIDTH - 2 - KNOB_MARGIN * 2 - KNOB_SIZE; // 38px

/**
 * Draggable light ↔ dark slider. Drag or click anywhere on the track; the knob
 * follows the pointer and snaps to whichever end you release on (left = light,
 * right = dark). Arrow keys and Home/End also work.
 */
export const ThemeSlider: React.FC<ThemeSliderProps> = ({ theme, onChange }) => {
  const isDark = theme === 'dark';
  const [position, setPosition] = useState(isDark ? 100 : 0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const positionRef = useRef(position);
  const themeRef = useRef(theme);

  themeRef.current = theme;
  positionRef.current = position;

  const finishDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);

    const releasedAt = positionRef.current;
    const target: ThemeMode = releasedAt >= 50 ? 'dark' : 'light';
    const snapped = target === 'dark' ? 100 : 0;
    positionRef.current = snapped;
    setPosition(snapped);
    if (target !== themeRef.current) onChange(target);
  };

  const startDrag = () => {
    draggingRef.current = true;
    setDragging(true);
    window.addEventListener('pointerup', finishDrag, { once: true });
    window.addEventListener('pointercancel', finishDrag, { once: true });
  };

  // Keep the knob at an endpoint when the theme changes from elsewhere (or after release)
  useEffect(() => {
    if (draggingRef.current) return;
    const next = isDark ? 100 : 0;
    positionRef.current = next;
    setPosition(next);
  }, [isDark]);

  const setThemeImmediately = (next: ThemeMode) => {
    const nextPos = next === 'dark' ? 100 : 0;
    positionRef.current = nextPos;
    setPosition(nextPos);
    if (next !== themeRef.current) onChange(next);
  };

  const knobOffset = Math.round((position / 100) * KNOB_TRAVEL);

  return (
    <div
      className="relative h-8 shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-sunken)] transition-colors focus-within:ring-2 focus-within:ring-blue-500/70"
      style={{ width: `${TRACK_WIDTH}px` }}
      title={isDark ? 'Drag left for light mode' : 'Drag right for dark mode'}
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
          dragging ? '' : 'transition-transform duration-200 ease-out'
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
        value={position}
        aria-label="Color theme: light to dark"
        aria-valuetext={isDark ? 'Dark' : 'Light'}
        title="Drag between light and dark mode"
        onPointerDown={startDrag}
        onChange={(e) => {
          const next = Number(e.target.value);
          positionRef.current = next;
          setPosition(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'End') {
            e.preventDefault();
            setThemeImmediately('dark');
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'Home') {
            e.preventDefault();
            setThemeImmediately('light');
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 focus-visible:outline-none"
      />
      {dragging && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-blue-500/60" />
      )}
    </div>
  );
};
