# Spec: Ocean Language Acquisition SRS

> Status: **Final Draft v5**.
> Intent source: `docs/intent/ocean-language-acquisition-srs.md`.
> Source of truth: `Ocean_Language_Acquisition_SRS_Intent.md`.

---

## Assumptions

1. **V1 target language validation = English**; multi-language schema sẵn sàng trong Notetype/Field, nhưng validation đầy đủ chờ phase sau.
2. **FSRS engine** sử dụng `ts-fsrs` v5.x như scheduler boundary, trừ khi T0 spike cho thấy bundle/compat không ổn. User judgment là binary (Forget/Remember); adapter map sang `Rating.Again` / `Rating.Good`.
3. **Audio stimulus** tái dùng Ocean Pronunciation Engine (`docs/specs/ocean-pronunciation-engine.md`) và TTS fallback chain (`fnc_tts.md`); SRS không tự tổng hợp audio.
4. **Storage** cho notes/cards/reviews ở IndexedDB `cell-srs-{hash}`, copy pattern `baseRepository` từ `src/features/dictionary/repositories/baseRepository.ts`. Settings/StudyConfig ở `chrome.storage.local` qua `settingsStore`.
5. **Card source V1**: Notes/Learning Objects được tạo qua universal dictionary panel / site dictionary panel (reuse UI sẵn có), có thể chỉnh sửa thủ công trước khi lưu. Import nhanh từ reader / video là Slice 11 (post-MVP core V1).
6. **Spelling recall** là exact match với normalization tối thiểu (lowercase, trim, collapse whitespace, strip leading/trailing punctuation). V1 không cho partial credit.
7. **V1 dùng entrypoint mới** `src/entrypoints/srs-study/`, đăng ký trong `vite.config.ts` `rollupOptions.input` và `manifest.json` `web_accessible_resources`.
8. **Ocean SRS cùng tồn tại với Card Creator / AnkiConnect**. `DictionaryPopupSettings.srsDestination` mở rộng thành `'anki' | 'ocean-srs'`. Trong dictionary popup / universal panel, user chọn destination (Anki hoặc SRS) trước khi thêm từ. V1 hỗ trợ single-word add từ dictionary tab.

---

## Background

### Problem

SRS/flashcard thông thường tối ưu cho *card completion*, không phải language acquisition. Chúng coi một từ là một trạng thái nhớ duy nhất, dựa nhiều vào native-language translation, nên người học không xây dựng được liên kết trực tiếp với target language và bị ép "quên" cả thẻ khi chỉ một kỹ năng yếu.

### User

Người học ngoại ngữ trên Cell (persona chính 10–25 tuổi, hỗ trợ 5–80), dùng Chrome/Edge/Brave MV3, desktop/tablet/Android, học bằng content có sẵn (từ điển, reader, video, subtitle).

### Current workflow

Gặp từ mới → tra dictionary popup / reader / video → lưu vào deck. Nếu dùng Anki: một card = một state, review khi đến hạn, đánh giá Again/Hard/Good/Easy. Nếu biết nghĩa nhưng không phát âm được, thẻ vẫn bị "Again"; tiếng mẹ đẻ thường là cầu nối chính. Trong Cell hiện chưa có SRS tích hợp.

### Pain point

Một learning object có thể meaning giỏi, sound yếu, spelling khá; app thông thường không phân biệt. Progress không hiển thị theo component. Offline review bị phụ thuộc AI/cloud. Người học bị ép lặp lại nội dung đã biết.

### Evidence

`Ocean_Language_Acquisition_SRS_Intent.md` v1.0 (41 phần + 9 design test cases A–I + 20 non-negotiable rules). Cụ thể: "Ocean is not a flashcard app"; "optimize for language acquisition, not flashcard completion"; case B meaning strong sound weak phải ưu tiên sound.

### Desired outcome

Hệ thống SRS trong Cell mà mỗi Learning Object (từ/cụm) có 3 Memory Component độc lập: **Meaning, Sound, Spelling**. Mỗi component có progress, FSRS state, scheduling riêng. Scheduler chọn component cần reinforce, chọn stimulus + template, hiển thị Front, learner tự đánh giá **Forget/Remember** đúng component đang test. Back là verification surface đầy đủ. UI hiển thị learning path và progress từng component. V1 tập trung recognition + recall chính tả.

---

## Constraints

- **Offline-first**: core review không cần AI, LLM, cloud inference, online pronunciation scoring, online content generation.
- **Target language là medium chính**; native translation chỉ là reference/fallback, không tự động expose trên Front.
- **Hai nút Forget/Remember** cho V1; phức tạp thuộc scheduler/memory model, không UI.
- **Tách biệt**: Content / Stimulus / Review Type / Learning Component / Learning Path / Progress / FSRS State / Scheduler / Template / Deck / Notetype.
- **Độ phức tạp**: O(1) → O(log n) lý tưởng, **tối đa O(n)** — không dùng O(n log n) toàn bộ store.
- **Response**: scheduler query ≤ 100ms cho 1000 cards; review transition ≤ 300ms desktop, ≤ 500ms Android; first paint ≤ 1.5s.
- **MV3 Chrome extension**, Liquid Glass design, `src/shared/ui/`, tokens.
- **Không phá vỡ** dictionary, pronunciation engine, language profile, reader, local video player, card creator, AnkiConnect.
- **IndexedDB / `chrome.storage.local`** theo project pattern.

---

## Objective

Xây dựng **Ocean Language Acquisition SRS** — hệ thống spaced repetition trong Cell, offline-first, tối ưu cho *language acquisition* chứ không phải *flashcard completion*.

### User stories

- **As a learner**, I want to review words offline so that I strengthen meaning, sound, and spelling independently.
- **As a learner**, I want to see per-component progress so that I know which skill is weak and what the system will practice next.
- **As a learner**, I want to study a component again without destroying its memory state.
- **As a learner**, I want to reset a single component or an entire card when I feel I have forgotten it.
- **As a user**, I want to create decks, subdecks, and notetypes so that my content is organized the way I learn.

### Success (high-level)

User mở Ocean SRS, review một từ, thấy Front stimulus (image/audio/sentence/input), reveal Back, chọn Forget/Remember, chỉ component đang test được reschedule. Progress bars hiển thị Meaning/Sound/Spelling riêng. Tất cả chạy không cần network.

---

## Scope

### In scope (MVP V1)

- 3 Memory Component: Meaning, Sound, Spelling; mỗi component có progress + FSRS state độc lập.
- 3 Review Type: Meaning recognition, Sound recognition, Spelling recall.
- Learning Path cấu hình: stages, threshold, progression mode (sequential/parallel), min explore count.
- Binary Forget/Remember judgment.
- Notetype / Field / Front template / Back template CRUD.
- Deck / Subdeck CRUD; Collection hierarchy.
- Note / Learning Object / Card creation (manual V1, reuse Card Creator UI, single-word add from dictionary popup / universal panel, multi-language collection).
- Scheduler: select component, stimulus, template, present review, update FSRS + progress.
- Review UI: Front, Back, input field, Forget/Remember, progress bars.
- User controls: Study Again, Reset Component (confirm), Reset Card (confirm).
- Explore mode cho new cards.
- Maintenance mode khi tất cả component đạt threshold.
- Offline-first; no AI.
- New `srs-study` entrypoint.
- Default notetype seed với 8 front templates cơ bản.

### Out of scope

- Free conversation, creative writing, essay generation, grammar composition.
- Semantic analysis, linguistic evaluation.
- Bloom Analyze / Evaluate / Create.
- Pronunciation scoring / AI-based pronunciation grading.
- AI-generated review content during offline review.
- AI content generation (definitions, sentences, examples, images).
- Native-language translation as the primary learning path.
- Neural TTS, advanced adaptive learning beyond FSRS.
- Multi-user sync, backend sync, Anki/CSV full import.
- Bulk / batch import từ dictionary popup / reader (Slice 11).

---

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite 8, `@crxjs/vite-plugin`. FSD, named export, không `any`.
- **State**: Zustand 5 for UI state; `chrome.storage.local` for settings/study config; IndexedDB for SRS data.
- **Scheduler**: `ts-fsrs` v5.x (MIT, Node.js ≥20, ES module/UMD), wrapped behind `SrsFsrsAdapter` interface. T0 spike required before final dependency pin.
- **Audio**: Reuse `PronunciationAudioOrchestrator` / TTS fallback chain from `features/pronunciation`.
- **Storage pattern**: Copy `baseRepository` pattern in dedicated `cell-srs-{hash}` IndexedDB.
- **Validation**: Zod at message and persistence boundaries.
- **UI**: `src/shared/ui/` components + CSS modules + design tokens.
- **Test**: Jest + jsdom (unit), Playwright (E2E).

### Dependencies

```bash
npm add --save-exact ts-fsrs@5.4.1
```

Chỉ khi spike xác nhận bundle + browser compat. Nếu không, dùng vendored minimal port.

---

## Commands

```bash
npm run dev
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
npm run lint
npm run mock
```

---

## Project Structure

```
src/
├── entities/srs/types.ts            # Cross-cutting SRS types + SrsFsrsAdapter
├── features/srs/
│   ├── logic/
│   │   ├── scheduler.ts             # selectNextReview
│   │   ├── resolvePool.ts           # pool classification
│   │   ├── pickHighestPriority.ts   # bucketed O(n)
│   │   ├── reviewEngine.ts          # applyReview, resetComponent, resetCard, recalcCard
│   │   ├── progressCalculator.ts    # gain/penalty/status
│   │   ├── learningPath.ts          # isLocked / explore / maintenance
│   │   ├── stimulusSelector.ts
│   │   ├── templateSelector.ts
│   │   ├── maskSentence.ts
│   │   └── studyAgain.ts
│   ├── services/
│   │   ├── srsFsrsAdapter.ts
│   │   ├── audioStimulusResolver.ts
│   │   └── imageStimulusResolver.ts
│   ├── repositories/                # baseRepository pattern
│   └── ui/
├── entrypoints/srs-study/
│   ├── index.html
│   ├── App.tsx
│   └── main.tsx
├── shared/config/messages.ts
└── e2e/ocean-srs.spec.ts
```

### Build / MV3 wiring

