/**
 * Ocean Language Acquisition SRS — cross-cutting domain types.
 *
 * Source of truth: docs/specs/ocean-language-acquisition-srs.md
 */

// === Primitive / enum types ===

export type SrsLanguageCode = string; // ISO/BCP-47

export type ComponentType = 'meaning' | 'sound' | 'spelling';

export type ReviewJudgment = 'forget' | 'remember';

export type ReviewMode = 'explore' | 'normal' | 'studyAgain';

export type Pool = 'explore' | 'studyAgain' | 'active' | 'satisfied' | 'maintenance';

export type StimulusType =
  | 'image'
  | 'definition'
  | 'sentence'
  | 'example-sentence'
  | 'word-audio'
  | 'sentence-audio'
  | 'context'
  | 'ipa';

// === Collection / Deck / Study Config ===

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
  readonly rememberGainBase: number; // default 20
  readonly rememberGainMin: number; // default 1
  readonly forgetPenaltyBase: number; // default 12
  readonly forgetPenaltyStep: number; // default 0.1
}

export interface SrsLearningPathConfig {
  readonly stages: readonly ComponentType[]; // default ['sound','meaning','spelling']
  readonly progressionMode: 'sequential' | 'parallel'; // default 'parallel'
  readonly minExplores: number; // default 1
}

// === Notetype / Field / Templates ===

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

export interface SrsFrontTemplate {
  readonly id: string;
  readonly componentType: ComponentType;
  readonly stimulusType: StimulusType;
  readonly fieldIds: readonly string[]; // field ids
  readonly maskFieldId?: string; // field để mask target phrase
  readonly maskTarget?: boolean; // true nếu mask target phrase trong sentence
  readonly requiresInput: boolean; // true cho spelling
  readonly prompt?: string;
}

export interface SrsBackTemplate {
  readonly fieldIds: readonly string[]; // danh sách field hiển thị trên Back, theo thứ tự
  readonly showAll: boolean; // V1: true = hiển thị tất cả fieldIds
}

// === Note / Field Values ===

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
  | {
      readonly kind: 'audio';
      readonly value: string;
      readonly source: 'local' | 'pronunciation' | 'tts';
    }
  | { readonly kind: 'image'; readonly value: string }
  | { readonly kind: 'list'; readonly value: readonly string[] }
  | { readonly kind: 'context'; readonly value: string };

// === Card / Memory Component / FSRS State ===

export interface SrsCard {
  readonly id: string;
  readonly noteId: string;
  readonly deckId: string;
  readonly components: Record<ComponentType, SrsMemoryComponent>;
  readonly studyAgainDue: Record<ComponentType, string | null>;
  readonly createdAt: number; // epoch ms
  readonly nextDue: string; // ISO, = min(effectiveDue across components)
  readonly maintenanceMode: boolean; // persisted, derived on write
}

export interface SrsMemoryComponent {
  readonly type: ComponentType;
  readonly progress: number; // 0–100
  readonly exploreCount: number;
  readonly fsrsState: SrsFsrsSerializedState;
  readonly reviewCount: number;
}

/**
 * Opaque serialized FSRS card state. The `SrsFsrsAdapter` is the only
 * boundary allowed to read/write this struct directly.
 *
 * Spec shape is camelCase with a `version` and optional `lastReview`.
 * `learningSteps` is intentionally included because `ts-fsrs` uses it for
 * short-term scheduling; omitting it would reset the learning/relearning
 * step counter on every load.
 */
export interface SrsFsrsSerializedState {
  readonly version: number;
  readonly due: string; // ISO
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsedDays: number;
  readonly scheduledDays: number;
  readonly reps: number;
  readonly lapses: number;
  readonly learningSteps: number;
  readonly state: number; // opaque ts-fsrs State enum
  readonly lastReview?: string; // ISO
}

// === Review / Session / Stimulus ===

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
  readonly payload: Record<string, SrsFieldValue>;
}

// === Assets ===

export interface SrsAudioAsset {
  readonly id: string; // hash(noteId + fieldId + source)
  readonly noteId: string;
  readonly fieldId: string;
  readonly source: 'local' | 'pronunciation' | 'tts';
  readonly mimeType: string;
  readonly bytes: ArrayBuffer;
  readonly size: number; // bytes
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

// === FSRS Adapter boundary ===

export interface SrsFsrsAdapter {
  readonly createEmpty: (now: Date) => SrsFsrsSerializedState; // due = now
  readonly next: (
    state: SrsFsrsSerializedState,
    now: Date,
    judgment: ReviewJudgment,
    preserveDue: boolean,
  ) => SrsFsrsSerializedState;
  // preserveDue=true: giữ nguyên `state.due`, chỉ cập nhật `reps`, `lastReview`.
  readonly isDue: (state: SrsFsrsSerializedState, now: Date) => boolean;
  readonly getDue: (state: SrsFsrsSerializedState) => string;
  readonly migrate: (state: unknown, fromVersion: number) => SrsFsrsSerializedState;
}

// === Scheduler helpers ===

export interface PoolCandidate {
  readonly card: SrsCard;
  readonly note: SrsNote;
  readonly notetype: SrsNotetype;
  readonly componentType: ComponentType;
  readonly effectiveDue: string;
  readonly progress: number;
  readonly pool: Pool;
}

// === MV3 message payloads ===

export interface SrsAddNotePayload {
  readonly type: 'SRS_ADD_NOTE';
  readonly payload: {
    readonly targetWord: string;
    readonly targetLanguage: string; // để chọn / auto-create Collection
    readonly collectionId?: string;
    readonly deckId?: string;
    readonly notetypeId?: string;
    readonly fields: Record<string, SrsFieldValue>; // pre-fill từ dictionary + user edit
  };
}

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
