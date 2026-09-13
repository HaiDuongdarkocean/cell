# Phase 6 — Dependency & bundle review

Date: 2026-09-13 · Branch: `audit/tech-debt-2026-09-13` · Read-only review — no dependency removed.

## Method

- `package.json` dependencies cross-referenced against `src/**` imports (static + dynamic).
- `node_modules` install size via `du -sm`; emitted chunk sizes from `npm run build` output.
- Lazy-load attribution confirmed via `__vite__mapDeps` chunk maps and dynamic `import()` sites.

## Heavy chunks & lazy-loading status

| Emitted chunk | Size (min) | Loaded by | Lazy? |
|---|---|---|---|
| `opencv-*.js` | 10,295 kB (3.4 MB gzip) | `@techstark/opencv-js`, dynamic `import('@techstark/opencv-js')` inside `paddleOcrEngine.initialize()` — `src/features/ocr/engine/paddleOcrEngine.ts:79` | Yes — offscreen OCR doc only |
| `mountCardCreatorDialog-*.js` | 1,276 kB | Card Creator React dialog, imported by `cardActions.ts` / `webTextDictionaryController.ts` | Yes (dialog mount) |
| `ort.bundle.min-*.js` | 395 kB | `onnxruntime-web` via `@paddleocr/paddleocr-js` (static dep) — chained from `dist-*.js` | Yes (OCR path) |
| `ui-*.js` | 431 kB | Shared React UI | Entrypoints that render UI |
| `subtitle-*.js` | 249 kB | Subtitle feature, maps to `chinesePlugin` chunk | Yes |
| `react-vendor-*.js` | 190 kB | react + react-dom | UI entrypoints |
| `dist-*.js` | 182 kB | `@paddleocr/paddleocr-js` main — dynamic import in `paddleOcrEngine.ts:57` | Yes |
| `offscreen-*.js` | 156 kB | `src/entrypoints/offscreen/ffmpeg.html` (mux.js transmuxer is inlined here) | Offscreen doc only |
| `index.ts-*.js` (SW) | 130 kB | Background service worker | SW entry |
| `chinesePlugin-*.js` | 122 kB | `src/features/dictionaryPopup/plugins/chinesePlugin.ts` (contains espeak-phonemes code) | Yes — subtitle/dictionary chain |
| `ort.webgpu.bundle.min-*.js` | 110 kB | `onnxruntime-web/webgpu` dynamic import in `src/features/tts/services/supertonicInference.ts:486` | Yes — TTS path |
| `sql-wasm-browser-*.js` | 40 kB | `sql.js` dynamic import in `src/features/dictionary/strategies/sqliteStrategy.ts:199` | Yes |

All heavyweight deps are behind dynamic `import()` or the on-demand offscreen document — nothing heavy sits on the content-script or popup critical path.

## Runtime dependencies