- `vite.config.ts`: thêm `srsStudy: resolve(import.meta.dirname, 'src/entrypoints/srs-study/index.html')`.
- `public/manifest.json`: thêm `src/entrypoints/srs-study/index.html` vào `web_accessible_resources`.
- `src/entities/message/types.ts`: thêm `SRS_ADD_NOTE` message type (V1) và `SRS_*` types (Slice 11).
- `src/entities/settings/types.ts`: mở rộng `srsDestination` `'anki' | 'ocean-srs'`.
- `src/shared/lib/storage/settingsStore.ts`: bump `CURRENT_SCHEMA_VERSION` lên 27, thêm migration v26→v27 cho `Settings.srs` slice.

---

## Data Model

```ts
export type SrsLanguageCode = string; // ISO/BCP-47
export type ComponentType = 'meaning' | 'sound' | 'spelling';
export type ReviewJudgment = 'forget' | 'remember';
export type ReviewMode = 'explore' | 'normal' | 'studyAgain';

export interface SrsCollection {
  readonly id: string;
  readonly languageProfileId: string | null;
  readonly targetLanguage: string;
  readonly name: string;
  readonly defaultStudyConfigId: string;
  readonly defaultDeckId: string;
  readonly defaultNotetypeId: string;
  readonly createdAt: number;
}

export interface SrsDeck {
  readonly id: string;
  readonly collectionId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly order: number;
  readonly studyConfigId: string;
}

export interface SrsStudyConfig {
  readonly id: string;
  readonly targetThreshold: number; // 0–100, default 90
  readonly learningPath: SrsLearningPathConfig;
  readonly progressConstants: SrsProgressConstants;
}

export interface SrsProgressConstants {
  readonly rememberGainBase: number;   // default 20
  readonly rememberGainMin: number;    // default 1
  readonly forgetPenaltyBase: number;  // default 12
  readonly forgetPenaltyStep: number;  // default 0.1
}

export interface SrsLearningPathConfig {
  readonly stages: readonly ComponentType[];          // default ['sound','meaning','spelling']
  readonly progressionMode: 'sequential' | 'parallel'; // default 'parallel'
  readonly minExplores: number;                       // default 1
}

export interface SrsNotetype {
  readonly id: string;
  readonly collectionId: string;
  readonly name: string;
  readonly targetFieldId: string; // phải là field type 'text'
  readonly fields: readonly SrsField[];
  readonly frontTemplates: readonly SrsFrontTemplate[];
  readonly backTemplate: SrsBackTemplate;
}

export interface SrsField {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly type: 'text' | 'audio' | 'image' | 'list' | 'translation' | 'context';
}

export type StimulusType =
  | 'image'
  | 'definition'
  | 'sentence'
  | 'example-sentence'
  | 'word-audio'
  | 'sentence-audio'
  | 'context'
  | 'ipa';

export interface SrsFrontTemplate {
  readonly id: string;
  readonly componentType: ComponentType;
  readonly stimulusType: StimulusType;
  readonly fieldIds: readonly string[]; // field ids
  readonly maskFieldId?: string;         // field để mask target phrase
  readonly maskTarget?: boolean;         // true nếu mask target phrase trong sentence
  readonly requiresInput: boolean;       // true cho spelling
  readonly prompt?: string;
}

export interface SrsBackTemplate {
  readonly fieldIds: readonly string[]; // danh sách field hiển thị trên Back, theo thứ tự
  readonly showAll: boolean;            // V1: true = hiển thị tất cả fieldIds (không fold); false = compact (reserved)
}

export interface SrsNote {
  readonly id: string;
  readonly notetypeId: string;
  readonly deckId: string;
  readonly targetWord: string; // canonical, copy từ targetField
  readonly fields: Record<string, SrsFieldValue>; // key = field id
  readonly createdAt: number;
}

export type SrsFieldValue =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'translation'; readonly value: string }
  | { readonly kind: 'audio'; readonly value: string; readonly source: 'local' | 'pronunciation' | 'tts' }
  | { readonly kind: 'image'; readonly value: string }
  | { readonly kind: 'list'; readonly value: readonly string[] }
  | { readonly kind: 'context'; readonly value: string };

export interface SrsCard {
  readonly id: string;
  readonly noteId: string;
  readonly deckId: string;
  readonly components: Record<ComponentType, SrsMemoryComponent>;
  readonly studyAgainDue: Record<ComponentType, string | null>;
  readonly createdAt: number; // epoch ms; `nextDue` initialized to `new Date(createdAt).toISOString()`
  readonly nextDue: string;    // ISO, = min(effectiveDue across components)
  readonly maintenanceMode: boolean; // persisted, derived on write
}

export interface SrsMemoryComponent {
  readonly type: ComponentType;
  readonly progress: number; // 0–100
  readonly exploreCount: number;
  readonly fsrsState: SrsFsrsSerializedState;
  readonly reviewCount: number;
}

export interface SrsFsrsSerializedState {
  readonly version: number;
  readonly due: string; // ISO
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsedDays: number;
  readonly scheduledDays: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: number; // opaque ts-fsrs State enum
  readonly lastReview?: string;
}

export interface SrsReviewRecord {
  readonly id: string;
  readonly cardId: string;
  readonly noteId: string;
  readonly notetypeId: string;
  readonly componentType: ComponentType;
  readonly templateId: string;
  readonly stimulusType: StimulusType;
  readonly startedAt: number;
  readonly answeredAt: number;
  readonly judgment: ReviewJudgment;
  readonly typedInput?: string;
  readonly isSpellingCorrect?: boolean;
  readonly isStudyAgain: boolean;
  readonly resultingProgress: number;
  readonly resultingFsrsState: SrsFsrsSerializedState;
}

export interface SrsReviewSession {
  readonly card: SrsCard;
  readonly note: SrsNote;
  readonly notetype: SrsNotetype;
  readonly componentType: ComponentType;
  readonly template: SrsFrontTemplate;
  readonly stimulus: SrsStimulus;
  readonly mode: ReviewMode;
  readonly startedAt: number;
}

export interface SrsStimulus {
  readonly type: StimulusType;
  readonly payload: SrsFieldValue | Record<string, SrsFieldValue>;
}

export interface SrsAudioAsset {
  readonly id: string; // hash(noteId + fieldId + source)
  readonly noteId: string;
  readonly fieldId: string;
  readonly source: 'local' | 'pronunciation' | 'tts';
  readonly mimeType: string;
  readonly bytes: ArrayBuffer;
  readonly size: number;       // bytes
  readonly lastAccessed: number;
  readonly createdAt: number;
}

export interface SrsImageAsset {
  readonly id: string; // hash(noteId + fieldId)
  readonly noteId: string;
  readonly fieldId: string;
  readonly mimeType: string;
  readonly bytes: ArrayBuffer;
  readonly size: number;
  readonly lastAccessed: number;
  readonly createdAt: number;
}

export interface SrsFsrsAdapter {
  readonly createEmpty: (now: Date) => SrsFsrsSerializedState; // due = now
  readonly next: (state: SrsFsrsSerializedState, now: Date, judgment: ReviewJudgment, preserveDue: boolean) => SrsFsrsSerializedState;
  // preserveDue=true: giữ nguyên `state.due`, chỉ cập nhật `reps`, `lastReview`.
  readonly isDue: (state: SrsFsrsSerializedState, now: Date) => boolean;
  readonly getDue: (state: SrsFsrsSerializedState) => string;
  readonly migrate: (state: unknown, fromVersion: number) => SrsFsrsSerializedState;
}
```

### Key invariants

- One `Note` = one `Learning Object`; one `Note` → một `Card`.
- `Card` chứa 3 `MemoryComponent`, mỗi cái có FSRS state riêng.
- `SrsFsrsSerializedState` là opaque; chỉ `SrsFsrsAdapter` đọc/ghi.
- `ReviewRecord` append-only.
- `maintenanceMode` lưu trên `Card` nhưng được tính lại mỗi khi component thay đổi.
- **Mọi write lên `Card` đều phải gọi `recalcCard(card, config)`** để cập nhật `nextDue`, `maintenanceMode`, và `studyAgainDue`.

### Shared helpers

```ts
const COMPONENT_TYPES: readonly ComponentType[] = ['sound', 'meaning', 'spelling'];
const FUTURE_ISO = '9999-12-31T23:59:59.999Z';

function minISO(...values: string[]): string {
  return values.reduce((min, v) => (v < min ? v : min), values[0] ?? FUTURE_ISO);
}

function normalizeSpelling(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^\w\s]+|[^\w\s]+$/g, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function audioAssetId(noteId: string, fieldId: string, source: string): string {
  // stable hash of noteId + fieldId + source
  return hashString(`${noteId}:${fieldId}:${source}`);
}

function imageAssetId(noteId: string, fieldId: string): string {
  return hashString(`${noteId}:${fieldId}`);
}

function isDataUrl(s: string): boolean {
  return s.startsWith('data:');
}

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mapDictionaryToSrsFields(
  notetype: SrsNotetype,
  result: {
    readonly term: string;
    readonly reading?: string;
    readonly sentence?: string;
    readonly definitions?: readonly string[];
    readonly audioUrl?: string;
    readonly sentenceAudioUrl?: string;
    readonly imageUrl?: string;
    readonly translation?: string;
  },
): Record<string, SrsFieldValue> {
  const fields: Record<string, SrsFieldValue> = {};

  for (const field of notetype.fields) {
    switch (field.id) {
      case 'target':
        fields['target'] = { kind: 'text', value: result.term };
        break;
      case 'ipa':
        if (result.reading) fields['ipa'] = { kind: 'text', value: result.reading };
        break;
      case 'sentence':
        if (result.sentence) fields['sentence'] = { kind: 'text', value: result.sentence };
        break;
      case 'def':
        if (result.definitions?.length) fields['def'] = { kind: 'text', value: result.definitions[0] };
        break;
      case 'wordAudio':
        if (result.audioUrl) fields['wordAudio'] = { kind: 'audio', value: result.audioUrl, source: 'pronunciation' };
        break;
      case 'sentAudio':
        if (result.sentenceAudioUrl) fields['sentAudio'] = { kind: 'audio', value: result.sentenceAudioUrl, source: 'tts' };
        break;
      case 'image':
        if (result.imageUrl) fields['image'] = { kind: 'image', value: result.imageUrl };
        break;
      case 'translation':
        if (result.translation) fields['translation'] = { kind: 'translation', value: result.translation };
        break;
    }
  }

  return fields;
}

async function cacheDictionaryMedia(
  noteId: string,
  fields: Record<string, SrsFieldValue>,
): Promise<void> {
  for (const [fieldId, value] of Object.entries(fields)) {
    if (value.kind === 'audio') {
      // Download/cache audio; if fail, keep URL as value; SRS will fallback offline.
      try {
        const bytes = await fetchAudioBytes(value.value);
        await putAudioAsset({ id: audioAssetId(noteId, fieldId, value.source), noteId, fieldId, source: value.source, mimeType: 'audio/mpeg', bytes, size: bytes.byteLength, lastAccessed: Date.now(), createdAt: Date.now() });
        fields[fieldId] = { ...value, value: 'cached' }; // placeholder, actual url generated at review time
      } catch {
        // keep external URL; offline review will use fallback template
      }
    } else if (value.kind === 'image') {
      if (isDataUrl(value.value)) {
        // decode and cache
        const bytes = await dataUrlToBytes(value.value);
        await putImageAsset({ id: imageAssetId(noteId, fieldId), noteId, fieldId, mimeType: 'image/png', bytes, size: bytes.byteLength, lastAccessed: Date.now(), createdAt: Date.now() });
      } else {
        // external image URL; reject because SRS is offline-first
        throw new SrsError('SRS_IMAGE_OFFLINE', 'Cannot use external image URL for offline SRS.');
      }
    }
  }
}
```

