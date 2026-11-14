import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  ArticulationType,
  BarlineType,
  ClefType,
  DynamicType,
} from '../types/score';
import { KEY_SIGNATURE_LIST } from '../utils/musicTheory';

interface PaletteSidebarProps {
  onApplyClef: (clef: ClefType) => void;
  onApplyKeySignature: (fifths: number) => void;
  onApplyTimeSignature: (beats: number, beatType: number) => void;
  onApplyDynamic: (dyn: DynamicType) => void;
  onApplyArticulation: (art: ArticulationType) => void;
  onApplyBarline: (bar: BarlineType) => void;
  onApplyTempo: (bpm: number) => void;
}

const CLEFS: { id: ClefType; label: string; glyph: string }[] = [
  { id: 'treble', label: 'Treble (G)', glyph: '𝄞' },
  { id: 'bass', label: 'Bass (F)', glyph: '𝄢' },
  { id: 'alto', label: 'Alto (C)', glyph: '𝄡' },
  { id: 'tenor', label: 'Tenor (C4)', glyph: '𝄡₄' },
];

const TIME_SIGNATURES: { beats: number; beatType: number; label: string }[] = [
  { beats: 4, beatType: 4, label: '4/4' },
  { beats: 3, beatType: 4, label: '3/4' },
  { beats: 2, beatType: 4, label: '2/4' },
  { beats: 6, beatType: 8, label: '6/8' },
  { beats: 3, beatType: 8, label: '3/8' },
  { beats: 2, beatType: 2, label: '2/2' },
  { beats: 5, beatType: 4, label: '5/4' },
  { beats: 7, beatType: 8, label: '7/8' },
];

const DYNAMICS: DynamicType[] = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sfz'];

const ARTICULATIONS: { id: ArticulationType; label: string; symbol: string }[] = [
  { id: 'staccato', label: 'Staccato', symbol: '•' },
  { id: 'accent', label: 'Accent', symbol: '>' },
  { id: 'tenuto', label: 'Tenuto', symbol: '–' },
  { id: 'marcato', label: 'Marcato', symbol: '^' },
  { id: 'fermata', label: 'Fermata', symbol: '𝄐' },
];

const BARLINES: { id: BarlineType; label: string }[] = [
  { id: 'single', label: 'Single Bar' },
  { id: 'double', label: 'Double Bar' },
  { id: 'end', label: 'Final Bar' },
  { id: 'repeat-begin', label: 'Start Repeat' },
  { id: 'repeat-end', label: 'End Repeat' },
];

const TEMPOS = [
  { label: 'Largo', bpm: 52 },
  { label: 'Adagio', bpm: 68 },
  { label: 'Andante', bpm: 88 },
  { label: 'Moderato', bpm: 108 },
  { label: 'Allegro', bpm: 132 },
  { label: 'Presto', bpm: 168 },
];

