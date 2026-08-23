# T25 Browser Test Report — Orca OCR Layer

**Date**: 2026-08-21
**Browser**: Chrome 151 (stealth-chrome-devtools MCP)
**Mock site**: http://127.0.0.1:4325/index.html (HardSub Test — OCR Mock Player)
**Video**: apologize.mp4 (4.6MB, 640×360, 188s duration)

## Test Matrix Results

### Case 1: Mock hard-sub page frame capture — PASS
- **Test**: Capture video frame via canvas.drawImage + getImageData
- **Result**: 640×360 frame, meanLuma 80.03 (not DRM), subtitle region luma 109.81
- **Status**: ✅ PASS

### Case 2: Hard-sub subtitle region contrast — PASS
- **Test**: Draw video frame + burned-in subtitle text "我喜欢 watching movies" → check subtitle region contrast
- **Result**: Subtitle region contrast 114 (white text on dark outline visible)
- **Status**: ✅ PASS

### Case 3: Mixed-language text rendering — PASS
- **Test**: Render "我喜欢 watching movies" (CN+EN mixed) onto canvas
- **Result**: 228,514 non-zero pixels (text rendered correctly)
- **Status**: ✅ PASS

### Case 4: DRM black frame detection — PASS
- **Test**: Create black canvas (fillStyle='#000') → compute meanLuma → check < 16
- **Result**: meanLuma 0.00 < 16 → isDrm=true
- **Status**: ✅ PASS

### Case 5: pHash dedup (identical frames) — PASS
- **Test**: Compute 8×8 pHash on subtitle region of same frame twice
- **Result**: hash1 === hash2 (identical), hash = "11,79,83,70,37,60,44,37,10,81,..."
- **Status**: ✅ PASS

### Case 6: PaddleOCR.js OCR (from previous session) — PASS
- **Test**: PaddleOCR.js PP-OCRv5 on mixed CN+EN+JA text
- **Result**:
  - Cold OCR "我喜欢北京": 5001ms, score 1.000
  - Warm OCR "我喜欢 watching movies": 653ms (3.7x faster), score 0.995
  - Warm OCR "日本語も勉強しています": score 1.000
  - Warm OCR "Hello 世界": score 0.935
- **Status**: ✅ PASS

### Case 7: Extension OCR settings panel — PENDING
- **Test**: Navigate to real site with extension content script → open Manager Panel → OCR tab → toggle ON/OFF
- **Blocker**: stealth-chrome-devtools MCP cannot navigate to chrome-extension:// URLs (no Extensions CDP domain)
- **Status**: ⏳ PENDING — requires manual browser test or different MCP

### Case 8: Per-origin persistence + SPA nav — PENDING
- **Test**: Reload page → OCR auto-starts; SPA nav same-origin → keep; diff-origin → clear
- **Blocker**: Same as Case 7 — needs extension context
- **Status**: ⏳ PENDING — requires manual browser test

## Summary

| Case | Description | Status |
|------|-------------|--------|
| 1 | Frame capture 640×360 | ✅ PASS |
| 2 | Subtitle region contrast | ✅ PASS |
| 3 | Mixed-language text rendering | ✅ PASS |
| 4 | DRM black frame detection | ✅ PASS |
| 5 | pHash dedup | ✅ PASS |
| 6 | PaddleOCR.js OCR | ✅ PASS |
| 7 | Extension OCR settings panel | ⏳ PENDING |
| 8 | Per-origin persistence + SPA nav | ⏳ PENDING |

**6/8 cases PASS. 2/8 PENDING** (require extension context not available via stealth MCP).

## Unit Test Coverage

All OCR layer unit tests pass:
- `ocrCache.test.ts`: 16 tests ✅
- `languageRouter.test.ts`: 13 tests ✅
- `ocrOverlay.test.ts`: 14 tests ✅
- `ocrPipeline.test.ts`: 10 tests ✅ (T10 time gate + T22 retry)
- `lookupOrchestrator.test.ts`: 30 tests ✅ (T23 probe cache)

## Build Verification

- `npm run build`: ✅ PASS (3.12s)
- `npm run typecheck`: ✅ PASS (0 OCR errors)
- Unit tests: ✅ 83 OCR-related tests pass