---

## Progress, Learning Path & State Transitions

### Progress formula (V1)

`progress` là acquisition progress, 0–100, **không phải** FSRS retrievability.

```ts
function gain(p: number, c: SrsProgressConstants): number {
  return Math.max(c.rememberGainMin, Math.floor(c.rememberGainBase * (1 - p / 100)));
}

function penalty(p: number, c: SrsProgressConstants): number {
  return Math.max(5, Math.floor(c.forgetPenaltyBase - (p * c.forgetPenaltyStep)));
}

function calculateProgress(
  component: SrsMemoryComponent,
  judgment: ReviewJudgment,
  isSpellingCorrect: boolean,
  config: SrsStudyConfig,
  mode: ReviewMode,
): number {
  // Explore mode: chỉ tăng exploreCount, không thay đổi progress.
  if (mode === 'explore') return component.progress;

  if (judgment === 'remember' && (component.type !== 'spelling' || isSpellingCorrect)) {
    return Math.min(100, component.progress + gain(component.progress, config.progressConstants));
  }
  return Math.max(0, component.progress - penalty(component.progress, config.progressConstants));
}
```

- **Explore mode**: mỗi lần component được show, `exploreCount += 1`; `progress` không đổi. Không gọi `adapter.next`.
- **Spelling recall**: `Remember` chỉ enable khi `typedInput` khớp `note.targetWord` sau normalization; user phải sửa input cho đúng trước khi submit. Khi input đúng, hệ thống tự động submit `Remember` và auto-advance. Nếu user click `Forget`, áp penalty.
- **Threshold**: default 90; `progress >= threshold` → satisfied.

### Status transition table

| Status | Condition |
|---|---|
| **locked** | `isLocked(component, card, config) === true`. |
| **active** | !locked && `progress < threshold`. |
| **satisfied** | `progress >= threshold` && `!card.maintenanceMode`. |
| **maintenance** | `progress >= threshold` && `card.maintenanceMode === true`. Nếu `Forget` trong maintenance, component trở lại **active**. |

### `isLocked`

```ts
function isLocked(
  component: SrsMemoryComponent,
  card: SrsCard,
  config: SrsStudyConfig,
): boolean {
  const { stages, progressionMode, minExplores } = config.learningPath;
  const idx = stages.indexOf(component.type);
  if (idx < 0) return false;

  // Explore phase: component chưa đủ lần expose thì vẫn locked
  if (component.exploreCount < minExplores) {
    for (let i = 0; i < idx; i++) {
      if (card.components[stages[i]].exploreCount < minExplores) return true;
    }
    return false;
  }

  if (progressionMode === 'parallel') return false;
  if (progressionMode === 'sequential') {
    for (let i = 0; i < idx; i++) {
      if (card.components[stages[i]].progress < config.targetThreshold) return true;
    }
    return false;
  }
  return false;
}
```

### `selectNextExploreComponent`

```ts
function selectNextExploreComponent(card: SrsCard, config: SrsStudyConfig): ComponentType | null {
  const { stages, minExplores } = config.learningPath;
  for (const type of stages) {
    const comp = card.components[type];
    if (comp.exploreCount < minExplores && !isLocked(comp, card, config)) return type;
  }
  return null;
}
```

### `recalcCard` (mandatory on every card write)

```ts
function recalcCard(
  card: SrsCard,
  config: SrsStudyConfig,
  now: string,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const comps = { ...card.components };
  const types = Object.keys(comps) as ComponentType[];
  const studyAgainDue = { ...card.studyAgainDue };

  for (const t of types) {
    const due = studyAgainDue[t];
    // Study Again chỉ có hiệu lực nếu <= now; nếu trong tương lai hoặc null thì bỏ qua
    if (due && due <= now) {
      // còn hiệu lực, giữ
    } else if (due) {
      studyAgainDue[t] = null;
    }
  }

  const effectiveDues = types.map((t) => {
    const fsrsDue = adapter.getDue(comps[t].fsrsState);
    const study = studyAgainDue[t];
    if (study && study <= fsrsDue) return study;
    return fsrsDue;
  });

  const exploreType = selectNextExploreComponent(card, config);
  const exploreDue = exploreType ? now : FUTURE_ISO;

  const nextDue = minISO(...effectiveDues, exploreDue);
  const maintenanceMode = Object.values(comps).every((c) => c.progress >= config.targetThreshold);

  return { ...card, components: comps, studyAgainDue, nextDue, maintenanceMode };
}
```

---

## FSRS Integration

### Boundary

- **SRS owns**: component to test, stimulus/template, binary judgment, acquisition progress.
- **FSRS owns**: Difficulty, Stability, Retrievability, due date, state machine.

### Adapter mapping

- `forget` → `Rating.Again`
- `remember` → `Rating.Good`
- `preserveDue === true` (studyAgain) → `next()` trả về state với `due` giữ nguyên, chỉ cập nhật `reps` / `lastReview`; `progress` vẫn tăng.

---

## Review Engine

### `applyReview`

```ts
function applyReview(
  session: SrsReviewSession,
  judgment: ReviewJudgment,
  typedInput: string | undefined,
  now: Date,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): { card: SrsCard; record: SrsReviewRecord } {
  const { card, note, componentType, template, mode } = session;
  const comp = card.components[componentType];

  const isSpellingCorrect =
    componentType === 'spelling' && typedInput !== undefined
      ? normalizeSpelling(typedInput) === normalizeSpelling(note.targetWord)
      : undefined;

  const newProgress = calculateProgress(comp, judgment, isSpellingCorrect ?? false, config, mode);

  // FSRS chỉ cập nhật trong normal/studyAgain mode; explore mode giữ nguyên fsrsState.
  const newFsrsState =
    mode === 'explore'
      ? comp.fsrsState
      : adapter.next(
          comp.fsrsState,
          now,
          judgment,
          mode === 'studyAgain', // preserveDue
        );

  const newComp: SrsMemoryComponent = {
    ...comp,
    progress: newProgress,
    exploreCount: comp.exploreCount + (mode === 'explore' ? 1 : 0),
    fsrsState: newFsrsState,
    reviewCount: comp.reviewCount + 1,
  };

  let newCard: SrsCard = {
    ...card,
    components: { ...card.components, [componentType]: newComp },
  };

  // Sau Study Again review, clear studyAgainDue
  if (mode === 'studyAgain') {
    newCard = { ...newCard, studyAgainDue: { ...newCard.studyAgainDue, [componentType]: null } };
  }

  // Recalc derived fields
  newCard = recalcCard(newCard, config, now.toISOString(), adapter);

  const record: SrsReviewRecord = {
    id: generateId(),
    cardId: card.id,
    noteId: note.id,
    notetypeId: note.notetypeId,
    componentType,
    templateId: template.id,
    stimulusType: template.stimulusType,
    startedAt: session.startedAt,
    answeredAt: now.getTime(),
    judgment,
    typedInput,
    isSpellingCorrect,
    isStudyAgain: mode === 'studyAgain',
    resultingProgress: newProgress,
    resultingFsrsState: newFsrsState,
  };

  return { card: newCard, record };
}
```

### `studyAgain`

```ts
function studyAgain(
  card: SrsCard,
  type: ComponentType,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const comp = card.components[type];

  // Study Again chỉ áp dụng khi component đã qua explore (exploreCount >= minExplores).
  // Nếu component còn locked/explore, hàm này no-op (UI disable nút Study Again trong explore).
  if (comp.exploreCount < config.learningPath.minExplores) return card;

  const updated: SrsCard = {
    ...card,
    studyAgainDue: { ...card.studyAgainDue, [type]: now },
  };
  return recalcCard(updated, config, now, adapter);
}
```

### `resetComponent`

```ts
function resetComponent(
  card: SrsCard,
  type: ComponentType,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const empty = adapter.createEmpty(new Date(now));
  const updated: SrsCard = {
    ...card,
    components: {
      ...card.components,
      [type]: {
        type,
        progress: 0,
        exploreCount: 0,
        fsrsState: empty,
        reviewCount: 0,
      },
    },
    studyAgainDue: { ...card.studyAgainDue, [type]: null },
  };
  return recalcCard(updated, config, now, adapter);
}
```

### `resetCard`

```ts
function resetCard(card: SrsCard, now: string, config: SrsStudyConfig, adapter: SrsFsrsAdapter): SrsCard {
  const empty = adapter.createEmpty(new Date(now));
  const updated: SrsCard = {
    ...card,
    components: {
      meaning: { type: 'meaning', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      sound: { type: 'sound', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      spelling: { type: 'spelling', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
    },
    studyAgainDue: { meaning: null, sound: null, spelling: null },
  };
  return recalcCard(updated, config, now, adapter);
}
```

