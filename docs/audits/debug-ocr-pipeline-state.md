# Debug OCR Pipeline → Overlay Subtitle Block — State Trace

## AC cuối cùng (Contract)
```
Given: Extension loaded, mock hardsub page (http://127.0.0.1:4325/index.html) open, video playing
When: User triggers OCR (debug init or UI toggle)
Then: OCR pipeline runs → subtitle blocks detected → overlay rendered on video
```

## Pipeline flow (theoretical)
```
1. ocrContentScript.ts — receives __CELL_OCR_DEBUG_INIT
2. ocrController.ts — sends OCR_INIT to background
3. background/handlers/ocr.ts — ensureOffscreenReady → forward OCR_INIT to offscreen
4. offscreen/ocrRunner.ts — handleOcrInit → engine.initialize()
5. paddleOcrEngine.ts — dynamic import @techstark/opencv-js → PaddleOCR.create()
6. OCR_RECOGNIZE — ocrPipeline.ts captures frame → sends to offscreen → returns OcrResult[]
7. ocrOverlay.ts — renders subtitle blocks on video
```

## Evidence Board

### Known facts (verified)
- [x] `paddleOcrEngine.ts`: static import → dynamic import fix applied (build pass, 9/9 tests pass)
- [x] `__ocrScriptLoaded: true` — ocrRunner.ts loads in offscreen document
- [x] `__ffmpegScriptLoaded: true` — ffmpegRunner.ts loads in offscreen document
- [x] `__ocrListenerMsg: "REGISTERED@..."` — OCR listener registers on script load
- [x] `__ocrBgStep: "2-offscreen-ready"` — background receives OCR_INIT, offscreen ready
- [x] `__msgBusLast: "OCR_INIT@..."` — MessageBus.handleMessage receives OCR_INIT
- [x] `ocrInitStep: "c-send-returned-promise"` — ocrController sends OCR_INIT, promise pending
- [x] `ocrDirectInitResult: "timeout-15s"` — OCR_INIT never resolves (offscreen doesn't respond)
- [x] `ocrPingResult: "No handler for type: OFFSCREEN_PING"` — OFFSCREEN_PING has no handler
- [x] `__ocrInitProgress` — NOT SET → handleOcrInit never runs or hangs before first dbg()
- [x] `__ocrOffscreenError` — NOT SET → no window.onerror fired (no CSP EvalError this run)
- [x] Build pass, patch-ocr-csp pass (no `Function(` remaining in opencv/ort bundles)

### Guesses / theories
- [ ] handleOcrInit hangs at `await engine.initialize()` — dynamic import of @techstark/opencv-js blocks
- [ ] MessageBus listener and ocrRunner listener conflict — both register on chrome.runtime.onMessage
- [ ] ocrRunner listener returns undefined for OCR_INIT (no `return true` for async)
- [ ] Background forwards OCR_INIT but offscreen listener doesn't see it (different context)

### Contract conditions checklist
- [ ] Extension loaded: met (ocrInitCalled=true)
- [ ] Mock hardsub page open: met (title="HardSub Test — OCR Mock Player")
- [ ] Video playing: met (v.play() called)
- [ ] OCR triggered: met (__CELL_OCR_DEBUG_INIT sent)

## Debug steps taken

### Step 0: Contract — DONE
### Step 1: Preserve — DONE (evidence board above)
### Step 2: Reproduce — DONE (OCR_INIT hangs every time, 3+ runs)
### Step 3: Localize — IN PROGRESS
  - Bug is in offscreen document: listener registers but handleOcrInit doesn't run
  - Next: trace why OCR_INIT message doesn't reach ocrMessageListener

## Changes made so far
1. `src/features/ocr/engine/paddleOcrEngine.ts`: static import → dynamic import in initialize()
2. `src/features/ocr/engine/paddleOcrEngine.test.ts`: mock @techstark/opencv-js + chrome-apis
3. `src/entrypoints/offscreen/ocrRunner.ts`: added window.onerror + debug storage logs
4. `src/entrypoints/content/ocrContentScript.ts`: added OFFSCREEN_PING test + debug read keys
5. `src/entrypoints/background/handlers/ocr.ts`: added __ocrBgStep debug storage
6. `src/entrypoints/background/messageBus.ts`: added __msgBusLast debug storage
7. `src/entrypoints/offscreen/ffmpegRunner.ts`: added __ffmpegScriptLoaded debug storage
