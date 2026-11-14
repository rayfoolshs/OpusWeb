# Contributing to OpusWeb

Contributions are welcome! OpusWeb is designed as a clean, single-user browser music notation studio.

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

- Keep music theory math and measure-packing logic pure inside `src/utils/musicTheory.ts`.
- Keep file format importers/exporters isolated in `src/utils/scoreParsers.ts` and `src/utils/scoreExporters.ts` so they remain testable without DOM rendering.
- All Web Audio synthesis lives in `src/audio/synthEngine.ts`.
- Maintain strict TypeScript types (`tsc --noEmit`) and Tailwind CSS styling (`src/index.css`).
- Any changes to `/api/fetch-score` in `server.ts` must preserve SSRF protections (blocking private/loopback IP ranges and non-HTTP/HTTPS protocols) and payload limits.