### `createCard`

```ts
function createCard(
  note: SrsNote,
  deckId: string,
  config: SrsStudyConfig,
  now: Date,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const empty = adapter.createEmpty(now);
  const createdAt = now.getTime();
  const raw: SrsCard = {
    id: generateId(),
    noteId: note.id,
    deckId,
    components: {
      meaning: { type: 'meaning', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      sound: { type: 'sound', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      spelling: { type: 'spelling', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
    },
    studyAgainDue: { meaning: null, sound: null, spelling: null },
    createdAt,
    nextDue: now.toISOString(),
    maintenanceMode: false,
  };
  return recalcCard(raw, config, now.toISOString(), adapter);
}
```

### Note/Card creation service

```ts
async function addNoteAndCard(
  db: IDBDatabase,
  collection: SrsCollection,
  deckId: string,
  notetypeId: string,
  targetWord: string,
  fields: Record<string, SrsFieldValue>,
  config: SrsStudyConfig,
  now: Date,
  adapter: SrsFsrsAdapter,
): Promise<{ note: SrsNote; card: SrsCard }> {
  // 1. Tránh duplicate note trong collection cho cùng target word + notetype
  const existingNote = await getNoteByTargetAndNotetype(db, collection.id, notetypeId, targetWord);
  if (existingNote) {
    const existingCard = await getCardByNoteAndDeck(db, existingNote.id, deckId);
    if (existingCard) throw new SrsError('SRS_DUPLICATE_CARD', 'Card already exists in this deck.');
    const card = createCard(existingNote, deckId, config, now, adapter);
    await putCard(db, card);
    return { note: existingNote, card };
  }

  // 2. Tạo note mới
  const note: SrsNote = {
    id: generateId(),
    notetypeId,
    deckId,
    targetWord,
    fields,
    createdAt: now.getTime(),
  };
  await putNote(db, note);

  // 3. Tạo card
  const card = createCard(note, deckId, config, now, adapter);
  await putCard(db, card);

  return { note, card };
}
```

---

## Architecture & Scheduler

### Scheduler pipeline

```
1. Xác định tập deckId cần study (deck + descendants nếu includeSubdecks).
2. Với mỗi deckId, mở cursor trên index `by_deck_due` với range [deckId, ''] đến [deckId, nowISO].
3. Thu thập tối đa `maxScan` card IDs (không fetch note/notetype trong cursor).
4. Sau khi cursor đóng, batch fetch note + notetype cho các card IDs.
5. Với mỗi card, kiểm tra từng component:
   - effectiveDue(type) = min(adapter.getDue(comp.fsrsState), studyAgainDue[type] ?? FUTURE_ISO).
   - Nếu component đang explore (selectNextExploreComponent trả về type), exploreDue = now.
   - Phân loại component vào pool: explore > active > satisfied > maintenance.
6. Chọn pool ưu tiên cao nhất có candidate.
7. Trong pool, chọn component có effectiveDue sớm nhất; tie thì progress thấp nhất.
8. Chọn stimulus/template.
9. Trả về SrsReviewSession với mode = pool tương ứng.
```

### `resolvePool`

```ts
type Pool = 'explore' | 'studyAgain' | 'active' | 'satisfied' | 'maintenance';

interface PoolCandidate {
  readonly card: SrsCard;
  readonly note: SrsNote;
  readonly notetype: SrsNotetype;
  readonly componentType: ComponentType;
  readonly effectiveDue: string;
  readonly progress: number;
  readonly pool: Pool;
}

function resolvePool(
  card: SrsCard,
  note: SrsNote,
  notetype: SrsNotetype,
  type: ComponentType,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): Pool | null {
  const comp = card.components[type];

  const exploreType = selectNextExploreComponent(card, config);
  if (exploreType === type) return 'explore';

  const fsrsDue = adapter.getDue(comp.fsrsState);
  const studyAgain = card.studyAgainDue[type];
  const effectiveDue = minISO(fsrsDue, studyAgain ?? FUTURE_ISO);

  if (effectiveDue > now) return null;
  if (isLocked(comp, card, config)) return null;

  if (studyAgain && studyAgain <= now) return 'studyAgain';

  if (comp.progress >= config.targetThreshold) {
    return card.maintenanceMode ? 'maintenance' : 'satisfied';
  }
  return 'active';
}
```

### `selectNextReview`

```ts
export async function selectNextReview(
  db: IDBDatabase,
  rootDeckId: string | null,
  includeSubdecks: boolean,
  config: SrsStudyConfig,
  now: string,
  adapter: SrsFsrsAdapter,
  maxScan = 1000,
): Promise<SrsReviewSession | null> {
  const deckIds = await resolveDeckIds(db, rootDeckId, includeSubdecks);
  const cardIds: string[] = [];
  let scannedCards = 0;

  // Phase 1: collect card IDs without async fetch inside cursor
  for (const deckId of deckIds) {
    if (scannedCards >= maxScan) break;
    const range = IDBKeyRange.bound([deckId, ''], [deckId, now]);
    const index = db.transaction('cards', 'readonly').objectStore('cards').index('by_deck_due');

    await new Promise<void>((resolve, reject) => {
      const cursor = index.openCursor(range);
      cursor.onsuccess = (e) => {
        const c = (e.target as IDBRequest).result as IDBCursorWithValue | null;
        if (!c || scannedCards >= maxScan) return resolve();
        const card = c.value as SrsCard;
        cardIds.push(card.id);
        scannedCards++;
        c.continue();
      };
      cursor.onerror = () => reject(cursor.error);
    });
  }

  // Phase 2: batch fetch
  const cards = await batchGetCards(db, cardIds);
  const noteIds = cards.map((c) => c.noteId);
  const notes = await batchGetNotes(db, noteIds);
  const notetypeIds = Array.from(new Set(notes.map((n) => n.notetypeId)));
  const notetypes = await batchGetNotetypes(db, notetypeIds);

  const candidates: PoolCandidate[] = [];
  for (const card of cards) {
    const note = notes.find((n) => n.id === card.noteId);
    const notetype = note ? notetypes.find((nt) => nt.id === note.notetypeId) : undefined;
    if (!note || !notetype) continue;
    for (const type of COMPONENT_TYPES) {
      const pool = resolvePool(card, note, notetype, type, now, config, adapter);
      if (!pool) continue;
      const comp = card.components[type];
      const studyAgain = card.studyAgainDue[type] ?? FUTURE_ISO;
      const fsrsDue = adapter.getDue(comp.fsrsState);
      const effectiveDue = minISO(fsrsDue, studyAgain);
      candidates.push({ card, note, notetype, componentType: type, effectiveDue, progress: comp.progress, pool });
    }
  }

  const winner = pickHighestPriority(candidates);
  if (!winner) return null;

  const surface = resolveReviewSurface(winner.note, winner.notetype, winner.componentType, audioCache, imageCache);
  if (!surface) return null;
  const { template, stimulus } = surface;
  const mode = poolToMode(winner.pool);
  const startedAt = Date.now();
  return { card: winner.card, note: winner.note, notetype: winner.notetype, componentType: winner.componentType, template, stimulus, mode, startedAt };
}

function pickHighestPriority(candidates: PoolCandidate[]): PoolCandidate | null {
  const poolOrder: Pool[] = ['explore', 'studyAgain', 'active', 'satisfied', 'maintenance'];
  for (const pool of poolOrder) {
    const poolList = candidates.filter((c) => c.pool === pool);
    if (poolList.length === 0) continue;
    let best = poolList[0];
    for (const c of poolList) {
      if (c.effectiveDue < best.effectiveDue) best = c;
      else if (c.effectiveDue === best.effectiveDue && c.progress < best.progress) best = c;
    }
    return best;
  }
  return null;
}

function poolToMode(pool: Pool): ReviewMode {
  if (pool === 'explore') return 'explore';
  if (pool === 'studyAgain') return 'studyAgain';
  return 'normal';
}
```

### Complexity

- Mỗi deck query: bounded `by_deck_due` cursor, tối đa `maxScan` cards.
- `resolvePool` là O(1) với 3 components.
- `pickHighestPriority` là O(n) bucketed, không sort.

### `resolveReviewSurface`

Mục tiêu: chọn **một template** và **một stimulus** khớp nhau, có thể render offline. Không gọi `selectStimulus` và `selectTemplate` riêng rẽ.

```ts
function resolveReviewSurface(
  note: SrsNote,
  notetype: SrsNotetype,
  type: ComponentType,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): { template: SrsFrontTemplate; stimulus: SrsStimulus } | null {
  const candidates = notetype.frontTemplates.filter((t) => t.componentType === type);
  if (candidates.length === 0) return null;

  for (const template of candidates) {
    const stimulus = buildStimulus(note, notetype, template, audioCache, imageCache);
    if (stimulus) return { template, stimulus };
  }

  return null;
}

function buildStimulus(
  note: SrsNote,
  notetype: SrsNotetype,
  template: SrsFrontTemplate,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): SrsStimulus | null {
  const payload: Record<string, SrsFieldValue> = {};

  for (const fieldId of template.fieldIds) {
    const value = note.fields[fieldId];
    if (!value) return null; // required field missing → template not usable

    if (value.kind === 'audio') {
      const cached = audioCache.get(audioAssetId(note.id, fieldId, value.source));
      if (cached) {
        payload[fieldId] = { ...value, value: URL.createObjectURL(new Blob([cached.bytes], { type: cached.mimeType })) };
      } else {
        return null; // audio cache miss → try next template
      }
    } else if (value.kind === 'image') {
      const cached = imageCache.get(imageAssetId(note.id, fieldId));
      if (cached) {
        payload[fieldId] = { ...value, value: URL.createObjectURL(new Blob([cached.bytes], { type: cached.mimeType })) };
      } else if (isDataUrl(value.value)) {
        payload[fieldId] = value;
      } else {
        return null; // image not cached / not data URL → try next template
      }
    } else if (template.maskTarget && template.maskFieldId === fieldId && value.kind === 'text') {
      payload[fieldId] = { kind: 'text', value: maskSentence(value.value, note.targetWord) };
    } else {
      payload[fieldId] = value;
    }
  }

  return { type: template.stimulusType, payload };
}
```

