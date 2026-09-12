# Implementation Plan: OCR Split Dual-Stream + Multilingual

> Spec: `docs/specs/ocr-split-dual-stream.md` (reviewed 2026-08-22)
> ADR-081 (region overlay node-reuse), ADR-082 (model distribution + dual-engine routing)
> Mỗi task: AC + TTD (test trước) + code mẫu. Subagent LÀM THEO ĐÚNG code mẫu — không tự phát minh.
> Quy ước chung: named export, no `any`, no default export, pure functions tách riêng, `npm run typecheck` + scoped jest sau mỗi task.

## Tổng quan kiến trúc (subagent phải đọc trước)

```
OcrSettingsPanel (T8) ──storage──▶ ocrStateTypes.splitEnabled/... (T1)
                                          │
OcrSession.processFrame (T7) ──▶ computeSplitHalves (T2)
      │                               │
      ├─▶ runPipelineStep(region) (T3) ×2 streams (state per-stream)
      ├─▶ ocrTextToCues (T2) ──▶ virtual slots trong contentScriptController (T7)
      └─▶ OcrController.recognize(engineKey) (T5) ──▶ background ──▶ ocrRunner Map<model,engine> (T5 + T4)
RegionSelector (T6): divider kéo ở view-mode, ADR-081 node-reuse
```

Dependency: T1, T2 (foundation, song song) → T3, T4, T5, T6, T8 (song song, file rời nhau) → T7 (tích hợp) → verify.

## Checkpoints

- Sau đợt 1 (T1+T2): `npx jest paddleOcrLanguages splitRegion ocrToCues --selectProjects unit` pass.
- Sau đợt 2 (T3-T6, T8): `npm run typecheck` pass + scoped jest pass.
- Sau T7: `npm run typecheck && npm run test:unit && npm run build` pass toàn bộ.
- Verify agent cuối: checklist AC từng task + spec Success Criteria (trừ browser tests — main agent chạy).

---

## Task 1: Language catalog + state fields (foundation)

**Mục tiêu:** SSOT catalog 108 langs / 12 models + derive type + state fields + resolveOcrLang.

**Files:**
- NEW `src/features/ocr/engine/paddleOcrLanguages.ts`
- EDIT `src/features/ocr/persistence/ocrStateTypes.ts`
- EDIT `src/features/ocr/engine/types.ts`
- NEW `src/features/ocr/engine/paddleOcrLanguages.test.ts`

**TTD — viết test TRƯỚC, chạy fail, rồi implement:**

```typescript
// src/features/ocr/engine/paddleOcrLanguages.test.ts
import { describe, expect, it } from '@jest/globals';
import { PADDLE_OCR_LANGUAGE_GROUPS, ISO_TO_PADDLE, resolveOcrLang, ENGINE_KEY_FOR_LANG } from './paddleOcrLanguages';

describe('PADDLE_OCR_LANGUAGE_GROUPS', () => {
  it('has 12 model groups', () => {
    expect(PADDLE_OCR_LANGUAGE_GROUPS).toHaveLength(12);
  });
  it('covers 108 languages, each abbr exactly once', () => {
    const abbrs = PADDLE_OCR_LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => l.abbr));
    expect(new Set(abbrs).size).toBe(abbrs.length); // no duplicates
    expect(abbrs.length).toBe(108);
  });
});

describe('resolveOcrLang', () => {
  it('override wins', () => expect(resolveOcrLang('vi', 'en')).toBe('vi'));
  it('null → system default (ISO 639-1)', () => expect(resolveOcrLang(null, 'vi')).toBe('vi'));
  it('BCP-47 normalized (pt-BR → pt)', () => expect(resolveOcrLang(null, 'pt-BR')).toBe('pt'));
  it('zh → ch (default model abbr)', () => expect(resolveOcrLang(null, 'zh')).toBe('ch'));
  it('ja → japan', () => expect(resolveOcrLang(null, 'ja')).toBe('japan'));
  it('unknown ISO → auto', () => expect(resolveOcrLang(null, 'xx')).toBe('auto'));
});

describe('ENGINE_KEY_FOR_LANG', () => {
  it('maps abbr → model name', () => {
    expect(ENGINE_KEY_FOR_LANG('vi')).toBe('latin');
    expect(ENGINE_KEY_FOR_LANG('ch')).toBe('ch');
    expect(ENGINE_KEY_FOR_LANG('japan')).toBe('ch'); // japan/chinese_cht dùng chung default model
    expect(ENGINE_KEY_FOR_LANG('ko')).toBe('korean'); // NOTE: catalog abbr là 'korean' — ISO ko→'korean'
  });
  it('every catalog abbr has a model', () => {
    for (const g of PADDLE_OCR_LANGUAGE_GROUPS) {
      for (const l of g.languages) expect(ENGINE_KEY_FOR_LANG(l.abbr)).toBe(g.model);
    }
  });
});

describe('ISO_TO_PADDLE coverage', () => {
  it('every value is a valid catalog abbr or auto', () => {
    const abbrs = new Set(PADDLE_OCR_LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => l.abbr)));
    for (const v of Object.values(ISO_TO_PADDLE)) expect(abbrs.has(v)).toBe(true);
  });
});
```

**Code mẫu — `paddleOcrLanguages.ts` (copy danh sách 106 langs NGUYÊN VẸN từ spec `docs/specs/ocr-split-dual-stream.md` mục "PaddleOCR language catalog" — 12 groups: ch, en, korean, latin, eslav, cyrillic, th, el, arabic, devanagari, ta, te):**

