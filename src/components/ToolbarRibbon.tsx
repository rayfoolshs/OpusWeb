import React from 'react';
import {
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  FileText,
  ScrollText,
} from 'lucide-react';
import { AccidentalType, DurationType, EditorToolState } from '../types/score';

interface ToolbarRibbonProps {
  toolState: EditorToolState;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  pageView: boolean;
  onToggleNoteInput: () => void;
  onSelectDuration: (dur: DurationType) => void;
  onToggleDot: () => void;
  onToggleRestMode: () => void;
  onToggleTie: () => void;
  onSelectAccidental: (acc: AccidentalType | null) => void;
  onSelectVoice: (voice: 0 | 1) => void;
  onToggleChordMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddMeasure: () => void;
  onDeleteMeasure: () => void;
  onZoomChange: (zoom: number) => void;
  onTogglePageView: () => void;
}

const DURATION_ITEMS: { id: DurationType; label: string; shortcut: string }[] = [
  { id: 'whole', label: 'Whole Note', shortcut: '1' },
  { id: 'half', label: 'Half Note', shortcut: '2' },
  { id: 'quarter', label: 'Quarter Note', shortcut: '3' },
  { id: 'eighth', label: 'Eighth Note', shortcut: '4' },
  { id: '16th', label: '16th Note', shortcut: '5' },
  { id: '32nd', label: '32nd Note', shortcut: '6' },
];

