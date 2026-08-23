# OCR Test Data

Input dataset cho Orca OCR Layer TDD. 4 tiers:

## Tier 1: JSON Fixtures (`fixtures/`)

Pure logic unit tests — không cần real images.

| File | Cho task | Nội dung |
|---|---|---|
| `scriptRunCases.json` | T2 (scriptRunSegmenter) | 15 text inputs + expected script-runs (zh/en/ja/ko/unknown, mixed intra-box) |
| `ocrResultMocks.json` | T13, T15 (ocrTokenWrap, languageRouter) | 8 mock OcrResult[] fixtures (poly+text+score, mixed, empty, low-score) |
| `imageDataMocks.json` | T9, T10 (drmGuard, frameSampler) | 5 mock ImageData (4x4 RGBA) + 4 luma-diff cases (black, white, DRM, subtitle, gradient) |
| `cropRectCases.json` | T8, T11 (subtitleRegionDetector, ocrCache) | 8 crop rect cases + 5 cache key cases + 3 videoId cases |

## Tier 2: Synthetic Hard-Sub Frames (`frames/`)

Canvas-generated PNGs — simulate real hard-sub video frames.

| File | Script | Edge case |
|---|---|---|
| `hardsub-zh-01.png` | zh | Standard Chinese subtitle |
| `hardsub-en-01.png` | en | Standard English subtitle |
| `hardsub-ja-01.png` | ja | Standard Japanese subtitle |
| `hardsub-mixed-zh-en-01.png` | zh+en | Mixed intra-box (CN+EN same line) |
| `hardsub-mixed-3-lines-01.png` | zh+en+ja | 3 lines mixed (CN+EN, JA, EN+CN) |
| `hardsub-yellow-01.png` | zh | Yellow subtitle (common Asian hard-sub) |
| `hardsub-low-contrast-01.png` | en | Low contrast — tests OCR robustness |
| `drm-black-frame.png` | — | DRM black frame (Widevine simulation) |
| `hardsub-zh-02-long-text.png` | zh | Long Chinese text — tests OCR long lines |
| `hardsub-en-02-two-lines.png` | en | Two-line English subtitle |

**Regenerate**: `node tests/data-test/ocr/scripts/generate-frames.mjs` (requires `canvas` package)

## Tier 3: Real Hard-Sub Frame Screenshots (`real-frames/`)

Screenshots từ sites thật — cho spike T0 + browser test T25.

| File | Source | Purpose |
|---|---|---|
| `themoviebox-zh-01.png` | themoviebox.xyz | Real hard-sub Chinese frame |
| `kisskh-zh-01.png` | kisskh.co | Real hard-sub Chinese frame |
| `moviepire-en-01.png` | moviepire.ru | Real hard-sub English frame |
| `netflix-drm-01.png` | netflix.com | DRM black frame (Widevine) |

**Collect**: browser test stealth-chrome-devtools — navigate site, screenshot video frame.

## Tier 4: Mock Hard-Sub Video Page

Extend `scripts/serve-mock-pages.mjs` — mock page với `<video>` + canvas overlay (burned-in subtitle).

| Page | Port | Purpose |
|---|---|---|
| `mock-hardsub-page` | 4325 | Hard-sub video (canvas overlay subtitle) cho browser test |

## Usage

### Unit tests (Tier 1)
```typescript
import scriptRunCases from '@/tests/data-test/ocr/fixtures/scriptRunCases.json';
import ocrResultMocks from '@/tests/data-test/ocr/fixtures/ocrResultMocks.json';
```

### Integration tests (Tier 2)
```typescript
import { readFileSync } from 'fs';
const framePng = readFileSync('tests/data-test/ocr/frames/hardsub-zh-01.png');
```

### Browser tests (Tier 3 + Tier 4)
```typescript
// Navigate to mock hard-sub page
await navigate('http://127.0.0.1:4325/index.html');
// Or screenshot real site
await navigate('https://themoviebox.xyz/movies/...');
await takeScreenshot();
```