```typescript
// paddleOcrLanguages — SSOT cho PP-OCRv5 multilingual (spec ocr-split-dual-stream, ADR-082).
// 12 recognition models (default 'ch' + 11 multilingual), 106 languages.
// Verified 2026-08-22 against PaddleOCR docs: japan/chinese_cht map về default model.

export interface PaddleOcrLangEntry { readonly abbr: string; readonly label: string; }
export interface PaddleOcrModelGroup {
  readonly model: string;
  readonly languages: readonly PaddleOcrLangEntry[];
}

export const PADDLE_OCR_LANGUAGE_GROUPS: readonly PaddleOcrModelGroup[] = [
  // ... EXACTLY như spec — copy nguyên vẹn, KHÔNG thêm bớt ...
];

/** Derive từ catalog — typo fail compile (spec: không dùng `'auto' | string`). */
export type PaddleLangAbbr = (typeof PADDLE_OCR_LANGUAGE_GROUPS)[number]['languages'][number]['abbr'];
export type ResolvedOcrLang = 'auto' | PaddleLangAbbr;

/** abbr → model name (engineKey). */
export const ENGINE_KEY_FOR_LANG: Readonly<Record<string, string>> = Object.fromEntries(
  PADDLE_OCR_LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => [l.abbr, g.model] as const)),
);

/** ISO 639-1 → PaddleOCR abbr. Chỉ chứa ISO codes có trong catalog; phần còn lại → 'auto'. */
export const ISO_TO_PADDLE: Readonly<Record<string, string>> = {
  zh: 'ch', en: 'en', ja: 'japan', ko: 'korean',
  vi: 'vi', fr: 'fr', de: 'de', es: 'es', it: 'it', pt: 'pt',
  ru: 'ru', th: 'th', ar: 'ar', hi: 'hi', tr: 'tr', nl: 'nl',
  pl: 'pl', sv: 'sv', da: 'da', fi: 'fi', cs: 'cs', sk: 'sk',
  hu: 'hu', ro: 'ro', bg: 'bg', uk: 'uk', el: 'el', ms: 'ms',
  id: 'id', no: 'no', is: 'is', lt: 'lt', lv: 'lv', et: 'et',
  ga: 'ga', cy: 'cy', mt: 'mt', hr: 'hr', sl: 'sl', sq: 'sq',
  // Đầy đủ mọi ISO 639-1 code ứng với abbr trong catalog — duyệt catalog để补 đủ:
  // latin: af→af, bs→bs, sw→sw, tl→tl, uz→uz, la→la, az→az, ku→ku, pi→pi,
  //        eu→eu, gl→gl, rm→rm, ca→ca, qu→qu, oc→oc, mi→mi,
  // cyrillic/eslav: be→be, mk→mk, kk→kk, ky→ky, tg→tg, tt→tt, mn→mn,
  // arabic: fa→fa, ug→ug, ur→ur, ps→ps, sd→sd,
  // devanagari: mr→mr, ne→ne, sa→sa,
};

/** Resolve effective OCR language: override → system default (BCP-47 normalized) → 'auto'. */
export function resolveOcrLang(override: string | null, systemLang: string): ResolvedOcrLang {
  if (override) return override as ResolvedOcrLang;
  const iso = systemLang.trim().toLowerCase().split('-')[0] ?? '';
  return (ISO_TO_PADDLE[iso] ?? 'auto') as ResolvedOcrLang;
}
```

**Code mẫu — `ocrStateTypes.ts` (thêm vào `OcrOriginState` + defaults — GIỮ nguyên mọi field hiện có):**

```typescript
  // === Split dual-stream (spec ocr-split-dual-stream) ===
  /** Split enabled — chia đôi region thành top + bottom. Default false. */
  readonly splitEnabled: boolean;
  /** Split ratio — tỷ lệ top/total (0.1-0.9). Default 0.5. */
  readonly splitRatio: number;
  /** Top = target language? Default true. */
  readonly splitTopIsTarget: boolean;
  /** Target language override (PaddleOCR abbr). null = system default. */
  readonly targetLangOverride: string | null;
  /** Native language override. null = system default. */
  readonly nativeLangOverride: string | null;
```
Trong `DEFAULT_OCR_ORIGIN_STATE` thêm: `splitEnabled: false, splitRatio: 0.5, splitTopIsTarget: true, targetLangOverride: null, nativeLangOverride: null,`

**Code mẫu — `engine/types.ts`:** `OcrLanguageMode` đổi thành:
```typescript
import type { PaddleLangAbbr } from './paddleOcrLanguages';
export type OcrLanguageMode = 'auto' | PaddleLangAbbr;
```
(Lưu ý: `OcrConfig.languageMode` vẫn dùng type này — không đổi gì khác trong file. Nếu import vòng: `paddleOcrLanguages.ts` KHÔNG import từ `types.ts` — an toàn.)

**AC:**
- [ ] `npx jest paddleOcrLanguages --selectProjects unit` pass (12 groups, 106 langs, no dup, resolve/BCP-47/engineKey/coverage)
- [ ] `npm run typecheck` pass
- [ ] Đặt `const bad: OcrLanguageMode = 'typo-lang'` tạm trong test → compile FAIL → xóa (chứng minh derive type hoạt động)

**Dependencies:** None.
**Forbidden:** Không đụng file nào ngoài 4 file trên.

---

## Task 2: Pure helpers — computeSplitHalves + ocrTextToCues

**Files:**
- NEW `src/features/ocr/pipeline/splitRegion.ts`
- NEW `src/features/ocr/pipeline/ocrToCues.ts`
- NEW `src/features/ocr/pipeline/splitRegion.test.ts`
- NEW `src/features/ocr/pipeline/ocrToCues.test.ts`

**TTD — test trước (copy nguyên):**

