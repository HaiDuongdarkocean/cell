# Spec: OCR Split Dual-Stream + Multilingual Language Support

> Status: **Draft** (reviewed 2026-08-22 — critical/major issues resolved, see Revision notes)
> Depends on: `orca-ocr-layer.md` (OCR engine, pipeline, overlay), ADR-081 (region overlay node-reuse contract)
> Confirmed intent: 2026-08-22
> Sources: [PaddleOCR PP-OCRv5 multilingual](https://www.paddleocr.ai/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html), [@paddleocr/paddleocr-js npm](https://www.npmjs.com/package/@paddleocr/paddleocr-js)

## Objective

Khi bật OCR, user có thể toggle **Split** để chia OCR region thành 2 nửa (top + bottom). Mỗi nửa OCR với language hint riêng (target/native) → improve accuracy. OCR text → 2 virtual tracks (`OCR Target (live)` + `OCR Native (live)`) → auto-switch thay thế subtitle hiện tại.

Đồng thời mở rộng language support từ 4 modes hiện tại (`auto/zh/en/ja`) lên **tất cả 106 ngôn ngữ** PaddleOCR PP-OCRv5 hỗ trợ. Language dropdown default = system target/native language, user có thể overwrite + reset về system default.

### User stories

1. **Split toggle:** User bật OCR → region overlay hiện → bật **Split toggle trong OCR Settings Panel** → region chia đôi (top/bottom) → xuất hiện thanh kéo giữa 2 nửa ngay trên video (kéo được ở view mode, không cần vào select/edit) → user kéo để thay đổi tỷ lệ (VD: top 70%, bottom 30%). Tỷ lệ persist khi thả chuột (commit on mouseup — real-time chỉ update UI).
2. **Dual-stream OCR:** Top region OCR với target language (VD: `en`), bottom region OCR với native language (VD: `vi`). Mỗi stream có pipeline state riêng (luma/pHash/text dedup) → 2 dòng text độc lập.
3. **Virtual tracks:** OCR text → SrtCue (timing theo `video.currentTime`, dedup text giống nhau liên tiếp) → 2 virtual tracks hiện trong Manager Panel → auto-switch sang 2 track này.
4. **Swap top/bottom:** Trong Settings, user chọn top = target hay native (swap linh hoạt).
5. **Split ratio sync:** Setting panel hiển thị split ratio slider → kéo slider sync với thanh kéo trên video và ngược lại.
6. **Toggle off split:** User tắt Split toggle → merge về 1 region → OCR single-stream như cũ (hitboxes only, không virtual track) → virtual tracks bị remove.
7. **Multilingual dropdown:** OCR Settings có 2 dropdown (target lang + native lang) với **tất cả 106 ngôn ngữ** PaddleOCR hỗ trợ. Default = system `subtitleOverlayTargetLanguage` / `subtitleOverlayNativeLanguage`. User có thể overwrite. Nút **Reset** bên cạnh → reset về system default.
8. **Language improve accuracy:** Mỗi language hint → PaddleOCR tự chọn recognition model phù hợp (VD: `vi` → `latin` model, `ko` → `korean` model, `ar` → `arabic` model). Default `auto` → default model (CN+EN+JA mixed).
9. **First-enable with default bottom region:** Nếu bật split khi region vẫn là default bottom (100%×15%) → tự nâng region lên bottom 40% (mỗi nửa 20% — đủ 1 dòng chữ mỗi stream) + hint trong panel mời user tinh chỉnh. Custom region giữ nguyên khi bật split.

### Out of scope

- Download SRT file (chỉ virtual track trong app)
- OCR accuracy tuning (dùng engine hiện có)
- Custom region per split half (split ratio là 1 value chung)
- Split left/right (chỉ top/bottom)
- Translate OCR text (OCR nhận dạng as-is, language hint improve accuracy)
- Bundle toàn bộ recognition models trong extension — chỉ default model (`ch`) giữ bundled; 11 multilingual models lazy-load từ CDN → IndexedDB cache (weights là data, không phải code). Xem ADR-082.

## Tech Stack

- **OCR engine**: PaddleOcrEngine hiện có (PP-OCRv5 mobile, WebGPU/WASM)
- **Language models**: 12 PP-OCRv5 recognition models — default model (`ch`) giữ bundled trong extension; 11 multilingual models (en, korean, latin, eslav, cyrillic, th, el, arabic, devanagari, ta, te) lazy-load từ CDN → IndexedDB cache (ADR-082)
  - Source: [PaddleOCR PP-OCRv5 multilingual docs](https://www.paddleocr.ai/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html#5-models-and-their-supported-languages) — verified 2026-08-22: 12 models (default + 11 multilingual), 106 languages; `japan`/`chinese_cht` map về default model, KHÔNG phải model riêng
- **Region selector**: `RegionSelector` class hiện có + extend (tuân thủ ADR-081 node-reuse contract)
- **Subtitle track**: Virtual track pattern (reuse `translatedNativeSlot` pattern trong `contentScriptController.ts`)
- **SRT generation**: `cuesToSrt()` hiện có (`features/subtitle/logic/cuesToSrt.ts`)
- **Persistence**: `OcrOriginState` extend thêm split fields + per-stream language override
- **Settings panel**: `OcrSettingsPanel.tsx` extend

## Data Model

### OcrOriginState — extend

```typescript
export interface OcrOriginState {
  // ... existing fields ...
  /** Split enabled — chia đôi region thành top + bottom. Default false. */
  readonly splitEnabled: boolean;
  /** Split ratio — tỷ lệ top region / total region (0.1-0.9). Default 0.5 (50/50). */
  readonly splitRatio: number;
  /** Top region = target language? true = top=target, false = top=native. Default true. */
  readonly splitTopIsTarget: boolean;
  /** Target language override — PaddleOCR abbreviation (e.g. 'en', 'vi', 'ch'). null = use system default. */
  readonly targetLangOverride: string | null;
  /** Native language override — PaddleOCR abbreviation. null = use system default. */
  readonly nativeLangOverride: string | null;
}
```

Default:
```typescript
splitEnabled: false,
splitRatio: 0.5,
splitTopIsTarget: true,
targetLangOverride: null,
nativeLangOverride: null,
```

### OcrLanguageMode — expand to all PaddleOCR languages

```typescript
/** PaddleOCR PP-OCRv5 language abbreviation — derived from the catalog below
 *  (SSOT: typo nào cũng fail compile, không cần `'auto' | string` mất an toàn kiểu).
 *  106 languages across 12 recognition models (default + 11 multilingual).
 *  Source: https://www.paddleocr.ai/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html
 *  'auto' = default model (CN+EN+JA mixed, best default for unknown content). */
export type PaddleLangAbbr = (typeof PADDLE_OCR_LANGUAGE_GROUPS)[number]['languages'][number]['abbr'];
export type OcrLanguageMode = 'auto' | PaddleLangAbbr;
```

### PaddleOCR language catalog — single source of truth

```typescript
/** PP-OCRv5 recognition model → supported languages. */
interface PaddleOcrModelGroup {
  readonly model: string;          // Recognition model name
  readonly languages: readonly { readonly abbr: string; readonly label: string }[];
}

/** 12 recognition models covering 106 languages (default + 11 multilingual).
 *  Note: 'ku' (Kurdish) appears in both latin & arabic lists in PaddleOCR docs;
 *  'ru/be/uk' in both eslav & cyrillic — we list each abbr exactly ONCE
 *  (eslav preferred for ru/be/uk: smaller model, same accuracy per docs).
 *  Source: PaddleOCR docs §5 "Models and Their Supported Languages" (verified 2026-08-22). */
export const PADDLE_OCR_LANGUAGE_GROUPS: readonly PaddleOcrModelGroup[] = [
  { model: 'ch', languages: [
    { abbr: 'ch', label: 'Chinese & English' },
    { abbr: 'japan', label: 'Japanese' },
    { abbr: 'chinese_cht', label: 'Traditional Chinese' },
  ]},
  { model: 'en', languages: [
    { abbr: 'en', label: 'English (optimized)' },
  ]},
  { model: 'korean', languages: [
    { abbr: 'korean', label: 'Korean' },
  ]},
  { model: 'latin', languages: [
    { abbr: 'fr', label: 'French' }, { abbr: 'de', label: 'German' },
    { abbr: 'af', label: 'Afrikaans' }, { abbr: 'it', label: 'Italian' },
    { abbr: 'es', label: 'Spanish' }, { abbr: 'bs', label: 'Bosnian' },
    { abbr: 'pt', label: 'Portuguese' }, { abbr: 'cs', label: 'Czech' },
    { abbr: 'cy', label: 'Welsh' }, { abbr: 'da', label: 'Danish' },
    { abbr: 'et', label: 'Estonian' }, { abbr: 'ga', label: 'Irish' },
    { abbr: 'hr', label: 'Croatian' }, { abbr: 'uz', label: 'Uzbek' },
    { abbr: 'hu', label: 'Hungarian' }, { abbr: 'rs_latin', label: 'Serbian (Latin)' },
    { abbr: 'id', label: 'Indonesian' }, { abbr: 'oc', label: 'Occitan' },
    { abbr: 'is', label: 'Icelandic' }, { abbr: 'lt', label: 'Lithuanian' },
    { abbr: 'mi', label: 'Maori' }, { abbr: 'ms', label: 'Malay' },
    { abbr: 'nl', label: 'Dutch' }, { abbr: 'no', label: 'Norwegian' },
    { abbr: 'pl', label: 'Polish' }, { abbr: 'sk', label: 'Slovak' },
    { abbr: 'sl', label: 'Slovenian' }, { abbr: 'sq', label: 'Albanian' },
    { abbr: 'sv', label: 'Swedish' }, { abbr: 'sw', label: 'Swahili' },
    { abbr: 'tl', label: 'Tagalog' }, { abbr: 'tr', label: 'Turkish' },
    { abbr: 'la', label: 'Latin' }, { abbr: 'az', label: 'Azerbaijani' },
    { abbr: 'ku', label: 'Kurdish' }, { abbr: 'lv', label: 'Latvian' },
    { abbr: 'mt', label: 'Maltese' }, { abbr: 'pi', label: 'Pali' },
    { abbr: 'ro', label: 'Romanian' }, { abbr: 'vi', label: 'Vietnamese' },
    { abbr: 'fi', label: 'Finnish' }, { abbr: 'eu', label: 'Basque' },
    { abbr: 'gl', label: 'Galician' }, { abbr: 'lb', label: 'Luxembourgish' },
    { abbr: 'rm', label: 'Romansh' }, { abbr: 'ca', label: 'Catalan' },
    { abbr: 'qu', label: 'Quechua' },
  ]},
  { model: 'eslav', languages: [
    { abbr: 'ru', label: 'Russian' }, { abbr: 'be', label: 'Belarusian' },
    { abbr: 'uk', label: 'Ukrainian' },
  ]},
  { model: 'cyrillic', languages: [
    { abbr: 'rs_cyrillic', label: 'Serbian (Cyrillic)' }, { abbr: 'bg', label: 'Bulgarian' },
    { abbr: 'mn', label: 'Mongolian' }, { abbr: 'ab', label: 'Abkhaz' },
    { abbr: 'ady', label: 'Adyghe' }, { abbr: 'kbd', label: 'Kabardian' },
    { abbr: 'av', label: 'Avar' }, { abbr: 'dar', label: 'Dargwa' },
    { abbr: 'inh', label: 'Ingush' }, { abbr: 'ce', label: 'Chechen' },
    { abbr: 'lki', label: 'Lak' }, { abbr: 'lez', label: 'Lezgian' },
    { abbr: 'tab', label: 'Tabasaran' }, { abbr: 'kk', label: 'Kazakh' },
    { abbr: 'ky', label: 'Kyrgyz' }, { abbr: 'tg', label: 'Tajik' },
    { abbr: 'mk', label: 'Macedonian' }, { abbr: 'tt', label: 'Tatar' },
    { abbr: 'cv', label: 'Chuvash' }, { abbr: 'ba', label: 'Bashkir' },
    { abbr: 'mhr', label: 'Mari' }, { abbr: 'mo', label: 'Moldovan' },
    { abbr: 'udm', label: 'Udmurt' }, { abbr: 'kv', label: 'Komi' },
    { abbr: 'os', label: 'Ossetian' }, { abbr: 'bua', label: 'Buriat' },
    { abbr: 'xal', label: 'Kalmyk' }, { abbr: 'tyv', label: 'Tuvinian' },
    { abbr: 'sah', label: 'Sakha' }, { abbr: 'kaa', label: 'Karakalpak' },
  ]},
  { model: 'th', languages: [{ abbr: 'th', label: 'Thai' }] },
  { model: 'el', languages: [{ abbr: 'el', label: 'Greek' }] },
  { model: 'arabic', languages: [
    { abbr: 'ar', label: 'Arabic' }, { abbr: 'fa', label: 'Persian' },
    { abbr: 'ug', label: 'Uyghur' }, { abbr: 'ur', label: 'Urdu' },
    { abbr: 'ps', label: 'Pashto' }, { abbr: 'sd', label: 'Sindhi' },
    { abbr: 'bal', label: 'Balochi' },
  ]},
  { model: 'devanagari', languages: [
    { abbr: 'hi', label: 'Hindi' }, { abbr: 'mr', label: 'Marathi' },
    { abbr: 'ne', label: 'Nepali' }, { abbr: 'bh', label: 'Bihari' },
    { abbr: 'mai', label: 'Maithili' }, { abbr: 'bho', label: 'Bhojpuri' },
    { abbr: 'mah', label: 'Magahi' }, { abbr: 'sck', label: 'Sadri' },
    { abbr: 'new', label: 'Newar' }, { abbr: 'gom', label: 'Konkani' },
    { abbr: 'sa', label: 'Sanskrit' }, { abbr: 'bgc', label: 'Haryanvi' },
  ]},
  { model: 'ta', languages: [{ abbr: 'ta', label: 'Tamil' }] },
  { model: 'te', languages: [{ abbr: 'te', label: 'Telugu' }] },
];
```

### ISO 639-1 → PaddleOCR abbreviation mapping

```typescript
/** Map system language setting (ISO 639-1) → PaddleOCR abbreviation.
 *  Used to default OCR language from subtitleOverlayTargetLanguage/NativeLanguage.
 *  System settings may store BCP-47 tags ('pt-BR') — normalize before lookup.
 *  Languages not in PaddleOCR → 'auto' (default model handles mixed CN+EN+JA). */
const ISO_TO_PADDLE: Record<string, string> = {
  zh: 'ch', en: 'en', ja: 'japan', ko: 'korean',
  vi: 'vi', fr: 'fr', de: 'de', es: 'es', it: 'it', pt: 'pt',
  ru: 'ru', th: 'th', ar: 'ar', hi: 'hi', tr: 'tr', nl: 'nl',
  pl: 'pl', sv: 'sv', da: 'da', fi: 'fi', cs: 'cs', sk: 'sk',
  hu: 'hu', ro: 'ro', bg: 'bg', uk: 'uk', el: 'el', ms: 'ms',
  id: 'id', no: 'no', is: 'is', lt: 'lt', lv: 'lv', et: 'et',
  ga: 'ga', cy: 'cy', mt: 'mt', hr: 'hr', sl: 'sl', sq: 'sq',
  // ... full map — MUST cover every abbr in PADDLE_OCR_LANGUAGE_GROUPS
  // (unit test asserts coverage; ISO 639-1 codes without a PaddleOCR abbr are omitted)
};

/** Resolve effective OCR language: override → system default → 'auto'. */
function resolveOcrLang(
  override: string | null,
  systemLang: string,        // raw system setting, may be BCP-47 ('pt-BR')
): OcrLanguageMode {
  if (override) return override as OcrLanguageMode;
  const iso = systemLang.trim().toLowerCase().split('-')[0] ?? '';
  return (ISO_TO_PADDLE[iso] ?? 'auto') as OcrLanguageMode;
}
```

### Split region computation

```typescript
/** Top region = first `ratio` fraction of parent region. */
interface SplitHalf {
  readonly xPct: number;
  readonly yPct: number;
  readonly widthPct: number;
  readonly heightPct: number;
}

/** Compute top + bottom split halves from a parent CustomRegion. */
function computeSplitHalves(
  parent: CustomRegion,
  ratio: number,        // 0.1-0.9, top fraction
): { top: SplitHalf; bottom: SplitHalf } {
  const splitY = parent.yPct + parent.heightPct * ratio;
  return {
    top:    { xPct: parent.xPct, yPct: parent.yPct, widthPct: parent.widthPct, heightPct: parent.heightPct * ratio },
    bottom: { xPct: parent.xPct, yPct: splitY,      widthPct: parent.widthPct, heightPct: parent.heightPct * (1 - ratio) },
  };
}

/** First-enable behavior: default bottom region (100%×15%) split in half gives
 *  7.5% per stream — too short for one text line. When split is enabled while
 *  still on the default bottom region, bump to bottom 40% (20% per half).
 *  Custom regions are left untouched — the user chose that geometry. */
const SPLIT_DEFAULT_REGION_PCT = 40;
```

Complexity: O(1).

### OCR → SrtCue conversion

```typescript
/** Convert OCR text stream into SrtCue[]. Dedup consecutive identical text. */
const CUE_TAIL_MS = 500;    // cue.end = last detection + tail
const CUE_MERGE_GAP_MS = 700; // same text back within gap → extend cue, don't reopen

function ocrTextToCues(
  detections: readonly OcrDetection[],
): SrtCue[] {
  // OcrDetection = { text: string, timeMs: number } — 1 per OCR frame with text
  // Single pass O(n):
  //   text changed → close previous cue (end = prevTime + CUE_TAIL_MS), open new
  //   text same → extend current cue (end = currentTime + CUE_TAIL_MS)
  //   text back to the PREVIOUS cue's text within CUE_MERGE_GAP_MS of its end
  //     → extend that cue instead of opening a new one (prevents overlapping
  //       cues on 1-2 frame OCR flicker: A → miss → A)
}
```

### Virtual OCR track slots

```typescript
interface OcrTrackSlot {
  readonly item: SubtitlePanelItem;
  cues: SrtCue[];
}
let ocrTargetSlot: OcrTrackSlot | null = null;   // role: 'target'
let ocrNativeSlot: OcrTrackSlot | null = null;    // role: 'native'
```

`SubtitlePanelItem.source` extend: `'auto' | 'imported' | 'translated' | 'searched' | 'ocr'`.

Track names are FIXED and session-scoped: `OCR Target (live)` / `OCR Native (live)` — NOT derived from `document.title` (SPA sites like kisskh change the title per episode; long titles bloat the panel). `{title}-ocr-*` naming from earlier drafts is dropped. No `.srt` suffix — these are virtual tracks, download is out of scope.

## Architecture

### RegionSelector — split UI

Split state is storage-driven (`OcrOriginState.splitEnabled`) — the toggle lives in the Settings Panel, NOT on the video toolbar (the video toolbar only exists in select/edit mode; requiring the user to enter edit mode just to split is friction). The divider is directly draggable in **view mode**.

```
View mode, split ON:
  Region container
    ├── .cell-ocr-region-rect          (parent region — dashed outline, non-interactive)
    ├── .cell-ocr-split-top            (top half — tinted fill, pointer-events: none)
    ├── .cell-ocr-split-bottom         (bottom half — tinted fill, pointer-events: none)
    └── .cell-ocr-split-divider        (draggable horizontal bar, pointer-events: auto)
         ↕ drag → update splitRatio (UI real-time) → persist on mouseup
```

**Divider**: horizontal bar at `yPct = parent.yPct + parent.heightPct * ratio`. Drag vertical → update ratio. Drag updates the divider position + panel slider in real-time; `OcrOriginState.splitRatio` is persisted **on mouseup** (not every mousemove — avoid a storage write per frame; slider path persists per-change as today).

**Render constraint (ADR-081)**: render() must UPDATE existing nodes — divider/split halves are created once on entering split mode with listeners bound at creation, same contract as handles.

**Select/edit interplay**: while split is ON, dragging/resizing the parent region in edit mode keeps the divider anchored at the stored ratio — halves recompute from the parent geometry each render.

### OCR pipeline — dual-stream

```
OcrSession.processFrame(frame):
  → captureFrame(video)                    (1 capture, 2 crops)
  → if splitEnabled:
      → computeSplitHalves(parentRegion, splitRatio)
      → topHalf = splitTopIsTarget ? targetHalf : nativeHalf
      → bottomHalf = splitTopIsTarget ? nativeHalf : targetHalf
      → runPipelineStep(crop(frame, topHalf),    targetPipelineState, targetRegion)  → targetDetections
      → runPipelineStep(crop(frame, bottomHalf), nativePipelineState,  nativeRegion) → nativeDetections
      → ocrTextToCues per stream → update 2 virtual track slots
  → else:
      → runPipelineStep(frame, ..., fullRegion) → single stream (existing, hitboxes only)
```

**Per-stream pipeline state**: each stream owns its own `OcrPipelineState` (previousLuma/pHash/Text — dedup must not cross streams). Shared across the pair: the **processing lock + time gate** (both calls run sequentially inside ONE `processFrame` under the existing lock; the time gate applies to the pair, not per-stream — otherwise the two streams drift out of phase). **DRM guard**: black-frame detection from EITHER stream stops the whole session (same behavior as single-stream today).

**Language hint per stream**:
- Target stream: `resolveOcrLang(targetLangOverride, settings.subtitleOverlayTargetLanguage)`
- Native stream: `resolveOcrLang(nativeLangOverride, settings.subtitleOverlayNativeLanguage)`
- Each resolved lang → PaddleOCR `lang` param → auto-selects recognition model
- `paddleOcrEngine.ts`: remove hardcoded `textRecognitionModelAsset` when lang needs a non-default model, let the package resolve the model URL (CDN → IndexedDB cache per ADR-082)
- Engine init is per MODEL (see messaging section) — a language change that maps to a different model downloads that model once, then both engines stay warm

**Performance** (preliminary numbers — re-measure on min-spec before shipping): 2 OCR calls per frame instead of 1, sequential under one lock. WebGPU warm ~71ms/call → ~142ms < 333ms gate (OK, matches existing `minFrameIntervalMs=333` in `DEFAULT_PIPELINE_CONFIG`). WASM warm ~263ms/call → ~526ms → the lock naturally skips frames: split on WASM settles at ~2fps effective. Accepted tradeoff (subtitle text changes slowly); surfaced in the panel as a "2× OCR work in split mode" hint when backend === 'wasm'.

### Low-RAM gate (AGENTS.md persona: ≥1GB available)

Dual engine ≈ 2× heap (~84-148MB each) — too much for min-spec machines. Gate on `navigator.deviceMemory`:

- `deviceMemory >= 4` → dual engine (2 models resident, see routing below)
- `deviceMemory < 4` → **single engine**: both streams run through the TARGET stream's model (accuracy on the native stream degrades to the target model's script coverage; hint shown once in panel). No split-disable — feature stays usable.
- Independent of RAM: if both streams resolve to the SAME model (e.g. target=`auto`→ch, native=`zh`→ch) → always share ONE engine instance. Model-keyed routing makes this free (see below).

### Messaging — model-keyed engine routing (offscreen)

`ocrRunner.ts` currently holds ONE singleton engine. Dual-stream needs engines keyed by MODEL, not by stream:

```typescript
// offscreen/ocrRunner.ts
/** Engines keyed by model name ('ch' | 'latin' | ...) — streams sharing a
 *  model share the instance (free win: target=auto + native=zh → 1 engine). */
const engines = new Map<string, OcrEngine>();
// OCR_INIT payload gains: { engineKey: string }  (model name, from PADDLE_OCR_LANGUAGE_GROUPS lookup)
// OCR_RECOGNIZE payload gains: { engineKey: string } — routed to the right engine
// OCR_DISPOSE payload gains: { engineKey?: string } — dispose one engine, or all when omitted
// LRU cap: MAX_RESIDENT_ENGINES = 2 (or 1 when deviceMemory < 4) — evict least-recently-used
```

`background/handlers/ocr.ts` forwards the payload as-is (no new logic). `OcrController` (content side) instantiates one proxy per engineKey and exposes `recognize(image, minScore, engineKey)`. First use of a new model shows a download-progress state in the panel (weights can be 5-10MB; "Downloading Vietnamese model… 43%") — no silent multi-second stall.

### Cue timing + dedup

```
OCR frame at t=video.currentTime (seconds):
  → detection = { text: ocrText, timeMs: currentTime * 1000 }
  → push to detections[]

ocrTextToCues(detections):
  → scan detections[]:
    → text changed from previous → close previous cue (end = prevTime + 500ms)
    → open new cue (start = currentTime)
    → text same → extend current cue (end = currentTime + 500ms)
  → return SrtCue[]
```

Complexity: O(n) single pass, n = number of detections.

**Edge cases**:
- Empty text → close current cue
- Seek backward → clear all detections (reuse existing `seeked` event listener)
- Video ended → close current cue

### Virtual track injection

```
OCR split ON → first OCR result:
  → remember previous active sources (activeTargetSource/activeNativeSource) for revert
  → create ocrTargetSlot = { item: { id: 'ocr-target', name: 'OCR Target (live)', source: 'ocr', role: 'target', ... }, cues: [] }
  → create ocrNativeSlot = { item: { id: 'ocr-native', name: 'OCR Native (live)', source: 'ocr', role: 'native', ... }, cues: [] }
  → blockController.loadBilingualCues(ocrTargetSlot.cues, ocrNativeSlot.cues)
  → refreshPanel('target') + refreshPanel('native')
  → auto-switch: activeTargetSource = 'ocr', activeNativeSource = 'ocr'

OCR result update:
  → ocrTargetSlot.cues = ocrTextToCues(targetDetections)
  → ocrNativeSlot.cues = ocrTextToCues(nativeDetections)
  → blockController.loadBilingualCues(ocrTargetSlot.cues, ocrNativeSlot.cues)

OCR split OFF / OCR disable:
  → ocrTargetSlot = null, ocrNativeSlot = null
  → refreshPanel('target') + refreshPanel('native')
  → revert to remembered previous active source (auto/imported/searched)
```

**mergedPanelItems() extend**: insert ocrSlot vào items list khi `source === 'ocr'` active. Follow same pattern as `translatedNativeSlot`.

### Settings panel — OcrSettingsPanel.tsx

```
OCR Settings Panel:
  ├── [existing] Detect burned-in subtitles toggle (icon scanText)
  ├── [NEW] Language section:
  │     ├── Target language dropdown (106 langs, grouped by model)
  │     │     default = resolveOcrLang(null, systemTargetLang)
  │     │     [Reset] icon-button (rotateCcw) → targetLangOverride = null
  │     │     visible ONLY when override !== null
  │     ├── Native language dropdown (106 langs, grouped by model)
  │     │     default = resolveOcrLang(null, systemNativeLang)
  │     │     [Reset] → nativeLangOverride = null (same visibility rule)
  │     └── Hint: "Defaults from your subtitle settings. Override per-site."
  ├── [existing] Scan height / Scan width sliders (default bottom mode, no custom region)
  ├── [existing] Custom region readout (when custom region exists)
  ├── [NEW] Split section:
  │     ├── Split toggle (on/off) — SSOT is OcrOriginState.splitEnabled
  │     ├── Top/Bottom assignment (radio, 2 options):
  │     │     ○ Top = Target, Bottom = Native
  │     │     ○ Top = Native, Bottom = Target
  │     └── Split ratio slider (10% - 90%)
  │           ↕ sync với divider trên video (2 chiều, persist on mouseup/divider-drop)
  │     └── [conditional] low-RAM hint: "Low memory: both halves use the target model"
  │     └── [conditional] model download state: "Downloading {language} model… X%"
  └── [existing] Select Region / Edit / Reset (region action buttons)
```

**Language dropdown**: `Select` component (existing). Options built from `PADDLE_OCR_LANGUAGE_GROUPS` — grouped by model (optgroups). First option = "Auto-detect (system default)". Reset button = small icon button next to Select, sets `targetLangOverride = null` / `nativeLangOverride = null`.

**Reset button visibility**: Only visible when `override !== null` (i.e. user has changed from default). Hidden when at system default.

**Split ratio slider**: same pattern as the existing Scan height/width rows (`styles.rowStack` header + `Slider`). Label "Split ratio". Min 10, max 90, value = `splitRatio * 100`. onChange → update `OcrOriginState.splitRatio` → sync `RegionSelector` divider position.

**Sync direction**:
- Slider change → `regionSelector.updateSplitRatio(ratio)` → divider moves
- Divider drag → `onSplitRatioChange(ratio)` callback → slider updates; storage commit on mouseup

## File Changes

| File | Change |
|------|--------|
| `src/features/ocr/persistence/ocrStateTypes.ts` | Add `splitEnabled`, `splitRatio`, `splitTopIsTarget`, `targetLangOverride`, `nativeLangOverride` to `OcrOriginState`. `OcrLanguageMode` → `'auto' \| PaddleLangAbbr` (derived from catalog) |
| `src/features/ocr/engine/paddleOcrLanguages.ts` | **NEW** — `PADDLE_OCR_LANGUAGE_GROUPS` catalog (106 langs, 12 models) + `PaddleLangAbbr` derived type + `ISO_TO_PADDLE` map + `resolveOcrLang()` |
| `src/features/ocr/engine/paddleOcrEngine.ts` | Remove hardcoded `textRecognitionModelAsset` for non-default models; let `paddleocr-js` resolve model URL (CDN → IndexedDB per ADR-082) |
| `src/features/ocr/engine/types.ts` | `OcrLanguageMode` → derived union; OCR_INIT/RECOGNIZE/DISPOSE payloads gain `engineKey` |
| `src/features/ocr/overlay/regionSelector.ts` | Split halves rendering, draggable divider in view mode, `updateSplitRatio()` + `onSplitRatioChange` callback (ADR-081 node-reuse contract applies) |
| `src/features/ocr/pipeline/splitRegion.ts` | **NEW** — `computeSplitHalves()` pure function |
| `src/features/ocr/pipeline/ocrToCues.ts` | **NEW** — `ocrTextToCues()` pure function + `OcrDetection` type + CUE_TAIL_MS/CUE_MERGE_GAP_MS constants |
| `src/features/ocr/pipeline/ocrPipeline.ts` | `runPipelineStep` accepts explicit crop region (for split halves); per-stream `OcrPipelineState` instances documented |
| `src/entrypoints/offscreen/ocrRunner.ts` | Singleton `engine` → `Map<engineKey, OcrEngine>` with LRU cap (2, or 1 when low-RAM); route by `engineKey`; share instance when both streams use the same model |
| `src/entrypoints/background/handlers/ocr.ts` | Forward `engineKey` in payload as-is (no new logic) |
| `src/entrypoints/content/ocrController.ts` | One engine proxy per `engineKey`; `recognize(image, minScore, engineKey)` |
| `src/entrypoints/content/ocrContentScript.ts` | Dual-stream in `processFrame()` (2 pipeline states, shared lock/time gate), virtual track injection, `resolveOcrLang()` per stream, low-RAM gate |
| `src/features/subtitle/ui/subtitlePanelModel.ts` | Add `'ocr'` to `source` union |
| `src/features/subtitle/ui/contentScriptController.ts` | `ocrTargetSlot` + `ocrNativeSlot`, extend `mergedPanelItems()`, auto-switch + revert to remembered source |
| `src/features/ocr/ui/OcrSettingsPanel.tsx` | Replace 4-option language dropdown with 106-lang grouped dropdown ×2 (target + native) with conditional Reset buttons. Add split section: toggle, top/bottom radio, split ratio slider, low-RAM hint, model download progress |
| `src/shared/icons/index.ts` | Add split icon (reset đã có `rotateCcw` — không cần thêm) |

## Testing Strategy

### Unit tests (Jest)

- `splitRegion.test.ts`: `computeSplitHalves()` — edge cases (ratio 0.1, 0.5, 0.9, parent at non-zero offset)
- `ocrToCues.test.ts`: `ocrTextToCues()` — dedup consecutive, empty text, seek clear, single detection, **flicker merge** (A → miss → A within CUE_MERGE_GAP_MS → 1 cue, không overlap)
- `paddleOcrLanguages.test.ts`: `resolveOcrLang()` — override wins, null → system default, BCP-47 normalize ('pt-BR' → 'pt'), unknown ISO → 'auto'. `ISO_TO_PADDLE` covers every abbr in `PADDLE_OCR_LANGUAGE_GROUPS` (compile-time type + runtime assert). Catalog có đúng 12 groups
- `regionSelector.test.ts`: split halves render, divider drag updates ratio (UI real-time, persist on mouseup), render update (no node recreation — same contract as handles test)
- `ocrRunner` (engine map): same-model streams share 1 instance; LRU evicts least-recently-used beyond cap; low-RAM cap = 1

### Browser tests (stealth-chrome-devtools MCP)

1. Toggle split trong Settings Panel → verify 2 regions + divider trên video (view mode)
2. Drag divider → verify ratio syncs to settings slider + persist sau mouseup (reload → ratio giữ nguyên)
3. OCR split ON → verify 2 virtual tracks `OCR Target (live)` + `OCR Native (live)` trong Manager Panel
4. Auto-switch → verify OCR tracks replace previous subtitle; toggle off → revert previous source
5. Toggle split OFF → verify merge + virtual tracks removed
6. Swap top/bottom → verify language hint swap
7. Language dropdown → verify 106 langs grouped by model
8. Change target lang (khác model) → verify model download progress rồi OCR re-init
9. Reset button → verify lang reverts to system default, reset ẩn khi at default
10. First-enable split với default bottom region → verify region tự nâng lên bottom 40%

## Success Criteria

- [ ] Split toggle trong Settings Panel → region chia đôi top/bottom (divider xem được + kéo được ở view mode)
- [ ] Draggable divider → thay đổi tỷ lệ top/bottom, persist on mouseup, survive reload
- [ ] Settings slider sync 2 chiều với divider
- [ ] First-enable với default bottom region → tự nâng lên bottom 40%
- [ ] Top/bottom swap setting hoạt động
- [ ] Dual-stream OCR: top = target lang, bottom = native lang, dedup độc lập per stream
- [ ] 2 virtual tracks `OCR Target (live)` + `OCR Native (live)` trong Manager Panel
- [ ] Auto-switch sang OCR tracks khi split ON; revert source cũ khi OFF
- [ ] Cue timing theo video.currentTime, dedup consecutive + flicker merge (no overlap)
- [ ] Toggle split OFF → merge + remove virtual tracks
- [ ] Language dropdown hiển thị 106 ngôn ngữ, grouped by model (12 groups)
- [ ] Default language = system target/native từ subtitle settings (BCP-47 normalize)
- [ ] Reset button → revert về system default, hidden khi at default
- [ ] Cùng model 2 stream → share 1 engine instance
- [ ] deviceMemory < 4GB → single-engine mode (target model cho cả 2 stream) + hint
- [ ] Model mới (non-default) lazy-load từ CDN → IndexedDB, có progress UI, không stall im lặng
- [ ] `npm run build` pass
- [ ] `npm run typecheck` pass
- [ ] `npm run test:unit` pass

## Open Questions

1. **Engine re-init on language change** — RESOLVED: re-init on Apply (same as region changes). Tránh download model không cần thiết khi user đang thử các lang.
2. **OCR without split** — RESOLVED: split OFF = existing behavior (hitboxes only, no virtual track). Split ON = dual-stream + virtual tracks.
3. **Performance WASM** — RESOLVED: 2 calls sequential dưới processing lock hiện có; frame bị skip tự nhiên khi lock hold (~2fps effective trên WASM). Hint "2× OCR work" khi backend=wasm.
4. **Dual-engine** — RESOLVED: engines keyed by MODEL trong offscreen (`Map<engineKey, engine>`, LRU cap 2 / 1 low-RAM). Streams cùng model share instance (target=auto + native=zh → 1 engine). deviceMemory < 4GB → single-engine dùng target model cho cả 2 stream.
5. **CDN domain + host_permissions** — OPEN (blocker cho ADR-082 implementation): cần xác định đúng CDN endpoint paddleocr-js dùng cho rec models (tham chiếu `paddleocr-js` source), thêm vào `host_permissions` + test offline behavior (model đã cache trong IndexedDB phải chạy không mạng). CWS: weights (.onnx/.tar) là data — được phép; KHÔNG tải WASM/JS runtime từ CDN (phải bundle như hiện tại).

## Revision notes (2026-08-22 review)

- Fixed: 13 → 12 recognition models (verified against PaddleOCR docs; `japan`/`chinese_cht` dùng chung default model, không phải model riêng; `ku`/`ru`/`be`/`uk` xuất hiện ở 2 model lists — mỗi abbr liệt kê 1 lần, eslav ưu tiên cho ru/be/uk).
- Fixed: `OcrLanguageMode = 'auto' | string` → derived union từ catalog (type-safety).
- Added: messaging layer cho dual-engine (`ocrRunner.ts` engine map + `engineKey` routing + background/ocrController) — thiếu trong bản gốc.
- Added: model distribution decision (default model bundled, 11 multilingual CDN→IndexedDB, ADR-082) — bản gốc self-contradictory ("bundle... lazy-load from CDN, same pattern hiện tại" trong khi rec model hiện đang bundled).
- Added: low-RAM gate (`navigator.deviceMemory`), same-model engine sharing, per-stream pipeline state với shared lock/time gate, DRM any-stream.
- Fixed: Split toggle chuyển từ video toolbar (chỉ tồn tại select/edit mode) sang Settings Panel + divider kéo được ở view mode.
- Added: first-enable behavior với default bottom region (auto nâng lên 40%).
- Fixed: cue flicker overlap (CUE_MERGE_GAP_MS), track names cố định (bỏ `document.title` — SPA đổi title theo tập; bỏ `.srt` suffix), panel tree khớp UI thật (Scan height/width, Select Region/Edit/Reset), BCP-47 normalize, divider persist on mouseup, model download progress UX, benchmark numbers đánh dấu cần đo lại, time gate 333ms khớp `DEFAULT_PIPELINE_CONFIG`.