`selectNextReview` gọi `resolveReviewSurface(...)` và dùng kết quả làm `template` + `stimulus` trong `SrsReviewSession`.

---

## Masking

```ts
function maskSentence(sentence: string, targetWord: string): string {
  const re = new RegExp(escapeRegExp(targetWord), 'gi');
  return sentence.replace(re, (match) => '░'.repeat(match.length));
}
```

- `maskFieldId` trong `SrsFrontTemplate` xác định field cần mask.
- Áp dụng cho Spelling/Meaning sentence stimulus.
- **Hạn chế V1**: multi-word target ("give up") và inflection ("abandoned") được xử lý theo exact string match. Đây là accepted risk.

---

## Audio & Image Stimulus / Offline Cache

### Audio

- `audioStimulusResolver` gọi `PronunciationAudioOrchestrator.resolve` khi tạo Note hoặc lần đầu Sound review.
- Kết quả (ArrayBuffer + mimeType) cache vào `srsAudioAssets`.
- Scheduler chỉ đọc cache; không resolve trong `selectNextReview`.
- Nếu cache miss, **fallback sang non-audio Sound template**: ví dụ template `stimulusType='context'`, field sentence chứa target word bị mask, hoặc IPA/text prompt.
- Quota 50MB; LRU dựa trên `lastAccessed` và `size`.

### Image

- `image` field value phải là data URL / base64 hoặc local file handle; **external URL bị từ chối** khi offline.
- `imageStimulusResolver` đọc/giải mã base64.
- `srsImageAssets` lưu `ArrayBuffer`, quota 50MB, LRU.

---

## MV3 & Message Bus

### V1

Data operations chạy trong `srs-study` entrypoint (extension origin → IndexedDB). Tuy nhiên, dictionary popup / universal panel cần gửi dữ liệu từ content context để tạo note:

```ts
export interface SrsAddNotePayload {
  readonly type: 'SRS_ADD_NOTE';
  readonly payload: {
    readonly targetWord: string;
    readonly targetLanguage: string;           // để chọn / auto-create Collection
    readonly collectionId?: string;            // nếu user đã chọn collection
    readonly deckId?: string;                  // nếu user đã chọn deck; nếu undefined, dùng default deck
    readonly notetypeId?: string;              // nếu user đã chọn notetype; nếu undefined, dùng default notetype
    readonly fields: Record<string, SrsFieldValue>; // pre-fill từ dictionary + user edit
  };
}
```

Background / offscreen handler nhận message, mở `srs-study` tab nếu chưa mở, và proxy request để `srs-study` ghi vào IndexedDB. Đảm bảo `srs-study` entrypoint là origin duy nhất đọc/ghi SRS DB.

```ts
export interface SrsGetDecksNotetypesPayload {
  readonly type: 'SRS_GET_DECKS_NOTETYPES';
  readonly payload: {
    readonly targetLanguage: string;
  };
}

export interface SrsGetDecksNotetypesResponse {
  readonly collections: readonly SrsCollection[];
  readonly defaultCollectionId?: string;
  readonly defaultDeckId?: string;
  readonly defaultNotetypeId?: string;
}
```

### Cross-context (Slice 11)

```ts
export interface SrsCreateNoteRequest {
  readonly type: 'SRS_CREATE_NOTE';
  readonly payload: {
    readonly targetWord: string;
    readonly sentence?: string;
    readonly definition?: string;
    readonly audioUrl?: string;
    readonly imageUrl?: string;
    readonly targetLanguage: string;
  };
}

export interface SrsOpenStudyPageRequest {
  readonly type: 'SRS_OPEN_STUDY_PAGE';
}
```

Background handler mở tab `chrome-extension://<id>/src/entrypoints/srs-study/index.html` hoặc route đến offscreen nếu cần ghi DB từ service worker.

---

## Storage & Migration

### IndexedDB: `cell-srs-{hash}`

```
collections        keyPath: id, index: by_languageProfileId
decks              keyPath: id, index: by_collection, by_parent
studyConfigs       keyPath: id
notetypes          keyPath: id, index: by_collection
notes              keyPath: id, index: by_notetype, by_deck
cards              keyPath: id, index: by_note, by_deck, by_deck_due
audioAssets        keyPath: id, index: by_note
imageAssets        keyPath: id, index: by_note
reviewEvents       keyPath: id, index: by_card, by_component, by_timestamp
```

`DB_SCHEMA_VERSION = 1` cho V1. `onupgradeneeded` tạo stores/indexes nếu version tăng.

### `settingsStore` schema v26 → v27

```ts
export interface SrsSettingsSlice {
  readonly defaultStudyConfigId: string | null;
  readonly activeCollectionId: string | null;     // collection đang active
  readonly activeDeckId: string | null;            // deck đang active
  readonly activeLanguageProfileId: string | null; // language profile đang active trong SRS
  readonly dataLifecycle: SrsDataLifecycleConfig;
}

export interface SrsDataLifecycleConfig {
  readonly reviewEventMaxAgeDays: number; // default 365
  readonly reviewEventMaxCount: number;   // default 10000
  readonly audioQuotaMb: number;          // default 50
  readonly imageQuotaMb: number;          // default 50
}

// Thêm vào Settings
readonly srs: SrsSettingsSlice;

// Bump CURRENT_SCHEMA_VERSION lên 27.
// Migration v26 → v27:
{
  srs: {
    defaultStudyConfigId: null,
    activeCollectionId: null,
    activeDeckId: null,
    activeLanguageProfileId: null,
    dataLifecycle: { reviewEventMaxAgeDays: 365, reviewEventMaxCount: 10000, audioQuotaMb: 50, imageQuotaMb: 50 },
  },
}
```

---

## Data Lifecycle & Privacy

- **No sync / no export V1**. Dữ liệu SRS ở local IndexedDB; mất khi uninstall extension hoặc xóa profile.
- **Delete-cascade**:
  - Delete Collection → delete all decks, notetypes, notes, cards, reviewEvents, audioAssets, imageAssets.
  - Delete Deck → delete subdecks, notes, cards, reviewEvents/assets thuộc deck.
  - Delete Note → delete card + reviewEvents/assets thuộc note.
  - Delete Card → delete reviewEvents thuộc card; **giữ Note để user có thể tạo lại card sau này**. `Card` là instance, `Note` là content.
- **Review event retention**: prune khi vượt `reviewEventMaxCount` hoặc `reviewEventMaxAgeDays`, giữ lại record gần nhất.
- **Audio/Image asset eviction**: LRU khi vượt quota.
- **First-run UI**: cảnh báo "Dữ liệu chỉ lưu trên máy; gỡ extension sẽ mất."

---

## UI/UX

### Review flow

1. **Front**: hiển thị duy nhất stimulus cần thiết.
   - **Meaning**: image / definition / sentence / example sentence.
   - **Sound**: word audio / sentence audio (+ câu với target word bị che nếu có). Nếu audio không có, dùng non-audio fallback (IPA / masked sentence / definition).
   - **Spelling**: image / audio / sentence với target masked + input field.
2. **Reveal**: learner nhấn "Show Back" hoặc Enter trong input.
3. **Back**: target word, sentence, definition, word audio, sentence audio, image, example sentences, notes, translation/reference.
4. **Self-assessment**:
   - **Meaning/Sound**: 2 nút Forget/Remember.
   - **Spelling**: input + live check.
     - Nút `Remember` bị disabled cho đến khi `typedInput` khớp `targetWord` sau normalization.
     - Input sai hiển thị phản hồi trực quan (red underline / shake / "Try again") và user phải sửa cho đúng. V1 không so sánh từng ký tự; chỉ so khớp toàn bộ input sau normalization.
     - Khi input khớp, hệ thống tự động:
       1. Bật `Remember`.
       2. Sau 1 khoảng delay (configurable, default 800ms) auto-submit `Remember`.
       3. Reveal Back.
       4. Auto-advance sang card / component tiếp theo.
     - Nút `Forget` luôn available: nếu user không biết, click Forget để reveal Back ngay và áp penalty.
5. **Explore mode**: UI đánh dấu "Explore" nhẹ; progress không thay đổi; learner vẫn chọn Forget/Remember để ghi nhận cảm nhận (nhưng không ảnh hưởng progress/FSRS).

### Progress UI

```
[targetWord]
Sound   ━━━━━━━━━━ 100%
Meaning ━━━━━━━━━  92%
Spelling ━━━━━░░░  61%
```

### Dashboard header

- **Language profile selector**: dropdown chọn language profile; mỗi profile tương ứng 1 `targetLanguage`. Khi chuyển profile, SRS dashboard/study chuyển sang Collection của language đó (auto-create nếu chưa có).
- **Collection summary**: số cards due, new, in maintenance, tổng review hôm nay.
- **Quick action**: "Study", "Add word", "Manage".

### Management UI

- **Deck Manager**: CRUD deck/subdeck, move, reorder.
- **Notetype Manager**: CRUD notetype, fields, front/back templates.
- **SRS Settings**: threshold, learning path, progress constants, study config.

### Add to SRS from dictionary

1. Trong dictionary popup / universal panel, user chọn destination **Anki** hoặc **Ocean SRS** (dropdown hoặc toggle).
2. Nếu chọn **Ocean SRS**:
   - Hệ thống gửi message `SRS_GET_DECKS_NOTETYPES` với `targetLanguage` để lấy list collections + decks + notetypes.
   - Mở **Card Creator** (reuse `src/features/cardCreator`) với destination `ocean-srs`.
   - Card Creator pre-fill fields từ dictionary lookup (target, sentence, definition, IPA, audio, image, translation) theo mapping `mapDictionaryToSrsFields`.
   - UI hiển thị:
     - **Destination selector**: Anki / Ocean SRS.
     - **Language / Collection / Deck / Notetype selectors**.
     - **Field editor** theo notetype đã chọn; user có thể chỉnh sửa/override từng field.
     - **Media capture/upload**: reuse media handling của Card Creator.
     - Nút "Add".