```typescript
// splitRegion.test.ts
import { describe, expect, it } from '@jest/globals';
import { computeSplitHalves, SPLIT_DEFAULT_REGION_PCT } from './splitRegion';

describe('computeSplitHalves', () => {
  const parent = { xPct: 10, yPct: 40, widthPct: 60, heightPct: 30 };
  it('50/50 splits evenly', () => {
    const { top, bottom } = computeSplitHalves(parent, 0.5);
    expect(top).toEqual({ xPct: 10, yPct: 40, widthPct: 60, heightPct: 15 });
    expect(bottom).toEqual({ xPct: 10, yPct: 55, widthPct: 60, heightPct: 15 });
  });
  it('ratio 0.1 → top 10% / bottom 90% of parent height', () => {
    const { top, bottom } = computeSplitHalves(parent, 0.1);
    expect(top.heightPct).toBeCloseTo(3);
    expect(bottom.heightPct).toBeCloseTo(27);
    expect(bottom.yPct).toBeCloseTo(43);
  });
  it('ratio 0.9 mirrors', () => {
    const { top, bottom } = computeSplitHalves(parent, 0.9);
    expect(top.heightPct).toBeCloseTo(27);
    expect(bottom.heightPct).toBeCloseTo(3);
  });
  it('constant exists = 40', () => expect(SPLIT_DEFAULT_REGION_PCT).toBe(40));
});
```

```typescript
// ocrToCues.test.ts
import { describe, expect, it } from '@jest/globals';
import { ocrTextToCues, CUE_TAIL_MS, CUE_MERGE_GAP_MS } from './ocrToCues';

describe('ocrTextToCues', () => {
  it('groups consecutive identical text into one cue', () => {
    const cues = ocrTextToCues([
      { text: 'hello', timeMs: 1000 }, { text: 'hello', timeMs: 1330 }, { text: 'hello', timeMs: 1660 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, end: 1660 + CUE_TAIL_MS, text: 'hello', index: 0 });
  });
  it('text change closes cue and opens new one', () => {
    const cues = ocrTextToCues([
      { text: 'a', timeMs: 1000 }, { text: 'b', timeMs: 2000 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.end).toBe(1000 + CUE_TAIL_MS);
    expect(cues[1]!.start).toBe(2000);
  });
  it('flicker A → miss → A within merge gap extends the SAME cue (no overlap)', () => {
    const cues = ocrTextToCues([
      { text: 'a', timeMs: 1000 }, { text: 'a', timeMs: 1330 },
      { text: 'b', timeMs: 1660 },
      { text: 'a', timeMs: 1900 }, // gap từ cue 'a' end (1330+500=1830) đến 1900 = 70ms < 700 merge gap
      { text: 'a', timeMs: 2200 },
    ]);
    // 'a' (1000-1830) + 'b' (1660? không — b bắt đầu 1660, a-end 1830 > b start → b nằm TRONG merge gap của a?
    // Theo spec: chỉ MERGE khi CÙNG text với cue vừa đóng. 'a' mới (1900) cùng text 'a' và 1900 - 1830 <= MERGE_GAP → extend cue 'a' cũ.
    // 'b' là cue riêng. Kết quả: 2 cues, cue[0].end = 2200+500, cue[0].start = 1000.
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ text: 'a', start: 1000 });
    expect(cues[0]!.end).toBe(2200 + CUE_TAIL_MS);
    expect(cues[1]).toMatchObject({ text: 'b', start: 1660 });
  });
  it('same text beyond merge gap opens a NEW cue', () => {
    const t1 = 1000, t2 = t1 + CUE_TAIL_MS + CUE_MERGE_GAP_MS + 100;
    const cues = ocrTextToCues([{ text: 'a', timeMs: t1 }, { text: 'a', timeMs: t2 }]);
    expect(cues).toHaveLength(2);
  });
  it('empty detections → empty cues; single detection → single cue', () => {
    expect(ocrTextToCues([])).toEqual([]);
    expect(ocrTextToCues([{ text: 'x', timeMs: 5 }])).toHaveLength(1);
  });
});
```

**Code mẫu — `splitRegion.ts`:**

```typescript
// splitRegion — chia parent region thành 2 nửa top/bottom (spec ocr-split-dual-stream).
import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';

export interface SplitHalf {
  readonly xPct: number;
  readonly yPct: number;
  readonly widthPct: number;
  readonly heightPct: number;
}

/** First-enable: default bottom 15% chia đôi = 7.5%/stream quá thấp → bump lên 40% (spec user story 9). */
export const SPLIT_DEFAULT_REGION_PCT = 40;

export function computeSplitHalves(
  parent: CustomRegion,
  ratio: number,
): { top: SplitHalf; bottom: SplitHalf } {
  const r = Math.max(0.1, Math.min(0.9, ratio));
  const splitY = parent.yPct + parent.heightPct * r;
  return {
    top: { xPct: parent.xPct, yPct: parent.yPct, widthPct: parent.widthPct, heightPct: parent.heightPct * r },
    bottom: { xPct: parent.xPct, yPct: splitY, widthPct: parent.widthPct, heightPct: parent.heightPct * (1 - r) },
  };
}
```

**Code mẫu — `ocrToCues.ts`:**

