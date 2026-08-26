# Cell Foundation v1 — Baseline snapshot

Captured on branch `feature/foundation-v1` before any foundation edits.

## Commands

- `npm run build`: ✅ PASS (13.96s)
- `npx tsc --noEmit`: ❌ FAIL (pre-existing errors; not related to design tokens)
- `npm run test:unit`: ❌ FAIL (pre-existing failures; fixture missing + OCR serialization mismatch)

## Pre-existing typecheck errors (snapshot)

- `src/entrypoints/content/youtube-main-world.iife.ts(156-157)`: `width` / `height` on `[number, number] | { width?; height? }`
- `src/entrypoints/local-player/main.tsx(219-220)`: `navClusterSettings` missing on `Settings`
- `src/entrypoints/mock-hardsub-page/hardSubMockMain.ts(111-153)`: `ctx` possibly null; unused `origRenderFrame`
- `src/entrypoints/mock-streaming-page/MockStreamingPage.tsx(133)`: unused `handleSeek`
- `src/entrypoints/mock-youtube/YouTubeWatchPage.tsx(55,555)`: `SrtCue` not found; type comparison
- `src/entrypoints/offscreen/ffmpegRunner.ts(350-356)`: unreachable comparisons; spread type
- `src/entrypoints/reader/App.tsx(257,264)`: `useMemo` not found
- `src/features/subtitle/logic/iframePlayerModeBridge.ts(34-39)`: unused constants
- `src/features/subtitle/logic/subtitleSearch.ts(70)`: promise type missing properties
- `src/features/subtitle/ui/HostManagerSheet.test.tsx(26,84,95)`: type conversion / overload errors
- `src/features/subtitle/ui/SubtitleSearchPanel.tsx(248)`: unused `hasAdvancedValues`
- `src/shared/config/messages.ts(94)`: `OCR_REGION_COMMAND` not assignable
- `src/shared/ui/LabelGroup.tsx(45)`: `trigger` not on `TooltipProps`

## Pre-existing unit test failures (snapshot)

- `src/features/dictionary/logic/phraseMatcher.fixture.test.ts`: fixture `CambridgeV1_0_20260121_1628_20260325_1617.json` missing under `tests/data-test/resource/en/dictionary/`
- `src/entrypoints/content/ocrController.test.ts`: `image.data` sent as base64 string instead of `Array.from(Uint8ClampedArray)`

## Baseline build warnings

- `INEFFECTIVE_DYNAMIC_IMPORT` on `frequencyRepository.ts`, `dictionaryRepository.ts`
- Chunk size > 500 kB warnings for `opencv.js`, `ort` bundles
- vite:css took 53% of plugin time

## Notes

- The foundation task will be measured by regressions relative to this baseline, not by making the entire project typecheck pass, because these failures are outside the foundation scope and predate the work.
