import React, { useRef, useState } from 'react';
import {
  Download,
  FileMusic,
  FolderOpen,
  Globe,
  Keyboard,
  Loader2,
  Printer,
  Upload,
  X,
} from 'lucide-react';
import { ScoreDocument } from '../types/score';
import { KEY_SIGNATURE_LIST } from '../utils/musicTheory';
import { NewScoreOptions, STARTER_SCORES } from '../utils/starterScores';

/* ======================== OPEN / IMPORT MODAL ======================== */
interface OpenScoreModalProps {
  isOpen: boolean;
  recentScores: { id: string; title: string; updatedAt: number; sourceLabel?: string }[];
  onClose: () => void;
  onImportLocalFile: (file: File) => Promise<void>;
  onImportWebUrl: (url: string) => Promise<void>;
  onLoadStarter: (starterId: string) => void;
  onLoadRecent: (recentId: string) => void;
}

const SAMPLE_WEB_LINKS = [
  {
    label: 'Mozart – Piano Sonata K.545 (MusicXML)',
    url: 'https://raw.githubusercontent.com/opensheetmusicdisplay/opensheetmusicdisplay/develop/test/data/Mozart_Piano_Sonata_K545.mxl',
  },
  {
    label: 'Bach – Two-Part Invention No. 1 (MusicXML)',
    url: 'https://raw.githubusercontent.com/cuthbertLab/music21/master/music21/corpus/bach/bwv772.mxl',
  },
];