```typescript
// ocrToCues — OCR detection stream → SrtCue[] (spec ocr-split-dual-stream).
// O(n) single pass. Flicker merge: same text quay lại trong CUE_MERGE_GAP_MS → extend cue cũ.
import type { SrtCue } from '@/entities/media/types';

export interface OcrDetection {
  readonly text: string;
  readonly timeMs: number;
}

export const CUE_TAIL_MS = 500;
export const CUE_MERGE_GAP_MS = 700;

export function ocrTextToCues(detections: readonly OcrDetection[]): SrtCue[] {
  const cues: SrtCue[] = [];
  let open: { text: string; start: number; lastTime: number } | null = null;
  const close = (): void => {
    if (!open) return;
    cues.push({ index: cues.length, start: open.start, end: open.lastTime + CUE_TAIL_MS, text: open.text });
    open = null;
  };
  for (const d of detections) {
    if (!d.text) { close(); continue; }
    if (open && open.text === d.text) {
      open.lastTime = d.timeMs; // extend
      continue;
    }
    // Text đổi → thử merge với cue VỪA đóng nếu cùng text + trong merge gap (chống flicker overlap)
    const last = cues.at(-1);
    if (!open && last && last.text === d.text && d.timeMs - last.end <= CUE_MERGE_GAP_MS) {
      cues[cues.length - 1] = { ...last, end: d.timeMs + CUE_TAIL_MS };
      open = { text: d.text, start: last.start, lastTime: d.timeMs };
      continue;
    }
    close();
    open = { text: d.text, start: d.timeMs, lastTime: d.timeMs };
  }
  close();
  return cues;
}
```
LƯU Ý merge branch: khi merge, `open.start = last.start` (cue mở lại từ start cũ), cue trong mảng sẽ bị replace ở lần close kế tiếp — kiểm tra lại logic với test flicker: sau merge, close() tiếp theo push cue MỚI trùng — SAI. Sửa: khi merge,POP cue cũ khỏi mảng rồi mở lại `open` (mảng chỉ nhận cue khi close cuối). Code đúng:
```typescript
    if (!open && last && last.text === d.text && d.timeMs - last.end <= CUE_MERGE_GAP_MS) {
      cues.pop();
      open = { text: d.text, start: last.start, lastTime: d.timeMs };
      continue;
    }
```

**AC:**
- [ ] `npx jest splitRegion ocrToCues --selectProjects unit` pass
- [ ] `npm run typecheck` pass
- [ ] Flicker test: đúng 2 cues, không overlap

**Dependencies:** None. **Forbidden:** không đụng file khác.

---

## Task 3: runPipelineStep nhận explicit region

**Files:** EDIT `src/features/ocr/pipeline/ocrPipeline.ts` (+ extend test hiện có `ocrPipeline.test.ts`).

**Yêu cầu:** `runPipelineStep(image, recognizeFn, state, config, frameTimeMs?, explicitRegion?: SplitHalf | null)`. Khi `explicitRegion` truyền vào → DÙNG region đó (convert %→px theo width/height frame) thay vì `computeSubtitleRegion(...)` nội bộ. KHÔNG đổi behavior khi không truyền (single-stream cũ y nguyên).

**Code mẫu (vùng thay thế quanh dòng `const region = computeSubtitleRegion(...)` hiện tại — dòng ~226):**

```typescript
// Trước: const region = computeSubtitleRegion(image.width, image.height, config.subtitleRegionPct, config.subtitleRegionWidthPct, config.customRegion);
// Sau:
const region = explicitRegion
  ? {
      x: Math.round((explicitRegion.xPct / 100) * image.width),
      y: Math.round((explicitRegion.yPct / 100) * image.height),
      width: Math.round((explicitRegion.widthPct / 100) * image.width),
      height: Math.round((explicitRegion.heightPct / 100) * image.height),
    }
  : computeSubtitleRegion(image.width, image.height, config.subtitleRegionPct, config.subtitleRegionWidthPct, config.customRegion);
```
(Kiểm tra kiểu trả về của `computeSubtitleRegion` trong `cropRegion.ts` — region px — và cropImage nhận cùng shape. `SplitHalf` import từ `./splitRegion` — task 2 đã có.)

**Test thêm vào `ocrPipeline.test.ts`** (mô phỏng recognizeFn như các test hiện có trong file):
```typescript
it('uses explicit region when provided (split halves)', async () => {
  // frame trắng 100x100, explicit region top half; spy recognizeFn nhận cropped height = 50
  const recognizeFn = jest.fn().mockResolvedValue({ results: [] });
  await runPipelineStep(frame100x100, recognizeFn, new OcrPipelineState(), config, undefined,
    { xPct: 0, yPct: 0, widthPct: 100, heightPct: 50 });
  expect(recognizeFn).toHaveBeenCalledWith(expect.objectContaining({ height: 50 }), expect.anything());
});
```

**AC:**
- [ ] `npx jest ocrPipeline --selectProjects unit` pass (gồm test mới)
- [ ] Không truyền explicitRegion → mọi test hiện có pass nguyên (no regression)

**Dependencies:** T2 (SplitHalf type). **Forbidden:** không sửa signature khác.

---

## Task 4: paddleOcrEngine — model resolution cho non-default models

**Files:** EDIT `src/features/ocr/engine/paddleOcrEngine.ts`.

**Yêu cầu (spec + ADR-082):** hiện tại `initialize` hardcode `textRecognitionModelAsset: { url: modelBase + 'PP-OCRv5_mobile_rec_onnx_infer.tar' }` (dòng ~140) cho MỌI lang. Sửa: chỉ giữ asset override khi `langToModel(lang) === 'ch'` (default model — bundled); model khác → KHÔNG truyền `textRecognitionModelAsset`, để paddleocr-js tự resolve URL CDN theo `lang` (lazy-load → IndexedDB cache nội bộ của package).

**Code mẫu:**
```typescript
import { ENGINE_KEY_FOR_LANG } from './paddleOcrLanguages';
// ... trong initialize, chỗ build PaddleOCR config:
const engineKey = ENGINE_KEY_FOR_LANG(config.languageMode === 'auto' ? 'ch' : config.languageMode); // FUNCTION call — accepts abbr hoặc ISO, fallback 'ch'
const isDefaultModel = engineKey === 'ch';
// ...trong options object:
...(isDefaultModel ? { textRecognitionModelAsset: { url: modelBase + 'PP-OCRv5_mobile_rec_onnx_infer.tar' } } : {}),
// Non-default: paddleocr-js tự chọn model theo lang param (CDN → IndexedDB, ADR-082).
```
GIỮ nguyên mọi config khác (wasmPaths, backend, ocrVersion...). Đọc file trước khi sửa — tuân theo cấu trúc thật, chỉ thay logic asset.