function NoteGlyph({ duration }: { duration: DurationType }) {
  if (duration === 'whole') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth={2}>
        <ellipse cx="12" cy="13" rx="5.5" ry="3.8" transform="rotate(-15 12 13)" />
      </svg>
    );
  }
  if (duration === 'half') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current" strokeWidth={1.8}>
        <ellipse cx="9.5" cy="17" rx="4" ry="2.8" fill="none" transform="rotate(-18 9.5 17)" />
        <line x1="13" y1="16.5" x2="13" y2="4.5" />
      </svg>
    );
  }
  if (duration === 'quarter') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-current" strokeWidth={1.6}>
        <ellipse cx="9.5" cy="17" rx="4" ry="2.8" transform="rotate(-18 9.5 17)" />
        <line x1="13" y1="16.5" x2="13" y2="4.5" />
      </svg>
    );
  }
  if (duration === 'eighth') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-current" strokeWidth={1.6}>
        <ellipse cx="8.5" cy="17" rx="3.8" ry="2.7" transform="rotate(-18 8.5 17)" />
        <line x1="12" y1="16.5" x2="12" y2="4.5" />
        <path d="M12 4.5 C16 6.5, 17 10, 15 13" fill="none" strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    );
  }
  if (duration === '16th') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-current" strokeWidth={1.6}>
        <ellipse cx="8.5" cy="17.5" rx="3.6" ry="2.5" transform="rotate(-18 8.5 17.5)" />
        <line x1="12" y1="17" x2="12" y2="4" />
        <path d="M12 4 C16 6, 17 9, 15 11.5" fill="none" strokeWidth={1.7} strokeLinecap="round" />
        <path d="M12 8 C16 10, 17 12.5, 15 14.5" fill="none" strokeWidth={1.7} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-current" strokeWidth={1.5}>
      <ellipse cx="8.5" cy="18" rx="3.4" ry="2.4" transform="rotate(-18 8.5 18)" />
      <line x1="11.8" y1="17.5" x2="11.8" y2="3.5" />
      <path d="M11.8 3.5 C15.5 5.2, 16.5 7.5, 14.8 9.5" fill="none" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M11.8 7 C15.5 8.7, 16.5 11, 14.8 13" fill="none" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M11.8 10.5 C15.5 12.2, 16.5 14.5, 14.8 16.2" fill="none" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export const ToolbarRibbon: React.FC<ToolbarRibbonProps> = ({
  toolState,
  canUndo,
  canRedo,
  zoom,
  pageView,
  onToggleNoteInput,
  onSelectDuration,
  onToggleDot,
  onToggleRestMode,
  onToggleTie,
  onSelectAccidental,
  onSelectVoice,
  onToggleChordMode,
  onUndo,
  onRedo,
  onAddMeasure,
  onDeleteMeasure,
  onZoomChange,
  onTogglePageView,
}) => {
  return (
    <div className="no-print h-11 bg-[#1C2027] border-b border-white/8 px-3 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Note Input Mode Toggle */}
        <button
          type="button"
          onClick={onToggleNoteInput}
          title="Toggle Note Input Mode (N)"
          className={`h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
            toolState.noteInputMode
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="font-mono-tabular text-[11px] opacity-80">N</span>
          <span>Note Input</span>
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
          className="h-8 w-8 rounded-md flex items-center justify-center text-slate-300 hover:bg-white/8 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="h-8 w-8 rounded-md flex items-center justify-center text-slate-300 hover:bg-white/8 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Note Durations */}
        <div className="flex items-center gap-0.5 bg-[#14171C] p-0.5 rounded-md border border-white/6">
          {DURATION_ITEMS.map((item) => {
            const active = toolState.duration === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectDuration(item.id)}
                title={`${item.label} (${item.shortcut})`}
                className={`h-7 w-7 rounded flex items-center justify-center transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <NoteGlyph duration={item.id} />
              </button>
            );
          })}
        </div>

        {/* Dot, Rest, Tie, Chord Stack */}
        <button
          type="button"
          onClick={onToggleDot}
          title="Dotted Note (.)"
          className={`h-8 w-8 rounded-md flex items-center justify-center text-base font-bold transition-colors ${
            toolState.dots > 0
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          •
        </button>

        <button
          type="button"
          onClick={onToggleRestMode}
          title="Enter Rest / Toggle Rest (0 or R)"
          className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            toolState.isRestMode
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          Rest
        </button>

        <button
          type="button"
          onClick={onToggleTie}
          title="Tie to Next Note (T)"
          className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            toolState.tieActive
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          Tie
        </button>

        <button
          type="button"
          onClick={onToggleChordMode}
          title="Add Interval / Stack Chord"
          className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            toolState.chordMode
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          Chord
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Accidentals */}
        <div className="flex items-center gap-0.5 bg-[#14171C] p-0.5 rounded-md border border-white/6">
          {(
            [
              { id: 'sharp', sym: '♯', label: 'Sharp' },
              { id: 'flat', sym: '♭', label: 'Flat' },
              { id: 'natural', sym: '♮', label: 'Natural' },
            ] as const
          ).map((acc) => {
            const active = toolState.accidental === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectAccidental(active ? null : acc.id)}
                title={acc.label}
                className={`h-7 w-7 rounded text-sm font-semibold flex items-center justify-center transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                {acc.sym}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Voice Switcher */}
        <div className="flex items-center gap-0.5 bg-[#14171C] p-0.5 rounded-md border border-white/6">
          {([0, 1] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onSelectVoice(v)}
              title={`Voice ${v + 1}`}
              className={`h-7 px-2 rounded text-xs font-mono-tabular font-medium transition-colors whitespace-nowrap ${
                toolState.voiceIndex === v
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              V{v + 1}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Measure Add / Remove */}
        <button
          type="button"
          onClick={onAddMeasure}
          title="Append Measure"
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-300 hover:bg-white/8 hover:text-white flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Bar</span>
        </button>
        <button
          type="button"
          onClick={onDeleteMeasure}
          title="Delete Selected Measure"
          className="h-8 w-8 rounded-md text-slate-400 hover:bg-white/8 hover:text-rose-400 flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right side: View Mode & Zoom */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onTogglePageView}
          title={pageView ? 'Switch to Continuous View' : 'Switch to Page View'}
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-300 hover:bg-white/8 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          {pageView ? <FileText className="w-3.5 h-3.5" /> : <ScrollText className="w-3.5 h-3.5" />}
          <span>{pageView ? 'Page' : 'Continuous'}</span>
        </button>

        <div className="flex items-center gap-0.5 bg-[#14171C] px-1 py-0.5 rounded-md border border-white/6">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(0.55, Number((zoom - 0.1).toFixed(2))))}
            title="Zoom Out"
            className="h-7 w-7 rounded flex items-center justify-center text-slate-300 hover:bg-white/8 hover:text-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(1)}
            title="Reset Zoom to 100%"
            className="h-7 px-1.5 rounded text-xs font-mono-tabular text-slate-300 hover:text-white whitespace-nowrap"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(1.8, Number((zoom + 0.1).toFixed(2))))}
            title="Zoom In"
            className="h-7 w-7 rounded flex items-center justify-center text-slate-300 hover:bg-white/8 hover:text-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