export const OpenScoreModal: React.FC<OpenScoreModalProps> = ({
  isOpen,
  recentScores,
  onClose,
  onImportLocalFile,
  onImportWebUrl,
  onLoadStarter,
  onLoadRecent,
}) => {
  const [tab, setTab] = useState<'local' | 'url' | 'library'>('local');
  const [webUrl, setWebUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      await onImportLocalFile(file);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse selected file.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleFetchUrl = async (targetUrl?: string) => {
    const urlToLoad = (targetUrl ?? webUrl).trim();
    if (!urlToLoad) {
      setError('Please enter a valid HTTP or HTTPS score link.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onImportWebUrl(urlToLoad);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load score from web link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-xl bg-[#181B21] border border-white/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Open or Import Score</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Single-user workspace · Local files, public web links, or starter scores
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-white/8 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="px-5 pt-3">
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#111318] rounded-lg border border-white/6">
            <button
              type="button"
              onClick={() => {
                setTab('local');
                setError(null);
              }}
              className={`h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                tab === 'local' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Local File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('url');
                setError(null);
              }}
              className={`h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                tab === 'url' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Link</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('library');
                setError(null);
              }}
              className={`h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                tab === 'library' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Library &amp; Recent</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-950/60 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-200">
              {error}
            </div>
          )}

          {tab === 'local' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mscz,.mscx,.musicxml,.mxl,.xml,.mid,.midi,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-10 px-4 rounded-xl border-2 border-dashed border-white/15 hover:border-blue-500/60 bg-[#13161B] hover:bg-[#171B22] transition-colors flex flex-col items-center justify-center gap-2.5 text-center"
              >
                {loading ? (
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                ) : (
                  <FileMusic className="w-8 h-8 text-blue-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">
                    {loading ? 'Parsing score file...' : 'Choose a score file from your computer'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports MuseScore (.mscz, .mscx), MusicXML (.musicxml, .mxl, .xml), MIDI (.mid), and OpusWeb (.json)
                  </p>
                </div>
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                Tip: You can also drag and drop any score file directly onto the sheet canvas.
              </p>
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-200 block">
                  Direct Web Link to Score File
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/scores/sonata.mscz"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleFetchUrl();
                    }}
                    className="flex-1 h-9 px-3 rounded-lg bg-[#121419] border border-white/12 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleFetchUrl()}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Load Link</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Accepts direct links to .mscz, .mscx, .musicxml, .mxl, .xml, or .mid files (GitHub links are automatically converted to raw files).
                </p>
              </div>

              <div className="pt-2 border-t border-white/8 space-y-2">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Try a Public Web Score
                </span>
                <div className="space-y-1.5">
                  {SAMPLE_WEB_LINKS.map((item) => (
                    <button
                      key={item.url}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setWebUrl(item.url);
                        void handleFetchUrl(item.url);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#1F242D] hover:bg-[#272D38] border border-white/6 text-left flex items-center justify-between gap-2 transition-colors"
                    >
                      <span className="text-xs text-slate-200 truncate">{item.label}</span>
                      <span className="text-[11px] text-blue-400 shrink-0">Load</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'library' && (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {recentScores.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-400 block">
                    Saved in This Browser
                  </span>
                  {recentScores.map((rs) => (
                    <button
                      key={rs.id}
                      type="button"
                      onClick={() => {
                        onLoadRecent(rs.id);
                        onClose();
                      }}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#1F242D] hover:bg-[#272D38] border border-white/6 text-left flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{rs.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {rs.sourceLabel || 'Local Browser'} ·{' '}
                          {new Date(rs.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs text-blue-400 shrink-0">Open</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Starter Scores &amp; Templates
                </span>
                {STARTER_SCORES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onLoadStarter(st.id);
                      onClose();
                    }}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#1F242D] hover:bg-[#272D38] border border-white/6 text-left flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{st.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{st.subtitle}</p>
                    </div>
                    <span className="text-xs text-blue-400 shrink-0">Open</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ======================== EXPORT MODAL ======================== */
interface ExportModalProps {
  isOpen: boolean;
  score: ScoreDocument;
  onClose: () => void;
  onExport: (format: 'mscz' | 'mscx' | 'musicxml' | 'mid' | 'json' | 'print') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  score,
  onClose,
  onExport,
}) => {
  if (!isOpen) return null;

  const formats: {
    id: 'mscz' | 'mscx' | 'musicxml' | 'mid' | 'json' | 'print';
    title: string;
    desc: string;
    ext: string;
  }[] = [
    {
      id: 'mscz',
      title: 'MuseScore Compressed Score',
      desc: 'Native .mscz archive compatible with MuseScore Studio 3 & 4.',
      ext: '.mscz',
    },
    {
      id: 'mscx',
      title: 'MuseScore Uncompressed XML',
      desc: 'Readable XML source for MuseScore desktop or version control.',
      ext: '.mscx',
    },
    {
      id: 'musicxml',
      title: 'MusicXML 3.1',
      desc: 'Universal notation interchange for Sibelius, Finale, Dorico, and MuseScore.',
      ext: '.musicxml',
    },
    {
      id: 'mid',
      title: 'Standard MIDI File',
      desc: 'Multi-track MIDI sequence for DAWs and hardware synthesizers.',
      ext: '.mid',
    },
    {
      id: 'json',
      title: 'OpusWeb Score Backup',
      desc: 'Full lossless project snapshot including instrument mixer settings.',
      ext: '.json',
    },
    {
      id: 'print',
      title: 'Print / Save as PDF',
      desc: 'Engraved A4 sheet music layout ready for paper or browser PDF export.',
      ext: 'PDF',
    },
  ];

  return (
    <div className="no-print fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-[#181B21] border border-white/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Export Score</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{score.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-white/8 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => {
                onExport(fmt.id);
                onClose();
              }}
              className="w-full px-3.5 py-3 rounded-lg bg-[#1E222A] hover:bg-[#272C36] border border-white/6 text-left flex items-center justify-between gap-3 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{fmt.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{fmt.desc}</p>
              </div>
              <span className="font-mono-tabular text-xs font-semibold text-blue-400 flex items-center gap-1.5 shrink-0">
                {fmt.id === 'print' ? (
                  <Printer className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {fmt.ext}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ======================== NEW SCORE WIZARD ======================== */
interface NewScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (opts: NewScoreOptions) => void;
}

export const NewScoreModal: React.FC<NewScoreModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('Untitled Composition');
  const [composer, setComposer] = useState('');
  const [template, setTemplate] = useState<NewScoreOptions['template']>('piano');
  const [keyFifths, setKeyFifths] = useState(0);
  const [beats, setBeats] = useState(4);
  const [beatType, setBeatType] = useState(4);
  const [tempo, setTempo] = useState(120);
  const [measureCount, setMeasureCount] = useState(12);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      title: title.trim() || 'Untitled Score',
      composer: composer.trim(),
      template,
      keyFifths,
      beats,
      beatType,
      tempo,
      measureCount,
    });
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl bg-[#181B21] border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Create New Score</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-white/8 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Score Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-[#121419] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Composer</label>
              <input
                type="text"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Optional"
                className="w-full h-9 px-3 rounded-lg bg-[#121419] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1.5">Instrumentation</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'piano', label: 'Piano Grand Staff' },
                  { id: 'treble', label: 'Treble Solo' },
                  { id: 'bass', label: 'Bass / Cello' },
                  { id: 'guitar', label: 'Guitar + TAB' },
                  { id: 'quartet', label: 'String Quartet' },
                  { id: 'choir', label: 'SATB Choir' },
                ] as const
              ).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplate(tpl.id)}
                  className={`h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors truncate ${
                    template === tpl.id
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-[#121419] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Key Signature</label>
              <select
                value={keyFifths}
                onChange={(e) => setKeyFifths(Number(e.target.value))}
                className="w-full h-9 px-2.5 rounded-lg bg-[#121419] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {KEY_SIGNATURE_LIST.map((k) => (
                  <option key={k.fifths} value={k.fifths}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Time Signature</label>
              <select
                value={`${beats}/${beatType}`}
                onChange={(e) => {
                  const [b, bt] = e.target.value.split('/').map(Number);
                  setBeats(b);
                  setBeatType(bt);
                }}
                className="w-full h-9 px-2.5 rounded-lg bg-[#121419] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {['4/4', '3/4', '2/4', '6/8', '3/8', '2/2', '5/4'].map((ts) => (
                  <option key={ts} value={ts}>
                    {ts}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Tempo (BPM)</label>
              <input
                type="number"
                min={30}
                max={260}
                value={tempo}
                onChange={(e) => setTempo(Math.max(30, Math.min(260, Number(e.target.value) || 120)))}
                className="w-full h-9 px-2.5 rounded-lg bg-[#121419] border border-white/10 text-xs font-mono-tabular text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Initial Measures ({measureCount})
            </label>
            <input
              type="range"
              min={4}
              max={64}
              step={4}
              value={measureCount}
              onChange={(e) => setMeasureCount(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-white/8 flex items-center justify-end gap-2 bg-[#14171C]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/8"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            Create Score
          </button>
        </div>
      </form>
    </div>
  );
};

/* ======================== SHORTCUTS MODAL ======================== */
export const ShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const rows = [
    ['N', 'Toggle Note Input Mode'],
    ['1 – 6', 'Select Whole, Half, Quarter, 8th, 16th, 32nd duration'],
    ['A – G', 'Enter note by letter name at cursor / selection'],
    ['0 or R', 'Enter Rest / Toggle Rest mode'],
    ['.', 'Toggle Dotted note duration'],
    ['T', 'Toggle Tie to next note'],
    ['↑ / ↓', 'Move selected note diatonically (Shift+↑/↓ for Octave)'],
    ['← / →', 'Navigate to previous or next note/rest'],
    ['Delete', 'Clear note to rest'],
    ['Space', 'Play / Pause score playback'],
    ['Ctrl / Cmd + Z', 'Undo (Ctrl/Cmd + Shift + Z to Redo)'],
  ];

  return (
    <div className="no-print fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-[#181B21] border border-white/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-white/8 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 divide-y divide-white/6">
          {rows.map(([key, desc]) => (
            <div key={key} className="py-2 flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-300">{desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-[#111318] border border-white/12 font-mono-tabular text-[11px] text-blue-300 whitespace-nowrap shrink-0">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