**AC:**
- [ ] `npm run typecheck` pass
- [ ] `npx jest paddleOcrEngine --selectProjects unit` pass (test hiện có không regression)
- [ ] grep: với lang 'auto'/'ch'/'japan'/'chinese_cht' → vẫn dùng bundled asset (chuẩn bị grep bằng mắt trong code)

**Dependencies:** T1 (ENGINE_KEY_FOR_LANG). **Forbidden:** không đổi WASM paths, không đổi backend logic.

---

## Task 5: Messaging — engineKey routing (Map thay singleton)

**Files:**
- EDIT `src/features/ocr/engine/types.ts` (payload types — thêm `engineKey` vào OcrInitPayload tương ứng nếu có; nếu payload type định nghĩa ở ocrRunner/ocrController thì sửa ở đó)
- EDIT `src/entrypoints/offscreen/ocrRunner.ts`
- EDIT `src/entrypoints/background/handlers/ocr.ts`
- EDIT `src/entrypoints/content/ocrController.ts`

**Thiết kế (ADR-082):**
- `engineKey` = model name (`'ch' | 'en' | 'korean' | 'latin' | ...`). Default khi thiếu: `'ch'` (backward compatible — message cũ không có engineKey vẫn chạy).
- ocrRunner: `Map<string, { engine: OcrEngine; backend: OcrBackend }>` + LRU order array. `MAX_RESIDENT = navigator.deviceMemory >= 4 ? 2 : 1`. Init engine theo key (mỗi key một PaddleOcrEngine với languageMode tương ứng model). Recognize route theo key. Dispose: có engineKey → dispose 1; không có → dispose tất cả (giữ behavior cũ).
- Background handler: forward payload nguyên văn (đã làm vậy — chỉ cần chắc chắn không strip field).
- OcrController: `init(languageMode, backend, engineKey?)`; `recognize(image, minScore?, engineKey?)`; nội bộ lưu `initializedKeys: Set<string>`. 保持 các debug dataset hiện có.

**Code mẫu — ocrRunner core (thay singleton; giữ `defaultWasmPaths`, message listener switch, error handling):**

```typescript
interface EngineEntry { engine: OcrEngine; backend: OcrBackend; lastUsed: number; }
const engines = new Map<string, EngineEntry>();
const MAX_RESIDENT = (typeof navigator !== 'undefined' && (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) >= 4 ? 2 : 1;
let lruClock = 0;

function evictIfNeeded(): void {
  while (engines.size > MAX_RESIDENT) {
    let oldestKey: string | null = null; let oldest = Infinity;
    for (const [k, e] of engines) if (e.lastUsed < oldest) { oldest = e.lastUsed; oldestKey = k; }
    if (!oldestKey) break;
    const victim = engines.get(oldestKey);
    engines.delete(oldestKey);
    void victim?.engine.dispose().catch(() => {});
  }
}

async function getOrInitEngine(engineKey: string, languageMode: OcrLanguageMode): Promise<EngineEntry> {
  const entry = engines.get(engineKey);
  if (entry) { entry.lastUsed = ++lruClock; return entry; }
  evictIfNeeded();
  const engine = new PaddleOcrEngine();
  const effectiveBackend: OcrBackend = 'wasm'; // giữ nguyên: WebGPU hangs trong offscreen
  await engine.initialize({ languageMode, backend: effectiveBackend, wasmPaths: defaultWasmPaths() });
  const fresh = { engine, backend: effectiveBackend, lastUsed: ++lruClock };
  engines.set(engineKey, fresh);
  return fresh;
}
// handleOcrInit(payload): engineKey = payload.engineKey ?? 'ch' → getOrInitEngine → { status:'ready', backend }
// handleOcrRecognize: engineKey route; nếu engine chưa có → tự init với languageMode payload.languageMode ?? engineKey
// handleOcrDispose: payload.engineKey ? dispose 1 + delete : dispose all + clear
```

**OcrController:** thêm param `engineKey` vào `init`/`recognize` — đưa vào payload message. `dispose(engineKey?)` tương ứng. Track `initializedKeys` set thay vì 1 flag (giữ `isInitialized()` = set non-empty cho tương thích single-stream).

**AC:**
- [ ] `npm run typecheck` pass
- [ ] `npx jest ocrController ocrRunner --selectProjects unit` pass (nếu có test hiện có — không regression)
- [ ] Message KHÔNG có engineKey → vẫn init/recognize trên engine 'ch' (backward compat, đọc code xác nhận)
- [ ] LRU: engines.size không vượt MAX_RESIDENT (viết unit test nhỏ nếu ocrRunner testable; nếu không — assert qua code review trong verify agent)

**Dependencies:** T1. **Forbidden:** không đổi offscreen document lifecycle (ffmpeg vẫn chạy).

---

## Task 6: RegionSelector — split halves + draggable divider (view mode)

**Files:**
- EDIT `src/features/ocr/overlay/regionSelector.ts`
- EDIT `src/features/ocr/overlay/regionSelector.test.ts`