3. Khi click "Add" trong Card Creator:
   - Validate targetWord, deck, notetype.
   - Resolve audio/image URLs thành `ArrayBuffer` cache trước khi tạo Note (hoặc mark as pending download).
   - Gửi `SRS_ADD_NOTE` message từ Card Creator.
   - Hệ thống tạo Note + Card rồi toast success / error.

### Empty / loading / error / first-run

- First-run: nếu chưa có Collection, hệ thống auto-create default Collection + deck + notetype + study config, sau đó hiển thị hướng dẫn "Thêm từ → Học".
- Loading: skeleton.
- Error: `Alert` + retry.
- No due cards: thông báo "No cards due."

### Reset confirmation

- Reset Component: "Reset [Sound] của [targetWord]? Progress sẽ mất."
- Reset Card: "Reset toàn bộ thẻ? Tất cả component trở về ban đầu."

### Responsive

- Desktop: 2 cột (card + progress).
- Tablet: 1 cột, progress collapsible.
- Mobile: full-width, bottom action bar, touch target ≥ 44px; input spelling `inputMode="latin"`.

---

## Code Style

- Named exports. Không default export.
- Không `any`. Types tường minh qua Zod tại persistence/message boundaries.
- Pure logic functions.
- Repositories return immutable objects.
- UI dùng `src/shared/ui/*`, CSS modules, `tokens.css`.
- Error handling: repository methods throw `SrsError` với code; UI hiển thị `Alert`.
- Logging: `console` trong dev; không log secrets.

---

## Testing Strategy

### Unit tests

- `progressCalculator.test.ts`: gain/penalty, threshold, maintenance, spelling correct, explore mode.
- `learningPath.test.ts`: isLocked, sequential, parallel, explore.
- `exploreMode.test.ts`: explore sequence, minExplores.
- `scheduler.test.ts`: by_deck_due, pool selection, explore pool, deck scoping, no due.
- `reviewEngine.test.ts`: Forget/Remember, FSRS mapping, Study Again, typed input, reset.
- `maskSentence.test.ts`: masking, multi-word.
- `srsFsrsAdapter.test.ts`: state, due, migrate.

### Integration

- `srsReviewFlow.test.ts`: create note → card → schedule → review → verify.
- `srsStorageMigration.test.ts`: settings v26 → v27.

### E2E

- `e2e/ocean-srs.spec.ts`: open page, create collection/deck/notetype, add note, review, verify component progress, reset confirm.

---

## Boundaries

### Always do

- Validate payload bằng Zod.
- Giữ `SrsFsrsSerializedState` opaque; dùng `adapter.getDue()` ở scheduler.
- Chạy `typecheck` + `test:unit` sau mỗi slice.
- Tái dùng `src/shared/ui/`, tokens.
- Offline-first.
- Dùng `by_deck_due` compound index + bounded scan.
- Sanitize text fields trước render.
- Gọi `recalcCard` sau mọi card write.

### Ask first

- Thêm dependency mới.
- Thay đổi `manifest.json` / `vite.config.ts`.
- Tăng `CURRENT_SCHEMA_VERSION`.
- Đổi tokens.
- Thay đổi judgment mapping.
- Thay đổi progress formula V1.

### Never do

- Bundle secret/API key.
- Phụ thuộc AI/cloud cho core review.
- Native translation thành primary path.
- Để component fail làm mất progress component khác.
- Lưu FSRS raw object thiếu `version`.
- Hardcode styles.
- Sort toàn bộ `cards` store.
- Đọc `comp.fsrsState.due` trực tiếp bên ngoài adapter.

---

## Success Criteria & Acceptance Criteria

### Build / quality gates

- [ ] `npm run typecheck` 0 error.
- [ ] `npm run build` pass.
- [ ] `npm run lint` pass.
- [ ] `npm run test:unit` pass cho SRS tests.

### Functional AC

| ID | Given | When | Then |
|---|---|---|---|
| A1 | New card 0/0/0 | Start review | First review là Sound, then Meaning, then Spelling (explore pool, default parallel, minExplores=1); `exploreCount` tăng mỗi lần show; progress không đổi trong explore. |
| A2 | Sound=40, Meaning=95, Spelling=90 | Scheduler runs | Sound được chọn; Meaning/Spelling lower priority. |
| A3 | Review type = Meaning | User selects Remember | Meaning progress tăng; Sound/Spelling không đổi. |
| A4 | Review type = Sound; cannot identify | User selects Forget | Only Sound cập nhật. |
| A5 | Spelling; input matches target word | System auto-submits Remember after match delay | Spelling progress tăng; auto-advance. |
| A6 | Spelling; input does not match | User either corrects until match, or selects Forget | If Forget: Spelling penalty; if corrected and auto-submitted: Spelling progress tăng. |
| A7 | Sound=95; user selects Study Sound Again | Review starts | Immediate Sound review; FSRS `due` không đẩy về phía trước. |
| A8 | Reset Sound confirmed | Reset applied | Sound về 0; Meaning/Spelling không đổi; `nextDue` recalc. |
| A9 | Reset Card confirmed | Reset applied | All components về 0; `nextDue` recalc. |
| A10 | Network disabled; audio cached | Sound review | Audio phát từ cache. |
| A11 | All components >= threshold | Scheduler runs | Card ở low priority; FSRS vẫn schedule retention. |
| A12 | Create Collection/Deck/Notetype/Note | CRUD operations | Persist vào IndexedDB; hiển thị đúng. |
| A13 | Sequential mode active | Meaning < threshold | Spelling locked; cannot be selected. |
| A14 | v26 settings tồn tại | Extension upgrade | Migration v26→v27 thêm `srs` slice với defaults. |
| A15 | No cards due | User opens study | Empty state "No cards due." |
| A16 | Maintenance card; one component Forget | Review completes | Component đó trở lại active; `maintenanceMode` recalc. |
| A17 | Study Again for future-due component | Review completes | Component xuất hiện ngay; due không đổi. |
| A18 | User in dictionary popup; selects "Add to Ocean SRS" | Chooses deck + notetype, then confirms | Note + Card được tạo với pre-fill fields; card appears in selected deck. |
| A19 | No Collection exists | User tries to add from dictionary popup | System auto-creates default Collection + deck + notetype, then adds the card. |
| A20 | User switches language profile in SRS dashboard | Selects Spanish | Dashboard switches to Spanish Collection (auto-create if missing); study scheduler uses Spanish cards. |

### Failure catalog (`SrsError` codes)

| Code | Situation |
|---|---|
| `SRS_NOT_FOUND` | Card/note/deck/notetype không tồn tại. |
| `SRS_INVALID_INPUT` | Input không pass Zod validation. |
| `SRS_AUDIO_UNAVAILABLE` | Audio asset không cache và không resolve được. |
| `SRS_IMAGE_OFFLINE` | Image URL external, không thể tải offline. |
| `SRS_QUOTA_EXCEEDED` | Audio/image asset vượt quota. |
| `SRS_SCHEDULER_EMPTY` | Không có card nào due. |

### Traceability

| Intent case | AC |
|---|---|
| A | A1 |
| B | A2 |
| C | A3 |
| D | A4 |
| E | A5 |
| F | A6 |
| G | A7 + A17 |
| H | A8 |
| I | A9 |

### Performance

- Scheduler query ≤ 100ms cho 1000 cards.
- Review transition ≤ 300ms desktop, ≤ 500ms Android.
- First paint study page ≤ 1.5s.

---

## Implementation Slices (MoSCoW)

### Must

1. **S0 — T0 spike**: `ts-fsrs` bundle + API mapping.
2. **S1 — Domain model + storage**: types, baseRepository, IndexedDB schema, settings v26→v27.
3. **S2 — Notetype/Deck CRUD + default seed**: notetype manager, default notetype (8 templates), deck/subdeck manager.
4. **S3 — Note/Card creation**: create note manually OR add from dictionary popup/universal panel **qua Card Creator reuse**, deck/notetype selector, generate 3 components, default study config.
5. **S4 — Progress & learning path**: progress formula, `isLocked`, `recalcCard`, explore mode, maintenance.
6. **S5 — Scheduler**: `by_deck_due`, `resolvePool`, `pickHighestPriority`, deck scoping, batch fetch.
7. **S6 — Review engine + FSRS integration**: `srsFsrsAdapter`, `applyReview`, `reset*`, `studyAgain`, reschedule.
8. **S7 — Review UI**: Front/Back, input, Forget/Remember, progress bars.
9. **S8 — User controls**: Study Again, Reset Component, Reset Card (confirm dialogs).
10. **S9 — Entrypoint + build**: `src/entrypoints/srs-study/`, `vite.config.ts`, `manifest.json`, E2E smoke.

### Should

11. **S10 — Audio/image asset cache**: offline audio/image, LRU/quota, population at note creation.
12. **S11 — Cross-context bulk import**: batch add from reader / video / word-list (`srsDestination` expansion, message bus).

### Could

13. **S12 — Advanced templates**: user CSS, template variables.
14. **S13 — Analytics dashboard**: review event charts.

---

## Default Notetype Seed (appendix)

Mặc định cho mỗi `SrsCollection` mới:

```ts
const DEFAULT_FIELDS: SrsField[] = [
  { id: 'target',   name: 'Target word',   order: 0, type: 'text' },
  { id: 'ipa',      name: 'IPA',           order: 1, type: 'text' },
  { id: 'sentence', name: 'Sentence',      order: 2, type: 'text' },
  { id: 'def',      name: 'Definition',    order: 3, type: 'text' },
  { id: 'wordAudio',  name: 'Word audio',  order: 4, type: 'audio' },
  { id: 'sentAudio',  name: 'Sentence audio', order: 5, type: 'audio' },
  { id: 'image',    name: 'Image',         order: 6, type: 'image' },
  { id: 'examples', name: 'Examples',      order: 7, type: 'list' },
  { id: 'notes',    name: 'Notes',         order: 8, type: 'text' },
  { id: 'translation', name: 'Translation', order: 9, type: 'translation' },
  { id: 'context',  name: 'Context',       order: 10, type: 'context' },
];

function createDefaultNotetype(collectionId: string): SrsNotetype {
  return {
    id: `default-word-${collectionId}`,
    collectionId,
    name: 'Word (default)',
    targetFieldId: 'target',
    fields: DEFAULT_FIELDS,
    frontTemplates: [
      // 1. Sound — word audio
      { id: `sound-word-audio-${collectionId}`, componentType: 'sound', stimulusType: 'word-audio', fieldIds: ['wordAudio'], requiresInput: false },
      // 2. Sound — sentence audio
      { id: `sound-sentence-audio-${collectionId}`, componentType: 'sound', stimulusType: 'sentence-audio', fieldIds: ['sentAudio'], maskFieldId: 'sentence', maskTarget: true, requiresInput: false },
      // 3. Sound — IPA fallback
      { id: `sound-ipa-${collectionId}`, componentType: 'sound', stimulusType: 'ipa', fieldIds: ['ipa'], requiresInput: false, prompt: 'Pronounce this word' },
      // 4. Meaning — image
      { id: `meaning-image-${collectionId}`, componentType: 'meaning', stimulusType: 'image', fieldIds: ['image'], requiresInput: false },
      // 5. Meaning — definition
      { id: `meaning-definition-${collectionId}`, componentType: 'meaning', stimulusType: 'definition', fieldIds: ['def'], requiresInput: false },
      // 6. Meaning — sentence
      { id: `meaning-sentence-${collectionId}`, componentType: 'meaning', stimulusType: 'sentence', fieldIds: ['sentence'], maskFieldId: 'sentence', maskTarget: true, requiresInput: false },
      // 7. Spelling — image + input
      { id: `spelling-image-${collectionId}`, componentType: 'spelling', stimulusType: 'image', fieldIds: ['image'], requiresInput: true },
      // 8. Spelling — sentence + input
      { id: `spelling-sentence-${collectionId}`, componentType: 'spelling', stimulusType: 'sentence', fieldIds: ['sentence'], maskFieldId: 'sentence', maskTarget: true, requiresInput: true },
    ],
    backTemplate: { fieldIds: ['target', 'ipa', 'sentence', 'def', 'wordAudio', 'sentAudio', 'image', 'examples', 'notes', 'translation'], showAll: true },
  };
}


Hệ thống gọi `createDefaultNotetype(collectionId)` khi tạo `SrsCollection`; lưu id trả về vào `collection.defaultNotetypeId`. Template ids được gắn prefix `collectionId` để tránh xung đột cross-collection.

---

## Definition of Done

Feature được coi là hoàn thành khi:

- [ ] **Spec đã được review bằng `spec-review-stakeholder`** với kết quả APPROVE hoặc APPROVE WITH CHANGES.
- [ ] **Tất cả AC A1–A20 pass** trong unit/integration tests hoặc E2E browser test.
- [ ] **Review engine**:
  - Unit tests cho `applyReview`, `calculateProgress`, `recalcCard`, `selectNextReview`, `resolveReviewSurface`, `studyAgain`, `resetComponent`, `resetCard`.
  - Bao phủ explore, normal, studyAgain, maintenance, sequential/parallel, spelling correct/incorrect, auto-advance.
- [ ] **Scheduler**:
  - Unit tests cho `resolvePool`, `pickHighestPriority`, `by_deck_due` cursor, batch fetch, deck scoping.
  - Không có async fetch bên trong IndexedDB cursor.
- [ ] **Storage & migration**:
  - IndexedDB schema `cell-srs-{hash}` đúng stores/indexes.
  - Migration v26 → v27 tạo `Settings.srs` slice với `activeLanguageProfileId`.
  - Delete-cascade collection/deck/note/card/assets/reviewEvents hoạt động đúng.
- [ ] **Message bus**:
  - `SRS_ADD_NOTE`, `SRS_GET_DECKS_NOTETYPES`, `SRS_OPEN_STUDY_PAGE` payload được validate bằng Zod.
  - Cross-context add từ dictionary popup / Card Creator đến `srs-study` entrypoint hoạt động.
- [ ] **Card Creator reuse**:
  - V1 destination `'anki' | 'ocean-srs'` hoạt động.
  - Pre-fill fields từ dictionary lookup vào Card Creator.
  - Create Note + Card 3 components qua `addNoteAndCard`.
- [ ] **Offline review**:
  - Audio/image cache hit tạo blob URL; cache miss chọn template fallback.
  - Không có network call trong study session.
- [ ] **UI/UX**:
  - Review flow, progress bars, dashboard, language profile selector render đúng trên desktop/tablet/mobile.
  - Spelling input: red feedback khi sai, auto-submit + auto-advance khi đúng.
  - Pass `design-system-guardian` audit nếu chạm CSS/TSX.
- [ ] **E2E / Browser**:
  - `testing-extension-browser` skill: first-run auto-create collection, add word from dictionary, review Sound/Meaning/Spelling, switch language profile.
  - Offline smoke test: disable network, review vẫn chạy.
- [ ] **Quality gates**:
  - `npx tsc --noEmit` pass.
  - `npm run lint` pass.
  - `npm run test:unit` pass.
  - `npm run build` pass.
- [ ] **Docs**:
  - `docs/intent/ocean-language-acquisition-srs.md` và `docs/specs/ocean-language-acquisition-srs.md` đã cập nhật.
  - `docs/2-architechture-system.md` cập nhật nếu thay đổi kiến trúc lớn.
  - ADR viết nếu có quyết định kiến trúc non-trivial (ví dụ vendored FSRS adapter, notetype/template id scheme).
- [ ] **Security / Privacy**:
  - Không log secrets, không gửi dữ liệu SRS ra network.
  - IndexedDB chứa dữ liệu local; cảnh báo first-run "Dữ liệu chỉ lưu trên máy".

---

## Open Questions

1. `ts-fsrs` bundle/compat + `preserveDue` implementation → T0 spike quyết định.
2. Audio fallback chain chi tiết khi Pronunciation Engine chậm.
3. Android IME cho spelling recall.
4. Review event prune policy — đã quyết: prune theo `dataLifecycle` (max age + max count).
5. Image import flow từ reader/dictionary (Slice 11).
6. Cross-collection default notetype / template id generation scheme.

---

## Risks chấp nhận

- `ts-fsrs` bundle/compat pending T0 spike; fallback vendored port.
- Exact-match spelling khắt khe với inflection → revisit khi mở ngôn ngữ ngoài English.
- Pronunciation Engine v0.1 → non-audio fallback nếu engine chậm.
- Multi-device sync out-of-scope; data lost on uninstall.
- Progress formula constants unvalidated; config-tunable, cần đo lường post-V1.
- Multi-word/inflected target masking là exact string match V1.

---

## User Journey Flow

### Persona

**Linh** — 24 tuổi, đang học tiếng Anh để xem video/đọc báo. Dùng Cell trên Chrome laptop. Chưa từng dùng SRS nào. Mục tiêu: nhớ từ theo **nghĩa, âm, chính tả** thay vì chỉ dịch nghĩa.

---

### Flow 1 — First-run / Onboarding

```
1. Linh mở extension popup → chọn tab "Ocean SRS".
   - Hoặc: Linh mở universal panel trên trang web → chọn tab "Ocean SRS".
2. Màn hình đầu tiên:
   - Header có **language profile selector** (dropdown) cho phép Linh chuyển đổi giữa các profile language đã có trong Cell.
   - Nếu chưa có Collection nào cho language đang chọn:
     - Thông báo "Chào mừng. Dữ liệu SRS chỉ lưu trên máy."
     - Hệ thống lấy `targetLanguage` và `languageProfileId` từ profile đang chọn.
     - Hệ thống tự động tạo Collection default "My SRS" + default deck "Default" + default notetype "Word (default)" + default study config.
     - User có thể đổi tên hoặc tạo mới sau.
   - Nếu đã có Collection cho language đang chọn: hiển thị dashboard/study.
3. Linh có thể đổi language profile bất cứ lúc nào; SRS sẽ chuyển sang Collection/Deck tương ứng.
4. Linh xem hướng dẫn ngắn: "Chọn language → Thêm từ → Học → Ôn tập".
```

### Flow 2 — Add a Learning Object từ dictionary panel

```
1. Linh đang đọc web, gặp từ "abandon".
2. Linh mở dictionary popup / universal panel.
3. Panel hiển thị definition, sentence, audio, image, IPA.
4. Ở tab bên phải (hoặc bottom action bar), Linh chọn destination:
   - "Add to Anki" (mặc định nếu srsDestination='anki')
   - "Add to Ocean SRS" (nếu srsDestination='ocean-srs' hoặc chọn thủ công)
5. Linh chọn "Ocean SRS".
6. Hệ thống xác định target language:
   - Từ lookup result: `targetLanguage = result.langCode` (ví dụ 'en').
   - Nếu `targetLanguage` khác active SRS language, panel hiển thị cảnh báo và cho phép Linh:
     - Thêm vào collection của language này (auto-create nếu chưa có).
     - Chuyển active SRS language sang language này.
     - Chọn collection khác đã có.
7. Hệ thống mở **Card Creator** (reuse component `src/features/cardCreator`) ở chế độ **Ocean SRS destination**:
   - Pre-fill target word, sentence, definition, IPA, audio, image, translation từ dictionary lookup.
   - **Language / Collection selector** (Ocean SRS collection tương đương deck group).
   - **Deck selector** (SRS deck).
   - **Notetype selector** (SRS notetype; default là "Word (default)").
   - **Field editor**: các field của notetype đã chọn; Linh có thể chỉnh sửa hoặc override dictionary data.
8. Linh chỉnh sửa nếu cần, click "Add".
9. Card Creator gửi message `SRS_ADD_NOTE` với payload gồm `targetLanguage`, `collectionId`/`deckId`/`notetypeId`, và fields.
10. Hệ thống validate:
    - targetWord không rỗng.
    - deck + notetype hợp lệ.
    - chưa có card nào khác cho note này trong deck đích.
11. Hệ thống tạo Note + Card 3 component (Meaning/Sound/Spelling) với progress 0/0/0.
12. Hệ thống gọi recalcCard → nextDue = now (vì 3 component đều mới).
14. Panel đóng hoặc reset, Linh thấy toast "Đã thêm vào Ocean SRS".
```

### Flow 3 — Explore (first exposure)

```
1. Linh vào study page, click "Study".
2. Scheduler chọn Card "abandon" ở pool explore.
3. Front hiện Sound — word audio (nếu có) hoặc IPA fallback.
   - Dưới cùng có 2 nút: Forget / Remember.
   - Badge "Explore" màu xám.