export const PaletteSidebar: React.FC<PaletteSidebarProps> = ({
  onApplyClef,
  onApplyKeySignature,
  onApplyTimeSignature,
  onApplyDynamic,
  onApplyArticulation,
  onApplyBarline,
  onApplyTempo,
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    clefs: true,
    time: true,
    keys: false,
    dynamics: true,
    articulations: true,
    barlines: false,
    tempo: false,
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside className="no-print w-[236px] shrink-0 bg-[#181B21] border-r border-white/8 flex flex-col overflow-y-auto select-none">
      <div className="px-4 py-3 border-b border-white/6">
        <h2 className="text-xs font-semibold text-slate-200 tracking-wide">Palettes</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Click any symbol to apply to selection
        </p>
      </div>

      {/* Clefs */}
      <PaletteSection title="Clefs" isOpen={openSections.clefs} onToggle={() => toggle('clefs')}>
        <div className="grid grid-cols-2 gap-1.5">
          {CLEFS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onApplyClef(c.id)}
              className="h-9 px-2.5 rounded-md bg-[#20242C] hover:bg-[#2A303B] border border-white/6 text-left flex items-center gap-2 transition-colors"
            >
              <span className="text-base leading-none text-slate-100">{c.glyph}</span>
              <span className="text-[11px] text-slate-300 truncate">{c.label}</span>
            </button>
          ))}
        </div>
      </PaletteSection>

      {/* Time Signatures */}
      <PaletteSection
        title="Time Signatures"
        isOpen={openSections.time}
        onToggle={() => toggle('time')}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {TIME_SIGNATURES.map((ts) => (
            <button
              key={ts.label}
              type="button"
              onClick={() => onApplyTimeSignature(ts.beats, ts.beatType)}
              className="h-8 rounded-md bg-[#20242C] hover:bg-[#2A303B] border border-white/6 text-xs font-mono-tabular font-semibold text-slate-200 transition-colors"
            >
              {ts.label}
            </button>
          ))}
        </div>
      </PaletteSection>

      {/* Key Signatures */}
      <PaletteSection
        title="Key Signatures"
        isOpen={openSections.keys}
        onToggle={() => toggle('keys')}
      >
        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
          {KEY_SIGNATURE_LIST.map((ks) => (
            <button
              key={ks.fifths}
              type="button"
              onClick={() => onApplyKeySignature(ks.fifths)}
              className="h-7 px-2.5 rounded bg-[#20242C] hover:bg-[#2A303B] border border-white/5 text-left text-[11px] text-slate-200 truncate transition-colors"
            >
              {ks.label}
            </button>
          ))}
        </div>
      </PaletteSection>

      {/* Dynamics */}
      <PaletteSection
        title="Dynamics"
        isOpen={openSections.dynamics}
        onToggle={() => toggle('dynamics')}
      >
        <div className="grid grid-cols-3 gap-1.5">
          {DYNAMICS.map((dyn) => (
            <button
              key={dyn}
              type="button"
              onClick={() => onApplyDynamic(dyn)}
              className="h-8 rounded-md bg-[#20242C] hover:bg-[#2A303B] border border-white/6 font-serif-score italic font-bold text-sm text-slate-100 transition-colors"
            >
              {dyn}
            </button>
          ))}
        </div>
      </PaletteSection>

      {/* Articulations */}
      <PaletteSection
        title="Articulations"
        isOpen={openSections.articulations}
        onToggle={() => toggle('articulations')}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {ARTICULATIONS.map((art) => (
            <button
              key={art.id}
              type="button"
              onClick={() => onApplyArticulation(art.id)}
              className="h-8 px-2 rounded-md bg-[#20242C] hover:bg-[#2A303B] border border-white/6 flex items-center gap-1.5 text-slate-200 transition-colors"
            >
              <span className="w-4 text-center font-bold text-sm">{art.symbol}</span>
              <span className="text-[11px] truncate">{art.label}</span>
            </button>
          ))}
        </div>
      </PaletteSection>

      {/* Barlines & Repeats */}
      <PaletteSection
        title="Barlines & Repeats"
        isOpen={openSections.barlines}
        onToggle={() => toggle('barlines')}
      >
        <div className="flex flex-col gap-1">
          {BARLINES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onApplyBarline(b.id)}
              className="h-7 px-2.5 rounded bg-[#20242C] hover:bg-[#2A303B] border border-white/5 text-left text-[11px] text-slate-200 transition-colors"
            >
              {b.label}
            </button>
          ))}
        </div>
      </PaletteSection>

      {/* Tempo Markings */}
      <PaletteSection title="Tempo" isOpen={openSections.tempo} onToggle={() => toggle('tempo')}>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPOS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => onApplyTempo(t.bpm)}
              className="h-8 px-2 rounded-md bg-[#20242C] hover:bg-[#2A303B] border border-white/6 flex items-center justify-between text-[11px] text-slate-200 transition-colors"
            >
              <span>{t.label}</span>
              <span className="font-mono-tabular text-slate-400">{t.bpm}</span>
            </button>
          ))}
        </div>
      </PaletteSection>
    </aside>
  );
};

function PaletteSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-slate-200 hover:bg-white/4 transition-colors"
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>
      {isOpen && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}