**Yêu cầu (ADR-081 node-reuse — TUYỆT ĐỐI):**
1. `setSplit(enabled: boolean, ratio: number): void` — bật/tắt split; tạo 1 lần: `.cell-ocr-split-top`, `.cell-ocr-split-bottom` (tinted fill, pointer-events none), `.cell-ocr-split-divider` (draggable bar, pointer-events auto) — divider mousedown listener bind LÚC TẠO.
2. `updateSplitRatio(ratio): void` — cập nhật vị trí divider + halves (render update, KHÔNG tạo lại node).
3. Constructor callbacks thêm optional: `onSplitRatioChange?: (ratio: number) => void` — gọi khi drag divider kết thúc (mouseup) với ratio clamp 0.1-0.9. Real-time trong drag chỉ update UI.
4. Divider chỉ ở **view mode** (select/edit: ẩn divider — user đang chỉnh parent).
5. CSS thêm vào stylesheet inject sẵn (`#cell-ocr-region-style`): `.cell-ocr-split-divider` (height 14px, full width, cursor ns-resize, grip line giữa), halves fill `rgba(255,255,255,0.08)` + label nhỏ "Target"/"Native" góc trái mỗi half (theo `splitTopIsTarget` — set qua `setSplit(enabled, ratio, topLabel, bottomLabel)`).

**Code mẫu — phần chính (chèn vào class, theo pattern handles hiện tại):**

```typescript
// ─── Split (spec ocr-split-dual-stream) ───
private splitEnabled = false;
private splitRatio = 0.5;
private splitTop: HTMLDivElement | null = null;
private splitBottom: HTMLDivElement | null = null;
private divider: HTMLDivElement | null = null;
private splitDrag: { startY: number; startRatio: number } | null = null;

setSplit(enabled: boolean, ratio: number, topLabel = '', bottomLabel = ''): void {
  this.splitEnabled = enabled;
  this.splitRatio = ratio;
  if (!enabled) {
    this.splitTop?.remove(); this.splitBottom?.remove(); this.divider?.remove();
    this.splitTop = this.splitBottom = this.divider = null;
    this.render();
    return;
  }
  if (!this.splitTop && this.rect) {
    // Tạo 1 lần — bind divider mousedown tại đây (ADR-081)
    this.splitTop = document.createElement('div');
    this.splitTop.className = 'cell-ocr-split-half';
    this.splitBottom = document.createElement('div');
    this.splitBottom.className = 'cell-ocr-split-half';
    this.divider = document.createElement('div');
    this.divider.className = 'cell-ocr-split-divider';
    this.divider.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.splitDrag = { startY: e.clientY, startRatio: this.splitRatio };
      document.addEventListener('mousemove', this.onSplitDragMove);
      document.addEventListener('mouseup', this.onSplitDragEnd);
    });
    this.container?.append(this.splitTop, this.splitBottom, this.divider);
  }
  if (this.splitTop) this.splitTop.dataset.label = topLabel;
  if (this.splitBottom) this.splitBottom.dataset.label = bottomLabel;
  this.render();
}

updateSplitRatio(ratio: number): void {
  this.splitRatio = Math.max(0.1, Math.min(0.9, ratio));
  this.render();
}

private onSplitDragMove = (e: MouseEvent): void => {
  if (!this.splitDrag || !this.container) return;
  const parent = this.container.parentElement;
  if (!parent) return;
  const pr = parent.getBoundingClientRect();
  const dyPct = ((e.clientY - this.splitDrag.startY) / pr.height) * 100;
  const region = this.getRegion();
  const ratio = (this.splitDrag.startRatio * region.heightPct + dyPct) / region.heightPct;
  this.splitRatio = Math.max(0.1, Math.min(0.9, ratio));
  this.render(); // real-time UI only — persist on mouseup
};

private onSplitDragEnd = (): void => {
  this.splitDrag = null;
  document.removeEventListener('mousemove', this.onSplitDragMove);
  document.removeEventListener('mouseup', this.onSplitDragEnd);
  this.callbacks.onSplitRatioChange?.(this.splitRatio);
};
```
Trong `render()`: nếu `splitEnabled && mode === 'view'` → set style cho top/bottom/divider theo `computeSplitHalves(getRegion(), splitRatio)` (import từ `../pipeline/splitRegion`), chuyển % → style left/top/width/height; ẩn (display none) khi mode !== 'view' hoặc !splitEnabled. Trong `detach()`: clear split nodes (chúng là con container — bị remove theo container ✓; chỉ null references).

**CSS thêm vào stylesheet string:**
```css
.cell-ocr-split-half { position: absolute; background: rgba(255,255,255,0.08); pointer-events: none; }
.cell-ocr-split-half[data-label]::after { content: attr(data-label); position: absolute; left: 4px; top: 2px; font-size: 10px; color: rgba(255,255,255,0.85); font-family: ${FONT}; }
.cell-ocr-split-divider { position: absolute; left: 0; width: 100%; height: 14px; transform: translateY(-50%); cursor: ns-resize; pointer-events: auto; }
.cell-ocr-split-divider::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: rgba(255,255,255,0.9); border-radius: 1px; }
```

**Test thêm (regionSelector.test.ts):**
```typescript
it('split: setSplit renders halves + divider; divider drag updates ratio & fires onSplitRatioChange on mouseup', () => {
  const onSplitRatioChange = jest.fn();
  const sel2 = new RegionSelector({ onRegionChange(){}, onApply(){}, onCancel(){}, onSplitRatioChange });
  sel2.attach(video, REGION, 'view');
  sel2.setSplit(true, 0.5, 'Target', 'Native');
  expect(parent.querySelectorAll('.cell-ocr-split-half')).toHaveLength(2);
  expect(parent.querySelector('.cell-ocr-split-divider')).not.toBeNull();
  const divider = parent.querySelector('.cell-ocr-split-divider') as HTMLElement;
  fire(divider, 'mousedown', 500, 500);
  fire(document, 'mousemove', 500, 600); // +10% height
  fire(document, 'mouseup', 500, 600);
  expect(onSplitRatioChange).toHaveBeenCalledWith(expect.closeTo(0.6, 1)); // jest.closeTo custom hoặc 0.6 ± epsilon
  // node reuse:
  sel2.updateSplitRatio(0.3);
  expect(parent.querySelector('.cell-ocr-split-divider')).toBe(divider);
  sel2.detach();
});
```
(`expect.closeTo` không tồn tại — dùng `expect(onSplitRatioChange.mock.calls[0][0]).toBeGreaterThan(0.55)` + `< 0.65`.)