| Dependency | Install size | Usage in `src/` | Recommendation |
|---|---|---|---|
| `@techstark/opencv-js` (transitive via paddleocr-js) | 12 MB | Dynamic import, `paddleOcrEngine.ts` | Keep — required for OCR; already lazy. 10.3 MB chunk is the largest artifact; consider upstream `@paddleocr` lighter engine or cv-only opencv build long-term. |
| `@paddleocr/paddleocr-js` | 25 MB | 1 file (`paddleOcrEngine.ts`), dynamic | Keep — OCR engine; lazy. |
| `onnxruntime-web` | 130 MB | `supertonicInference.ts` (dynamic `/webgpu` import) + transitive static dep of paddleocr-js | Keep — two emitted bundles (~505 kB total), both lazy. Node_modules size is dev-only. |
| `mux.js` | 5 MB | `tsTransmuxer.ts`, `transmuxWorker.ts` (offscreen) | Keep — TS→MP4 transmuxing; bundled inside offscreen chunk. |
| `sql.js` | 19 MB | `sqliteStrategy.ts`, dynamic import | Keep — dictionary SQLite; lazy + `sql-wasm.wasm` in `public/`. |
| `@jocelyn-stericker/espeak-phonemes` | 1 MB | `espeakPhonemeEngine.ts` (static; lands in lazy `chinesePlugin` chunk) | Keep — IPA phonemizer; WASM + data loaded via `?url` assets. |
| `unzipit` | 1 MB | `zipAudioResolver.ts` (1 file) | **Candidate to consolidate** — fflate is already bundled and provides unzip; verify unzipit's lazy central-directory/range-read semantics are needed before swapping. |
| `fflate` | 1 MB | `fileDetector.ts`, `subtitleAutoLoad.ts` (+ 8 test files) | Keep — could absorb unzipit's role (see above). |
| `zod` | 6 MB | 6 files (message/entity schemas) | Keep — shared schema SSOT. |
| `zustand` | 1 MB | 7 stores | Keep. |
| `ts-fsrs` | 1 MB | `srsFsrsAdapter.ts` | Keep — SRS scheduling. |
| `lucide-react` | 39 MB | 6 files (icon components) | **Duplicate icon set** with `@phosphor-icons/react`. Dev-size only (tree-shaken), but consolidate to one icon library — `src/shared/icons/index.ts` already abstracts. |
| `@phosphor-icons/react` | 47 MB | 1 file (`phosphorNavIcons.tsx`) | See above — single usage; prefer whichever library `ICON_CATALOG` standardizes on. |
| `country-flag-icons` | 12 MB | `FlagIcon.tsx` (1 file) | Keep — flag glyphs; tree-shaken to used flags. Could inline the handful of flags actually rendered to drop the dep. |
| `gsap` | 7 MB | **0 references** in `src/`, `tests/`, `e2e/`, `scripts/`, docs | **Unused — remove.** Nothing imports it; animation work uses CSS/other means. |
| `react` / `react-dom` | 9 MB | 481 / 33 files | Keep. |
| `fflate`, `zod`, `zustand` | — | — | (above) |

## Not present (context said "known" — verified absent)

- `franc`, `compromise`, `@zxing/*` — **not in `package.json` and not installed** (`node_modules` check). No action needed.
- `@techstark/opencv-js` is not a direct dep — it is transitive via `@paddleocr/paddleocr-js@0.4.2` (`^4.10.0-release.1`).

## Duplicate-functionality pairs

1. **Icons:** `lucide-react` + `@phosphor-icons/react` — pick one; `src/shared/icons/index.ts` (`ICON_CATALOG`) is the funnel.
2. **Zip:** `unzipit` + `fflate` — fflate already covers gunzip/unzip; evaluate replacing the single `unzipit` call site (`zipAudioResolver.ts:45`), preserving lazy-entry/range behavior.

## Unused dependency

- **`gsap`** — declared in `dependencies`, zero imports anywhere in the repo. Recommend `npm rm gsap` in a follow-up cleanup commit.

## Lazy-loading verdict

Confirmed healthy: opencv (10.3 MB), ort bundles, paddleocr `dist-*`, `sql-wasm-browser`, `chinesePlugin`, `mountCardCreatorDialog` are all reachable only via dynamic `import()` from the offscreen document or on-demand UI mounts. The one structural caveat: `@paddleocr/paddleocr-js` declares `onnxruntime-web` as a static dep, so the ORT chunk is chained into the OCR import graph — still lazy at the entrypoint level (offscreen doc opens only when OCR runs).

## CSP hardening note (this same pass)

`scripts/patch-ocr-csp.mjs` now fails the build if any required patch applies to zero files, and scans all emitted `dist/**.js` for residual `new Function(` (hard fail under `dist/assets`, warn for CSP-exempt main-world IIFE scripts and the unreferenced `public/ffmpeg/` payload) and `eval(` (warn-only — string-literal false positives possible).