4. Linh click "Remember" (hoặc "Forget").
5. applyReview chạy ở mode 'explore':
   - exploreCount[sound] += 1
   - progress không đổi
   - FSRS state không đổi
6. Back hiện đầy đủ target word, sentence, definition, audio, image.
7. Linh click "Next".
8. Scheduler chọn tiếp component tiếp theo trong `stages` chưa đủ `minExplores`.
   - Mỗi lần exploreCount tăng, progress vẫn 0.
9. Sau khi tất cả component trong `stages` đạt `exploreCount >= minExplores`, card chuyển sang active (các component bắt đầu lấy progress).
```

### Flow 4 — Active review (normal mode)

```
1. Hôm sau Linh mở study page.
2. Scheduler thấy Card "abandon" due.
3. Tùy priority, scheduler chọn component cần reinforce nhất:
   - Sound = 0 (thấp nhất) → chọn Sound.
4. Front hiện word audio. Linh nghe, tự đánh giá, click "Remember".
5. applyReview chạy ở mode 'normal':
   - progress[sound] += gain(0) = 20 → 20
   - FSRS next(due=now+1d)
   - recalcCard → nextDue = min(meaning due, spelling due, sound due)
6. Back hiện. Linh click "Next".
7. Lần sau Sound due, tiếp tục. Meaning cũng bắt đầu due.
```

### Flow 5 — Spelling recall (type-in, correct until right, auto-advance)

```
1. Scheduler chọn Spelling (progress = 40, due).
2. Front hiện stimulus (image / audio / sentence masked) + input field.
3. Linh bắt đầu gõ:
   - Sau mỗi lần input thay đổi, hệ thống so sánh toàn bộ normalized input với target word.
   - Nếu input chưa đúng:
     - UI hiển thị phản hồi "sai" (red underline / shake / "Try again").
     - Nút "Remember" disabled.
     - Nút "Forget" vẫn available để user bỏ cuộc / không biết.
   - Linh phải sửa lại cho đúng (hoặc click Forget).
4. Linh gõ đúng "abandon":
   - Input khớp target word.
   - Hệ thống tự động chuyển hành động:
     - Auto-submit judgment = 'remember'.
     - isSpellingCorrect = true.
     - Reveal Back (theo `backTemplate.showAll`).
     - Hiển thị inline badge "Correct" / "Good job".
     - Sau delay 800ms, auto-advance sang card / component tiếp theo.
5. Nếu Linh click "Forget" (không biết):
   - applyReview với judgment = 'forget'.
   - isSpellingCorrect = false.
   - progress[spelling] -= penalty(40)
   - FSRS next with rating Again
   - Reveal Back (theo `backTemplate.showAll`).
6. applyReview khi đúng (auto):
   - isSpellingCorrect = true
   - progress[spelling] += gain(40)
   - FSRS next with rating Good
   - reviewCount += 1
```

### Flow 6 — Study Again

```
1. Linh đang review Sound "abandon" (progress 95, due hôm nay).
   - Nghe xong không chắc, muốn ôn lại ngay.
2. Linh click "Study Again" thay vì Forget/Remember.
3. studyAgain(card, 'sound', now):
   - studyAgainDue[sound] = now
   - recalcCard → nextDue = now
4. Scheduler chọn lại component Sound ở pool 'studyAgain'.
5. Front hiện Sound. Linh click "Remember".
6. applyReview mode 'studyAgain':
   - progress[sound] += gain(95) = 1 → 96
   - adapter.next(preserveDue=true): due giữ nguyên, chỉ cập nhật reps
   - clear studyAgainDue[sound] = null
7. Card quay lại trạng thái satisfied/maintenance.
```

### Flow 7 — Maintenance mode

```
1. Sau nhiều lần ôn, Meaning=94, Sound=96, Spelling=92.
2. recalcCard thấy tất cả >= threshold (90) → maintenanceMode = true.
3. Scheduler vẫn schedule card, nhưng ở pool maintenance (ưu tiên thấp).
4. Front có thể là bất kỳ component nào due.
5. Nếu Linh click "Forget" trên Meaning:
   - progress[meaning] -= penalty(94) = 5 → 89 (< 90)
   - recalcCard → maintenanceMode = false
   - component Meaning trở lại active.
```

### Flow 8 — Reset

```
1. Linh vào Card Manager, chọn "abandon".
2. Click "Reset Sound" → confirm.
3. resetComponent(card, 'sound'):
   - progress[sound] = 0, exploreCount[sound] = 0
   - fsrsState[sound] = createEmpty(now)
   - studyAgainDue[sound] = null
   - recalcCard → nextDue, maintenanceMode cập nhật
4. Card Sound trở về new/explore.
5. Nếu Linh click "Reset Card" → tất cả 3 component về 0.
```

### Flow 9 — Offline review

```
1. Linh rời mạng, mở study page.
2. Scheduler chỉ scan cards đã due trong IndexedDB.
3. Với mỗi card, selectStimulus kiểm tra audio/image cache:
   - Cache hit → tạo blob URL, phát.
   - Cache miss → chọn template fallback không cần media.
4. Review tiếp tục bình thường. Không có AI, không có network.
5. Khi kết thúc session, revoke blob URLs.
```

### Flow 10 — End-of-session / Daily check

```
1. Linh học xong 15 phút, click "Done".
2. Dashboard hiển thị:
   - Số cards reviewed hôm nay.
   - Progress trung bình theo component.
   - Số cards due ngày mai.
3. Linh đóng tab. Hệ thống lưu review events append-only.
```

### Flow 11 — Switch language profile

```
1. Linh đang ở SRS dashboard, đang học tiếng Anh.
2. Linh click **language profile selector** ở header.
3. Danh sách hiển thị các language profile đã có trong Cell (en, ja, es, ...).
4. Linh chọn "Spanish".
5. Hệ thống:
   - Đặt `activeLanguageProfileId = 'es'` trong `Settings.srs` slice.
   - Tìm Collection nào có `targetLanguage='es'`.
   - Nếu chưa có → auto-create default "My SRS — es" + deck + notetype + study config.
   - Dashboard reload, hiển thị cards của Spanish.
6. Linh có thể review tiếng Spanish ngay; scheduler chỉ chọn cards thuộc collection của Spanish.
7. Linh có thể thêm từ từ dictionary popup vào collection Spanish (nếu lookup language là es hoặc chọn manual).
```

---

### State map across flows

| Flow | User action | System | Card state after |
|---|---|---|---|
| Add word | Submit form | createCard | all progress 0, nextDue = now, explore pending |
| Explore | Remember/Forget | applyReview mode='explore' | exploreCount ↑, progress unchanged |
| Normal review | Remember/Forget | applyReview mode='normal' | progress ±, FSRS due updated |
| Spelling | Type + submit | applyReview with isSpellingCorrect | progress ± based on exact match |
| Study Again | Click "Study Again" | studyAgain + applyReview mode='studyAgain' | progress ↑, FSRS due preserved |
| Maintenance | Forget on satisfied component | applyReview mode='normal' | maintenanceMode may become false |
| Reset | Confirm reset | resetComponent / resetCard | progress 0, fsrsState empty |
| Offline | Open study | selectNextReview + cache fallback | review continues with media fallback |

### Entry points

- `chrome-extension://<id>/src/entrypoints/srs-study/index.html`
- Extension popup → tab "Ocean SRS" (mở study page / dashboard).
- Universal dictionary panel → tab "Ocean SRS" (thêm từ mới vào SRS).
- SRS study page entrypoint: `chrome-extension://<id>/src/entrypoints/srs-study/index.html`.
- (Slice 11) Dictionary popup / reader → "Add to Ocean SRS".

---

## Implementation Status

> Last updated: current session.

### Build / quality gates

- [x] `npm run typecheck` 0 error.
- [x] `npm run build` pass.
- [x] `npm run lint` pass.
- [x] `npm run test:unit` pass cho SRS tests (122 tests).

### Slices completed

- [x] S0 — T0 spike `ts-fsrs` + `SrsFsrsAdapter`.
- [x] S1 — Domain model, IndexedDB schema, settings v26→v27.
- [x] S2 — Notetype/Deck CRUD + default notetype seed.
- [x] S3 — Note/Card creation (`addNoteAndCard`) + first-run bootstrap.
- [x] S4 — Progress/learning path, `isLocked`, `recalcCard`, explore/maintenance.
- [x] S5 — Scheduler `by_deck_due`, `resolvePool`, `pickHighestPriority`.
- [x] S6 — Review engine + FSRS integration, `applyReview`, `reset*`, `studyAgain`.
- [x] S7 — Review UI Front/Back, input, Forget/Remember.
- [x] S8 — User controls: Study Again, Reset Component, Reset Card with confirm.
- [x] S9 — `srs-study` entrypoint, `vite.config.ts`, `manifest.json`.
- [x] S10 — Audio/image asset cache + population at note creation.
- [x] S11 — Cross-context dictionary popup "Add to Ocean SRS" (`SRS_ADD_NOTE`, background handlers).
- [x] S12 — User CSS panel in dashboard.
- [x] S13 — Dashboard analytics (due now, due 24h, total, studied today).
- [x] S14 — Management UI (deck/subdeck CRUD + note/card list & delete) in `srs-study` dashboard.

### Management UI status

> User requested: tab “Manage” trong `srs-study` dashboard.

- [x] **Deck / subdeck CRUD**: list root/sub decks, create deck, create subdeck, delete deck (cascade).
- [x] **Note / card CRUD (inside)**: list notes/cards per deck, view target + progress, delete note/card (cascade).
- [ ] **Notetype manager**: deferred — V1 uses default notetype.

### Known ceilings / next steps

- Multi-language collection auto-creation on add-from-dictionary (V1 falls back to active language profile).
- `SRS_GET_DECKS_NOTETYPES` currently returns decks/notetypes for a given collection; caller must supply `collectionId`.
- [x] E2E smoke (`e2e/extension-ocean-srs.spec.ts`) đã viết và pass.
- Card Creator destination selector "Anki / Ocean SRS" chưa tích hợp; dictionary popup add là quick-add trực tiếp.