**AC:**
- [ ] `npx jest regionSelector --selectProjects unit` pass (mọi test cũ + mới)
- [ ] Divider node identity giữ nguyên qua updateSplitRatio (no recreation — test asserts)
- [ ] Drag real-time không gọi callback; chỉ mouseup gọi 1 lần
- [ ] `npm run typecheck` pass

**Dependencies:** T2 (computeSplitHalves). **Forbidden:** không đổi logic handles/toolbar hiện có.

---

## Task 8: OcrSettingsPanel — 106-lang dropdowns + split section

**Files:**
- EDIT `src/features/ocr/ui/OcrSettingsPanel.tsx`
- EDIT `src/features/ocr/ui/OcrSettingsPanel.test.tsx` (thêm test)

**Yêu cầu:**
1. Thay Select language 4-option hiện tại bằng 2 Select: **Target language** + **Native language** — options từ `PADDLE_OCR_LANGUAGE_GROUPS` (flatten: `{ value: abbr, label }`, sắp alphabetical; option đầu `'auto'` = "Auto-detect (system default)"). Giá trị hiển thị = `resolveOcrLang(override, systemLang)`; system lang lấy từ props mới `systemTargetLang: string; systemNativeLang: string` (caller truyền từ settings — contentScriptController đã có settings; Panel mount qua SubtitleManagerPanel — nếu props chưa có, DEFAULT 'auto' và TODO note cho T7 wire).
2. Reset icon-button (Icon `rotateCcw`, size sm) cạnh MỖI Select — chỉ hiện khi `override !== null`. Click → set override null + save storage.
3. Split section (khi `enabled`): Toggle "Split" (bind `splitEnabled`), radio 2 option Top=Target/Top=Native (`splitTopIsTarget`), Slider "Split ratio" 10-90 (`splitRatio*100`). Mọi change → `setOcrPreference` + `saveOcrSettings` (pattern `handleRegionHeightChange` hiện có). KHÔNG cần wire divider (T7 làm).
4. Hint text nhỏ dưới split toggle: `"Low memory mode: both halves use the target model"` khi `navigator.deviceMemory < 4`.
5. Icon: Split toggle row dùng Icon `crop` (tạm — icon split riêng ở task icon; dùng `layers` nếu muốn). Đơn giản nhất: KHÔNG icon mới — dùng `crop` sẵn có.

**Test thêm:** panel render 2 Select với 'auto' default; chọn 'vi' → storage save với `targetLangOverride: 'vi'`; Reset hiện khi override set, click → null. Theo pattern test hiện có trong `OcrSettingsPanel.test.tsx` (đọc file trước).

**AC:**
- [ ] `npx jest OcrSettingsPanel --selectProjects unit` pass
- [ ] `npm run typecheck` pass
- [ ] Đếm options: flatten groups + 'auto' — assert trong test ≥ 100 options

**Dependencies:** T1. **Forbidden:** không đụng regionSelector/ocrContentScript.

---

## Task 7: OcrSession dual-stream + virtual tracks (tích hợp cuối)

**Files:**
- EDIT `src/entrypoints/content/ocrContentScript.ts` (chính)
- EDIT `src/features/subtitle/ui/subtitlePanelModel.ts` (source union + 'ocr')
- EDIT `src/features/subtitle/ui/contentScriptController.ts` (slots + mergedPanelItems + auto-switch/revert)

**Yêu cầu + code mẫu — OcrSession:**

```typescript
// Thêm fields:
private splitPipelineStates: { target: OcrPipelineState; native: OcrPipelineState } | null = null;
private detections: { target: OcrDetection[]; native: OcrDetection[] } = { target: [], native: [] };
private previousSources: { target: string | null; native: string | null } | null = null;

// start(): khi originState.splitEnabled → khởi tạo 2 pipeline states + resolve langs:
//   targetLang = resolveOcrLang(originState.targetLangOverride, systemTargetLang)
//   nativeLang = resolveOcrLang(originState.nativeLangOverride, systemNativeLang)
//   (system langs truyền vào qua start() param mới `systemLangs: { target: string; native: string }` — caller đọc settings)
//   engineKeys = unique([ENGINE_KEY_FOR_LANG[targetLang] ?? 'ch', ENGINE_KEY_FOR_LANG[nativeLang] ?? 'ch'])
//   await controller.init(targetLang, 'wasm', engineKeys[0]); nếu engineKeys[1] khác → await controller.init(nativeLang, 'wasm', engineKeys[1])
//   Low-RAM (deviceMemory < 4) hoặc engineKeys.length === 1 → CHỈ 1 engine, cả 2 stream dùng engineKeys[0].
//   Region: nếu originState.customRegion == null && splitEnabled → region = defaultBottomRegion(SPLIT_DEFAULT_REGION_PCT) (T2 const)
//     (ghi cả subtitleRegionPct mới vào state để slider khớp — optional, chỉ set region chọn).

// processFrame(frame) — nhánh split (thay cho single runPipelineStep khi splitEnabled):
if (this.config.splitEnabled && this.splitPipelineStates) {
  const halves = computeSplitHalves(region as CustomRegion, this.config.splitRatio);
  const topIsTarget = this.config.splitTopIsTarget;
  const r1 = await runPipelineStep(frame, fn, this.splitPipelineStates[topIsTarget ? 'target' : 'native'], this.config, undefined, halves.top);
  const r2 = await runPipelineStep(frame, fn, this.splitPipelineStates[topIsTarget ? 'native' : 'target'], this.config, undefined, halves.bottom);
  // collect text: r.status === 'ocr' → detections[target|native].push({ text: joinResults(r.results), timeMs: video.currentTime*1000 })
  //drm: bất kỳ r nào drm_detected → this.stop() (giữ behavior)
  // cập nhật slots (theo cadence ~500ms hoặc mỗi frame — mỗi frame OK, O(n) nhỏ):
  ocrBridge.updateOcrTracks(ocrTextToCues(this.detections.target), ocrTextToCues(this.detections.native));
  return;
}

// seeked handler hiện có: thêm this.detections = { target: [], native: [] } (clear).
```

