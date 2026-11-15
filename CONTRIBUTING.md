# Contributing to OpusWeb

**OpusWeb 1.1.0 · by Ray Foo**

Contributions are welcome! OpusWeb is a clean, single-user browser music notation studio. Keep changes focused, typed, and documented.

## Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (`server.ts` + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
3. Run TypeScript checks and verify the production bundle before submitting changes:
   ```bash
   npm run lint
   npm run build
   ```

## Code Organization & Conventions

- **Music theory & measure packing** live in `src/utils/musicTheory.ts` and must stay pure (no DOM or audio access).
- **Tablature** uses `TabInstrumentConfig` (`GUITAR_TAB_CONFIG`, `BASS_TAB_CONFIG`). Do not hardcode 6-string guitar assumptions; use `getTabConfig(part)` and the generic `assignTabPositions` / `getValidTabPositions` / `tabPositionToWrittenPitch` helpers.
- **Chord symbols** are parsed and voiced in `src/utils/chords.ts`. Add new qualities to `QUALITY_INTERVALS` and cover slash chords.
- **Score AST changes** belong in `src/types/score.ts`; new fields must remain optional so existing `.opusweb.json` backups and imports keep working.
- **Audio**:
  - `src/audio/synthEngine.ts` owns the timeline, repeat expansion, lookahead scheduler, and sampled/synth dispatch.
  - `src/audio/gmSoundfont.ts` owns GM program → soundfont mapping, on-demand loading, and mirror fallback.
  - `src/audio/drumKit.ts` owns drum-position mapping and synthesized percussion.
- **Importers/exporters** stay isolated in `src/utils/scoreParsers.ts` and `src/utils/scoreExporters.ts` so they remain testable without DOM rendering.
- **UI theming**: use the CSS tokens in `src/index.css` (`--bg-*`, `--text-*`, `--border-*`, `--surface-*`, accent). Avoid hardcoded chrome colors so light/dark mode stays consistent. Sheet-page content is intentionally fixed to paper colors.
- **Engraving** changes belong in `src/components/ScoreCanvas.tsx`; keep VexFlow output deterministic and preserve the interactive overlay hit boxes.
- Maintain strict TypeScript (`npm run lint`) and Tailwind CSS styling.

## Documentation

Update the relevant Markdown files with every user-visible change:

- `README.md` — overview, setup, deployment.
- `FEATURES.md` — complete feature reference and limitations.
- `USER_GUIDE.md` — step-by-step workflows.
- `ARCHITECTURE.md` — AST, modules, audio/engraving pipelines.
- `CHANGELOG.md` — add entries under a new version heading.

When bumping the app version, update `src/version.ts` and `package.json` together.

## Security

Any change to `/api/fetch-score` in `server.ts` must preserve the SSRF protections (blocking private/loopback IP ranges and non-HTTP/HTTPS protocols) and the 15 MB payload limit. Never commit `.env` files or credentials.

## GitHub Pages

The static build uses `GITHUB_PAGES=true npm run build` (base path `/OpusWeb/`) and publishes `dist/` to the `gh-pages` branch. Remember that the web-link proxy is unavailable on static hosting.