**Bridge sang contentScriptController — module nhỏ NEW trong cùng file hoặc file riêng `src/features/ocr/pipeline/ocrTrackBridge.ts`:**
Content script chính (contentScriptController context) export 2 hàm; ocrContentScript gọi qua callback được inject từ `initOcrContentScript(triggerFactory?, ocrTrackBridge?)`. THIẾT KẾ ĐƠN GIẢN NHẤT: event `window.dispatchEvent(new CustomEvent('__cell-ocr-tracks', { detail: { targetCues, nativeCues } }))` + contentScriptController listen (main world↔isolated world chia window events? — CustomEvent KHÔNG cross world an toàn cho detail objects... isolated↔main: window.postMessage an toàn hơn). DÙNG `window.postMessage({ type: '__CELL_OCR_TRACKS', targetCues, nativeCues }, '*')` từ ocrContentScript; contentScriptController thêm listener `window.addEventListener('message', ...)` cùng world (CẢ HAI đều isolated world — postMessage trong cùng world VẪN fire listener; đúng: postMessage từ isolated đến chính isolated listener hoạt động vì cùng window object). Revert khi split off: postMessage `{ type: '__CELL_OCR_TRACKS_END' }`.

**contentScriptController (theo translatedNativeSlot pattern — đọc file, chỗ định nghĩa slot + mergedPanelItems + activeNativeSource):**
```typescript
interface OcrTrackSlot { item: SubtitlePanelItem; cues: SrtCue[]; }
let ocrTargetSlot: OcrTrackSlot | null = null;
let ocrNativeSlot: OcrTrackSlot | null = null;
let preOcrSources: { target: string; native: string } | null = null;

// message listener:
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const d = e.data as { type?: string; targetCues?: SrtCue[]; nativeCues?: SrtCue[] };
  if (d?.type === '__CELL_OCR_TRACKS' && d.targetCues && d.nativeCues) {
    if (!ocrTargetSlot) {
      preOcrSources = { target: activeTargetSource, native: activeNativeSource };
      ocrTargetSlot = { item: makeOcrItem('ocr-target', 'OCR Target (live)', 'target'), cues: [] };
      ocrNativeSlot = { item: makeOcrItem('ocr-native', 'OCR Native (live)', 'native'), cues: [] };
      // makeOcrItem: SubtitlePanelItem với source: 'ocr' (sau khi union extend), name cố định
    }
    ocrTargetSlot.cues = d.targetCues; ocrNativeSlot.cues = d.nativeCues;
    blockController.loadBilingualCues(d.targetCues, d.nativeCues);
    activeTargetSource = 'ocr'; activeNativeSource = 'ocr'; // theo mechanism active source hiện có
    refreshPanel('target'); refreshPanel('native');
  }
  if (d?.type === '__CELL_OCR_TRACKS_END') {
    ocrTargetSlot = ocrNativeSlot = null;
    if (preOcrSources) { activeTargetSource = preOcrSources.target; activeNativeSource = preOcrSources.native; preOcrSources = null; }
    refreshPanel('target'); refreshPanel('native');
  }
});
// mergedPanelItems: chèn ocrTargetSlot/ocrNativeSlot item vào list khi slot != null (pattern translatedNativeSlot).
```
(Tên biến `activeTargetSource`/`activeNativeSource`/`refreshPanel`/`blockController` — đọc file thật, dùng đúng tên biến hiện có. `loadBilingualCues` tồn tại (đã verify). Nếu cơ chế active-source khác (hàm setState...), LÀM THEO CODE THẬT.)

**subtitlePanelModel.ts:** `source: 'auto' | 'imported' | 'translated' | 'searched' | 'ocr'`.

**AC:**
- [ ] `npm run typecheck && npm run test:unit && npm run build` pass TOÀN BỘ
- [ ] Unit test mới: bridge message format (`__CELL_OCR_TRACKS` / END) — test nhỏ cho event flow nếu testable; tối thiểu: split config plumb qua OcrSession start (mock controller) — đụng ocrContentScript.test.ts nếu hiện có
- [ ] Split OFF (toggle) → postMessage END → slots null, revert sources (đọc code xác nhận)

**Dependencies:** T1, T2, T3, T5. **Forbidden:** không break single-stream hiện có (splitEnabled=false → code path cũ y nguyên).

---

## Risks

| Risk | Mitigation |
|------|-----------|
| CDN model endpoint chưa xác định (spec OQ#5) | T4 chỉ bỏ asset override — nếu paddleocr-js không tự fetch đúng, engine init lỗi runtime → browser test sẽ bắt; không block unit tests |
| ocrRunner Map refactor phá timing engine cũ | Backward compat: engineKey default 'ch' |
| contentScriptController biến tên khác plan | Task 7 yêu cầu ĐỌC FILE TRƯỚC, dùng tên thật |
| Subagent conflict file | Mỗi task có Forbidden list; đợt chạy song song không giao file |

## Verify (main agent + verify subagent)

Sau T7: main agent chạy `npm run typecheck && npm run test:unit && npm run build` + browser test (stealth MCP) theo spec §Browser tests 1-10. Verify subagent độc lập: checklist AC từng task + spec Success Criteria, đọc diff, KHÔNG sửa code — chỉ báo cáo.
